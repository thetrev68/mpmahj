import { useState } from 'react';
import { ActionBar } from '@/components/game/ActionBar';
import { GameplayStatusBar } from '@/components/game/GameplayStatusBar';
import { PlayerRack } from '@/components/game/PlayerRack';
import { DiscardPool } from '@/components/game/DiscardPool';
import { OpponentRack } from '@/components/game/OpponentRack';
import { RightRailHintSection } from '@/components/game/RightRailHintSection';
import { PlayerZone } from '@/components/game/PlayerZone';
import { StagingStrip } from '@/components/game/StagingStrip';
import type { StagedTile } from '@/components/game/StagingStrip';
import { getOpponentPosition } from '@/components/game/opponentRackUtils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { DrawStatus } from '@/hooks/useAutoDraw';
import type { ToggleSelectionResult } from '@/hooks/useTileSelection';
import type { HintSettings } from '@/lib/hintSettings';
import { selectedIdsToTiles } from '@/lib/utils/tileSelection';
import type { TileInstance } from '@/lib/utils/tileSelection';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { ExchangeableJokersBySeat } from '@/types/game/exchange';

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
  exchangeableJokersBySeat: ExchangeableJokersBySeat;
  handleJokerTileClick: (seat: Seat, meldIndex: number, tilePosition: number) => void;
}

interface HintSystemPresentationSlice {
  canRequestHint: boolean;
  currentHint: HintData | null;
  hintPending: boolean;
  hintError: string | null;
  hintSettings: HintSettings;
  openHintRequestDialog: () => void;
  cancelHintRequest: () => void;
  setShowHintSettings: (show: boolean) => void;
}

interface HistoryPlaybackPresentationSlice {
  isHistoricalView: boolean;
  pushUndoAction: (description: string) => void;
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
  canDeclareMahjongCall: boolean;
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
  canDeclareMahjongCall,
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
  const [isMobileHintsOpen, setIsMobileHintsOpen] = useState(false);
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

  const handleOpenMobileHintRequest = () => {
    setIsMobileHintsOpen(false);
    hintSystem.openHintRequestDialog();
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

  const opponentSlotClassByPosition: Record<'top' | 'left' | 'right', string> = {
    top: 'col-start-2 row-start-1 flex justify-center self-start',
    left: 'col-start-1 row-start-2 flex items-center justify-start self-center',
    right: 'col-start-3 row-start-2 flex items-center justify-end self-center',
  };

  return (
    <>
      <GameplayStatusBar
        phase={{ Playing: turnStage }}
        mySeat={gameState.your_seat}
        readOnly={historyPlayback.isHistoricalView}
      />
      <div
        className="pointer-events-none absolute inset-0 grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] gap-x-3 px-3 pb-4 pt-4 lg:gap-x-4 lg:px-4"
        data-testid="playing-board-regions"
      >
        {gameState.players
          .filter((p) => p.seat !== gameState.your_seat)
          .map((p) => {
            const pos = getOpponentPosition(gameState.your_seat, p.seat);
            const posClass = opponentSlotClassByPosition[pos];
            return (
              <div
                key={`slot-${p.seat}`}
                className={posClass}
                data-testid={`opponent-slot-${p.seat.toLowerCase()}`}
              >
                <OpponentRack
                  key={p.seat}
                  player={p}
                  yourSeat={gameState.your_seat}
                  melds={p.exposed_melds}
                  isActive={p.seat === currentTurn}
                  className="pointer-events-auto"
                  exchangeableJokersByMeld={meldActions.exchangeableJokersBySeat[p.seat] ?? {}}
                  onJokerTileClick={(meldIndex, tilePosition) =>
                    meldActions.handleJokerTileClick(p.seat, meldIndex, tilePosition)
                  }
                />
              </div>
            );
          })}

        {isMyTurn &&
          isDrawingStage &&
          autoDraw.drawStatus !== null &&
          autoDraw.drawStatus !== 'drawing' && (
            <div
              className="pointer-events-auto absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive backdrop-blur-sm"
              data-testid="draw-retry-banner"
              role="alert"
            >
              {typeof autoDraw.drawStatus === 'object' &&
                `Failed to draw tile. Retrying... ${autoDraw.drawStatus.retrying}/3`}
              {autoDraw.drawStatus === 'failed' &&
                'Failed to draw tile after 3 attempts. Please refresh.'}
            </div>
          )}

        <div
          className="col-start-2 row-start-2 flex min-h-0 items-center justify-center px-2 pb-24 pt-12"
          data-testid="discard-pool-region"
        >
          <DiscardPool
            discards={gameState.discard_pile.map((d, index) => ({
              tile: d.tile,
              discardedBy: d.discarded_by,
              turn: index + 1,
            }))}
            mostRecentTile={playing.mostRecentDiscard ?? undefined}
            callableTile={activeCallWindow?.tile}
            sortDiscards={hintSystem.hintSettings.sortDiscards}
          />
        </div>

        <div
          className="pointer-events-auto col-span-3 row-start-3 self-end"
          data-testid="player-zone-region"
        >
          <PlayerZone
            staging={
              <StagingStrip
                incomingTiles={
                  playing.stagedIncomingTile ? [playing.stagedIncomingTile] : incomingClaimTile
                }
                outgoingTiles={outgoingTiles}
                slotCount={isClaimWindowActive ? 6 : 1}
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
                onMeldClick={
                  historyPlayback.isHistoricalView ? undefined : meldActions.handleMeldClick
                }
                exchangeableJokersByMeld={
                  meldActions.exchangeableJokersBySeat[gameState.your_seat] ?? {}
                }
                onJokerTileClick={(meldIndex, tilePosition) =>
                  meldActions.handleJokerTileClick(gameState.your_seat, meldIndex, tilePosition)
                }
                isActive={gameState.your_seat === currentTurn}
              />
            }
            actions={
              <ActionBar
                phase={actionBarPhase}
                mySeat={gameState.your_seat}
                selectedTiles={selectedIdsToTiles(selectedIds)}
                isProcessing={playing.isProcessing}
                canDeclareMahjong={isClaimWindowActive ? canDeclareMahjongCall : canDeclareMahjong}
                onDeclareMahjong={
                  isClaimWindowActive ? handleDeclareMahjongCall : mahjong.handleDeclareMahjong
                }
                canCommitDiscard={canCommitDiscard}
                canProceedCallWindow={canProceedCallWindow}
                onProceedCallWindow={handleProceedCallWindow}
                callWindowInstruction={
                  activeCallWindow
                    ? `${getTileName(activeCallWindow.tile)} was discarded by ${activeCallWindow.discardedBy}. Press Proceed to skip, or stage matching tiles and press Proceed to claim. If you are Mahjong, press Mahjong.`
                    : undefined
                }
                claimCandidate={claimCandidate}
                onCommand={(cmd) => {
                  if ('DiscardTile' in cmd) {
                    handleCommitDiscard();
                    return;
                  }
                  sendCommand(cmd);
                }}
                readOnly={historyPlayback.isHistoricalView}
                readOnlyMessage="Historical View - No actions available"
              />
            }
          />
        </div>
      </div>
      {historyPlayback.isHistoricalView && (
        <div
          className="absolute bottom-36 left-1/2 z-20 -translate-x-1/2 rounded border border-border/70 bg-background/85 px-3 py-1 text-xs text-foreground backdrop-blur-sm"
          data-testid="history-read-only-banner"
          role="status"
          aria-live="polite"
        >
          Read-only mode - viewing history
        </div>
      )}

      <div className="absolute right-4 top-4 z-30">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 text-foreground backdrop-blur-sm hover:bg-accent lg:hidden"
            onClick={() => setIsMobileHintsOpen(true)}
            data-testid="mobile-hints-button"
          >
            Hints
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 text-foreground backdrop-blur-sm hover:bg-accent"
            onClick={() => hintSystem.setShowHintSettings(true)}
            data-testid="hint-settings-button"
          >
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-background/80 text-foreground backdrop-blur-sm hover:bg-accent"
            onClick={() => historyPlayback.setIsHistoryOpen(true)}
            data-testid="history-button"
          >
            History
          </Button>
        </div>
      </div>
      <Sheet open={isMobileHintsOpen} onOpenChange={setIsMobileHintsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[75vh] rounded-t-2xl p-4 lg:hidden"
          data-testid="mobile-hints-sheet"
        >
          <div className="flex h-full flex-col gap-4">
            <div>
              <SheetTitle>AI Hint</SheetTitle>
              <SheetDescription>
                Hint tools and latest advice for the current hand.
              </SheetDescription>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <RightRailHintSection
                canRequestHint={hintSystem.canRequestHint}
                currentHint={hintSystem.currentHint}
                hintPending={hintSystem.hintPending}
                hintError={hintSystem.hintError}
                hintSettings={hintSystem.hintSettings}
                isHistoricalView={historyPlayback.isHistoricalView}
                openHintRequestDialog={handleOpenMobileHintRequest}
                cancelHintRequest={hintSystem.cancelHintRequest}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
