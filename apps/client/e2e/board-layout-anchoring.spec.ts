import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function assertBoardLocalLayout(page: Page): Promise<void> {
  const squareBoard = page.getByTestId('square-board-container');
  const playerZone = page.getByTestId('player-zone');
  const stagingStrip = page.getByTestId('staging-strip');
  const boardLayoutShell = page.getByTestId('board-layout-shell');
  const rightRail = page.getByTestId('right-rail');

  await expect(squareBoard).toBeVisible();
  await expect(playerZone).toBeVisible();
  await expect(stagingStrip).toBeVisible();

  const boardRect = await getRect(squareBoard);
  const playerZoneRect = await getRect(playerZone);
  const stagingStripRect = await getRect(stagingStrip);
  const boardLayoutShellRect = await getRect(boardLayoutShell);
  const rightRailRect = await getRect(rightRail);
  const viewportWidth = page.viewportSize()?.width ?? 0;

  expectContainedWithin(playerZoneRect, boardRect, 'player zone');
  expectContainedWithin(stagingStripRect, boardRect, 'staging strip');
  expect(
    boardLayoutShellRect.width - boardRect.width,
    'right rail reservation width'
  ).toBeGreaterThanOrEqual(200);
  expect(
    Math.abs(rightRailRect.x + rightRailRect.width - viewportWidth),
    'right rail edge gap'
  ).toBeLessThanOrEqual(1);
  expect(rightRailRect.x, 'right rail starts at or after board edge').toBeGreaterThanOrEqual(
    boardRect.x + boardRect.width - 1
  );

  for (const seat of ['east', 'south', 'west', 'north'] as const) {
    const rack = page.getByTestId(`opponent-rack-${seat}`);
    if (!(await rack.isVisible().catch(() => false))) {
      continue;
    }

    expectContainedWithin(await getRect(rack), boardRect, `opponent rack ${seat}`);
  }
}

test.describe('Board Layout Anchoring', () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`keeps Charleston gameplay layers board-local at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/?fixture=charlestonFirstRight');
      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
      await assertBoardLocalLayout(page);
    });

    test(`keeps Playing gameplay layers board-local at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/?fixture=playingDiscarding');
      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
      await assertBoardLocalLayout(page);
    });
  }
});

// AC-7 (US-050): staging strip must occupy the same board position in both phases.
test.describe('Staging Strip Geometry — AC-7 (US-050)', () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
    test(`staging strip width, left, and top match within ±2px between Charleston and gameplay at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      await page.goto('/?fixture=charlestonFirstRight');
      await expect(page.getByTestId('staging-strip')).toBeVisible({ timeout: 30_000 });
      const charlestonRect = await getRect(page.getByTestId('staging-strip'));

      await page.goto('/?fixture=playingDiscarding');
      await expect(page.getByTestId('staging-strip')).toBeVisible({ timeout: 30_000 });
      const playingRect = await getRect(page.getByTestId('staging-strip'));

      expect(Math.abs(playingRect.width - charlestonRect.width), 'width delta').toBeLessThanOrEqual(
        2
      );
      expect(Math.abs(playingRect.x - charlestonRect.x), 'left position delta').toBeLessThanOrEqual(
        2
      );
      expect(Math.abs(playingRect.y - charlestonRect.y), 'top position delta').toBeLessThanOrEqual(
        2
      );
    });
  }
});
