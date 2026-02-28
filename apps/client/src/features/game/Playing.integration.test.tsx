import { describe, expect, test } from 'vitest';
import { act, renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import { GameBoard, type GameState } from '@/components/game/GameBoard';
import { gameStates } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';

const mockMeld = {
  meld_type: 'Pung' as const,
  tiles: [1, 1, 1],
  called_tile: 1,
  joker_assignments: {},
};

function createBaseGameState(): GameState {
  return {
    ...gameStates.playingDiscarding,
    your_hand: [1, 1, 4, 10, 11, 12, 19, 20, 21, 28, 29, 32, 42, 5],
    players: gameStates.playingDiscarding.players.map((player) => ({
      ...player,
      exposed_melds: [],
    })),
  };
}

function triggerTileCalled(
  ws: ReturnType<typeof createMockWebSocket>,
  player: 'East' | 'South',
  calledFrom: 'North' | 'West'
) {
  act(() => {
    ws.triggerMessage({
      kind: 'Event',
      payload: {
        event: {
          Public: {
            TileCalled: {
              player,
              called_from: calledFrom,
              meld: mockMeld,
              called_tile: mockMeld.called_tile,
            },
          },
        },
      },
    });
  });
}

describe('Playing Phase Integration (VR-009)', () => {
  test('renders opponent exposed melds inside the matching opponent rack', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={createBaseGameState()} ws={mockWs} />);
    triggerTileCalled(mockWs, 'East', 'North');

    await waitFor(() => {
      const opponentRack = screen.getByTestId('opponent-rack-east');
      expect(within(opponentRack).getByTestId('exposed-melds-area')).toBeInTheDocument();
    });
  });

  test('renders local exposed melds inside the player rack', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={createBaseGameState()} ws={mockWs} />);
    triggerTileCalled(mockWs, 'South', 'West');

    await waitFor(() => {
      const playerRack = screen.getByTestId('player-rack');
      expect(within(playerRack).getByTestId('exposed-melds-area')).toBeInTheDocument();
    });
  });

  test('does not render duplicate top-level exposed meld areas', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={createBaseGameState()} ws={mockWs} />);
    triggerTileCalled(mockWs, 'East', 'North');
    triggerTileCalled(mockWs, 'South', 'West');

    await waitFor(() => {
      const opponentRack = screen.getByTestId('opponent-rack-east');
      const playerRack = screen.getByTestId('player-rack');

      expect(within(opponentRack).getByTestId('exposed-melds-area')).toBeInTheDocument();
      expect(within(playerRack).getByTestId('exposed-melds-area')).toBeInTheDocument();
      expect(screen.getAllByTestId('exposed-melds-area')).toHaveLength(2);
    });
  });
});
