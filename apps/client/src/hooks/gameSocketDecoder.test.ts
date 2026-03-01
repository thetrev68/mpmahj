import { describe, expect, test } from 'vitest';
import { decodeInboundEnvelope } from './gameSocketDecoder';

function raw(obj: unknown): string {
  return JSON.stringify(obj);
}

describe('decodeInboundEnvelope', () => {
  // ─── Structural rejections ───────────────────────────────────────────────────

  test('rejects invalid JSON', () => {
    const result = decodeInboundEnvelope('not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Invalid JSON');
  });

  test('rejects non-object top-level values', () => {
    expect(decodeInboundEnvelope('"string"').ok).toBe(false);
    expect(decodeInboundEnvelope('42').ok).toBe(false);
    expect(decodeInboundEnvelope('null').ok).toBe(false);
    expect(decodeInboundEnvelope('[1,2,3]').ok).toBe(false);
  });

  test('rejects object without kind field', () => {
    expect(decodeInboundEnvelope(raw({ payload: {} })).ok).toBe(false);
  });

  test('rejects object with non-string kind', () => {
    expect(decodeInboundEnvelope(raw({ kind: 42, payload: {} })).ok).toBe(false);
    expect(decodeInboundEnvelope(raw({ kind: null, payload: {} })).ok).toBe(false);
  });

  test('rejects unknown envelope kinds', () => {
    const result = decodeInboundEnvelope(raw({ kind: 'UnknownKind', payload: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unknown envelope kind');
  });

  // ─── Ping ────────────────────────────────────────────────────────────────────

  describe('Ping', () => {
    test('decodes valid Ping', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'Ping', payload: { timestamp: '2026-03-01T00:00:00.000Z' } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'Ping') {
        expect(result.envelope.payload.timestamp).toBe('2026-03-01T00:00:00.000Z');
      }
    });

    test('rejects Ping with missing timestamp', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Ping', payload: {} })).ok).toBe(false);
    });

    test('rejects Ping with non-string timestamp', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Ping', payload: { timestamp: 12345 } })).ok).toBe(
        false
      );
    });

    test('rejects Ping with no payload', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Ping' })).ok).toBe(false);
    });
  });

  // ─── AuthSuccess ─────────────────────────────────────────────────────────────

  describe('AuthSuccess', () => {
    const validPayload = {
      player_id: 'p1',
      display_name: 'Player 1',
      session_token: 'tok-abc',
      seat: 'West',
    };

    test('decodes valid AuthSuccess', () => {
      const result = decodeInboundEnvelope(raw({ kind: 'AuthSuccess', payload: validPayload }));
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'AuthSuccess') {
        expect(result.envelope.payload.player_id).toBe('p1');
        expect(result.envelope.payload.session_token).toBe('tok-abc');
      }
    });

    test('decodes AuthSuccess with no seat (optional)', () => {
      const result = decodeInboundEnvelope(
        raw({
          kind: 'AuthSuccess',
          payload: { player_id: 'p1', display_name: 'Player 1', session_token: 'tok-abc' },
        })
      );
      expect(result.ok).toBe(true);
    });

    test('rejects AuthSuccess missing player_id', () => {
      expect(
        decodeInboundEnvelope(
          raw({ kind: 'AuthSuccess', payload: { display_name: 'Player 1', session_token: 'tok' } })
        ).ok
      ).toBe(false);
    });

    test('rejects AuthSuccess missing display_name', () => {
      expect(
        decodeInboundEnvelope(
          raw({ kind: 'AuthSuccess', payload: { player_id: 'p1', session_token: 'tok' } })
        ).ok
      ).toBe(false);
    });

    test('rejects AuthSuccess missing session_token', () => {
      expect(
        decodeInboundEnvelope(
          raw({ kind: 'AuthSuccess', payload: { player_id: 'p1', display_name: 'Player 1' } })
        ).ok
      ).toBe(false);
    });
  });

  // ─── AuthFailure ─────────────────────────────────────────────────────────────

  describe('AuthFailure', () => {
    test('decodes AuthFailure with message', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'AuthFailure', payload: { message: 'auth failed' } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'AuthFailure') {
        expect(result.envelope.payload?.message).toBe('auth failed');
      }
    });

    test('decodes AuthFailure with no payload (tolerant)', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'AuthFailure' })).ok).toBe(true);
    });

    test('decodes AuthFailure with empty payload (tolerant)', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'AuthFailure', payload: {} })).ok).toBe(true);
    });
  });

  // ─── RoomJoined ──────────────────────────────────────────────────────────────

  describe('RoomJoined', () => {
    test('decodes valid RoomJoined', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'RoomJoined', payload: { room_id: 'room-1', seat: 'East' } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'RoomJoined') {
        expect(result.envelope.payload.room_id).toBe('room-1');
      }
    });

    test('rejects RoomJoined without room_id', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'RoomJoined', payload: { seat: 'East' } })).ok).toBe(
        false
      );
    });

    test('rejects RoomJoined with no payload', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'RoomJoined' })).ok).toBe(false);
    });
  });

  // ─── StateSnapshot ───────────────────────────────────────────────────────────

  describe('StateSnapshot', () => {
    test('decodes valid StateSnapshot', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'StateSnapshot', payload: { snapshot: { your_seat: 'North' } } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'StateSnapshot') {
        expect(result.envelope.payload.snapshot).toBeDefined();
      }
    });

    test('rejects StateSnapshot without snapshot field', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'StateSnapshot', payload: {} })).ok).toBe(false);
    });

    test('rejects StateSnapshot where snapshot is not an object', () => {
      expect(
        decodeInboundEnvelope(raw({ kind: 'StateSnapshot', payload: { snapshot: 'bad' } })).ok
      ).toBe(false);
    });

    test('rejects StateSnapshot with no payload', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'StateSnapshot' })).ok).toBe(false);
    });
  });

  // ─── Event ───────────────────────────────────────────────────────────────────

  describe('Event', () => {
    test('decodes valid Event with Public event', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'Event', payload: { event: { Public: { TilesDealt: {} } } } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'Event') {
        expect(result.envelope.payload.event).toBeDefined();
      }
    });

    test('decodes valid Event with Private event', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'Event', payload: { event: { Private: { TilesDealt: {} } } } })
      );
      expect(result.ok).toBe(true);
    });

    test('rejects Event without event field', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Event', payload: {} })).ok).toBe(false);
    });

    test('rejects Event where event is not an object', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Event', payload: { event: 'bad' } })).ok).toBe(
        false
      );
    });

    test('rejects Event with no payload', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Event' })).ok).toBe(false);
    });
  });

  // ─── Error ───────────────────────────────────────────────────────────────────

  describe('Error', () => {
    test('decodes valid Error', () => {
      const result = decodeInboundEnvelope(
        raw({ kind: 'Error', payload: { code: 'AUTH_EXPIRED', message: 'Token expired' } })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'Error') {
        expect(result.envelope.payload.code).toBe('AUTH_EXPIRED');
        expect(result.envelope.payload.message).toBe('Token expired');
      }
    });

    test('decodes Error with optional context field', () => {
      const result = decodeInboundEnvelope(
        raw({
          kind: 'Error',
          payload: { code: 'ROOM_NOT_FOUND', message: 'Room no longer exists', context: { id: 1 } },
        })
      );
      expect(result.ok).toBe(true);
      if (result.ok && result.envelope.kind === 'Error') {
        expect(result.envelope.payload.context).toEqual({ id: 1 });
      }
    });

    test('rejects Error missing code', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Error', payload: { message: 'oops' } })).ok).toBe(
        false
      );
    });

    test('rejects Error missing message', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Error', payload: { code: 'ERR_FOO' } })).ok).toBe(
        false
      );
    });

    test('rejects Error with no payload', () => {
      expect(decodeInboundEnvelope(raw({ kind: 'Error' })).ok).toBe(false);
    });
  });
});
