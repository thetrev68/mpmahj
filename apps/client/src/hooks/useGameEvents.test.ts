/**
 * Tests for useGameEvents Hook
 *
 * Tests the event bridge hook using React Testing Library's renderHook.
 * Verifies WebSocket integration, event routing, and state management.
 *
 * Phase 5 of FRONTEND_REFACTOR_IMPLEMENTATION_PLAN.md
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameEvents } from './useGameEvents';
import type { InboundEnvelope, OutboundEnvelope } from './useGameSocket';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useGameUIStore } from '@/stores/gameUIStore';

describe('useGameEvents', () => {
  type SendFn = (envelope: OutboundEnvelope) => void;
  type SubscribeFn = (kind: string, listener: (envelope: InboundEnvelope) => void) => () => void;

  let mockSocket: {
    send: ReturnType<typeof vi.fn<SendFn>>;
    subscribe: ReturnType<typeof vi.fn<SubscribeFn>>;
  };
  let mockSubscribers: Map<string, Set<(envelope: InboundEnvelope) => void>>;
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSubscribers = new Map();
    useGameUIStore.getState().reset();

    // Create mock socket with subscribe/send
    mockSocket = {
      send: vi.fn<SendFn>(),
      subscribe: vi.fn<SubscribeFn>((kind, listener) => {
        if (!mockSubscribers.has(kind)) {
          mockSubscribers.set(kind, new Set());
        }
        mockSubscribers.get(kind)?.add(listener);

        // Return unsubscribe function
        return () => {
          mockSubscribers.get(kind)?.delete(listener);
        };
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: Emit an envelope to all subscribers
   */
  function emitEnvelope(envelope: InboundEnvelope) {
    const listeners = mockSubscribers.get(envelope.kind);
    if (listeners) {
      listeners.forEach((listener) => listener(envelope));
    }
  }

  describe('initialization', () => {
    test('initializes with null gameState when no initialState provided', () => {
      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      expect(result.current.gameState).toBeNull();
    });

    test('initializes with provided initialState', () => {
      const initialState: GameStateSnapshot = {
        game_id: 'test-game',
        phase: { Setup: 'RollingDice' },
        current_turn: 'East',
        dealer: 'East',
        round_number: 1,
        turn_number: 1,
        your_seat: 'East',
        your_hand: [0, 1, 2],
        house_rules: {
          ruleset: {
            card_year: 2025,
            timer_mode: 'Visible',
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 30,
          },
          analysis_enabled: false,
          concealed_bonus_enabled: false,
          dealer_bonus_enabled: false,
        },
        charleston_state: null,
        players: [
          {
            seat: 'East',
            player_id: 'p1',
            is_bot: false,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
        ],
        remaining_tiles: 139,
        wall_seed: BigInt(0),
        wall_draw_index: 0,
        wall_break_point: 0,
        wall_tiles_remaining: 88,
        discard_pile: [],
      };

      const { result } = renderHook(() =>
        useGameEvents({
          socket: mockSocket,
          initialState,
        })
      );

      expect(result.current.gameState).toEqual(initialState);
    });

    test('subscribes to Event and StateSnapshot envelopes', () => {
      renderHook(() => useGameEvents({ socket: mockSocket }));

      expect(mockSocket.subscribe).toHaveBeenCalledWith('Event', expect.any(Function));
      expect(mockSocket.subscribe).toHaveBeenCalledWith('StateSnapshot', expect.any(Function));
      expect(mockSocket.subscribe).toHaveBeenCalledWith('Error', expect.any(Function));
    });

    test('creates side effect manager', () => {
      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      expect(result.current.sideEffectManager).toBeDefined();
    });
  });

  describe('StateSnapshot handling', () => {
    test('updates gameState when StateSnapshot envelope received', () => {
      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      const snapshot: GameStateSnapshot = {
        game_id: 'test-game',
        phase: { Charleston: 'FirstRight' },
        current_turn: 'South',
        dealer: 'East',
        round_number: 1,
        turn_number: 5,
        your_seat: 'East',
        your_hand: [5, 6, 7, 8],
        house_rules: {
          ruleset: {
            card_year: 2025,
            timer_mode: 'Visible',
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 30,
          },
          analysis_enabled: false,
          concealed_bonus_enabled: false,
          dealer_bonus_enabled: false,
        },
        charleston_state: null,
        players: [],
        remaining_tiles: 100,
        wall_seed: BigInt(0),
        wall_draw_index: 10,
        wall_break_point: 5,
        wall_tiles_remaining: 80,
        discard_pile: [],
      };

      act(() => {
        emitEnvelope({ kind: 'StateSnapshot', payload: { snapshot } });
      });

      expect(result.current.gameState).toEqual(snapshot);
    });
  });

  describe('Event handling', () => {
    test('handles Public events and dispatches UI actions', () => {
      renderHook(() => useGameEvents({ socket: mockSocket }));

      const publicEvent: PublicEvent = {
        DiceRolled: { roll: 7 },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      // Should dispatch UI actions from handler
      expect(useGameUIStore.getState().diceRoll).toBe(7);
      expect(useGameUIStore.getState().showDiceOverlay).toBe(true);
    });

    test('handles Public events and updates game state', () => {
      const initialState: GameStateSnapshot = {
        game_id: 'test-game',
        phase: { Setup: 'RollingDice' },
        current_turn: 'East',
        dealer: 'East',
        round_number: 1,
        turn_number: 1,
        your_seat: 'East',
        your_hand: [],
        house_rules: {
          ruleset: {
            card_year: 2025,
            timer_mode: 'Visible',
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 30,
          },
          analysis_enabled: false,
          concealed_bonus_enabled: false,
          dealer_bonus_enabled: false,
        },
        charleston_state: null,
        players: [],
        remaining_tiles: 152,
        wall_seed: BigInt(0),
        wall_draw_index: 0,
        wall_break_point: 0,
        wall_tiles_remaining: 88,
        discard_pile: [],
      };

      const { result } = renderHook(() =>
        useGameEvents({
          socket: mockSocket,
          initialState,
        })
      );

      const publicEvent: PublicEvent = {
        DiceRolled: { roll: 7 },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      // State should be updated to BreakingWall phase
      expect(result.current.gameState?.phase).toEqual({ Setup: 'BreakingWall' });
    });

    test('handles Private events', () => {
      const initialState: GameStateSnapshot = {
        game_id: 'test-game',
        phase: { Charleston: 'FirstRight' },
        current_turn: 'East',
        dealer: 'East',
        round_number: 1,
        turn_number: 1,
        your_seat: 'East',
        your_hand: [0, 1, 2, 3, 4, 5],
        house_rules: {
          ruleset: {
            card_year: 2025,
            timer_mode: 'Visible',
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 30,
          },
          analysis_enabled: false,
          concealed_bonus_enabled: false,
          dealer_bonus_enabled: false,
        },
        charleston_state: null,
        players: [],
        remaining_tiles: 150,
        wall_seed: BigInt(0),
        wall_draw_index: 0,
        wall_break_point: 0,
        wall_tiles_remaining: 88,
        discard_pile: [],
      };

      const { result } = renderHook(() =>
        useGameEvents({
          socket: mockSocket,
          initialState,
        })
      );

      const privateEvent: PrivateEvent = {
        TilesReceived: { player: 'East', tiles: [10, 11, 12], from: 'West' },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Private: privateEvent } } });
      });

      // Hand should include received tiles
      expect(result.current.gameState?.your_hand).toContain(10);
      expect(result.current.gameState?.your_hand).toContain(11);
      expect(result.current.gameState?.your_hand).toContain(12);
    });

    test('handles CharlestonPhaseChanged event and resets state', () => {
      renderHook(() => useGameEvents({ socket: mockSocket }));

      const publicEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: 'SecondLeft' },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      // Should dispatch Charleston reset actions
      expect(useGameUIStore.getState().readyPlayers).toEqual([]);
      expect(useGameUIStore.getState().clearSelectionSignal).toBe(1);
    });
  });

  describe('Error handling', () => {
    test('dispatches error message UI action on Error envelope', () => {
      renderHook(() => useGameEvents({ socket: mockSocket }));

      act(() => {
        emitEnvelope({
          kind: 'Error',
          payload: {
            code: 'INVALID_COMMAND',
            message: 'Invalid game command',
          },
        });
      });

      expect(useGameUIStore.getState().errorMessage).toBe('Invalid game command');
    });
  });

  describe('sendCommand', () => {
    test('wraps command in Command envelope and sends via socket', () => {
      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      const command: GameCommand = {
        CommitCharlestonPass: {
          player: 'East',
          from_hand: [0, 1, 2],
          forward_incoming_count: 0,
        },
      };

      act(() => {
        result.current.sendCommand(command);
      });

      expect(mockSocket.send).toHaveBeenCalledWith({
        kind: 'Command',
        payload: { command },
      });
    });
  });

  describe('cleanup', () => {
    test('unsubscribes from all envelopes on unmount', () => {
      const unsubscribeEvent = vi.fn();
      const unsubscribeSnapshot = vi.fn();
      const unsubscribeError = vi.fn();

      vi.mocked(mockSocket.subscribe).mockImplementation((kind: string) => {
        if (kind === 'Event') return unsubscribeEvent;
        if (kind === 'StateSnapshot') return unsubscribeSnapshot;
        if (kind === 'Error') return unsubscribeError;
        return () => {};
      });

      const { unmount } = renderHook(() => useGameEvents({ socket: mockSocket }));

      unmount();

      expect(unsubscribeEvent).toHaveBeenCalled();
      expect(unsubscribeSnapshot).toHaveBeenCalled();
      expect(unsubscribeError).toHaveBeenCalled();
    });

    test('cleans up side effect manager on unmount', () => {
      const { result, unmount } = renderHook(() => useGameEvents({ socket: mockSocket }));

      const cleanupSpy = vi.spyOn(result.current.sideEffectManager, 'cleanup');

      unmount();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('event bus', () => {
    test('emits server-event to subscribed listeners', () => {
      const listener = vi.fn();

      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      const unsubscribe = result.current.eventBus.onServerEvent(listener);

      const publicEvent: PublicEvent = {
        TilesPassing: { direction: 'Right' },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'history-move-tiles-passing',
        direction: 'Right',
      });

      unsubscribe();
    });

    test('allows unsubscribe from server-event', () => {
      const listener = vi.fn();

      const { result } = renderHook(() => useGameEvents({ socket: mockSocket }));

      const unsubscribe = result.current.eventBus.onServerEvent(listener);

      // Unsubscribe before the event fires
      unsubscribe();

      const publicEvent: PublicEvent = {
        TilesPassing: { direction: 'Across' },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      // Listener should NOT have been called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('debug mode', () => {
    test('logs events when debug is enabled', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useGameEvents({ socket: mockSocket, debug: true }));

      const publicEvent: PublicEvent = {
        DiceRolled: { roll: 7 },
      };

      act(() => {
        emitEnvelope({ kind: 'Event', payload: { event: { Public: publicEvent } } });
      });

      expect(consoleLogSpy).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });
});
