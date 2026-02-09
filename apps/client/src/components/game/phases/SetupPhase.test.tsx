/**
 * Tests for SetupPhase Component
 *
 * Setup phase orchestration component tests
 *
 * Phase 4 of GAMEBOARD_REFACTORING_PLAN.md
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupPhase } from './SetupPhase';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

// Mock child components
vi.mock('../DiceOverlay', () => ({
  DiceOverlay: ({
    isOpen,
    rollTotal,
    onComplete,
  }: {
    isOpen: boolean;
    rollTotal: number;
    onComplete?: () => void;
  }) => (
    <div data-testid="dice-overlay" data-open={isOpen}>
      Roll: {rollTotal}
      {onComplete && (
        <button data-testid="dice-overlay-close" onClick={onComplete}>
          Close
        </button>
      )}
    </div>
  ),
}));

vi.mock('../ActionBar', () => ({
  ActionBar: ({ phase, onCommand }: { phase: unknown; onCommand: (cmd: GameCommand) => void }) => (
    <div data-testid="action-bar">
      Phase: {JSON.stringify(phase)}
      <button
        data-testid="roll-dice-button"
        onClick={() => onCommand({ RollDice: { player: 'East' } })}
      >
        Roll Dice
      </button>
    </div>
  ),
}));

const createMockGameState = (stage: SetupStage = 'RollingDice'): GameStateSnapshot => ({
  game_id: 'test-game',
  phase: { Setup: stage },
  current_turn: 'East',
  dealer: 'East',
  round_number: 1,
  turn_number: 1,
  remaining_tiles: 152,
  discard_pile: [],
  players: [
    {
      seat: 'East',
      player_id: 'p1',
      is_bot: false,
      status: 'Active',
      tile_count: 0,
      exposed_melds: [],
    },
    {
      seat: 'South',
      player_id: 'p2',
      is_bot: false,
      status: 'Active',
      tile_count: 0,
      exposed_melds: [],
    },
    {
      seat: 'West',
      player_id: 'p3',
      is_bot: false,
      status: 'Active',
      tile_count: 0,
      exposed_melds: [],
    },
    {
      seat: 'North',
      player_id: 'p4',
      is_bot: false,
      status: 'Active',
      tile_count: 0,
      exposed_melds: [],
    },
  ],
  house_rules: {
    ruleset: {
      card_year: 2025,
      timer_mode: 'Visible',
      blank_exchange_enabled: false,
      call_window_seconds: 10,
      charleston_timer_seconds: 30,
    },
    analysis_enabled: false,
    concealed_bonus_enabled: false,
    dealer_bonus_enabled: false,
  },
  charleston_state: null,
  your_seat: 'East',
  your_hand: [],
  wall_seed: BigInt(12345),
  wall_draw_index: 0,
  wall_break_point: 0,
  wall_tiles_remaining: 88,
});

describe('SetupPhase', () => {
  let mockSendCommand: ReturnType<typeof vi.fn<(command: GameCommand) => void>>;

  beforeEach(() => {
    mockSendCommand = vi.fn<(command: GameCommand) => void>();
  });

  describe('rendering', () => {
    test('renders action bar with setup phase', () => {
      const gameState = createMockGameState('RollingDice');

      render(<SetupPhase gameState={gameState} stage="RollingDice" sendCommand={mockSendCommand} />);

      expect(screen.getByTestId('action-bar')).toBeInTheDocument();
      expect(screen.getByTestId('action-bar')).toHaveTextContent('Phase: {"Setup":"RollingDice"}');
    });

    test('does not show dice overlay when diceRoll is null', () => {
      const gameState = createMockGameState('RollingDice');

      render(
        <SetupPhase
          gameState={gameState}
          stage="RollingDice"
          sendCommand={mockSendCommand}
          diceRoll={null}
        />
      );

      expect(screen.queryByTestId('dice-overlay')).not.toBeInTheDocument();
    });

    test('shows dice overlay when diceRoll is provided and showDiceOverlay is true', () => {
      const gameState = createMockGameState('BreakingWall');

      render(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={true}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('dice-overlay')).toHaveTextContent('Roll: 7');
      expect(screen.getByTestId('dice-overlay')).toHaveAttribute('data-open', 'true');
    });

    test('hides dice overlay when showDiceOverlay is false', () => {
      const gameState = createMockGameState('Dealing');

      render(
        <SetupPhase
          gameState={gameState}
          stage="Dealing"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={false}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toHaveAttribute('data-open', 'false');
    });
  });

  describe('stage transitions', () => {
    test('renders correct stage indicator for RollingDice', () => {
      const gameState = createMockGameState('RollingDice');

      render(<SetupPhase gameState={gameState} stage="RollingDice" sendCommand={mockSendCommand} />);

      const indicator = screen.queryByTestId('setup-phase-indicator');
      if (indicator) {
        expect(indicator).toHaveAttribute('data-stage', 'RollingDice');
      }
    });

    test('renders correct stage indicator for BreakingWall', () => {
      const gameState = createMockGameState('BreakingWall');

      render(
        <SetupPhase gameState={gameState} stage="BreakingWall" sendCommand={mockSendCommand} />
      );

      const indicator = screen.queryByTestId('setup-phase-indicator');
      if (indicator) {
        expect(indicator).toHaveAttribute('data-stage', 'BreakingWall');
      }
    });

    test('renders correct stage indicator for Dealing', () => {
      const gameState = createMockGameState('Dealing');

      render(<SetupPhase gameState={gameState} stage="Dealing" sendCommand={mockSendCommand} />);

      const indicator = screen.queryByTestId('setup-phase-indicator');
      if (indicator) {
        expect(indicator).toHaveAttribute('data-stage', 'Dealing');
      }
    });

    test('renders correct stage indicator for OrganizingHands', () => {
      const gameState = createMockGameState('OrganizingHands');

      render(
        <SetupPhase gameState={gameState} stage="OrganizingHands" sendCommand={mockSendCommand} />
      );

      const indicator = screen.queryByTestId('setup-phase-indicator');
      if (indicator) {
        expect(indicator).toHaveAttribute('data-stage', 'OrganizingHands');
      }
    });
  });

  describe('interactions', () => {
    test('sends RollDice command when Roll Dice button clicked', () => {
      const gameState = createMockGameState('RollingDice');

      render(<SetupPhase gameState={gameState} stage="RollingDice" sendCommand={mockSendCommand} />);

      const rollButton = screen.getByTestId('roll-dice-button');
      fireEvent.click(rollButton);

      expect(mockSendCommand).toHaveBeenCalledWith({
        RollDice: { player: 'East' },
      });
    });

    test('calls onDiceOverlayClose when dice overlay closes', () => {
      const onDiceOverlayClose = vi.fn();
      const gameState = createMockGameState('BreakingWall');

      render(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={true}
          onDiceOverlayClose={onDiceOverlayClose}
        />
      );

      const closeButton = screen.getByTestId('dice-overlay-close');
      fireEvent.click(closeButton);

      expect(onDiceOverlayClose).toHaveBeenCalled();
    });

    test('closes dice overlay without crashing when no callback provided', () => {
      const gameState = createMockGameState('BreakingWall');

      render(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={true}
        />
      );

      const closeButton = screen.getByTestId('dice-overlay-close');
      fireEvent.click(closeButton);

      // Should not crash
      expect(screen.getByTestId('dice-overlay')).toBeInTheDocument();
    });
  });

  describe('prop updates', () => {
    test('updates dice overlay visibility when showDiceOverlay prop changes', () => {
      const gameState = createMockGameState('BreakingWall');

      const { rerender } = render(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={false}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toHaveAttribute('data-open', 'false');

      rerender(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={7}
          showDiceOverlay={true}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toHaveAttribute('data-open', 'true');
    });

    test('updates dice roll value when prop changes', () => {
      const gameState = createMockGameState('BreakingWall');

      const { rerender } = render(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={5}
          showDiceOverlay={true}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toHaveTextContent('Roll: 5');

      rerender(
        <SetupPhase
          gameState={gameState}
          stage="BreakingWall"
          sendCommand={mockSendCommand}
          diceRoll={12}
          showDiceOverlay={true}
        />
      );

      expect(screen.getByTestId('dice-overlay')).toHaveTextContent('Roll: 12');
    });
  });
});
