import { AnimationSettings } from '@/components/game/AnimationSettings';
import { CallResolutionOverlay } from '@/components/game/CallResolutionOverlay';
import { CallWindowPanel } from '@/components/game/CallWindowPanel';
import { DeadHandOverlay } from '@/components/game/DeadHandOverlay';
import { DiscardAnimationLayer } from '@/components/game/DiscardAnimationLayer';
import { HintPanel } from '@/components/game/HintPanel';
import { HintSettingsSection } from '@/components/game/HintSettingsSection';
import { HistoricalViewBanner } from '@/components/game/HistoricalViewBanner';
import { HistoryPanel } from '@/components/game/HistoryPanel';
import type { ExchangeOpportunity } from '@/components/game/JokerExchangeDialog';
import { JokerExchangeDialog } from '@/components/game/JokerExchangeDialog';
import { MahjongConfirmationDialog } from '@/components/game/MahjongConfirmationDialog';
import { MahjongValidationDialog } from '@/components/game/MahjongValidationDialog';
import { ResumeConfirmationDialog } from '@/components/game/ResumeConfirmationDialog';
import { TimelineScrubber } from '@/components/game/TimelineScrubber';
import { UndoVotePanel } from '@/components/game/UndoVotePanel';
import { UpgradeConfirmationDialog } from '@/components/game/UpgradeConfirmationDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnimationPreferences } from '@/hooks/useAnimationSettings';
import type { UseHistoryDataResult } from '@/hooks/useHistoryData';
import type { HintSettings, HintSoundType } from '@/lib/hintSettings';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
import type { UpgradeOpportunity } from '@/lib/game-logic/meldUpgradeDetector';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Tile } from '@/types/bindings/generated/Tile';

interface CallWindowOverlaySlice {
  callWindow: {
    tile: Tile;
    discardedBy: Seat;
    canCall: Seat[];
    canAct: Seat[];
    intents: CallIntentSummary[];
    timerDuration: number;
    hasResponded: boolean;
    responseMessage?: string;
  } | null;
  timerRemaining: number | null;
}

interface HintSystemOverlaySlice {
  showHintPanel: boolean;
  currentHint: HintData | null;
  requestVerbosity: HintVerbosity;
  setShowHintPanel: (show: boolean) => void;
  hintPending: boolean;
  cancelHintRequest: () => void;
  showHintRequestDialog: boolean;
  setShowHintRequestDialog: (show: boolean) => void;
  setRequestVerbosity: (verbosity: HintVerbosity) => void;
  handleRequestHint: () => void;
  showHintSettings: boolean;
  setShowHintSettings: (show: boolean) => void;
  hintSettings: HintSettings;
  handleHintSettingsChange: (nextSettings: HintSettings) => void;
  handleResetHintSettings: () => void;
  handleTestHintSound: (soundType: HintSoundType) => void;
  hintStatusMessage: string | null;
}

interface HistoryPlaybackOverlaySlice {
  undoNotice: string | null;
  isSoloGame: boolean;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  history: UseHistoryDataResult;
  requestJumpToMove: (moveNumber: number) => void;
  historicalMoveNumber: number | null;
  historyLoadingMessage: string | null;
  undoRequest: { requester: Seat; target_move: number } | null;
  playerSeats: Seat[];
  undoVotes: Partial<Record<Seat, boolean | null>>;
  voteUndo: (approve: boolean) => void;
  undoVoteSecondsRemaining: number | null;
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
  showJokerExchangeDialog: boolean;
  jokerExchangeOpportunities: ExchangeOpportunity[];
  jokerExchangeLoading: boolean;
  handleJokerExchange: (opportunity: ExchangeOpportunity) => void;
  handleCloseJokerExchange: () => void;
  upgradeDialogState: UpgradeOpportunity | null;
  upgradeDialogLoading: boolean;
  handleUpgradeConfirm: (command: GameCommand) => void;
  handleUpgradeCancel: () => void;
}

interface PlayingStateOverlaySlice {
  resolutionOverlay: ResolutionOverlayData | null;
  dismissResolutionOverlay: () => void;
  discardAnimationTile: Tile | null;
  setDiscardAnimation: (tile: Tile | null) => void;
}

interface PlayingPhaseOverlaysProps {
  animationSettings: AnimationPreferences;
  callEligibility: {
    canCallForPung: boolean;
    canCallForKong: boolean;
    canCallForQuint: boolean;
    canCallForSextet: boolean;
    canCallForMahjong: boolean;
  };
  callWindow: CallWindowOverlaySlice;
  canDeclareMahjong: boolean;
  errorMessage: string | null;
  forfeitedPlayers: Set<Seat>;
  gameState: GameStateSnapshot;
  getDuration: (base: number) => number;
  handleCallIntent: (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => void;
  handlePass: () => void;
  hintSystem: HintSystemOverlaySlice;
  historyPlayback: HistoryPlaybackOverlaySlice;
  isTileMovementEnabled: boolean;
  mahjong: MahjongOverlaySlice;
  meldActions: MeldActionsOverlaySlice;
  playing: PlayingStateOverlaySlice;
  prefersReducedMotion: boolean;
  updateAnimationSettings: (settings: Partial<AnimationPreferences>) => void;
}

export function PlayingPhaseOverlays({
  animationSettings,
  callEligibility,
  callWindow,
  canDeclareMahjong,
  errorMessage,
  forfeitedPlayers,
  gameState,
  getDuration,
  handleCallIntent,
  handlePass,
  hintSystem,
  historyPlayback,
  isTileMovementEnabled,
  mahjong,
  meldActions,
  playing,
  prefersReducedMotion,
  updateAnimationSettings,
}: PlayingPhaseOverlaysProps) {
  return (
    <>
      {hintSystem.showHintPanel && hintSystem.currentHint && (
        <HintPanel
          hint={hintSystem.currentHint}
          verbosity={hintSystem.requestVerbosity}
          onClose={() => {
            hintSystem.setShowHintPanel(false);
          }}
        />
      )}

      {hintSystem.hintPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          data-testid="hint-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="space-y-3 rounded-lg border border-cyan-500/60 bg-slate-950 p-6 text-center text-slate-100">
            <p className="text-base font-semibold">AI analyzing your hand... (1-3 seconds)</p>
            <Button
              variant="outline"
              onClick={hintSystem.cancelHintRequest}
              data-testid="cancel-hint-request-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={hintSystem.showHintRequestDialog}
        onOpenChange={hintSystem.setShowHintRequestDialog}
      >
        <DialogContent data-testid="hint-request-dialog">
          <DialogHeader>
            <DialogTitle>Request AI Hint</DialogTitle>
            <DialogDescription>Choose how much detail you want in this hint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={hintSystem.requestVerbosity}
              onValueChange={(value) =>
                hintSystem.setRequestVerbosity(
                  value as 'Beginner' | 'Intermediate' | 'Expert' | 'Disabled'
                )
              }
            >
              <SelectTrigger data-testid="hint-request-verbosity-select">
                <SelectValue placeholder="Select verbosity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Expert">Expert</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={hintSystem.handleRequestHint}
              disabled={hintSystem.requestVerbosity === 'Disabled'}
              data-testid="request-analysis-button"
            >
              Request Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hintSystem.showHintSettings} onOpenChange={hintSystem.setShowHintSettings}>
        <DialogContent className="max-w-2xl" data-testid="hint-settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your hint defaults, audio, and animations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <HintSettingsSection
              settings={hintSystem.hintSettings}
              onChange={hintSystem.handleHintSettingsChange}
              onReset={hintSystem.handleResetHintSettings}
              onTestSound={hintSystem.handleTestHintSound}
            />
            <AnimationSettings
              settings={animationSettings}
              onChange={updateAnimationSettings}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
          {hintSystem.hintStatusMessage && (
            <p className="text-sm text-cyan-300" data-testid="hint-settings-status">
              {hintSystem.hintStatusMessage}
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

      <JokerExchangeDialog
        isOpen={meldActions.showJokerExchangeDialog}
        opportunities={meldActions.jokerExchangeOpportunities}
        isLoading={meldActions.jokerExchangeLoading}
        onExchange={meldActions.handleJokerExchange}
        onClose={meldActions.handleCloseJokerExchange}
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
          className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-400 text-yellow-100 px-5 py-2 rounded-lg text-sm text-center z-30"
          data-testid="mahjong-opportunity-message"
          aria-live="polite"
        >
          You have Mahjong! Declare to win or discard to continue.
        </div>
      )}

      {mahjong.mahjongDeclaredMessage && (
        <div
          className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-500 text-yellow-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="mahjong-declared-message"
          aria-live="polite"
        >
          {mahjong.mahjongDeclaredMessage}
        </div>
      )}

      {mahjong.deadHandNotice && (
        <div
          className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg text-center z-40"
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

      {callWindow.callWindow && (
        <CallWindowPanel
          callableTile={callWindow.callWindow.tile}
          discardedBy={callWindow.callWindow.discardedBy}
          canCallForPung={callEligibility.canCallForPung}
          canCallForKong={callEligibility.canCallForKong}
          canCallForQuint={callEligibility.canCallForQuint}
          canCallForSextet={callEligibility.canCallForSextet}
          canCallForMahjong={callEligibility.canCallForMahjong}
          onCallIntent={handleCallIntent}
          onPass={handlePass}
          timerRemaining={callWindow.timerRemaining ?? callWindow.callWindow.timerDuration}
          timerDuration={callWindow.callWindow.timerDuration}
          disabled={callWindow.callWindow.hasResponded || forfeitedPlayers.has(gameState.your_seat)}
          responseMessage={callWindow.callWindow.responseMessage}
          respondedSeats={
            callWindow.callWindow.canCall.filter(
              (seat) => !callWindow.callWindow!.canAct.includes(seat)
            ) || []
          }
          intentSummaries={callWindow.callWindow.intents}
        />
      )}

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
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-sm px-4 py-2 rounded"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {historyPlayback.undoNotice && (
        <div
          className="fixed left-1/2 top-[170px] z-40 -translate-x-1/2 rounded bg-sky-900/90 px-4 py-2 text-sm text-sky-100"
          role="status"
          aria-live="polite"
          data-testid="undo-notice"
        >
          {historyPlayback.undoNotice}
        </div>
      )}

      {hintSystem.hintStatusMessage && !hintSystem.showHintSettings && (
        <div
          className="fixed left-1/2 top-[205px] z-40 -translate-x-1/2 rounded bg-cyan-900/90 px-4 py-2 text-sm text-cyan-100"
          role="status"
          aria-live="polite"
          data-testid="hint-status-banner"
        >
          {hintSystem.hintStatusMessage}
        </div>
      )}

      {!historyPlayback.isSoloGame && (
        <UndoVotePanel
          undoRequest={historyPlayback.undoRequest}
          currentSeat={gameState.your_seat}
          seats={historyPlayback.playerSeats}
          votes={historyPlayback.undoVotes}
          onVote={historyPlayback.voteUndo}
          timeRemaining={historyPlayback.undoVoteSecondsRemaining ?? undefined}
        />
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
          className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded border border-amber-400/70 bg-amber-900/90 px-4 py-2 text-sm text-amber-100"
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
