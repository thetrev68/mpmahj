import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameBoardOverlays } from './useGameBoardOverlays';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UIStateAction } from '@/lib/game-events/types';

function createSocketClient(partial: Partial<UseGameSocketReturn> = {}): UseGameSocketReturn {
  return {
    connectionState: 'connected',
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
});
