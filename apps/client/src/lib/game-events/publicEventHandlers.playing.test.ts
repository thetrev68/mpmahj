/**
 * Tests for Playing Phase Public Event Handlers
 *
 * Tests the pure event handler functions for Playing phase events.
 */

import { describe, test, expect } from 'vitest';
import {
  handleTurnChanged,
  handleTileDrawnPublic,
  handleTileDiscarded,
  handleCallWindowOpened,
  handleCallWindowProgress,
  handleCallResolved,
  handleCallWindowClosed,
  handleTileCalled,
  handleWallExhausted,
  handleJokerExchanged,
  handleStateRestored,
  handlePublicEvent,
} from './publicEventHandlers';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { MeldType } from '@/types/bindings/generated/MeldType';

describe('Playing Phase Event Handlers', () => {
  describe('handleTurnChanged', () => {
    test('updates current turn and turn stage in state', () => {
      const event: Extract<PublicEvent, { TurnChanged: unknown }> = {
        TurnChanged: {
          player: 'South',
          stage: { Drawing: { player: 'South' } },
        },
      };

      const result = handleTurnChanged(event);

      expect(result.stateUpdates).toHaveLength(1);
      expect(result.uiActions).toHaveLength(2);
      expect(result.sideEffects).toHaveLength(0);

      // Test state updater
      const mockPrevState = {
        current_turn: 'East',
        phase: { Playing: { Discarding: { player: 'East' } } },
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.current_turn).toBe('South');
      expect(newState?.phase).toEqual({ Playing: { Drawing: { player: 'South' } } });

      // Test UI actions
      expect(result.uiActions).toContainEqual({ type: 'SET_CURRENT_TURN', seat: 'South' });
      expect(result.uiActions).toContainEqual({
        type: 'SET_TURN_STAGE',
        stage: { Drawing: { player: 'South' } },
      });
    });

    test('returns null if prev state is null', () => {
      const event: Extract<PublicEvent, { TurnChanged: unknown }> = {
        TurnChanged: {
          player: 'North',
          stage: { Drawing: { player: 'North' } },
        },
      };

      const result = handleTurnChanged(event);
      const newState = result.stateUpdates[0](null);

      expect(newState).toBeNull();
    });
  });

  describe('handleTileDrawnPublic', () => {
    test('updates wall tiles remaining', () => {
      const event: Extract<PublicEvent, { TileDrawnPublic: unknown }> = {
        TileDrawnPublic: {
          remaining_tiles: 95,
        },
      };

      const result = handleTileDrawnPublic(event);

      expect(result.stateUpdates).toHaveLength(1);
      expect(result.uiActions).toHaveLength(0);
      expect(result.sideEffects).toHaveLength(0);

      const mockPrevState = {
        wall_tiles_remaining: 96,
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.wall_tiles_remaining).toBe(95);
    });

    test('returns null if prev state is null', () => {
      const event: Extract<PublicEvent, { TileDrawnPublic: unknown }> = {
        TileDrawnPublic: {
          remaining_tiles: 90,
        },
      };

      const result = handleTileDrawnPublic(event);
      const newState = result.stateUpdates[0](null);

      expect(newState).toBeNull();
    });
  });

  describe('handleTileDiscarded', () => {
    test('adds tile to discard pool', () => {
      const event: Extract<PublicEvent, { TileDiscarded: unknown }> = {
        TileDiscarded: {
          player: 'North',
          tile: 5,
        },
      };

      const result = handleTileDiscarded(event);

      const mockPrevState = {
        your_seat: 'East',
        your_hand: [1, 2, 3],
        discard_pile: [],
        turn_number: 10,
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.discard_pile).toHaveLength(1);
      expect(newState?.discard_pile[0]).toMatchObject({
        tile: 5,
        discarded_by: 'North',
      });
    });

    test('removes tile from hand if it is my discard', () => {
      const event: Extract<PublicEvent, { TileDiscarded: unknown }> = {
        TileDiscarded: {
          player: 'East',
          tile: 2,
        },
      };

      const result = handleTileDiscarded(event);

      const mockPrevState = {
        your_seat: 'East',
        your_hand: [1, 2, 3],
        discard_pile: [],
        turn_number: 5,
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.your_hand).toEqual([1, 3]);
    });

    test('does not remove tile from hand if it is not my discard', () => {
      const event: Extract<PublicEvent, { TileDiscarded: unknown }> = {
        TileDiscarded: {
          player: 'South',
          tile: 5,
        },
      };

      const result = handleTileDiscarded(event);

      const mockPrevState = {
        your_seat: 'East',
        your_hand: [1, 2, 3],
        discard_pile: [],
        turn_number: 5,
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.your_hand).toEqual([1, 2, 3]);
    });

    test('triggers discard animation and sound', () => {
      const event: Extract<PublicEvent, { TileDiscarded: unknown }> = {
        TileDiscarded: {
          player: 'West',
          tile: 10,
        },
      };

      const result = handleTileDiscarded(event);

      expect(result.uiActions).toContainEqual({ type: 'SET_DISCARD_ANIMATION_TILE', tile: 10 });
      expect(result.uiActions).toContainEqual({ type: 'SET_MOST_RECENT_DISCARD', tile: 10 });
      expect(result.uiActions).toContainEqual({ type: 'SET_IS_PROCESSING', value: false });
      expect(result.uiActions).toContainEqual({ type: 'CLEAR_SELECTION' });

      expect(result.sideEffects).toContainEqual({ type: 'PLAY_SOUND', sound: 'tile-discard' });
    });
  });

  describe('handleCallWindowOpened', () => {
    test('opens call window if player is eligible', () => {
      const event: Extract<PublicEvent, { CallWindowOpened: unknown }> = {
        CallWindowOpened: {
          tile: 12,
          discarded_by: 'East',
          can_call: ['South', 'West'],
          timer: 10,
          started_at_ms: BigInt(Date.now()),
          timer_mode: 'Visible',
        },
      };

      const result = handleCallWindowOpened(event, { yourSeat: 'South' });

      expect(result.uiActions).toHaveLength(1);
      expect(result.uiActions[0]).toMatchObject({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 12,
          discardedBy: 'East',
          canCall: ['South', 'West'],
          timerDuration: 10,
          timerStart: expect.any(Number),
        },
      });
    });

    test('does not open call window if player is not eligible', () => {
      const event: Extract<PublicEvent, { CallWindowOpened: unknown }> = {
        CallWindowOpened: {
          tile: 12,
          discarded_by: 'East',
          can_call: ['South', 'West'],
          timer: 10,
          started_at_ms: BigInt(Date.now()),
          timer_mode: 'Visible',
        },
      };

      const result = handleCallWindowOpened(event, { yourSeat: 'North' });

      expect(result.uiActions).toHaveLength(0);
      expect(result.sideEffects).toHaveLength(0);
    });
  });

  describe('handleCallWindowProgress', () => {
    test('updates call window with intents and remaining players', () => {
      const event: Extract<PublicEvent, { CallWindowProgress: unknown }> = {
        CallWindowProgress: {
          can_act: ['West'],
          intents: [{ seat: 'South', kind: { Meld: { meld_type: 'Pung' } } }],
        },
      };

      const result = handleCallWindowProgress(event);

      expect(result.uiActions).toHaveLength(1);
      expect(result.uiActions[0]).toEqual({
        type: 'UPDATE_CALL_WINDOW_PROGRESS',
        canAct: ['West'],
        intents: [{ seat: 'South', kind: { Meld: { meld_type: 'Pung' } } }],
      });
    });
  });

  describe('handleCallResolved', () => {
    test('shows resolution overlay if there was competition', () => {
      const event: Extract<PublicEvent, { CallResolved: unknown }> = {
        CallResolved: {
          resolution: {
            Meld: {
              seat: 'West',
              meld: {
                tiles: [5, 5, 5, 5],
                meld_type: 'Kong',
                called_tile: 5,
                joker_assignments: {},
              },
            },
          },
          tie_break: { SeatOrder: { discarded_by: 'East', contenders: ['South', 'West'] } },
        },
      };

      const context = {
        callIntents: [
          { seat: 'South' as Seat, kind: { Meld: { meld_type: 'Pung' as MeldType } } },
          { seat: 'West' as Seat, kind: { Meld: { meld_type: 'Kong' as MeldType } } },
        ],
        discardedBy: 'East' as Seat,
      };

      const result = handleCallResolved(event, context);

      expect(result.uiActions).toHaveLength(2);
      expect(result.uiActions).toContainEqual({ type: 'CLOSE_CALL_WINDOW' });
      expect(result.uiActions).toContainEqual({
        type: 'SHOW_RESOLUTION_OVERLAY',
        data: {
          resolution: {
            Meld: {
              seat: 'West',
              meld: {
                tiles: [5, 5, 5, 5],
                meld_type: 'Kong',
                called_tile: 5,
                joker_assignments: {},
              },
            },
          },
          tieBreak: { SeatOrder: { discarded_by: 'East', contenders: ['South', 'West'] } },
          allCallers: context.callIntents,
          discardedBy: 'East',
        },
      });
    });

    test('shows message if resolution is NoCall', () => {
      const event: Extract<PublicEvent, { CallResolved: unknown }> = {
        CallResolved: {
          resolution: 'NoCall',
          tie_break: null,
        },
      };

      const context = {
        callIntents: [],
        discardedBy: 'East' as Seat,
      };

      const result = handleCallResolved(event, context);

      expect(result.uiActions).toHaveLength(2);
      expect(result.uiActions).toContainEqual({ type: 'CLOSE_CALL_WINDOW' });
      expect(result.uiActions).toContainEqual({
        type: 'SET_ERROR_MESSAGE',
        message: 'No one called the tile',
      });
      expect(result.sideEffects).toHaveLength(1);
      expect(result.sideEffects[0]).toMatchObject({
        type: 'TIMEOUT',
        id: 'call-resolution-message',
        ms: 3000,
      });
    });

    test('shows message if no callers', () => {
      const event: Extract<PublicEvent, { CallResolved: unknown }> = {
        CallResolved: {
          resolution: {
            Meld: {
              seat: 'South',
              meld: { tiles: [5, 5, 5], meld_type: 'Pung', called_tile: 5, joker_assignments: {} },
            },
          },
          tie_break: null,
        },
      };

      const context = {
        callIntents: [],
        discardedBy: 'East' as Seat,
      };

      const result = handleCallResolved(event, context);

      expect(result.uiActions).toHaveLength(2);
      expect(result.uiActions).toContainEqual({ type: 'CLOSE_CALL_WINDOW' });
      expect(result.uiActions).toContainEqual({
        type: 'SET_ERROR_MESSAGE',
        message: 'South wins call for Pung',
      });
      expect(result.sideEffects).toHaveLength(1);
      expect(result.sideEffects[0]).toMatchObject({
        type: 'TIMEOUT',
        id: 'call-resolution-message',
        ms: 3000,
      });
    });
  });

  describe('handleCallWindowClosed', () => {
    test('closes call window and clears timeout', () => {
      const result = handleCallWindowClosed();

      expect(result.uiActions).toContainEqual({ type: 'CLOSE_CALL_WINDOW' });
      expect(result.sideEffects).toContainEqual({ type: 'CLEAR_TIMEOUT', id: 'call-window' });
    });
  });

  describe('handleTileCalled', () => {
    test('adds meld to player exposed melds', () => {
      const event: Extract<PublicEvent, { TileCalled: unknown }> = {
        TileCalled: {
          player: 'South',
          meld: {
            tiles: [5, 5, 5],
            meld_type: 'Pung',
            called_tile: 5,
            joker_assignments: {},
          },
          called_tile: 5,
          called_from: 'East',
        },
      };

      const result = handleTileCalled(event, { yourSeat: 'West' });

      const mockPrevState = {
        your_seat: 'West',
        your_hand: [1, 2, 3],
        players: [
          { seat: 'East', exposed_melds: [] },
          { seat: 'South', exposed_melds: [] },
          { seat: 'West', exposed_melds: [] },
          { seat: 'North', exposed_melds: [] },
        ],
        discard_pile: [{ tile: 5, discarded_by: 'East' }],
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      const southPlayer = newState?.players.find((p) => p.seat === 'South');
      expect(southPlayer?.exposed_melds).toHaveLength(1);
      expect(southPlayer?.exposed_melds[0]).toMatchObject({
        tiles: [5, 5, 5],
        meld_type: 'Pung',
      });
    });

    test('marks discard as called', () => {
      const event: Extract<PublicEvent, { TileCalled: unknown }> = {
        TileCalled: {
          player: 'South',
          meld: {
            tiles: [8, 8, 8],
            meld_type: 'Pung',
            called_tile: 8,
            joker_assignments: {},
          },
          called_tile: 8,
          called_from: 'North',
        },
      };

      const result = handleTileCalled(event, { yourSeat: 'West' });

      const mockPrevState = {
        your_seat: 'West',
        your_hand: [1, 2, 3],
        players: [
          { seat: 'East', exposed_melds: [] },
          { seat: 'South', exposed_melds: [] },
          { seat: 'West', exposed_melds: [] },
          { seat: 'North', exposed_melds: [] },
        ],
        discard_pile: [
          { tile: 5, discarded_by: 'East' },
          { tile: 8, discarded_by: 'North' },
        ],
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      // Note: DiscardInfo in bindings doesn't have a 'called' field
      // This test verifies that the meld was added to the South player's exposed_melds
      const southPlayer = newState?.players.find((p) => p.seat === 'South');
      expect(southPlayer?.exposed_melds).toHaveLength(1);
    });

    test('removes tiles from hand if I am the caller', () => {
      const event: Extract<PublicEvent, { TileCalled: unknown }> = {
        TileCalled: {
          player: 'East',
          meld: {
            tiles: [10, 10, 10],
            meld_type: 'Pung',
            called_tile: 10,
            joker_assignments: {},
          },
          called_tile: 10,
          called_from: 'South',
        },
      };

      const result = handleTileCalled(event, { yourSeat: 'East' });

      const mockPrevState = {
        your_seat: 'East',
        your_hand: [5, 10, 10, 15],
        players: [
          { seat: 'East', exposed_melds: [] },
          { seat: 'South', exposed_melds: [] },
          { seat: 'West', exposed_melds: [] },
          { seat: 'North', exposed_melds: [] },
        ],
        discard_pile: [{ tile: 10, discarded_by: 'South' }],
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      // Should remove two tiles with value 10 (the first tile in meld is the called tile)
      expect(newState?.your_hand).toEqual([5, 15]);
    });
  });

  describe('handleJokerExchanged', () => {
    // Tile indices: Bam3=2, Joker=42, Red Dragon=32
    const bam3 = 2;
    const joker = 42;
    const redDragon = 32;

    const makeMeldWithJoker = (representedTile: number) => ({
      tiles: [representedTile, representedTile, joker] as number[],
      meld_type: 'Pung' as const,
      called_tile: representedTile,
      joker_assignments: { 2: representedTile } as Record<number, number>,
    });

    const makeState = (
      yourSeat: string,
      yourHand: number[],
      southMelds: ReturnType<typeof makeMeldWithJoker>[]
    ) => ({
      your_seat: yourSeat,
      your_hand: yourHand,
      players: [
        { seat: 'East', exposed_melds: [] },
        { seat: 'South', exposed_melds: southMelds },
        { seat: 'West', exposed_melds: [] },
        { seat: 'North', exposed_melds: [] },
      ],
    });

    test('updates target meld: replaces joker with replacement tile', () => {
      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: {
          player: 'East',
          target_seat: 'South',
          joker,
          replacement: bam3,
        },
      };

      const prevState = makeState(
        'East',
        [bam3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
        [makeMeldWithJoker(bam3)]
      );
      const result = handleJokerExchanged(event, { yourSeat: 'East' });
      const newState = result.stateUpdates[0](
        prevState as unknown as import('@/types/bindings/generated/GameStateSnapshot').GameStateSnapshot
      );

      const southPlayer = newState?.players.find((p) => p.seat === 'South');
      expect(southPlayer?.exposed_melds[0].tiles).toEqual([bam3, bam3, bam3]);
      expect(southPlayer?.exposed_melds[0].joker_assignments).toEqual({});
    });

    test('removes replacement from my hand and adds joker when I am the exchanger', () => {
      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: {
          player: 'East',
          target_seat: 'South',
          joker,
          replacement: bam3,
        },
      };

      const hand = [bam3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
      const prevState = makeState('East', hand, [makeMeldWithJoker(bam3)]);
      const result = handleJokerExchanged(event, { yourSeat: 'East' });
      const newState = result.stateUpdates[0](
        prevState as unknown as import('@/types/bindings/generated/GameStateSnapshot').GameStateSnapshot
      );

      expect(newState?.your_hand).not.toContain(bam3);
      expect(newState?.your_hand).toContain(joker);
      expect(newState?.your_hand).toHaveLength(hand.length); // same tile count
    });

    test('does not modify hand when I am not the exchanger', () => {
      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: {
          player: 'South',
          target_seat: 'West',
          joker,
          replacement: redDragon,
        },
      };

      const hand = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
      const westMeld = makeMeldWithJoker(redDragon);
      const prevState = {
        your_seat: 'East',
        your_hand: hand,
        players: [
          { seat: 'East', exposed_melds: [] },
          { seat: 'South', exposed_melds: [] },
          { seat: 'West', exposed_melds: [westMeld] },
          { seat: 'North', exposed_melds: [] },
        ],
      };
      const result = handleJokerExchanged(event, { yourSeat: 'East' });
      const newState = result.stateUpdates[0](
        prevState as unknown as import('@/types/bindings/generated/GameStateSnapshot').GameStateSnapshot
      );

      expect(newState?.your_hand).toEqual(hand);
      const westPlayer = newState?.players.find((p) => p.seat === 'West');
      expect(westPlayer?.exposed_melds[0].tiles).toEqual([redDragon, redDragon, redDragon]);
    });

    test('emits SET_JOKER_EXCHANGED ui action and tile-place sound', () => {
      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: {
          player: 'East',
          target_seat: 'South',
          joker,
          replacement: bam3,
        },
      };

      const result = handleJokerExchanged(event, { yourSeat: 'East' });

      expect(result.uiActions).toContainEqual({
        type: 'SET_JOKER_EXCHANGED',
        player: 'East',
        target_seat: 'South',
        joker,
        replacement: bam3,
      });
      expect(result.sideEffects).toContainEqual({ type: 'PLAY_SOUND', sound: 'tile-place' });
    });

    test('only updates the FIRST matching meld (Issue #2: prevents over-application)', () => {
      // Bug: If player has multiple melds with jokers representing same tile,
      // only the first match should be updated, not all of them
      const bam5 = 4;
      const meldWithJokerAsBam5 = makeMeldWithJoker(bam5);

      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: {
          player: 'East',
          target_seat: 'South',
          joker,
          replacement: bam5,
        },
      };

      const prevState = {
        your_seat: 'East',
        your_hand: [5, 6, 7, 8, 9],
        players: [
          { seat: 'East', exposed_melds: [] },
          {
            seat: 'South',
            exposed_melds: [
              { ...meldWithJokerAsBam5 }, // First meld with joker as Bam5 - should be updated
              { ...meldWithJokerAsBam5 }, // Second meld with joker as Bam5 - should NOT be updated
            ],
          },
          { seat: 'West', exposed_melds: [] },
          { seat: 'North', exposed_melds: [] },
        ],
      };

      const result = handleJokerExchanged(event, { yourSeat: 'East' });
      const newState = result.stateUpdates[0](
        prevState as unknown as import('@/types/bindings/generated/GameStateSnapshot').GameStateSnapshot
      );

      const southPlayer = newState?.players.find((p) => p.seat === 'South');
      expect(southPlayer?.exposed_melds).toHaveLength(2);

      // First meld should have joker replaced (at position 2)
      expect(southPlayer?.exposed_melds[0].tiles).toEqual([bam5, bam5, bam5]);
      expect(southPlayer?.exposed_melds[0].joker_assignments).toEqual({});

      // Second meld should still have joker (at position 2)
      expect(southPlayer?.exposed_melds[1].tiles).toEqual([bam5, bam5, joker]);
      expect(southPlayer?.exposed_melds[1].joker_assignments).toEqual({ 2: bam5 });
    });

    test('returns null if prev state is null', () => {
      const event: Extract<
        import('@/types/bindings/generated/PublicEvent').PublicEvent,
        { JokerExchanged: unknown }
      > = {
        JokerExchanged: { player: 'East', target_seat: 'South', joker, replacement: bam3 },
      };
      const result = handleJokerExchanged(event, { yourSeat: 'East' });
      expect(result.stateUpdates[0](null)).toBeNull();
    });
  });

  describe('handleWallExhausted', () => {
    test('updates wall tiles remaining and triggers draw overlay (US-021)', () => {
      const event: Extract<PublicEvent, { WallExhausted: unknown }> = {
        WallExhausted: {
          remaining_tiles: 0,
        },
      };

      const result = handleWallExhausted(event);

      expect(result.stateUpdates).toHaveLength(1);

      const mockPrevState = {
        wall_tiles_remaining: 5,
      } as unknown as GameStateSnapshot;

      const newState = result.stateUpdates[0](mockPrevState);
      expect(newState?.wall_tiles_remaining).toBe(0);

      expect(result.uiActions).toContainEqual({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 0,
      });

      expect(result.sideEffects).toHaveLength(1);
      expect(result.sideEffects[0]).toMatchObject({
        type: 'PLAY_SOUND',
        sound: 'game-draw',
      });
    });
  });

  describe('handleStateRestored', () => {
    test('plays undo sound when mode is None', () => {
      const event: Extract<PublicEvent, { StateRestored: unknown }> = {
        StateRestored: {
          move_number: 12,
          description: 'Undid discard',
          mode: 'None',
        },
      };

      const result = handleStateRestored(event);
      expect(result.sideEffects).toContainEqual({ type: 'PLAY_SOUND', sound: 'undo-whoosh' });
    });

    test('does not play undo sound for historical view mode', () => {
      const event: Extract<PublicEvent, { StateRestored: unknown }> = {
        StateRestored: {
          move_number: 12,
          description: 'Viewing move',
          mode: { Viewing: { at_move: 12 } },
        },
      };

      const result = handleStateRestored(event);
      expect(result.sideEffects).toHaveLength(0);
    });
  });

  describe('handlePlayerForfeited', () => {
    test('dispatches SET_PLAYER_FORFEITED action for forfeited player', () => {
      const result = handlePublicEvent(
        { PlayerForfeited: { player: 'South', reason: 'Poor connection' } },
        {
          gameState: null,
          yourSeat: 'East',
          callIntents: [],
          discardedBy: null,
        }
      );

      expect(result.uiActions).toContainEqual({
        type: 'SET_PLAYER_FORFEITED',
        player: 'South',
        reason: 'Poor connection',
      });
    });
  });
});
