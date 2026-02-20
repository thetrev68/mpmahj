import { expect, test, type Page } from '@playwright/test';
import { createRoom, gotoLobby } from './support/fixtures';
import { expectNoLoadingDeadlock } from './support/assertions';

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

async function selectTilesForPass(page: Page, targetSelection = 3): Promise<void> {
  const tiles = page.locator(
    '[data-testid="concealed-hand"] [data-testid^="tile-"][aria-disabled="false"]'
  );
  const count = await tiles.count();
  for (let i = 0; i < count; i += 1) {
    const passButton = page.getByTestId('pass-tiles-button');
    if (await passButton.isEnabled().catch(() => false)) {
      return;
    }
    await tiles
      .nth(i)
      .click({ timeout: 2_000 })
      .catch(() => {});
    const counter = page.getByTestId('selection-counter');
    const text = (await counter.textContent()) ?? '';
    if (text.includes(`${targetSelection}/${targetSelection}`)) {
      return;
    }
  }
}

async function driveBrowserToDiscardStage(page: Page): Promise<void> {
  for (let step = 0; step < 500; step += 1) {
    const discardButton = page.getByTestId('discard-button');
    if (await discardButton.isVisible().catch(() => false)) {
      if (await discardButton.isEnabled().catch(() => false)) return;
    }

    const rollButton = page.getByTestId('roll-dice-button');
    if (
      (await rollButton.isVisible().catch(() => false)) &&
      (await rollButton.isEnabled().catch(() => false))
    ) {
      await rollButton.click();
    }

    const passButton = page.getByTestId('pass-tiles-button');
    if (await passButton.isVisible().catch(() => false)) {
      await selectTilesForPass(page, 3);
      if (await passButton.isEnabled().catch(() => false)) {
        await passButton.click();
      }
    }

    const voteContinueButton = page.getByTestId('vote-continue-button');
    if (
      (await voteContinueButton.isVisible().catch(() => false)) &&
      (await voteContinueButton.isEnabled().catch(() => false))
    ) {
      await voteContinueButton.click();
    }

    // Courtesy pass negotiation: skip by proposing 0 tiles
    const courtesySkipButton = page.getByTestId('courtesy-count-0');
    if (
      (await courtesySkipButton.isVisible().catch(() => false)) &&
      (await courtesySkipButton.isEnabled().catch(() => false))
    ) {
      await courtesySkipButton.click();
    }

    // Courtesy pass tile selection (if negotiation agreed on > 0 tiles)
    const courtesyPassButton = page.getByTestId('courtesy-pass-tiles-button');
    if (await courtesyPassButton.isVisible().catch(() => false)) {
      await selectTilesForPass(page, 1);
      if (await courtesyPassButton.isEnabled().catch(() => false)) {
        await courtesyPassButton.click();
      }
    }

    await page.waitForTimeout(250);
  }
}

test.describe('Frontend-Backend Command Roundtrip', () => {
  test('browser issues RollDice, PassTiles, and DiscardTile with backend-driven state progression', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.context().clearCookies();

    await installCommandCapture(page);

    await gotoLobby(page);
    await createRoom(page, {
      roomName: 'E2E Command Roundtrip',
      fillWithBots: true,
    });

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });
    const seat = await page.evaluate(() => window.localStorage.getItem('session_seat'));
    expect(seat).toBe('East');

    await driveBrowserToDiscardStage(page);

    await expect(page.getByTestId('discard-button')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('discard-button')).toBeEnabled({ timeout: 30_000 });

    const commandTypesBeforeDiscard = await getCommandTypes(page);
    expect(commandTypesBeforeDiscard).toContain('RollDice');
    expect(commandTypesBeforeDiscard).toContain('PassTiles');

    const discardTiles = page.locator('[data-testid^="discard-pool-tile-"]');
    const beforeCount = await discardTiles.count();

    const firstHandTile = page
      .locator('[data-testid="concealed-hand"] [data-testid^="tile-"]')
      .first();
    await firstHandTile.click();
    await page.getByTestId('discard-button').click();
    await expectCommandSent(page, 'DiscardTile');

    await expect
      .poll(async () => discardTiles.count(), { timeout: 30_000 })
      .toBeGreaterThan(beforeCount);
    await expectNoLoadingDeadlock(page);
  });
});
