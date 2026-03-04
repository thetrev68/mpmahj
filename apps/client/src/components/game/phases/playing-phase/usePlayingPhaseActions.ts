import { useCallback, useEffect, useMemo } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { useGameUIStore } from '@/stores/gameUIStore';
import { calculateCallIntent } from '@/lib/game-logic/callIntentCalculator';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
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
  forfeitedPlayers: Set<Seat>;
  historyPlayback: { pushUndoAction: (description: string) => void };
  sendCommand: (cmd: GameCommand) => void;
  setErrorMessage: (message: string) => void;
}

export interface CallEligibility {
  canCallForPung: boolean;
  canCallForKong: boolean;
  canCallForQuint: boolean;
  canCallForSextet: boolean;
  canCallForMahjong: boolean;
}

export interface UsePlayingPhaseActionsResult {
  callEligibility: CallEligibility;
  handleCallIntent: (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => void;
  handlePass: () => void;
}

export function usePlayingPhaseActions({
  callWindow,
  gameState,
  forfeitedPlayers,
  historyPlayback,
  sendCommand,
  setErrorMessage,
}: UsePlayingPhaseActionsOptions): UsePlayingPhaseActionsResult {
  const callWindowDeadlineMs = useMemo(() => {
    if (!callWindow.callWindow) return null;
    return callWindow.callWindow.timerStart + callWindow.callWindow.timerDuration * 1000;
  }, [callWindow.callWindow]);

  const handleCallWindowExpire = useCallback(() => {
    const { callWindow: cw, dispatch } = useGameUIStore.getState();
    if (!cw || cw.responded) return;
    sendCommand({ Pass: { player: gameState.your_seat } });
    dispatch({ type: 'MARK_CALL_WINDOW_RESPONDED', message: 'Time expired - auto-passed' });
  }, [gameState.your_seat, sendCommand]);

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

  const callEligibility = useMemo<CallEligibility>(() => {
    if (!callWindow.callWindow) {
      return {
        canCallForPung: false,
        canCallForKong: false,
        canCallForQuint: false,
        canCallForSextet: false,
        canCallForMahjong: true,
      };
    }

    const tile = callWindow.callWindow.tile;
    const tileCounts = new Map<Tile, number>();

    for (const handTile of gameState.your_hand) {
      tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
    }

    const pung = calculateCallIntent({ tile, tileCounts, intent: 'Pung' });
    const kong = calculateCallIntent({ tile, tileCounts, intent: 'Kong' });
    const quint = calculateCallIntent({ tile, tileCounts, intent: 'Quint' });
    const sextet = calculateCallIntent({ tile, tileCounts, intent: 'Sextet' });

    return {
      canCallForPung: pung.success,
      canCallForKong: kong.success,
      canCallForQuint: quint.success,
      canCallForSextet: sextet.success,
      canCallForMahjong: true,
    };
  }, [callWindow.callWindow, gameState.your_hand]);

  const handleCallIntent = useCallback(
    (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => {
      if (forfeitedPlayers.has(gameState.your_seat)) return;
      if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

      const tile = callWindow.callWindow.tile;

      if (intent === 'Mahjong') {
        sendCommand({
          DeclareCallIntent: {
            player: gameState.your_seat,
            intent: 'Mahjong',
          },
        });
        historyPlayback.pushUndoAction('Declared Mahjong call intent');
        callWindow.markResponded('Declared Mahjong');
        return;
      }

      const tileCounts = new Map<Tile, number>();
      for (const handTile of gameState.your_hand) {
        tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
      }

      const result = calculateCallIntent({ tile, tileCounts, intent });

      if (result.success && result.meldTiles) {
        sendCommand({
          DeclareCallIntent: {
            player: gameState.your_seat,
            intent: {
              Meld: {
                meld_type: intent,
                tiles: result.meldTiles,
                called_tile: tile,
                joker_assignments: {},
              },
            },
          },
        });
        historyPlayback.pushUndoAction(`Called for ${intent}`);
      }

      callWindow.markResponded(`Declared intent to call for ${intent}`);
    },
    [
      callWindow,
      gameState.your_seat,
      gameState.your_hand,
      historyPlayback,
      sendCommand,
      forfeitedPlayers,
    ]
  );

  const handlePass = useCallback(() => {
    if (forfeitedPlayers.has(gameState.your_seat)) return;
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    const message = `Passed on ${getTileName(callWindow.callWindow.tile)}`;
    sendCommand({ Pass: { player: gameState.your_seat } });
    historyPlayback.pushUndoAction(message);
    setErrorMessage(message);
    callWindow.closeCallWindow();
  }, [
    callWindow,
    gameState.your_seat,
    historyPlayback,
    sendCommand,
    forfeitedPlayers,
    setErrorMessage,
  ]);

  return {
    callEligibility,
    handleCallIntent,
    handlePass,
  };
}
