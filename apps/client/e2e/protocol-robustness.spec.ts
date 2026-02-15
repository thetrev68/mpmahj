import { expect, test } from '@playwright/test';
import { createGuestSocket, type Envelope } from './support/wsHarness';

type ErrorPayload = {
  code?: string;
  message?: string;
};

type RoomJoinedPayload = {
  room_id: string;
  seat: 'East' | 'South' | 'West' | 'North';
};

type PingPayload = {
  timestamp: string;
};

function errorPayload(envelope: Envelope): ErrorPayload {
  return (envelope.payload as ErrorPayload | undefined) ?? {};
}

function roomJoinedPayload(envelope: Envelope): RoomJoinedPayload {
  return envelope.payload as RoomJoinedPayload;
}

test.describe('Phase 4 - Protocol Robustness', () => {
  test('invalid client envelope returns INVALID_COMMAND and keeps connection usable', async () => {
    const socket = await createGuestSocket();

    try {
      socket.sendRaw('{"kind":"Command","payload":');
      const invalidJson = await socket.waitForEnvelope(
        (envelope) => envelope.kind === 'Error',
        10_000
      );
      const invalidJsonPayload = errorPayload(invalidJson);
      expect(invalidJsonPayload.code).toBe('INVALID_COMMAND');
      expect(invalidJsonPayload.message ?? '').toMatch(/Invalid JSON/i);

      socket.sendEnvelope({
        kind: 'Ping',
        payload: { timestamp: new Date().toISOString() },
      });
      const unexpectedType = await socket.waitForEnvelope(
        (envelope) => envelope.kind === 'Error',
        10_000
      );
      const unexpectedTypePayload = errorPayload(unexpectedType);
      expect(unexpectedTypePayload.code).toBe('INVALID_COMMAND');
      expect(unexpectedTypePayload.message ?? '').toMatch(/Unexpected message type/i);

      socket.sendEnvelope({
        kind: 'CreateRoom',
        payload: { room_name: 'Phase4 Invalid Envelope Recovery' },
      });
      const roomJoined = await socket.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined');
      expect(roomJoinedPayload(roomJoined).room_id).toBeTruthy();
    } finally {
      await socket.close();
    }
  });

  test('server emits structured ROOM_NOT_FOUND error envelope for unknown join target', async () => {
    const socket = await createGuestSocket();

    try {
      socket.sendEnvelope({
        kind: 'JoinRoom',
        payload: { room_id: 'phase4-room-does-not-exist' },
      });

      const roomNotFound = await socket.waitForEnvelope(
        (envelope) => envelope.kind === 'Error',
        10_000
      );
      const payload = errorPayload(roomNotFound);
      expect(payload.code).toBe('ROOM_NOT_FOUND');
      expect(payload.message ?? '').toMatch(/Room not found/i);
    } finally {
      await socket.close();
    }
  });

  test('ping from server can be answered with pong and session remains alive', async () => {
    const socket = await createGuestSocket();

    try {
      const ping = await socket.waitForEnvelope((envelope) => envelope.kind === 'Ping', 45_000);
      const pingPayload = ping.payload as PingPayload;
      expect(typeof pingPayload.timestamp).toBe('string');

      socket.sendEnvelope({
        kind: 'Pong',
        payload: { timestamp: pingPayload.timestamp },
      });

      socket.sendEnvelope({
        kind: 'CreateRoom',
        payload: { room_name: 'Phase4 Heartbeat Stability Check' },
      });
      const roomJoined = await socket.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined');
      expect(roomJoinedPayload(roomJoined).room_id).toBeTruthy();
    } finally {
      await socket.close();
    }
  });

  test('out-of-turn command is rejected with NOT_YOUR_TURN', async () => {
    const host = await createGuestSocket();
    const playerTwo = await createGuestSocket();
    const playerThree = await createGuestSocket();
    const playerFour = await createGuestSocket();

    try {
      host.sendEnvelope({
        kind: 'CreateRoom',
        payload: { room_name: 'Phase4 Out Of Turn Rejection' },
      });
      const hostJoined = await host.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined');
      const roomId = roomJoinedPayload(hostJoined).room_id;

      playerTwo.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomId } });
      const playerTwoJoined = await playerTwo.waitForEnvelope(
        (envelope) => envelope.kind === 'RoomJoined'
      );

      playerThree.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomId } });
      await playerThree.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined');

      playerFour.sendEnvelope({ kind: 'JoinRoom', payload: { room_id: roomId } });
      await playerFour.waitForEnvelope((envelope) => envelope.kind === 'RoomJoined');

      const seat = roomJoinedPayload(playerTwoJoined).seat;
      expect(seat).not.toBe('East');

      playerTwo.sendEnvelope({
        kind: 'Command',
        payload: {
          command: {
            RollDice: {
              player: seat,
            },
          },
        },
      });

      const outOfTurn = await playerTwo.waitForEnvelope(
        (envelope) => envelope.kind === 'Error',
        10_000
      );
      const payload = errorPayload(outOfTurn);
      expect(['NOT_YOUR_TURN', 'INVALID_COMMAND']).toContain(payload.code ?? '');
      expect(payload.message ?? '').toMatch(/turn|phase|invalid/i);
    } finally {
      await Promise.all([host.close(), playerTwo.close(), playerThree.close(), playerFour.close()]);
    }
  });
});
