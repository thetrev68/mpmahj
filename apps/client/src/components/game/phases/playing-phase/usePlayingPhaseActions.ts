import { useCallback, useEffect, useMemo } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { calculateStagedCallIntent } from '@/lib/game-logic/callIntentCalculator';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Tile } from '@/types/bindings/generated/Tile';

interface CallWindowSlice {
  callWindow: {
    tile: Tile;
    timerStart: number;
    timerDuration: number;
    hasResponded: boolean;
  } | null;
  setTimerRemaining: (seconds: number | null) => void;
  closeCallWindow: () => void;
  markResponded: (message?: string) => void;
}

export interface UsePlayingPhaseActionsOptions {
  callWindow: CallWindowSlice;
  gameState: GameStateSnapshot;
  historyPlayback: { pushUndoAction: (description: string) => void };
  selectedClaimTiles: Tile[];
  sendCommand: (cmd: GameCommand) => void;
  setErrorMessage: (message: string) => void;
  clearSelection: () => void;
}

export interface UsePlayingPhaseActionsResult {
  claimCandidate: {
    state: 'empty' | 'valid' | 'invalid';
    label: string;
    detail: string;
  } | null;
  handleDeclareMahjongCall: () => void;
  handleProceedCallWindow: () => void;
}

export function usePlayingPhaseActions({
  callWindow,
  gameState,
  historyPlayback,
  selectedClaimTiles,
  sendCommand,
  setErrorMessage,
  clearSelection,
}: UsePlayingPhaseActionsOptions): UsePlayingPhaseActionsResult {
  const callWindowDeadlineMs = useMemo(() => {
    if (!callWindow.callWindow) return null;
    return callWindow.callWindow.timerStart + callWindow.callWindow.timerDuration * 1000;
  }, [callWindow.callWindow]);

  // EC-2: Clear selection when the local timer expires. The server remains
  // authoritative — it will send CallWindowClosed when it resolves the window —
  // but we clear staged tiles eagerly so the player isn't left with stale state.
  const handleCallWindowExpire = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const callWindowSecondsRemaining = useCountdown({
    deadlineMs: callWindowDeadlineMs,
    intervalMs: 500,
    onExpire: handleCallWindowExpire,
  });

  // Use the stable setTimerRemaining callback rather than the whole callWindow
  // object (which is a new reference on every render) to avoid an infinite
  // dispatch loop: new callWindow → effect fires → SET_CALL_WINDOW_TIMER → new
  // storeCallWindow ref → new callWindow → effect fires …
  const { setTimerRemaining } = callWindow;
  useEffect(() => {
    setTimerRemaining(callWindowSecondsRemaining);
  }, [setTimerRemaining, callWindowSecondsRemaining]);

  const claimCandidate = useMemo(() => {
    if (!callWindow.callWindow) {
      return null;
    }

    if (selectedClaimTiles.length === 0) {
      return {
        state: 'empty' as const,
        label: 'Skip claim',
        detail: 'Press Proceed to pass, or stage matching tiles to claim.',
      };
    }

    const result = calculateStagedCallIntent(callWindow.callWindow.tile, selectedClaimTiles);

    if (!result.success || !result.intent) {
      return {
        state: 'invalid' as const,
        label: 'Invalid claim',
        detail: result.error ?? 'This staged claim cannot be called.',
      };
    }

    return {
      state: 'valid' as const,
      label: `${result.intent} ready`,
      detail: `Press Proceed to call ${result.intent.toLowerCase()}.`,
    };
  }, [callWindow.callWindow, selectedClaimTiles]);

  const handleDeclareMahjongCall = useCallback(() => {
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    sendCommand({
      DeclareCallIntent: {
        player: gameState.your_seat,
        intent: 'Mahjong',
      },
    });
    historyPlayback.pushUndoAction('Declared Mahjong call intent');
    clearSelection();
    callWindow.markResponded('Declared Mahjong');
  }, [callWindow, clearSelection, gameState.your_seat, historyPlayback, sendCommand]);

  const handleProceedCallWindow = useCallback(() => {
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    if (selectedClaimTiles.length === 0) {
      const message = `Passed on ${getTileName(callWindow.callWindow.tile)}`;
      sendCommand({ Pass: { player: gameState.your_seat } });
      historyPlayback.pushUndoAction(message);
      setErrorMessage(message);
      clearSelection();
      callWindow.closeCallWindow();
      return;
    }

    const result = calculateStagedCallIntent(callWindow.callWindow.tile, selectedClaimTiles);
    if (!result.success || !result.intent || !result.meldTiles) {
      setErrorMessage(result.error ?? 'This staged claim cannot be called.');
      return;
    }

    sendCommand({
      DeclareCallIntent: {
        player: gameState.your_seat,
        intent: {
          Meld: {
            meld_type: result.intent,
            tiles: result.meldTiles,
            called_tile: callWindow.callWindow.tile,
            joker_assignments: {},
          },
        },
      },
    });
    historyPlayback.pushUndoAction(`Called for ${result.intent}`);
    clearSelection();
    callWindow.markResponded(`Declared intent to call for ${result.intent}`);
  }, [
    callWindow,
    clearSelection,
    gameState.your_seat,
    historyPlayback,
    selectedClaimTiles,
    sendCommand,
    setErrorMessage,
  ]);

  return {
    claimCandidate,
    handleDeclareMahjongCall,
    handleProceedCallWindow,
  };
}
