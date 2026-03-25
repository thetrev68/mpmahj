import { expect, test, type Locator, type Page } from '@playwright/test';

type Rect = { x: number; y: number; width: number; height: number };

async function getRect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('Expected visible element to have a bounding box');
  }
  return box;
}

async function getDocumentMetrics(page: Page): Promise<{
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
}> {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
}

async function assertDesktopBoardRecovery(page: Page): Promise<void> {
  const squareBoard = page.getByTestId('square-board-container');
  const playerRack = page.getByTestId('player-rack');
  const boardLayoutShell = page.getByTestId('board-layout-shell');
  const boardControls = page.getByTestId('board-controls-strip');
  const rightRail = page.getByTestId('right-rail');

  await expect(squareBoard).toBeVisible();
  await expect(playerRack).toBeVisible();
  await expect(boardControls).toBeVisible();
  await expect(rightRail).toBeVisible();

  const boardRect = await getRect(squareBoard);
  const playerRackRect = await getRect(playerRack);
  const boardLayoutShellRect = await getRect(boardLayoutShell);
  const boardControlsRect = await getRect(boardControls);
  const rightRailRect = await getRect(rightRail);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const metrics = await getDocumentMetrics(page);

  expect(
    boardLayoutShellRect.width - boardRect.width,
    'desktop board should reserve at least the minimum right rail width'
  ).toBeGreaterThanOrEqual(384);
  expect(
    Math.abs(viewportWidth - (rightRailRect.x + rightRailRect.width) - 16),
    'right rail should preserve the intended lg viewport padding'
  ).toBeLessThanOrEqual(1);
  expect(
    boardControlsRect.x + boardControlsRect.width,
    'board controls should anchor within the board footprint, not the rail'
  ).toBeLessThanOrEqual(boardRect.x + boardRect.width + 1);
  expect(playerRackRect.x, 'player rack left edge').toBeGreaterThanOrEqual(boardRect.x - 1);
  expect(playerRackRect.x + playerRackRect.width, 'player rack right edge').toBeLessThanOrEqual(
    boardRect.x + boardRect.width + 1
  );
  expect(metrics.scrollWidth, 'page should not horizontally overflow').toBeLessThanOrEqual(
    metrics.clientWidth + 1
  );
}

test.describe('US-085 Board Width and Positioning Recovery', () => {
  test('charleston-dark-lg keeps the controls and rack inside the board while preserving rail padding', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await assertDesktopBoardRecovery(page);
  });

  test('playing-dark-lg keeps the controls and rack inside the board while preserving rail padding', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?fixture=playingDiscarding');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await assertDesktopBoardRecovery(page);
  });

  test('charleston-dark-midwidth avoids horizontal overflow from the player rack', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1180, height: 800 });
    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    const squareBoard = page.getByTestId('square-board-container');
    const playerRack = page.getByTestId('player-rack');
    await expect(squareBoard).toBeVisible();
    await expect(playerRack).toBeVisible();

    const boardRect = await getRect(squareBoard);
    const playerRackRect = await getRect(playerRack);
    const metrics = await getDocumentMetrics(page);

    expect(playerRackRect.x, 'player rack left edge').toBeGreaterThanOrEqual(boardRect.x - 1);
    expect(playerRackRect.x + playerRackRect.width, 'player rack right edge').toBeLessThanOrEqual(
      boardRect.x + boardRect.width + 1
    );
    expect(
      metrics.scrollWidth,
      'mid-width desktop should not horizontally overflow'
    ).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test('desktop layouts with the rail hidden do not keep dead right-rail spacing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto('/?fixture=charlestonFirstRight');
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    const squareBoard = page.getByTestId('square-board-container');
    await expect(squareBoard).toBeVisible();
    await expect(page.getByTestId('right-rail')).toBeHidden();

    const boardRect = await getRect(squareBoard);
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(boardRect.x, 'board left gutter').toBeGreaterThanOrEqual(15);
    expect(
      viewportWidth - (boardRect.x + boardRect.width),
      'board should reclaim the rail space when the rail is hidden'
    ).toBeLessThanOrEqual(17);
  });
});
