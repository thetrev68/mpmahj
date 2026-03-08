/**
 * Integration Test: Courtesy Pass Negotiation
 *
 * Test scenario: charleston-courtesy-pass.md
 * User Story: US-007 - Charleston Courtesy Pass Negotiation
 */

import { describe, expect, test, beforeEach, vi, type Mock } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { CharlestonPhase } from '@/components/game/phases/CharlestonPhase';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('Courtesy Pass Integration', () => {
  let mockGameState: GameStateSnapshot;
  let sendCommandMock: Mock<(cmd: GameCommand) => void>;

  beforeEach(() => {
    sendCommandMock = vi.fn<(cmd: GameCommand) => void>();

    mockGameState = {
      game_id: 'test-game',
      phase: { Charleston: 'CourtesyAcross' },
      current_turn: 'East',
      dealer: 'East',
      round_number: 1,
      turn_number: 1,
      remaining_tiles: 144,
      discard_pile: [],
      players: [
        {
          seat: 'East',
          player_id: 'p1',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'South',
          player_id: 'p2',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'West',
          player_id: 'p3',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'North',
          player_id: 'p4',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
      ],
      house_rules: {
        ruleset: {
          card_year: 2025,
          timer_mode: 'Visible',
          blank_exchange_enabled: false,
          call_window_seconds: 5,
          charleston_timer_seconds: 30,
        },
        analysis_enabled: false,
      },
      charleston_state: null,
      your_seat: 'East',
      your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      wall_seed: 0n,
      wall_draw_index: 0,
      wall_break_point: 0,
      wall_tiles_remaining: 152,
    };
  });

  describe('AC-1: Courtesy Pass Phase Entry', () => {
    test('shows courtesy pass panel when entering CourtesyAcross stage', () => {
      renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByText(/Courtesy Pass Negotiation/i)).toBeInTheDocument();
    });
  });

  describe('AC-2: Proposing Courtesy Pass Count', () => {
    test('sends ProposeCourtesyPass command when user selects tile count', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      // User selects 2 tiles
      const button2 = screen.getByTestId('courtesy-count-2');
      await user.click(button2);

      expect(sendCommandMock).toHaveBeenCalledWith({
        ProposeCourtesyPass: { player: 'East', tile_count: 2 },
      });
    });

    test('shows waiting message after proposal', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      await user.click(screen.getByTestId('courtesy-count-2'));

      await waitFor(() => {
        expect(screen.getByText(/Proposed 2 tiles. Waiting for West/i)).toBeInTheDocument();
      });
    });

    test('disables buttons after proposal', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      await user.click(screen.getByTestId('courtesy-count-2'));

      await waitFor(() => {
        expect(screen.getByTestId('courtesy-count-0')).toBeDisabled();
        expect(screen.getByTestId('courtesy-count-1')).toBeDisabled();
        expect(screen.getByTestId('courtesy-count-2')).toBeDisabled();
        expect(screen.getByTestId('courtesy-count-3')).toBeDisabled();
      });
    });
  });

  describe('AC-5: Proposing Zero Tiles', () => {
    test('sends ProposeCourtesyPass with 0 tiles when Skip clicked', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      await user.click(screen.getByTestId('courtesy-count-0'));

      expect(sendCommandMock).toHaveBeenCalledWith({
        ProposeCourtesyPass: { player: 'East', tile_count: 0 },
      });
    });
  });

  describe('Integration: Full Flow', () => {
    test('user can propose 2 tiles and see negotiation status', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      // Initial render shows panel
      expect(screen.getByTestId('courtesy-pass-panel')).toBeInTheDocument();
      expect(screen.getByText(/Negotiate with West - select 0-3 tiles/i)).toBeInTheDocument();

      // User proposes 2 tiles
      await user.click(screen.getByTestId('courtesy-count-2'));

      // Waiting state shown
      await waitFor(() => {
        expect(screen.getByText(/Proposed 2 tiles. Waiting for West/i)).toBeInTheDocument();
      });

      // Command was sent correctly
      expect(sendCommandMock).toHaveBeenCalledTimes(1);
      expect(sendCommandMock).toHaveBeenCalledWith({
        ProposeCourtesyPass: { player: 'East', tile_count: 2 },
      });
    });

    test('shows across partner seat correctly for each player', () => {
      // East's across partner is West
      const { unmount } = renderWithProviders(
        <CharlestonPhase
          gameState={{ ...mockGameState, your_seat: 'East' }}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );
      expect(screen.getByText(/Negotiate with West - select 0-3 tiles/i)).toBeInTheDocument();
      unmount();

      // South's across partner is North
      renderWithProviders(
        <CharlestonPhase
          gameState={{ ...mockGameState, your_seat: 'South' }}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );
      expect(screen.getByText(/Negotiate with North - select 0-3 tiles/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles rapid clicks without duplicate commands', async () => {
      const { user } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      const button = screen.getByTestId('courtesy-count-2');

      // Rapid double-click
      await user.click(button);
      await user.click(button);

      // Should only send once (button gets disabled after first click)
      expect(sendCommandMock).toHaveBeenCalledTimes(1);
    });

    test('resets state when stage changes', () => {
      const { rerender } = renderWithProviders(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('courtesy-pass-panel')).toBeInTheDocument();

      // Change stage to Playing
      rerender(
        <CharlestonPhase
          gameState={{ ...mockGameState, phase: { Playing: { Discarding: { player: 'East' } } } }}
          stage="Complete"
          sendCommand={sendCommandMock}
        />
      );

      // Courtesy panel should not be visible
      expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
    });
  });
});
