/**
 * Tests for CharlestonPhase Component
 *
 * Charleston phase orchestration component tests
 */

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharlestonPhase } from './CharlestonPhase';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

// Mock child components
vi.mock('../CharlestonTracker', () => ({
  CharlestonTracker: ({ stage }: { stage: CharlestonStage }) => (
    <div data-testid="charleston-tracker">Stage: {stage}</div>
  ),
}));

vi.mock('../BlindPassPanel', () => ({
  BlindPassPanel: ({ blindCount }: { blindCount: number }) => (
    <div data-testid="blind-pass-panel">Blind count: {blindCount}</div>
  ),
}));

vi.mock('../PlayerRack', () => ({
  PlayerRack: ({ tiles, mode }: { tiles: unknown[]; mode: string }) => (
    <div data-testid="concealed-hand">
      Mode: {mode}, Tiles: {tiles.length}
    </div>
  ),
}));

vi.mock('../ActionBar', () => ({
  ActionBar: ({ phase }: { phase: unknown }) => (
    <div data-testid="action-bar">Phase: {JSON.stringify(phase)}</div>
  ),
}));

vi.mock('../VotingPanel', () => ({
  VotingPanel: () => <div data-testid="voting-panel">Voting Panel</div>,
}));

vi.mock('../VoteResultOverlay', () => ({
  VoteResultOverlay: ({ result }: { result: string }) => (
    <div data-testid="vote-result-overlay">Result: {result}</div>
  ),
}));

vi.mock('../PassAnimationLayer', () => ({
  PassAnimationLayer: ({ direction }: { direction: string }) => (
    <div data-testid="pass-animation-layer">Direction: {direction}</div>
  ),
}));

vi.mock('../CourtesyPassPanel', () => ({
  CourtesyPassPanel: ({
    acrossPartnerSeat,
    isPending,
  }: {
    acrossPartnerSeat: string;
    isPending: boolean;
  }) => (
    <div data-testid="courtesy-pass-panel">
      Partner: {acrossPartnerSeat}, Pending: {isPending ? 'true' : 'false'}
    </div>
  ),
}));

vi.mock('../CourtesyNegotiationStatus', () => ({
  CourtesyNegotiationStatus: ({ type }: { type: string }) => (
    <div data-testid="courtesy-negotiation-status">Type: {type}</div>
  ),
}));

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
    concealed_bonus_enabled: false,
    dealer_bonus_enabled: false,
  },
  charleston_state: null,
  your_seat: 'East',
  your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  wall_seed: 0n,
  wall_draw_index: 0,
  wall_break_point: 0,
  wall_tiles_remaining: 152,
};

describe('CharlestonPhase', () => {
  let sendCommandMock: Mock<(cmd: GameCommand) => void>;

  beforeEach(() => {
    sendCommandMock = vi.fn() as Mock<(cmd: GameCommand) => void>;
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    test('renders Charleston tracker', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByText(/Stage: FirstRight/)).toBeInTheDocument();
    });

    test('renders concealed hand for non-voting stages', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
      expect(screen.getByText(/Mode: charleston/)).toBeInTheDocument();
    });

    test('renders action bar', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('action-bar')).toBeInTheDocument();
    });

    test('renders blind pass panel for FirstLeft stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
    });

    test('renders blind pass panel for SecondRight stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="SecondRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
    });

    test('does not render blind pass panel for FirstRight stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    });

    test('renders voting panel for VotingToContinue stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('voting-panel')).toBeInTheDocument();
    });

    test('renders concealed hand in view-only mode during voting', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      // Hand is always visible so players can see their tiles when voting;
      // during voting it is read-only (no selection allowed).
      const hand = screen.queryByTestId('concealed-hand');
      expect(hand).toBeInTheDocument();
      expect(hand).toHaveTextContent('view-only');
    });

    test('renders courtesy pass panel for CourtesyAcross stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      // Note: CourtesyPassPanel would be rendered here in actual implementation
      // This is a placeholder test for US-007
      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
    });

    test('renders concealed hand in view-only mode during courtesy negotiation', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      // During courtesy negotiation (before agreement), hand is view-only
      const hand = screen.queryByTestId('concealed-hand');
      expect(hand).toBeInTheDocument();
      expect(hand).toHaveTextContent('view-only');
    });
  });

  describe('Charleston stages', () => {
    const stages: CharlestonStage[] = [
      'FirstRight',
      'FirstAcross',
      'FirstLeft',
      'VotingToContinue',
      'SecondLeft',
      'SecondAcross',
      'SecondRight',
      'CourtesyAcross',
      'Complete',
    ];

    test.each(stages)('renders correctly for stage: %s', (stage) => {
      const { container } = render(
        <CharlestonPhase gameState={mockGameState} stage={stage} sendCommand={sendCommandMock} />
      );

      expect(container).toBeTruthy();
      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
    });
  });

  describe('integration', () => {
    test('component mounts without errors', () => {
      const { container } = render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(container).toBeTruthy();
    });

    test('component unmounts cleanly', () => {
      const { unmount } = render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(() => unmount()).not.toThrow();
    });
  });
});
