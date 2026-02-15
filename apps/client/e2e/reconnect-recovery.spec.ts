import { expect, test, type Page } from '@playwright/test';
import {
  expectLobbyConnected,
  expectNoLoadingDeadlock,
  expectReconnectRestoredRoomSurface,
  extractRoomCodeFromWaitingScreen,
} from './support/assertions';
import { createRoom, createRoomAndGetCode, gotoLobby, joinRoomByCode } from './support/fixtures';
import { closeClients, launchClients } from './support/multiclient';

async function expectRecoveredGameTurnState(page: Page): Promise<void> {
  await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });
}

test.describe('Phase 3 - Reconnect and Refresh Recovery', () => {
  test('refresh recovery in lobby remains connected and not deadlocked', async ({ page }) => {
    await gotoLobby(page);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectLobbyConnected(page);
    await expectNoLoadingDeadlock(page);
  });

  test('refresh recovery in room waiting preserves room membership', async ({ browser }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await gotoLobby(host.page);
      await gotoLobby(joiner.page);

      const roomCode = await createRoomAndGetCode(host.page, 'Phase3 Waiting Recovery');
      await joinRoomByCode(joiner.page, roomCode);

      await host.page.reload({ waitUntil: 'domcontentloaded' });

      const surface = await expectReconnectRestoredRoomSurface(host.page);
      expect(['room-waiting', 'game-board']).toContain(surface);

      if (surface === 'room-waiting') {
        const recoveredRoomCode = await extractRoomCodeFromWaitingScreen(host.page);
        expect(recoveredRoomCode).toBe(roomCode);
      }

      await expectNoLoadingDeadlock(host.page);
    } finally {
      await closeClients(clients);
    }
  });

  test('refresh recovery while in game turn restores actionable game surface', async ({ page }) => {
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase3 InGame Recovery', fillWithBots: true });
    await expectRecoveredGameTurnState(page);

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectRecoveredGameTurnState(page);
    await expectNoLoadingDeadlock(page);
  });

  test('reconnect after temporary offline in active game avoids loading deadlocks', async ({
    page,
  }) => {
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase3 Offline Recovery', fillWithBots: true });
    await expectRecoveredGameTurnState(page);

    await page.context().setOffline(true);
    await page.waitForTimeout(1200);
    await page.context().setOffline(false);

    await expectRecoveredGameTurnState(page);
    await expectNoLoadingDeadlock(page);
    await expect(page.getByTestId('disconnect-interaction-lock')).toHaveCount(0);
  });
});
