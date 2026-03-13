import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  assertContiguousOutgoingFill,
  assertRackTileCount,
  prepareDeterministicBoard,
} from './support/gamePlay';

type Rect = { x: number; y: number; width: number; height: number };

const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
] as const;

async function getRect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('Expected visible element to have a bounding box');
  }

  return box;
}

function expectContainedWithin(inner: Rect, outer: Rect, label: string): void {
  expect(inner.x, `${label} left edge`).toBeGreaterThanOrEqual(outer.x);
  expect(inner.x + inner.width, `${label} right edge`).toBeLessThanOrEqual(outer.x + outer.width);
}

function expectWithinTolerance(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(tolerance);
}

async function assertBoardLocalLayout(page: Page): Promise<void> {
  const squareBoard = page.getByTestId('square-board-container');
  const playerZone = page.getByTestId('player-zone');
  const stagingStrip = page.getByTestId('staging-strip');

  await expect(squareBoard).toBeVisible();
  await expect(playerZone).toBeVisible();
  await expect(stagingStrip).toBeVisible();

  const boardRect = await getRect(squareBoard);
  expectContainedWithin(await getRect(playerZone), boardRect, 'player zone');
  expectContainedWithin(await getRect(stagingStrip), boardRect, 'staging strip');
}

test.describe('Frontend Recovery Guardrails', () => {
  test('keeps the staging strip bounding box aligned between Charleston and gameplay', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await prepareDeterministicBoard(page);

    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    const charlestonStrip = await getRect(page.getByTestId('staging-strip'));

    await page.goto('/?fixture=playingDiscarding');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    const playingStrip = await getRect(page.getByTestId('staging-strip'));

    expectWithinTolerance(playingStrip.width, charlestonStrip.width, 2, 'staging strip width');
    expectWithinTolerance(playingStrip.x, charlestonStrip.x, 2, 'staging strip left alignment');
    expectWithinTolerance(playingStrip.y, charlestonStrip.y, 2, 'staging strip top alignment');
  });

  test('shrinks the 6-slot strip proportionally on narrow viewports without horizontal scrolling', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareDeterministicBoard(page);

    await page.goto('/?fixture=playingDiscarding');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    const strip = page.getByTestId('staging-strip');
    const viewport = page.getByTestId('staging-slot-viewport');
    const row = page.getByTestId('staging-slot-row');
    const stripRect = await getRect(strip);
    const viewportRect = await getRect(viewport);
    const rowRect = await getRect(row);

    expect(rowRect.width, 'scaled slot row width should shrink on narrow viewports').toBeLessThan(
      418
    );
    expect(rowRect.width, 'scaled row should fit within the viewport').toBeLessThanOrEqual(
      viewportRect.width + 1
    );
    expect(stripRect.width, 'strip should stay inside the viewport').toBeLessThanOrEqual(390);

    const horizontalScrollPosition = await viewport.evaluate((element) => {
      const viewportElement = element as HTMLElement;
      viewportElement.scrollLeft = 100;
      return viewportElement.scrollLeft;
    });

    expect(horizontalScrollPosition).toBe(0);
  });

  test('keeps Charleston rack count legal across ordered pass-stage fixtures', async ({ page }) => {
    await prepareDeterministicBoard(page);
    const orderedStageFixtures = [
      'charlestonFirstRight',
      'charlestonFirstAcross',
      'charlestonFirstLeft',
      'charlestonSecondLeft',
      'charlestonSecondAcross',
      'charlestonSecondRight',
    ] as const;

    let baselineRackCount: number | null = null;

    for (const fixture of orderedStageFixtures) {
      await page.goto(`/?fixture=${fixture}`);
      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

      const rackLabel = await page.getByTestId('player-rack').getAttribute('aria-label');
      const match = rackLabel?.match(/Your rack: (\d+) tiles/i);
      if (!match) {
        throw new Error(`Unable to parse rack count from ${rackLabel ?? 'null'} for ${fixture}`);
      }

      const rackCount = Number(match[1]);
      if (baselineRackCount === null) {
        baselineRackCount = rackCount;
      }

      await assertRackTileCount(page, baselineRackCount);
    }

    expect(baselineRackCount).not.toBeNull();
  });

  test('renders Charleston outgoing staging contiguously from slot 0 in the browser', async ({
    page,
  }) => {
    await prepareDeterministicBoard(page);
    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '1 Bam' }).evaluate((element) => {
      (element as HTMLElement).click();
    });
    await page.getByRole('button', { name: '2 Bam' }).evaluate((element) => {
      (element as HTMLElement).click();
    });
    await expect(page.getByTestId('selection-counter')).toContainText('2/3 selected');
    await assertContiguousOutgoingFill(page, 3, 2);

    await page
      .getByTestId('staging-slot-0')
      .locator('[data-testid^="staging-outgoing-tile-"]')
      .click();
    await assertContiguousOutgoingFill(page, 3, 1);
  });

  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`captures stable Charleston and Playing board baselines at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await prepareDeterministicBoard(page);

      await page.goto('/?fixture=charlestonFirstRight');
      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
      await assertBoardLocalLayout(page);
      await expect(page.getByTestId('game-board')).toHaveScreenshot(
        `charleston-board-${viewport.width}x${viewport.height}.png`
      );

      await page.goto('/?fixture=playingDiscarding');
      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
      await assertBoardLocalLayout(page);
      await expect(page.getByTestId('game-board')).toHaveScreenshot(
        `playing-board-${viewport.width}x${viewport.height}.png`
      );
    });
  }
});
