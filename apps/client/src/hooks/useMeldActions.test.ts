import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMeldActions } from './useMeldActions';
import { gameStates } from '@/test/fixtures';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { UIStateAction } from '@/lib/game-events/types';

describe('useMeldActions', () => {
  it('detects joker exchange opportunities from opponent melds', () => {
    const gameState = {
      ...gameStates.playingDiscarding,
      your_seat: 'East',
      your_hand: [5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      players: [
        {
          seat: 'East',
          player_id: 'p1',
          is_bot: false,
          status: 'Active',
          tile_count: 14,
          exposed_melds: [],
        },
        {
          seat: 'South',
          player_id: 'p2',
          is_bot: true,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [
            {
              meld_type: 'Pung',
              tiles: [40, 40, 40],
              called_tile: 40,
              concealed: false,
              joker_assignments: {
                1: 5,
              },
            },
          ],
        },
      ],
    } as GameStateSnapshot;
    const sendCommand = vi.fn();

    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        sendCommand,
      })
    );

    expect(result.current.canExchangeJoker).toBe(true);
    expect(result.current.jokerExchangeOpportunities).toHaveLength(1);
  });

  it('sends exchange command and handles success ui action', () => {
    const gameState = gameStates.playingDiscarding as GameStateSnapshot;
    const sendCommand = vi.fn();
    const { result } = renderHook(() =>
      useMeldActions({
        gameState,
        isDiscardingStage: true,
        sendCommand,
      })
    );

    act(() => {
      result.current.handleJokerExchange({
        targetSeat: 'South',
        meldIndex: 0,
        tilePosition: 1,
        representedTile: 10,
      });
    });

    expect(sendCommand).toHaveBeenCalledWith({
      ExchangeJoker: {
        player: gameState.your_seat,
        target_seat: 'South',
        meld_index: 0,
        replacement: 10,
      },
    });
    expect(result.current.jokerExchangeLoading).toBe(true);

    act(() => {
      const action: UIStateAction = {
        type: 'SET_JOKER_EXCHANGED',
        player: 'East',
        target_seat: 'South',
        joker: 0,
        replacement: 10,
      };
      result.current.handleUiAction(action);
    });

    expect(result.current.jokerExchangeLoading).toBe(false);
    expect(result.current.showJokerExchangeDialog).toBe(false);
  });
});
