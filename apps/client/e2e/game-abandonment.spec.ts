import { expect, test } from '@playwright/test';
import { expectNoLoadingDeadlock, extractRoomCodeFromWaitingScreen } from './support/assertions';
import { createRoom, gotoLobby } from './support/fixtures';
import { createAuthenticatedSocket } from './support/wsHarness';

type RoomJoinedPayload = {
  room_id: string;
  seat: 'East' | 'South' | 'West' | 'North';
};

function roomJoinedPayload(payload: unknown): RoomJoinedPayload {
  return payload as RoomJoinedPayload;
}

test.describe('Game Abandonment Flow', () => {
  test('AbandonGame(AllPlayersDead) shows abandoned draw overlay for active players', async ({
    page,
  }) => {
    const joinerA = await createAuthenticatedSocket();
    const joinerB = await createAuthenticatedSocket();
    const joinerC = await createAuthenticatedSocket();

    try {
      await gotoLobby(page);
      await createRoom(page, { roomName: 'E2E Game Abandonment', fillWithBots: false });

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
      await expect(page.getByTestId('action-bar')).toBeVisible({ timeout: 30_000 });

      const abandoningSeat = roomJoinedPayload(joinerBJoined.payload).seat;
      joinerB.sendEnvelope({
        kind: 'Command',
        payload: {
          command: {
            AbandonGame: {
              player: abandoningSeat,
              reason: 'AllPlayersDead',
            },
          },
        },
      });

      const drawOverlay = page.getByTestId('draw-overlay');
      const drawScoringScreen = page.getByTestId('draw-scoring-screen');
      await expect(drawOverlay.or(drawScoringScreen)).toBeVisible({ timeout: 30_000 });

      if (await drawOverlay.isVisible()) {
        await expect(page.getByTestId('draw-overlay-title')).toContainText(/GAME ABANDONED/i);
        await expect(drawOverlay).toContainText(/All players dead hands/i);
      } else {
        await expect(drawScoringScreen).toContainText(/All players dead hands|Game abandoned/i);
      }

      await expectNoLoadingDeadlock(page);
    } finally {
      await Promise.all([joinerA.close(), joinerB.close(), joinerC.close()]);
    }
  });
});
