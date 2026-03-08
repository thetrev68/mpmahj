/**
 * Integration Test: Declaring Mahjong (Called Discard)
 *
 * Tests the full called-discard Mahjong flow from call window through scoring.
 * Covers: call intent → AwaitingMahjongValidation → validation dialog → DeclareMahjong → scoring.
 *
 * Related: US-019 (AC-1 through AC-7)
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

describe('US-019: Declaring Mahjong (Called Discard)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;
  let baseGameState: GameState;

  // South has 13 tiles — needs to call the 14th from East's discard
  const CONCEALED_13 = [0, 0, 0, 11, 11, 11, 22, 22, 22, 6, 6, 6, 26] as const;
  const CALLED_TILE = 26; // 9-Dot — completing "Odds Only" hand

  const simulatePublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  beforeEach(() => {
    mockWs = createMockWebSocket();

    // CallWindow stage: East discarded, South can call
    baseGameState = {
      game_id: 'test-game-called',
      phase: {
        Playing: {
          CallWindow: {
            tile: CALLED_TILE,
            discarded_by: 'East' as Seat,
            can_act: ['South', 'West', 'North'] as Seat[],
            pending_intents: [],
            timer: 5,
          },
        },
      },
      current_turn: 'East',
      dealer: 'East',
      round_number: 1,
      turn_number: 16,
      your_seat: 'South',
      your_hand: [...CONCEALED_13],
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
      remaining_tiles: 40,
      wall_seed: 12345n,
      wall_draw_index: 52,
      wall_break_point: 52,
      wall_tiles_remaining: 40,
      discard_pile: [
        {
          tile: CALLED_TILE,
          discarded_by: 'East',
          player: 'East',
          turn: 1,
          safe: false,
          called: false,
        },
      ],
    };
  });

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

  describe('AC-1: Call window shows Mahjong button', () => {
    it('shows "Call for Mahjong" button when CallWindowOpened received', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        CallWindowOpened: {
          tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
          can_call: ['South'] as Seat[],
          timer: 5,
          started_at_ms: Date.now() as unknown as bigint,
          timer_mode: 'Visible' as const,
        },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /call for mahjong/i })).toBeInTheDocument();
      });
    });
  });

  describe('AC-2: DeclareCallIntent sent when Call for Mahjong clicked', () => {
    it('sends DeclareCallIntent { intent: "Mahjong" } on button click', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        CallWindowOpened: {
          tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
          can_call: ['South'] as Seat[],
          timer: 5,
          started_at_ms: Date.now() as unknown as bigint,
          timer_mode: 'Visible' as const,
        },
      });

      await waitFor(() => screen.getByRole('button', { name: /call for mahjong/i }));
      await user.click(screen.getByRole('button', { name: /call for mahjong/i }));

      const sentArgs = mockWs.send.mock.calls.map(([msg]) => JSON.parse(msg));
      const intentCmd = sentArgs.find(
        (env) => env?.payload?.command?.DeclareCallIntent !== undefined
      );

      expect(intentCmd).toBeDefined();
      expect(intentCmd.payload.command.DeclareCallIntent).toMatchObject({
        intent: 'Mahjong',
      });
    });
  });

  describe('AC-4: AwaitingMahjongValidation → validation dialog', () => {
    it('shows MahjongValidationDialog when AwaitingMahjongValidation received for my seat', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'South' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('mahjong-validation-dialog')).toBeInTheDocument();
      });
    });

    it('does NOT show MahjongValidationDialog when AwaitingMahjongValidation is for another seat', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'West' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });

      // Give it a moment to potentially render incorrectly
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(screen.queryByTestId('mahjong-validation-dialog')).not.toBeInTheDocument();
    });

    it('sends DeclareMahjong with winning_tile = calledTile (not null)', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'South' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });

      await waitFor(() => screen.getByTestId('mahjong-validation-dialog'));
      await user.click(screen.getByRole('button', { name: /submit for validation/i }));

      const sentArgs = mockWs.send.mock.calls.map(([msg]) => JSON.parse(msg));
      const mahjongCmd = sentArgs.find(
        (env) => env?.payload?.command?.DeclareMahjong !== undefined
      );

      expect(mahjongCmd).toBeDefined();
      expect(mahjongCmd.payload.command.DeclareMahjong).toMatchObject({
        player: 'South',
        winning_tile: CALLED_TILE,
      });
      expect(mahjongCmd.payload.command.DeclareMahjong.winning_tile).not.toBeNull();
    });

    it('closes validation dialog after HandValidated response', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'South' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });

      await waitFor(() => screen.getByTestId('mahjong-validation-dialog'));

      // Server responds with valid hand
      await simulatePublicEvent({
        HandValidated: { player: 'South' as Seat, valid: true, pattern: 'Odds Only' },
      });

      await waitFor(() => {
        expect(screen.queryByTestId('mahjong-validation-dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('AC-5: HandValidated { valid: true } → WinnerCelebration', () => {
    it('shows WinnerCelebration on HandValidated { valid: true }', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South' as Seat, valid: true, pattern: 'Odds Only' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('winner-celebration')).toBeInTheDocument();
      });
    });
  });

  describe('AC-6: HandValidated { valid: false } → dead hand', () => {
    it('shows dead hand message on HandValidated { valid: false }', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        HandValidated: { player: 'South' as Seat, valid: false, pattern: null },
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid mahjong/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-7: ScoringScreen shows Called From (not self-draw)', () => {
    it('shows "Called From" row with discarder seat on ScoringScreen', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Trigger the called-discard flow to set calledFrom = 'East'
      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'South' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });

      await simulatePublicEvent({
        HandValidated: { player: 'South' as Seat, valid: true, pattern: 'Odds Only' },
      });
      await simulatePublicEvent({ GameOver: { winner: 'South' as Seat, result: gameResult } });

      // Dismiss WinnerCelebration
      await waitFor(() => screen.getByTestId('winner-celebration-continue'));
      await user.click(screen.getByTestId('winner-celebration-continue'));

      // ScoringScreen should show "Called From: East", not "Self-Draw: ✓"
      await waitFor(() => {
        expect(screen.getByTestId('scoring-screen')).toBeInTheDocument();
        expect(screen.getByTestId('called-from-row')).toBeInTheDocument();
        // The calledFrom seat appears inside the called-from-row
        expect(screen.getByTestId('called-from-row')).toHaveTextContent('East');
      });
    });

    it('does NOT show self-draw row when calledFrom is set', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        AwaitingMahjongValidation: {
          caller: 'South' as Seat,
          called_tile: CALLED_TILE,
          discarded_by: 'East' as Seat,
        },
      });
      await simulatePublicEvent({
        HandValidated: { player: 'South' as Seat, valid: true, pattern: 'Odds Only' },
      });
      await simulatePublicEvent({ GameOver: { winner: 'South' as Seat, result: gameResult } });

      await waitFor(() => screen.getByTestId('winner-celebration-continue'));
      await user.click(screen.getByTestId('winner-celebration-continue'));

      await waitFor(() => screen.getByTestId('scoring-screen'));

      // "Self-Draw: ✓" text should NOT be present
      const selfDrawRow = screen
        .queryAllByText(/self-draw/i)
        .find((el) => el.textContent?.includes('Self-Draw'));
      expect(selfDrawRow).toBeUndefined();
    });
  });
});
