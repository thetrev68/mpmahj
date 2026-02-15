import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHintSystem } from './useHintSystem';
import { gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

describe('useHintSystem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requests a hint with current verbosity', () => {
    const sendCommand = vi.fn();
    const gameState = {
      ...(gameStates.playingDiscarding as GameStateSnapshot),
      your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    };
    const { result } = renderHook(() =>
      useHintSystem({
        gameState,
        isDiscardingStage: true,
        isHistoricalView: false,
        forfeitedPlayers: new Set(),
        sendCommand,
      })
    );

    act(() => {
      result.current.handleRequestHint();
    });

    expect(result.current.hintPending).toBe(true);
    expect(sendCommand).toHaveBeenCalledWith({
      RequestHint: {
        player: gameState.your_seat,
        verbosity: result.current.requestVerbosity,
      },
    });
  });

  it('handles HintUpdate analysis event', () => {
    const { result } = renderHook(() =>
      useHintSystem({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        isDiscardingStage: true,
        isHistoricalView: false,
        forfeitedPlayers: new Set(),
        sendCommand: vi.fn(),
      })
    );

    act(() => {
      result.current.handleServerEvent({
        Analysis: {
          HintUpdate: {
            hint: {
              recommended_discard: 3,
              rationale: ['Keep flexibility'],
              alternatives: [],
              confidence: 0.8,
            },
          },
        },
      });
    });

    expect(result.current.currentHint?.recommended_discard).toBe(3);
    expect(result.current.showHintPanel).toBe(true);
    expect(result.current.hintStatusMessage).toBe('Hint received');
  });
});
