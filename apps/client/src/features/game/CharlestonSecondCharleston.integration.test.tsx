/**
 * Integration Tests for US-006: Charleston Second Charleston (Optional)
 *
 * User Story: US-006-charleston-second-charleston.md
 *
 * These tests verify the complete Second Charleston flow:
 * - SecondLeft: "Pass Left ←" + "(Blind Pass Available)" + "2nd Charleston – Pass 1 of 3" (AC-1, AC-2, AC-6)
 * - SecondLeft BlindPassPanel present, standard / mixed / full-blind pass commands (AC-2)
 * - SecondLeft phase advances to SecondAcross (AC-3)
 * - SecondAcross: "Pass Across ↔" + "2nd Charleston – Pass 2 of 3", no BlindPassPanel (AC-3, AC-6)
 * - SecondAcross standard 3-tile pass command (AC-3)
 * - SecondAcross phase advances to SecondRight (AC-4)
 * - SecondRight: "Pass Right →" + "(Blind Pass Available)" + "2nd Charleston – Pass 3 of 3" (AC-4, AC-6)
 * - SecondRight BlindPassPanel present, blind pass commands (AC-4)
 * - SecondRight phase advances to CourtesyAcross (AC-5)
 * - Joker blocking in all Second Charleston stages
 * - BlindPassPerformed events displayed in SecondLeft and SecondRight
 * - Tile exchange flow (TilesPassed + TilesReceived) per stage
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

describe('US-006: Charleston Second Charleston (Optional)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  const queryTileByValue = (value: number) =>
    screen.queryAllByTestId(new RegExp(`^tile-${value}-`))[0] ?? null;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  /** Helper: send a public event through the mock WebSocket */
  const sendPublicEvent = async (event: Record<string, unknown>) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  /** Helper: send a private event through the mock WebSocket */
  const sendPrivateEvent = async (event: Record<string, unknown>) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: event } } })
      );
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SECOND LEFT (AC-1, AC-2, AC-6)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Test 1: SecondLeft – phase entry and UI (AC-1, AC-2, AC-6)', () => {
    test('displays Charleston tracker with "Pass Left" and ← arrow', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('←');
    });

    test('shows "(Blind Pass Available)" label on SecondLeft tracker (AC-2)', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/blind pass available/i);
    });

    test('shows "2nd Charleston – Pass 1 of 3" progress indicator (AC-1)', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '2nd Charleston – Pass 1 of 3'
      );
    });

    test('renders BlindPassPanel with controls (AC-2)', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('0');
      expect(screen.getByTestId('blind-increment')).toBeInTheDocument();
      expect(screen.getByTestId('blind-decrement')).toBeInTheDocument();
    });

    test('renders player hand with 13 tiles', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
      gameStates.charlestonSecondLeft.your_hand.forEach((tile: number) => {
        expect(getTileByValue(tile)).toBeInTheDocument();
      });
    });

    test('Pass Tiles button is disabled initially', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });
  });

  describe('Test 2: SecondLeft – standard pass (0 blind, 3 from hand) (AC-2)', () => {
    test('selects 3 tiles and sends PassTiles with blind_pass_count null', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />
      );

      // Hand: [0,3,6,9,12,16,18,21,25,27,29,31,42] — pick 3 non-Jokers
      await user.click(getTileByValue(0));
      await user.click(getTileByValue(3));
      await user.click(getTileByValue(6));

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [0, 3, 6], blind_pass_count: null },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 3: SecondLeft – mixed blind pass (AC-2)', () => {
    test('selects 1 blind + 2 from hand and sends correct command', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />
      );

      await user.click(screen.getByTestId('blind-increment'));
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('1');

      await user.click(getTileByValue(0));
      await user.click(getTileByValue(3));

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [0, 3], blind_pass_count: 1 },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 4: SecondLeft – full blind pass (3 blind, 0 from hand) (AC-2)', () => {
    test('selects 3 blind and sends correct command with empty tiles', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />
      );

      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('3');
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
      expect(screen.getByTestId('blind-pass-warning')).toBeInTheDocument();

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [], blind_pass_count: 3 },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 5: SecondLeft – BlindPassPerformed event display', () => {
    test('displays blind pass status for current player', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      const event: PublicEvent = {
        BlindPassPerformed: { player: 'South', blind_count: 2, hand_count: 1 },
      };
      await sendPublicEvent(event as unknown as Record<string, unknown>);

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'You passed 2 tiles blindly and 1 from hand'
      );
    });

    test('displays blind pass status for other player (bot)', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      const event: PublicEvent = {
        BlindPassPerformed: { player: 'West', blind_count: 3, hand_count: 0 },
      };
      await sendPublicEvent(event as unknown as Record<string, unknown>);

      // West is a bot in the fixture, so the message includes "(Bot)"
      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'West (Bot) passed 3 blind, 0 from hand'
      );
    });
  });

  describe('Test 6: SecondLeft – Joker is blocked from selection (AC-2)', () => {
    test('Joker tile (42) cannot be selected', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />
      );

      const jokerTile = getTileByValue(42);
      await user.click(jokerTile);

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3 selected');
    });
  });

  describe('Test 7: SecondLeft – tile exchange flow', () => {
    test('removes passed tiles and adds received tiles', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />
      );

      await user.click(getTileByValue(0));
      await user.click(getTileByValue(3));
      await user.click(getTileByValue(6));
      await user.click(screen.getByTestId('pass-tiles-button'));

      const tilesPassed: PrivateEvent = { TilesPassed: { player: 'South', tiles: [0, 3, 6] } };
      await sendPrivateEvent(tilesPassed as unknown as Record<string, unknown>);

      await waitFor(() => {
        expect(queryTileByValue(0)).not.toBeInTheDocument();
        expect(queryTileByValue(3)).not.toBeInTheDocument();
        expect(queryTileByValue(6)).not.toBeInTheDocument();
      });

      // In SecondLeft, South receives from East (right partner)
      const tilesReceived: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [2, 11, 20], from: 'East' },
      };
      await sendPrivateEvent(tilesReceived as unknown as Record<string, unknown>);

      await waitFor(() => {
        expect(getTileByValue(2)).toBeInTheDocument();
        expect(getTileByValue(11)).toBeInTheDocument();
        expect(getTileByValue(20)).toBeInTheDocument();
      });
    });
  });

  describe('Test 8: SecondLeft – TilesPassing animation shows Left direction', () => {
    test('shows pass animation layer with Left', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      const event: PublicEvent = { TilesPassing: { direction: 'Left' } };
      await sendPublicEvent(event as unknown as Record<string, unknown>);

      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Left/);
    });
  });

  describe('Test 9: SecondLeft – phase advances to SecondAcross (AC-3)', () => {
    test('advances to SecondAcross on CharlestonPhaseChanged', async () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondLeft} ws={mockWs} />);

      await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'SecondAcross' } });

      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      });

      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('↔');
      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '2nd Charleston – Pass 2 of 3'
      );
      // No blind pass panel for SecondAcross
      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECOND ACROSS (AC-3, AC-6)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Test 10: SecondAcross – phase entry and UI (AC-3, AC-6)', () => {
    test('displays Charleston tracker with "Pass Across" and ↔ arrow', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('↔');
    });

    test('shows "2nd Charleston – Pass 2 of 3" progress indicator (AC-3)', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '2nd Charleston – Pass 2 of 3'
      );
    });

    test('does NOT render BlindPassPanel (AC-3)', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    });

    test('renders player hand and Pass Tiles button disabled initially', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });
  });

  describe('Test 11: SecondAcross – standard 3-tile pass (AC-3)', () => {
    test('selects 3 tiles and sends PassTiles with blind_pass_count null', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      // Hand: [1,4,7,10,13,17,19,22,26,28,30,32,42]
      await user.click(getTileByValue(1));
      await user.click(getTileByValue(4));
      await user.click(getTileByValue(7));

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [1, 4, 7], blind_pass_count: null },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('Joker tile (42) cannot be selected during SecondAcross', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      await user.click(getTileByValue(42));
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3 selected');
    });
  });

  describe('Test 12: SecondAcross – phase advances to SecondRight (AC-4)', () => {
    test('advances to SecondRight on CharlestonPhaseChanged', async () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondAcross} ws={mockWs} />
      );

      await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'SecondRight' } });

      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);
      });

      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('→');
      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '2nd Charleston – Pass 3 of 3'
      );
      // Blind pass panel should appear for SecondRight
      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECOND RIGHT (AC-4, AC-5, AC-6)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Test 13: SecondRight – phase entry and UI (AC-4, AC-6)', () => {
    test('displays Charleston tracker with "Pass Right" and → arrow', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('→');
    });

    test('shows "(Blind Pass Available)" label on SecondRight tracker (AC-4)', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/blind pass available/i);
    });

    test('shows "2nd Charleston – Pass 3 of 3" progress indicator (AC-4)', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '2nd Charleston – Pass 3 of 3'
      );
    });

    test('renders BlindPassPanel with controls (AC-4)', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('0');
    });

    test('Pass Tiles button is disabled initially', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });
  });

  describe('Test 14: SecondRight – standard pass (0 blind, 3 from hand) (AC-4)', () => {
    test('selects 3 tiles and sends PassTiles with blind_pass_count null', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      // Hand: [2,5,8,11,14,15,20,23,24,27,29,33,42]
      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));
      await user.click(getTileByValue(8));

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [2, 5, 8], blind_pass_count: null },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 15: SecondRight – full blind pass (AC-4)', () => {
    test('selects 3 blind and sends correct command with empty tiles', async () => {
      const { user } = renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));
      await user.click(screen.getByTestId('blind-increment'));

      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('3');
      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expectedCommand: GameCommand = {
        PassTiles: { player: 'South', tiles: [], blind_pass_count: 3 },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  describe('Test 16: SecondRight – BlindPassPerformed event display', () => {
    test('displays blind pass status for other player (bot)', async () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      const event: PublicEvent = {
        BlindPassPerformed: { player: 'North', blind_count: 1, hand_count: 2 },
      };
      await sendPublicEvent(event as unknown as Record<string, unknown>);

      // North is a bot in the fixture, so the message includes "(Bot)"
      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'North (Bot) passed 1 blind, 2 from hand'
      );
    });
  });

  describe('Test 17: SecondRight – TilesPassing animation shows Right direction', () => {
    test('shows pass animation layer with Right', async () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      const event: PublicEvent = { TilesPassing: { direction: 'Right' } };
      await sendPublicEvent(event as unknown as Record<string, unknown>);

      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Right/);
    });
  });

  describe('Test 18: SecondRight – phase advances to CourtesyAcross (AC-5)', () => {
    test('advances to CourtesyAcross on CharlestonPhaseChanged', async () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
      );

      await sendPublicEvent({ CharlestonPhaseChanged: { stage: 'CourtesyAcross' } });

      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      });

      // CourtesyAcross has no blind pass
      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // FIRST CHARLESTON progress indicator (regression: should still show 1st)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Test 19: First Charleston still shows 1st Charleston indicator (regression)', () => {
    test('FirstRight shows "1st Charleston – Pass 1 of 3"', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />);

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '1st Charleston – Pass 1 of 3'
      );
    });

    test('FirstAcross shows "1st Charleston – Pass 2 of 3"', () => {
      renderWithProviders(
        <GameBoard initialState={gameStates.charlestonFirstAcross} ws={mockWs} />
      );

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '1st Charleston – Pass 2 of 3'
      );
    });

    test('FirstLeft shows "1st Charleston – Pass 3 of 3"', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

      expect(screen.getByTestId('charleston-progress')).toHaveTextContent(
        '1st Charleston – Pass 3 of 3'
      );
    });

    test('VotingToContinue does NOT show charleston-progress badge', () => {
      renderWithProviders(<GameBoard initialState={gameStates.charlestonVoting} ws={mockWs} />);

      expect(screen.queryByTestId('charleston-progress')).not.toBeInTheDocument();
    });
  });
});
