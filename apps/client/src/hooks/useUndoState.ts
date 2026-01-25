import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { Seat } from '@/types/bindings/generated/Seat';

const fallbackSeats: Seat[] = ['East', 'South', 'West', 'North'];

export function useUndoState() {
  const undoState = useGameStore((state) => state.undoState);
  const yourSeat = useGameStore((state) => state.yourSeat);
  const players = useGameStore((state) => state.players);
  const setUndoExecuting = useGameStore((state) => state.setUndoExecuting);

  const seats = useMemo(() => {
    const keys = Object.keys(players) as Seat[];
    return keys.length > 0 ? keys : fallbackSeats;
  }, [players]);

  const isPractice = useMemo(() => {
    if (!yourSeat) return false;
    const entries = Object.values(players);
    if (entries.length === 0) return true;
    return entries.every((player) => player.seat === yourSeat || player.is_bot);
  }, [players, yourSeat]);

  const canUndo = Boolean(
    yourSeat && undoState.canUndo && !undoState.pendingRequest && !undoState.isExecuting
  );

  return {
    canUndo,
    lastAction: undoState.lastAction,
    pendingRequest: undoState.pendingRequest,
    isExecuting: undoState.isExecuting,
    isPractice,
    seats,
    setUndoExecuting,
    yourSeat,
  };
}
