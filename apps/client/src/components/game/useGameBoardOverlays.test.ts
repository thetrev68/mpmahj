import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameBoardOverlays } from './useGameBoardOverlays';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UIStateAction } from '@/lib/game-events/types';
import { useGameUIStore } from '@/stores/gameUIStore';

function createSocketClient(partial: Partial<UseGameSocketReturn> = {}): UseGameSocketReturn {
  return {
    connectionState: 'connected',
    lifecycleState: 'authenticated',
    send: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    connect: vi.fn(),
    disconnect: vi.fn(),
    playerId: null,
    sessionToken: null,
    seat: null,
    reconnectAttempt: 0,
    isReconnecting: false,
    canManualRetry: false,
    retryNow: vi.fn(),
    recoveryAction: 'none',
    recoveryMessage: null,
    clearRecoveryAction: vi.fn(),
    showReconnectedToast: false,
    dismissReconnectedToast: vi.fn(),
    ...partial,
  };
}

describe('useGameBoardOverlays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameUIStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('dispatches setup UI actions to local state', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({ type: 'SET_DICE_ROLL', value: 9 } as UIStateAction);
      result.current.dispatchUIAction({
        type: 'SET_SHOW_DICE_OVERLAY',
        value: true,
      } as UIStateAction);
    });

    expect(result.current.diceRoll).toBe(9);
    expect(result.current.showDiceOverlay).toBe(true);
  });

  test('sets draw overlay state for wall exhausted action', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 18,
      } as UIStateAction);
    });

    expect(result.current.showDrawOverlay).toBe(true);
    expect(result.current.drawReason).toBe('Wall exhausted');
    expect(result.current.wallTilesAtExhaustion).toBe(18);
  });

  test('auto-dismisses reconnect toast when using internal socket', () => {
    const dismiss = vi.fn();
    const socketClient = createSocketClient({
      showReconnectedToast: true,
      dismissReconnectedToast: dismiss,
    });
    renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  test('handleDrawAcknowledge: shows draw scoring immediately when GameOver already arrived with no winner', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    // Simulate SET_WALL_EXHAUSTED arriving first
    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 0,
      } as UIStateAction);
    });

    // Simulate SET_GAME_OVER arriving before acknowledge
    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: null,
        result: {
          winner: null,
          winning_pattern: null,
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'East',
          end_condition: 'WallExhausted',
        },
      } as UIStateAction);
    });

    // Player acknowledges the overlay — should immediately show draw scoring
    act(() => {
      result.current.handleDrawAcknowledge();
    });

    expect(result.current.showDrawOverlay).toBe(false);
    expect(result.current.showDrawScoringScreen).toBe(true);
  });

  test('handleDrawAcknowledge: does not show draw scoring when GameOver has a winner', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 0,
      } as UIStateAction);
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: 'East',
        result: {
          winner: 'East',
          winning_pattern: 'Test Pattern',
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'South',
          end_condition: 'Win',
        },
      } as UIStateAction);
    });

    act(() => {
      result.current.handleDrawAcknowledge();
    });

    expect(result.current.showDrawOverlay).toBe(false);
    expect(result.current.showDrawScoringScreen).toBe(false);
  });

  test('handleDrawAcknowledge + late SET_GAME_OVER (race condition): shows draw scoring when result arrives after acknowledge', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 0,
      } as UIStateAction);
    });

    // Player acknowledges before GameOver arrives
    act(() => {
      result.current.handleDrawAcknowledge();
    });

    expect(result.current.showDrawScoringScreen).toBe(false);

    // GameOver arrives later
    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: null,
        result: {
          winner: null,
          winning_pattern: null,
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'East',
          end_condition: 'WallExhausted',
        },
      } as UIStateAction);
    });

    expect(result.current.showDrawScoringScreen).toBe(true);
  });

  test('shows draw scoring immediately for GameOver abandoned by forfeit', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: null,
        result: {
          winner: null,
          winning_pattern: null,
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'East',
          end_condition: { Abandoned: 'Forfeit' },
        },
      } as UIStateAction);
    });

    expect(result.current.showDrawOverlay).toBe(false);
    expect(result.current.showDrawScoringScreen).toBe(true);
    expect(result.current.drawReason).toBe('Player forfeited');
  });

  test('handleDrawScoringContinue closes draw scoring and opens game-over panel', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_WALL_EXHAUSTED',
        remaining_tiles: 0,
      } as UIStateAction);
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: null,
        result: {
          winner: null,
          winning_pattern: null,
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'East',
          end_condition: 'WallExhausted',
        },
      } as UIStateAction);
      result.current.handleDrawAcknowledge();
    });

    act(() => {
      result.current.handleDrawScoringContinue();
    });

    expect(result.current.showDrawScoringScreen).toBe(false);
    expect(result.current.showGameOverPanel).toBe(true);
  });

  test('handleWinnerCelebrationContinue opens scoring screen when gameResult is present', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.dispatchUIAction({
        type: 'SET_GAME_OVER',
        winner: 'East',
        result: {
          winner: 'East',
          winning_pattern: 'Test Pattern',
          score_breakdown: null,
          final_scores: {},
          final_hands: {},
          next_dealer: 'South',
          end_condition: 'Win',
        },
      } as UIStateAction);
    });

    act(() => {
      result.current.handleWinnerCelebrationContinue();
    });

    expect(result.current.showScoringScreen).toBe(true);
    expect(result.current.showGameOverPanel).toBe(false);
  });

  test('handleWinnerCelebrationContinue opens game-over panel when no gameResult', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.handleWinnerCelebrationContinue();
    });

    expect(result.current.showGameOverPanel).toBe(true);
    expect(result.current.showScoringScreen).toBe(false);
  });

  test('handleScoringContinue closes scoring screen and opens game-over panel', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.handleWinnerCelebrationContinue();
    });

    act(() => {
      result.current.handleScoringContinue();
    });

    expect(result.current.showScoringScreen).toBe(false);
    expect(result.current.showGameOverPanel).toBe(true);
  });

  test('handleGameOverClose closes the game-over panel', () => {
    const socketClient = createSocketClient();
    const { result } = renderHook(() => useGameBoardOverlays({ socketClient }));

    act(() => {
      result.current.handleWinnerCelebrationContinue();
      result.current.handleScoringContinue();
    });
    expect(result.current.showGameOverPanel).toBe(true);

    act(() => {
      result.current.handleGameOverClose();
    });

    expect(result.current.showGameOverPanel).toBe(false);
  });
});
