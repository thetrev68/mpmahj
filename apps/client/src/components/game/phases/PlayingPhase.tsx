/**
 * @module PlayingPhase
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useMeldActions } from '@/hooks/useMeldActions';
import { useTileSelection } from '@/hooks/useTileSelection';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useGameUIStore } from '@/stores/gameUIStore';
import { buildTileInstances } from '@/lib/utils/tileSelection';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { PlayingPhaseOverlays } from './playing-phase/PlayingPhaseOverlays';
import { PlayingPhasePresentation } from './playing-phase/PlayingPhasePresentation';
import { usePlayingPhaseActions } from './playing-phase/usePlayingPhaseActions';
import { usePlayingPhaseEventHandlers } from './playing-phase/usePlayingPhaseEventHandlers';
import { useCallWindowFromStore, usePlayingStateFromStore } from './playing-phase/usePlayingUIAdapters';

interface PlayingPhaseProps {
  gameState: GameStateSnapshot;
  turnStage: TurnStage;
  currentTurn: Seat;
  sendCommand: (cmd: GameCommand) => void;
  onLeaveConfirmed?: () => void;
  eventBus?: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
  };
}

export function PlayingPhase({
  gameState,
  turnStage,
  currentTurn,
  sendCommand,
  onLeaveConfirmed,
  eventBus,
}: PlayingPhaseProps) {
  // Store-backed adapters replace the local useCallWindowState / usePlayingPhaseState hooks.
  // All UIStateAction dispatch flows through useGameUIStore as the single UI authority
  // (Phase 4, slice 4.3).
  const callWindow = useCallWindowFromStore();
  const playing = usePlayingStateFromStore();
  const animations = useGameAnimations();

  const dispatch = useGameUIStore((s) => s.dispatch);
  const errorMessage = useGameUIStore((s) => s.errorMessage);
  const storeForfeitedPlayers = useGameUIStore((s) => s.forfeitedPlayers);
  const forfeitedPlayers = useMemo(
    () => new Set(storeForfeitedPlayers.map((f) => f.player)),
    [storeForfeitedPlayers],
  );
  const setErrorMessage = useCallback(
    (message: string | null) => dispatch({ type: 'SET_ERROR_MESSAGE', message }),
    [dispatch],
  );
  const {
    settings: animationSettings,
    updateSettings: updateAnimationSettings,
    getDuration,
    isEnabled,
    prefersReducedMotion,
  } = useAnimationSettings();
  const tileMovementEnabledRef = useRef(isEnabled('tile_movement'));
  const incomingAnimationDurationRef = useRef(getDuration(1500));

  useEffect(() => {
    tileMovementEnabledRef.current = isEnabled('tile_movement');
    incomingAnimationDurationRef.current = getDuration(1500);
  }, [getDuration, isEnabled]);

  const isMyTurn = currentTurn === gameState.your_seat;
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;
  const isDrawingStage = typeof turnStage === 'object' && 'Drawing' in turnStage;

  const meldActions = useMeldActions({
    gameState,
    isDiscardingStage,
    sendCommand,
  });
  const historyPlayback = useHistoryPlayback({
    gameState,
    sendCommand,
    eventBus,
    playingIsProcessing: playing.isProcessing,
  });
  const hintSystem = useHintSystem({
    gameState,
    isDiscardingStage,
    isHistoricalView: historyPlayback.isHistoricalView,
    forfeitedPlayers,
    sendCommand,
  });
  const mahjong = useMahjongDeclaration({
    gameState,
    sendCommand,
    setPlayingProcessing: playing.setProcessing,
    closeCallWindow: callWindow.closeCallWindow,
  });
  const autoDraw = useAutoDraw({
    isMyTurn,
    isDrawingStage,
    mySeat: gameState.your_seat,
    sendCommand,
  });

  const canDeclareMahjong =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !mahjong.deadHandPlayers.has(gameState.your_seat) &&
    !forfeitedPlayers.has(gameState.your_seat);
  const combinedHighlightedIds = useMemo(
    () =>
      isEnabled('tile_movement')
        ? Array.from(new Set([...animations.highlightedTileIds, ...hintSystem.hintHighlightedIds]))
        : [],
    [animations.highlightedTileIds, hintSystem.hintHighlightedIds, isEnabled]
  );
  const handTileInstances = useMemo(
    () => buildTileInstances(gameState.your_hand),
    [gameState.your_hand]
  );
  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 1,
    disabledIds: [],
  });

  usePlayingPhaseEventHandlers({
    animations,
    autoDraw,
    clearSelection,
    eventBus,
    historyPlayback,
    hintSystem,
    playing,
    turnKey: currentTurn,
  });

  // ── Store → local-hook bridge effects (Phase 4, slice 4.3) ──────────────
  //
  // After removing the ui-action event bus, these explicit effects forward
  // specific store state changes to the local hook instances that still maintain
  // own component-level state (dialog loading flags, hint state, etc.).

  // Signal: CLEAR_SELECTION
  const clearSelectionSignal = useGameUIStore((s) => s.clearSelectionSignal);
  useEffect(() => {
    if (clearSelectionSignal > 0) clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSelectionSignal]);

  // Signal: CLEAR_PENDING_DRAW_RETRY
  const clearPendingDrawRetrySignal = useGameUIStore((s) => s.clearPendingDrawRetrySignal);
  useEffect(() => {
    if (clearPendingDrawRetrySignal > 0) autoDraw.clearPendingDrawRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearPendingDrawRetrySignal]);

  // Animation: incoming-from-seat
  const storeIncomingFromSeat = useGameUIStore((s) => s.incomingFromSeat);
  useEffect(() => {
    if (tileMovementEnabledRef.current) {
      animations.setIncomingFromSeat(storeIncomingFromSeat, incomingAnimationDurationRef.current);
    } else {
      animations.setIncomingFromSeat(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeIncomingFromSeat]);

  // Animation: highlighted tile IDs
  const storeHighlightedTileIds = useGameUIStore((s) => s.highlightedTileIds);
  useEffect(() => {
    animations.setHighlightedTileIds(
      tileMovementEnabledRef.current ? storeHighlightedTileIds : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeHighlightedTileIds]);

  // Animation: leaving tile IDs
  const storeLeavingTileIds = useGameUIStore((s) => s.leavingTileIds);
  useEffect(() => {
    animations.setLeavingTileIds(tileMovementEnabledRef.current ? storeLeavingTileIds : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLeavingTileIds]);

  // Error message: forward to meldActions (clears loading states) and historyPlayback.
  useEffect(() => {
    if (errorMessage !== null) {
      meldActions.handleUiAction({ type: 'SET_ERROR_MESSAGE', message: errorMessage });
    }
    historyPlayback.clearPendingUndoOnError(errorMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorMessage]);

  // Mahjong declaration bridge.
  const storeMahjongDeclaredPlayer = useGameUIStore((s) => s.mahjongDeclaredPlayer);
  useEffect(() => {
    if (storeMahjongDeclaredPlayer) {
      mahjong.handleUiAction({ type: 'SET_MAHJONG_DECLARED', player: storeMahjongDeclaredPlayer });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeMahjongDeclaredPlayer]);

  // Awaiting mahjong validation bridge.
  const storeAwaitingMahjongValidation = useGameUIStore((s) => s.awaitingMahjongValidation);
  useEffect(() => {
    if (storeAwaitingMahjongValidation) {
      mahjong.handleUiAction({
        type: 'SET_AWAITING_MAHJONG_VALIDATION',
        caller: storeAwaitingMahjongValidation.caller,
        calledTile: storeAwaitingMahjongValidation.calledTile,
        discardedBy: storeAwaitingMahjongValidation.discardedBy,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeAwaitingMahjongValidation]);

  // Mahjong validated bridge.
  const storeMahjongValidatedResult = useGameUIStore((s) => s.mahjongValidatedResult);
  useEffect(() => {
    if (storeMahjongValidatedResult) {
      mahjong.handleUiAction({
        type: 'SET_MAHJONG_VALIDATED',
        player: storeMahjongValidatedResult.player,
        valid: storeMahjongValidatedResult.valid,
        pattern: storeMahjongValidatedResult.pattern,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeMahjongValidatedResult]);

  // Dead-hand players bridge — process new entries only.
  const storeDeadHandPlayers = useGameUIStore((s) => s.deadHandPlayers);
  const processedDeadHandCountRef = useRef(0);
  useEffect(() => {
    const newEntries = storeDeadHandPlayers.slice(processedDeadHandCountRef.current);
    processedDeadHandCountRef.current = storeDeadHandPlayers.length;
    for (const entry of newEntries) {
      mahjong.handleUiAction({ type: 'SET_HAND_DECLARED_DEAD', player: entry.player, reason: entry.reason });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeDeadHandPlayers]);

  // Skipped players bridge — process new entries only.
  const storeSkippedPlayers = useGameUIStore((s) => s.skippedPlayers);
  const processedSkippedCountRef = useRef(0);
  useEffect(() => {
    const newEntries = storeSkippedPlayers.slice(processedSkippedCountRef.current);
    processedSkippedCountRef.current = storeSkippedPlayers.length;
    for (const entry of newEntries) {
      mahjong.handleUiAction({ type: 'SET_PLAYER_SKIPPED', player: entry.player, reason: entry.reason });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSkippedPlayers]);

  // Forfeited players bridge — process new entries only.
  // The forfeitedPlayers Set is derived separately (see above).
  const processedForfeitedCountRef = useRef(0);
  useEffect(() => {
    const newEntries = storeForfeitedPlayers.slice(processedForfeitedCountRef.current);
    processedForfeitedCountRef.current = storeForfeitedPlayers.length;
    for (const entry of newEntries) {
      mahjong.handleUiAction({ type: 'SET_PLAYER_FORFEITED', player: entry.player, reason: entry.reason ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeForfeitedPlayers]);

  // Joker exchanged bridge.
  const storeJokerExchanged = useGameUIStore((s) => s.jokerExchanged);
  useEffect(() => {
    if (storeJokerExchanged) {
      meldActions.handleUiAction({
        type: 'SET_JOKER_EXCHANGED',
        player: storeJokerExchanged.player,
        target_seat: storeJokerExchanged.target_seat,
        joker: storeJokerExchanged.joker,
        replacement: storeJokerExchanged.replacement,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeJokerExchanged]);

  // Meld upgraded bridge.
  const storeMeldUpgraded = useGameUIStore((s) => s.meldUpgraded);
  useEffect(() => {
    if (storeMeldUpgraded) {
      meldActions.handleUiAction({
        type: 'SET_MELD_UPGRADED',
        player: storeMeldUpgraded.player,
        meld_index: storeMeldUpgraded.meld_index,
        new_meld_type: storeMeldUpgraded.new_meld_type,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeMeldUpgraded]);
  // ── End of store bridge effects ──────────────────────────────────────────

  const { callEligibility, handleCallIntent, handlePass } = usePlayingPhaseActions({
    callWindow,
    gameState,
    forfeitedPlayers,
    historyPlayback,
    sendCommand,
    setErrorMessage,
  });

  useEffect(() => {
    if (playing.discardAnimationTile !== null && !isEnabled('tile_movement')) {
      playing.setDiscardAnimation(null);
    }
  }, [isEnabled, playing, playing.discardAnimationTile]);

  // AC-4: clear outgoing selection and staged incoming when stage leaves Discarding
  // (covers same-turn transitions e.g. Discarding → CallWindow without a seat change)
  useEffect(() => {
    if (!isDiscardingStage) {
      clearSelection();
      playing.setStagedIncomingTile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiscardingStage]);

  useEffect(() => {
    if (!playing.stagedIncomingTile) return;
    const id = setTimeout(
      () => playing.setStagedIncomingTile(null),
      incomingAnimationDurationRef.current
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing.stagedIncomingTile]);

  return (
    <>
      <PlayingPhasePresentation
        animations={animations}
        autoDraw={autoDraw}
        callWindow={callWindow}
        canDeclareMahjong={canDeclareMahjong}
        clearSelection={clearSelection}
        combinedHighlightedIds={combinedHighlightedIds}
        currentTurn={currentTurn}
        forfeitedPlayers={forfeitedPlayers}
        gameState={gameState}
        handTileInstances={handTileInstances}
        historyPlayback={historyPlayback}
        hintSystem={hintSystem}
        isDiscardingStage={isDiscardingStage}
        isDrawingStage={isDrawingStage}
        isMyTurn={isMyTurn}
        mahjong={mahjong}
        meldActions={meldActions}
        onLeaveConfirmed={onLeaveConfirmed}
        playing={playing}
        selectedIds={selectedIds}
        sendCommand={sendCommand}
        toggleTile={toggleTile}
        turnStage={turnStage}
      />
      <PlayingPhaseOverlays
        animationSettings={animationSettings}
        callEligibility={callEligibility}
        callWindow={callWindow}
        canDeclareMahjong={canDeclareMahjong}
        errorMessage={errorMessage}
        forfeitedPlayers={forfeitedPlayers}
        gameState={gameState}
        getDuration={getDuration}
        handleCallIntent={handleCallIntent}
        handlePass={handlePass}
        hintSystem={hintSystem}
        historyPlayback={historyPlayback}
        isTileMovementEnabled={isEnabled('tile_movement')}
        mahjong={mahjong}
        meldActions={meldActions}
        playing={playing}
        prefersReducedMotion={prefersReducedMotion}
        updateAnimationSettings={updateAnimationSettings}
      />
    </>
  );
}
