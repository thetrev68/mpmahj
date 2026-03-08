import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { GameBoard } from '@/components/game/GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import type { Tile } from '@/types/bindings/generated/Tile';

describe('Timer Expiry Integration', () => {
  it('processes server auto-discard on timeout without sending a client command', async () => {
    const mockWs = createMockWebSocket();

    const initialState = {
      ...gameStates.playingDiscarding,
      your_seat: 'North' as const,
      current_turn: 'North' as const,
      phase: { Playing: { Discarding: { player: 'North' as const } } },
      your_hand: [
        4 as Tile,
        1 as Tile,
        2 as Tile,
        3 as Tile,
        10 as Tile,
        11 as Tile,
        12 as Tile,
        19 as Tile,
        20 as Tile,
        21 as Tile,
        28 as Tile,
        29 as Tile,
        32 as Tile,
        5 as Tile,
      ],
      players: gameStates.playingDiscarding.players.map((player) =>
        player.seat === 'North' ? { ...player, tile_count: 14 } : player
      ),
    };

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    expect(screen.getByLabelText(/your rack: 14 tiles/i)).toBeInTheDocument();

    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TurnChanged: {
                player: 'North',
                stage: { Discarding: { player: 'North' } },
              },
            },
          },
        },
      });

      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TileDiscarded: {
                player: 'North',
                tile: 4,
              },
            },
          },
        },
      });

      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TurnChanged: {
                player: 'East',
                stage: { Drawing: { player: 'East' } },
              },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/your rack: 13 tiles/i)).toBeInTheDocument();
      expect(screen.getByTestId('opponent-rack-east')).toHaveClass('ring-2', 'ring-green-400');
      expect(screen.getByTestId('player-rack')).not.toHaveClass('ring-green-400');
    });

    expect(mockWs.send).not.toHaveBeenCalled();
  });
});
