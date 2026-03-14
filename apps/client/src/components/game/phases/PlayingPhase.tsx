/**
 * @module PlayingPhase
 */

import { useCallback, useEffect, useMemo } from 'react';
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
import type { ServerEventNotification } from '@/lib/game-events/types';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Tile } from '@/types/bindings/generated/Tile';
import { PlayingPhaseOverlays } from './playing-phase/PlayingPhaseOverlays';
import { PlayingPhasePresentation } from './playing-phase/PlayingPhasePresentation';
import { usePlayingPhaseActions } from './playing-phase/usePlayingPhaseActions';
import { usePlayingPhaseEventHandlers } from './playing-phase/usePlayingPhaseEventHandlers';
import { usePlayingPhaseStoreBridge } from './playing-phase/usePlayingPhaseStoreBridge';
import { usePlayingPhaseViewState } from './playing-phase/usePlayingPhaseViewState';
import {
  useCallWindowFromStore,
  usePlayingStateFromStore,
} from './playing-phase/usePlayingUIAdapters';

interface PlayingPhaseProps {
  gameState: GameStateSnapshot;
  turnStage: TurnStage;
  currentTurn: Seat;
  sendCommand: (cmd: GameCommand) => void;
  eventBus?: {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
  };
}

export function PlayingPhase({
  gameState,
  turnStage,
  currentTurn,
  sendCommand,
  eventBus,
}: PlayingPhaseProps) {
  const callWindow = useCallWindowFromStore();
  const playing = usePlayingStateFromStore();
  const animations = useGameAnimations();

  const dispatch = useGameUIStore((s) => s.dispatch);
  const errorMessage = useGameUIStore((s) => s.errorMessage);

  const setErrorMessage = useCallback(
    (message: string | null) => dispatch({ type: 'SET_ERROR_MESSAGE', message }),
    [dispatch]
  );

  const { getDuration, isEnabled, prefersReducedMotion } = useAnimationSettings();

  const isMyTurn = currentTurn === gameState.your_seat;
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;
  const isDrawingStage = typeof turnStage === 'object' && 'Drawing' in turnStage;

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
    sendCommand,
  });

  const mahjong = useMahjongDeclaration({
    gameState,
    sendCommand,
    setPlayingProcessing: playing.setProcessing,
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
    !mahjong.deadHandPlayers.has(gameState.your_seat);

  const combinedHighlightedIds = useMemo(
    () =>
      isEnabled()
        ? Array.from(new Set([...animations.highlightedTileIds, ...hintSystem.hintHighlightedIds]))
        : [],
    [animations.highlightedTileIds, hintSystem.hintHighlightedIds, isEnabled]
  );

  const handTileInstances = useMemo(
    () => buildTileInstances(gameState.your_hand),
    [gameState.your_hand]
  );

  const isCallWindowActive = callWindow.callWindow !== null;

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: isCallWindowActive ? 5 : 1,
    disabledIds: [],
  });

  const stagedOutgoingTiles = useMemo(
    () =>
      isDiscardingStage || isCallWindowActive
        ? selectedIds
            .map((id) => handTileInstances.find((instance) => instance.id === id)?.tile)
            .filter((tile): tile is Tile => tile !== undefined)
        : [],
    [handTileInstances, isCallWindowActive, isDiscardingStage, selectedIds]
  );

  const concealedAfterExcludingStaged = useMemo(() => {
    const concealed = [...gameState.your_hand];
    const stagedTiles = [
      ...(playing.stagedIncomingTile ? [playing.stagedIncomingTile.tile] : []),
      ...stagedOutgoingTiles,
    ];

    for (const stagedTile of stagedTiles) {
      const index = concealed.indexOf(stagedTile);
      if (index !== -1) {
        concealed.splice(index, 1);
      }
    }

    return concealed;
  }, [gameState.your_hand, playing.stagedIncomingTile, stagedOutgoingTiles]);

  const meldActions = useMeldActions({
    gameState,
    isDiscardingStage,
    isMyTurn,
    readOnly: historyPlayback.isHistoricalView,
    isBusy: playing.isProcessing,
    sendCommand,
  });

  useEffect(() => {
    clearSelection();
  }, [clearSelection, isCallWindowActive, turnStage]);

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

  const isTileMovementEnabled = isEnabled();
  const incomingAnimationDurationMs = getDuration(1500);

  usePlayingPhaseStoreBridge({
    animations,
    autoDraw,
    clearSelection,
    historyPlayback,
    incomingAnimationDurationMs,
    isDiscardingStage,
    isTileMovementEnabled,
    mahjong,
    meldActions,
    playing,
  });

  const { claimCandidate, handleDeclareMahjongCall, handleProceedCallWindow } =
    usePlayingPhaseActions({
      callWindow,
      gameState,
      historyPlayback,
      selectedClaimTiles: selectedIds
        .map((id) => handTileInstances.find((instance) => instance.id === id)?.tile)
        .filter((tile): tile is Tile => tile !== undefined),
      sendCommand,
      setErrorMessage,
      clearSelection,
    });

  const view = usePlayingPhaseViewState({
    animations,
    autoDraw,
    callWindow,
    historyPlayback,
    hintSystem,
    isTileMovementEnabled,
    mahjong,
    meldActions,
    playing,
  });

  return (
    <>
      <PlayingPhasePresentation
        animations={view.presentationAnimations}
        autoDraw={view.presentationAutoDraw}
        callWindow={view.presentationCallWindow}
        claimCandidate={claimCandidate}
        canDeclareMahjong={canDeclareMahjong}
        canProceedCallWindow={isCallWindowActive}
        clearSelection={clearSelection}
        combinedHighlightedIds={combinedHighlightedIds}
        currentTurn={currentTurn}
        gameState={gameState}
        handTileInstances={handTileInstances}
        historyPlayback={view.presentationHistoryPlayback}
        hintSystem={view.presentationHintSystem}
        isDiscardingStage={isDiscardingStage}
        isDrawingStage={isDrawingStage}
        isMyTurn={isMyTurn}
        handleDeclareMahjongCall={handleDeclareMahjongCall}
        handleProceedCallWindow={handleProceedCallWindow}
        mahjong={view.presentationMahjong}
        meldActions={view.presentationMeldActions}
        playing={view.presentationPlaying}
        selectedIds={selectedIds}
        sendCommand={sendCommand}
        toggleTile={toggleTile}
        turnStage={turnStage}
      />
      <PlayingPhaseOverlays
        canDeclareMahjong={canDeclareMahjong}
        errorMessage={errorMessage}
        gameState={gameState}
        getDuration={getDuration}
        hintSystem={view.overlaysHintSystem}
        historyPlayback={view.overlaysHistoryPlayback}
        isTileMovementEnabled={view.isTileMovementEnabled}
        mahjong={view.overlaysMahjong}
        meldActions={view.overlaysMeldActions}
        stagedTiles={{
          incoming: playing.stagedIncomingTile ? [playing.stagedIncomingTile.tile] : [],
          outgoing: stagedOutgoingTiles,
          concealedAfterExcludingStaged,
        }}
        playing={view.overlaysPlaying}
        prefersReducedMotion={prefersReducedMotion}
      />
    </>
  );
}
