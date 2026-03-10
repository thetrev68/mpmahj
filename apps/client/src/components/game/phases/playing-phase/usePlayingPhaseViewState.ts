import { useMemo } from 'react';
import type { GameAnimations } from '@/hooks/useGameAnimations';
import type { useAutoDraw } from '@/hooks/useAutoDraw';
import type { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import type { useHintSystem } from '@/hooks/useHintSystem';
import type { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import type { useMeldActions } from '@/hooks/useMeldActions';
import type { usePlayingStateFromStore } from './usePlayingUIAdapters';
import type { useCallWindowFromStore } from './usePlayingUIAdapters';

type AutoDrawState = ReturnType<typeof useAutoDraw>;
type HistoryPlaybackState = ReturnType<typeof useHistoryPlayback>;
type HintSystemState = ReturnType<typeof useHintSystem>;
type MahjongState = ReturnType<typeof useMahjongDeclaration>;
type MeldActionsState = ReturnType<typeof useMeldActions>;
type PlayingState = ReturnType<typeof usePlayingStateFromStore>;
type CallWindowState = ReturnType<typeof useCallWindowFromStore>;

interface UsePlayingPhaseViewStateOptions {
  animations: GameAnimations;
  autoDraw: AutoDrawState;
  callWindow: CallWindowState;
  historyPlayback: HistoryPlaybackState;
  hintSystem: HintSystemState;
  isTileMovementEnabled: boolean;
  mahjong: MahjongState;
  meldActions: MeldActionsState;
  playing: PlayingState;
}

export function usePlayingPhaseViewState({
  animations,
  autoDraw,
  callWindow,
  historyPlayback,
  hintSystem,
  isTileMovementEnabled,
  mahjong,
  meldActions,
  playing,
}: UsePlayingPhaseViewStateOptions) {
  const presentationAnimations = useMemo(
    () => ({
      incomingFromSeat: animations.incomingFromSeat,
      leavingTileIds: animations.leavingTileIds,
    }),
    [animations.incomingFromSeat, animations.leavingTileIds]
  );

  const presentationAutoDraw = useMemo(
    () => ({ drawStatus: autoDraw.drawStatus }),
    [autoDraw.drawStatus]
  );

  const presentationCallWindow = useMemo(
    () => ({
      callWindow: callWindow.callWindow
        ? { tile: callWindow.callWindow.tile, discardedBy: callWindow.callWindow.discardedBy }
        : null,
    }),
    [callWindow.callWindow]
  );

  const presentationHistoryPlayback = useMemo(
    () => ({
      isHistoricalView: historyPlayback.isHistoricalView,
      pushUndoAction: historyPlayback.pushUndoAction,
      isSoloGame: historyPlayback.isSoloGame,
      soloUndoRemaining: historyPlayback.soloUndoRemaining,
      recentUndoableActions: historyPlayback.recentUndoableActions,
      undoPending: historyPlayback.undoPending,
      requestSoloUndo: historyPlayback.requestSoloUndo,
      multiplayerUndoRemaining: historyPlayback.multiplayerUndoRemaining,
      requestUndoVote: historyPlayback.requestUndoVote,
      setIsHistoryOpen: historyPlayback.setIsHistoryOpen,
    }),
    [
      historyPlayback.isHistoricalView,
      historyPlayback.isSoloGame,
      historyPlayback.multiplayerUndoRemaining,
      historyPlayback.pushUndoAction,
      historyPlayback.recentUndoableActions,
      historyPlayback.requestSoloUndo,
      historyPlayback.requestUndoVote,
      historyPlayback.setIsHistoryOpen,
      historyPlayback.soloUndoRemaining,
      historyPlayback.undoPending,
    ]
  );

  const presentationHintSystem = useMemo(
    () => ({
      canRequestHint: hintSystem.canRequestHint,
      openHintRequestDialog: hintSystem.openHintRequestDialog,
      hintPending: hintSystem.hintPending,
      currentHint: hintSystem.currentHint,
      showHintPanel: hintSystem.showHintPanel,
      setShowHintPanel: hintSystem.setShowHintPanel,
      setShowHintSettings: hintSystem.setShowHintSettings,
    }),
    [
      hintSystem.canRequestHint,
      hintSystem.currentHint,
      hintSystem.hintPending,
      hintSystem.openHintRequestDialog,
      hintSystem.setShowHintPanel,
      hintSystem.setShowHintSettings,
      hintSystem.showHintPanel,
    ]
  );

  const presentationMahjong = useMemo(
    () => ({
      deadHandPlayers: mahjong.deadHandPlayers,
      handleDeclareMahjong: mahjong.handleDeclareMahjong,
      mahjongDialogLoading: mahjong.mahjongDialogLoading,
      awaitingMahjongValidation: mahjong.awaitingMahjongValidation,
      mahjongDeclaredMessage: mahjong.mahjongDeclaredMessage,
    }),
    [
      mahjong.awaitingMahjongValidation,
      mahjong.deadHandPlayers,
      mahjong.handleDeclareMahjong,
      mahjong.mahjongDeclaredMessage,
      mahjong.mahjongDialogLoading,
    ]
  );

  const presentationMeldActions = useMemo(
    () => ({
      upgradeableMeldIndices: meldActions.upgradeableMeldIndices,
      handleMeldClick: meldActions.handleMeldClick,
      canExchangeJoker: meldActions.canExchangeJoker,
      handleOpenJokerExchange: meldActions.handleOpenJokerExchange,
    }),
    [
      meldActions.canExchangeJoker,
      meldActions.handleMeldClick,
      meldActions.handleOpenJokerExchange,
      meldActions.upgradeableMeldIndices,
    ]
  );

  const presentationPlaying = useMemo(
    () => ({
      mostRecentDiscard: playing.mostRecentDiscard,
      isProcessing: playing.isProcessing,
      setProcessing: playing.setProcessing,
      setStagedIncomingTile: playing.setStagedIncomingTile,
      stagedIncomingTile: playing.stagedIncomingTile,
    }),
    [
      playing.isProcessing,
      playing.mostRecentDiscard,
      playing.setProcessing,
      playing.setStagedIncomingTile,
      playing.stagedIncomingTile,
    ]
  );

  const overlaysCallWindow = useMemo(
    () => ({
      callWindow: callWindow.callWindow
        ? {
            tile: callWindow.callWindow.tile,
            discardedBy: callWindow.callWindow.discardedBy,
            canCall: callWindow.callWindow.canCall,
            canAct: callWindow.callWindow.canAct,
            intents: callWindow.callWindow.intents,
            timerDuration: callWindow.callWindow.timerDuration,
            hasResponded: callWindow.callWindow.hasResponded,
            responseMessage: callWindow.callWindow.responseMessage,
          }
        : null,
      timerRemaining: callWindow.timerRemaining,
    }),
    [callWindow.callWindow, callWindow.timerRemaining]
  );

  const overlaysHintSystem = useMemo(
    () => ({
      showHintPanel: hintSystem.showHintPanel,
      currentHint: hintSystem.currentHint,
      requestVerbosity: hintSystem.requestVerbosity,
      setShowHintPanel: hintSystem.setShowHintPanel,
      hintPending: hintSystem.hintPending,
      cancelHintRequest: hintSystem.cancelHintRequest,
      showHintRequestDialog: hintSystem.showHintRequestDialog,
      setShowHintRequestDialog: hintSystem.setShowHintRequestDialog,
      setRequestVerbosity: hintSystem.setRequestVerbosity,
      handleRequestHint: hintSystem.handleRequestHint,
      showHintSettings: hintSystem.showHintSettings,
      setShowHintSettings: hintSystem.setShowHintSettings,
      hintSettings: hintSystem.hintSettings,
      handleHintSettingsChange: hintSystem.handleHintSettingsChange,
      handleResetHintSettings: hintSystem.handleResetHintSettings,
      handleTestHintSound: hintSystem.handleTestHintSound,
      hintStatusMessage: hintSystem.hintStatusMessage,
    }),
    [
      hintSystem.cancelHintRequest,
      hintSystem.currentHint,
      hintSystem.handleHintSettingsChange,
      hintSystem.handleRequestHint,
      hintSystem.handleResetHintSettings,
      hintSystem.handleTestHintSound,
      hintSystem.hintPending,
      hintSystem.hintSettings,
      hintSystem.hintStatusMessage,
      hintSystem.requestVerbosity,
      hintSystem.setRequestVerbosity,
      hintSystem.setShowHintPanel,
      hintSystem.setShowHintRequestDialog,
      hintSystem.setShowHintSettings,
      hintSystem.showHintPanel,
      hintSystem.showHintRequestDialog,
      hintSystem.showHintSettings,
    ]
  );

  const overlaysHistoryPlayback = useMemo(
    () => ({
      undoNotice: historyPlayback.undoNotice,
      isSoloGame: historyPlayback.isSoloGame,
      isHistoryOpen: historyPlayback.isHistoryOpen,
      setIsHistoryOpen: historyPlayback.setIsHistoryOpen,
      history: historyPlayback.history,
      requestJumpToMove: historyPlayback.requestJumpToMove,
      historicalMoveNumber: historyPlayback.historicalMoveNumber,
      historyLoadingMessage: historyPlayback.historyLoadingMessage,
      undoRequest: historyPlayback.undoRequest,
      playerSeats: historyPlayback.playerSeats,
      undoVotes: historyPlayback.undoVotes,
      voteUndo: historyPlayback.voteUndo,
      undoVoteSecondsRemaining: historyPlayback.undoVoteSecondsRemaining,
      isHistoricalView: historyPlayback.isHistoricalView,
      historicalDescription: historyPlayback.historicalDescription,
      canResumeFromHistory: historyPlayback.canResumeFromHistory,
      returnToPresent: historyPlayback.returnToPresent,
      setShowResumeDialog: historyPlayback.setShowResumeDialog,
      totalMoves: historyPlayback.totalMoves,
      showResumeDialog: historyPlayback.showResumeDialog,
      isResuming: historyPlayback.isResuming,
      confirmResumeFromHere: historyPlayback.confirmResumeFromHere,
      historyWarning: historyPlayback.historyWarning,
      setHistoryWarning: historyPlayback.setHistoryWarning,
    }),
    [
      historyPlayback.canResumeFromHistory,
      historyPlayback.confirmResumeFromHere,
      historyPlayback.historicalDescription,
      historyPlayback.historicalMoveNumber,
      historyPlayback.history,
      historyPlayback.historyLoadingMessage,
      historyPlayback.historyWarning,
      historyPlayback.isHistoricalView,
      historyPlayback.isHistoryOpen,
      historyPlayback.isResuming,
      historyPlayback.isSoloGame,
      historyPlayback.playerSeats,
      historyPlayback.requestJumpToMove,
      historyPlayback.returnToPresent,
      historyPlayback.setIsHistoryOpen,
      historyPlayback.setHistoryWarning,
      historyPlayback.setShowResumeDialog,
      historyPlayback.showResumeDialog,
      historyPlayback.totalMoves,
      historyPlayback.undoNotice,
      historyPlayback.undoRequest,
      historyPlayback.undoVoteSecondsRemaining,
      historyPlayback.undoVotes,
      historyPlayback.voteUndo,
    ]
  );

  const overlaysMahjong = useMemo(
    () => ({
      showMahjongDialog: mahjong.showMahjongDialog,
      mahjongDialogLoading: mahjong.mahjongDialogLoading,
      handleMahjongConfirm: mahjong.handleMahjongConfirm,
      handleMahjongCancel: mahjong.handleMahjongCancel,
      awaitingMahjongValidation: mahjong.awaitingMahjongValidation,
      awaitingValidationLoading: mahjong.awaitingValidationLoading,
      handleMahjongValidationSubmit: mahjong.handleMahjongValidationSubmit,
      mahjongDeclaredMessage: mahjong.mahjongDeclaredMessage,
      deadHandNotice: mahjong.deadHandNotice,
      showDeadHandOverlay: mahjong.showDeadHandOverlay,
      deadHandOverlayData: mahjong.deadHandOverlayData,
      setDeadHandOverlayVisible: mahjong.setDeadHandOverlayVisible,
    }),
    [
      mahjong.awaitingMahjongValidation,
      mahjong.awaitingValidationLoading,
      mahjong.deadHandNotice,
      mahjong.deadHandOverlayData,
      mahjong.handleMahjongCancel,
      mahjong.handleMahjongConfirm,
      mahjong.handleMahjongValidationSubmit,
      mahjong.mahjongDeclaredMessage,
      mahjong.mahjongDialogLoading,
      mahjong.setDeadHandOverlayVisible,
      mahjong.showDeadHandOverlay,
      mahjong.showMahjongDialog,
    ]
  );

  const overlaysMeldActions = useMemo(
    () => ({
      showJokerExchangeDialog: meldActions.showJokerExchangeDialog,
      jokerExchangeOpportunities: meldActions.jokerExchangeOpportunities,
      jokerExchangeLoading: meldActions.jokerExchangeLoading,
      handleJokerExchange: meldActions.handleJokerExchange,
      handleCloseJokerExchange: meldActions.handleCloseJokerExchange,
      upgradeDialogState: meldActions.upgradeDialogState,
      upgradeDialogLoading: meldActions.upgradeDialogLoading,
      handleUpgradeConfirm: meldActions.handleUpgradeConfirm,
      handleUpgradeCancel: meldActions.handleUpgradeCancel,
    }),
    [
      meldActions.handleCloseJokerExchange,
      meldActions.handleJokerExchange,
      meldActions.handleUpgradeCancel,
      meldActions.handleUpgradeConfirm,
      meldActions.jokerExchangeLoading,
      meldActions.jokerExchangeOpportunities,
      meldActions.showJokerExchangeDialog,
      meldActions.upgradeDialogLoading,
      meldActions.upgradeDialogState,
    ]
  );

  const overlaysPlaying = useMemo(
    () => ({
      resolutionOverlay: playing.resolutionOverlay,
      dismissResolutionOverlay: playing.dismissResolutionOverlay,
      discardAnimationTile: playing.discardAnimationTile,
      setDiscardAnimation: playing.setDiscardAnimation,
    }),
    [
      playing.discardAnimationTile,
      playing.dismissResolutionOverlay,
      playing.resolutionOverlay,
      playing.setDiscardAnimation,
    ]
  );

  return {
    isTileMovementEnabled,
    overlaysCallWindow,
    overlaysHintSystem,
    overlaysHistoryPlayback,
    overlaysMahjong,
    overlaysMeldActions,
    overlaysPlaying,
    presentationAnimations,
    presentationAutoDraw,
    presentationCallWindow,
    presentationHintSystem,
    presentationHistoryPlayback,
    presentationMahjong,
    presentationMeldActions,
    presentationPlaying,
  };
}
