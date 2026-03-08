import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useGamePhase } from './useGamePhase';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

function makeSnapshot(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    game_id: 'test-game',
    phase: 'WaitingForPlayers',
    current_turn: 'East',
    dealer: 'East',
    round_number: 1,
    turn_number: 0,
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
        call_window_seconds: 10,
        charleston_timer_seconds: 30,
      },
      analysis_enabled: false,
    },
    charleston_state: null,
    your_seat: 'South',
    your_hand: [],
    wall_seed: 0n,
    wall_draw_index: 0,
    wall_break_point: 0,
    wall_tiles_remaining: 144,
    ...overrides,
  };
}

describe('useGamePhase', () => {
  test('returns safe defaults when gameState is null', () => {
    const { result } = renderHook(() => useGamePhase(null));
    expect(result.current.isCharleston).toBe(false);
    expect(result.current.charlestonStage).toBeUndefined();
    expect(result.current.isSetupPhase).toBe(false);
    expect(result.current.setupStage).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.turnStage).toBeNull();
    expect(result.current.isPrePlayPhase).toBe(false);
    expect(result.current.isEastBot).toBe(false);
    expect(result.current.totalTiles).toBe(152);
    expect(result.current.stacksPerWallInitial).toBe(19);
    expect(result.current.stacksPerWallDisplay).toBe(19);
    expect(result.current.wallBreakIndex).toBeUndefined();
    expect(result.current.wallDrawIndex).toBeUndefined();
  });

  test('detects Charleston phase and extracts stage', () => {
    const gameState = makeSnapshot({ phase: { Charleston: 'FirstRight' } });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.isCharleston).toBe(true);
    expect(result.current.charlestonStage).toBe('FirstRight');
    expect(result.current.isPrePlayPhase).toBe(true);
    expect(result.current.isSetupPhase).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  test('detects Setup phase and extracts stage', () => {
    const gameState = makeSnapshot({ phase: { Setup: 'RollingDice' } });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.isSetupPhase).toBe(true);
    expect(result.current.setupStage).toBe('RollingDice');
    expect(result.current.isPrePlayPhase).toBe(true);
    expect(result.current.isCharleston).toBe(false);
    expect(result.current.isPlaying).toBe(false);
  });

  test('detects Playing phase and extracts TurnStage', () => {
    const gameState = makeSnapshot({ phase: { Playing: { Drawing: { player: 'East' } } } });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.turnStage).toEqual({ Drawing: { player: 'East' } });
    expect(result.current.isPrePlayPhase).toBe(false);
    expect(result.current.isCharleston).toBe(false);
    expect(result.current.isSetupPhase).toBe(false);
  });

  test('isEastBot is true when East player is a bot', () => {
    const gameState = makeSnapshot({
      players: [
        {
          seat: 'East',
          player_id: 'bot',
          is_bot: true,
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
    });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.isEastBot).toBe(true);
  });

  test('totalTiles is 160 when blank exchange is enabled', () => {
    const gameState = makeSnapshot({
      house_rules: {
        ruleset: {
          card_year: 2025,
          timer_mode: 'Visible',
          blank_exchange_enabled: true,
          call_window_seconds: 10,
          charleston_timer_seconds: 30,
        },
        analysis_enabled: false,
      },
    });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.totalTiles).toBe(160);
    expect(result.current.stacksPerWallInitial).toBe(20);
  });

  test('shows full initial wall during pre-play phases', () => {
    const gameState = makeSnapshot({
      phase: { Charleston: 'FirstRight' },
      wall_tiles_remaining: 100,
    });
    const { result } = renderHook(() => useGamePhase(gameState));
    // Pre-play: shows initial stacks, not remaining
    expect(result.current.stacksPerWallDisplay).toBe(result.current.stacksPerWallInitial);
  });

  test('shows remaining wall stacks during Playing phase', () => {
    // 48 tiles remaining → 24 stacks total → 6 per wall
    const gameState = makeSnapshot({
      phase: { Playing: { Drawing: { player: 'East' } } },
      wall_tiles_remaining: 48,
    });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.stacksPerWallDisplay).toBe(6);
  });

  test('wallBreakIndex is undefined when wall_break_point is 0', () => {
    const gameState = makeSnapshot({ wall_break_point: 0 });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.wallBreakIndex).toBeUndefined();
  });

  test('wallBreakIndex is set when wall_break_point is positive', () => {
    const gameState = makeSnapshot({ wall_break_point: 42 });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.wallBreakIndex).toBe(42);
  });

  test('wallDrawIndex is undefined when wall_draw_index is 0', () => {
    const gameState = makeSnapshot({ wall_draw_index: 0 });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.wallDrawIndex).toBeUndefined();
  });

  test('wallDrawIndex is set when wall_draw_index is positive', () => {
    const gameState = makeSnapshot({ wall_draw_index: 7 });
    const { result } = renderHook(() => useGamePhase(gameState));
    expect(result.current.wallDrawIndex).toBe(7);
  });
});
