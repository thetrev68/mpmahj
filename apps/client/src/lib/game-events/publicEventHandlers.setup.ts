import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { EventHandlerResult } from './types';

export function handleDiceRolled(
  event: Extract<PublicEvent, { DiceRolled: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              phase: { Setup: 'BreakingWall' },
            }
          : null,
    ],
    uiActions: [
      { type: 'SET_DICE_ROLL', value: event.DiceRolled.roll },
      { type: 'SET_SHOW_DICE_OVERLAY', value: true },
    ],
    sideEffects: [],
  };
}

export function handleWallBroken(
  event: Extract<PublicEvent, { WallBroken: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              wall_break_point: event.WallBroken.position,
            }
          : null,
    ],
    uiActions: [{ type: 'SET_SETUP_PHASE', phase: 'Dealing' }],
    sideEffects: [],
  };
}

export function handlePhaseChanged(
  event: Extract<PublicEvent, { PhaseChanged: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              phase: event.PhaseChanged.phase,
            }
          : null,
    ],
    uiActions: [],
    sideEffects: [],
  };
}

export function handleStateRestored(
  event: Extract<PublicEvent, { StateRestored: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [],
    sideEffects:
      event.StateRestored.mode === 'None' ? [{ type: 'PLAY_SOUND', sound: 'undo-whoosh' }] : [],
  };
}
