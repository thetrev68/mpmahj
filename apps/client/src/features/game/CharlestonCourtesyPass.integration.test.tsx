/**
 * Integration Tests for US-007: Charleston Courtesy Pass Negotiation
 *
 * Tests the full event-driven flow using GameBoard + MockWebSocket:
 * - Proposal → server events → negotiation result → tile selection → submission
 *
 * AC-3: Agreement (both propose same count)
 * AC-4: Mismatch (different counts, lower wins)
 * AC-5: Zero tiles (no exchange)
 * AC-6: Tile selection after agreement
 * AC-7: AcceptCourtesyPass command sent
 * AC-8: TilesReceived updates hand
 * AC-10: CourtesyPassComplete resets state
 * EC-2: Zero agreed count (skips tile selection)
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('US-007: Courtesy Pass Negotiation (Integration)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const sendPublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  const sendPrivateEvent = async (event: PrivateEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: event } } })
      );
    });
  };

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Phase Entry
  // ---------------------------------------------------------------------------

  describe('AC-1: Courtesy Pass Phase Entry', () => {
    test('shows courtesy pass panel when in CourtesyAcross stage', () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('courtesy-pass-panel')).toBeInTheDocument();
      expect(screen.getByText(/Courtesy Pass Negotiation/i)).toBeInTheDocument();
    });

    test('shows negotiate message with across partner (South → North)', () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // South's across partner is North
      expect(screen.getByText(/Negotiate with North - select 0-3 tiles/i)).toBeInTheDocument();
    });

    test('hand is visible but tile selection is inactive before negotiation', () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
      // No selection counter or pass button visible yet (mode is view-only until agreement)
      expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2: Proposing Courtesy Pass Count
  // ---------------------------------------------------------------------------

  describe('AC-2: Proposing Courtesy Pass Count', () => {
    test('sends ProposeCourtesyPass command when tile count selected', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      const expectedCommand: GameCommand = {
        ProposeCourtesyPass: { player: 'South', tile_count: 2 },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('shows waiting message after proposal', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await waitFor(() => {
        expect(screen.getByText(/Proposed 2 tiles. Waiting for North/i)).toBeInTheDocument();
      });
    });

    test('disables proposal buttons after proposal', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-count-0')).toBeDisabled();
        expect(screen.getByTestId('courtesy-count-2')).toBeDisabled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-3: Agreement (both propose same count)
  // ---------------------------------------------------------------------------

  describe('AC-3: Both Partners Propose Same Count (Agreement)', () => {
    test('shows agreement status when CourtesyPairReady fires with tile_count > 0', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Propose 2 tiles
      await user.click(screen.getByTestId('courtesy-count-2'));

      // Server responds with agreement
      const pairReadyEvent: PrivateEvent = {
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      };
      await sendPrivateEvent(pairReadyEvent);

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
        expect(screen.getByText(/Agreed to pass 2 tiles with North/i)).toBeInTheDocument();
      });
    });

    test('hides proposal panel and shows status after agreement', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      await waitFor(() => {
        // Proposal panel hidden after agreement
        expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
        expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
      });
    });

    test('shows selection counter after agreement with agreed count', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      await waitFor(() => {
        // Selection counter appears with 0/2
        expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/2');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-4: Mismatch (different counts, lower wins)
  // ---------------------------------------------------------------------------

  describe('AC-4: Partners Propose Different Counts (Mismatch)', () => {
    test('shows mismatch status when CourtesyPassMismatch fires', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-3'));

      const mismatchEvent: PrivateEvent = {
        CourtesyPassMismatch: {
          pair: ['South', 'North'],
          proposed: [3, 1],
          agreed_count: 1,
        },
      };
      await sendPrivateEvent(mismatchEvent);

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
        expect(screen.getByText(/Mismatch! You proposed 3, North proposed 1/i)).toBeInTheDocument();
        expect(screen.getByText(/Agreed on 1 tile \(lower count wins\)/i)).toBeInTheDocument();
      });
    });

    test('shows tile selection for agreed count (1) after mismatch', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-3'));

      await sendPrivateEvent({
        CourtesyPassMismatch: {
          pair: ['South', 'North'],
          proposed: [3, 1],
          agreed_count: 1,
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/1');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-5: Zero Tiles (no exchange)
  // ---------------------------------------------------------------------------

  describe('AC-5: Proposing Zero Tiles (No Exchange)', () => {
    test('sends ProposeCourtesyPass with 0 when Skip clicked', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-0'));

      const expectedCommand: GameCommand = {
        ProposeCourtesyPass: { player: 'South', tile_count: 0 },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('shows zero courtesy pass message when CourtesyPairReady tile_count is 0', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-0'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 0 },
      });

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
        // No tile selection counter shown for zero pass
        expect(screen.queryByTestId('selection-counter')).not.toBeInTheDocument();
        expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-6: Tile Selection After Agreement
  // ---------------------------------------------------------------------------

  describe('AC-6: Tile Selection After Agreement', () => {
    test('allows selecting exactly agreed count tiles, Joker is blocked', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      await waitFor(() => screen.getByTestId('selection-counter'));

      // Select 2 tiles (tile 2 and tile 5 from fixture hand)
      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));

      await waitFor(() => {
        expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/2');
      });
    });

    test('enables Pass Tiles button when correct tile count selected', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      // Wait for courtesy pass button to appear (ActionBar shown after agreement)
      await waitFor(() => screen.getByTestId('courtesy-pass-tiles-button'));

      // Button disabled with 0 selected
      expect(screen.getByTestId('courtesy-pass-tiles-button')).toBeDisabled();

      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-pass-tiles-button')).not.toBeDisabled();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-7: Pass Submission
  // ---------------------------------------------------------------------------

  describe('AC-7: Pass Submission', () => {
    test('sends AcceptCourtesyPass command with selected tiles', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      await waitFor(() => screen.getByTestId('selection-counter'));

      await user.click(getTileByValue(2));
      await user.click(getTileByValue(5));

      await waitFor(() => screen.getByTestId('courtesy-pass-tiles-button'));
      await user.click(screen.getByTestId('courtesy-pass-tiles-button'));

      const expectedCommand: GameCommand = {
        AcceptCourtesyPass: { player: 'South', tiles: [2, 5] },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // AC-8: Tiles Exchange (Across)
  // ---------------------------------------------------------------------------

  describe('AC-8: Tiles Received', () => {
    test('adds received tiles to hand after TilesReceived event', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Receive tiles from across partner (North)
      const tilesReceivedEvent: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [3, 7], from: 'North' },
      };
      await sendPrivateEvent(tilesReceivedEvent);

      await waitFor(() => {
        // New tiles should appear in hand
        expect(screen.getAllByTestId(/^tile-3-/)[0]).toBeInTheDocument();
        expect(screen.getAllByTestId(/^tile-7-/)[0]).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-10: Courtesy Pass Completion
  // ---------------------------------------------------------------------------

  describe('AC-10: Courtesy Pass Completion', () => {
    test('resets courtesy state when CourtesyPassComplete fires', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Go through a full flow
      await user.click(screen.getByTestId('courtesy-count-2'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 2 },
      });

      await waitFor(() => screen.getByTestId('courtesy-negotiation-status'));

      // Server signals all pairs done
      await sendPublicEvent('CourtesyPassComplete');

      // Phase changes to playing shortly after
      await sendPublicEvent({
        CharlestonPhaseChanged: { stage: 'Complete' },
      });

      // After reset, the negotiation status should be gone
      await waitFor(() => {
        expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // EC-2: Zero agreed count (mismatch resulting in 0)
  // ---------------------------------------------------------------------------

  describe('EC-2: Zero Proposal (No Exchange)', () => {
    test('shows zero status when CourtesyPassMismatch agreed_count is 0', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-0'));

      // Partner proposed 2, but I proposed 0 → agreed 0
      const mismatchEvent: PrivateEvent = {
        CourtesyPassMismatch: {
          pair: ['South', 'North'],
          proposed: [0, 2],
          agreed_count: 0,
        },
      };
      await sendPrivateEvent(mismatchEvent);

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
        // No tile selection for zero agreed count
        expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
      });
    });

    test('partner proposed 0 via CourtesyPairReady: no tile selection', async () => {
      const gameState = gameStates.charlestonCourtesyAcross;
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(screen.getByTestId('courtesy-count-0'));

      await sendPrivateEvent({
        CourtesyPairReady: { pair: ['South', 'North'], tile_count: 0 },
      });

      await waitFor(() => {
        expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('selection-counter')).not.toBeInTheDocument();
      });
    });
  });
});
