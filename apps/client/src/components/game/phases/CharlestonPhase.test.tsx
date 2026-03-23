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
    slotCount,
    blindIncoming,
    canRevealBlind,
    incomingFromSeat,
    onAbsorbIncoming,
    onCommitPass,
    canCommitPass,
  }: {
    incomingTiles: Array<{ id: string }>;
    outgoingTiles: Array<{ id: string }>;
    slotCount: number;
    blindIncoming: boolean;
    canRevealBlind: boolean;
    incomingFromSeat: Seat | null;
    onAbsorbIncoming: (tileId: string) => void;
    onCommitPass: () => void;
    canCommitPass: boolean;
  }) => (
    <div data-testid="staging-strip" data-slot-count={slotCount}>
      Incoming: {incomingTiles.length}, Outgoing: {outgoingTiles.length}, Blind:{' '}
      {blindIncoming ? 'true' : 'false'}
      <span data-testid="staging-can-reveal-blind">{canRevealBlind ? 'true' : 'false'}</span>
      {incomingFromSeat && <span data-testid="staging-incoming-from-seat">{incomingFromSeat}</span>}
      {incomingTiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          data-testid={`mock-staging-incoming-tile-${tile.id}`}
          onClick={() => onAbsorbIncoming(tile.id)}
        >
          {tile.id}
        </button>
      ))}
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
      {tiles.map((tile) => (
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
  ActionBar: ({
    phase,
    disabled,
    readOnly,
    hasSubmittedVote,
    votedPlayers,
    canDeclareMahjong,
    onDeclareMahjong,
  }: {
    phase: unknown;
    disabled?: boolean;
    readOnly?: boolean;
    hasSubmittedVote?: boolean;
    votedPlayers?: string[];
    canDeclareMahjong?: boolean;
    onDeclareMahjong?: () => void;
  }) => (
    <div
      data-testid="action-bar"
      data-disabled={disabled ? 'true' : 'false'}
      data-read-only={readOnly ? 'true' : 'false'}
      data-has-submitted-vote={hasSubmittedVote ? 'true' : 'false'}
      data-voted-players={(votedPlayers ?? []).join(',')}
      data-can-declare-mahjong={canDeclareMahjong ? 'true' : 'false'}
    >
      Phase: {JSON.stringify(phase)}
      <button
        type="button"
        data-testid="mock-action-bar-declare-mahjong"
        onClick={() => onDeclareMahjong?.()}
        disabled={!canDeclareMahjong || !onDeclareMahjong}
      >
        Declare Mahjong
      </button>
    </div>
  ),
}));

vi.mock('../MahjongConfirmationDialog', () => ({
  MahjongConfirmationDialog: ({
    isOpen,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    onConfirm: (command: GameCommand) => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="mahjong-confirmation-dialog">
        <button
          type="button"
          data-testid="mock-confirm-mahjong"
          onClick={() =>
            onConfirm({
              DeclareMahjong: {
                player: 'East',
                hand: {
                  concealed: [],
                  counts: [],
                  exposed: [],
                  joker_assignments: null,
                },
                winning_tile: null,
              },
            })
          }
        >
          Confirm Mahjong
        </button>
        <button type="button" data-testid="mock-cancel-mahjong" onClick={onCancel}>
          Cancel Mahjong
        </button>
      </div>
    ) : null,
}));

vi.mock('../OpponentRack', () => ({
  OpponentRack: ({ player, className }: { player: { seat: string }; className?: string }) => (
    <div
      data-testid={`opponent-rack-${player.seat.toLowerCase()}`}
      data-class-name={className ?? ''}
    />
  ),
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

const actionableCharlestonMahjongState: GameStateSnapshot = {
  ...mockGameState,
  your_hand: [...mockGameState.your_hand, 13],
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

    test('uses the Charleston tracker as the only top status surface', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.queryByTestId('gameplay-status-bar')).not.toBeInTheDocument();
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

      expect(screen.getByTestId('opponent-slot-south')).toHaveClass(
        'col-start-3',
        'row-start-2',
        'justify-end'
      );
      expect(screen.getByTestId('opponent-slot-north')).toHaveClass(
        'col-start-1',
        'row-start-2',
        'justify-start'
      );
    });

    test('renders the shared Charleston board-region grid', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('charleston-board-regions')).toHaveClass(
        'grid',
        'grid-cols-[auto_minmax(0,1fr)_auto]',
        'grid-rows-[auto_minmax(0,1fr)_auto]'
      );
      expect(screen.getByTestId('player-zone-region')).toHaveClass('col-span-3', 'row-start-3');
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

    test('passes voting state into the action bar for VotingToContinue stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('action-bar')).toHaveTextContent('VotingToContinue');
    });

    test('keeps the hand interactive during voting so staged count can drive Proceed', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      const hand = screen.queryByTestId('player-rack');
      expect(hand).toBeInTheDocument();
      expect(hand).toHaveTextContent('charleston');
    });

    test('does not render courtesy overlay components for CourtesyAcross stage', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.queryByTestId('courtesy-pass-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('courtesy-negotiation-status')).not.toBeInTheDocument();
    });

    test('keeps the rack interactive during CourtesyAcross before agreement', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="CourtesyAcross"
          sendCommand={sendCommandMock}
        />
      );

      const hand = screen.queryByTestId('player-rack');
      expect(hand).toBeInTheDocument();
      expect(hand).toHaveTextContent('charleston');
      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-disabled', 'false');
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

    test('staging strip and action bar both render during VotingToContinue', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="VotingToContinue"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.getByTestId('action-bar')).toBeInTheDocument();
    });
  });

  describe('US-078: Charleston Mahjong wiring', () => {
    test('passes demoted-but-visible default Mahjong state into ActionBar', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-can-declare-mahjong', 'false');
      expect(screen.getByTestId('mock-action-bar-declare-mahjong')).toBeDisabled();
    });

    test('passes actionable Mahjong state into ActionBar when Charleston hand is at 14 tiles', () => {
      render(
        <CharlestonPhase
          gameState={actionableCharlestonMahjongState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-can-declare-mahjong', 'true');
      expect(screen.getByTestId('mock-action-bar-declare-mahjong')).toBeEnabled();
    });

    test('opens the shared Mahjong confirmation flow and sends DeclareMahjong on confirm', async () => {
      const user = userEvent.setup();

      render(
        <CharlestonPhase
          gameState={actionableCharlestonMahjongState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
        />
      );

      await user.click(screen.getByTestId('mock-action-bar-declare-mahjong'));

      expect(screen.getByTestId('mahjong-confirmation-dialog')).toBeInTheDocument();

      await user.click(screen.getByTestId('mock-confirm-mahjong'));

      expect(sendCommandMock).toHaveBeenCalledWith({
        DeclareMahjong: {
          player: 'East',
          hand: {
            concealed: [],
            counts: [],
            exposed: [],
            joker_assignments: null,
          },
          winning_tile: null,
        },
      });
    });

    test('historical Charleston states stay read-only and do not expose live Mahjong action', () => {
      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstRight"
          sendCommand={sendCommandMock}
          isHistoricalView={true}
        />
      );

      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-read-only', 'true');
      expect(screen.getByTestId('action-bar')).toHaveAttribute('data-can-declare-mahjong', 'false');
      expect(screen.getByTestId('mock-action-bar-declare-mahjong')).toBeDisabled();
    });
  });

  describe('US-077: contextual staging slot count', () => {
    test('AC-1: standard Charleston stages present 3 visible staging slots', () => {
      const standardStages: CharlestonStage[] = [
        'FirstRight',
        'FirstAcross',
        'SecondLeft',
        'SecondAcross',
        'VotingToContinue',
        'CourtesyAcross',
      ];

      for (const stage of standardStages) {
        const { unmount } = render(
          <CharlestonPhase gameState={mockGameState} stage={stage} sendCommand={sendCommandMock} />
        );

        expect(screen.getByTestId('staging-strip')).toHaveAttribute('data-slot-count', '3');
        unmount();
      }
    });

    test('AC-2: blind-pass stages present 6 visible staging slots', () => {
      const blindStages: CharlestonStage[] = ['FirstLeft', 'SecondRight'];

      for (const stage of blindStages) {
        const { unmount } = render(
          <CharlestonPhase gameState={mockGameState} stage={stage} sendCommand={sendCommandMock} />
        );

        expect(screen.getByTestId('staging-strip')).toHaveAttribute('data-slot-count', '6');
        unmount();
      }
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

    test('kept blind tiles reduce forward_incoming_count without inflating local rack ownership', async () => {
      const user = userEvent.setup();

      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SET_STAGED_INCOMING',
          payload: { stage: 'FirstLeft', tiles: [20, 21, 22], from: null, context: 'Charleston' },
        });
      });

      await user.click(screen.getByTestId('mock-player-rack-tile-0-0'));
      await user.click(screen.getByTestId('mock-staging-incoming-tile-incoming-FirstLeft-0-20'));
      await user.click(screen.getByTestId('mock-staging-pass-button'));

      expect(sendCommandMock).toHaveBeenCalledWith({
        CommitCharlestonPass: {
          player: 'East',
          from_hand: [0],
          forward_incoming_count: 2,
        },
      });
    });

    test('allows rack selection during blind pass even when three blind tiles are staged', async () => {
      const user = userEvent.setup();

      render(
        <CharlestonPhase
          gameState={mockGameState}
          stage="FirstLeft"
          sendCommand={sendCommandMock}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SET_STAGED_INCOMING',
          payload: {
            stage: 'FirstLeft',
            tiles: [20, 21, 22],
            from: null,
            context: 'Charleston',
          },
        });
      });

      await user.click(screen.getByTestId('mock-player-rack-tile-0-0'));

      expect(screen.getByTestId('staging-can-reveal-blind')).toHaveTextContent('true');
    });
  });
});
