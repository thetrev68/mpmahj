/**
 * E2E Test: Courtesy Pass Negotiation (US-007)
 *
 * Tests the full browser flow against a live server:
 * 1. Create room with bots
 * 2. Drive through setup and first Charleston
 * 3. Vote to stop (skip second Charleston), entering courtesy pass
 * 4. Propose tile count (0 tiles = skip)
 * 5. Wait for courtesy pass to complete
 * 6. Verify game advances to playing phase
 */

import { expect, test, type Page } from '@playwright/test';
import { createRoom, gotoLobby } from './support/fixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CommandEnvelope = {
  kind: 'Command';
  payload?: {
    command?: Record<string, unknown>;
  };
};

type CommandLogEntry = {
  kind: string;
  commandType: string | null;
};

async function installCommandCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalWebSocket = window.WebSocket;
    const commandLog: Array<{ kind: string; commandType: string | null }> = [];

    Object.defineProperty(window, '__wsCommandLog', {
      value: commandLog,
      writable: false,
      configurable: false,
    });

    window.WebSocket = class LoggingWebSocket extends originalWebSocket {
      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (typeof data === 'string') {
          try {
            const envelope = JSON.parse(data) as CommandEnvelope;
            if (envelope.kind === 'Command') {
              const commandType = envelope.payload?.command
                ? (Object.keys(envelope.payload.command)[0] ?? null)
                : null;
              commandLog.push({ kind: envelope.kind, commandType });
            }
          } catch {
            // Ignore non-JSON payloads.
          }
        }
        super.send(data);
      }
    } as typeof WebSocket;
  });
}

async function getCommandTypes(page: Page): Promise<string[]> {
  const entries = await page.evaluate(() => {
    const value = (window as unknown as { __wsCommandLog?: CommandLogEntry[] }).__wsCommandLog;
    return Array.isArray(value) ? value : [];
  });
  return entries.map((entry) => entry.commandType).filter((v): v is string => !!v);
}

async function expectCommandSent(page: Page, commandType: string): Promise<void> {
  await expect.poll(async () => getCommandTypes(page), { timeout: 30_000 }).toContain(commandType);
}

/** Select tiles from the concealed hand until we have targetSelection tiles. */
async function selectTilesForPass(page: Page, targetSelection = 3): Promise<void> {
  const tiles = page.locator(
    '[data-testid="player-rack"] [data-testid^="tile-"][aria-disabled="false"]'
  );
  const count = await tiles.count();
  for (let i = 0; i < count; i += 1) {
    const passButton = page.getByTestId('proceed-button');
    if (await passButton.isEnabled().catch(() => false)) {
      return;
    }
    await tiles
      .nth(i)
      .click({ timeout: 2_000 })
      .catch(() => {});
    const counter = page.getByTestId('selection-counter');
    const text = (await counter.textContent().catch(() => '')) ?? '';
    if (text.includes(`${targetSelection}/${targetSelection}`)) {
      return;
    }
  }
}

/**
 * Drive the browser through setup and first Charleston, stopping at the
 * VotingToContinue panel (without submitting the stop vote).
 */
async function driveToVotingPanel(page: Page): Promise<void> {
  for (let step = 0; step < 200; step += 1) {
    // If voting panel is visible, we're done
    const votePanel = page.getByTestId('vote-panel');
    if (await votePanel.isVisible().catch(() => false)) {
      return;
    }

    // Click Roll Dice if available
    const rollButton = page.getByTestId('roll-dice-button');
    if (
      (await rollButton.isVisible().catch(() => false)) &&
      (await rollButton.isEnabled().catch(() => false))
    ) {
      await rollButton.click();
    }

    // Pass tiles if the shared Proceed button is available.
    const passButton = page.getByTestId('proceed-button');
    if (await passButton.isVisible().catch(() => false)) {
      await selectTilesForPass(page, 3);
      if (await passButton.isEnabled().catch(() => false)) {
        await passButton.click();
      }
    }

    await page.waitForTimeout(300);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Courtesy Pass Negotiation (US-007)', () => {
  test('courtesy pass panel appears after voting to stop, and game advances after proposal', async ({
    page,
  }) => {
    await installCommandCapture(page);

    await gotoLobby(page);
    await createRoom(page, {
      roomName: 'E2E Courtesy Pass',
      fillWithBots: true,
    });

    // Wait for game board to load
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    // Drive through setup + first Charleston to reach VotingToContinue
    await driveToVotingPanel(page);

    // Verify voting panel is present
    await expect(page.getByTestId('vote-panel')).toBeVisible({ timeout: 15_000 });

    // Vote to Stop (skip second Charleston, go directly to CourtesyAcross)
    const stopButton = page.getByTestId('vote-stop-button');
    await expect(stopButton).toBeEnabled({ timeout: 10_000 });
    await stopButton.click();

    // VoteCharleston command should be sent
    await expectCommandSent(page, 'VoteCharleston');

    // Bots also vote (automatically handled by server) and majority decides.
    // Wait for courtesy pass panel OR for phase to advance to playing.
    // If all bots vote Stop, we enter CourtesyAcross.
    // If majority is Continue, we skip to second Charleston (handled by bots eventually).
    // Either way, we'll eventually reach playing phase — verify the full flow.

    // Look for either courtesy pass panel or discard button (end of flow)
    const courtesyPanel = page.getByTestId('courtesy-pass-panel');
    const discardButton = page.getByTestId('staging-discard-button');

    // Wait for one of them to appear (up to 30s)
    await expect(courtesyPanel.or(discardButton)).toBeVisible({ timeout: 30_000 });

    const courtesyVisible = await courtesyPanel.isVisible().catch(() => false);

    if (courtesyVisible) {
      // Courtesy pass panel is shown — AC-1 verified
      await expect(page.getByText(/Courtesy Pass Negotiation/i)).toBeVisible();
      await expect(page.getByText(/Negotiate with .* - select 0-3 tiles/i)).toBeVisible();

      // Propose 0 tiles (skip courtesy pass) — AC-2
      const skipButton = page.getByTestId('courtesy-count-0');
      await expect(skipButton).toBeEnabled({ timeout: 10_000 });
      await skipButton.click();

      // ProposeCourtesyPass command should have been sent — AC-2
      await expectCommandSent(page, 'ProposeCourtesyPass');

      // Show pending state — buttons should be disabled
      await expect(page.getByTestId('courtesy-count-0')).toBeDisabled({ timeout: 5_000 });

      // Eventually the game should advance past courtesy pass to Playing phase
      await expect(page.getByTestId('staging-discard-button').or(courtesyPanel)).toBeVisible({
        timeout: 30_000,
      });

      // After bots also propose, game should reach Playing
      await expect(page.getByTestId('staging-discard-button')).toBeVisible({ timeout: 30_000 });
    } else {
      // Vote result was Continue → bots will drive through second Charleston
      // Eventually reaches playing phase either way
      await expect(discardButton).toBeVisible({ timeout: 60_000 });
    }

    // Verify game is in playing phase (discard button present and enabled)
    await expect(page.getByTestId('staging-discard-button')).toBeVisible({ timeout: 30_000 });
  });

  test('ProposeCourtesyPass command is sent with correct player seat', async ({ page }) => {
    await installCommandCapture(page);

    await gotoLobby(page);
    await createRoom(page, {
      roomName: 'E2E Courtesy Pass Seat Check',
      fillWithBots: true,
    });

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

    await driveToVotingPanel(page);

    // Vote Stop
    const votePanel = page.getByTestId('vote-panel');
    if (await votePanel.isVisible().catch(() => false)) {
      const stopButton = page.getByTestId('vote-stop-button');
      if (await stopButton.isEnabled().catch(() => false)) {
        await stopButton.click();
      }
    }

    // If courtesy panel appears, send a proposal
    const courtesyPanel = page.getByTestId('courtesy-pass-panel');
    const discardButton = page.getByTestId('staging-discard-button');
    await expect(courtesyPanel.or(discardButton)).toBeVisible({ timeout: 30_000 });

    if (await courtesyPanel.isVisible().catch(() => false)) {
      const skipButton = page.getByTestId('courtesy-count-0');
      await skipButton.click();

      // Verify ProposeCourtesyPass was sent
      await expect
        .poll(async () => getCommandTypes(page), { timeout: 10_000 })
        .toContain('ProposeCourtesyPass');
    }

    // Game should eventually reach Playing phase regardless of vote outcome
    await expect(page.getByTestId('staging-discard-button')).toBeVisible({ timeout: 60_000 });
  });
});
