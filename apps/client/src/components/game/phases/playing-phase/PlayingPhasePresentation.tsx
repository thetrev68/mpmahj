import { ActionBar } from '@/components/game/ActionBar';
import { PlayerRack } from '@/components/game/PlayerRack';
import { DiscardPool } from '@/components/game/DiscardPool';
import { OpponentRack } from '@/components/game/OpponentRack';
import { PlayerZone } from '@/components/game/PlayerZone';
import { StagingStrip } from '@/components/game/StagingStrip';
import type { StagedTile } from '@/components/game/StagingStrip';
import { getOpponentPosition } from '@/components/game/opponentRackUtils';
import { Button } from '@/components/ui/button';
import type { DrawStatus } from '@/hooks/useAutoDraw';
import type { ToggleSelectionResult } from '@/hooks/useTileSelection';
import { selectedIdsToTiles } from '@/lib/utils/tileSelection';
import type { TileInstance } from '@/lib/utils/tileSelection';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

const SOLO_UNDO_LIMIT = 10;

interface AnimationsSlice {
  incomingFromSeat: Seat | null;
  leavingTileIds: string[];
}

interface AutoDrawSlice {
  drawStatus: DrawStatus;
}

interface CallWindowPresentationSlice {
  callWindow: { tile: Tile; discardedBy: Seat } | null;
}

interface PlayingStateSlice {
  mostRecentDiscard: Tile | null;
  isProcessing: boolean;
  setProcessing: (value: boolean) => void;
  setStagedIncomingTile: (tile: StagedTile | null) => void;
  stagedIncomingTile: StagedTile | null;
}

interface MahjongPresentationSlice {
  deadHandPlayers: Set<Seat>;
  handleDeclareMahjong: () => void;
  mahjongDialogLoading: boolean;
  awaitingMahjongValidation: { calledTile: Tile; discardedBy: Seat } | null;
  mahjongDeclaredMessage: string | null;
}

interface MeldActionsPresentationSlice {
  upgradeableMeldIndices: number[];
  handleMeldClick: (meldIndex: number) => void;
  canExchangeJoker: boolean;
  handleOpenJokerExchange: () => void;
}

interface HintSystemPresentationSlice {
  canRequestHint: boolean;
  openHintRequestDialog: () => void;
  hintPending: boolean;
  currentHint: object | null;
  showHintPanel: boolean;
  setShowHintPanel: (show: boolean) => void;
  setShowHintSettings: (show: boolean) => void;
}

interface HistoryPlaybackPresentationSlice {
  isHistoricalView: boolean;
  pushUndoAction: (description: string) => void;
  isSoloGame: boolean;
  soloUndoRemaining: number;
  recentUndoableActions: string[];
  undoPending: boolean;
  requestSoloUndo: () => void;
  multiplayerUndoRemaining: number;
  requestUndoVote: () => void;
  setIsHistoryOpen: (open: boolean) => void;
}

interface PlayingPhasePresentationProps {
  animations: AnimationsSlice;
  autoDraw: AutoDrawSlice;
  callWindow: CallWindowPresentationSlice;
  claimCandidate: {
    state: 'empty' | 'valid' | 'invalid';
    label: string;
    detail: string;
  } | null;
  canDeclareMahjong: boolean;
  canProceedCallWindow: boolean;
  clearSelection: () => void;
  combinedHighlightedIds: string[];
  currentTurn: Seat;
  gameState: GameStateSnapshot;
  handTileInstances: TileInstance[];
  historyPlayback: HistoryPlaybackPresentationSlice;
  hintSystem: HintSystemPresentationSlice;
  isDiscardingStage: boolean;
  isDrawingStage: boolean;
  isMyTurn: boolean;
  handleDeclareMahjongCall: () => void;
  handleProceedCallWindow: () => void;
  mahjong: MahjongPresentationSlice;
  meldActions: MeldActionsPresentationSlice;
  playing: PlayingStateSlice;
  selectedIds: string[];
  sendCommand: (cmd: GameCommand) => void;
  toggleTile: (tileId: string) => ToggleSelectionResult | void;
  turnStage: TurnStage;
}

export function PlayingPhasePresentation({
  animations,
  autoDraw,
  callWindow,
  claimCandidate,
  canDeclareMahjong,
  canProceedCallWindow,
  clearSelection,
  combinedHighlightedIds,
  currentTurn,
  gameState,
  handTileInstances,
  historyPlayback,
  hintSystem,
  isDiscardingStage,
  isDrawingStage,
  isMyTurn,
  handleDeclareMahjongCall,
  handleProceedCallWindow,
  mahjong,
  meldActions,
  playing,
  selectedIds,
  sendCommand,
  toggleTile,
  turnStage,
}: PlayingPhasePresentationProps) {
  const localPlayer = gameState.players.find((player) => player.seat === gameState.your_seat);
  const activeCallWindow = callWindow.callWindow;
  const isClaimWindowActive = activeCallWindow !== null;
  const outgoingTiles =
    isDiscardingStage || isClaimWindowActive
      ? selectedIds
          .map((id) => handTileInstances.find((instance) => instance.id === id))
          .filter(
            (instance): instance is (typeof handTileInstances)[number] => instance !== undefined
          )
          .map((instance) => ({
            id: instance.id,
            tile: instance.tile,
          }))
      : [];
  const incomingClaimTile =
    activeCallWindow !== null
      ? [{ id: `call-window-${activeCallWindow.tile}`, tile: activeCallWindow.tile }]
      : [];
  const canCommitDiscard =
    !historyPlayback.isHistoricalView &&
    isDiscardingStage &&
    isMyTurn &&
    !playing.isProcessing &&
    selectedIds.length === 1;
  const actionBarPhase = isClaimWindowActive
    ? {
        Playing: {
          CallWindow: {
            tile: activeCallWindow.tile,
            discarded_by: activeCallWindow.discardedBy,
            can_act: [gameState.your_seat],
            pending_intents: [],
            timer: 0,
          },
        },
      }
    : { Playing: turnStage };

  const handleSortRack = () => {
    // The rack already renders in sorted order today. This control is intentionally
    // rack-local so future manual/auto-sort behavior can live with the rack.
  };

  const handleCommitDiscard = () => {
    if (!canCommitDiscard) {
      return;
    }

    const tile = selectedIdsToTiles(selectedIds)[0];
    if (tile === undefined) {
      return;
    }

    const cmd: GameCommand = {
      DiscardTile: {
        player: gameState.your_seat,
        tile,
      },
    };
    sendCommand(cmd);
    historyPlayback.pushUndoAction(`Discarded ${getTileName(tile)}`);
    playing.setProcessing(true);
    clearSelection();
  };

  return (
    <>
      {gameState.players
        .filter((p) => p.seat !== gameState.your_seat)
        .map((p) => {
          const pos = getOpponentPosition(gameState.your_seat, p.seat);
          const posClass =
            pos === 'top'
              ? 'absolute left-1/2 top-4 z-10 -translate-x-1/2'
              : pos === 'right'
                ? 'absolute right-0 top-[42%] z-10 -translate-y-1/2'
                : 'absolute left-0 top-[42%] z-10 -translate-y-1/2';
          return (
            <OpponentRack
              key={p.seat}
              player={p}
              yourSeat={gameState.your_seat}
              melds={p.exposed_melds}
              isActive={p.seat === currentTurn}
              className={posClass}
            />
          );
        })}

      {isMyTurn &&
        isDrawingStage &&
        autoDraw.drawStatus !== null &&
        autoDraw.drawStatus !== 'drawing' && (
          <div
            className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded bg-red-900/80 px-4 py-2 text-sm text-red-100"
            role="alert"
          >
            {typeof autoDraw.drawStatus === 'object' &&
              `Failed to draw tile. Retrying... ${autoDraw.drawStatus.retrying}/3`}
            {autoDraw.drawStatus === 'failed' &&
              'Failed to draw tile after 3 attempts. Please refresh.'}
          </div>
        )}

      <DiscardPool
        discards={gameState.discard_pile.map((d, index) => ({
          tile: d.tile,
          discardedBy: d.discarded_by,
          turn: index + 1,
        }))}
        mostRecentTile={playing.mostRecentDiscard ?? undefined}
        callableTile={activeCallWindow?.tile}
      />

      <PlayerZone
        staging={
          <StagingStrip
            incomingTiles={
              playing.stagedIncomingTile ? [playing.stagedIncomingTile] : incomingClaimTile
            }
            outgoingTiles={outgoingTiles}
            incomingSlotCount={1}
            outgoingSlotCount={isClaimWindowActive ? 5 : 1}
            blindIncoming={false}
            canRevealBlind={false}
            incomingFromSeat={animations.incomingFromSeat}
            onAbsorbIncoming={() => playing.setStagedIncomingTile(null)}
            onRemoveOutgoing={(tileId) => toggleTile(tileId)}
            onCommitPass={() => {}}
            onCommitCall={() => {}}
            onCommitDiscard={handleCommitDiscard}
            canCommitPass={false}
            canCommitCall={false}
            canCommitDiscard={canCommitDiscard}
            isProcessing={playing.isProcessing}
            showActionButtons={false}
            claimCandidateState={claimCandidate?.state ?? null}
            claimCandidateLabel={claimCandidate?.label ?? null}
            claimCandidateDetail={claimCandidate?.detail ?? null}
          />
        }
        rack={
          <PlayerRack
            tiles={
              playing.stagedIncomingTile
                ? handTileInstances.filter((i) => i.id !== playing.stagedIncomingTile!.id)
                : handTileInstances
            }
            mode={
              historyPlayback.isHistoricalView
                ? 'view-only'
                : isClaimWindowActive
                  ? 'claim'
                  : 'discard'
            }
            selectedTileIds={selectedIds}
            onTileSelect={toggleTile}
            maxSelection={isClaimWindowActive ? 5 : 1}
            disabled={
              historyPlayback.isHistoricalView ||
              playing.isProcessing ||
              (!isDiscardingStage && !isClaimWindowActive)
            }
            highlightedTileIds={combinedHighlightedIds}
            incomingFromSeat={animations.incomingFromSeat}
            leavingTileIds={animations.leavingTileIds}
            melds={localPlayer?.exposed_melds ?? []}
            yourSeat={gameState.your_seat}
            upgradeableMeldIndices={
              historyPlayback.isHistoricalView ? [] : meldActions.upgradeableMeldIndices
            }
            onMeldClick={historyPlayback.isHistoricalView ? undefined : meldActions.handleMeldClick}
            isActive={gameState.your_seat === currentTurn}
            onSort={historyPlayback.isHistoricalView ? undefined : handleSortRack}
          />
        }
        actions={
          <ActionBar
            phase={actionBarPhase}
            mySeat={gameState.your_seat}
            selectedTiles={selectedIdsToTiles(selectedIds)}
            isProcessing={playing.isProcessing}
            canDeclareMahjong={isClaimWindowActive ? true : canDeclareMahjong}
            onDeclareMahjong={
              isClaimWindowActive ? handleDeclareMahjongCall : mahjong.handleDeclareMahjong
            }
            canExchangeJoker={meldActions.canExchangeJoker}
            onExchangeJoker={meldActions.handleOpenJokerExchange}
            canRequestHint={hintSystem.canRequestHint}
            onOpenHintRequest={hintSystem.openHintRequestDialog}
            isHintRequestPending={hintSystem.hintPending}
            canCommitDiscard={canCommitDiscard}
            canProceedCallWindow={canProceedCallWindow}
            onProceedCallWindow={handleProceedCallWindow}
            callWindowInstruction={
              activeCallWindow
                ? `${getTileName(activeCallWindow.tile)} was discarded by ${activeCallWindow.discardedBy}. Press Proceed to skip, or stage matching tiles and press Proceed to claim. If you are Mahjong, press Mahjong.`
                : undefined
            }
            onCommand={(cmd) => {
              if ('DiscardTile' in cmd) {
                handleCommitDiscard();
                return;
              }
              sendCommand(cmd);
            }}
            readOnly={historyPlayback.isHistoricalView}
            readOnlyMessage="Historical View - No actions available"
            showSoloUndo={historyPlayback.isSoloGame}
            soloUndoRemaining={historyPlayback.soloUndoRemaining}
            soloUndoLimit={SOLO_UNDO_LIMIT}
            undoRecentActions={historyPlayback.recentUndoableActions}
            undoPending={historyPlayback.undoPending}
            onUndo={historyPlayback.requestSoloUndo}
            showUndoVoteRequest={!historyPlayback.isSoloGame}
            undoVoteRemaining={historyPlayback.multiplayerUndoRemaining}
            onRequestUndoVote={historyPlayback.requestUndoVote}
            disableUndoControls={
              mahjong.mahjongDialogLoading ||
              mahjong.awaitingMahjongValidation !== null ||
              mahjong.mahjongDeclaredMessage !== null
            }
          />
        }
      />
      {historyPlayback.isHistoricalView && (
        <div
          className="absolute bottom-36 left-1/2 z-20 -translate-x-1/2 rounded bg-slate-950/90 px-3 py-1 text-xs text-slate-100"
          role="status"
          aria-live="polite"
        >
          Read-only mode - viewing history
        </div>
      )}

      <div className="absolute right-4 top-4 z-30">
        <div className="flex gap-2">
          {hintSystem.currentHint && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => hintSystem.setShowHintPanel(!hintSystem.showHintPanel)}
              data-testid="toggle-hint-panel-button"
              aria-pressed={hintSystem.showHintPanel}
            >
              {hintSystem.showHintPanel ? 'Hide Hint' : 'Show Hint'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => hintSystem.setShowHintSettings(true)}
            data-testid="hint-settings-button"
          >
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => historyPlayback.setIsHistoryOpen(true)}
            data-testid="history-button"
          >
            History
          </Button>
        </div>
      </div>
    </>
  );
}
