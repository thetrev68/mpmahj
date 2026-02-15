import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoDraw } from './useAutoDraw';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('useAutoDraw', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts in drawing state and sends DrawTile after delay', () => {
    const sendCommand = vi.fn<(command: GameCommand) => void>();
    const { result } = renderHook(() =>
      useAutoDraw({
        isMyTurn: true,
        isDrawingStage: true,
        mySeat: 'East',
        sendCommand,
      })
    );

    expect(result.current.drawStatus).toBe('drawing');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(sendCommand).toHaveBeenCalledWith({ DrawTile: { player: 'East' } });
  });

  it('marks status as failed after retries', () => {
    const sendCommand = vi.fn<(command: GameCommand) => void>();
    const { result } = renderHook(() =>
      useAutoDraw({
        isMyTurn: true,
        isDrawingStage: true,
        mySeat: 'South',
        sendCommand,
      })
    );

    act(() => {
      vi.advanceTimersByTime(500 + 5000 + 5000 + 5000);
    });

    expect(result.current.drawStatus).toBe('failed');
    expect(sendCommand).toHaveBeenCalledTimes(4);
  });

  it('clears pending retry and resets status', () => {
    const sendCommand = vi.fn<(command: GameCommand) => void>();
    const { result } = renderHook(() =>
      useAutoDraw({
        isMyTurn: true,
        isDrawingStage: true,
        mySeat: 'West',
        sendCommand,
      })
    );

    act(() => {
      result.current.clearPendingDrawRetry();
      vi.advanceTimersByTime(6000);
    });

    expect(result.current.drawStatus).toBeNull();
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
