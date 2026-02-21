import { ActionBar } from '@/components/game/ActionBar';
import { ConcealedHand } from '@/components/game/ConcealedHand';
import { DiscardPool } from '@/components/game/DiscardPool';
import { ExposedMeldsArea } from '@/components/game/ExposedMeldsArea';
import { OpponentRack } from '@/components/game/OpponentRack';
import { WindCompass } from '@/components/game/WindCompass';
import { getOpponentPosition } from '@/components/game/opponentRackUtils';
import { Button } from '@/components/ui/button';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useMeldActions } from '@/hooks/useMeldActions';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import { buildTileInstances, selectedIdsToTiles } from '@/lib/utils/tileSelection';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

const SOLO_UNDO_LIMIT = 10;

interface PlayingPhasePresentationProps {
  animations: ReturnType<typeof useGameAnimations>;
  autoDraw: ReturnType<typeof useAutoDraw>;
  callWindow: ReturnType<typeof useCallWindowState>;
  canDeclareMahjong: boolean;
  clearSelection: () => void;
  combinedHighlightedIds: string[];
  currentTurn: Seat;
  forfeitedPlayers: Set<Seat>;
  gameState: GameStateSnapshot;
  handTileInstances: ReturnType<typeof buildTileInstances>;
  historyPlayback: ReturnType<typeof useHistoryPlayback>;
  hintSystem: ReturnType<typeof useHintSystem>;
  isDiscardingStage: boolean;
  isDrawingStage: boolean;
  isMyTurn: boolean;
  mahjong: ReturnType<typeof useMahjongDeclaration>;
  meldActions: ReturnType<typeof useMeldActions>;
  onLeaveConfirmed?: () => void;
  playing: ReturnType<typeof usePlayingPhaseState>;
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
  forfeitedPlayers,
  gameState,
  handTileInstances,
  historyPlayback,
  hintSystem,
  isDiscardingStage,
  isDrawingStage,
  isMyTurn,
  mahjong,
  meldActions,
  onLeaveConfirmed,
  playing,
  selectedIds,
  sendCommand,
  toggleTile,
  turnStage,
}: PlayingPhasePresentationProps) {
  return (
    <>
      <WindCompass
        yourSeat={gameState.your_seat}
        activeSeat={currentTurn}
        stage={turnStage}
        deadHandSeats={Array.from(mahjong.deadHandPlayers)}
      />

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

      {gameState.players.map((player) => (
        <ExposedMeldsArea
          key={player.seat}
          melds={player.exposed_melds}
          compact={player.seat !== gameState.your_seat}
          ownerSeat={player.seat}
          upgradeableMeldIndices={
            player.seat === gameState.your_seat && !historyPlayback.isHistoricalView
              ? meldActions.upgradeableMeldIndices
              : []
          }
          onMeldClick={player.seat === gameState.your_seat ? meldActions.handleMeldClick : undefined}
        />
      ))}

      <ConcealedHand
        tiles={handTileInstances}
        mode={historyPlayback.isHistoricalView ? 'view-only' : 'discard'}
        selectedTileIds={selectedIds}
        onTileSelect={toggleTile}
        maxSelection={1}
        disabled={
          historyPlayback.isHistoricalView ||
          !isDiscardingStage ||
          playing.isProcessing ||
          forfeitedPlayers.has(gameState.your_seat)
        }
        highlightedTileIds={combinedHighlightedIds}
        incomingFromSeat={animations.incomingFromSeat}
        leavingTileIds={animations.leavingTileIds}
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

      <div role="group" aria-label="action bar">
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
          onCommand={(cmd) => {
            sendCommand(cmd);
            if ('DiscardTile' in cmd) {
              historyPlayback.pushUndoAction(`Discarded ${getTileName(cmd.DiscardTile.tile)}`);
              playing.setProcessing(true);
              clearSelection();
            }
            if ('PassTiles' in cmd) {
              historyPlayback.pushUndoAction('Passed tiles');
            }
          }}
          onLeaveConfirmed={onLeaveConfirmed}
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
      </div>

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
