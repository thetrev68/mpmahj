import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import { gameStates } from '@/test/fixtures';
import { PlayingPhasePresentation } from './PlayingPhasePresentation';

vi.mock('@/components/game/OpponentRack', () => ({
  OpponentRack: ({ player, isActive }: { player: { seat: string }; isActive?: boolean }) => (
    <div
      data-testid={`opponent-rack-${player.seat.toLowerCase()}`}
      data-active={String(!!isActive)}
    />
  ),
}));
vi.mock('@/components/game/DiscardPool', () => ({
  DiscardPool: () => <div data-testid="discard-pool" />,
}));
vi.mock('@/components/game/PlayerRack', () => ({
  PlayerRack: ({ isActive }: { isActive?: boolean }) => (
    <div data-testid="player-rack" data-active={String(!!isActive)} />
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
  ActionBar: ({ onCommand }: { onCommand: (cmd: unknown) => void }) => (
    <button onClick={() => onCommand({ DiscardTile: { tile: 5 } })} data-testid="action-discard">
      Discard
    </button>
  ),
}));

type PresentationProps = ComponentProps<typeof PlayingPhasePresentation>;

function createBaseProps(): PresentationProps {
  return {
    animations: { incomingFromSeat: null, leavingTileIds: [] },
    autoDraw: { drawStatus: null },
    callWindow: { callWindow: null },
    canDeclareMahjong: false,
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
      isSoloGame: true,
      soloUndoRemaining: 10,
      recentUndoableActions: [],
      undoPending: false,
      requestSoloUndo: vi.fn(),
      multiplayerUndoRemaining: 0,
      requestUndoVote: vi.fn(),
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
    expect(sendCommand).toHaveBeenCalledWith({ DiscardTile: { tile: 5 } });
    expect(pushUndoAction).toHaveBeenCalledWith(expect.stringContaining('Discarded'));
    expect(setProcessing).toHaveBeenCalledWith(true);
    expect(clearSelection).toHaveBeenCalled();
  });
});
