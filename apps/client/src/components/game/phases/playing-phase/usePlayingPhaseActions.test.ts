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
  const clearSelection = vi.fn();

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
        },
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        historyPlayback: {
          pushUndoAction,
        },
        selectedClaimTiles: [],
        sendCommand,
        setErrorMessage,
        clearSelection,
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
        },
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        historyPlayback: {
          pushUndoAction,
        },
        selectedClaimTiles: [],
        sendCommand,
        setErrorMessage,
        clearSelection,
      })
    );

    act(() => {
      result.current.handleDeclareMahjongCall();
    });

    expect(sendCommand).toHaveBeenCalledWith({
      DeclareCallIntent: {
        player: 'South',
        intent: 'Mahjong',
      },
    });
    expect(pushUndoAction).toHaveBeenCalledWith('Declared Mahjong call intent');
    expect(markResponded).toHaveBeenCalledWith('Declared Mahjong');
    expect(clearSelection).toHaveBeenCalled();
  });

  it('passes when Proceed is pressed with no staged claim tiles', () => {
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
        },
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        historyPlayback: {
          pushUndoAction,
        },
        selectedClaimTiles: [],
        sendCommand,
        setErrorMessage,
        clearSelection,
      })
    );

    act(() => {
      result.current.handleProceedCallWindow();
    });

    expect(sendCommand).toHaveBeenCalledWith({ Pass: { player: 'South' } });
    expect(pushUndoAction).toHaveBeenCalledWith(expect.stringContaining('Passed on'));
    expect(setErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Passed on'));
    expect(closeCallWindow).toHaveBeenCalled();
    expect(clearSelection).toHaveBeenCalled();
  });

  it('declares a meld when Proceed is pressed with a valid staged claim', () => {
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
        },
        gameState: {
          your_seat: 'South',
          your_hand: [5, 5, 10, 11],
        } as never,
        historyPlayback: {
          pushUndoAction,
        },
        selectedClaimTiles: [5, 5],
        sendCommand,
        setErrorMessage,
        clearSelection,
      })
    );

    act(() => {
      result.current.handleProceedCallWindow();
    });

    expect(sendCommand).toHaveBeenCalledWith({
      DeclareCallIntent: {
        player: 'South',
        intent: {
          Meld: {
            meld_type: 'Pung',
            tiles: [5, 5, 5],
            called_tile: 5,
            joker_assignments: {},
          },
        },
      },
    });
    expect(pushUndoAction).toHaveBeenCalledWith('Called for Pung');
    expect(markResponded).toHaveBeenCalledWith('Declared intent to call for Pung');
    expect(clearSelection).toHaveBeenCalled();
  });

  it('returns invalid candidate feedback and blocks command when staged claim is invalid', () => {
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
        },
        gameState: {
          your_seat: 'South',
          your_hand: [5, 7, 10, 11],
        } as never,
        historyPlayback: {
          pushUndoAction,
        },
        selectedClaimTiles: [5, 7],
        sendCommand,
        setErrorMessage,
        clearSelection,
      })
    );

    expect(result.current.claimCandidate).toEqual({
      state: 'invalid',
      label: 'Invalid claim',
      detail: 'Staged claim tiles must match the discard or be jokers.',
    });

    act(() => {
      result.current.handleProceedCallWindow();
    });

    expect(sendCommand).not.toHaveBeenCalled();
    expect(setErrorMessage).toHaveBeenCalledWith(
      'Staged claim tiles must match the discard or be jokers.'
    );
  });
});
