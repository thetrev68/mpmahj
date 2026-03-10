/**
 * Tests for CharlestonPhase Component
 *
 * Charleston phase orchestration component tests.
 * Phase 4, slice 4.4: tests now use useGameUIStore directly to drive state
 * instead of the removed ui-action event bus.
 */

import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { CharlestonPhase } from './CharlestonPhase';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';

// Mock child components
vi.mock('../CharlestonTracker', () => ({
  CharlestonTracker: ({ stage }: { stage: CharlestonStage }) => (
    <div data-testid="charleston-tracker">Stage: {stage}</div>
  ),
}));

vi.mock('../StagingStrip', () => ({
  StagingStrip: ({
    incomingTiles,
    outgoingTiles,
    blindIncoming,
    incomingFromSeat,
    onCommitPass,
    canCommitPass,
  }: {
    incomingTiles: unknown[];
    outgoingTiles: unknown[];
    blindIncoming: boolean;
    incomingFromSeat: Seat | null;
    onCommitPass: () => void;
    canCommitPass: boolean;
  }) => (
    <div data-testid="staging-strip">
      Incoming: {incomingTiles.length}, Outgoing: {outgoingTiles.length}, Blind:{' '}
      {blindIncoming ? 'true' : 'false'}
      {incomingFromSeat && <span data-testid="staging-incoming-from-seat">{incomingFromSeat}</span>}
      <button
        type="button"
        onClick={onCommitPass}
        data-testid="mock-staging-pass-button"
        disabled={!canCommitPass}
      >
        Pass
      </button>
    </div>
  ),
}));

vi.mock('../PlayerZone', () => ({
  PlayerZone: ({
    staging,
    rack,
    actions,
  }: {
    staging: ReactNode;
    rack: ReactNode;
    actions: ReactNode;
  }) => (
    <div data-testid="player-zone">
      <div data-testid="player-zone-staging">{staging}</div>
      <div data-testid="player-zone-rack">{rack}</div>
      <div data-testid="player-zone-actions">{actions}</div>
    </div>
  ),
}));

vi.mock('../PlayerRack', () => ({
  PlayerRack: ({
    tiles,
    mode,
    onTileSelect,
  }: {
    tiles: Array<{ id: string }>;
    mode: string;
    onTileSelect?: (tileId: string) => void;
  }) => (
    <div data-testid="player-rack">
      Mode: {mode}, Tiles: {tiles.length}
      {tiles.slice(0, 3).map((tile) => (
        <button
          key={tile.id}
          type="button"
          data-testid={`mock-player-rack-tile-${tile.id}`}
          onClick={() => onTileSelect?.(tile.id)}
        >
          {tile.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../ActionBar', () => ({
  ActionBar: ({ phase, disabled }: { phase: unknown; disabled?: boolean }) => (
    <div data-testid="action-bar" data-disabled={disabled ? 'true' : 'false'}>
      Phase: {JSON.stringify(phase)}
    </div>
  ),
}));

vi.mock('../OpponentRack', () => ({
  OpponentRack: ({ player, className }: { player: { seat: string }; className?: string }) => (
    <div
      data-testid={`opponent-rack-${player.seat.toLowerCase()}`}
      data-class-name={className ?? ''}
    />
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
    // Reset the UI store between tests to prevent state leakage.
    act(() => {
      useGameUIStore.getState().reset();
    });
  });

  afterEach(() => {
    act(() => {
      useGameUIStore.getState().reset();
    });
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

    test('renders player rack for non-voting stages', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('player-zone')).toBeInTheDocument();
      expect(screen.getByTestId('player-rack')).toBeInTheDocument();
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

    test('forwards incomingFromSeat to StagingStrip when store has an incoming seat (VR-011)', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      // Before store update: no incoming seat
      expect(screen.queryByTestId('staging-incoming-from-seat')).not.toBeInTheDocument();

      // Set incomingFromSeat in the store (as the event handler would do)
      act(() => {
        useGameUIStore.getState().dispatch({ type: 'SET_INCOMING_FROM_SEAT', seat: 'East' });
      });

      expect(screen.getByTestId('staging-incoming-from-seat')).toHaveTextContent('East');
    });

    test('renders staging strip for FirstRight stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    });

    test('renders staging strip for blind stages without the legacy panel', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="SecondRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.getByText(/Blind: true/)).toBeInTheDocument();
    });

    test('anchors opponent racks to the board scene instead of the viewport', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('opponent-rack-south')).not.toHaveAttribute(
        'data-class-name',
        expect.stringMatching(/\bfixed\b/)
      );
      expect(screen.getByTestId('opponent-rack-west')).not.toHaveAttribute(
        'data-class-name',
        expect.stringMatching(/\bfixed\b/)
      );
      expect(screen.getByTestId('opponent-rack-north')).not.toHaveAttribute(
        'data-class-name',
        expect.stringMatching(/\bfixed\b/)
      );
    });

    test('positions side opponent racks flush with the board edges', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('opponent-rack-south')).toHaveAttribute(
        'data-class-name',
        expect.stringContaining('right-0')
      );
      expect(screen.getByTestId('opponent-rack-north')).toHaveAttribute(
        'data-class-name',
        expect.stringContaining('left-0')
      );
    });

    test('does not render the removed Charleston settings button', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.queryByTestId('charleston-settings-button')).not.toBeInTheDocument();
    });

    test('passes blind mode to staging strip for FirstLeft', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.getByText(/Blind: true/)).toBeInTheDocument();
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
      const hand = screen.queryByTestId('player-rack');
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
      const hand = screen.queryByTestId('player-rack');
      expect(hand).toBeInTheDocument();
      expect(hand).toHaveTextContent('view-only');
      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-disabled', 'true');
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

    test('staging strip and voting panel both render during VotingToContinue', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      // Both elements coexist — no layout collision caused by conditional rendering
      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.getByTestId('voting-panel')).toBeInTheDocument();
    });
  });

  describe('AC-7: CommitCharlestonPass payload from staged state', () => {
    test('enables pass when selected outgoing plus unabsorbed incoming equals three', async () => {
      const user = userEvent.setup();

      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      // Stage one blind incoming tile via the store (as useGameEvents would do)
      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SET_STAGED_INCOMING',
          payload: { stage: 'FirstLeft', tiles: [3], from: null, context: 'Charleston' },
        });
      });

      expect(screen.getByTestId('mock-staging-pass-button')).toBeDisabled();

      await user.click(screen.getAllByTestId(/^mock-player-rack-tile-/)[0]);
      await user.click(screen.getAllByTestId(/^mock-player-rack-tile-/)[1]);

      expect(screen.getByTestId('mock-staging-pass-button')).toBeEnabled();
    });

    test('forward_incoming_count equals staged incoming tile count when committing', async () => {
      const user = userEvent.setup();

      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      // Stage 3 blind incoming tiles (from=null => blind, fulfills selectedIds(0) + staged(3) === 3)
      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SET_STAGED_INCOMING',
          payload: { stage: 'FirstLeft', tiles: [3, 14, 20], from: null, context: 'Charleston' },
        });
      });

      await user.click(screen.getByTestId('mock-staging-pass-button'));

      expect(sendCommandMock).toHaveBeenCalledWith({
        CommitCharlestonPass: {
          player: 'East', // mockGameState.your_seat
          from_hand: [],
          forward_incoming_count: 3,
        },
      });
    });
  });
});
