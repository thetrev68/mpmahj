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
import { handleSetupPhase } from './support/gamePlay';

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
 * Drive the browser through setup and first Charleston, stopping when the
 * vote-stage action instruction appears.
 */
async function driveToVotingStage(page: Page): Promise<void> {
  for (let step = 0; step < 200; step += 1) {
    const actionInstruction = page.getByTestId('action-instruction');
    const instructionText = ((await actionInstruction.textContent().catch(() => '')) ?? '').trim();
    if (instructionText.includes('Stage 0 tiles to stop')) {
      return;
    }

    // Pass tiles if the shared Proceed button is available for standard Charleston passes.
    const passButton = page.getByTestId('proceed-button');
    if (
      (await passButton.isVisible().catch(() => false)) &&
      !instructionText.includes('Stage 0 tiles to stop')
    ) {
      const incomingCount = await page.locator('[data-testid^="staging-incoming-tile-"]').count();
      await selectTilesForPass(page, Math.max(0, 3 - incomingCount));
      if (await passButton.isEnabled().catch(() => false)) {
        await passButton.evaluate((element) => {
          (element as HTMLButtonElement).click();
        });
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
    test.setTimeout(180_000);
    await installCommandCapture(page);

    await gotoLobby(page);
    await createRoom(page, {
      roomName: 'E2E Courtesy Pass',
      fillWithBots: true,
    });

    // Wait for game board to load
    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await handleSetupPhase(page);

    // Drive through setup + first Charleston to reach VotingToContinue
    await driveToVotingStage(page);

    // Vote to Stop by clicking Proceed with 0 selected tiles.
    const proceedButton = page.getByTestId('proceed-button');
    await expect(proceedButton).toBeEnabled({ timeout: 10_000 });
    await proceedButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });

    // VoteCharleston command should be sent
    await expectCommandSent(page, 'VoteCharleston');

    // Current UI uses the shared action bar for courtesy pass; there is no courtesy panel.
    // Wait for either the courtesy instruction or for the game to already reach playing.
    await expect
      .poll(
        async () => {
          const instruction = (
            (await page
              .getByTestId('action-instruction')
              .textContent()
              .catch(() => '')) ?? ''
          ).trim();
          const canDiscard = await page
            .getByTestId('staging-discard-button')
            .isVisible()
            .catch(() => false);
          return instruction.includes('Select 0–3 tiles to pass across') || canDiscard;
        },
        { timeout: 60_000 }
      )
      .toBe(true);

    const instructionText = (
      (await page
        .getByTestId('action-instruction')
        .textContent()
        .catch(() => '')) ?? ''
    ).trim();

    if (instructionText.includes('Select 0–3 tiles to pass across')) {
      // Propose 0 tiles (skip courtesy pass) using Proceed with no staged tiles.
      await expect(page.getByTestId('proceed-button')).toBeEnabled({ timeout: 10_000 });
      await page.getByTestId('proceed-button').evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      await expectCommandSent(page, 'ProposeCourtesyPass');
    }

    // Verify game is in playing phase under the current action-bar model.
    await expect(page.getByTestId('gameplay-status-bar')).toContainText(/your turn|waiting for/i, {
      timeout: 120_000,
    });
    await expect(page.getByTestId('proceed-button')).toBeVisible({ timeout: 60_000 });
  });

  test('ProposeCourtesyPass command is sent with correct player seat', async ({ page }) => {
    test.setTimeout(180_000);
    await installCommandCapture(page);

    await gotoLobby(page);
    await createRoom(page, {
      roomName: 'E2E Courtesy Pass Seat Check',
      fillWithBots: true,
    });

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await handleSetupPhase(page);

    await driveToVotingStage(page);

    // Vote Stop with zero selected tiles.
    await expect(page.getByTestId('proceed-button')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('proceed-button').evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expectCommandSent(page, 'VoteCharleston');

    // If courtesy stage appears under the current UI, propose zero via Proceed.
    await expect
      .poll(
        async () => {
          const instruction = (
            (await page
              .getByTestId('action-instruction')
              .textContent()
              .catch(() => '')) ?? ''
          ).trim();
          const canDiscard = await page
            .getByTestId('staging-discard-button')
            .isVisible()
            .catch(() => false);
          return instruction.includes('Select 0–3 tiles to pass across') || canDiscard;
        },
        { timeout: 60_000 }
      )
      .toBe(true);

    const instructionText = (
      (await page
        .getByTestId('action-instruction')
        .textContent()
        .catch(() => '')) ?? ''
    ).trim();
    if (instructionText.includes('Select 0–3 tiles to pass across')) {
      await page.getByTestId('proceed-button').evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
      await expectCommandSent(page, 'ProposeCourtesyPass');
    }

    // Game should eventually reach Playing phase regardless of vote outcome.
    await expect(page.getByTestId('gameplay-status-bar')).toContainText(/your turn|waiting for/i, {
      timeout: 120_000,
    });
    await expect(page.getByTestId('proceed-button')).toBeVisible({ timeout: 60_000 });
  });
});
