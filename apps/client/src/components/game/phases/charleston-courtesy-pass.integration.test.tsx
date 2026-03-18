import { describe, expect, test, beforeEach, vi, type Mock } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { CharlestonPhase } from '@/components/game/phases/CharlestonPhase';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useGameUIStore } from '@/stores/gameUIStore';

describe('CharlestonPhase courtesy action pane', () => {
  let mockGameState: GameStateSnapshot;
  let sendCommandMock: Mock<(cmd: GameCommand) => void>;

  beforeEach(() => {
    sendCommandMock = vi.fn<(cmd: GameCommand) => void>();
    useGameUIStore.getState().reset();

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

  test('renders the Charleston two-button model for CourtesyAcross', () => {
    renderWithProviders(
      <CharlestonPhase
        gameState={mockGameState}
        stage="CourtesyAcross"
        sendCommand={sendCommandMock}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Select 0–3 tiles to pass across, then press Proceed.'
    );
    expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-pass-tiles-button')).not.toBeInTheDocument();
  });

  test('submits courtesy proposals from staged rack tiles', async () => {
    const { user } = renderWithProviders(
      <CharlestonPhase
        gameState={mockGameState}
        stage="CourtesyAcross"
        sendCommand={sendCommandMock}
      />
    );

    await user.click(screen.getAllByTestId(/^tile-2-/)[0]);
    await user.click(screen.getAllByTestId(/^tile-5-/)[0]);
    await user.click(screen.getByTestId('proceed-button'));

    expect(sendCommandMock).toHaveBeenCalledWith({
      ProposeCourtesyPass: { player: 'East', tile_count: 2 },
    });

    await waitFor(() => {
      expect(screen.getByTestId('action-instruction')).toHaveTextContent(
        'Courtesy pass submitted. Waiting for player across...'
      );
    });
  });

  test('stays on the two-button model when agreement arrives', async () => {
    const { user } = renderWithProviders(
      <CharlestonPhase
        gameState={mockGameState}
        stage="CourtesyAcross"
        sendCommand={sendCommandMock}
      />
    );

    await user.click(screen.getAllByTestId(/^tile-2-/)[0]);
    await user.click(screen.getAllByTestId(/^tile-5-/)[0]);
    await user.click(screen.getByTestId('proceed-button'));

    act(() => {
      useGameUIStore.getState().dispatch({ type: 'SET_COURTESY_AGREEMENT', count: 2 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/2');
    });
    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
  });

  test('resets courtesy waiting state when stage changes', async () => {
    const { user, rerender } = renderWithProviders(
      <CharlestonPhase
        gameState={mockGameState}
        stage="CourtesyAcross"
        sendCommand={sendCommandMock}
      />
    );

    await user.click(screen.getByTestId('proceed-button'));

    rerender(
      <CharlestonPhase
        gameState={{ ...mockGameState, phase: { Playing: { Discarding: { player: 'East' } } } }}
        stage="Complete"
        sendCommand={sendCommandMock}
      />
    );

    expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
  });
});
