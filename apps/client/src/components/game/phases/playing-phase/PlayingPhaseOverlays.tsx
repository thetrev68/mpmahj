import { AnimationSettings } from '@/components/game/AnimationSettings';
import { AudioSettingsSection } from '@/components/game/AudioSettingsSection';
import { CallResolutionOverlay } from '@/components/game/CallResolutionOverlay';
import { DeadHandOverlay } from '@/components/game/DeadHandOverlay';
import { DiscardAnimationLayer } from '@/components/game/DiscardAnimationLayer';
import { HintSettingsSection } from '@/components/game/HintSettingsSection';
import { HistoricalViewBanner } from '@/components/game/HistoricalViewBanner';
import { HistoryPanel } from '@/components/game/HistoryPanel';
import { JokerExchangeConfirmDialog } from '@/components/game/JokerExchangeConfirmDialog';
import { MahjongConfirmationDialog } from '@/components/game/MahjongConfirmationDialog';
import { MahjongValidationDialog } from '@/components/game/MahjongValidationDialog';
import { ResumeConfirmationDialog } from '@/components/game/ResumeConfirmationDialog';
import { TimelineScrubber } from '@/components/game/TimelineScrubber';
import { UpgradeConfirmationDialog } from '@/components/game/UpgradeConfirmationDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UseHistoryDataResult } from '@/hooks/useHistoryData';
import type { AudioSettings } from '@/lib/audioSettings';
import type { HintSettings } from '@/lib/hintSettings';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
import type { UpgradeOpportunity } from '@/lib/game-logic/meldUpgradeDetector';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { ExchangeOpportunity } from '@/types/game/exchange';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface HintSystemOverlaySlice {
  currentHint: HintData | null;
  hintPending: boolean;
  hintError: string | null;
  cancelHintRequest: () => void;
  showHintSettings: boolean;
  setShowHintSettings: (show: boolean) => void;
  hintSettings: HintSettings;
  handleHintSettingsChange: (nextSettings: HintSettings) => void;
  hintStatusMessage: string | null;
  audioSettings: AudioSettings;
  handleSoundEffectsEnabledChange: (enabled: boolean) => void;
  handleSoundEffectsVolumeChange: (volume: number) => void;
  handleMusicEnabledChange: (enabled: boolean) => void;
  handleMusicVolumeChange: (volume: number) => void;
}

interface HistoryPlaybackOverlaySlice {
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  history: UseHistoryDataResult;
  requestJumpToMove: (moveNumber: number) => void;
  historicalMoveNumber: number | null;
  historyLoadingMessage: string | null;
  isHistoricalView: boolean;
  historicalDescription: string;
  canResumeFromHistory: boolean;
  returnToPresent: () => void;
  setShowResumeDialog: (show: boolean) => void;
  totalMoves: number;
  showResumeDialog: boolean;
  isResuming: boolean;
  confirmResumeFromHere: () => void;
  historyWarning: string | null;
  setHistoryWarning: (message: string | null) => void;
}

interface MahjongOverlaySlice {
  showMahjongDialog: boolean;
  mahjongDialogLoading: boolean;
  handleMahjongConfirm: (command: GameCommand) => void;
  handleMahjongCancel: () => void;
  awaitingMahjongValidation: { calledTile: Tile; discardedBy: Seat } | null;
  awaitingValidationLoading: boolean;
  handleMahjongValidationSubmit: (command: GameCommand) => void;
  mahjongDeclaredMessage: string | null;
  deadHandNotice: string | null;
  showDeadHandOverlay: boolean;
  deadHandOverlayData: { player: Seat; reason: string } | null;
  setDeadHandOverlayVisible: (visible: boolean) => void;
}

interface MeldActionsOverlaySlice {
  pendingExchangeOpportunity: ExchangeOpportunity | null;
  jokerExchangeLoading: boolean;
  inlineError: string | null;
  handleConfirmExchange: (stagedTiles: Tile[], concealedHand: Tile[]) => void;
  handleCancelExchange: () => void;
  upgradeDialogState: UpgradeOpportunity | null;
  upgradeDialogLoading: boolean;
  handleUpgradeConfirm: (command: GameCommand) => void;
  handleUpgradeCancel: () => void;
}

interface StagedTilesOverlaySlice {
  incoming: Tile[];
  outgoing: Tile[];
  concealedAfterExcludingStaged: Tile[];
}

interface PlayingStateOverlaySlice {
  resolutionOverlay: ResolutionOverlayData | null;
  dismissResolutionOverlay: () => void;
  discardAnimationTile: Tile | null;
  setDiscardAnimation: (tile: Tile | null) => void;
}

interface PlayingPhaseOverlaysProps {
  canDeclareMahjong: boolean;
  errorMessage: string | null;
  gameState: GameStateSnapshot;
  getDuration: (base: number) => number;
  hintSystem: HintSystemOverlaySlice;
  historyPlayback: HistoryPlaybackOverlaySlice;
  isTileMovementEnabled: boolean;
  mahjong: MahjongOverlaySlice;
  meldActions: MeldActionsOverlaySlice;
  stagedTiles: StagedTilesOverlaySlice;
  playing: PlayingStateOverlaySlice;
  prefersReducedMotion: boolean;
}

export function PlayingPhaseOverlays({
  canDeclareMahjong,
  errorMessage,
  gameState,
  getDuration,
  hintSystem,
  historyPlayback,
  isTileMovementEnabled,
  mahjong,
  meldActions,
  stagedTiles,
  playing,
  prefersReducedMotion,
}: PlayingPhaseOverlaysProps) {
  return (
    <>
      <Dialog open={hintSystem.showHintSettings} onOpenChange={hintSystem.setShowHintSettings}>
        <DialogContent className="max-w-2xl" data-testid="hint-settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your hint defaults, audio, and animations.
            </DialogDescription>
          </DialogHeader>
          <ErrorBoundary>
            <div className="space-y-4">
              <HintSettingsSection
                settings={hintSystem.hintSettings}
                onChange={hintSystem.handleHintSettingsChange}
              />
              <AudioSettingsSection
                soundEffectsEnabled={hintSystem.audioSettings.soundEffectsEnabled}
                soundEffectsVolume={hintSystem.audioSettings.soundEffectsVolume}
                musicEnabled={hintSystem.audioSettings.musicEnabled}
                musicVolume={hintSystem.audioSettings.musicVolume}
                onSoundEffectsEnabledChange={hintSystem.handleSoundEffectsEnabledChange}
                onSoundEffectsVolumeChange={hintSystem.handleSoundEffectsVolumeChange}
                onMusicEnabledChange={hintSystem.handleMusicEnabledChange}
                onMusicVolumeChange={hintSystem.handleMusicVolumeChange}
              />
              <AnimationSettings prefersReducedMotion={prefersReducedMotion} />
            </div>
          </ErrorBoundary>
          {hintSystem.hintStatusMessage && (
            <p
              className="text-sm text-cyan-600 dark:text-cyan-300"
              data-testid="hint-settings-status"
            >
              {hintSystem.hintStatusMessage}
            </p>
          )}
          {hintSystem.hintError && (
            <p className="text-sm text-destructive" data-testid="hint-settings-error">
              {hintSystem.hintError}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <MahjongConfirmationDialog
        isOpen={mahjong.showMahjongDialog}
        hand={gameState.your_hand}
        mySeat={gameState.your_seat}
        isLoading={mahjong.mahjongDialogLoading}
        onConfirm={mahjong.handleMahjongConfirm}
        onCancel={mahjong.handleMahjongCancel}
      />

      <MahjongValidationDialog
        isOpen={mahjong.awaitingMahjongValidation !== null}
        concealedHand={gameState.your_hand}
        calledTile={mahjong.awaitingMahjongValidation?.calledTile ?? 0}
        discardedBy={mahjong.awaitingMahjongValidation?.discardedBy ?? 'East'}
        mySeat={gameState.your_seat}
        isLoading={mahjong.awaitingValidationLoading}
        onSubmit={mahjong.handleMahjongValidationSubmit}
      />

      <JokerExchangeConfirmDialog
        isOpen={meldActions.pendingExchangeOpportunity !== null}
        opportunity={meldActions.pendingExchangeOpportunity}
        isLoading={meldActions.jokerExchangeLoading}
        inlineError={meldActions.inlineError}
        onConfirm={() =>
          meldActions.handleConfirmExchange(
            [...stagedTiles.incoming, ...stagedTiles.outgoing],
            stagedTiles.concealedAfterExcludingStaged
          )
        }
        onCancel={meldActions.handleCancelExchange}
      />

      {meldActions.upgradeDialogState && (
        <UpgradeConfirmationDialog
          isOpen={true}
          meldType={
            gameState.players.find((p) => p.seat === gameState.your_seat)?.exposed_melds[
              meldActions.upgradeDialogState.meldIndex
            ]?.meld_type ?? 'Pung'
          }
          upgrade={meldActions.upgradeDialogState.upgrade}
          tile={meldActions.upgradeDialogState.tile}
          meldIndex={meldActions.upgradeDialogState.meldIndex}
          mySeat={gameState.your_seat}
          isLoading={meldActions.upgradeDialogLoading}
          onConfirm={meldActions.handleUpgradeConfirm}
          onCancel={meldActions.handleUpgradeCancel}
        />
      )}

      {canDeclareMahjong && !mahjong.showMahjongDialog && (
        <div
          className="fixed left-1/2 top-[100px] z-30 -translate-x-1/2 rounded-lg border border-amber-400/70 bg-amber-50/95 px-5 py-2 text-center text-sm text-amber-950 shadow-sm dark:bg-amber-950/80 dark:text-amber-100"
          data-testid="mahjong-opportunity-message"
          aria-live="polite"
        >
          You have Mahjong! Declare to win or discard to continue.
        </div>
      )}

      {mahjong.mahjongDeclaredMessage && (
        <div
          className="fixed left-1/2 top-1/4 z-40 -translate-x-1/2 rounded-lg border border-amber-500/70 bg-amber-50/95 px-6 py-3 text-center text-amber-950 shadow-sm dark:bg-amber-950/85 dark:text-amber-100"
          data-testid="mahjong-declared-message"
          aria-live="polite"
        >
          {mahjong.mahjongDeclaredMessage}
        </div>
      )}

      {mahjong.deadHandNotice && (
        <div
          className="fixed left-1/2 top-1/3 z-40 -translate-x-1/2 rounded-lg border border-red-500/70 bg-red-50/95 px-6 py-3 text-center text-red-950 shadow-sm dark:bg-red-950/85 dark:text-red-200"
          data-testid="dead-hand-notice"
          aria-live="assertive"
        >
          {mahjong.deadHandNotice}
        </div>
      )}

      <DeadHandOverlay
        show={mahjong.showDeadHandOverlay && mahjong.deadHandOverlayData !== null}
        player={mahjong.deadHandOverlayData?.player ?? 'East'}
        reason={mahjong.deadHandOverlayData?.reason ?? ''}
        revealedHand={gameState.your_hand}
        onAcknowledge={() => mahjong.setDeadHandOverlayVisible(false)}
      />

      {playing.resolutionOverlay && (
        <CallResolutionOverlay
          resolution={playing.resolutionOverlay.resolution}
          tieBreak={playing.resolutionOverlay.tieBreak}
          allCallers={playing.resolutionOverlay.allCallers}
          discardedBy={playing.resolutionOverlay.discardedBy}
          onDismiss={playing.dismissResolutionOverlay}
        />
      )}

      {playing.discardAnimationTile !== null && isTileMovementEnabled && (
        <DiscardAnimationLayer
          tile={playing.discardAnimationTile}
          duration={getDuration(400)}
          onComplete={() => playing.setDiscardAnimation(null)}
        />
      )}

      {errorMessage && (
        <div
          className="fixed left-1/2 top-[135px] -translate-x-1/2 rounded border border-border/70 bg-background/85 px-4 py-2 text-sm text-foreground shadow-sm backdrop-blur-sm"
          data-testid="playing-error-banner"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {hintSystem.hintStatusMessage && !hintSystem.showHintSettings && (
        <div
          className="fixed left-1/2 top-[205px] z-40 -translate-x-1/2 rounded border border-cyan-500/40 bg-cyan-50/95 px-4 py-2 text-sm text-cyan-950 shadow-sm dark:bg-cyan-950/80 dark:text-cyan-100"
          role="status"
          aria-live="polite"
          data-testid="hint-status-banner"
        >
          {hintSystem.hintStatusMessage}
        </div>
      )}

      <HistoryPanel
        isOpen={historyPlayback.isHistoryOpen}
        roomId={gameState.game_id}
        onClose={() => historyPlayback.setIsHistoryOpen(false)}
        history={historyPlayback.history}
        onJumpToMove={historyPlayback.requestJumpToMove}
        activeMoveNumber={historyPlayback.historicalMoveNumber}
        dimmed={historyPlayback.historyLoadingMessage !== null}
        overlayMessage={historyPlayback.historyLoadingMessage}
      />

      {historyPlayback.isHistoricalView && historyPlayback.historicalMoveNumber !== null && (
        <>
          <HistoricalViewBanner
            moveNumber={historyPlayback.historicalMoveNumber}
            moveDescription={historyPlayback.historicalDescription}
            isGameOver={false}
            canResume={historyPlayback.canResumeFromHistory}
            onReturnToPresent={historyPlayback.returnToPresent}
            onResumeFromHere={() => historyPlayback.setShowResumeDialog(true)}
          />
          <TimelineScrubber
            currentMove={historyPlayback.historicalMoveNumber}
            totalMoves={Math.max(historyPlayback.totalMoves, historyPlayback.historicalMoveNumber)}
            onMoveChange={historyPlayback.requestJumpToMove}
          />
        </>
      )}

      <ResumeConfirmationDialog
        isOpen={historyPlayback.showResumeDialog}
        moveNumber={historyPlayback.historicalMoveNumber ?? 1}
        currentMove={Math.max(
          historyPlayback.totalMoves,
          historyPlayback.historicalMoveNumber ?? 1
        )}
        isLoading={historyPlayback.isResuming}
        onConfirm={historyPlayback.confirmResumeFromHere}
        onCancel={() => historyPlayback.setShowResumeDialog(false)}
      />

      {historyPlayback.historyWarning && (
        <div
          className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded border border-amber-400/70 bg-amber-50/95 px-4 py-2 text-sm text-amber-950 shadow-sm dark:bg-amber-950/85 dark:text-amber-100"
          role="alert"
          data-testid="history-warning"
        >
          <div className="flex items-center gap-2">
            <span>{historyPlayback.historyWarning}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => historyPlayback.setHistoryWarning(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
