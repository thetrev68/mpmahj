/**
 * @module PlayingPhase
 */

import { useCallback, useMemo } from 'react';
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
  onLeaveConfirmed?: () => void;
  eventBus?: {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
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
  const callWindow = useCallWindowFromStore();
  const playing = usePlayingStateFromStore();
  const animations = useGameAnimations();

  const dispatch = useGameUIStore((s) => s.dispatch);
  const errorMessage = useGameUIStore((s) => s.errorMessage);
  const storeForfeitedPlayers = useGameUIStore((s) => s.forfeitedPlayers);

  const forfeitedPlayers = useMemo(
    () => new Set(storeForfeitedPlayers.map((f) => f.player)),
    [storeForfeitedPlayers]
  );

  const setErrorMessage = useCallback(
    (message: string | null) => dispatch({ type: 'SET_ERROR_MESSAGE', message }),
    [dispatch]
  );

  const {
    settings: animationSettings,
    updateSettings: updateAnimationSettings,
    getDuration,
    isEnabled,
    prefersReducedMotion,
  } = useAnimationSettings();

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

  const isTileMovementEnabled = isEnabled('tile_movement');
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
    storeForfeitedPlayers,
  });

  const { callEligibility, handleCallIntent, handlePass } = usePlayingPhaseActions({
    callWindow,
    gameState,
    forfeitedPlayers,
    historyPlayback,
    sendCommand,
    setErrorMessage,
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
        canDeclareMahjong={canDeclareMahjong}
        clearSelection={clearSelection}
        combinedHighlightedIds={combinedHighlightedIds}
        currentTurn={currentTurn}
        forfeitedPlayers={forfeitedPlayers}
        gameState={gameState}
        handTileInstances={handTileInstances}
        historyPlayback={view.presentationHistoryPlayback}
        hintSystem={view.presentationHintSystem}
        isDiscardingStage={isDiscardingStage}
        isDrawingStage={isDrawingStage}
        isMyTurn={isMyTurn}
        mahjong={view.presentationMahjong}
        meldActions={view.presentationMeldActions}
        onLeaveConfirmed={onLeaveConfirmed}
        playing={view.presentationPlaying}
        selectedIds={selectedIds}
        sendCommand={sendCommand}
        toggleTile={toggleTile}
        turnStage={turnStage}
      />
      <PlayingPhaseOverlays
        animationSettings={animationSettings}
        callEligibility={callEligibility}
        callWindow={view.overlaysCallWindow}
        canDeclareMahjong={canDeclareMahjong}
        errorMessage={errorMessage}
        forfeitedPlayers={forfeitedPlayers}
        gameState={gameState}
        getDuration={getDuration}
        handleCallIntent={handleCallIntent}
        handlePass={handlePass}
        hintSystem={view.overlaysHintSystem}
        historyPlayback={view.overlaysHistoryPlayback}
        isTileMovementEnabled={view.isTileMovementEnabled}
        mahjong={view.overlaysMahjong}
        meldActions={view.overlaysMeldActions}
        playing={view.overlaysPlaying}
        prefersReducedMotion={prefersReducedMotion}
        updateAnimationSettings={updateAnimationSettings}
      />
    </>
  );
}
