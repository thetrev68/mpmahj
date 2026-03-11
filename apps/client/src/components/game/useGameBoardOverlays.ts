import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameUIStore } from '@/stores/gameUIStore';
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
  dispatchUIAction: (action: UIStateAction) => void;
  handleDiceComplete: () => void;
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
  const dispatchUIAction = useGameUIStore((s) => s.dispatch);
  const diceRoll = useGameUIStore((s) => s.diceRoll);
  const showDiceOverlay = useGameUIStore((s) => s.showDiceOverlay);
  const calledFrom = useGameUIStore((s) => s.calledFrom);
  const storeGameOver = useGameUIStore((s) => s.gameOver);
  const heavenlyHand = useGameUIStore((s) => s.heavenlyHand);
  const storeMahjongValidatedResult = useGameUIStore((s) => s.mahjongValidatedResult);
  const wallExhausted = useGameUIStore((s) => s.wallExhausted);
  const gameAbandoned = useGameUIStore((s) => s.gameAbandoned);

  const [showScoringScreen, setShowScoringScreen] = useState(false);
  const [showGameOverPanel, setShowGameOverPanel] = useState(false);
  const [acknowledgedDrawKey, setAcknowledgedDrawKey] = useState<string | null>(null);
  const [dismissedDrawScoringKey, setDismissedDrawScoringKey] = useState<string | null>(null);
  const [dismissedWinnerEventKey, setDismissedWinnerEventKey] = useState<string | null>(null);

  const gameResult = storeGameOver?.result ?? null;
  const drawSourceKey =
    wallExhausted !== null
      ? `wall:${wallExhausted.remaining_tiles}`
      : gameAbandoned !== null
        ? `abandoned:${gameAbandoned.reason}`
        : 'none';
  const showDrawScoringScreen =
    drawSourceKey !== 'none' &&
    acknowledgedDrawKey === drawSourceKey &&
    dismissedDrawScoringKey !== drawSourceKey &&
    gameResult?.winner === null;
  const showDrawOverlay =
    drawSourceKey !== 'none' && acknowledgedDrawKey !== drawSourceKey && !showGameOverPanel;
  const drawReason = useMemo(() => {
    if (gameAbandoned) {
      return gameAbandoned.reason === 'AllPlayersDead'
        ? 'All players dead hands'
        : gameAbandoned.reason;
    }
    return 'Wall exhausted';
  }, [gameAbandoned]);
  const wallTilesAtExhaustion = wallExhausted?.remaining_tiles ?? 0;

  const winnerEventKey =
    storeMahjongValidatedResult === null
      ? null
      : [
          storeMahjongValidatedResult.player,
          storeMahjongValidatedResult.valid ? '1' : '0',
          storeMahjongValidatedResult.pattern ?? '',
        ].join(':');

  const winnerCelebration = useMemo(() => {
    if (
      winnerEventKey === null ||
      dismissedWinnerEventKey === winnerEventKey ||
      storeMahjongValidatedResult === null ||
      !storeMahjongValidatedResult.valid ||
      storeMahjongValidatedResult.pattern === null
    ) {
      return null;
    }

    return {
      winnerName: storeMahjongValidatedResult.player,
      winnerSeat: storeMahjongValidatedResult.player,
      patternName: storeMahjongValidatedResult.pattern,
    };
  }, [dismissedWinnerEventKey, storeMahjongValidatedResult, winnerEventKey]);

  const showReconnectedToast = socketClient.showReconnectedToast;
  const dismissReconnectedToast = socketClient.dismissReconnectedToast;
  useEffect(() => {
    if (ws || !showReconnectedToast) return;
    const timer = setTimeout(() => dismissReconnectedToast(), 2500);
    return () => clearTimeout(timer);
  }, [dismissReconnectedToast, showReconnectedToast, ws]);

  const handleDiceComplete = useCallback(() => {
    dispatchUIAction({ type: 'SET_SHOW_DICE_OVERLAY', value: false });
  }, [dispatchUIAction]);

  const handleDrawAcknowledge = useCallback(() => {
    if (drawSourceKey === 'none') return;
    setAcknowledgedDrawKey(drawSourceKey);
  }, [drawSourceKey]);

  const handleDrawScoringContinue = useCallback(() => {
    if (drawSourceKey !== 'none') {
      setDismissedDrawScoringKey(drawSourceKey);
    }
    setShowGameOverPanel(true);
  }, [drawSourceKey]);

  const handleWinnerCelebrationContinue = useCallback(() => {
    if (winnerEventKey !== null) {
      setDismissedWinnerEventKey(winnerEventKey);
    }
    if (gameResult) {
      setShowScoringScreen(true);
    } else {
      setShowGameOverPanel(true);
    }
  }, [gameResult, winnerEventKey]);

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
    dispatchUIAction,
    handleDiceComplete,
    handleDrawAcknowledge,
    handleDrawScoringContinue,
    handleWinnerCelebrationContinue,
    handleScoringContinue,
    handleGameOverClose,
  };
}
