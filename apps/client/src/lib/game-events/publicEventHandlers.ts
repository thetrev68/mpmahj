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
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
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

/**
 * Handle CharlestonPhaseChanged event
 *
 * Updates Charleston phase stage and resets all Charleston UI state.
 *
 * Original location: GameBoard.tsx lines 351-403
 * ```typescript
 * if ('CharlestonPhaseChanged' in event) {
 *   setGameState((prev) =>
 *     prev ? {
 *       ...prev,
 *       phase: { Charleston: event.CharlestonPhaseChanged.stage },
 *     } : null
 *   );
 *   // Reset Charleston UI state for new stage
 *   clearSelection();
 *   setReadyPlayers([]);
 *   setHasSubmittedPass(false);
 *   // ... 20+ more state resets + timeout clears
 * }
 * ```
 */
export function handleCharlestonPhaseChanged(
  event: Extract<PublicEvent, { CharlestonPhaseChanged: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              phase: { Charleston: event.CharlestonPhaseChanged.stage },
            }
          : null,
    ],
    uiActions: [
      { type: 'RESET_CHARLESTON_STATE' },
      { type: 'CLEAR_SELECTION' },
      { type: 'CLEAR_SELECTION_ERROR' },
    ],
    sideEffects: [],
  };
}

/**
 * Handle CharlestonTimerStarted event
 *
 * Initializes Charleston timer with duration and expiry timestamp.
 *
 * Original location: GameBoard.tsx lines 404-415
 * ```typescript
 * if ('CharlestonTimerStarted' in event) {
 *   const timer = event.CharlestonTimerStarted;
 *   const expiresAtMs = Number(timer.started_at_ms) + timer.duration * 1000;
 *   setCharlestonTimer({
 *     stage: timer.stage,
 *     durationSeconds: timer.duration,
 *     startedAtMs: Number(timer.started_at_ms),
 *     expiresAtMs,
 *     mode: timer.timer_mode,
 *   });
 * }
 * ```
 */
export function handleCharlestonTimerStarted(
  event: Extract<PublicEvent, { CharlestonTimerStarted: unknown }>
): EventHandlerResult {
  const timer = event.CharlestonTimerStarted;
  const expiresAtMs = Number(timer.started_at_ms) + timer.duration * 1000;

  return {
    stateUpdates: [],
    uiActions: [
      {
        type: 'SET_CHARLESTON_TIMER',
        timer: {
          stage: timer.stage,
          durationSeconds: timer.duration,
          startedAtMs: Number(timer.started_at_ms),
          expiresAtMs,
          mode: timer.timer_mode,
        },
      },
    ],
    sideEffects: [],
  };
}

/**
 * Handle PlayerReadyForPass event
 *
 * Marks player as ready and shows bot message if applicable.
 *
 * Original location: GameBoard.tsx lines 417-435
 * ```typescript
 * if ('PlayerReadyForPass' in event) {
 *   setReadyPlayers((prev) => {
 *     const player = event.PlayerReadyForPass.player;
 *     if (prev.includes(player)) return prev;
 *     return [...prev, player];
 *   });
 *
 *   const playerSeat = event.PlayerReadyForPass.player;
 *   const matchingPlayer = gameState?.players.find((player) => player.seat === playerSeat);
 *   if (matchingPlayer?.is_bot) {
 *     setBotPassMessage(`${playerSeat} (Bot) has passed tiles.`);
 *     // ... timeout
 *   }
 * }
 * ```
 */
export function handlePlayerReadyForPass(
  event: Extract<PublicEvent, { PlayerReadyForPass: unknown }>,
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const playerSeat = event.PlayerReadyForPass.player;
  const uiActions: EventHandlerResult['uiActions'] = [
    { type: 'ADD_READY_PLAYER', seat: playerSeat },
  ];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  const matchingPlayer = gameState?.players.find((player) => player.seat === playerSeat);
  if (matchingPlayer?.is_bot) {
    uiActions.push({
      type: 'SET_BOT_PASS_MESSAGE',
      message: `${playerSeat} (Bot) has passed tiles.`,
    });

    sideEffects.push({
      type: 'TIMEOUT',
      id: 'bot-pass-message',
      ms: 2500,
      callback: () => {
        // Clear bot pass message
      },
    });
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects,
  };
}

/**
 * Handle TilesPassing event
 *
 * Shows pass animation overlay for 600ms.
 *
 * Original location: GameBoard.tsx lines 436-440
 * ```typescript
 * if ('TilesPassing' in event) {
 *   setPassDirection(event.TilesPassing.direction);
 *   setTimeout(() => setPassDirection(null), 600);
 * }
 * ```
 */
export function handleTilesPassing(
  event: Extract<PublicEvent, { TilesPassing: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_PASS_DIRECTION', direction: event.TilesPassing.direction }],
    sideEffects: [
      {
        type: 'TIMEOUT',
        id: 'pass-direction',
        ms: 600,
        callback: () => {
          // Clear pass direction
        },
      },
    ],
  };
}

/**
 * Handle BlindPassPerformed event
 *
 * Shows message about blind pass counts for 3 seconds.
 *
 * Original location: GameBoard.tsx lines 442-457
 * ```typescript
 * if ('BlindPassPerformed' in event) {
 *   const { player, blind_count, hand_count } = event.BlindPassPerformed;
 *   const isMe = player === gameState?.your_seat;
 *   const isBot = gameState?.players.find((p) => p.seat === player)?.is_bot ?? false;
 *   const playerLabel = isBot ? `${player} (Bot)` : player;
 *   const message = isMe
 *     ? `You passed ${blind_count} tiles blindly and ${hand_count} from hand`
 *     : `${playerLabel} passed ${blind_count} blind, ${hand_count} from hand`;
 *   setBotPassMessage(message);
 *   // ... timeout
 * }
 * ```
 */
export function handleBlindPassPerformed(
  event: Extract<PublicEvent, { BlindPassPerformed: unknown }>,
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const { player, blind_count, hand_count } = event.BlindPassPerformed;
  const isMe = player === gameState?.your_seat;
  const isBot = gameState?.players.find((p) => p.seat === player)?.is_bot ?? false;
  const playerLabel = isBot ? `${player} (Bot)` : player;
  const message = isMe
    ? `You passed ${blind_count} tiles blindly and ${hand_count} from hand`
    : `${playerLabel} passed ${blind_count} blind, ${hand_count} from hand`;

  return {
    stateUpdates: [],
    uiActions: [{ type: 'SET_BOT_PASS_MESSAGE', message }],
    sideEffects: [
      {
        type: 'TIMEOUT',
        id: 'bot-pass-message',
        ms: 3000,
        callback: () => {
          // Clear bot pass message
        },
      },
    ],
  };
}

/**
 * Handle PlayerVoted event
 *
 * Marks player as voted and shows bot message if applicable.
 *
 * Original location: GameBoard.tsx lines 476-504
 * ```typescript
 * if ('PlayerVoted' in event) {
 *   const votedSeat = event.PlayerVoted.player;
 *   setVotedPlayers((prev) => {
 *     if (prev.includes(votedSeat)) return prev;
 *     return [...prev, votedSeat];
 *   });
 *
 *   // Bot vote message (AC-9)
 *   const matchingPlayer = gameState?.players.find((p) => p.seat === votedSeat);
 *   if (matchingPlayer?.is_bot) {
 *     setBotVoteMessage(`${votedSeat} (Bot) has voted`);
 *     // ... timeout
 *   }
 *   // ... retry logic (deferred to Phase 5)
 * }
 * ```
 */
export function handlePlayerVoted(
  event: Extract<PublicEvent, { PlayerVoted: unknown }>,
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const votedSeat = event.PlayerVoted.player;
  const uiActions: EventHandlerResult['uiActions'] = [
    { type: 'ADD_VOTED_PLAYER', seat: votedSeat },
  ];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  const matchingPlayer = gameState?.players.find((p) => p.seat === votedSeat);
  if (matchingPlayer?.is_bot) {
    uiActions.push({
      type: 'SET_BOT_VOTE_MESSAGE',
      message: `${votedSeat} (Bot) has voted`,
    });

    sideEffects.push({
      type: 'TIMEOUT',
      id: 'bot-vote-message',
      ms: 2500,
      callback: () => {
        // Clear bot vote message
      },
    });
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects,
  };
}

/**
 * Handle VoteResult event
 *
 * Sets vote result, breakdown, and shows result overlay.
 *
 * Original location: GameBoard.tsx lines 505-510
 * ```typescript
 * if ('VoteResult' in event) {
 *   setVoteResult(event.VoteResult.result);
 *   setVoteBreakdown(event.VoteResult.votes as Record<Seat, CharlestonVote>);
 *   setShowVoteResultOverlay(true);
 * }
 * ```
 */
export function handleVoteResult(
  event: Extract<PublicEvent, { VoteResult: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [
      { type: 'SET_VOTE_RESULT', result: event.VoteResult.result },
      { type: 'SET_VOTE_BREAKDOWN', breakdown: event.VoteResult.votes as Record<Seat, CharlestonVote> },
      { type: 'SET_SHOW_VOTE_RESULT_OVERLAY', value: true },
    ],
    sideEffects: [],
  };
}
