/**
 * Integration Tests for US-003: Charleston First Across (Standard Pass)
 *
 * Test Scenario: charleston-first-across.md
 * User Story: US-003-charleston-first-across.md
 *
 * These tests verify the complete Charleston FirstAcross flow:
 * - Tracker shows "Pass Across" with bidirectional arrow (↔)
 * - Tile selection (3 tiles, standard pass)
 * - Pass Tiles command submission (blind_pass_count: null)
 * - Server event handling (TilesPassed, PlayerReadyForPass, TilesReceived from across)
 * - Phase advancement to FirstLeft
 *
 * Shared behaviors (Joker blocking, over-selection, deselection, double-submit)
 * are already tested in US-002 CharlestonFirstRight integration tests.
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

describe('US-003: Charleston First Across', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  const queryTileByValue = (value: number) =>
    screen.queryAllByTestId(new RegExp(`^tile-${value}-`))[0] ?? null;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  describe('Test 1: Complete First Across pass', () => {
    test('displays Charleston tracker with "Pass Across" and ↔ arrow', () => {
      const gameState = gameStates.charlestonFirstAcross;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Charleston tracker shows stage
      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('↔');

      // Selection counter shows 0/3
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');

      // Submission runs through the action bar; the strip stays lane-only
      expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
      const passButton = screen.getByTestId('proceed-button');
      expect(passButton).toBeInTheDocument();
      expect(passButton).toBeDisabled();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
      expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
    });

    test('renders player hand with 13 tiles', () => {
      const gameState = gameStates.charlestonFirstAcross;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Should render concealed hand
      expect(screen.getByTestId('player-rack')).toBeInTheDocument();

      // Hand has 13 tiles
      const hand = gameState.your_hand;
      hand.forEach((tile) => {
        expect(getTileByValue(tile)).toBeInTheDocument();
      });
    });

    test('allows selecting 3 tiles and enables Pass button', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Click 3 non-Joker tiles
      await user.click(getTileByValue(1)); // 2 Bam
      await user.click(getTileByValue(4)); // 5 Bam
      await user.click(getTileByValue(7)); // 8 Bam

      // Counter updates
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');

      // Pass button is now enabled
      expect(screen.getByTestId('proceed-button')).toBeEnabled();
    });

    test('sends CommitCharlestonPass command with forward_incoming_count 0', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3 tiles
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));

      // Click Pass Tiles
      await user.click(screen.getByTestId('proceed-button'));

      // Verify command shape matches bindings exactly
      const expectedCommand: GameCommand = {
        CommitCharlestonPass: {
          player: 'South', // your_seat from fixture
          from_hand: [1, 4, 7],
          forward_incoming_count: 0,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('disables hand and button after submitting pass', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));
      await user.click(screen.getByTestId('proceed-button'));

      // Button should be disabled after submit; staging strip shows processing state
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    test('removes tiles from hand on TilesPassed event', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass tiles
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));
      await user.click(screen.getByTestId('proceed-button'));

      // Simulate TilesPassed acknowledgment
      const tilesPassedEvent: PrivateEvent = {
        TilesPassed: { player: 'South', tiles: [1, 4, 7] },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesPassedEvent } } })
        );
      });

      // Passed tiles should be removed from hand
      await waitFor(() => {
        expect(queryTileByValue(1)).not.toBeInTheDocument();
        expect(queryTileByValue(4)).not.toBeInTheDocument();
        expect(queryTileByValue(7)).not.toBeInTheDocument();
      });
    });

    test('tracks ready players via PlayerReadyForPass events', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate players becoming ready
      const readyEvents: PublicEvent[] = [
        { PlayerReadyForPass: { player: 'East' } },
        { PlayerReadyForPass: { player: 'South' } },
        { PlayerReadyForPass: { player: 'West' } },
      ];

      for (const event of readyEvents) {
        await act(async () => {
          mockWs.triggerMessage(
            JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
          );
        });
      }

      // Per-seat readiness should update
      await waitFor(() => {
        expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('E✓');
        expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('S✓');
        expect(screen.getByTestId('ready-indicator-west')).toHaveTextContent('W✓');
        expect(screen.getByTestId('ready-indicator-north')).toHaveTextContent('N•');
      });
    });

    test('shows bot pass status message when bot becomes ready', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const readyEvent: PublicEvent = { PlayerReadyForPass: { player: 'West' } };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: readyEvent } } })
        );
      });

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'West (Bot) has passed tiles.'
      );
    });

    test('adds received tiles from across partner on TilesReceived event', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass tiles
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));
      await user.click(screen.getByTestId('proceed-button'));

      // Server acknowledges our pass
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Private: { TilesPassed: { player: 'South', tiles: [1, 4, 7] } } },
            },
          })
        );
      });

      // Server sends new tiles from across partner (North for South seat)
      const tilesReceivedEvent: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [22, 23, 24], from: 'North' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesReceivedEvent } } })
        );
      });

      // New tiles should appear in hand
      await waitFor(() => {
        expect(getTileByValue(22)).toBeInTheDocument();
        expect(getTileByValue(23)).toBeInTheDocument();
        expect(getTileByValue(24)).toBeInTheDocument();
      });
    });
  });

  describe('Test 2: TilesPassing animation shows Across direction', () => {
    test('shows pass animation layer with "Passing Across ↔"', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate TilesPassing event with Across direction
      const tilesPassingEvent: PublicEvent = {
        TilesPassing: { direction: 'Across' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: tilesPassingEvent } } })
        );
      });

      // Pass animation layer should appear
      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Across/);
    });
  });

  describe('Test 3: Phase advancement to FirstLeft', () => {
    test('advances to FirstLeft on CharlestonPhaseChanged event', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate phase change
      const phaseChangedEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: 'FirstLeft' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: phaseChangedEvent } } })
        );
      });

      // Tracker should update to "Left"
      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      });

      // Selection should be cleared, button disabled
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });
  });

  describe('Test 4: Full event sequence flow', () => {
    test('complete FirstAcross flow from selection through phase advancement', async () => {
      const gameState = gameStates.charlestonFirstAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // 1. Verify initial state
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('↔');
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();

      // 2. Select 3 tiles
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');
      expect(screen.getByTestId('proceed-button')).toBeEnabled();

      // 3. Submit pass
      await user.click(screen.getByTestId('proceed-button'));
      expect(mockWs.send).toHaveBeenCalled();
      expect(screen.getByTestId('proceed-button')).toBeDisabled();

      // 4. TilesPassed - tiles removed
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Private: { TilesPassed: { player: 'South', tiles: [1, 4, 7] } } },
            },
          })
        );
      });
      await waitFor(() => {
        expect(queryTileByValue(1)).not.toBeInTheDocument();
      });

      // 5. PlayerReadyForPass events - ready indicators update
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
        expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('E✓');
        expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('S✓');
        expect(screen.getByTestId('ready-indicator-west')).toHaveTextContent('W✓');
        expect(screen.getByTestId('ready-indicator-north')).toHaveTextContent('N✓');
      });

      // 6. TilesPassing animation
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: { event: { Public: { TilesPassing: { direction: 'Across' } } } },
          })
        );
      });
      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();

      // 7. TilesReceived from across partner (North)
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: {
                Private: { TilesReceived: { player: 'South', tiles: [22, 23, 24], from: 'North' } },
              },
            },
          })
        );
      });
      await waitFor(() => {
        expect(getTileByValue(22)).toBeInTheDocument();
        expect(getTileByValue(23)).toBeInTheDocument();
        expect(getTileByValue(24)).toBeInTheDocument();
      });

      // 8. CharlestonPhaseChanged to FirstLeft
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: { event: { Public: { CharlestonPhaseChanged: { stage: 'FirstLeft' } } } },
          })
        );
      });
      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      });
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });
  });
});
