import { expect, type Page } from '@playwright/test';
import {
  expectInRoomSurface,
  expectLobbyConnected,
  expectNoLoadingDeadlock,
  extractRoomCodeFromWaitingScreen,
} from './assertions';

export interface CreateRoomOptions {
  roomName?: string;
  fillWithBots?: boolean;
}

export async function gotoLobby(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 0) {
      await page.goto('/');
    } else {
      await page.reload();
    }

    try {
      await expectLobbyConnected(page, 10_000);
      await expectNoLoadingDeadlock(page);
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
}

export async function createRoom(
  page: Page,
  options: CreateRoomOptions = {}
): Promise<'game-board' | 'room-waiting'> {
  await page.getByRole('button', { name: 'Create Room' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  if (options.roomName) {
    const roomNameInput = dialog.getByLabel('Room Name');
    await roomNameInput.fill(options.roomName);
  }

  if (options.fillWithBots) {
    await dialog.getByLabel('Fill empty seats with bots').click();
  }

  await dialog.getByLabel('Room Name').press('Enter');

  return expectInRoomSurface(page);
}

export async function createRoomAndGetCode(page: Page, roomName: string): Promise<string> {
  const surface = await createRoom(page, { roomName, fillWithBots: false });

  if (surface !== 'room-waiting') {
    throw new Error(
      'Expected room-waiting surface to extract room code, but game started immediately.'
    );
  }

  return extractRoomCodeFromWaitingScreen(page);
}

export async function openJoinDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function joinRoomByCode(
  page: Page,
  roomCode: string
): Promise<'game-board' | 'room-waiting'> {
  await openJoinDialog(page);

  const dialog = page.getByRole('dialog');
  const codeInput = dialog.getByLabel('Code');
  await codeInput.fill(roomCode);
  await dialog.getByRole('button', { name: /^Join$/ }).click();

  return expectInRoomSurface(page);
}

export async function gotoDeepLinkJoin(page: Page, roomCode: string): Promise<void> {
  await page.goto(`/?join=1&code=${roomCode}`);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Code')).toHaveValue(roomCode);
}
