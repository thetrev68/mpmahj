import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { EventHandlerResult, UIStateAction } from './types';

/**
 * Handle wall exhausted event (US-021).
 * Updates remaining tile count and signals to stop auto-draw retries.
 * @param event - WallExhausted event
 * @returns State updates and UI actions
 */
export function handleWallExhausted(
  event: Extract<PublicEvent, { WallExhausted: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              wall_tiles_remaining: event.WallExhausted.remaining_tiles,
            }
          : null,
    ],
    uiActions: [
      { type: 'SET_WALL_EXHAUSTED', remaining_tiles: event.WallExhausted.remaining_tiles },
      { type: 'CLEAR_PENDING_DRAW_RETRY' },
    ],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'game-draw' }],
  };
}

/**
 * Handle game abandoned event (US-021).
 * Shows overlay with abandonment reason (e.g. game became unplayable).
 * @param event - GameAbandoned event
 * @returns State updates and UI actions
 */
export function handleGameAbandoned(
  event: Extract<PublicEvent, { GameAbandoned: unknown }>
): EventHandlerResult {
  const { reason } = event.GameAbandoned;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_GAME_ABANDONED', reason }],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'game-draw' }],
  };
}

/**
 * Handle awaiting Mahjong validation event (US-019).
 * Sets called-from seat for all players; shows validation dialog only for caller.
 * @param event - AwaitingMahjongValidation event
 * @param context - Current player seat information
 * @returns State updates and UI actions
 */
export function handleAwaitingMahjongValidation(
  event: Extract<PublicEvent, { AwaitingMahjongValidation: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { caller, called_tile, discarded_by } = event.AwaitingMahjongValidation;
  const uiActions: UIStateAction[] = [{ type: 'SET_CALLED_FROM', discardedBy: discarded_by }];
  if (caller === context.yourSeat) {
    uiActions.push({
      type: 'SET_AWAITING_MAHJONG_VALIDATION',
      caller,
      calledTile: called_tile,
      discardedBy: discarded_by,
    });
  }
  return { stateUpdates: [], uiActions, sideEffects: [] };
}

/**
 * Handle Mahjong declared event (US-018).
 * Records which player declared Mahjong for display purposes.
 * @param event - MahjongDeclared event
 * @returns State updates and UI actions
 */
export function handleMahjongDeclared(
  event: Extract<PublicEvent, { MahjongDeclared: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_MAHJONG_DECLARED', player: event.MahjongDeclared.player }],
    sideEffects: [],
  };
}

/**
 * Handle hand validated event (US-018/US-019).
 * Records validation result and displays win sound if valid.
 * @param event - HandValidated event
 * @returns State updates and UI actions
 */
export function handleHandValidated(
  event: Extract<PublicEvent, { HandValidated: unknown }>
): EventHandlerResult {
  const { player, valid, pattern } = event.HandValidated;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_MAHJONG_VALIDATED', player, valid, pattern }],
    sideEffects: valid ? [{ type: 'PLAY_SOUND', sound: 'mahjong-win' }] : [],
  };
}

/**
 * Handle hand declared dead event (US-020).
 * Marks player's hand as unplayable and plays penalty sound.
 * @param event - HandDeclaredDead event
 * @returns State updates and UI actions
 */
export function handleHandDeclaredDead(
  event: Extract<PublicEvent, { HandDeclaredDead: unknown }>
): EventHandlerResult {
  const { player, reason } = event.HandDeclaredDead;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_HAND_DECLARED_DEAD', player, reason }],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'dead-hand-penalty' }],
  };
}

/**
 * Handle player skipped event (US-020).
 * Records that a player's turn was skipped and the reason.
 * @param event - PlayerSkipped event
 * @returns State updates and UI actions
 */
export function handlePlayerSkipped(
  event: Extract<PublicEvent, { PlayerSkipped: unknown }>
): EventHandlerResult {
  const { player, reason } = event.PlayerSkipped;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_PLAYER_SKIPPED', player, reason }],
    sideEffects: [],
  };
}

/**
 * Handle game over event.
 * Records winner and game result, transitions phase to GameOver.
 * @param event - GameOver event
 * @returns State updates and UI actions
 */
export function handleGameOver(
  event: Extract<PublicEvent, { GameOver: unknown }>
): EventHandlerResult {
  const { winner, result } = event.GameOver;
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              phase: { GameOver: result },
            }
          : null,
    ],
    uiActions: [{ type: 'SET_GAME_OVER', winner, result }],
    sideEffects: [],
  };
}

/**
 * Handle heavenly hand event.
 * Records bonus hand pattern and base score, plays win sound.
 * @param event - HeavenlyHand event
 * @returns State updates and UI actions
 */
export function handleHeavenlyHand(
  event: Extract<PublicEvent, { HeavenlyHand: unknown }>
): EventHandlerResult {
  const { pattern, base_score } = event.HeavenlyHand;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_HEAVENLY_HAND', pattern, base_score }],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'mahjong-win' }],
  };
}
