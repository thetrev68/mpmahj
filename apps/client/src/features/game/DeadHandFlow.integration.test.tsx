/**
 * Integration Test: Invalid Mahjong → Dead Hand Flow
 *
 * Covers test scenarios:
 *   - mahjong-invalid.md: Invalid self-draw Mahjong declaration
 *   - dead-hand-tile-count.md: Wrong tile count validation
 *
 * Related: US-020 (Invalid Mahjong → Dead Hand)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameState } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';

describe('US-020: Invalid Mahjong → Dead Hand', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;
  let baseGameState: GameState;

  const simulatePublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  beforeEach(() => {
    mockWs = createMockWebSocket();

    // South is in Discarding stage with 14 tiles (an invalid hand - not a valid NMJL pattern)
    baseGameState = {
      game_id: 'test-dead-hand',
      phase: { Playing: { Discarding: { player: 'South' } } },
      current_turn: 'South',
      dealer: 'East',
      round_number: 1,
      turn_number: 5,
      your_seat: 'South',
      // 14 tiles that don't form any valid NMJL pattern
      your_hand: [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 29, 31, 32],
      house_rules: {
        ruleset: {
          card_year: 2025,
          timer_mode: 'Visible',
          blank_exchange_enabled: false,
          call_window_seconds: 5,
          charleston_timer_seconds: 30,
        },
        analysis_enabled: false,
        concealed_bonus_enabled: false,
        dealer_bonus_enabled: false,
      },
      charleston_state: null,
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
          tile_count: 14,
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
      remaining_tiles: 44,
      wall_seed: 12345n,
      wall_draw_index: 52,
      wall_break_point: 52,
      wall_tiles_remaining: 44,
      discard_pile: [],
      exposed_melds: { East: [], South: [], West: [], North: [] },
    };
  });

  // ==============================
  // Scenario: mahjong-invalid.md
  // ==============================

  describe('Invalid self-draw Mahjong (mahjong-invalid.md)', () => {
    describe('AC-1 / HandValidated(false) flow', () => {
      it('shows dead hand notice after HandValidated(false) + HandDeclaredDead events', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        // Step 1: Player declares Mahjong (MahjongDeclared is broadcast)
        await simulatePublicEvent({ MahjongDeclared: { player: 'South' } });

        // Step 2: Server validates and finds no match
        await simulatePublicEvent({
          HandValidated: { player: 'South', valid: false, pattern: null },
        });

        // Step 3: Server declares hand dead
        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // Assert dead hand notice is visible
        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-notice')).toBeInTheDocument();
        });
        expect(screen.getByTestId('dead-hand-notice')).toHaveTextContent(
          "South's hand is declared dead"
        );
      });

      it('shows dead hand overlay with reason for the penalized player', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({ MahjongDeclared: { player: 'South' } });
        await simulatePublicEvent({
          HandValidated: { player: 'South', valid: false, pattern: null },
        });
        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // Overlay must appear for the penalized player (South === our seat)
        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-overlay')).toBeInTheDocument();
        });
        expect(screen.getByTestId('dead-hand-overlay')).toHaveTextContent('Invalid Mahjong claim');
        expect(screen.getByTestId('dead-hand-overlay')).toHaveTextContent('DEAD HAND PENALTY');
      });

      it('hides dead hand overlay after player acknowledges', async () => {
        const { user } = renderWithProviders(
          <GameBoard initialState={baseGameState} ws={mockWs} />
        );

        await simulatePublicEvent({ MahjongDeclared: { player: 'South' } });
        await simulatePublicEvent({
          HandValidated: { player: 'South', valid: false, pattern: null },
        });
        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-overlay')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('dead-hand-acknowledge'));

        expect(screen.queryByTestId('dead-hand-overlay')).not.toBeInTheDocument();
      });

      it('does NOT show overlay when a different player (East) has dead hand', async () => {
        // We are South; East is penalized — no overlay for us
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({ MahjongDeclared: { player: 'East' } });
        await simulatePublicEvent({
          HandValidated: { player: 'East', valid: false, pattern: null },
        });
        await simulatePublicEvent({
          HandDeclaredDead: { player: 'East', reason: 'Invalid Mahjong claim' },
        });

        // Should not show overlay (we are South, not East)
        await waitFor(() => {
          expect(screen.queryByTestId('dead-hand-overlay')).not.toBeInTheDocument();
        });
      });
    });

    describe('AC-2: Dead hand badge shown for penalized player', () => {
      it('shows DEAD HAND badge at South position after HandDeclaredDead', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
        });
        expect(screen.getByTestId('dead-hand-badge-south')).toHaveTextContent('DEAD HAND');
      });

      it('shows DEAD HAND badge for East when East is penalized', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'East', reason: 'Invalid Mahjong claim' },
        });

        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-badge-east')).toBeInTheDocument();
        });
      });
    });

    describe('AC-3 / EC-2: Dead hand player cannot declare Mahjong again', () => {
      it('hides Declare Mahjong button after South is declared dead hand', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        // Before dead hand: button should be present (14 tiles, discarding stage)
        expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // After dead hand: button should be gone
        await waitFor(() => {
          expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
        });
      });
    });

    describe('AC-4: PlayerSkipped event shows skip message', () => {
      it('shows skip notice when PlayerSkipped event received', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // Next turn: South's turn is skipped
        await simulatePublicEvent({
          PlayerSkipped: { player: 'South', reason: 'Dead hand' },
        });

        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-notice')).toBeInTheDocument();
        });
        expect(screen.getByTestId('dead-hand-notice')).toHaveTextContent('skipped');
      });
    });

    describe('Dead hand persists across turns', () => {
      it('keeps DEAD HAND badge after turn changes to another player', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // Turn changes to West
        await simulatePublicEvent({
          TurnChanged: { player: 'West', stage: { Drawing: { player: 'West' } } },
        });

        // Badge should still be present
        await waitFor(() => {
          expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
        });
      });

      it('keeps Declare Mahjong button hidden after dead hand when turn returns', async () => {
        renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

        await simulatePublicEvent({
          HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
        });

        // Turn goes to West then comes back to South (Discarding)
        await simulatePublicEvent({
          TurnChanged: { player: 'West', stage: { Drawing: { player: 'West' } } },
        });
        await simulatePublicEvent({
          TurnChanged: { player: 'South', stage: { Discarding: { player: 'South' } } },
        });

        // Still no Declare Mahjong button for dead-hand player
        await waitFor(() => {
          expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
        });
      });
    });
  });

  // ==============================
  // Scenario: dead-hand-tile-count.md
  // ==============================

  describe('Wrong tile count (dead-hand-tile-count.md)', () => {
    it('shows dead hand overlay with WrongTileCount reason', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South', valid: false, pattern: null },
      });
      await simulatePublicEvent({
        HandDeclaredDead: { player: 'South', reason: 'WrongTileCount' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('dead-hand-overlay')).toBeInTheDocument();
      });
      expect(screen.getByTestId('dead-hand-overlay')).toHaveTextContent('WrongTileCount');
    });

    it('disables Declare Mahjong button after WrongTileCount dead hand', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();

      await simulatePublicEvent({
        HandDeclaredDead: { player: 'South', reason: 'WrongTileCount' },
      });

      await waitFor(() => {
        expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
      });
    });

    it('shows dead hand badge with WrongTileCount reason', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandDeclaredDead: { player: 'South', reason: 'WrongTileCount' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
      });
    });
  });

  // ==============================
  // Multiple dead hands (AC-6)
  // ==============================

  describe('AC-6: Multiple dead hands', () => {
    it('shows dead hand badges for all penalized players', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandDeclaredDead: { player: 'East', reason: 'Invalid Mahjong claim' },
      });
      await simulatePublicEvent({
        HandDeclaredDead: { player: 'West', reason: 'Invalid Mahjong claim' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('dead-hand-badge-east')).toBeInTheDocument();
        expect(screen.getByTestId('dead-hand-badge-west')).toBeInTheDocument();
      });
    });
  });
});
