/**
 * Integration Tests for US-002: Charleston First Right (Standard Pass)
 *
 * Test Scenario: charleston-standard.md
 * User Story: US-002-charleston-first-right.md
 *
 * These tests verify the complete Charleston FirstRight flow:
 * - Tile selection (3 tiles, Joker blocking)
 * - Pass Tiles command submission
 * - Server event handling (TilesPassed, PlayerReadyForPass, TilesReceived)
 * - Phase advancement to FirstAcross
 *
 * IMPORTANT: Command/event shapes match backend bindings (source of truth).
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';

describe('US-002: Charleston First Right', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  const queryTileByValue = (value: number) =>
    screen.queryAllByTestId(new RegExp(`^tile-${value}-`))[0] ?? null;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  describe('Test 1: Complete First Right pass', () => {
    test('displays Charleston tracker with "First Right" and selection counter', () => {
      const gameState = gameStates.charlestonFirstRight;

      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Charleston tracker shows stage
      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);

      // Selection counter shows 0/3
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');

      // Submission runs through the action bar; the strip stays lane-only
      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
      const passButton = screen.getByTestId('proceed-button');
      expect(passButton).toBeInTheDocument();
      expect(passButton).toBeDisabled();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
      expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
    });

    test('renders player hand with 13 tiles', () => {
      const gameState = gameStates.charlestonFirstRight;

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
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Click 3 non-Joker tiles
      await user.click(getTileByValue(0)); // 1 Bam
      await user.click(getTileByValue(1)); // 2 Bam
      await user.click(getTileByValue(2)); // 3 Bam

      // Counter updates
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');

      // Pass button is now enabled
      expect(screen.getByTestId('proceed-button')).toBeEnabled();
    });

    test('sends CommitCharlestonPass command when Pass Tiles button clicked', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3 tiles
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));

      // Click Pass Tiles
      await user.click(screen.getByTestId('proceed-button'));

      // Verify command shape matches bindings exactly
      const expectedCommand: GameCommand = {
        CommitCharlestonPass: {
          player: 'South', // your_seat from fixture
          from_hand: [0, 1, 2],
          forward_incoming_count: 0,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('disables hand and button after submitting pass', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));
      await user.click(screen.getByTestId('proceed-button'));

      // Button should be disabled (loading)
      expect(screen.getByTestId('proceed-button')).toBeDisabled();

      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    });

    test('removes tiles from hand on TilesPassed event', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass tiles
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));
      await user.click(screen.getByTestId('proceed-button'));

      // Simulate TilesPassed acknowledgment
      const tilesPassedEvent: PrivateEvent = {
        TilesPassed: { player: 'South', tiles: [0, 1, 2] },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesPassedEvent } } })
        );
      });

      // Passed tiles should be removed from hand
      await waitFor(() => {
        expect(queryTileByValue(0)).not.toBeInTheDocument();
        expect(queryTileByValue(1)).not.toBeInTheDocument();
        expect(queryTileByValue(2)).not.toBeInTheDocument();
      });
    });

    test('tracks ready players via PlayerReadyForPass events', async () => {
      const gameState = gameStates.charlestonFirstRight;
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

    test('shows opponent staging tile backs after PlayerStagedTile for North', async () => {
      const gameState = gameStates.charlestonFirstRight;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const stagedEvent: PublicEvent = {
        PlayerStagedTile: { player: 'North', count: 3 },
      };

      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: stagedEvent } } })
        );
      });

      await waitFor(() => {
        const stagingRow = screen.getByTestId('opponent-staging-north');
        expect(stagingRow.children).toHaveLength(3);
      });
    });

    test('keeps opponent staging tile backs visible after PlayerReadyForPass until TilesPassing', async () => {
      const gameState = gameStates.charlestonFirstRight;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Public: { PlayerStagedTile: { player: 'North', count: 3 } } },
            },
          })
        );
      });

      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Public: { PlayerReadyForPass: { player: 'North' } } },
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('opponent-staging-north').children).toHaveLength(3);
      });
    });

    test('adds received tiles to hand on TilesReceived event', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select and pass tiles
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));
      await user.click(screen.getByTestId('proceed-button'));

      // Server acknowledges our pass
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: { event: { Private: { TilesPassed: { player: 'South', tiles: [0, 1, 2] } } } },
          })
        );
      });

      // Server sends new tiles
      const tilesReceivedEvent: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [22, 23, 24], from: 'West' },
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

    test('advances to FirstAcross on CharlestonPhaseChanged event', async () => {
      const gameState = gameStates.charlestonFirstRight;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate phase change
      const phaseChangedEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: 'FirstAcross' },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: phaseChangedEvent } } })
        );
      });

      // Tracker should update to "Across"
      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      });

      // Selection should be cleared, button disabled
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });
  });

  describe('Test 2: Jokers cannot be selected', () => {
    test('Joker tile shows disabled state during Charleston', () => {
      const gameState = gameStates.charlestonFirstRight;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const jokerTile = getTileByValue(TILE_INDICES.JOKER);
      expect(jokerTile).toHaveClass('tile-disabled');
    });

    test('clicking Joker does not select it', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(TILE_INDICES.JOKER));

      // Selection count should still be 0
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
    });
  });

  describe('Test 3: Cannot select more than 3 tiles', () => {
    test('4th tile click does not increase selection beyond 3', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3 tiles
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));

      // Try to select a 4th
      await user.click(getTileByValue(9));

      // Should still be 3
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');
    });
  });

  describe('Test 4: Deselection works', () => {
    test('clicking selected tile deselects it', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));

      // Deselect one
      await user.click(getTileByValue(1));

      // Should be 2/3
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/3');

      // Pass button should be disabled
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });
  });

  describe('Test 5: Double-submit prevention', () => {
    test('only sends one CommitCharlestonPass command on rapid clicks', async () => {
      const gameState = gameStates.charlestonFirstRight;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Select 3 tiles
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(2));

      // Click pass button twice rapidly
      const passButton = screen.getByTestId('proceed-button');
      await user.click(passButton);
      await user.click(passButton);

      // Only one command should be sent
      const sendCalls = mockWs.send.mock.calls.filter((call) => {
        const envelope = JSON.parse(call[0] as string);
        return envelope.kind === 'Command' && 'CommitCharlestonPass' in envelope.payload.command;
      });
      expect(sendCalls).toHaveLength(1);
    });
  });
});
