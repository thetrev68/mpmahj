import { expect, test, type Page } from '@playwright/test';
import { expectInRoomSurface, expectNoLoadingDeadlock } from './support/assertions';
import { createRoom, createRoomAndGetCode, gotoLobby, openJoinDialog } from './support/fixtures';
import { goOffline, goOnline, installWsSendFaultInjection } from './support/faults';
import { closeClients, launchClients } from './support/multiclient';

async function submitJoinWithChaos(
  page: Page,
  roomCode: string
): Promise<'game-board' | 'room-waiting'> {
  await openJoinDialog(page);

  const dialog = page.getByRole('dialog');
  const codeInput = dialog.getByLabel('Code');
  await codeInput.fill(roomCode);

  await Promise.all([
    codeInput.press('Enter').catch(() => {}),
    codeInput.press('Enter').catch(() => {}),
    dialog
      .getByRole('button', { name: /^Join$/ })
      .click({ timeout: 1_500 })
      .catch(() => {}),
  ]);

  return expectInRoomSurface(page);
}

async function expectActiveGameSurface(page: Page): Promise<void> {
  await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });
}

test.describe('Phase 5 - Race, Chaos, and Fault Injection', () => {
  test('duplicate join submission under delayed websocket sends still reaches room surface', async ({
    browser,
  }) => {
    const clients = await launchClients(browser, 3);
    const [host, joinerA, joinerB] = clients;

    try {
      await installWsSendFaultInjection(joinerA.page, { delayMs: 180 });
      await installWsSendFaultInjection(joinerB.page, { delayMs: 280 });

      await Promise.all(clients.map((client) => gotoLobby(client.page)));

      const roomCode = await createRoomAndGetCode(host.page, 'Phase5 Chaos Duplicate Join');
      const [joinerASurface, joinerBSurface] = await Promise.all([
        submitJoinWithChaos(joinerA.page, roomCode),
        submitJoinWithChaos(joinerB.page, roomCode),
      ]);

      expect(['room-waiting', 'game-board']).toContain(joinerASurface);
      expect(['room-waiting', 'game-board']).toContain(joinerBSurface);

      for (const client of clients) {
        await expectNoLoadingDeadlock(client.page);
      }
    } finally {
      await closeClients(clients);
    }
  });

  test('network disconnect/reconnect bursts during active game do not deadlock UI', async ({
    page,
  }) => {
    await installWsSendFaultInjection(page, { delayMs: 220 });
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase5 Fault Burst Recovery', fillWithBots: true });
    await expectActiveGameSurface(page);

    for (let i = 0; i < 3; i += 1) {
      await goOffline(page);
      await page.waitForTimeout(900);
      await goOnline(page);

      await expectActiveGameSurface(page);
      await expectNoLoadingDeadlock(page);
    }

    await expect(page.getByTestId('disconnect-interaction-lock')).toHaveCount(0);
  });

  test('dropped JoinRoom envelope does not trap lobby in loading deadlock', async ({ browser }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await installWsSendFaultInjection(joiner.page, { dropKinds: ['JoinRoom'] });

      await gotoLobby(host.page);
      await gotoLobby(joiner.page);

      const roomCode = await createRoomAndGetCode(host.page, 'Phase5 Drop JoinRoom');
      await openJoinDialog(joiner.page);

      const dialog = joiner.page.getByRole('dialog');
      await dialog.getByLabel('Code').fill(roomCode);
      await dialog.getByRole('button', { name: /^Join$/ }).click();

      await expect(joiner.page.getByText(/Join request timed out/i)).toBeVisible({
        timeout: 12_000,
      });
      await expect(dialog.getByRole('button', { name: /^Join$/ })).toBeEnabled();
      await expectNoLoadingDeadlock(joiner.page);
    } finally {
      await closeClients(clients);
    }
  });
});
