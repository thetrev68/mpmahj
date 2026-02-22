import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';

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

    const MAX_RETRIES = 3;
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
        if (retryNum >= MAX_RETRIES) {
          setRetryStatus('failed');
        } else {
          retryTimer = scheduleRetry(retryNum);
        }
      }, 5000);
    };

    const initialTimer = setTimeout(() => {
      if (drawRetryRef.current.cleared) return;
      sendDraw();
      retryTimer = scheduleRetry(0);
    }, 500);

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
