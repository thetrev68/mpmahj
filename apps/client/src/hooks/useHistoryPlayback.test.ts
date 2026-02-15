import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHistoryPlayback } from './useHistoryPlayback';
import { gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

describe('useHistoryPlayback', () => {
  it('requests solo undo in solo game', () => {
    const sendCommand = vi.fn();
    const gameState: GameStateSnapshot = {
      ...(gameStates.playingDiscarding as GameStateSnapshot),
      players: [
        {
          seat: 'South',
          player_id: 'p1',
          is_bot: false,
          status: 'Active',
          tile_count: 14,
          exposed_melds: [],
        },
        {
          seat: 'East',
          player_id: 'b1',
          is_bot: true,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'West',
          player_id: 'b2',
          is_bot: true,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'North',
          player_id: 'b3',
          is_bot: true,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
      ],
    };
    const { result } = renderHook(() =>
      useHistoryPlayback({
        gameState,
        sendCommand,
        playingIsProcessing: false,
      })
    );

    act(() => {
      result.current.requestSoloUndo();
    });

    expect(sendCommand).toHaveBeenCalledWith({
      SmartUndo: { player: 'South' },
    });
    expect(result.current.undoPending).toBe(true);
  });

  it('resolves undo state when StateRestored arrives', () => {
    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useHistoryPlayback({
        gameState: gameStates.playingDiscarding as GameStateSnapshot,
        sendCommand,
        playingIsProcessing: false,
      })
    );

    act(() => {
      result.current.requestSoloUndo();
      result.current.handleServerEvent({
        Public: {
          StateRestored: {
            move_number: 3,
            description: 'Undid discard',
            mode: 'Historical',
          },
        },
      });
    });

    expect(result.current.undoPending).toBe(false);
    expect(result.current.isHistoricalView).toBe(true);
    expect(result.current.historicalMoveNumber).toBe(3);
  });
});
