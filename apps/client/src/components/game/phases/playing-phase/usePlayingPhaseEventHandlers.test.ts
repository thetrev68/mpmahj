import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayingPhaseEventHandlers } from './usePlayingPhaseEventHandlers';

describe('usePlayingPhaseEventHandlers', () => {
  const handlers = new Map<string, (data: unknown) => void>();
  const clearSelection = vi.fn();
  const on = vi.fn((event: string, handler: (data: unknown) => void) => {
    handlers.set(event, handler);
    return vi.fn();
  });

  const animations = {
    setIncomingFromSeat: vi.fn(),
    clearAllAnimations: vi.fn(),
  };
  const autoDraw = {
    clearPendingDrawRetry: vi.fn(),
    resetDrawRetry: vi.fn(),
  };
  const historyPlayback = {
    clearPendingUndoOnError: vi.fn(),
    handleServerEvent: vi.fn(),
  };
  const hintSystem = {
    handleServerEvent: vi.fn(() => false),
    resetForTurnChange: vi.fn(),
  };
  const playing = {
    showResolutionOverlay: vi.fn(),
    dismissResolutionOverlay: vi.fn(),
    setMostRecentDiscard: vi.fn(),
    setDiscardAnimation: vi.fn(),
    setProcessing: vi.fn(),
    setStagedIncomingTile: vi.fn(),
    reset: vi.fn(),
  };

  const options = (turnKey: 'South' | 'West' = 'South') =>
    ({
      animations,
      autoDraw,
      clearSelection,
      eventBus: { on },
      historyPlayback,
      hintSystem,
      playing,
      turnKey,
    }) as unknown as Parameters<typeof usePlayingPhaseEventHandlers>[0];

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  it('routes server event to history when hint system does not consume it', () => {
    renderHook(() => usePlayingPhaseEventHandlers(options()));

    const payload = { kind: 'AnyEvent' };
    act(() => {
      handlers.get('server-event')?.(payload);
    });

    expect(hintSystem.handleServerEvent).toHaveBeenCalledWith(payload);
    expect(historyPlayback.handleServerEvent).toHaveBeenCalledWith(payload);
  });

  it('resets phase state on turn key change', () => {
    const initialProps: { turnKey: 'South' | 'West' } = { turnKey: 'South' };
    const { rerender } = renderHook(
      ({ turnKey }: { turnKey: 'South' | 'West' }) =>
        usePlayingPhaseEventHandlers(options(turnKey)),
      { initialProps }
    );

    rerender({ turnKey: 'West' });

    expect(playing.reset).toHaveBeenCalled();
    expect(animations.clearAllAnimations).toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalled();
    expect(hintSystem.resetForTurnChange).toHaveBeenCalled();
    expect(autoDraw.resetDrawRetry).toHaveBeenCalled();
  });
});
