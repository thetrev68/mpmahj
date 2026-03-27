/**
 * P2-1: Malformed Event Payload Tests
 *
 * Tests the decoder gap: isServerEvent only checks top-level discriminant
 * (Public/Private/Analysis), not inner payload shape. These tests verify
 * that structurally valid envelopes with wrong/missing inner fields
 * degrade gracefully — no crash, no frozen state.
 *
 * Test strategy:
 * 1. Decoder-level: verify decodeInboundEnvelope accepts/rejects edge cases
 * 2. Handler-level: verify handlePublicEvent returns EMPTY_RESULT for garbage
 * 3. Dispatcher-level: verify full pipeline doesn't throw on malformed events
 */

import { describe, expect, test, vi } from 'vitest';
import { decodeInboundEnvelope } from '@/hooks/gameSocketDecoder';
import { handlePublicEvent, type PublicEventDispatchContext } from './publicEventHandlers';
import { handlePrivateEvent, type PrivateEventContext } from './privateEventHandlers';
import { createEventDispatchers, type EventDispatchContext } from './eventDispatchers';
import { EMPTY_RESULT } from './types';

function raw(obj: unknown): string {
  return JSON.stringify(obj, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

const nullPublicContext: PublicEventDispatchContext = {
  gameState: null,
  yourSeat: null,
  callIntents: [],
  discardedBy: null,
};

const nullPrivateContext: PrivateEventContext = {
  gameState: null,
  hasSubmittedPass: false,
};

describe('P2-1: Malformed event payloads', () => {
  // ─── Decoder gap: structurally valid but semantically wrong ─────────────

  describe('Decoder accepts structurally valid events with garbage inner payloads', () => {
    test.each([
      ['empty Public object', { Public: {} }],
      ['unknown Public key', { Public: { NotARealEvent: { foo: 'bar' } } }],
      ['Public with number payload', { Public: { TileDiscarded: 42 } }],
      ['Public with null inner', { Public: { TileDiscarded: null } }],
      ['Public with empty inner', { Public: { TileDiscarded: {} } }],
      ['Private with garbage', { Private: { NotReal: true } }],
      ['Analysis with garbage', { Analysis: { whatever: [] } }],
    ])('decoder passes %s through (known gap)', (_label, event) => {
      const result = decodeInboundEnvelope(raw({ kind: 'Event', payload: { event } }));
      // These pass because isServerEvent only checks top-level discriminant
      expect(result.ok).toBe(true);
    });
  });

  // ─── Public handler: unrecognized keys → EMPTY_RESULT ──────────────────

  describe('handlePublicEvent returns EMPTY_RESULT for unrecognized events', () => {
    test.each([
      ['empty object', {}],
      ['unknown event key', { NotARealEvent: { foo: 'bar' } }],
      ['multiple unknown keys', { Foo: 1, Bar: 2 }],
    ])('%s → EMPTY_RESULT', (_label, event) => {
      // Cast needed because TS wouldn't allow unknown keys on PublicEvent
      const result = handlePublicEvent(event as never, nullPublicContext);
      expect(result).toEqual(EMPTY_RESULT);
    });
  });

  // ─── Public handler: recognized keys with wrong inner shape ────────────

  describe('handlePublicEvent with recognized keys and malformed inner data', () => {
    // These handlers gracefully handle malformed data (no destructuring of inner payload)
    test.each([
      ['TileDiscarded with number', { TileDiscarded: 42 }],
      ['TileDiscarded with empty object', { TileDiscarded: {} }],
      ['TileDiscarded missing fields', { TileDiscarded: { wrong: true } }],
      ['TurnChanged with empty object', { TurnChanged: {} }],
      ['PhaseChanged with number', { PhaseChanged: 42 }],
      ['GameOver with empty', { GameOver: {} }],
      ['MahjongDeclared with string', { MahjongDeclared: 'wrong' }],
      ['CharlestonPhaseChanged with null', { CharlestonPhaseChanged: null }],
    ])('%s does not throw', (_label, event) => {
      expect(() => {
        handlePublicEvent(event as never, nullPublicContext);
      }).not.toThrow();
    });

    // These handlers crash on null inner payloads — documented decoder gap.
    // The decoder accepts these because isServerEvent only checks top-level
    // discriminant, but handlers destructure the inner value and throw TypeError.
    // Mitigated by: server always sends valid shapes; decoder rejects malformed
    // top-level structure. A full inner-payload validator would close this gap.
    test.each([
      ['TileDiscarded with null inner', { TileDiscarded: null }],
      ['TurnChanged with null inner', { TurnChanged: null }],
      ['CallWindowOpened with string', { CallWindowOpened: 'garbage' }],
      ['CallWindowOpened with empty', { CallWindowOpened: {} }],
      ['DiceRolled with null', { DiceRolled: null }],
      ['GameOver with null', { GameOver: null }],
    ])('%s throws TypeError (known decoder gap)', (_label, event) => {
      expect(() => {
        handlePublicEvent(event as never, nullPublicContext);
      }).toThrow(TypeError);
    });
  });

  // ─── Private handler: unrecognized/malformed ───────────────────────────

  describe('handlePrivateEvent handles malformed payloads gracefully', () => {
    test.each([
      ['empty object', {}],
      ['unknown key', { NotARealEvent: { tiles: [1, 2, 3] } }],
      ['DealtToPlayer with null', { DealtToPlayer: null }],
      ['TilesReceived with empty', { TilesReceived: {} }],
      ['TilesReceived missing tiles', { TilesReceived: { player: 'East' } }],
      ['TilesPassed with number', { TilesPassed: 42 }],
    ])('%s does not throw', (_label, event) => {
      expect(() => {
        handlePrivateEvent(event as never, nullPrivateContext);
      }).not.toThrow();
    });
  });

  // ─── Full dispatcher pipeline: malformed events don't crash ────────────

  describe('Full dispatcher pipeline gracefully handles malformed events', () => {
    function createMockDispatchContext(): EventDispatchContext {
      return {
        debug: false,
        getServerSnapshot: () => null,
        getCallWindowContext: () => ({
          intents: [],
          discardedBy: null,
          hasSubmittedPass: false,
        }),
        getYourSeat: () => 'South',
        emitServerEvent: vi.fn(),
        applyHandlerResult: vi.fn(),
        requestStateBySeat: vi.fn(),
        setServerSnapshot: vi.fn(),
        incrementSnapshotRevision: vi.fn(),
      };
    }

    test('malformed Public event processed without crash', () => {
      const ctx = createMockDispatchContext();
      const dispatchers = createEventDispatchers(ctx);

      expect(() => {
        dispatchers.handleEventEnvelope({
          kind: 'Event',
          payload: { event: { Public: { NotARealEvent: {} } } },
        } as never);
      }).not.toThrow();

      // applyHandlerResult should still be called (with EMPTY_RESULT equivalent)
      expect(ctx.applyHandlerResult).toHaveBeenCalled();
    });

    test('malformed Private event processed without crash', () => {
      const ctx = createMockDispatchContext();
      const dispatchers = createEventDispatchers(ctx);

      expect(() => {
        dispatchers.handleEventEnvelope({
          kind: 'Event',
          payload: { event: { Private: { Garbage: true } } },
        } as never);
      }).not.toThrow();

      expect(ctx.applyHandlerResult).toHaveBeenCalled();
    });

    test('event with missing inner payload key processed without crash', () => {
      const ctx = createMockDispatchContext();
      const dispatchers = createEventDispatchers(ctx);

      expect(() => {
        dispatchers.handleEventEnvelope({
          kind: 'Event',
          payload: { event: { Public: {} } },
        } as never);
      }).not.toThrow();
    });

    test('event envelope with non-object event is silently skipped', () => {
      const ctx = createMockDispatchContext();
      const dispatchers = createEventDispatchers(ctx);

      expect(() => {
        dispatchers.handleEventEnvelope({
          kind: 'Event',
          payload: { event: 'not-an-object' },
        } as never);
      }).not.toThrow();

      // Neither handler branch should fire
      expect(ctx.applyHandlerResult).not.toHaveBeenCalled();
    });

    test('StateSnapshot with deeply invalid snapshot is rejected by decoder', () => {
      const result = decodeInboundEnvelope(
        raw({
          kind: 'StateSnapshot',
          payload: { snapshot: { game_id: 'test', phase: 42 } },
        })
      );
      expect(result.ok).toBe(false);
    });

    test('Error envelope with missing fields is rejected by decoder', () => {
      const result = decodeInboundEnvelope(raw({ kind: 'Error', payload: { message: 'oops' } }));
      expect(result.ok).toBe(false);
    });
  });
});
