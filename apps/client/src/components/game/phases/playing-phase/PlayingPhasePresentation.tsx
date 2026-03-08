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
  callWindow: { tile: Tile } | null;
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
  canDeclareMahjong: boolean;
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
  mahjong: MahjongPresentationSlice;
  meldActions: MeldActionsPresentationSlice;
  playing: PlayingStateSlice;
  selectedIds: string[];
  sendCommand: (cmd: GameCommand) => void;
  toggleTile: (tileId: string) => void;
  turnStage: TurnStage;
}

export function PlayingPhasePresentation({
  animations,
  autoDraw,
  callWindow,
  canDeclareMahjong,
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
  mahjong,
  meldActions,
  playing,
  selectedIds,
  sendCommand,
  toggleTile,
  turnStage,
}: PlayingPhasePresentationProps) {
  const localPlayer = gameState.players.find((player) => player.seat === gameState.your_seat);

  return (
    <>
      {gameState.players
        .filter((p) => p.seat !== gameState.your_seat)
        .map((p) => {
          const pos = getOpponentPosition(gameState.your_seat, p.seat);
          const posClass =
            pos === 'top'
              ? 'fixed top-16 left-1/2 -translate-x-1/2 z-10'
              : pos === 'right'
                ? 'fixed right-2 top-1/2 -translate-y-1/2 z-10'
                : 'fixed left-2 top-1/2 -translate-y-1/2 z-10';
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
            className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
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
        callableTile={callWindow.callWindow?.tile}
      />

      <PlayerZone
        staging={
          <StagingStrip
            incomingTiles={playing.stagedIncomingTile ? [playing.stagedIncomingTile] : []}
            outgoingTiles={
              isDiscardingStage
                ? selectedIds
                    .map((id) => handTileInstances.find((instance) => instance.id === id))
                    .filter(
                      (instance): instance is (typeof handTileInstances)[number] =>
                        instance !== undefined
                    )
                    .map((instance) => ({
                      id: instance.id,
                      tile: instance.tile,
                    }))
                : []
            }
            incomingSlotCount={1}
            outgoingSlotCount={1}
            blindIncoming={false}
            incomingFromSeat={animations.incomingFromSeat}
            onFlipIncoming={() => {}}
            onAbsorbIncoming={() => playing.setStagedIncomingTile(null)}
            onRemoveOutgoing={(tileId) => toggleTile(tileId)}
            onCommitPass={() => {}}
            onCommitCall={() => {}}
            onCommitDiscard={() => {
              if (
                !isDiscardingStage ||
                !isMyTurn ||
                selectedIds.length !== 1 ||
                playing.isProcessing
              ) {
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
            }}
            canCommitPass={false}
            canCommitCall={false}
            canCommitDiscard={
              !historyPlayback.isHistoricalView &&
              isDiscardingStage &&
              isMyTurn &&
              !playing.isProcessing &&
              selectedIds.length === 1
            }
            isProcessing={playing.isProcessing}
          />
        }
        rack={
          <PlayerRack
            tiles={
              playing.stagedIncomingTile
                ? handTileInstances.filter((i) => i.id !== playing.stagedIncomingTile!.id)
                : handTileInstances
            }
            mode={historyPlayback.isHistoricalView ? 'view-only' : 'discard'}
            selectedTileIds={selectedIds}
            onTileSelect={toggleTile}
            maxSelection={1}
            disabled={
              historyPlayback.isHistoricalView || !isDiscardingStage || playing.isProcessing
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
          />
        }
        actions={
          <ActionBar
            phase={{ Playing: turnStage }}
            mySeat={gameState.your_seat}
            selectedTiles={selectedIdsToTiles(selectedIds)}
            isProcessing={playing.isProcessing}
            canDeclareMahjong={canDeclareMahjong}
            onDeclareMahjong={mahjong.handleDeclareMahjong}
            canExchangeJoker={meldActions.canExchangeJoker}
            onExchangeJoker={meldActions.handleOpenJokerExchange}
            canRequestHint={hintSystem.canRequestHint}
            onOpenHintRequest={hintSystem.openHintRequestDialog}
            isHintRequestPending={hintSystem.hintPending}
            suppressDiscardAction={true}
            onCommand={(cmd) => {
              sendCommand(cmd);
              if ('DiscardTile' in cmd) {
                historyPlayback.pushUndoAction(`Discarded ${getTileName(cmd.DiscardTile.tile)}`);
                playing.setProcessing(true);
                clearSelection();
              }
              if ('CommitCharlestonPass' in cmd) {
                historyPlayback.pushUndoAction('Passed tiles');
              }
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
          className="fixed bottom-32 left-1/2 z-20 -translate-x-1/2 rounded bg-slate-950/90 px-3 py-1 text-xs text-slate-100"
          role="status"
          aria-live="polite"
        >
          Read-only mode - viewing history
        </div>
      )}

      <div className="fixed right-6 top-6 z-30">
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
