import { expect, test, type Page } from '@playwright/test';
import { createRoom, gotoLobby } from './support/fixtures';
import { expectNoLoadingDeadlock } from './support/assertions';
import { handleCharlestonPhase, handleSetupPhase } from './support/gamePlay';

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

function discardButtonLocator(page: Page) {
  return page
    .getByRole('button', { name: /^(Proceed with discard|Discard selected tile)$/ })
    .or(page.getByTestId('discard-button'));
}

async function selectTilesForPass(page: Page, targetSelection = 3): Promise<void> {
  const selectionCounter = page.getByTestId('selection-counter');

  for (let i = 0; i < 10; i += 1) {
    const text = ((await selectionCounter.textContent().catch(() => '')) ?? '').trim();
    const selected = Number(text.match(/^(\d+)\//)?.[1] ?? '0');
    if (selected >= targetSelection) {
      return;
    }

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

async function driveBrowserToDiscardStage(page: Page): Promise<void> {
  for (let step = 0; step < 500; step += 1) {
    const discardButton = discardButtonLocator(page);
    const statusText = (
      (await page
        .getByTestId('gameplay-status-bar')
        .textContent()
        .catch(() => '')) ?? ''
    ).toLowerCase();
    const instructionText = (
      (await page
        .getByTestId('action-instruction')
        .textContent()
        .catch(() => '')) ?? ''
    ).toLowerCase();
    const isDiscardTurn =
      statusText.includes('your turn') && instructionText.includes('select 1 tile to discard');
    if (isDiscardTurn && (await discardButton.isVisible().catch(() => false))) return;

    const proceedButton = page.getByTestId('proceed-button');
    if (await proceedButton.isVisible().catch(() => false)) {
      const isCallWindowAction =
        statusText.includes('call window') ||
        instructionText.includes('press proceed to pass') ||
        instructionText.includes('claims require');

      if (isCallWindowAction) {
        await clearStagedOutgoingTiles(page);
      }

      const selectionTarget =
        statusText.includes('vote') || instructionText.includes('stage up to 3 tiles to continue')
          ? 3
          : isCallWindowAction
            ? 0
            : Math.max(
                0,
                3 - (await page.locator('[data-testid^="staging-incoming-tile-"]').count())
              );

      await selectTilesForPass(page, selectionTarget);
      if (await proceedButton.isEnabled().catch(() => false)) {
        await proceedButton.evaluate((element) => {
          (element as HTMLButtonElement).click();
        });
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error('Did not reach discard stage within polling limit.');
}

test.describe('Frontend-Backend Command Roundtrip', () => {
  test('browser issues Charleston/turn commands and DiscardTile with backend-driven state progression', async ({
    page,
  }) => {
    test.setTimeout(240_000);

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

    await handleSetupPhase(page);
    await handleCharlestonPhase(page);
    await driveBrowserToDiscardStage(page);

    await expect(discardButtonLocator(page)).toBeVisible({ timeout: 30_000 });

    const commandTypesBeforeDiscard = await getCommandTypes(page);
    expect(
      commandTypesBeforeDiscard.some((commandType) =>
        ['CommitCharlestonPass', 'PassTiles', 'VoteCharleston'].includes(commandType)
      )
    ).toBeTruthy();

    const discardTiles = page.locator('[data-testid^="discard-pool-tile-"]');
    const beforeCount = await discardTiles.count();

    await selectTilesForPass(page, 1);
    await expect(discardButtonLocator(page)).toBeEnabled({ timeout: 30_000 });
    await discardButtonLocator(page).evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expectCommandSent(page, 'DiscardTile');

    await expect
      .poll(async () => discardTiles.count(), { timeout: 30_000 })
      .toBeGreaterThan(beforeCount);
    await expectNoLoadingDeadlock(page);
  });
});
