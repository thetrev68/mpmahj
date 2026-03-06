import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { EventHandlerResult } from './types';

/**
 * Handle dice roll event at game start (Setup phase → BreakingWall phase).
 * Updates UI to show dice overlay and transitions game phase.
 * @param event - DiceRolled event containing roll value
 * @returns State updates and UI actions
 */
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

/**
 * Handle wall break event during Setup phase (BreakingWall → Dealing phase).
 * Records the break point position and advances to tile dealing.
 * @param event - WallBroken event containing wall break position
 * @returns State updates and UI actions
 */
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

/**
 * Handle generic phase change event (Setup, Charleston, Playing, EndGame).
 * Updates server game state with new phase.
 * @param event - PhaseChanged event containing new phase
 * @returns State updates and UI actions
 */
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

/**
 * Handle state restoration event from undo/hint/history systems.
 * Plays optional sound effect if restoration is not a no-op.
 * @param event - StateRestored event containing restoration mode
 * @returns State updates and UI actions
 */
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
