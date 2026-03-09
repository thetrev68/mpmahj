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
  const boardLayout = page.getByTestId('game-board-layout');

  await expect(squareBoard).toBeVisible();
  await expect(playerZone).toBeVisible();
  await expect(stagingStrip).toBeVisible();

  const boardRect = await getRect(squareBoard);
  const playerZoneRect = await getRect(playerZone);
  const stagingStripRect = await getRect(stagingStrip);
  const boardLayoutRect = await getRect(boardLayout);

  expectContainedWithin(playerZoneRect, boardRect, 'player zone');
  expectContainedWithin(stagingStripRect, boardRect, 'staging strip');
  expect(
    boardLayoutRect.width - boardRect.width,
    'right rail reservation width'
  ).toBeGreaterThanOrEqual(200);

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
