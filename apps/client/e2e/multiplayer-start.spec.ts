import { expect, test, type Page } from '@playwright/test';
import { expectNoLoadingDeadlock, extractRoomCodeFromWaitingScreen } from './support/assertions';
import {
  createRoom,
  createRoomAndGetCode,
  gotoLobby,
  joinRoomByCode,
  openJoinDialog,
} from './support/fixtures';
import { closeClients, launchClients } from './support/multiclient';

async function expectFirstActionableState(page: Page): Promise<void> {
  await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () =>
        (await page
          .getByTestId('roll-dice-button')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('proceed-button')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('vote-panel')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('courtesy-pass-panel')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('staging-pass-button')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('waiting-message')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('gameplay-status-bar')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('pass-tiles-button')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByTestId('courtesy-pass-tiles-button')
          .isVisible()
          .catch(() => false)) ||
        (await page
          .getByText('Setting up game...')
          .isVisible()
          .catch(() => false)),
      { timeout: 30_000 }
    )
    .toBe(true);
}

test.describe('Phase 2 - Multiplayer Start Transition', () => {
  test('host plus three joiners transition to first actionable game state', async ({ browser }) => {
    const clients = await launchClients(browser, 4);
    const [host, joiner1, joiner2, joiner3] = clients;

    try {
      for (const client of clients) {
        await gotoLobby(client.page);
      }

      const roomCode = await createRoomAndGetCode(host.page, 'Phase2 Multiplayer Start');

      await joinRoomByCode(joiner1.page, roomCode);
      await joinRoomByCode(joiner2.page, roomCode);
      await joinRoomByCode(joiner3.page, roomCode);

      for (const client of clients) {
        await expectFirstActionableState(client.page);
        await expectNoLoadingDeadlock(client.page);
      }
    } finally {
      await closeClients(clients);
    }
  });

  test('host create with bots reaches first actionable game state', async ({ page }) => {
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase2 Bot Fill Start', fillWithBots: true });

    await expectFirstActionableState(page);
    await expectNoLoadingDeadlock(page);
  });

  test('duplicate create submission does not deadlock room start flow', async ({ browser }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await gotoLobby(host.page);
      await gotoLobby(joiner.page);

      await host.page.getByRole('button', { name: 'Create Room' }).click();
      const dialog = host.page.getByRole('dialog');
      const roomNameInput = dialog.getByLabel('Room Name');
      await roomNameInput.fill('Phase2 Duplicate Create');

      await roomNameInput.press('Enter');
      await roomNameInput.press('Enter', { timeout: 1_000 }).catch(() => {});

      await expect(
        host.page.getByTestId('room-waiting').or(host.page.getByTestId('game-board'))
      ).toBeVisible({
        timeout: 30_000,
      });
      await expect(host.page.getByText(/Failed to create room/i)).toHaveCount(0);
      await expect(host.page.getByText(/already in room/i)).toHaveCount(0);

      const roomCode = await extractRoomCodeFromWaitingScreen(host.page);
      const surface = await joinRoomByCode(joiner.page, roomCode);
      expect(['room-waiting', 'game-board']).toContain(surface);
      await expect(joiner.page.getByText(/Room not found|Room is full/i)).toHaveCount(0);
    } finally {
      await closeClients(clients);
    }
  });

  test('duplicate join submission reaches room surface without join deadlock', async ({
    browser,
  }) => {
    const clients = await launchClients(browser, 2);
    const [host, joiner] = clients;

    try {
      await gotoLobby(host.page);
      await gotoLobby(joiner.page);

      const roomCode = await createRoomAndGetCode(host.page, 'Phase2 Duplicate Join');
      await openJoinDialog(joiner.page);

      const dialog = joiner.page.getByRole('dialog');
      const codeInput = dialog.getByLabel('Code');
      await codeInput.fill(roomCode);
      await codeInput.press('Enter');
      await codeInput.press('Enter', { timeout: 1_000 }).catch(() => {});

      await expect(
        joiner.page.getByTestId('room-waiting').or(joiner.page.getByTestId('game-board'))
      ).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        joiner.page.getByText(/Room not found|Room is full|already in room/i)
      ).toHaveCount(0);
      await expectNoLoadingDeadlock(joiner.page);
    } finally {
      await closeClients(clients);
    }
  });
});
