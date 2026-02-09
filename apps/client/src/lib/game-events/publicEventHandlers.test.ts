/**
 * Tests for Public Event Handlers
 *
 * Pure function tests for event processing logic
 * Validates state updates, UI actions, and side effects
 */

import { describe, test, expect } from 'vitest';
import {
  handleDiceRolled,
  handleWallBroken,
  handlePhaseChanged,
  handleCharlestonPhaseChanged,
  handleCharlestonTimerStarted,
  handlePlayerReadyForPass,
  handleTilesPassing,
  handleBlindPassPerformed,
  handlePlayerVoted,
  handleVoteResult,
} from './publicEventHandlers';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';

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

describe('handleCharlestonPhaseChanged', () => {
  test('updates phase to Charleston with stage', () => {
    const event: PublicEvent = { CharlestonPhaseChanged: { stage: 'FirstRight' } };
    const result = handleCharlestonPhaseChanged(event);

    expect(result.stateUpdates).toHaveLength(1);
    const updatedState = result.stateUpdates[0](mockGameState);
    expect(updatedState?.phase).toEqual({ Charleston: 'FirstRight' });
  });

  test('resets Charleston UI state', () => {
    const event: PublicEvent = { CharlestonPhaseChanged: { stage: 'FirstAcross' } };
    const result = handleCharlestonPhaseChanged(event);

    expect(result.uiActions).toContainEqual({ type: 'RESET_CHARLESTON_STATE' });
    expect(result.uiActions).toContainEqual({ type: 'CLEAR_SELECTION' });
    expect(result.uiActions).toContainEqual({ type: 'CLEAR_SELECTION_ERROR' });
  });

  test('handles all Charleston stages', () => {
    const stages = [
      'FirstRight',
      'FirstAcross',
      'FirstLeft',
      'VotingToContinue',
      'SecondLeft',
      'SecondAcross',
      'SecondRight',
      'CourtesyAcross',
      'Complete',
    ];

    stages.forEach((stage) => {
      const event: PublicEvent = {
        CharlestonPhaseChanged: { stage: stage as unknown as CharlestonStage },
      };
      const result = handleCharlestonPhaseChanged(event);
      const updatedState = result.stateUpdates[0](mockGameState);
      expect(updatedState?.phase).toEqual({ Charleston: stage });
    });
  });
});

describe('handleCharlestonTimerStarted', () => {
  test('sets timer with correct duration and expiry', () => {
    const event: PublicEvent = {
      CharlestonTimerStarted: {
        stage: 'FirstRight',
        duration: 30,
        started_at_ms: 1000n,
        timer_mode: 'Visible',
      },
    };

    const result = handleCharlestonTimerStarted(event);

    expect(result.uiActions).toHaveLength(1);
    expect(result.uiActions[0]).toMatchObject({
      type: 'SET_CHARLESTON_TIMER',
      timer: {
        stage: 'FirstRight',
        durationSeconds: 30,
        startedAtMs: 1000,
        expiresAtMs: 31000,
        mode: 'Visible',
      },
    });
  });
});

describe('handlePlayerReadyForPass', () => {
  test('adds player to ready list', () => {
    const event: PublicEvent = { PlayerReadyForPass: { player: 'East' } };
    const result = handlePlayerReadyForPass(event, mockGameState);

    expect(result.uiActions).toContainEqual({ type: 'ADD_READY_PLAYER', seat: 'East' });
  });

  test('shows bot message when player is bot', () => {
    const botGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players.filter((p) => p.seat !== 'South'),
        { ...mockGameState.players[1], is_bot: true },
      ],
    };

    const event: PublicEvent = { PlayerReadyForPass: { player: 'South' } };
    const result = handlePlayerReadyForPass(event, botGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'South (Bot) has passed tiles.',
    });
  });

  test('schedules bot message clear', () => {
    const botGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players.filter((p) => p.seat !== 'West'),
        { ...mockGameState.players[2], is_bot: true },
      ],
    };

    const event: PublicEvent = { PlayerReadyForPass: { player: 'West' } };
    const result = handlePlayerReadyForPass(event, botGameState);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'bot-pass-message',
      ms: 2500,
    });
  });

  test('does not show bot message for human players', () => {
    const event: PublicEvent = { PlayerReadyForPass: { player: 'East' } };
    const result = handlePlayerReadyForPass(event, mockGameState);

    const botMessages = result.uiActions.filter((a) => a.type === 'SET_BOT_PASS_MESSAGE');
    expect(botMessages).toHaveLength(0);
  });
});

describe('handleTilesPassing', () => {
  test('sets pass direction', () => {
    const event: PublicEvent = { TilesPassing: { direction: 'Right' } };
    const result = handleTilesPassing(event);

    expect(result.uiActions).toContainEqual({ type: 'SET_PASS_DIRECTION', direction: 'Right' });
  });

  test('schedules direction clear after 600ms', () => {
    const event: PublicEvent = { TilesPassing: { direction: 'Across' } };
    const result = handleTilesPassing(event);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'pass-direction',
      ms: 600,
    });
  });
});

describe('handleBlindPassPerformed', () => {
  test('shows message for current player', () => {
    const event: PublicEvent = {
      BlindPassPerformed: { player: 'East', blind_count: 2, hand_count: 1 },
    };
    const result = handleBlindPassPerformed(event, mockGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'You passed 2 tiles blindly and 1 from hand',
    });
  });

  test('shows message for bot player', () => {
    const botGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players.filter((p) => p.seat !== 'South'),
        { ...mockGameState.players[1], is_bot: true },
      ],
    };

    const event: PublicEvent = {
      BlindPassPerformed: { player: 'South', blind_count: 1, hand_count: 2 },
    };
    const result = handleBlindPassPerformed(event, botGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'South (Bot) passed 1 blind, 2 from hand',
    });
  });

  test('shows message for human player (other)', () => {
    const event: PublicEvent = {
      BlindPassPerformed: { player: 'West', blind_count: 3, hand_count: 0 },
    };
    const result = handleBlindPassPerformed(event, mockGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'West passed 3 blind, 0 from hand',
    });
  });

  test('schedules message clear after 3 seconds', () => {
    const event: PublicEvent = {
      BlindPassPerformed: { player: 'North', blind_count: 2, hand_count: 1 },
    };
    const result = handleBlindPassPerformed(event, mockGameState);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'bot-pass-message',
      ms: 3000,
    });
  });
});

describe('handlePlayerVoted', () => {
  test('adds player to voted list', () => {
    const event: PublicEvent = { PlayerVoted: { player: 'East' } };
    const result = handlePlayerVoted(event, mockGameState);

    expect(result.uiActions).toContainEqual({ type: 'ADD_VOTED_PLAYER', seat: 'East' });
  });

  test('shows bot vote message for bot players', () => {
    const botGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players.filter((p) => p.seat !== 'North'),
        { ...mockGameState.players[3], is_bot: true },
      ],
    };

    const event: PublicEvent = { PlayerVoted: { player: 'North' } };
    const result = handlePlayerVoted(event, botGameState);

    expect(result.uiActions).toContainEqual({
      type: 'SET_BOT_VOTE_MESSAGE',
      message: 'North (Bot) has voted',
    });
  });

  test('schedules bot vote message clear', () => {
    const botGameState = {
      ...mockGameState,
      players: [
        ...mockGameState.players.filter((p) => p.seat !== 'South'),
        { ...mockGameState.players[1], is_bot: true },
      ],
    };

    const event: PublicEvent = { PlayerVoted: { player: 'South' } };
    const result = handlePlayerVoted(event, botGameState);

    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toMatchObject({
      type: 'TIMEOUT',
      id: 'bot-vote-message',
      ms: 2500,
    });
  });

  test('does not show bot message for human players', () => {
    const event: PublicEvent = { PlayerVoted: { player: 'West' } };
    const result = handlePlayerVoted(event, mockGameState);

    const botMessages = result.uiActions.filter((a) => a.type === 'SET_BOT_VOTE_MESSAGE');
    expect(botMessages).toHaveLength(0);
  });
});

describe('handleVoteResult', () => {
  test('sets vote result and breakdown', () => {
    const votes = {
      East: 'Continue' as const,
      South: 'Continue' as const,
      West: 'Stop' as const,
      North: 'Continue' as const,
    };

    const event: PublicEvent = {
      VoteResult: {
        result: 'Continue',
        votes,
      },
    };

    const result = handleVoteResult(event);

    expect(result.uiActions).toContainEqual({ type: 'SET_VOTE_RESULT', result: 'Continue' });
    expect(result.uiActions).toContainEqual({ type: 'SET_VOTE_BREAKDOWN', breakdown: votes });
    expect(result.uiActions).toContainEqual({ type: 'SET_SHOW_VOTE_RESULT_OVERLAY', value: true });
  });

  test('handles Stop vote result', () => {
    const votes = {
      East: 'Stop' as const,
      South: 'Stop' as const,
      West: 'Continue' as const,
      North: 'Stop' as const,
    };

    const event: PublicEvent = {
      VoteResult: {
        result: 'Stop',
        votes,
      },
    };

    const result = handleVoteResult(event);

    expect(result.uiActions).toContainEqual({ type: 'SET_VOTE_RESULT', result: 'Stop' });
  });
});
