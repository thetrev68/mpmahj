import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { EventHandlerResult, UIStateAction } from './types';

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

export function handleMahjongDeclared(
  event: Extract<PublicEvent, { MahjongDeclared: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_MAHJONG_DECLARED', player: event.MahjongDeclared.player }],
    sideEffects: [],
  };
}

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

export function handlePlayerForfeited(
  event: Extract<PublicEvent, { PlayerForfeited: unknown }>
): EventHandlerResult {
  const { player, reason } = event.PlayerForfeited;
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_PLAYER_FORFEITED', player, reason }],
    sideEffects: [],
  };
}

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
