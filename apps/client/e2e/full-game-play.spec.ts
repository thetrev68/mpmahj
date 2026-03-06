/**
 * Full Game Play Smoke Test
 *
 * Drives one human player seat through a complete game vs. bots — from
 * room creation all the way to a game-over screen. This is the automated
 * substitute for manual user testing.
 *
 * Run:
 *   npm run test:e2e:gameplay       (headless)
 *   npm run test:e2e:gameplay:headed (watch mode)
 *
 * Requires both the Rust server and Vite dev server to be running.
 * The Playwright config (`playwright.config.ts`) starts them automatically.
 *
 * Design:
 *   - fill_with_bots=true → bots occupy the other 3 seats; only the test
 *     player's turns need explicit interaction.
 *   - The spec fails as soon as any unexpected state is hit, capturing
 *     a trace + video for diagnosis (see playwright.config.ts `trace` setting).
 *
 * Each phase is extracted into a helper (see ./support/gamePlay.ts) so that
 * individual helpers can be reused or tested in isolation later.
 */

import { test, expect } from '@playwright/test';
import { gotoLobby, createRoom } from './support/fixtures';
import {
  handleSetupPhase,
  handleCharlestonPhase,
  handlePlayingPhase,
  assertGameOver,
} from './support/gamePlay';

test.describe('Full Game Play Smoke', () => {
  /**
   * AC: A human player can sit in a room with 3 bots and play from the
   * opening dice roll through Charleston tile passing and the draw/discard
   * playing loop until the game ends (win, draw, or wall exhaustion).
   *
   * This test is intentionally a coarse-grained smoke test. If it fails at
   * any phase, the trace/video retained by Playwright will show the exact
   * point of failure, making it a fast bug locator across all phases.
   */
  test('plays a complete bot game: setup → charleston → playing → game over', async ({ page }) => {
    // A full game can take several minutes with realistic bot speed.
    test.setTimeout(300_000);

    // ── Lobby ────────────────────────────────────────────────────────────
    await gotoLobby(page);

    // ── Room creation ────────────────────────────────────────────────────
    await createRoom(page, { fillWithBots: true });

    // Confirm we entered the game board (not stuck on lobby or room-waiting).
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    // ── Setup phase (dice roll) ──────────────────────────────────────────
    await handleSetupPhase(page);

    // ── Charleston phase ─────────────────────────────────────────────────
    await handleCharlestonPhase(page);

    // ── Playing phase ────────────────────────────────────────────────────
    await handlePlayingPhase(page);

    // ── Game over ────────────────────────────────────────────────────────
    await assertGameOver(page);
  });

  /**
   * Narrower: Just verify the game reaches the first Charleston pass
   * surface. Faster to run when iterating on Setup/Charleston bugs only.
   */
  test('reaches first Charleston pass after dice roll', async ({ page }) => {
    test.setTimeout(60_000);

    await gotoLobby(page);
    await createRoom(page, { fillWithBots: true });
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await handleSetupPhase(page);

    // At this point we expect either the pass button or the playing-status
    // (if Charleston is skipped, which shouldn't happen for a standard game).
    await expect(
      page
        .getByTestId('pass-tiles-button')
        .or(page.getByTestId('playing-status'))
        .or(page.getByTestId('courtesy-pass-panel'))
    ).toBeVisible({ timeout: 30_000 });
  });

  /**
   * Narrower: Verify Charleston fully completes and the Playing phase begins.
   * Useful when the full game test is too slow to iterate on Charleston bugs.
   */
  test('completes Charleston and enters playing phase', async ({ page }) => {
    test.setTimeout(120_000);

    await gotoLobby(page);
    await createRoom(page, { fillWithBots: true });
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await handleSetupPhase(page);
    await handleCharlestonPhase(page);

    // Playing phase is signaled by playing-status being visible.
    await expect(page.getByTestId('playing-status')).toBeVisible({ timeout: 30_000 });
  });
});
