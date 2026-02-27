import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';
import {
  AUTO_DRAW_INITIAL_DELAY_MS,
  AUTO_DRAW_MAX_RETRIES,
  AUTO_DRAW_RETRY_INTERVAL_MS,
} from '@/lib/constants';

export type DrawStatus = null | 'drawing' | { retrying: number } | 'failed';

export interface UseAutoDrawOptions {
  isMyTurn: boolean;
  isDrawingStage: boolean;
  mySeat: Seat;
  sendCommand: (command: GameCommand) => void;
}

export interface UseAutoDrawResult {
  drawStatus: DrawStatus;
  clearPendingDrawRetry: () => void;
  resetDrawRetry: () => void;
}

export function useAutoDraw({
  isMyTurn,
  isDrawingStage,
  mySeat,
  sendCommand,
}: UseAutoDrawOptions): UseAutoDrawResult {
  const [retryStatus, setRetryStatus] = useState<Exclude<DrawStatus, 'drawing'>>(null);
  const [isCleared, setIsCleared] = useState(false);
  const drawRetryRef = useRef<{ count: number; cleared: boolean }>({ count: 0, cleared: false });
  const sendCommandRef = useRef(sendCommand);
  const mySeatRef = useRef(mySeat);

  useEffect(() => {
    sendCommandRef.current = sendCommand;
    mySeatRef.current = mySeat;
  }, [mySeat, sendCommand]);

  const clearPendingDrawRetry = useCallback(() => {
    drawRetryRef.current.cleared = true;
    setIsCleared(true);
    setRetryStatus(null);
  }, []);

  const resetDrawRetry = useCallback(() => {
    drawRetryRef.current = { count: 0, cleared: false };
    setIsCleared(false);
    setRetryStatus(null);
  }, []);

  useEffect(() => {
    if (!isMyTurn || !isDrawingStage) return;

    drawRetryRef.current = { count: 0, cleared: false };

    let retryTimer: ReturnType<typeof setTimeout>;

    const sendDraw = () => {
      sendCommandRef.current({ DrawTile: { player: mySeatRef.current } });
    };

    const scheduleRetry = (attempt: number): ReturnType<typeof setTimeout> => {
      return setTimeout(() => {
        if (drawRetryRef.current.cleared) return;
        const retryNum = attempt + 1;
        setRetryStatus({ retrying: retryNum });
        sendDraw();
        if (retryNum >= AUTO_DRAW_MAX_RETRIES) {
          setRetryStatus('failed');
        } else {
          retryTimer = scheduleRetry(retryNum);
        }
      }, AUTO_DRAW_RETRY_INTERVAL_MS);
    };

    const initialTimer = setTimeout(() => {
      if (drawRetryRef.current.cleared) return;
      sendDraw();
      retryTimer = scheduleRetry(0);
    }, AUTO_DRAW_INITIAL_DELAY_MS);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(retryTimer);
    };
  }, [isDrawingStage, isMyTurn]);

  const isActivelyDrawing = isMyTurn && isDrawingStage && !isCleared;
  const drawStatus: DrawStatus = isActivelyDrawing ? (retryStatus ?? 'drawing') : retryStatus;

  return {
    drawStatus,
    clearPendingDrawRetry,
    resetDrawRetry,
  };
}
