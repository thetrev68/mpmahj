import { useCallback, useEffect, useState } from 'react';
import type { UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface UseGameBoardOverlaysOptions {
  socketClient: UseGameSocketReturn;
  ws?: {
    send: (data: string) => void;
  };
}

export interface UseGameBoardOverlaysReturn {
  diceRoll: number | null;
  showDiceOverlay: boolean;
  calledFrom: Seat | null;
  winnerCelebration: {
    winnerName: string;
    winnerSeat: Seat;
    patternName: string;
    handValue?: number;
  } | null;
  gameResult: GameResult | null;
  showScoringScreen: boolean;
  showGameOverPanel: boolean;
  heavenlyHand: { pattern: string; base_score: number } | null;
  showDrawOverlay: boolean;
  drawReason: string;
  wallTilesAtExhaustion: number;
  showDrawScoringScreen: boolean;
  hasLeftGame: boolean;
  showLeaveToast: boolean;
  dispatchUIAction: (action: UIStateAction) => void;
  handleDiceComplete: () => void;
  handleLeaveConfirmed: () => void;
  /** Dismisses the draw overlay and advances to draw scoring (handles race with GameOver). */
  handleDrawAcknowledge: () => void;
  /** Closes the draw scoring screen and opens the game-over panel. */
  handleDrawScoringContinue: () => void;
  /** Clears the winner celebration and opens scoring or game-over panel. */
  handleWinnerCelebrationContinue: () => void;
  /** Closes the scoring screen and opens the game-over panel. */
  handleScoringContinue: () => void;
  /** Closes the game-over panel. */
  handleGameOverClose: () => void;
}

export function useGameBoardOverlays({
  socketClient,
  ws,
}: UseGameBoardOverlaysOptions): UseGameBoardOverlaysReturn {
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);
  const [calledFrom, setCalledFrom] = useState<Seat | null>(null);
  const [winnerCelebration, setWinnerCelebration] = useState<{
    winnerName: string;
    winnerSeat: Seat;
    patternName: string;
    handValue?: number;
  } | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showScoringScreen, setShowScoringScreen] = useState(false);
  const [showGameOverPanel, setShowGameOverPanel] = useState(false);
  const [heavenlyHand, setHeavenlyHand] = useState<{
    pattern: string;
    base_score: number;
  } | null>(null);
  const [showDrawOverlay, setShowDrawOverlay] = useState(false);
  const [drawReason, setDrawReason] = useState<string>('Wall exhausted');
  const [wallTilesAtExhaustion, setWallTilesAtExhaustion] = useState<number>(0);
  const [, setDrawAcknowledged] = useState(false);
  const [showDrawScoringScreen, setShowDrawScoringScreen] = useState(false);
  const [hasLeftGame, setHasLeftGame] = useState(false);
  const [showLeaveToast, setShowLeaveToast] = useState(false);

  useEffect(() => {
    if (!showLeaveToast) return;
    const timer = setTimeout(() => setShowLeaveToast(false), 4000);
    return () => clearTimeout(timer);
  }, [showLeaveToast]);

  const showReconnectedToast = socketClient.showReconnectedToast;
  const dismissReconnectedToast = socketClient.dismissReconnectedToast;
  useEffect(() => {
    if (ws || !showReconnectedToast) return;
    const timer = setTimeout(() => dismissReconnectedToast(), 2500);
    return () => clearTimeout(timer);
  }, [dismissReconnectedToast, showReconnectedToast, ws]);

  const dispatchUIAction = useCallback((action: UIStateAction) => {
    switch (action.type) {
      case 'SET_DICE_ROLL':
        setDiceRoll(action.value);
        break;
      case 'SET_SHOW_DICE_OVERLAY':
        setShowDiceOverlay(action.value);
        break;
      case 'SET_SETUP_PHASE':
        break;
      case 'SET_CALLED_FROM':
        setCalledFrom(action.discardedBy);
        break;
      case 'SET_AWAITING_MAHJONG_VALIDATION':
        break;
      case 'SET_MAHJONG_VALIDATED':
        if (action.valid && action.pattern) {
          setWinnerCelebration({
            winnerName: action.player,
            winnerSeat: action.player,
            patternName: action.pattern,
          });
        }
        break;
      case 'SET_GAME_OVER':
        setGameResult(action.result);
        if (action.winner === null) {
          if (
            typeof action.result.end_condition === 'object' &&
            'Abandoned' in action.result.end_condition &&
            action.result.end_condition.Abandoned === 'Forfeit'
          ) {
            setDrawReason('Player forfeited');
          }
          setDrawAcknowledged((prev) => {
            if (prev) {
              setShowDrawScoringScreen(true);
            }
            return prev;
          });
          setShowDrawOverlay((overlayShowing) => {
            if (!overlayShowing) {
              setShowDrawScoringScreen(true);
            }
            return overlayShowing;
          });
        }
        break;
      case 'SET_HEAVENLY_HAND':
        setHeavenlyHand({ pattern: action.pattern, base_score: action.base_score });
        break;
      case 'SET_WALL_EXHAUSTED':
        setDrawReason('Wall exhausted');
        setWallTilesAtExhaustion(action.remaining_tiles);
        setShowDrawOverlay(true);
        break;
      case 'SET_GAME_ABANDONED':
        setDrawReason(
          action.reason === 'AllPlayersDead' ? 'All players dead hands' : action.reason
        );
        setShowDrawOverlay(true);
        break;
      default:
        break;
    }
  }, []);

  const handleDiceComplete = useCallback(() => {
    setShowDiceOverlay(false);
  }, []);

  const handleLeaveConfirmed = useCallback(() => {
    setHasLeftGame(true);
    setShowLeaveToast(true);
  }, []);

  // Dismisses the draw overlay. Uses a functional updater to read gameResult without a stale
  // closure, since this callback is created once and gameResult changes asynchronously.
  const handleDrawAcknowledge = useCallback(() => {
    setShowDrawOverlay(false);
    setDrawAcknowledged(true);
    setGameResult((result) => {
      if (result && result.winner === null) {
        setShowDrawScoringScreen(true);
      }
      return result;
    });
  }, []);

  const handleDrawScoringContinue = useCallback(() => {
    setShowDrawScoringScreen(false);
    setShowGameOverPanel(true);
  }, []);

  // Clears the winner celebration and advances to scoring or game-over. Uses a functional
  // updater to read gameResult without a stale closure.
  const handleWinnerCelebrationContinue = useCallback(() => {
    setWinnerCelebration(null);
    setGameResult((result) => {
      if (result) {
        setShowScoringScreen(true);
      } else {
        setShowGameOverPanel(true);
      }
      return result;
    });
  }, []);

  const handleScoringContinue = useCallback(() => {
    setShowScoringScreen(false);
    setShowGameOverPanel(true);
  }, []);

  const handleGameOverClose = useCallback(() => {
    setShowGameOverPanel(false);
  }, []);

  return {
    diceRoll,
    showDiceOverlay,
    calledFrom,
    winnerCelebration,
    gameResult,
    showScoringScreen,
    showGameOverPanel,
    heavenlyHand,
    showDrawOverlay,
    drawReason,
    wallTilesAtExhaustion,
    showDrawScoringScreen,
    hasLeftGame,
    showLeaveToast,
    dispatchUIAction,
    handleDiceComplete,
    handleLeaveConfirmed,
    handleDrawAcknowledge,
    handleDrawScoringContinue,
    handleWinnerCelebrationContinue,
    handleScoringContinue,
    handleGameOverClose,
  };
}
