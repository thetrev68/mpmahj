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

import { expect, type Locator, type Page } from '@playwright/test';

const CHARLESTON_PASS_COUNT = 3;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if any game-over surface is currently visible.
 * Checks quickly (300 ms) to avoid slowing the main loop.
 */
async function isOnGameOverScreen(page: Page): Promise<boolean> {
  const check = (testid: string) =>
    page
      .getByTestId(testid)
      .isVisible({ timeout: 300 })
      .catch(() => false);
  const wallGameDialog = page
    .getByRole('dialog')
    .filter({ hasText: /wall game|game ends in a draw|no winner/i })
    .isVisible({ timeout: 300 })
    .catch(() => false);

  return (
    (await check('scoring-screen')) ||
    (await check('draw-scoring-screen')) ||
    (await check('winner-celebration')) ||
    (await wallGameDialog)
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
  const selectionCounter = page.getByTestId('selection-counter');

  for (let i = 0; i < 10; i++) {
    const counterText = ((await selectionCounter.textContent().catch(() => '')) ?? '').trim();
    const selected = Number(counterText.match(/^(\d+)\//)?.[1] ?? '0');
    if (selected >= count) return;

    const clicked = await page.getByTestId('player-rack').evaluate((rack, selectionIndex) => {
      const candidates = Array.from(
        rack.querySelectorAll<HTMLElement>('[data-testid^="tile-"][role="button"]')
      ).filter((element) => !element.closest('[data-testid^="ghost-"]'));

      const target = candidates[selectionIndex as number];
      if (!target) {
        return false;
      }

      target.click();
      return true;
    }, selected);

    if (!clicked) {
      return;
    }

    await page.waitForTimeout(50);
  }
}

async function getStagedIncomingTileCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="staging-incoming-tile-"]').count();
}

async function clickProceedButton(page: Page): Promise<void> {
  const proceedButton = page.getByTestId('proceed-button');
  try {
    await proceedButton.click({ timeout: 2_000 });
  } catch {
    await proceedButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
  }
}

async function clearStagedOutgoingTiles(page: Page): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    const selectionText = (
      (await page
        .getByTestId('selection-counter')
        .textContent()
        .catch(() => '')) ?? ''
    ).trim();
    const selected = Number(selectionText.match(/^(\d+)\//)?.[1] ?? '0');
    if (selected === 0) {
      return;
    }

    const outgoingTiles = page.locator('[data-testid^="staging-outgoing-tile-"]');
    if ((await outgoingTiles.count()) > 0) {
      await outgoingTiles
        .first()
        .click()
        .catch(() => {});
      await page.waitForTimeout(50);
      continue;
    }

    const pressedRackTile = page
      .locator('[data-testid="player-rack"] button[aria-pressed="true"]')
      .first();
    if (await pressedRackTile.isVisible().catch(() => false)) {
      await pressedRackTile.click().catch(() => {});
    }
    await page.waitForTimeout(50);
  }
}

async function resolveCallWindowWithProceed(page: Page): Promise<boolean> {
  const proceedBtn = page.getByTestId('proceed-button');
  const instruction = page.getByTestId('action-instruction');
  const previousInstruction = ((await instruction.textContent().catch(() => '')) ?? '').trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await proceedBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      return true;
    }
    if (!(await proceedBtn.isEnabled().catch(() => false))) {
      return false;
    }

    await clearStagedOutgoingTiles(page);
    await clickProceedButton(page);

    const stateChanged = await expect
      .poll(
        async () => {
          const currentInstruction = (
            (await instruction.textContent().catch(() => '')) ?? ''
          ).trim();
          const currentIncomingClaimTiles = await page
            .locator('[data-testid^="staging-incoming-tile-call-window-"]')
            .count();
          const currentBody = (
            (await page
              .locator('body')
              .innerText()
              .catch(() => '')) ?? ''
          ).toLowerCase();

          return (
            currentInstruction !== previousInstruction ||
            currentIncomingClaimTiles === 0 ||
            currentBody.includes('waiting for ') ||
            currentBody.includes('your turn')
          );
        },
        { timeout: 2_000 }
      )
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (stateChanged) {
      return true;
    }
  }

  return false;
}

async function isVisible(page: Page, testId: string, timeout = 300): Promise<boolean> {
  return page
    .getByTestId(testId)
    .isVisible({ timeout })
    .catch(() => false);
}

async function selectedTileCount(page: Page): Promise<number> {
  const text = (
    (await page
      .getByTestId('selection-counter')
      .textContent()
      .catch(() => '')) ?? ''
  ).trim();
  return Number(text.match(/^(\d+)\//)?.[1] ?? '0');
}

function parseRackCount(label: string | null): number {
  const match = label?.match(/Your rack: (\d+) tiles/i);
  if (!match) {
    throw new Error(`Unable to parse rack tile count from label: ${label ?? 'null'}`);
  }

  return Number(match[1]);
}

export async function prepareDeterministicBoard(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const styleId = 'pw-recovery-stabilizer';
    const styleText = `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `;

    const apply = () => {
      if (document.getElementById(styleId)) {
        return;
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = styleText;
      document.head.appendChild(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
      return;
    }

    apply();
  });
}

export async function getRackTileCount(page: Page): Promise<number> {
  const rack = page.getByTestId('player-rack');
  await expect(rack).toBeVisible();
  return parseRackCount(await rack.getAttribute('aria-label'));
}

export async function assertRackTileCount(page: Page, expectedCount: number): Promise<void> {
  await expect
    .poll(() => getRackTileCount(page), {
      message: `expected player rack to remain at ${expectedCount} tiles`,
      timeout: 15_000,
    })
    .toBe(expectedCount);
}

export async function selectTilesInRack(page: Page, count: number): Promise<boolean> {
  const selectionCounter = page.getByTestId('selection-counter');

  for (let index = 0; index < count; index += 1) {
    const clicked = await page.getByTestId('player-rack').evaluate((rack, selectionIndex) => {
      const candidates = Array.from(
        rack.querySelectorAll<HTMLElement>('[data-testid^="tile-"][role="button"]')
      ).filter((element) => !element.closest('[data-testid^="ghost-"]'));

      const target = candidates[selectionIndex as number];
      if (!target) {
        return false;
      }

      target.click();
      return true;
    }, index);
    if (!clicked) {
      return false;
    }
    await page.waitForTimeout(50);

    await expect
      .poll(
        async () => {
          const text = ((await selectionCounter.textContent().catch(() => '')) ?? '').trim();
          return Number(text.match(/^(\d+)\//)?.[1] ?? '0');
        },
        { timeout: 2_000 }
      )
      .toBeGreaterThanOrEqual(index + 1);
  }

  return true;
}

export async function getCharlestonStateMarker(page: Page): Promise<string> {
  if (
    (await isVisible(page, 'staging-discard-button')) ||
    (await page
      .getByTestId('gameplay-status-bar')
      .getByText(/your turn|discard|draw|call/i)
      .isVisible({ timeout: 300 })
      .catch(() => false))
  ) {
    return 'playing';
  }

  if (
    await page
      .getByTestId('vote-continue-button')
      .isVisible({ timeout: 300 })
      .catch(() => false)
  ) {
    return 'vote';
  }

  const progress = await page
    .getByTestId('charleston-progress')
    .textContent({ timeout: 300 })
    .catch(() => null);

  if (progress) {
    return progress.trim();
  }

  return 'unknown';
}

export async function waitForCharlestonStateChange(
  page: Page,
  previousMarker: string
): Promise<string> {
  await expect
    .poll(() => getCharlestonStateMarker(page), {
      message: `expected Charleston state to advance beyond ${previousMarker}`,
      timeout: 30_000,
    })
    .not.toBe(previousMarker);

  return getCharlestonStateMarker(page);
}

export async function getOutgoingSlotTileCount(slot: Locator): Promise<number> {
  return slot.locator('[data-testid^="staging-outgoing-tile-"]').count();
}

export async function assertContiguousOutgoingFill(
  page: Page,
  outgoingSlotCount: number,
  expectedFilledSlots: number
): Promise<void> {
  await expect
    .poll(
      async () => {
        const occupancy: number[] = [];

        for (let index = 0; index < outgoingSlotCount; index += 1) {
          const slot = page.getByTestId(`staging-slot-${index}`);
          await expect(slot).toBeVisible();
          occupancy.push(await getOutgoingSlotTileCount(slot));
        }

        return occupancy.join(',');
      },
      {
        message: `expected ${expectedFilledSlots} outgoing staging slots to fill contiguously from slot 0`,
        timeout: 5_000,
      }
    )
    .toBe(
      Array.from({ length: outgoingSlotCount }, (_, index) =>
        index < expectedFilledSlots ? '1' : '0'
      ).join(',')
    );
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
  // staging-pass-button is the StagingStrip Pass button used during regular Charleston passes.
  // pass-tiles-button is the ActionBar button shown only during CourtesyAcross submit.
  await expect
    .poll(
      async () =>
        (await isVisible(page, 'staging-pass-button')) ||
        (await isVisible(page, 'proceed-button')) ||
        (await isVisible(page, 'vote-panel')) ||
        (await isVisible(page, 'pass-tiles-button')) ||
        (await isVisible(page, 'courtesy-pass-tiles-button')) ||
        (await isVisible(page, 'courtesy-pass-panel')) ||
        (await isVisible(page, 'staging-discard-button')) ||
        (await isVisible(page, 'gameplay-status-bar')) ||
        (await isVisible(page, 'scoring-screen')) ||
        (await isVisible(page, 'draw-scoring-screen')),
      { timeout: 30_000 }
    )
    .toBe(true);
}

/**
 * Drive the Charleston phase until the Playing phase begins.
 *
 * The Charleston has up to 7 passes (Right/Across/Left × 2 rounds) plus an
 * optional vote and a courtesy pass. This loop handles each state in priority
 * order on every iteration.
 */
export async function handleCharlestonPhase(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isOnGameOverScreen(page)) return;

    // Transitioned to Playing
    if (
      (await isVisible(page, 'staging-discard-button')) ||
      (await page
        .getByTestId('gameplay-status-bar')
        .getByText(/your turn|discard|draw|call/i)
        .isVisible({ timeout: 300 })
        .catch(() => false))
    ) {
      return;
    }

    // ── Vote panel ────────────────────────────────────────────────────────
    const voteContinueBtn = page.getByTestId('vote-continue-button');
    if (await voteContinueBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      if (await voteContinueBtn.isEnabled().catch(() => false)) {
        await voteContinueBtn.click();
        await page.waitForTimeout(300);
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
        await page.waitForTimeout(400);
        continue;
      }
      // isPending (proposed, waiting for partner) — just wait.
      await page.waitForTimeout(250);
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
      await courtesyPassBtn.evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      await page.waitForTimeout(400);
      continue;
    }

    // ── Regular Charleston pass (StagingStrip) ────────────────────────
    // staging-pass-button is enabled only after 3 tiles are staged. Select tiles first,
    // then click. If still disabled, the server may have already received our pass.
    const stagingPassBtn = page.getByTestId('staging-pass-button');
    if (await stagingPassBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      const requiredHandTiles = Math.max(
        0,
        CHARLESTON_PASS_COUNT - (await getStagedIncomingTileCount(page))
      );
      await clickTilesInRack(page, requiredHandTiles);
      const hasFullSelection =
        (await selectedTileCount(page)) + (await getStagedIncomingTileCount(page)) ===
        CHARLESTON_PASS_COUNT;
      const isNowEnabled = hasFullSelection
        ? await expect
            .poll(async () => stagingPassBtn.isEnabled().catch(() => false), { timeout: 2_000 })
            .toBeTruthy()
            .then(() => true)
            .catch(() => false)
        : await stagingPassBtn.isEnabled({ timeout: 5_000 }).catch(() => false);
      if (isNowEnabled) {
        await stagingPassBtn.evaluate((element) => {
          (element as HTMLButtonElement).click();
        });
        await page.waitForTimeout(500);
        continue;
      }
      // Still disabled after tile selection: waiting for other players to submit.
      await page.waitForTimeout(250);
      continue;
    }

    const proceedBtn = page.getByTestId('proceed-button');
    if (await proceedBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      const currentMarker = await getCharlestonStateMarker(page);
      const isVoteStage = currentMarker === 'vote';
      const requiredHandTiles = isVoteStage
        ? CHARLESTON_PASS_COUNT
        : Math.max(0, CHARLESTON_PASS_COUNT - (await getStagedIncomingTileCount(page)));
      await clickTilesInRack(page, requiredHandTiles);
      const hasFullSelection = isVoteStage
        ? (await selectedTileCount(page)) === CHARLESTON_PASS_COUNT
        : (await selectedTileCount(page)) + (await getStagedIncomingTileCount(page)) ===
          CHARLESTON_PASS_COUNT;
      const canProceed = hasFullSelection
        ? await expect
            .poll(async () => proceedBtn.isEnabled().catch(() => false), { timeout: 2_000 })
            .toBeTruthy()
            .then(() => true)
            .catch(() => false)
        : await proceedBtn.isEnabled().catch(() => false);
      if (canProceed) {
        await clickProceedButton(page);
        await page.waitForTimeout(500);
        continue;
      }
      await page.waitForTimeout(250);
      continue;
    }

    // ── ActionBar pass-tiles-button (CourtesyAcross tile submit) ──────
    const passBtn = page.getByTestId('pass-tiles-button');
    if (await passBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      if (await passBtn.isEnabled().catch(() => false)) {
        await passBtn.evaluate((element) => {
          (element as HTMLButtonElement).click();
        });
        await page.waitForTimeout(400);
        continue;
      }
      await page.waitForTimeout(250);
      continue;
    }

    // ── No recognised surface — wait and retry ─────────────────────────
    await page.waitForTimeout(250);
  }

  throw new Error(
    `handleCharlestonPhase: Charleston did not complete within ${Math.round(timeoutMs / 1000)}s. ` +
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
 * @param maxDurationMs  Safety ceiling in wall-clock time for the playing loop.
 */
export async function handlePlayingPhase(page: Page, maxDurationMs = 360_000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < maxDurationMs) {
    if (await isOnGameOverScreen(page)) return;

    // Dismiss any open call-window first.
    if (await dismissCallWindowIfPresent(page)) {
      // After dismissing, the state will update; give it a moment.
      await page.waitForTimeout(300);
      continue;
    }

    const playingStatus = page.getByTestId('gameplay-status-bar');
    const statusText = ((await playingStatus.textContent().catch(() => '')) ?? '').toLowerCase();
    const actionInstruction = (
      (await page
        .getByTestId('action-instruction')
        .textContent()
        .catch(() => '')) ?? ''
    ).toLowerCase();

    const proceedBtn = page.getByTestId('proceed-button');
    const isCallWindowAction =
      actionInstruction.includes('press proceed to skip') ||
      actionInstruction.includes('press proceed to call') ||
      actionInstruction.includes('press proceed to pass') ||
      actionInstruction.includes('claims require') ||
      statusText.includes('call window');
    if (
      isCallWindowAction &&
      (await proceedBtn.isVisible({ timeout: 500 }).catch(() => false)) &&
      (await proceedBtn.isEnabled().catch(() => false))
    ) {
      await resolveCallWindowWithProceed(page);
      await page.waitForTimeout(400);
      continue;
    }

    const isYourTurnToDiscard = statusText.includes('your turn') && statusText.includes('discard');
    if (!isYourTurnToDiscard) {
      if (
        (await proceedBtn.isVisible({ timeout: 500 }).catch(() => false)) &&
        (await proceedBtn.isEnabled().catch(() => false))
      ) {
        await clearStagedOutgoingTiles(page);
        await clickProceedButton(page);
        await page.waitForTimeout(400);
        continue;
      }
      await page.waitForTimeout(250);
      continue;
    }

    // Attempt to discard if it's our turn.
    const discardBtn = page
      .getByTestId('staging-discard-button')
      .or(proceedBtn)
      .or(page.getByTestId('discard-button'));
    if (await discardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      const selected = await selectTilesInRack(page, 1);
      if (!selected) {
        await page.waitForTimeout(250);
        continue;
      }
      // If discard is still disabled, state is mid-transition; retry loop.
      const canDiscardNow = await discardBtn.isEnabled().catch(() => false);
      if (!canDiscardNow) {
        await page.waitForTimeout(250);
        continue;
      }
      await discardBtn.evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      // Wait for discard animation and server acknowledgement.
      await page.waitForTimeout(500);
      continue;
    }

    // Not our turn or transitioning — wait briefly.
    await page.waitForTimeout(500);
  }

  throw new Error(
    `handlePlayingPhase: Game did not end within ${Math.round(maxDurationMs / 1000)}s. ` +
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
      .or(page.getByRole('dialog').filter({ hasText: /wall game|game ends in a draw|no winner/i }))
  ).toBeVisible({ timeout: 60_000 });
}
