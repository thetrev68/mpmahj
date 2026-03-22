import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHintSystem } from './useHintSystem';
import { gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

describe('useHintSystem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requests a hint with the simplified contract', () => {
    const sendCommand = vi.fn();
    const gameState = {
      ...(gameStates.playingDiscarding as GameStateSnapshot),
      your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    };
    const { result } = renderHook(() =>
      useHintSystem({
        gameState,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand,
      })
    );
    sendCommand.mockClear();

    act(() => {
      result.current.handleRequestHint();
    });

    expect(result.current.hintPending).toBe(true);
    expect(sendCommand).toHaveBeenCalledWith({
      RequestHint: {
        player: gameState.your_seat,
      },
    });
  });

  it('returns to idle state when a hint request is canceled', () => {
    vi.useFakeTimers();

    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand,
      })
    );
    sendCommand.mockClear();

    act(() => {
      result.current.handleRequestHint();
    });

    expect(result.current.hintPending).toBe(true);

    act(() => {
      result.current.cancelHintRequest();
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.hintPending).toBe(false);
    expect(result.current.hintError).toBeNull();

    vi.useRealTimers();
  });

  it('syncs the enabled hint capability on mount', () => {
    const sendCommand = vi.fn();

    renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand,
      })
    );

    expect(sendCommand).toHaveBeenCalledWith({
      SetHintEnabled: {
        player: 'South',
        enabled: true,
      },
    });
  });

  it('handles HintUpdate analysis event', () => {
    const { result } = renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand: vi.fn(),
      })
    );

    act(() => {
      result.current.handleServerEvent({
        type: 'hint-update',
        hint: {
          recommended_discard: 3,
          discard_reason: 'Keep flexibility',
          best_patterns: [],
          tiles_needed_for_win: [],
          distance_to_win: 2,
          hot_hand: false,
          call_opportunities: [],
          defensive_hints: [],
          charleston_pass_recommendations: [],
          tile_scores: {},
          utility_scores: {},
        },
      });
    });

    expect(result.current.currentHint?.recommended_discard).toBe(3);
    expect(result.current.hintStatusMessage).toBe('Hint received');
  });

  it('highlights the first matching tile instance for the recommended discard', () => {
    const gameState = {
      ...(gameStates.playingDiscarding as GameStateSnapshot),
      your_hand: [1, 10, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    };
    const { result } = renderHook(() =>
      useHintSystem({
        gameState,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand: vi.fn(),
      })
    );

    act(() => {
      result.current.handleServerEvent({
        type: 'hint-update',
        hint: {
          recommended_discard: 10,
          discard_reason: 'Discard a duplicate first',
          best_patterns: [],
          tiles_needed_for_win: [],
          distance_to_win: 2,
          hot_hand: false,
          call_opportunities: [],
          defensive_hints: [],
          charleston_pass_recommendations: [],
          tile_scores: {},
          utility_scores: {},
        },
      });
    });

    expect(result.current.hintHighlightedIds).toEqual(['10-0']);
  });

  it('clears current hint and pending state when hints are disabled', () => {
    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand,
      })
    );

    act(() => {
      result.current.handleServerEvent({
        type: 'hint-update',
        hint: {
          recommended_discard: 10,
          discard_reason: 'Discard a duplicate first',
          best_patterns: [],
          tiles_needed_for_win: [],
          distance_to_win: 2,
          hot_hand: false,
          call_opportunities: [],
          defensive_hints: [],
          charleston_pass_recommendations: [],
          tile_scores: {},
          utility_scores: {},
        },
      });
    });

    act(() => {
      result.current.handleHintSettingsChange({
        useHints: false,
        sortDiscards: false,
      });
    });

    expect(result.current.currentHint).toBeNull();
    expect(result.current.hintPending).toBe(false);
    expect(result.current.hintError).toBeNull();
  });

  it('sends the disabled capability state when hints are turned off', () => {
    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        canRequestHintInCurrentPhase: true,
        isHistoricalView: false,
        sendCommand,
      })
    );
    sendCommand.mockClear();

    act(() => {
      result.current.handleHintSettingsChange({ useHints: false, sortDiscards: false });
    });

    expect(sendCommand).toHaveBeenCalledWith({
      SetHintEnabled: {
        player: 'South',
        enabled: false,
      },
    });
  });
});
