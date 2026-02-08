/**
 * Tests for Public Event Handlers
 *
 * Pure function tests for event processing logic
 * Validates state updates, UI actions, and side effects
 */

import { describe, test, expect } from 'vitest';
import { handleDiceRolled, handleWallBroken, handlePhaseChanged } from './publicEventHandlers';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

const drawingStage: TurnStage = { Drawing: { player: 'East' } };
const discardingStage: TurnStage = { Discarding: { player: 'East' } };

const mockGameResult: GameResult = {
  winner: 'East',
  winning_pattern: 'Test Pattern',
  score_breakdown: null,
  final_scores: {},
  final_hands: {},
  next_dealer: 'South',
  end_condition: 'Win',
};

// Mock game state for testing
const mockGameState: GameStateSnapshot = {
  game_id: 'test-game',
  phase: { Setup: 'RollingDice' },
  current_turn: 'East',
  dealer: 'East',
  round_number: 1,
  turn_number: 1,
  remaining_tiles: 144,
  discard_pile: [{ tile: 0, discarded_by: 'South' }],
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
    concealed_bonus_enabled: false,
    dealer_bonus_enabled: false,
  },
  charleston_state: null,
  your_seat: 'East',
  your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  wall_seed: 0n,
  wall_draw_index: 0,
  wall_break_point: 0,
  wall_tiles_remaining: 152,
};

describe('handleDiceRolled', () => {
  test('updates phase to BreakingWall', () => {
    const event: PublicEvent = { DiceRolled: { roll: 7 } };
    const result = handleDiceRolled(event);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ Setup: 'BreakingWall' });
  });

  test('sets dice roll UI state', () => {
    const event: PublicEvent = { DiceRolled: { roll: 7 } };
    const result = handleDiceRolled(event);

    expect(result.uiActions).toContainEqual({
      type: 'SET_DICE_ROLL',
      value: 7,
    });
  });

  test('shows dice overlay', () => {
    const event: PublicEvent = { DiceRolled: { roll: 12 } };
    const result = handleDiceRolled(event);

    expect(result.uiActions).toContainEqual({
      type: 'SET_SHOW_DICE_OVERLAY',
      value: true,
    });
  });

  test('returns no side effects', () => {
    const event: PublicEvent = { DiceRolled: { roll: 5 } };
    const result = handleDiceRolled(event);

    expect(result.sideEffects).toHaveLength(0);
  });

  test('handles edge case rolls (2 and 12)', () => {
    const testCases = [2, 12];

    testCases.forEach((roll) => {
      const event: PublicEvent = { DiceRolled: { roll } };
      const result = handleDiceRolled(event);

      expect(result.uiActions).toContainEqual({
        type: 'SET_DICE_ROLL',
        value: roll,
      });
    });
  });

  test('handles null gameState gracefully', () => {
    const event: PublicEvent = { DiceRolled: { roll: 7 } };
    const result = handleDiceRolled(event);

    const updatedState = result.stateUpdates[0](null);
    expect(updatedState).toBeNull();
  });
});

describe('handleWallBroken', () => {
  test('updates wall_break_point in game state', () => {
    const event: PublicEvent = { WallBroken: { position: 42 } };
    const result = handleWallBroken(event);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.wall_break_point).toBe(42);
  });

  test('sets setup phase to Dealing', () => {
    const event: PublicEvent = { WallBroken: { position: 20 } };
    const result = handleWallBroken(event);

    expect(result.uiActions).toContainEqual({
      type: 'SET_SETUP_PHASE',
      phase: 'Dealing',
    });
  });

  test('returns no side effects', () => {
    const event: PublicEvent = { WallBroken: { position: 10 } };
    const result = handleWallBroken(event);

    expect(result.sideEffects).toHaveLength(0);
  });

  test('handles wall break at position 0', () => {
    const event: PublicEvent = { WallBroken: { position: 0 } };
    const result = handleWallBroken(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.wall_break_point).toBe(0);
  });

  test('handles wall break at maximum position', () => {
    const event: PublicEvent = { WallBroken: { position: 159 } };
    const result = handleWallBroken(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.wall_break_point).toBe(159);
  });

  test('handles null gameState gracefully', () => {
    const event: PublicEvent = { WallBroken: { position: 42 } };
    const result = handleWallBroken(event);

    const updatedState = result.stateUpdates[0](null);
    expect(updatedState).toBeNull();
  });

  test('preserves all other game state fields', () => {
    const event: PublicEvent = { WallBroken: { position: 30 } };
    const result = handleWallBroken(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.game_id).toBe(mockGameState.game_id);
    expect(updatedState?.your_seat).toBe(mockGameState.your_seat);
    expect(updatedState?.your_hand).toEqual(mockGameState.your_hand);
    expect(updatedState?.wall_tiles_remaining).toBe(mockGameState.wall_tiles_remaining);
  });
});

describe('handlePhaseChanged', () => {
  test('updates phase in game state', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Playing: drawingStage } },
    };
    const result = handlePhaseChanged(event);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ Playing: drawingStage });
  });

  test('handles Charleston phase transition', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Charleston: 'FirstRight' } },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ Charleston: 'FirstRight' });
  });

  test('handles Setup phase transition', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Setup: 'RollingDice' } },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ Setup: 'RollingDice' });
  });

  test('handles GameOver phase transition', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { GameOver: mockGameResult } },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ GameOver: mockGameResult });
  });

  test('handles WaitingForPlayers phase transition', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: 'WaitingForPlayers' },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toBe('WaitingForPlayers');
  });

  test('returns no UI actions', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Playing: drawingStage } },
    };
    const result = handlePhaseChanged(event);

    expect(result.uiActions).toHaveLength(0);
  });

  test('returns no side effects', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Playing: discardingStage } },
    };
    const result = handlePhaseChanged(event);

    expect(result.sideEffects).toHaveLength(0);
  });

  test('handles null gameState gracefully', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Playing: drawingStage } },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](null);
    expect(updatedState).toBeNull();
  });

  test('preserves all other game state fields', () => {
    const event: PublicEvent = {
      PhaseChanged: { phase: { Playing: drawingStage } },
    };
    const result = handlePhaseChanged(event);

    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.game_id).toBe(mockGameState.game_id);
    expect(updatedState?.your_seat).toBe(mockGameState.your_seat);
    expect(updatedState?.your_hand).toEqual(mockGameState.your_hand);
    expect(updatedState?.wall_break_point).toBe(mockGameState.wall_break_point);
  });
});

describe('Event handler integration', () => {
  test('all handlers return consistent EventHandlerResult shape', () => {
    const diceEvent: PublicEvent = { DiceRolled: { roll: 7 } };
    const wallEvent: PublicEvent = { WallBroken: { position: 42 } };
    const phaseEvent: PublicEvent = {
      PhaseChanged: { phase: { Playing: drawingStage } },
    };

    const results = [
      handleDiceRolled(diceEvent),
      handleWallBroken(wallEvent),
      handlePhaseChanged(phaseEvent),
    ];

    results.forEach((result) => {
      expect(result).toHaveProperty('stateUpdates');
      expect(result).toHaveProperty('uiActions');
      expect(result).toHaveProperty('sideEffects');
      expect(Array.isArray(result.stateUpdates)).toBe(true);
      expect(Array.isArray(result.uiActions)).toBe(true);
      expect(Array.isArray(result.sideEffects)).toBe(true);
    });
  });

  test('state updaters are pure functions', () => {
    const event: PublicEvent = { DiceRolled: { roll: 7 } };
    const result = handleDiceRolled(event);

    const updater = result.stateUpdates[0];

    // Calling multiple times with same input should produce same output
    const result1 = updater(mockGameState);
    const result2 = updater(mockGameState);

    expect(result1).toEqual(result2);

    // Original state should not be mutated
    expect(mockGameState.phase).toEqual({ Setup: 'RollingDice' });
  });
});
