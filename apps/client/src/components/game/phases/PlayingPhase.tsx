/**
 * @module PlayingPhase
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useMeldActions } from '@/hooks/useMeldActions';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import { useTileSelection } from '@/hooks/useTileSelection';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { buildTileInstances } from '@/lib/utils/tileSelection';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { PlayingPhaseOverlays } from './playing-phase/PlayingPhaseOverlays';
import { PlayingPhasePresentation } from './playing-phase/PlayingPhasePresentation';
import { usePlayingPhaseActions } from './playing-phase/usePlayingPhaseActions';
import { usePlayingPhaseEventHandlers } from './playing-phase/usePlayingPhaseEventHandlers';

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
  const callWindow = useCallWindowState();
  const playing = usePlayingPhaseState();
  const animations = useGameAnimations();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forfeitedPlayers, setForfeitedPlayers] = useState<Set<Seat>>(new Set());
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
    callWindow,
    clearSelection,
    eventBus,
    gameSeat: gameState.your_seat,
    historyPlayback,
    hintSystem,
    incomingAnimationDurationRef,
    mahjong,
    meldActions,
    playing,
    setErrorMessage,
    setForfeitedPlayers,
    tileMovementEnabledRef,
    turnKey: currentTurn,
  });

  const { callEligibility, handleCallIntent, handlePass } = usePlayingPhaseActions({
    callWindow,
    gameState,
    forfeitedPlayers,
    historyPlayback,
    sendCommand,
    setErrorMessage: (message) => setErrorMessage(message),
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
