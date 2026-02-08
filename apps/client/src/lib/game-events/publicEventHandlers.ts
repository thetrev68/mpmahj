/**
 * Public Event Handlers
 *
 * Pure functions for handling PublicEvent messages from the server.
 * Each handler returns declarative actions (state updates, UI changes, side effects)
 * rather than executing them directly.
 *
 * Benefits:
 * - Testable: Pure functions with clear inputs/outputs
 * - Composable: Handlers can be combined and tested independently
 * - Traceable: Easy to log and debug event processing
 * - Type-safe: TypeScript validates event shapes
 */

import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { EventHandlerResult } from './types';

/**
 * Handle DiceRolled event (Setup phase)
 *
 * Original location: GameBoard.tsx lines 332-336
 * ```typescript
 * if ('DiceRolled' in event) {
 *   setDiceRoll(event.DiceRolled.roll);
 *   setShowDiceOverlay(true);
 *   updateSetupPhase('BreakingWall');
 * }
 * ```
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
 * Handle WallBroken event (Setup phase)
 *
 * Original location: GameBoard.tsx lines 339-349
 * ```typescript
 * if ('WallBroken' in event) {
 *   setGameState((prev) =>
 *     prev
 *       ? {
 *           ...prev,
 *           wall_break_point: event.WallBroken.position,
 *         }
 *       : null
 *   );
 *   updateSetupPhase('Dealing');
 * }
 * ```
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
 * Handle PhaseChanged event
 *
 * Original location: GameBoard.tsx lines 516-525
 * ```typescript
 * if ('PhaseChanged' in event) {
 *   setGameState((prev) =>
 *     prev
 *       ? {
 *           ...prev,
 *           phase: event.PhaseChanged.phase,
 *         }
 *       : null
 *   );
 * }
 * ```
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
