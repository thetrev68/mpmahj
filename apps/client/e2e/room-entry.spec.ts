import { expect, test } from '@playwright/test';
import { expectErrorMessage, expectInRoomSurface } from './support/assertions';
import {
  createRoomAndGetCode,
  gotoDeepLinkJoin,
  gotoLobby,
  joinRoomByCode,
  openJoinDialog,
} from './support/fixtures';
import { closeClients, launchClients } from './support/multiclient';

test.describe('Phase 1 - Room Entry Paths', () => {
  test('host creates room and reaches deterministic waiting state', async ({ page }) => {
    await gotoLobby(page);
    const roomCode = await createRoomAndGetCode(page, 'Phase1 Room Create');

    expect(roomCode).toMatch(/^[A-Za-z0-9-]{5,64}$/);
  });

  test('join room by code from second client', async ({ browser }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await gotoLobby(host.page);
      await gotoLobby(joiner.page);

      const roomCode = await createRoomAndGetCode(host.page, 'Phase1 Join By Code');
      const surface = await joinRoomByCode(joiner.page, roomCode);

      expect(['room-waiting', 'game-board']).toContain(surface);
      await expect(joiner.page.getByText('Room not found')).toHaveCount(0);
    } finally {
      await closeClients(clients);
    }
  });

  test('join room by deeplink', async ({ browser }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await gotoLobby(host.page);
      const roomCode = await createRoomAndGetCode(host.page, 'Phase1 Deeplink Join');

      await gotoDeepLinkJoin(joiner.page, roomCode);
      const dialog = joiner.page.getByRole('dialog');
      await dialog.getByRole('button', { name: /^Join$/ }).click();

      const surface = await expectInRoomSurface(joiner.page);
      expect(['room-waiting', 'game-board']).toContain(surface);
    } finally {
      await closeClients(clients);
    }
  });

  test('invalid room code shows user-facing error', async ({ page }) => {
    await gotoLobby(page);
    await openJoinDialog(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Code').fill('ZZZZZ');
    await dialog.getByRole('button', { name: /^Join$/ }).click();

    await expectErrorMessage(page.getByText(/Room not found/i), /Room not found/i);
  });

  test('room full is surfaced to extra joiner', async ({ browser }) => {
    const clients = await launchClients(browser, 5);
    const [host, joiner1, joiner2, joiner3, overflow] = clients;

    try {
      for (const client of clients) {
        await gotoLobby(client.page);
      }

      const roomCode = await createRoomAndGetCode(host.page, 'Phase1 Full Room');

      await joinRoomByCode(joiner1.page, roomCode);
      await joinRoomByCode(joiner2.page, roomCode);
      await joinRoomByCode(joiner3.page, roomCode);

      await openJoinDialog(overflow.page);
      const dialog = overflow.page.getByRole('dialog');
      await dialog.getByLabel('Code').fill(roomCode);
      await dialog.getByRole('button', { name: /^Join$/ }).click();

      await expectErrorMessage(overflow.page.getByText(/Room is full/i), /Room is full/i);
    } finally {
      await closeClients(clients);
    }
  });
});
