import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { CharlestonPhase } from './CharlestonPhase';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

const mockGameState: GameStateSnapshot = {
  game_id: 'test-game',
  phase: { Charleston: 'FirstRight' },
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

describe('CharlestonPhase layout ownership', () => {
  const sendCommand = (() => {}) as (cmd: GameCommand) => void;

  beforeEach(() => {
    useGameUIStore.getState().reset();
  });

  afterEach(() => {
    useGameUIStore.getState().reset();
  });

  test.each<CharlestonStage>(['FirstRight', 'FirstLeft', 'VotingToContinue', 'CourtesyAcross'])(
    'keeps stable named PlayerZone regions for %s',
    (stage) => {
      renderWithProviders(
        <CharlestonPhase gameState={mockGameState} stage={stage} sendCommand={sendCommand} />
      );

      expect(screen.getByTestId('player-zone-staging-slot')).toHaveAttribute(
        'data-board-region',
        'staging-region'
      );
      expect(screen.getByTestId('player-zone-actions-slot')).toHaveAttribute(
        'data-board-region',
        'action-region'
      );
      expect(screen.getByTestId('player-zone-rack-slot')).toHaveAttribute(
        'data-board-region',
        'rack-region'
      );
    }
  );

  test('renders exactly one Charleston selection counter inside the action region and not the rack', () => {
    renderWithProviders(
      <CharlestonPhase gameState={mockGameState} stage="FirstRight" sendCommand={sendCommand} />
    );

    const actionSlot = screen.getByTestId('player-zone-actions-slot');
    const rackSlot = screen.getByTestId('player-zone-rack-slot');

    expect(within(actionSlot).getByTestId('selection-counter')).toBeInTheDocument();
    expect(within(rackSlot).queryByTestId('selection-counter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-rack-selection-counter')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('selection-counter')).toHaveLength(1);
  });

  test('keeps the staging origin left-anchored when slot count expands for blind pass', () => {
    const { rerender } = renderWithProviders(
      <CharlestonPhase gameState={mockGameState} stage="FirstRight" sendCommand={sendCommand} />
    );

    const stagingSlot = screen.getByTestId('player-zone-staging-slot');
    const initialRow = within(stagingSlot).getByTestId('staging-slot-row');

    expect(stagingSlot).toHaveClass('justify-start');
    expect(initialRow).toHaveClass('origin-top-left');
    expect(initialRow.style.transformOrigin).toBe('top left');
    expect(screen.getAllByTestId(/staging-slot-\d$/)).toHaveLength(3);

    rerender(
      <CharlestonPhase gameState={mockGameState} stage="FirstLeft" sendCommand={sendCommand} />
    );

    const blindRow = within(screen.getByTestId('player-zone-staging-slot')).getByTestId(
      'staging-slot-row'
    );

    expect(screen.getByTestId('player-zone-staging-slot')).toHaveClass('justify-start');
    expect(blindRow).toHaveClass('origin-top-left');
    expect(blindRow.style.transformOrigin).toBe('top left');
    expect(screen.getAllByTestId(/staging-slot-\d$/)).toHaveLength(6);
  });
});
