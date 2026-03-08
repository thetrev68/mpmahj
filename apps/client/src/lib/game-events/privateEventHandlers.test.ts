/**
 * Tests for Private Event Handlers
 *
 * Pure function tests for private event processing logic
 * Validates state updates, UI actions, and side effects
 */

import { describe, test, expect } from 'vitest';
import {
  handleTilesPassed,
  handleTilesReceived,
  handleTileDrawnPrivate,
  handleCourtesyPassProposed,
  handleCourtesyPairReady,
  handleCourtesyPassMismatch,
  handlePrivateEvent,
} from './privateEventHandlers';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

// Mock game state for testing
const mockGameState: GameStateSnapshot = {
  game_id: 'test-game',
  phase: { Charleston: 'FirstRight' },
  current_turn: 'East',
  dealer: 'East',
  round_number: 1,
  turn_number: 1,
  remaining_tiles: 144,
  discard_pile: [],
  players: [
    {
      seat: 'East',
      player_id: 'p1',
      is_bot: false,
      status: 'Active',
      tile_count: 13,
      exposed_melds: [],
    },
    {
      seat: 'South',
      player_id: 'p2',
      is_bot: false,
      status: 'Active',
      tile_count: 13,
      exposed_melds: [],
    },
    {
      seat: 'West',
      player_id: 'p3',
      is_bot: false,
      status: 'Active',
      tile_count: 13,
      exposed_melds: [],
    },
    {
      seat: 'North',
      player_id: 'p4',
      is_bot: false,
      status: 'Active',
      tile_count: 13,
      exposed_melds: [],
    },
  ],
  house_rules: {
    ruleset: {
      card_year: 2025,
      timer_mode: 'Visible',
      blank_exchange_enabled: false,
      call_window_seconds: 5,
      charleston_timer_seconds: 30,
    },
    analysis_enabled: false,
  },
  charleston_state: null,
  your_seat: 'East',
  your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  wall_seed: 0n,
  wall_draw_index: 0,
  wall_break_point: 0,
  wall_tiles_remaining: 152,
};

describe('handleTilesPassed', () => {
  test('removes passed tiles from hand', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, false);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.your_hand).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('marks submitted pass when not already submitted', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, false);

    expect(result.uiActions).toContainEqual({ type: 'SET_HAS_SUBMITTED_PASS', value: true });
  });

  test('does not duplicate submitted pass action when already submitted', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, true);

    const submitActions = result.uiActions.filter((a) => a.type === 'SET_HAS_SUBMITTED_PASS');
    expect(submitActions).toHaveLength(0);
  });

  test('shows auto-pass message when not already submitted', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, false);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'Time expired - auto-passing 3 tiles from hand',
    });
  });

  test('schedules message clear via side effect', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, false);

    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TIMEOUT',
          id: 'bot-pass-message',
          ms: 3000,
        }),
      ])
    );
  });

  test('sets leaving tile IDs and schedules clear', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handleTilesPassed(event, mockGameState, true);

    expect(result.uiActions).toContainEqual({
      type: 'SET_LEAVING_TILE_IDS',
      ids: ['0-0', '1-0', '2-0'],
    });
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TIMEOUT',
          id: 'leaving-tiles',
          ms: 300,
        }),
      ])
    );
  });

  test('handles duplicate tiles correctly', () => {
    const stateWithDuplicates: GameStateSnapshot = {
      ...mockGameState,
      your_hand: [0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    };

    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 0, 1], // Pass 2 of tile 0, 1 of tile 1
      },
    };

    const result = handleTilesPassed(event, stateWithDuplicates, false);

    const updatedState = result.stateUpdates[0](stateWithDuplicates);
    // Should remove 2 instances of 0 and 1 instance of 1
    expect(updatedState?.your_hand).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('handleTilesReceived', () => {
  test('adds received tiles to hand (sorted)', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [36, 0, 18], // Joker, 1 Bam, 1 Dot (adds duplicate 0)
        from: 'South',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    // Original: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    // Received: [36, 0, 18]
    // Sorted:   [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 36]
    expect(updatedState?.your_hand).toContain(36);
    expect(updatedState?.your_hand).toContain(18);
    expect(updatedState?.your_hand.length).toBe(16);
    // Verify sorted order
    expect(updatedState?.your_hand[0]).toBe(0);
    expect(updatedState?.your_hand[1]).toBe(0); // Duplicate 0
    expect(updatedState?.your_hand[14]).toBe(18);
    expect(updatedState?.your_hand[15]).toBe(36);
  });

  test('sets incoming seat indicator when from is provided', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: 'West',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    expect(result.uiActions).toContainEqual({ type: 'SET_INCOMING_FROM_SEAT', seat: 'West' });
  });

  test('schedules incoming seat clear via side effect', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: 'West',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    const incomingSeatTimeouts = result.sideEffects.filter(
      (e) => e.type === 'TIMEOUT' && e.id === 'incoming-seat'
    );
    expect(incomingSeatTimeouts).toHaveLength(1);
    expect(incomingSeatTimeouts[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'incoming-seat',
      ms: 350,
    });
  });

  test('does not set incoming seat when from is null (blind pass)', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: null, // Blind pass - source hidden
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    const incomingSeatActions = result.uiActions.filter((a) => a.type === 'SET_INCOMING_FROM_SEAT');
    expect(incomingSeatActions).toHaveLength(0);
  });

  test('schedules highlight clear via side effect', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: 'South',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    const highlightTimeouts = result.sideEffects.filter(
      (e) => e.type === 'TIMEOUT' && e.id === 'highlight-tiles'
    );
    expect(highlightTimeouts).toHaveLength(1);
    expect(highlightTimeouts[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'highlight-tiles',
      ms: 2000,
    });
  });

  test('returns null state update when gameState is null', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: 'South',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    const updatedState = result.stateUpdates[0](null);
    expect(updatedState).toBeNull();
  });

  test('highlights received tiles using new tile instance IDs', () => {
    const event: PrivateEvent = {
      TilesReceived: {
        player: 'East',
        tiles: [0, 1, 2],
        from: 'South',
      },
    };

    const result = handleTilesReceived(event, mockGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_HIGHLIGHTED_TILE_IDS',
      ids: ['0-1', '1-1', '2-1'],
    });
  });
});

// ============================================================================
// Playing Phase Private Event Handler Tests
// ============================================================================

describe('handleTileDrawnPrivate', () => {
  test('adds tile to hand and updates wall count', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 12,
        remaining_tiles: 94,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);

    expect(result.stateUpdates).toHaveLength(1);
    expect(result.uiActions).toHaveLength(3);
    expect(result.sideEffects).toHaveLength(1);

    // Test state updater
    const mockState = {
      ...mockGameState,
      your_hand: [1, 3, 5],
      wall_tiles_remaining: 95,
    };

    const newState = result.stateUpdates[0](mockState);
    expect(newState?.your_hand).toContain(12);
    expect(newState?.wall_tiles_remaining).toBe(94);
  });

  test('sorts hand after adding tile', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 5,
        remaining_tiles: 90,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);

    const mockState = {
      ...mockGameState,
      your_hand: [1, 10, 15],
      wall_tiles_remaining: 91,
    };

    const newState = result.stateUpdates[0](mockState);
    // sortHand should sort tiles in order
    expect(newState?.your_hand).toEqual([1, 5, 10, 15]);
  });

  test('highlights drawn tile', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 8,
        remaining_tiles: 85,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);

    expect(result.uiActions).toContainEqual({
      type: 'CLEAR_PENDING_DRAW_RETRY',
    });
    expect(result.uiActions).toContainEqual({
      type: 'SET_HIGHLIGHTED_TILE_IDS',
      ids: ['8-1'],
    });
  });

  test('sets timeout to clear highlight', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 10,
        remaining_tiles: 80,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'highlight-drawn-tile',
      ms: 2000,
    });
  });

  test('returns null if prev state is null', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 5,
        remaining_tiles: 90,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);
    const newState = result.stateUpdates[0](null);

    expect(newState).toBeNull();
  });

  test('dispatches SET_STAGED_INCOMING_DRAW_TILE for drawn tile (AC-1)', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 8,
        remaining_tiles: 85,
      },
    };

    const result = handleTileDrawnPrivate(event, mockGameState);

    const stagingAction = result.uiActions.find((a) => a.type === 'SET_STAGED_INCOMING_DRAW_TILE');
    expect(stagingAction).toBeDefined();
    expect(stagingAction).toMatchObject({
      type: 'SET_STAGED_INCOMING_DRAW_TILE',
      tile: 8,
    });
  });

  test('does not dispatch SET_STAGED_INCOMING_DRAW_TILE when gameState is null', () => {
    const event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }> = {
      TileDrawnPrivate: {
        tile: 8,
        remaining_tiles: 85,
      },
    };

    const result = handleTileDrawnPrivate(event, null);

    expect(
      result.uiActions.find((a) => a.type === 'SET_STAGED_INCOMING_DRAW_TILE')
    ).toBeUndefined();
  });
});

// ============================================================================
// US-007: Courtesy Pass Event Handlers
// ============================================================================

describe('handleCourtesyPassProposed', () => {
  test('dispatches SET_COURTESY_PARTNER_PROPOSAL when partner proposes', () => {
    const event: PrivateEvent = {
      CourtesyPassProposed: { player: 'West', tile_count: 2 },
    };

    const result = handleCourtesyPassProposed(event, 'East');

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_PARTNER_PROPOSAL',
      count: 2,
    });
    expect(result.stateUpdates).toHaveLength(0);
    expect(result.sideEffects).toHaveLength(0);
  });

  test('dispatches SET_COURTESY_PARTNER_PROPOSAL when partner proposes 0', () => {
    const event: PrivateEvent = {
      CourtesyPassProposed: { player: 'West', tile_count: 0 },
    };

    const result = handleCourtesyPassProposed(event, 'East');

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_PARTNER_PROPOSAL',
      count: 0,
    });
  });

  test('returns EMPTY_RESULT when proposal is from self (not partner)', () => {
    const event: PrivateEvent = {
      CourtesyPassProposed: { player: 'East', tile_count: 2 },
    };

    const result = handleCourtesyPassProposed(event, 'East');

    expect(result.uiActions).toHaveLength(0);
  });
});

describe('handleCourtesyPairReady', () => {
  test('dispatches SET_COURTESY_AGREEMENT when agreed count > 0', () => {
    const event: PrivateEvent = {
      CourtesyPairReady: { pair: ['East', 'West'], tile_count: 2 },
    };

    const result = handleCourtesyPairReady(event);

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_AGREEMENT',
      count: 2,
    });
  });

  test('dispatches SET_COURTESY_ZERO when agreed count is 0', () => {
    const event: PrivateEvent = {
      CourtesyPairReady: { pair: ['East', 'West'], tile_count: 0 },
    };

    const result = handleCourtesyPairReady(event);

    expect(result.uiActions).toContainEqual({ type: 'SET_COURTESY_ZERO' });
  });

  test('dispatches SET_COURTESY_ZERO for South-North pair when count is 0', () => {
    const event: PrivateEvent = {
      CourtesyPairReady: { pair: ['South', 'North'], tile_count: 0 },
    };

    const result = handleCourtesyPairReady(event);

    expect(result.uiActions).toContainEqual({ type: 'SET_COURTESY_ZERO' });
  });

  test('returns no state updates (UI-only action)', () => {
    const event: PrivateEvent = {
      CourtesyPairReady: { pair: ['East', 'West'], tile_count: 1 },
    };

    const result = handleCourtesyPairReady(event);

    expect(result.stateUpdates).toHaveLength(0);
    expect(result.sideEffects).toHaveLength(0);
  });
});

describe('handleCourtesyPassMismatch', () => {
  test('dispatches SET_COURTESY_MISMATCH with correct proposals when agreed_count > 0', () => {
    const event: PrivateEvent = {
      CourtesyPassMismatch: {
        pair: ['East', 'West'],
        proposed: [3, 1],
        agreed_count: 1,
      },
    };

    // East is pair[0], so East proposed 3, West proposed 1
    const result = handleCourtesyPassMismatch(event, 'East');

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_MISMATCH',
      partnerProposal: 1,
      agreedCount: 1,
    });
  });

  test('dispatches SET_COURTESY_MISMATCH from partner perspective (pair[1])', () => {
    const event: PrivateEvent = {
      CourtesyPassMismatch: {
        pair: ['East', 'West'],
        proposed: [3, 1],
        agreed_count: 1,
      },
    };

    // West is pair[1], so West proposed 1, East proposed 3
    const result = handleCourtesyPassMismatch(event, 'West');

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_MISMATCH',
      partnerProposal: 3,
      agreedCount: 1,
    });
  });

  test('dispatches SET_COURTESY_ZERO when agreed_count is 0 due to mismatch', () => {
    const event: PrivateEvent = {
      CourtesyPassMismatch: {
        pair: ['South', 'North'],
        proposed: [0, 2],
        agreed_count: 0,
      },
    };

    const result = handleCourtesyPassMismatch(event, 'South');

    expect(result.uiActions).toContainEqual({ type: 'SET_COURTESY_ZERO' });
  });

  test('returns no state updates (UI-only action)', () => {
    const event: PrivateEvent = {
      CourtesyPassMismatch: {
        pair: ['East', 'West'],
        proposed: [2, 1],
        agreed_count: 1,
      },
    };

    const result = handleCourtesyPassMismatch(event, 'East');

    expect(result.stateUpdates).toHaveLength(0);
    expect(result.sideEffects).toHaveLength(0);
  });
});

describe('handlePrivateEvent IncomingTilesStaged routing', () => {
  test('routes IncomingTilesStaged through private handler and does not mutate your_hand', () => {
    const event: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'East',
        tiles: [20, 21, 22],
        from: 'South',
        context: 'Charleston',
      },
    };

    const result = handlePrivateEvent(event, {
      gameState: mockGameState,
      hasSubmittedPass: false,
      yourSeat: 'East',
    });

    expect(result.uiActions).toContainEqual({
      type: 'SET_STAGED_INCOMING',
      payload: {
        tiles: [20, 21, 22],
        from: 'South',
        context: 'Charleston',
      },
    });
    expect(result.uiActions).toContainEqual({ type: 'SET_INCOMING_FROM_SEAT', seat: 'South' });
    expect(result.stateUpdates).toHaveLength(0);
  });

  test('handles IncomingTilesStaged with null from seat (blind/private source hidden)', () => {
    const event: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'East',
        tiles: [20, 21, 22],
        from: null,
        context: 'Charleston',
      },
    };

    const result = handlePrivateEvent(event, {
      gameState: mockGameState,
      hasSubmittedPass: false,
      yourSeat: 'East',
    });

    expect(result.uiActions).toContainEqual({
      type: 'SET_STAGED_INCOMING',
      payload: {
        tiles: [20, 21, 22],
        from: null,
        context: 'Charleston',
      },
    });
    expect(result.uiActions.filter((a) => a.type === 'SET_INCOMING_FROM_SEAT')).toHaveLength(0);
    expect(result.stateUpdates).toHaveLength(0);
  });

  test('keeps existing TilesPassed private event behavior functional', () => {
    const event: PrivateEvent = {
      TilesPassed: {
        player: 'East',
        tiles: [0, 1, 2],
      },
    };

    const result = handlePrivateEvent(event, {
      gameState: mockGameState,
      hasSubmittedPass: false,
      yourSeat: 'East',
    });
    const updatedState = result.stateUpdates[0](mockGameState);

    expect(updatedState?.your_hand).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  test('keeps existing courtesy private event behavior functional', () => {
    const event: PrivateEvent = {
      CourtesyPassProposed: { player: 'West', tile_count: 2 },
    };

    const result = handlePrivateEvent(event, {
      gameState: mockGameState,
      hasSubmittedPass: false,
      yourSeat: 'East',
    });

    expect(result.uiActions).toContainEqual({
      type: 'SET_COURTESY_PARTNER_PROPOSAL',
      count: 2,
    });
  });
});
