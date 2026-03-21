import { expect, test } from '@playwright/test';
import {
  expectLobbyConnected,
  expectNoLoadingDeadlock,
  expectNoReconnectFallbackSurface,
  extractRoomCodeFromWaitingScreen,
} from './support/assertions';
import { createRoom, gotoLobby } from './support/fixtures';

type RoomJoinedPayload = {
  room_id: string;
  seat: 'East' | 'South' | 'West' | 'North';
};

function roomJoinedPayload(payload: unknown): RoomJoinedPayload {
  return payload as RoomJoinedPayload;
}

type InlineSocket = {
  sendEnvelope: (envelope: unknown) => void;
  waitForEnvelope: (
    predicate: (envelope: { kind: string; payload?: unknown }) => boolean
  ) => Promise<{
    kind: string;
    payload?: unknown;
  }>;
  close: () => Promise<void>;
};

async function createInlineAuthenticatedSocket(
  wsUrl = 'ws://127.0.0.1:33001/ws'
): Promise<InlineSocket> {
  const ws = new WebSocket(wsUrl);
  const queue: Array<{ kind: string; payload?: unknown }> = [];

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', async (event) => {
    const data =
      typeof event.data === 'string'
        ? event.data
        : event.data instanceof Blob
          ? await event.data.text()
          : '';

    if (!data) {
      return;
    }

    try {
      queue.push(JSON.parse(data) as { kind: string; payload?: unknown });
    } catch {
      // Ignore malformed server payloads in the test helper.
    }
  });

  ws.send(
    JSON.stringify({
      kind: 'Authenticate',
      payload: {
        method: 'jwt',
        credentials: {
          token: `test-token-${crypto.randomUUID()}`,
        },
        version: '1.0',
      },
    })
  );

  const authResult = await new Promise<{ kind: string; payload?: unknown }>((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const match = queue.find(
        (envelope) => envelope.kind === 'AuthSuccess' || envelope.kind === 'AuthFailure'
      );
      if (match) {
        clearInterval(interval);
        resolve(match);
        return;
      }

      if (Date.now() - startedAt > 10_000) {
        clearInterval(interval);
        reject(new Error('Did not receive authentication result after opening websocket'));
      }
    }, 25);
  });

  if (authResult.kind !== 'AuthSuccess') {
    throw new Error('Inline websocket authentication failed');
  }

  return {
    sendEnvelope: (envelope) => {
      ws.send(JSON.stringify(envelope));
    },
    waitForEnvelope: (predicate) =>
      new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const interval = setInterval(() => {
          const index = queue.findIndex(predicate);
          if (index >= 0) {
            const [match] = queue.splice(index, 1);
            clearInterval(interval);
            resolve(match);
            return;
          }

          if (Date.now() - startedAt > 10_000) {
            clearInterval(interval);
            reject(new Error('Envelope wait timed out'));
          }
        }, 25);
      }),
    close: () =>
      new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }

        let resolved = false;
        const finish = () => {
          if (resolved) {
            return;
          }
          resolved = true;
          resolve();
        };

        ws.addEventListener('close', () => finish(), { once: true });
        ws.close();
        setTimeout(() => finish(), 1_000);
      }),
  };
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

  test('majority abandon by other seats transitions active browser to abandoned draw path', async ({
    page,
  }) => {
    let joinerA: InlineSocket | null = null;
    let joinerB: InlineSocket | null = null;
    let joinerC: InlineSocket | null = null;

    try {
      await page.goto('/');
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await expectLobbyConnected(page, 10_000);
          break;
        } catch (error) {
          if (attempt === 1) {
            throw error;
          }
          await page.reload();
        }
      }

      await createRoom(page, { roomName: 'Phase5 Forfeit Path', fillWithBots: false });

      const roomCode = await extractRoomCodeFromWaitingScreen(page);

      joinerA = await createInlineAuthenticatedSocket();
      joinerB = await createInlineAuthenticatedSocket();
      joinerC = await createInlineAuthenticatedSocket();

      joinerA.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      const joinerAJoined = await joinerA.waitForEnvelope(
        (envelope) => envelope.kind === 'RoomJoined',
        10_000
      );

      joinerB.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      const joinerBJoined = await joinerB.waitForEnvelope(
        (envelope) => envelope.kind === 'RoomJoined',
        10_000
      );

      joinerC.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomCode } });
      const joinerCJoined = await joinerC.waitForEnvelope(
        (envelope) => envelope.kind === 'RoomJoined',
        10_000
      );

      await expect(page.getByTestId('game-board')).toBeVisible({ timeout: 30_000 });

      const abandoningSeats = [
        roomJoinedPayload(joinerAJoined.payload).seat,
        roomJoinedPayload(joinerBJoined.payload).seat,
        roomJoinedPayload(joinerCJoined.payload).seat,
      ];

      for (const [index, seat] of abandoningSeats.entries()) {
        if (!seat) {
          throw new Error('Expected joined seat before sending AbandonGame');
        }

        const socket = [joinerA, joinerB, joinerC][index];

        socket.sendEnvelope({
          kind: 'Command',
          payload: {
            command: {
              AbandonGame: {
                player: seat,
                reason: 'MutualAgreement',
              },
            },
          },
        });
      }

      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('dialog')).toContainText(/MutualAgreement/i);
      await expectNoLoadingDeadlock(page);
    } finally {
      await Promise.all([joinerA?.close(), joinerB?.close(), joinerC?.close()].filter(Boolean));
    }
  });
});
