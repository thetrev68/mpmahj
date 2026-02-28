import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayingPhasePresentation } from './PlayingPhasePresentation';
import type { ReactNode } from 'react';

vi.mock('@/components/game/WindCompass', () => ({
  WindCompass: () => <div data-testid="wind-compass" />,
}));
vi.mock('@/components/game/OpponentRack', () => ({
  OpponentRack: () => <div data-testid="opponent-rack" />,
}));
vi.mock('@/components/game/DiscardPool', () => ({
  DiscardPool: () => <div data-testid="discard-pool" />,
}));
vi.mock('@/components/game/PlayerRack', () => ({
  PlayerRack: () => <div data-testid="player-rack" />,
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

describe('PlayingPhasePresentation', () => {
  it('renders staged incoming draw tile in StagingStrip incoming slot (AC-1)', () => {
    render(
      <PlayingPhasePresentation
        animations={{ incomingFromSeat: null, leavingTileIds: [] } as never}
        autoDraw={{ drawStatus: null } as never}
        callWindow={{ callWindow: null } as never}
        canDeclareMahjong={false}
        clearSelection={vi.fn()}
        combinedHighlightedIds={[]}
        currentTurn="South"
        forfeitedPlayers={new Set()}
        gameState={
          {
            your_seat: 'South',
            discard_pile: [],
            players: [
              { seat: 'South', exposed_melds: [] },
              { seat: 'East', exposed_melds: [] },
              { seat: 'West', exposed_melds: [] },
              { seat: 'North', exposed_melds: [] },
            ],
          } as never
        }
        handTileInstances={[]}
        historyPlayback={
          {
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
          } as never
        }
        hintSystem={
          {
            hintPending: false,
            currentHint: null,
            showHintPanel: false,
            setShowHintPanel: vi.fn(),
            setShowHintSettings: vi.fn(),
            canRequestHint: false,
            openHintRequestDialog: vi.fn(),
          } as never
        }
        isDiscardingStage={true}
        isDrawingStage={false}
        isMyTurn={true}
        mahjong={
          {
            deadHandPlayers: new Set(),
            handleDeclareMahjong: vi.fn(),
            mahjongDialogLoading: false,
            awaitingMahjongValidation: null,
            mahjongDeclaredMessage: null,
          } as never
        }
        meldActions={
          {
            upgradeableMeldIndices: [],
            handleMeldClick: vi.fn(),
            canExchangeJoker: false,
            handleOpenJokerExchange: vi.fn(),
          } as never
        }
        onLeaveConfirmed={vi.fn()}
        playing={
          {
            isProcessing: false,
            setProcessing: vi.fn(),
            stagedIncomingTile: { id: '5-0', tile: 5 },
            setStagedIncomingTile: vi.fn(),
          } as never
        }
        selectedIds={[]}
        sendCommand={vi.fn()}
        toggleTile={vi.fn()}
        turnStage={{ Discarding: { player: 'South' } } as never}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-5-0')).toBeInTheDocument();
  });

  it('forwards incomingFromSeat to StagingStrip staging wrapper on initial fill (VR-011)', () => {
    render(
      <PlayingPhasePresentation
        animations={{ incomingFromSeat: 'East', leavingTileIds: [] } as never}
        autoDraw={{ drawStatus: null } as never}
        callWindow={{ callWindow: null } as never}
        canDeclareMahjong={false}
        clearSelection={vi.fn()}
        combinedHighlightedIds={[]}
        currentTurn="South"
        forfeitedPlayers={new Set()}
        gameState={
          {
            your_seat: 'South',
            discard_pile: [],
            players: [
              { seat: 'South', exposed_melds: [] },
              { seat: 'East', exposed_melds: [] },
              { seat: 'West', exposed_melds: [] },
              { seat: 'North', exposed_melds: [] },
            ],
          } as never
        }
        handTileInstances={[]}
        historyPlayback={
          {
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
          } as never
        }
        hintSystem={
          {
            hintPending: false,
            currentHint: null,
            showHintPanel: false,
            setShowHintPanel: vi.fn(),
            setShowHintSettings: vi.fn(),
            canRequestHint: false,
            openHintRequestDialog: vi.fn(),
          } as never
        }
        isDiscardingStage={true}
        isDrawingStage={false}
        isMyTurn={true}
        mahjong={
          {
            deadHandPlayers: new Set(),
            handleDeclareMahjong: vi.fn(),
            mahjongDialogLoading: false,
            awaitingMahjongValidation: null,
            mahjongDeclaredMessage: null,
          } as never
        }
        meldActions={
          {
            upgradeableMeldIndices: [],
            handleMeldClick: vi.fn(),
            canExchangeJoker: false,
            handleOpenJokerExchange: vi.fn(),
          } as never
        }
        onLeaveConfirmed={vi.fn()}
        playing={
          {
            isProcessing: false,
            setProcessing: vi.fn(),
            stagedIncomingTile: { id: '5-0', tile: 5 },
            setStagedIncomingTile: vi.fn(),
          } as never
        }
        selectedIds={[]}
        sendCommand={vi.fn()}
        toggleTile={vi.fn()}
        turnStage={{ Discarding: { player: 'South' } } as never}
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

    render(
      <PlayingPhasePresentation
        animations={{ incomingFromSeat: null, leavingTileIds: [] } as never}
        autoDraw={{ drawStatus: { retrying: 2 } } as never}
        callWindow={{ callWindow: null } as never}
        canDeclareMahjong={false}
        clearSelection={clearSelection}
        combinedHighlightedIds={[]}
        currentTurn="South"
        forfeitedPlayers={new Set()}
        gameState={
          {
            your_seat: 'South',
            discard_pile: [],
            players: [
              { seat: 'South', exposed_melds: [] },
              { seat: 'East', exposed_melds: [] },
              { seat: 'West', exposed_melds: [] },
              { seat: 'North', exposed_melds: [] },
            ],
          } as never
        }
        handTileInstances={[]}
        historyPlayback={
          {
            isHistoricalView: false,
            pushUndoAction,
            isSoloGame: true,
            soloUndoRemaining: 10,
            recentUndoableActions: [],
            undoPending: false,
            requestSoloUndo: vi.fn(),
            multiplayerUndoRemaining: 0,
            requestUndoVote: vi.fn(),
            setIsHistoryOpen: vi.fn(),
          } as never
        }
        hintSystem={
          {
            hintPending: false,
            currentHint: null,
            showHintPanel: false,
            setShowHintPanel: vi.fn(),
            setShowHintSettings: vi.fn(),
            canRequestHint: false,
            openHintRequestDialog: vi.fn(),
          } as never
        }
        isDiscardingStage={true}
        isDrawingStage={true}
        isMyTurn={true}
        mahjong={
          {
            deadHandPlayers: new Set(),
            handleDeclareMahjong: vi.fn(),
            mahjongDialogLoading: false,
            awaitingMahjongValidation: null,
            mahjongDeclaredMessage: null,
          } as never
        }
        meldActions={
          {
            upgradeableMeldIndices: [],
            handleMeldClick: vi.fn(),
            canExchangeJoker: false,
            handleOpenJokerExchange: vi.fn(),
          } as never
        }
        onLeaveConfirmed={vi.fn()}
        playing={{ isProcessing: false, setProcessing } as never}
        selectedIds={[]}
        sendCommand={sendCommand}
        toggleTile={vi.fn()}
        turnStage={{ Discarding: { player: 'South' } } as never}
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
