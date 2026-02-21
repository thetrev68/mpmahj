import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayingPhaseActions } from './usePlayingPhaseActions';

vi.mock('@/hooks/useCountdown', () => ({
  useCountdown: vi.fn(() => 4),
}));

describe('usePlayingPhaseActions', () => {
  const sendCommand = vi.fn();
  const setErrorMessage = vi.fn();
  const pushUndoAction = vi.fn();
  const closeCallWindow = vi.fn();
  const markResponded = vi.fn();
  const setTimerRemaining = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes call eligibility and updates timer remaining', () => {
    const { result } = renderHook(() =>
      usePlayingPhaseActions({
        callWindow: {
          callWindow: {
            tile: 5,
            hasResponded: false,
            timerStart: Date.now(),
            timerDuration: 10,
          },
          setTimerRemaining,
          closeCallWindow,
          markResponded,
        } as never,
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        forfeitedPlayers: new Set(),
        historyPlayback: {
          pushUndoAction,
        } as never,
        sendCommand,
        setErrorMessage,
      })
    );

    expect(result.current.callEligibility.canCallForPung).toBe(true);
    expect(setTimerRemaining).toHaveBeenCalledWith(4);
  });

  it('handles mahjong call intent', () => {
    const { result } = renderHook(() =>
      usePlayingPhaseActions({
        callWindow: {
          callWindow: {
            tile: 5,
            hasResponded: false,
            timerStart: Date.now(),
            timerDuration: 10,
          },
          setTimerRemaining,
          closeCallWindow,
          markResponded,
        } as never,
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        forfeitedPlayers: new Set(),
        historyPlayback: {
          pushUndoAction,
        } as never,
        sendCommand,
        setErrorMessage,
      })
    );

    act(() => {
      result.current.handleCallIntent('Mahjong');
    });

    expect(sendCommand).toHaveBeenCalledWith({
      DeclareCallIntent: {
        player: 'South',
        intent: 'Mahjong',
      },
    });
    expect(pushUndoAction).toHaveBeenCalledWith('Declared Mahjong call intent');
    expect(markResponded).toHaveBeenCalledWith('Declared Mahjong');
  });

  it('handles pass action', () => {
    const { result } = renderHook(() =>
      usePlayingPhaseActions({
        callWindow: {
          callWindow: {
            tile: 5,
            hasResponded: false,
            timerStart: Date.now(),
            timerDuration: 10,
          },
          setTimerRemaining,
          closeCallWindow,
          markResponded,
        } as never,
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        forfeitedPlayers: new Set(),
        historyPlayback: {
          pushUndoAction,
        } as never,
        sendCommand,
        setErrorMessage,
      })
    );

    act(() => {
      result.current.handlePass();
    });

    expect(sendCommand).toHaveBeenCalledWith({ Pass: { player: 'South' } });
    expect(pushUndoAction).toHaveBeenCalledWith(expect.stringContaining('Passed on'));
    expect(setErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Passed on'));
    expect(closeCallWindow).toHaveBeenCalled();
  });

  it('blocks call/pass actions for forfeited players', () => {
    const { result } = renderHook(() =>
      usePlayingPhaseActions({
        callWindow: {
          callWindow: {
            tile: 5,
            hasResponded: false,
            timerStart: Date.now(),
            timerDuration: 10,
          },
          setTimerRemaining,
          closeCallWindow,
          markResponded,
        } as never,
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        forfeitedPlayers: new Set(['South']),
        historyPlayback: {
          pushUndoAction,
        } as never,
        sendCommand,
        setErrorMessage,
      })
    );

    act(() => {
      result.current.handleCallIntent('Mahjong');
      result.current.handlePass();
    });

    expect(sendCommand).not.toHaveBeenCalled();
    expect(closeCallWindow).not.toHaveBeenCalled();
    expect(markResponded).not.toHaveBeenCalled();
  });
});
