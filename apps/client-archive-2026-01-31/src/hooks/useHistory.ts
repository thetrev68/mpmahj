import { useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

export function useHistory(sendCommand: (command: GameCommand) => boolean) {
  const history = useGameStore((state) => state.history);
  const yourSeat = useGameStore((state) => state.yourSeat);
  const addError = useUIStore((state) => state.addError);

  const requireSeat = useCallback(() => {
    if (!yourSeat) {
      addError('Seat not assigned yet');
      return null;
    }
    return yourSeat;
  }, [addError, yourSeat]);

  const requestHistory = useCallback(() => {
    const seat = requireSeat();
    if (!seat) return;
    sendCommand(Commands.requestHistory(seat));
  }, [requireSeat, sendCommand]);

  const jumpToMove = useCallback(
    (moveNumber: number) => {
      const seat = requireSeat();
      if (!seat) return;
      if (!Number.isFinite(moveNumber) || moveNumber < 0) {
        addError('Invalid move number');
        return;
      }
      const safeMove = Math.floor(moveNumber);
      sendCommand(Commands.jumpToMove(seat, safeMove));
    },
    [addError, requireSeat, sendCommand]
  );

  const resumeFromHistory = useCallback(
    (moveNumber: number) => {
      const seat = requireSeat();
      if (!seat) return;
      if (!Number.isFinite(moveNumber) || moveNumber < 0) {
        addError('Invalid move number');
        return;
      }
      const safeMove = Math.floor(moveNumber);
      sendCommand(Commands.resumeFromHistory(seat, safeMove));
    },
    [addError, requireSeat, sendCommand]
  );

  const returnToPresent = useCallback(() => {
    const seat = requireSeat();
    if (!seat) return;
    sendCommand(Commands.returnToPresent(seat));
  }, [requireSeat, sendCommand]);

  return {
    history,
    requestHistory,
    jumpToMove,
    resumeFromHistory,
    returnToPresent,
  };
}
