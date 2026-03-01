/**
 * Integration Test: Wall Game Draw Flow
 *
 * Covers test scenario: test-scenarios/wall-game.md
 *
 * Related: US-021 (Wall Game - Draw)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameState } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';

describe('US-021: Wall Game (Draw)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;
  let baseGameState: GameState;

  const simulatePublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  const drawGameResult = {
    winner: null,
    winning_pattern: null,
    score_breakdown: null,
    final_scores: { East: 500, South: 485, West: 510, North: 505 } as Record<Seat, number>,
    final_hands: {},
    next_dealer: 'East' as Seat,
    end_condition: 'WallExhausted' as const,
  };

  beforeEach(() => {
    mockWs = createMockWebSocket();

    // Game state: East is about to draw last tile (1 remaining)
    baseGameState = {
      game_id: 'test-wall-game',
      phase: { Playing: { Drawing: { player: 'East' } } },
      current_turn: 'East',
      dealer: 'East',
      round_number: 1,
      turn_number: 72,
      your_seat: 'South',
      your_hand: [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 29, 31],
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
      remaining_tiles: 1,
      wall_seed: 99999n,
      wall_draw_index: 137,
      wall_break_point: 52,
      wall_tiles_remaining: 1,
      discard_pile: [],
    };
  });

  // ────────────────────────────────────────────────────────────────────────────
  // AC-1 + AC-2: Wall Exhaustion → Draw Overlay
  // ────────────────────────────────────────────────────────────────────────────

  describe('AC-1/AC-2: WallExhausted event triggers draw overlay', () => {
    it('shows draw overlay with "WALL GAME - No Winner" when WallExhausted fires', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });

      await waitFor(() => {
        expect(screen.getByTestId('draw-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('draw-overlay-title')).toHaveTextContent('WALL GAME - No Winner');
      });
    });

    it('displays "Wall exhausted" reason on the overlay', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });

      await waitFor(() => {
        expect(screen.getByTestId('draw-overlay')).toHaveTextContent('Wall exhausted');
      });
    });

    it('shows no winner message on the overlay', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });

      await waitFor(() => {
        const overlay = screen.getByTestId('draw-overlay');
        expect(overlay).toHaveTextContent('No Winner');
        expect(overlay).toHaveTextContent('Scores remain unchanged');
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // AC-3 + AC-4: Draw overlay → Scoring Screen → Game Over
  // ────────────────────────────────────────────────────────────────────────────

  describe('AC-3/AC-4: Draw overlay → Scoring Screen → Game Over Panel', () => {
    it('shows DrawScoringScreen after acknowledging draw overlay', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Trigger wall exhaustion then game over
      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });
      await simulatePublicEvent({ GameOver: { winner: null, result: drawGameResult } });

      // Draw overlay should be visible
      await waitFor(() => expect(screen.getByTestId('draw-overlay')).toBeInTheDocument());

      // DrawScoringScreen should NOT be visible yet (draw overlay is first)
      expect(screen.queryByTestId('draw-scoring-screen')).not.toBeInTheDocument();

      // Acknowledge the draw overlay
      await user.click(screen.getByTestId('draw-overlay-continue'));

      // DrawScoringScreen should now appear (not the win ScoringScreen)
      await waitFor(() => {
        expect(screen.queryByTestId('draw-overlay')).not.toBeInTheDocument();
        expect(screen.getByTestId('draw-scoring-screen')).toBeInTheDocument();
      });
    });

    it('shows GameOverPanel after continuing from DrawScoringScreen', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });
      await simulatePublicEvent({ GameOver: { winner: null, result: drawGameResult } });

      await waitFor(() => expect(screen.getByTestId('draw-overlay')).toBeInTheDocument());
      await user.click(screen.getByTestId('draw-overlay-continue'));

      await waitFor(() => expect(screen.getByTestId('draw-scoring-screen')).toBeInTheDocument());

      const continueBtn = screen.getByTestId('draw-scoring-continue');
      await user.click(continueBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('draw-scoring-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('game-over-panel')).toBeInTheDocument();
      });
    });

    it('does NOT show WinnerCelebration for draw game', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });
      await simulatePublicEvent({ GameOver: { winner: null, result: drawGameResult } });

      await waitFor(() => expect(screen.getByTestId('draw-overlay')).toBeInTheDocument());

      // WinnerCelebration should never appear
      expect(screen.queryByTestId('winner-celebration')).not.toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // AC-6: GameAbandoned → All Players Dead Hands draw overlay
  // ────────────────────────────────────────────────────────────────────────────

  describe('AC-6: GameAbandoned (AllPlayersDead) shows abandoned overlay', () => {
    it('shows draw overlay with "GAME ABANDONED" title for AllPlayersDead', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        GameAbandoned: { reason: 'AllPlayersDead', initiator: null },
      });

      await waitFor(() => {
        expect(screen.getByTestId('draw-overlay')).toBeInTheDocument();
        expect(screen.getByTestId('draw-overlay-title')).toHaveTextContent('GAME ABANDONED');
      });
    });

    it('shows "All players dead hands" reason for AllPlayersDead abandonment', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        GameAbandoned: { reason: 'AllPlayersDead', initiator: null },
      });

      await waitFor(() => {
        expect(screen.getByTestId('draw-overlay')).toHaveTextContent('All players dead hands');
      });
    });

    it('goes straight to GameOverPanel from abandoned overlay when no result', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        GameAbandoned: { reason: 'AllPlayersDead', initiator: null },
      });

      await waitFor(() => expect(screen.getByTestId('draw-overlay')).toBeInTheDocument());

      // No GameOver fired — continuing should show GameOverPanel directly
      await user.click(screen.getByTestId('draw-overlay-continue'));

      await waitFor(() => {
        expect(screen.queryByTestId('draw-overlay')).not.toBeInTheDocument();
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // AC-10: Bot behavior — no actions during draw
  // ────────────────────────────────────────────────────────────────────────────

  describe('AC-10: Bot behavior during draw', () => {
    it('does not send any commands after WallExhausted fires', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      const commandsBefore = mockWs.send.mock.calls.length;

      await simulatePublicEvent({ WallExhausted: { remaining_tiles: 0 } });
      await waitFor(() => expect(screen.getByTestId('draw-overlay')).toBeInTheDocument());

      // No additional commands should have been sent after wall exhaustion
      expect(mockWs.send.mock.calls.length).toBe(commandsBefore);
    });
  });
});
