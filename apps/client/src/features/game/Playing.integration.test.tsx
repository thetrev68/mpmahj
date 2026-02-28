import { describe, expect, test } from 'vitest';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
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

describe('Playing Phase Staging Flow (VR-012)', () => {
  test('T-1: draw event shows tile in incoming staging lane', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={gameStates.playingDrawing} ws={mockWs} />);

    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Private: {
              TileDrawnPrivate: { tile: 5, remaining_tiles: 44 },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('staging-incoming-slot-0')).toBeInTheDocument();
      expect(screen.getByTestId('staging-incoming-tile-5-0')).toBeInTheDocument();
    });
  });

  test('T-2: selecting discard candidate stages it to outgoing lane', async () => {
    const mockWs = createMockWebSocket();
    const state: GameState = {
      ...gameStates.playingDiscarding,
      your_hand: [1, 2, 3, 10, 11, 12, 19, 20, 21, 28, 29, 32, 42, 5],
    };

    renderWithProviders(<GameBoard initialState={state} ws={mockWs} />);

    // Tile 1 in this hand will have id '1-0', testId 'tile-1-1-0'
    const tile = await screen.findByTestId('tile-1-1-0');
    fireEvent.click(tile);

    await waitFor(() => {
      // Outgoing slot should show the selected tile
      expect(screen.getByTestId('staging-outgoing-tile-1-0')).toBeInTheDocument();
    });
  });

  test('T-3: committing discard clears outgoing staging', async () => {
    const mockWs = createMockWebSocket();
    const state: GameState = {
      ...gameStates.playingDiscarding,
      your_hand: [1, 2, 3, 10, 11, 12, 19, 20, 21, 28, 29, 32, 42, 5],
    };

    renderWithProviders(<GameBoard initialState={state} ws={mockWs} />);

    // Select tile 1
    const tile = await screen.findByTestId('tile-1-1-0');
    fireEvent.click(tile);

    await waitFor(() => {
      expect(screen.getByTestId('staging-outgoing-tile-1-0')).toBeInTheDocument();
    });

    // Click DISCARD button
    fireEvent.click(screen.getByTestId('staging-discard-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('staging-outgoing-tile-1-0')).not.toBeInTheDocument();
    });
  });

  test('T-4: call flow stages called tile in incoming slot when local player calls', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={gameStates.playingDiscarding} ws={mockWs} />);

    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TileCalled: {
                player: 'South',
                called_from: 'East',
                called_tile: 5,
                meld: {
                  meld_type: 'Pung',
                  tiles: [5, 5, 5],
                  called_tile: 5,
                  joker_assignments: {},
                },
              },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('staging-incoming-tile-called-5')).toBeInTheDocument();
    });
  });

  test('T-5: JokerExchanged stages received joker in incoming slot for the exchanging player', async () => {
    const mockWs = createMockWebSocket();

    renderWithProviders(<GameBoard initialState={gameStates.playingDiscarding} ws={mockWs} />);

    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              JokerExchanged: {
                // South (our player) exchanges tile 1 (replacement) for joker 42
                // from North's exposed meld (North has no melds so no joker_assignments
                // lookup is needed — we just verify the staging tile appears)
                player: 'South',
                target_seat: 'North',
                joker: 42,
                replacement: 1,
              },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('staging-incoming-tile-exchange-42')).toBeInTheDocument();
    });
  });
});
