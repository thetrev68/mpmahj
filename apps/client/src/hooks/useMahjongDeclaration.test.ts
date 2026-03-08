import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMahjongDeclaration } from './useMahjongDeclaration';
import { gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { UIStateAction } from '@/lib/game-events/types';

describe('useMahjongDeclaration', () => {
  it('opens and confirms mahjong dialog', () => {
    const sendCommand = vi.fn();
    const setPlayingProcessing = vi.fn();
    const gameState = gameStates.playingDiscarding as GameStateSnapshot;
    const { result } = renderHook(() =>
      useMahjongDeclaration({
        gameState,
        sendCommand,
        setPlayingProcessing,
      })
    );

    act(() => {
      result.current.handleDeclareMahjong();
    });
    expect(result.current.showMahjongDialog).toBe(true);

    act(() => {
      result.current.handleMahjongConfirm({
        DeclareMahjong: {
          player: gameState.your_seat,
          hand: {
            concealed: [],
            counts: [],
            exposed: [],
            joker_assignments: null,
          },
          winning_tile: null,
        },
      });
    });

    expect(result.current.mahjongDialogLoading).toBe(true);
    expect(setPlayingProcessing).toHaveBeenCalledWith(true);
    expect(sendCommand).toHaveBeenCalled();
  });

  it('updates dead hand state from ui action', () => {
    const gameState = gameStates.playingDiscarding as GameStateSnapshot;
    const { result } = renderHook(() =>
      useMahjongDeclaration({
        gameState,
        sendCommand: vi.fn(),
        setPlayingProcessing: vi.fn(),
      })
    );

    act(() => {
      const action: UIStateAction = {
        type: 'SET_HAND_DECLARED_DEAD',
        player: gameState.your_seat,
        reason: 'Invalid claim',
      };
      result.current.handleUiAction(action);
    });

    expect(result.current.isDeadHand(gameState.your_seat)).toBe(true);
    expect(result.current.showDeadHandOverlay).toBe(true);
  });
});
