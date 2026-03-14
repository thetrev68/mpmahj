/**
 * Integration Test: Declaring Mahjong (Self-Draw)
 *
 * Tests the full Mahjong self-draw flow from button click through scoring.
 * Event order per test scenario: HandValidated → MahjongDeclared → GameOver
 *
 * Related: US-018 (Declaring Mahjong - Self-Draw)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameState } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameResult } from '@/types/bindings/generated/GameResult';

describe('US-018: Declaring Mahjong (Self-Draw)', () => {
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

    // Discarding stage with 14 tiles - player South is in Discarding
    baseGameState = {
      game_id: 'test-game-mahjong',
      phase: { Playing: { Discarding: { player: 'South' } } },
      current_turn: 'South',
      dealer: 'East',
      round_number: 1,
      turn_number: 16,
      your_seat: 'South',
      // 14 tiles: Odds Only winning hand - 1B×3, 3C×3, 5D×3, 7B×3, 9D×2
      your_hand: [0, 0, 0, 11, 11, 11, 22, 22, 22, 6, 6, 6, 26, 26],
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
    };
  });

  describe('AC-1: Mahjong button appears when discarding with 14 tiles', () => {
    it('shows "Mahjong" button in Discarding stage when hand has 14 tiles', () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });

    it('does not show "Mahjong" when it is not my turn', () => {
      const notMyTurn: GameState = {
        ...baseGameState,
        phase: { Playing: { Discarding: { player: 'East' } } },
        current_turn: 'East',
      };
      renderWithProviders(<GameBoard initialState={notMyTurn} ws={mockWs} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    });

    it('shows disabled "Mahjong" when hand has fewer than 14 tiles', () => {
      const shortHand: GameState = {
        ...baseGameState,
        your_hand: [0, 0, 0, 11, 11, 11, 22, 22, 22, 6, 6, 6, 26], // 13 tiles
      };
      renderWithProviders(<GameBoard initialState={shortHand} ws={mockWs} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    });
  });

  describe('AC-2+3: Confirmation dialog and command dispatch', () => {
    it('opens confirmation dialog when Mahjong button clicked', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await user.click(screen.getByTestId('declare-mahjong-button'));

      expect(screen.getByTestId('mahjong-confirmation-dialog')).toBeInTheDocument();
    });

    it('sends DeclareMahjong command with winning_tile: null (self-draw) on confirm', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await user.click(screen.getByTestId('declare-mahjong-button'));
      await user.click(screen.getByRole('button', { name: /confirm mahjong/i }));

      // mockWs.send is a vi.fn — inspect calls to find the DeclareMahjong command
      const sentArgs = mockWs.send.mock.calls.map(([msg]) => JSON.parse(msg));
      const mahjongCmd = sentArgs.find(
        (env) => env?.payload?.command?.DeclareMahjong !== undefined
      );

      expect(mahjongCmd).toBeDefined();
      expect(mahjongCmd.payload.command.DeclareMahjong).toMatchObject({
        player: 'South',
        winning_tile: null,
      });
    });

    it('dismisses confirmation dialog when Cancel clicked', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await user.click(screen.getByTestId('declare-mahjong-button'));
      expect(screen.getByTestId('mahjong-confirmation-dialog')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByTestId('mahjong-confirmation-dialog')).not.toBeInTheDocument();
    });
  });

  describe('AC-4: Valid Mahjong flow (HandValidated → MahjongDeclared → GameOver)', () => {
    const gameResult: GameResult = {
      winner: 'South',
      winning_pattern: 'Odds Only',
      score_breakdown: {
        base_score: 35,
        self_draw_bonus: 0,
        total: 35,
        payments: { East: -35, West: -35, North: -35 },
      },
      final_scores: { East: -35, South: 105, West: -35, North: -35 },
      final_hands: {},
      next_dealer: 'East',
      end_condition: 'Win',
    };

    it('shows WinnerCelebration overlay on HandValidated { valid: true }', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South', valid: true, pattern: 'Odds Only' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('winner-celebration')).toBeInTheDocument();
      });
    });

    it('shows ScoringScreen after dismissing WinnerCelebration (AC-6: celebration → scoring flow)', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South', valid: true, pattern: 'Odds Only' },
      });
      await simulatePublicEvent({ GameOver: { winner: 'South' as Seat, result: gameResult } });

      // ScoringScreen must NOT appear yet — celebration is active
      expect(screen.queryByTestId('scoring-screen')).not.toBeInTheDocument();

      // Dismiss celebration; scoring screen should appear
      await waitFor(() => screen.getByTestId('winner-celebration-continue'));
      await user.click(screen.getByTestId('winner-celebration-continue'));

      await waitFor(() => {
        expect(screen.getByTestId('scoring-screen')).toBeInTheDocument();
      });
    });

    it('shows GameOverPanel after clicking Continue through both overlays', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South', valid: true, pattern: 'Odds Only' },
      });
      await simulatePublicEvent({ GameOver: { winner: 'South' as Seat, result: gameResult } });

      // Dismiss WinnerCelebration
      await waitFor(() => screen.getByTestId('winner-celebration-continue'));
      await user.click(screen.getByTestId('winner-celebration-continue'));

      // Now ScoringScreen is visible - dismiss it too
      await waitFor(() => screen.getByTestId('scoring-screen'));
      const scoringContinue = screen.getByRole('button', { name: /continue/i });
      await user.click(scoringContinue);

      await waitFor(() => {
        expect(screen.getByTestId('game-over-panel')).toBeInTheDocument();
      });
    });
  });

  describe('AC-5: Invalid Mahjong → dead hand', () => {
    it('shows dead hand message on HandValidated { valid: false }', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South', valid: false, pattern: null },
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid mahjong/i)).toBeInTheDocument();
      });
    });

    it('shows dead hand overlay on HandDeclaredDead event', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandDeclaredDead: { player: 'South', reason: 'Invalid Mahjong claim' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('dead-hand-notice')).toBeInTheDocument();
      });
    });
  });

  describe('AC-8: Bot Mahjong declaration', () => {
    it('shows announcement when another player declares Mahjong', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ MahjongDeclared: { player: 'North' as Seat } });

      await waitFor(() => {
        expect(screen.getByText(/North.*declaring Mahjong/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-10: Heavenly Hand', () => {
    it('shows HeavenlyHand overlay when HeavenlyHand event received', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ HeavenlyHand: { pattern: 'Odds Only', base_score: 70 } });

      await waitFor(() => {
        expect(screen.getByTestId('heavenly-hand-overlay')).toBeInTheDocument();
      });
    });

    it('shows pattern name and score in HeavenlyHand overlay', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({ HeavenlyHand: { pattern: 'Odds Only', base_score: 70 } });

      await waitFor(() => {
        expect(screen.getByText(/Odds Only/)).toBeInTheDocument();
        expect(screen.getByText(/70/)).toBeInTheDocument();
      });
    });
  });
});
