/**
 * Integration Tests for US-004: Charleston First Left (Blind Pass)
 *
 * User Story: US-004-charleston-first-left.md
 *
 * These tests verify the complete Charleston FirstLeft flow:
 * - Tracker shows "Pass Left" with ← arrow
 * - BlindPassPanel appears with 0-3 controls
 * - Standard pass (0 blind, 3 from hand) — blind_pass_count: 0
 * - Mixed pass (1-2 blind + hand tiles) — blind_pass_count: N
 * - Full blind pass (3 blind, 0 from hand) — blind_pass_count: 3
 * - BlindPassPerformed public event display
 * - IOUDetected / IOUResolved overlay flow
 * - TilesPassing animation (Left direction)
 * - Phase advancement to VotingToContinue
 *
 * IMPORTANT: Command/event shapes match backend bindings (source of truth).
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';

describe('US-004: Charleston First Left (Blind Pass)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  const queryTileByValue = (value: number) =>
    screen.queryAllByTestId(new RegExp(`^tile-${value}-`))[0] ?? null;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  describe('Test 1: Phase entry and UI elements', () => {
    test('displays Charleston tracker with "Pass Left" and ← arrow', () => {
      const gameState = gameStates.charlestonFirstLeft;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('←');
    });

    test('renders BlindPassPanel with controls', () => {
      const gameState = gameStates.charlestonFirstLeft;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('0');
      expect(screen.getByTestId('blind-increment')).toBeInTheDocument();
      expect(screen.getByTestId('blind-decrement')).toBeInTheDocument();
    });

    test('renders player hand with 13 tiles', () => {
      const gameState = gameStates.charlestonFirstLeft;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
      gameState.your_hand.forEach((tile: number) => {
        expect(getTileByValue(tile)).toBeInTheDocument();
      });
    });

    test('Pass Tiles button is disabled initially', () => {
      const gameState = gameStates.charlestonFirstLeft;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });
  });

  describe('Test 2: Standard pass (0 blind, 3 from hand)', () => {
    test('selects 3 tiles and sends PassTiles with blind_pass_count 0 (as null)', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3 non-Joker tiles (hand: [2,5,8,10,13,17,19,22,24,27,29,32,42])
      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));
      await user.click(getTileByValue(8));

      // Button should be enabled
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();

      // Submit
      await user.click(screen.getByTestId('pass-tiles-button'));

      // Verify command: blind_pass_count is null when 0 blind selected
      const expectedCommand: GameCommand = {
        PassTiles: {
          player: 'South',
          tiles: [2, 5, 8],
          blind_pass_count: null,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 3: Mixed pass (blind + hand)', () => {
    test('selects 2 blind + 1 from hand and sends correct command', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Set blind count to 2
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('2');
      expect(screen.getByTestId('hand-tiles-needed')).toHaveTextContent('1');

      // Select 1 tile from hand
      await user.click(getTileByValue(10));

      // Button should be enabled (1 hand + 2 blind = 3)
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();

      // Submit
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: {
          player: 'South',
          tiles: [10],
          blind_pass_count: 2,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('selection counter shows mixed breakdown', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Set blind count to 2
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      // Select 1 tile
      await user.click(getTileByValue(10));

      // Counter should show mixed breakdown
      expect(screen.getByTestId('selection-counter')).toHaveTextContent(
        '1 hand + 2 blind = 3 total'
      );
    });

    test('cannot select more hand tiles than allowed (3 - blindCount)', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Set blind count to 2 (max hand = 1)
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      // Select 1 tile (should work)
      await user.click(getTileByValue(10));

      // Try to select a 2nd tile (should be blocked)
      await user.click(getTileByValue(13));

      // Only 1 tile should be selected
      expect(screen.getByTestId('selection-counter')).toHaveTextContent(
        '1 hand + 2 blind = 3 total'
      );
    });
  });

  describe('Test 4: Full blind pass (3 blind, 0 from hand)', () => {
    test('selects 3 blind and sends correct command with empty tiles', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Set blind count to 3
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('3');

      // Button should be enabled (0 hand + 3 blind = 3)
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();

      // Warning should appear
      expect(screen.getByTestId('blind-pass-warning')).toBeInTheDocument();

      // Submit
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: {
          player: 'South',
          tiles: [],
          blind_pass_count: 3,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('disables hand and BlindPassPanel after submission', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Full blind
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      await user.click(screen.getByTestId('pass-tiles-button'));

      // Button disabled
      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();

      // BlindPassPanel should be hidden after submission
      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();

      // Waiting message appears
      expect(screen.getAllByText(/waiting for other players/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Test 5: BlindPassPerformed event', () => {
    test('displays blind pass message for current player', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const blindPassEvent: PublicEvent = {
        BlindPassPerformed: { player: 'South', blind_count: 2, hand_count: 1 },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: blindPassEvent } } })
        );
      });

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'You passed 2 tiles blindly and 1 from hand'
      );
    });

    test('displays blind pass message for other player', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const blindPassEvent: PublicEvent = {
        BlindPassPerformed: { player: 'East', blind_count: 1, hand_count: 2 },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: blindPassEvent } } })
        );
      });

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'East passed 1 blind, 2 from hand'
      );
    });
  });

  describe('Test 6: IOU detection and resolution', () => {
    test('shows IOU overlay on IOUDetected event', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const iouEvent: PublicEvent = {
        IOUDetected: {
          debts: [
            ['East', 3],
            ['South', 3],
            ['West', 3],
            ['North', 3],
          ],
        },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: iouEvent } } })
        );
      });

      expect(screen.getByTestId('iou-overlay')).toBeInTheDocument();
      expect(screen.getByText(/IOU Scenario Detected/i)).toBeInTheDocument();
      expect(screen.getByTestId('iou-resolving-spinner')).toBeInTheDocument();
    });

    test('shows resolution summary on IOUResolved event', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // First trigger IOU detection
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: {
                Public: {
                  IOUDetected: {
                    debts: [
                      ['East', 3],
                      ['South', 3],
                      ['West', 3],
                      ['North', 3],
                    ],
                  },
                },
              },
            },
          })
        );
      });

      // Then resolve
      const resolveEvent: PublicEvent = {
        IOUResolved: {
          summary: 'IOU resolved - all players passed 2 tiles, East picked up final pass',
        },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: resolveEvent } } })
        );
      });

      expect(screen.getByTestId('iou-summary')).toHaveTextContent(
        'IOU resolved - all players passed 2 tiles, East picked up final pass'
      );
      expect(screen.queryByTestId('iou-resolving-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Test 7: Tile exchange flow', () => {
    test('removes hand tiles on TilesPassed and adds new tiles on TilesReceived', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass 3 tiles (standard, no blind)
      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));
      await user.click(getTileByValue(8));
      await user.click(screen.getByTestId('pass-tiles-button'));

      // Server acknowledges pass (only hand tiles in TilesPassed)
      const tilesPassedEvent: PrivateEvent = {
        TilesPassed: { player: 'South', tiles: [2, 5, 8] },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesPassedEvent } } })
        );
      });

      // Tiles should be removed
      await waitFor(() => {
        expect(queryTileByValue(2)).not.toBeInTheDocument();
        expect(queryTileByValue(5)).not.toBeInTheDocument();
        expect(queryTileByValue(8)).not.toBeInTheDocument();
      });

      // Server sends new tiles from right player (East for South seat in Left pass)
      const tilesReceivedEvent: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [3, 14, 25], from: 'East' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesReceivedEvent } } })
        );
      });

      // New tiles should appear
      await waitFor(() => {
        expect(getTileByValue(3)).toBeInTheDocument();
        expect(getTileByValue(14)).toBeInTheDocument();
        expect(getTileByValue(25)).toBeInTheDocument();
      });
    });
  });

  describe('Test 8: TilesPassing animation shows Left direction', () => {
    test('shows pass animation layer with Left', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const tilesPassingEvent: PublicEvent = {
        TilesPassing: { direction: 'Left' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: tilesPassingEvent } } })
        );
      });

      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Left/);
    });
  });

  describe('Test 9: Phase advancement to VotingToContinue', () => {
    test('advances to VotingToContinue on CharlestonPhaseChanged event', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const phaseChangedEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: 'VotingToContinue' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: phaseChangedEvent } } })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote/i);
      });

      // BlindPassPanel should be gone (VotingToContinue is not a blind pass stage)
      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();

      // Selection should be cleared
      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });
  });

  describe('Test 10: Joker blocking in hand selection', () => {
    test('Joker cannot be selected from hand during FirstLeft', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Tile 42 is Joker in the fixture hand
      const jokerTile = getTileByValue(42);
      await user.click(jokerTile);

      // Should not be selected - counter still 0
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3 selected');
    });
  });

  describe('Test 11: Full event sequence flow', () => {
    test('complete FirstLeft flow: mixed blind pass through phase advancement', async () => {
      const gameState = gameStates.charlestonFirstLeft;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // 1. Verify initial state
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();

      // 2. Set blind count to 1
      await user.click(screen.getByTestId('blind-increment'));
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('1');

      // 3. Select 2 tiles from hand
      await user.click(getTileByValue(10));
      await user.click(getTileByValue(13));
      expect(screen.getByTestId('selection-counter')).toHaveTextContent(
        '2 hand + 1 blind = 3 total'
      );
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();

      // 4. Submit pass
      await user.click(screen.getByTestId('pass-tiles-button'));
      expect(mockWs.send).toHaveBeenCalled();
      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();

      // 5. TilesPassed - hand tiles removed
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Private: { TilesPassed: { player: 'South', tiles: [10, 13] } } },
            },
          })
        );
      });
      await waitFor(() => {
        expect(queryTileByValue(10)).not.toBeInTheDocument();
      });

      // 6. BlindPassPerformed - public notification
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: {
                Public: { BlindPassPerformed: { player: 'South', blind_count: 1, hand_count: 2 } },
              },
            },
          })
        );
      });
      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'You passed 1 tiles blindly and 2 from hand'
      );

      // 7. PlayerReadyForPass events
      const readySeats = ['East', 'South', 'West', 'North'] as const;
      for (const seat of readySeats) {
        await act(async () => {
          mockWs.triggerMessage(
            JSON.stringify({
              kind: 'Event',
              payload: { event: { Public: { PlayerReadyForPass: { player: seat } } } },
            })
          );
        });
      }
      await waitFor(() => {
        expect(screen.getByTestId('ready-count')).toHaveTextContent('4/4');
      });

      // 8. TilesPassing animation
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: { event: { Public: { TilesPassing: { direction: 'Left' } } } },
          })
        );
      });
      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();

      // 9. TilesReceived from right player (East)
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: {
                Private: { TilesReceived: { player: 'South', tiles: [3, 14, 25], from: 'East' } },
              },
            },
          })
        );
      });
      await waitFor(() => {
        expect(getTileByValue(3)).toBeInTheDocument();
        expect(getTileByValue(14)).toBeInTheDocument();
        expect(getTileByValue(25)).toBeInTheDocument();
      });

      // 10. Phase advancement to VotingToContinue
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Public: { CharlestonPhaseChanged: { stage: 'VotingToContinue' } } },
            },
          })
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote/i);
      });
      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    });
  });
});
