import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import { gameStates } from '@/test/fixtures';
import { PlayingPhasePresentation } from './PlayingPhasePresentation';

vi.mock('@/components/game/OpponentRack', () => ({
  OpponentRack: ({
    player,
    isActive,
    className,
  }: {
    player: { seat: string };
    isActive?: boolean;
    className?: string;
  }) => (
    <div
      data-testid={`opponent-rack-${player.seat.toLowerCase()}`}
      data-active={String(!!isActive)}
      data-class-name={className ?? ''}
    />
  ),
}));
vi.mock('@/components/game/DiscardPool', () => ({
  DiscardPool: () => <div data-testid="discard-pool" />,
}));
vi.mock('@/components/game/PlayerRack', () => ({
  PlayerRack: ({ isActive, onSort }: { isActive?: boolean; onSort?: () => void }) => (
    <div data-testid="player-rack" data-active={String(!!isActive)}>
      {onSort && (
        <button type="button" data-testid="rack-sort-button" onClick={onSort}>
          Sort
        </button>
      )}
    </div>
  ),
}));
vi.mock('@/components/game/PlayerZone', () => ({
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
      <div>{staging}</div>
      <div>{rack}</div>
      <div>{actions}</div>
    </div>
  ),
}));
vi.mock('@/components/game/ActionBar', () => ({
  ActionBar: ({
    onCommand,
    onProceedCallWindow,
    callWindowInstruction,
    claimCandidate,
  }: {
    onCommand: (cmd: unknown) => void;
    onProceedCallWindow?: () => void;
    callWindowInstruction?: string;
    claimCandidate?: { label: string; detail: string } | null;
  }) => (
    <div data-testid="mock-action-bar">
      {claimCandidate && (
        <div data-testid="action-bar-claim-candidate">
          <div data-testid="action-bar-claim-candidate-label">{claimCandidate.label}</div>
          <div data-testid="action-bar-claim-candidate-detail">{claimCandidate.detail}</div>
        </div>
      )}
      <button onClick={() => onCommand({ DiscardTile: { tile: 5 } })} data-testid="action-discard">
        Discard
      </button>
      {onProceedCallWindow && (
        <button onClick={onProceedCallWindow} data-testid="action-call-proceed">
          Call Proceed
        </button>
      )}
      {callWindowInstruction && (
        <div data-testid="action-call-instruction">{callWindowInstruction}</div>
      )}
    </div>
  ),
}));

type PresentationProps = ComponentProps<typeof PlayingPhasePresentation>;

function createBaseProps(): PresentationProps {
  return {
    animations: { incomingFromSeat: null, leavingTileIds: [] },
    autoDraw: { drawStatus: null },
    callWindow: { callWindow: null },
    claimCandidate: null,
    canDeclareMahjong: false,
    canProceedCallWindow: false,
    clearSelection: vi.fn(),
    combinedHighlightedIds: [],
    currentTurn: 'South',
    gameState: {
      ...gameStates.playingDiscarding,
      your_seat: 'South',
      current_turn: 'South',
      phase: { Playing: { Discarding: { player: 'South' } } },
      discard_pile: [],
      players: [
        {
          seat: 'South',
          player_id: 'south',
          is_bot: false,
          status: 'Active',
          tile_count: 14,
          exposed_melds: [],
        },
        {
          seat: 'East',
          player_id: 'east',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'West',
          player_id: 'west',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
        {
          seat: 'North',
          player_id: 'north',
          is_bot: false,
          status: 'Active',
          tile_count: 13,
          exposed_melds: [],
        },
      ],
    },
    handTileInstances: [],
    historyPlayback: {
      isHistoricalView: false,
      pushUndoAction: vi.fn(),
      setIsHistoryOpen: vi.fn(),
    },
    hintSystem: {
      canRequestHint: false,
      openHintRequestDialog: vi.fn(),
      hintPending: false,
      currentHint: null,
      showHintPanel: false,
      setShowHintPanel: vi.fn(),
      setShowHintSettings: vi.fn(),
    },
    isDiscardingStage: true,
    isDrawingStage: false,
    isMyTurn: true,
    handleDeclareMahjongCall: vi.fn(),
    handleProceedCallWindow: vi.fn(),
    mahjong: {
      deadHandPlayers: new Set(),
      handleDeclareMahjong: vi.fn(),
      mahjongDialogLoading: false,
      awaitingMahjongValidation: null,
      mahjongDeclaredMessage: null,
    },
    meldActions: {
      upgradeableMeldIndices: [],
      handleMeldClick: vi.fn(),
      canExchangeJoker: false,
      handleOpenJokerExchange: vi.fn(),
    },
    playing: {
      mostRecentDiscard: null,
      isProcessing: false,
      setProcessing: vi.fn(),
      setStagedIncomingTile: vi.fn(),
      stagedIncomingTile: null,
    },
    selectedIds: [],
    sendCommand: vi.fn(),
    toggleTile: vi.fn(),
    turnStage: { Discarding: { player: 'South' } },
  };
}

describe('PlayingPhasePresentation', () => {
  it('passes active state to only the current turn rack', () => {
    const props = createBaseProps();
    render(<PlayingPhasePresentation {...props} currentTurn="South" />);

    expect(screen.getByTestId('player-rack')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('opponent-rack-east')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('opponent-rack-west')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('opponent-rack-north')).toHaveAttribute('data-active', 'false');
  });

  it('anchors opponent racks to the board scene instead of the viewport', () => {
    const props = createBaseProps();
    render(<PlayingPhasePresentation {...props} />);

    expect(screen.getByTestId('opponent-rack-east')).not.toHaveAttribute(
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

  it('positions side opponent racks flush with the board edges', () => {
    const props = createBaseProps();
    render(<PlayingPhasePresentation {...props} />);

    expect(screen.getByTestId('opponent-rack-west')).toHaveAttribute(
      'data-class-name',
      expect.stringContaining('right-0')
    );
    expect(screen.getByTestId('opponent-rack-east')).toHaveAttribute(
      'data-class-name',
      expect.stringContaining('left-0')
    );
  });

  it('renders staged incoming draw tile in StagingStrip incoming slot (AC-1)', () => {
    const props = createBaseProps();
    render(
      <PlayingPhasePresentation
        {...props}
        playing={{ ...props.playing, stagedIncomingTile: { id: '5-0', tile: 5 } }}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-5-0')).toBeInTheDocument();
  });

  it('forwards incomingFromSeat to StagingStrip staging wrapper on initial fill (VR-011)', () => {
    const props = createBaseProps();
    render(
      <PlayingPhasePresentation
        {...props}
        animations={{ ...props.animations, incomingFromSeat: 'East' }}
        playing={{ ...props.playing, stagedIncomingTile: { id: '5-0', tile: 5 } }}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-5-0')).toHaveClass(
      'tile-enter-from-east'
    );
  });

  it('shows draw retry feedback and forwards action bar discard side effects', () => {
    const sendCommand = vi.fn();
    const clearSelection = vi.fn();
    const pushUndoAction = vi.fn();
    const setProcessing = vi.fn();
    const props = createBaseProps();

    render(
      <PlayingPhasePresentation
        {...props}
        autoDraw={{ drawStatus: { retrying: 2 } }}
        selectedIds={['5-0']}
        isDrawingStage={true}
        clearSelection={clearSelection}
        sendCommand={sendCommand}
        historyPlayback={{ ...props.historyPlayback, pushUndoAction }}
        playing={{ ...props.playing, setProcessing }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to draw tile. Retrying... 2/3');
    expect(screen.getByTestId('player-zone')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-discard'));
    expect(sendCommand).toHaveBeenCalledWith({ DiscardTile: { player: 'South', tile: 5 } });
    expect(pushUndoAction).toHaveBeenCalledWith(expect.stringContaining('Discarded'));
    expect(setProcessing).toHaveBeenCalledWith(true);
    expect(clearSelection).toHaveBeenCalled();
  });

  it('renders sort as a rack-local utility instead of an action-bar control', () => {
    const props = createBaseProps();
    render(<PlayingPhasePresentation {...props} />);

    expect(screen.getByTestId('rack-sort-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-button')).not.toBeInTheDocument();
  });

  it('shows call-window discard tile in staging and forwards claim Proceed handler', () => {
    const handleProceedCallWindow = vi.fn();
    const props = createBaseProps();

    render(
      <PlayingPhasePresentation
        {...props}
        callWindow={{ callWindow: { tile: 9, discardedBy: 'East' } }}
        claimCandidate={{
          state: 'valid',
          label: 'Pung ready',
          detail: 'Press Proceed to call pung.',
        }}
        canProceedCallWindow={true}
        handleProceedCallWindow={handleProceedCallWindow}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-call-window-9')).toBeInTheDocument();
    expect(screen.getByTestId('action-bar-claim-candidate-label')).toHaveTextContent('Pung ready');
    expect(screen.getByTestId('action-bar-claim-candidate-detail')).toHaveTextContent(
      'Press Proceed to call pung.'
    );
    expect(screen.queryByTestId('staging-claim-candidate-label')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-call-proceed'));
    expect(handleProceedCallWindow).toHaveBeenCalled();
    expect(screen.getByTestId('action-call-instruction')).toHaveTextContent('East');
  });
});
