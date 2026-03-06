/**
 * Game Play Helpers
 *
 * Automation helpers for driving a human player's seat through a complete
 * game against bots. Designed to be used with fill_with_bots=true so that
 * only the human (test) player seat needs explicit action.
 *
 * Strategy per phase:
 *   Setup:     Roll dice if we are East; otherwise wait for Charleston to start.
 *   Charleston: Select 3 tiles (Jokers safely ignored) and click Pass each round.
 *              Vote "Continue" at the optional vote step.
 *              Propose 0 (Skip) for courtesy pass to complete cleanly.
 *   Playing:   Draw is automatic. Each turn: click first tile, then Discard.
 *              Dismiss any call-window dialog immediately with Pass.
 *   Game over: Assert scoring-screen / draw-scoring-screen / winner-celebration.
 */

import { expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any game-over surface is currently visible.
 * Checks quickly (300 ms) to avoid slowing the main loop.
 */
async function isOnGameOverScreen(page: Page): Promise<boolean> {
  const check = (testid: string) =>
    page.getByTestId(testid).isVisible({ timeout: 300 }).catch(() => false);

  return (
    (await check('scoring-screen')) ||
    (await check('draw-scoring-screen')) ||
    (await check('winner-celebration'))
  );
}

/**
 * Click the first N tiles in the player rack.
 *
 * In Charleston mode, Joker tiles are clickable but their selection is blocked
 * by the hook — clicking them is a safe no-op. We intentionally click a few
 * extras so that at least `count` non-Joker tiles become selected even in the
 * unlikely case that the hand starts with Jokers.
 */
async function clickTilesInRack(page: Page, count: number): Promise<void> {
  const rack = page.getByTestId('player-rack');
  const tiles = rack.locator('[data-testid^="tile-"]');
  const total = await tiles.count();
  const toClick = Math.min(total, count + 3); // extra clicks absorb Joker no-ops
  for (let i = 0; i < toClick; i++) {
    await tiles.nth(i).click();
  }
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Dismiss the call-window dialog if it is currently open by clicking Pass.
 * Returns true if a call window was found and dismissed.
 */
export async function dismissCallWindowIfPresent(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog');
  if (!(await dialog.isVisible({ timeout: 300 }).catch(() => false))) return false;

  const passBtn = dialog.getByRole('button', { name: 'Pass' });
  if (await passBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await passBtn.click();
    return true;
  }
  return false;
}

/**
 * Handle the Setup phase (dice roll).
 *
 * If we are East (roll-dice-button is enabled), we click it.
 * Then we wait until the first Charleston surface is visible or
 * the game transitions directly to Playing (edge case: no Charleston).
 */
export async function handleSetupPhase(page: Page): Promise<void> {
  const rollBtn = page.getByTestId('roll-dice-button');

  // If roll button is visible and it's our job to roll, do so.
  if (await rollBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    if (await rollBtn.isEnabled()) {
      await rollBtn.click();
    }
  }

  // Wait for any Charleston surface or the Playing phase to begin.
  await expect(
    page
      .getByTestId('pass-tiles-button')
      .or(page.getByTestId('courtesy-pass-tiles-button'))
      .or(page.getByTestId('courtesy-pass-panel'))
      .or(page.getByTestId('playing-status'))
      .or(page.getByTestId('scoring-screen'))
      .or(page.getByTestId('draw-scoring-screen'))
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Drive the Charleston phase until the Playing phase begins.
 *
 * The Charleston has up to 7 passes (Right/Across/Left × 2 rounds) plus an
 * optional vote and a courtesy pass. This loop handles each state in priority
 * order on every iteration.
 */
export async function handleCharlestonPhase(page: Page): Promise<void> {
  const MAX_ITERATIONS = 40; // well above any realistic Charleston length

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (await isOnGameOverScreen(page)) return;

    // Transitioned to Playing
    if (await page.getByTestId('playing-status').isVisible({ timeout: 300 }).catch(() => false)) {
      return;
    }

    // ── Vote panel ────────────────────────────────────────────────────────
    const voteContinueBtn = page.getByTestId('vote-continue-button');
    if (await voteContinueBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      if (await voteContinueBtn.isEnabled().catch(() => false)) {
        await voteContinueBtn.click();
        await page.waitForTimeout(800);
        continue;
      }
      // Disabled = already voted or waiting; fall through to wait.
    }

    // ── Courtesy pass proposal ─────────────────────────────────────────
    const courtesyPanel = page.getByTestId('courtesy-pass-panel');
    if (await courtesyPanel.isVisible({ timeout: 300 }).catch(() => false)) {
      const skipBtn = page.getByTestId('courtesy-count-0');
      if (await skipBtn.isEnabled().catch(() => false)) {
        await skipBtn.click(); // Propose 0 tiles → minimum will be 0 → no exchange
        await page.waitForTimeout(1000);
        continue;
      }
      // isPending (proposed, waiting for partner) — just wait.
      await page.waitForTimeout(800);
      continue;
    }

    // ── Courtesy pass submit button ────────────────────────────────────
    // If agreement was somehow > 0, the submit button appears.
    const courtesyPassBtn = page.getByTestId('courtesy-pass-tiles-button');
    if (
      (await courtesyPassBtn.isVisible({ timeout: 300 }).catch(() => false)) &&
      (await courtesyPassBtn.isEnabled().catch(() => false))
    ) {
      // Select tiles only if needed (agreement count determines this).
      // With our 0-proposal strategy the rack should have 0 selected,
      // meaning no tiles need to move — just confirm.
      await courtesyPassBtn.click();
      await page.waitForTimeout(1000);
      continue;
    }

    // ── Regular Charleston pass ────────────────────────────────────────
    const passBtn = page.getByTestId('pass-tiles-button');
    if (await passBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      if (await passBtn.isEnabled().catch(() => false)) {
        await clickTilesInRack(page, 3);
        await passBtn.click();
        // Wait briefly for pass animation / server acknowledgement.
        await page.waitForTimeout(1500);
        continue;
      }
      // Visible but disabled: waiting for other players to submit.
      await page.waitForTimeout(800);
      continue;
    }

    // ── No recognised surface — wait and retry ─────────────────────────
    await page.waitForTimeout(800);
  }

  throw new Error(
    `handleCharlestonPhase: Charleston did not complete after ${MAX_ITERATIONS} iterations. ` +
      'Current page state: ' +
      (await page.locator('body').innerText()).slice(0, 400)
  );
}

/**
 * Drive the Playing phase until a game-over screen appears.
 *
 * On each iteration:
 *   1. Check for game-over → done.
 *   2. Dismiss call-window dialog if open (click Pass).
 *   3. If it's our turn to discard (discard-button visible + enabled),
 *      select the first tile in hand and click Discard.
 *   4. Otherwise wait 500 ms and retry.
 *
 * Draw tiles are sent automatically by the client, so no draw interaction
 * is required here.
 *
 * @param maxTurns  Safety ceiling. A game rarely exceeds 144 tiles drawn.
 *                  At ~1 s per turn cycle this gives ~2.5 min of wall time.
 */
export async function handlePlayingPhase(page: Page, maxTurns = 300): Promise<void> {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (await isOnGameOverScreen(page)) return;

    // Dismiss any open call-window first.
    if (await dismissCallWindowIfPresent(page)) {
      // After dismissing, the state will update; give it a moment.
      await page.waitForTimeout(300);
      continue;
    }

    // Attempt to discard if it's our turn.
    const discardBtn = page.getByTestId('discard-button');
    if (await discardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      const rack = page.getByTestId('player-rack');
      const firstTile = rack.locator('[data-testid^="tile-"]').first();
      if (await firstTile.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstTile.click();
        // Discard button may need to wait to become enabled after tile selection.
        await expect(discardBtn).toBeEnabled({ timeout: 5_000 });
        await discardBtn.click();
        // Wait for discard animation and server acknowledgement.
        await page.waitForTimeout(500);
        continue;
      }
    }

    // Not our turn or transitioning — wait briefly.
    await page.waitForTimeout(500);
  }

  throw new Error(
    `handlePlayingPhase: Game did not end after ${maxTurns} turn cycles. ` +
      'Current page state: ' +
      (await page.locator('body').innerText()).slice(0, 400)
  );
}

/**
 * Assert that one of the three game-over surfaces is now visible.
 * Allows generous time because bots may be mid-animation.
 */
export async function assertGameOver(page: Page): Promise<void> {
  await expect(
    page
      .getByTestId('scoring-screen')
      .or(page.getByTestId('draw-scoring-screen'))
      .or(page.getByTestId('winner-celebration'))
  ).toBeVisible({ timeout: 60_000 });
}
