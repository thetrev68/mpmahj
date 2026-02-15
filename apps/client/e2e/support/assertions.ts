import { expect, type Locator, type Page } from '@playwright/test';

const DEFAULT_TIMEOUT_MS = 20_000;

export async function expectLobbyConnected(
  page: Page,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> {
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeEnabled({
    timeout: timeoutMs,
  });
  await expect(page.getByRole('button', { name: 'Join Room' })).toBeEnabled({ timeout: timeoutMs });
  await expect(page.getByText('Connected')).toBeVisible({ timeout: timeoutMs });
}

export async function expectInRoomSurface(
  page: Page,
  timeoutMs = 30_000
): Promise<'game-board' | 'room-waiting'> {
  const gameBoard = page.getByTestId('game-board');
  const roomWaiting = page.getByTestId('room-waiting');
  try {
    await expect(gameBoard.or(roomWaiting)).toBeVisible({ timeout: timeoutMs });
  } catch (error) {
    const reconnectLobby = await page.getByTestId('reconnect-lobby-placeholder').count();
    const loginPlaceholder = await page.getByTestId('login-screen-placeholder').count();
    const lobbyHeading = await page.getByRole('heading', { name: 'American Mahjong' }).count();
    const bodyText = await page.locator('body').innerText();

    throw new Error(
      [
        `Did not reach room surface within ${timeoutMs}ms.`,
        `reconnect-lobby-placeholder=${reconnectLobby}`,
        `login-screen-placeholder=${loginPlaceholder}`,
        `lobby-heading=${lobbyHeading}`,
        `body-preview=${JSON.stringify(bodyText.slice(0, 600))}`,
        `original=${String(error)}`,
      ].join(' ')
    );
  }

  if (await roomWaiting.isVisible()) {
    return 'room-waiting';
  }

  return 'game-board';
}

export async function expectNoLoadingDeadlock(page: Page, maxLoadingMs = 12_000): Promise<void> {
  const loading = page.getByText('Loading game...');
  const connecting = page.getByText('Connecting...');

  if (await loading.isVisible()) {
    await expect(loading).not.toBeVisible({ timeout: maxLoadingMs });
  }

  if (await connecting.isVisible()) {
    await expect(connecting).not.toBeVisible({ timeout: maxLoadingMs });
  }
}

export async function expectNoReconnectFallbackSurface(page: Page): Promise<void> {
  await expect(page.getByTestId('login-screen-placeholder')).toHaveCount(0);
  await expect(page.getByTestId('reconnect-lobby-placeholder')).toHaveCount(0);
}

export async function expectReconnectRestoredRoomSurface(
  page: Page,
  timeoutMs = 30_000
): Promise<'game-board' | 'room-waiting'> {
  await expectNoReconnectFallbackSurface(page);
  return expectInRoomSurface(page, timeoutMs);
}

export async function extractRoomCodeFromWaitingScreen(page: Page): Promise<string> {
  const waiting = page.getByTestId('room-waiting');
  await expect(waiting).toBeVisible({ timeout: DEFAULT_TIMEOUT_MS });

  const heading = waiting.getByRole('heading');
  const title = (await heading.textContent()) ?? '';
  const match = title.match(/Room\s+([A-Za-z0-9-]{5,64})/);
  if (!match) {
    throw new Error(`Could not parse room code from heading: "${title}"`);
  }

  return match[1];
}

export async function expectErrorMessage(
  locator: Locator,
  pattern: RegExp,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> {
  await expect(locator).toBeVisible({ timeout: timeoutMs });
  await expect(locator).toContainText(pattern, { timeout: timeoutMs });
}
