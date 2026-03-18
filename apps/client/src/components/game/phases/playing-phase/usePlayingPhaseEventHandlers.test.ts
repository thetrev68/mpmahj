import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayingPhaseEventHandlers } from './usePlayingPhaseEventHandlers';
import type { ServerEventNotification } from '@/lib/game-events/types';

describe('usePlayingPhaseEventHandlers', () => {
  let serverEventHandler: ((event: ServerEventNotification) => void) | undefined;
  const clearSelection = vi.fn();
  const onServerEvent = vi.fn((handler: (event: ServerEventNotification) => void) => {
    serverEventHandler = handler;
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
  const playing = {
    showResolutionOverlay: vi.fn(),
    dismissResolutionOverlay: vi.fn(),
    setMostRecentDiscard: vi.fn(),
    setDiscardAnimation: vi.fn(),
    setProcessing: vi.fn(),
    setStagedIncomingTile: vi.fn(),
    reset: vi.fn(),
  };

  const options = (turnKey: 'South' | 'West' = 'South') => ({
    animations,
    autoDraw,
    clearSelection,
    eventBus: { onServerEvent },
    historyPlayback,
    playing,
    turnKey,
  });

  beforeEach(() => {
    serverEventHandler = undefined;
    vi.clearAllMocks();
  });

  it('routes server event to history playback', () => {
    renderHook(() => usePlayingPhaseEventHandlers(options()));

    const payload: ServerEventNotification = { type: 'history-error', message: 'bad request' };
    act(() => {
      serverEventHandler?.(payload);
    });

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
    expect(autoDraw.resetDrawRetry).toHaveBeenCalled();
  });

  it('uses latest reset callbacks after rerender before turn-key reset', () => {
    const initialPlayingReset = vi.fn();
    const nextPlayingReset = vi.fn();

    const initialProps: { turnKey: 'South' | 'West'; reset: () => void } = {
      turnKey: 'South',
      reset: initialPlayingReset,
    };

    const { rerender } = renderHook(
      ({ turnKey, reset }: { turnKey: 'South' | 'West'; reset: () => void }) =>
        usePlayingPhaseEventHandlers({
          ...options(turnKey),
          playing: {
            ...playing,
            reset,
          },
        }),
      { initialProps }
    );

    expect(initialPlayingReset).toHaveBeenCalledTimes(1);

    rerender({ turnKey: 'South', reset: nextPlayingReset });
    expect(nextPlayingReset).not.toHaveBeenCalled();

    rerender({ turnKey: 'West', reset: nextPlayingReset });

    expect(initialPlayingReset).toHaveBeenCalledTimes(1);
    expect(nextPlayingReset).toHaveBeenCalledTimes(1);
  });
});
