import { useCallback, useEffect, useMemo } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { calculateCallIntent } from '@/lib/game-logic/callIntentCalculator';
import { getTileName } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

interface UsePlayingPhaseActionsOptions {
  callWindow: ReturnType<typeof useCallWindowState>;
  gameState: GameStateSnapshot;
  forfeitedPlayers: Set<Seat>;
  historyPlayback: ReturnType<typeof useHistoryPlayback>;
  sendCommand: (cmd: GameCommand) => void;
  setErrorMessage: (message: string) => void;
}

interface CallEligibility {
  canCallForPung: boolean;
  canCallForKong: boolean;
  canCallForQuint: boolean;
  canCallForSextet: boolean;
  canCallForMahjong: boolean;
}

interface UsePlayingPhaseActionsResult {
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
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;
    sendCommand({ Pass: { player: gameState.your_seat } });
    callWindow.markResponded('Time expired - auto-passed');
  }, [callWindow, gameState.your_seat, sendCommand]);

  const callWindowSecondsRemaining = useCountdown({
    deadlineMs: callWindowDeadlineMs,
    intervalMs: 500,
    onExpire: handleCallWindowExpire,
  });

  useEffect(() => {
    callWindow.setTimerRemaining(callWindowSecondsRemaining);
  }, [callWindow, callWindowSecondsRemaining]);

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
    [callWindow, gameState.your_seat, gameState.your_hand, historyPlayback, sendCommand, forfeitedPlayers]
  );

  const handlePass = useCallback(() => {
    if (forfeitedPlayers.has(gameState.your_seat)) return;
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    const message = `Passed on ${getTileName(callWindow.callWindow.tile)}`;
    sendCommand({ Pass: { player: gameState.your_seat } });
    historyPlayback.pushUndoAction(message);
    setErrorMessage(message);
    callWindow.closeCallWindow();
  }, [callWindow, gameState.your_seat, historyPlayback, sendCommand, forfeitedPlayers, setErrorMessage]);

  return {
    callEligibility,
    handleCallIntent,
    handlePass,
  };
}
