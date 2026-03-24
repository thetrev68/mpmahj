import { expect, test, type Locator, type Page } from '@playwright/test';
import { prepareDeterministicBoard } from './support/gamePlay';

type Theme = 'dark' | 'light';

async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((requestedTheme: Theme) => {
    document.documentElement.classList.toggle('dark', requestedTheme === 'dark');
  }, theme);
}

async function getButtonOrder(buttonA: Locator, buttonB: Locator): Promise<number> {
  return buttonA.evaluate(
    (first, secondButton) => {
      const parent = first.parentElement;
      const second = secondButton as HTMLButtonElement | null;
      if (!parent || !second) {
        return Number.NaN;
      }

      const buttons = Array.from(parent.querySelectorAll('button'));
      return buttons.indexOf(first as HTMLButtonElement) - buttons.indexOf(second);
    },
    await buttonB.elementHandle()
  );
}

async function getBackgroundColor(locator: Locator): Promise<string> {
  return locator.evaluate((element) => window.getComputedStyle(element).backgroundColor);
}

function expectOpaqueBackground(color: string, label: string): void {
  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  expect(rgbaMatch, `${label} should expose a CSS color`).not.toBeNull();

  if (!rgbaMatch) {
    return;
  }

  const channels = rgbaMatch[1].split(',').map((part) => part.trim());
  const alpha = channels.length >= 4 ? Number(channels[3]) : 1;
  expect(alpha, `${label} should be opaque`).toBeGreaterThanOrEqual(0.99);
}

async function assertCharlestonCtaHierarchy(page: Page): Promise<void> {
  const proceedButton = page.getByTestId('proceed-button');
  const mahjongButton = page.getByTestId('declare-mahjong-button');
  const instruction = page.getByTestId('action-instruction');

  await expect(proceedButton).toBeVisible();
  await expect(mahjongButton).toBeVisible();
  await expect(instruction).toBeVisible();

  expect(await getButtonOrder(proceedButton, mahjongButton)).toBeLessThan(0);
  await expect(proceedButton).toHaveClass(/from-emerald-500/);
  await expect(mahjongButton).not.toHaveClass(/from-yellow-500/);
  await expect(mahjongButton).not.toHaveClass(/animate-pulse/);
}

async function assertDarkRailSurfaces(page: Page): Promise<void> {
  const rightRail = page.getByTestId('right-rail');
  const rightRailBottom = page.getByTestId('right-rail-bottom');
  const getHintButton = page.getByTestId('get-hint-button');

  await expect(rightRail).toBeVisible();
  await expect(rightRailBottom).toBeVisible();
  await expect(getHintButton).toBeVisible();
  await expect(page.getByTestId('right-rail-top')).toHaveCount(0);

  await expect(rightRail).toHaveClass(/dark:lg:bg-slate-950/);
  await expect(rightRailBottom).toHaveClass(/dark:bg-slate-900/);
  await expect(getHintButton).toHaveClass(/dark:bg-slate-950/);

  expectOpaqueBackground(await getBackgroundColor(rightRail), 'right rail');
  expectOpaqueBackground(await getBackgroundColor(rightRailBottom), 'right rail lower surface');
  expectOpaqueBackground(await getBackgroundColor(getHintButton), 'get hint button');
}

test.describe('US-084 Charleston CTA and Rail Visual States', () => {
  test('charleston-dark-lg keeps Proceed primary, Mahjong demoted, and rail surfaces opaque', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareDeterministicBoard(page);
    await setTheme(page, 'dark');

    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await assertCharlestonCtaHierarchy(page);
    await assertDarkRailSurfaces(page);

    await expect(page.getByTestId('game-board')).toHaveScreenshot('charleston-dark-lg.png');
  });

  test('charleston-dark-midwidth preserves CTA hierarchy and readable secondary instruction text', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1180, height: 800 });
    await prepareDeterministicBoard(page);
    await setTheme(page, 'dark');

    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await assertCharlestonCtaHierarchy(page);
    await expect(page.getByTestId('action-instruction')).toHaveClass(/dark:text-slate-200\/90/);

    await expect(page.getByTestId('game-board')).toHaveScreenshot('charleston-dark-midwidth.png');
  });

  test('charleston-light-lg keeps light-mode rail surfaces coherent', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareDeterministicBoard(page);
    await setTheme(page, 'light');

    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await assertCharlestonCtaHierarchy(page);
    await expect(page.getByTestId('right-rail')).toBeVisible();
    await expect(page.getByTestId('right-rail-top')).toHaveCount(0);

    await expect(page.getByTestId('game-board')).toHaveScreenshot('charleston-light-lg.png');
  });
});
