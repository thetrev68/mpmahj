import { expect, test } from '@playwright/test';
import {
  expectLobbyConnected,
  expectNoLoadingDeadlock,
  expectNoReconnectFallbackSurface,
  extractRoomCodeFromWaitingScreen,
} from './support/assertions';
import { createRoom, gotoLobby } from './support/fixtures';
import { createAuthenticatedSocket } from './support/wsHarness';

type RoomJoinedPayload = {
  room_id: string;
  seat: 'East' | 'South' | 'West' | 'North';
};

function roomJoinedPayload(payload: unknown): RoomJoinedPayload {
  return payload as RoomJoinedPayload;
}

test.describe('Phase 5 - Failure Modes UX', () => {
  test('stale session token is recovered without lobby deadlock', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('session_token', 'phase5-stale-token');
      window.localStorage.setItem('session_seat', 'East');
    });

    await page.goto('/');

    await expectLobbyConnected(page, 30_000);
    await expectNoLoadingDeadlock(page);
    await expect(page.getByTestId('login-screen-placeholder')).toHaveCount(0);

    const latestToken = await page.evaluate(() => window.localStorage.getItem('session_token'));
    expect(latestToken).toBeTruthy();
    expect(latestToken).not.toBe('phase5-stale-token');
  });

  test('server interruption during active session recovers back to game surface', async ({
    page,
  }) => {
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase5 Interruption Recovery', fillWithBots: true });

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });

    await page.context().setOffline(true);
    await page.waitForTimeout(2_500);
    await page.context().setOffline(false);

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });
    await expectNoReconnectFallbackSurface(page);
    await expectNoLoadingDeadlock(page);
  });

  test('leave game returns player to stable lobby placeholder path', async ({ page }) => {
    await gotoLobby(page);
    await createRoom(page, { roomName: 'Phase5 Leave Path', fillWithBots: true });

    await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('leave-game-button').click();
    await page.getByRole('button', { name: /leave game now/i }).click();

    await expectLobbyConnected(page, 10_000);
    await expect(page.getByTestId('lobby-notice')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('lobby-notice')).toContainText(
      'You left the game and can start a new one.'
    );
  });

  test('forfeit by another seat transitions active browser to draw scoring path', async ({
    page,
  }) => {
    const joinerA = await createAuthenticatedSocket();
    const joinerB = await createAuthenticatedSocket();
    const joinerC = await createAuthenticatedSocket();

    try {
      await gotoLobby(page);
      await createRoom(page, { roomName: 'Phase5 Forfeit Path', fillWithBots: false });

      const roomCode = await extractRoomCodeFromWaitingScreen(page);

      joinerA.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      await joinerA.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined', 10_000);

      joinerB.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      const joinerBJoined = await joinerB.waitForEnvelope(
        (envelope) => envelope.kind === 'RoomJoined',
        10_000
      );

      joinerC.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      await joinerC.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined', 10_000);

      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

      const forfeitingSeat = roomJoinedPayload(joinerBJoined.payload).seat;
      joinerB.sendEnvelope({
        kind: 'Command',
        payload: {
          command: {
            ForfeitGame: {
              player: forfeitingSeat,
              reason: 'Phase5 failure-mode forfeit check',
            },
          },
        },
      });

      await expect(page.getByTestId('draw-scoring-screen')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('draw-scoring-reason')).toContainText(/Player forfeited/i);
      await expectNoLoadingDeadlock(page);
    } finally {
      await Promise.all([joinerA.close(), joinerB.close(), joinerC.close()]);
    }
  });
});
