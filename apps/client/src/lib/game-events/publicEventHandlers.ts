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
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { EventHandlerResult, UIStateAction, EventContext } from './types';
import { EMPTY_RESULT } from './types';

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
      {
        type: 'SET_VOTE_BREAKDOWN',
        breakdown: event.VoteResult.votes as unknown as Record<Seat, CharlestonVote>,
      },
      { type: 'SET_SHOW_VOTE_RESULT_OVERLAY', value: true },
    ],
    sideEffects: [],
  };
}

// ============================================================================
// Playing Phase Event Handlers
// ============================================================================

/**
 * Handle TurnChanged event (Playing phase)
 *
 * Updates current turn and turn stage.
 *
 * Original location: GameBoard.tsx lines 558-566
 * ```typescript
 * if ('TurnChanged' in event) {
 *   setGameState((prev) =>
 *     prev ? { ...prev, current_turn: event.TurnChanged.player, phase: { Playing: event.TurnChanged.stage } } : null
 *   );
 * }
 * ```
 */
export function handleTurnChanged(
  event: Extract<PublicEvent, { TurnChanged: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              current_turn: event.TurnChanged.player,
              phase: { Playing: event.TurnChanged.stage },
            }
          : null,
    ],
    uiActions: [
      { type: 'SET_CURRENT_TURN', seat: event.TurnChanged.player },
      { type: 'SET_TURN_STAGE', stage: event.TurnChanged.stage },
    ],
    sideEffects: [],
  };
}

/**
 * Handle TileDrawnPublic event
 *
 * Updates wall tile count.
 *
 * Original location: GameBoard.tsx lines 569-578
 * ```typescript
 * if ('TileDrawnPublic' in event) {
 *   setGameState((prev) =>
 *     prev ? { ...prev, wall_tiles_remaining: event.TileDrawnPublic.remaining_tiles } : null
 *   );
 * }
 * ```
 */
export function handleTileDrawnPublic(
  event: Extract<PublicEvent, { TileDrawnPublic: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              wall_tiles_remaining: event.TileDrawnPublic.remaining_tiles,
            }
          : null,
    ],
    uiActions: [],
    sideEffects: [],
  };
}

/**
 * Handle TileDiscarded event
 *
 * Updates discard pool, clears processing state, triggers discard animation and sound.
 *
 * Original location: GameBoard.tsx lines 581-625
 * ```typescript
 * if ('TileDiscarded' in event) {
 *   // Update hand if it's my discard
 *   // Add to discard pool
 *   // Show discard animation
 *   // Clear processing
 *   // Play sound
 * }
 * ```
 */
export function handleTileDiscarded(
  event: Extract<PublicEvent, { TileDiscarded: unknown }>
): EventHandlerResult {
  const { player, tile } = event.TileDiscarded;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        // If it's my discard, remove tile from hand
        const newHand =
          player === prev.your_seat
            ? prev.your_hand.filter((_t, index) => {
                const found = prev.your_hand.indexOf(tile);
                return index !== found;
              })
            : prev.your_hand;

        // Add to discard pool
        const newDiscards = [
          ...(prev.discard_pile || []),
          {
            tile,
            discarded_by: player,
          },
        ];

        return {
          ...prev,
          your_hand: newHand,
          discard_pile: newDiscards,
        };
      },
    ],
    uiActions: [
      { type: 'SET_DISCARD_ANIMATION_TILE', tile },
      { type: 'SET_MOST_RECENT_DISCARD', tile },
      { type: 'SET_IS_PROCESSING', value: false },
      { type: 'CLEAR_SELECTION' },
    ],
    sideEffects: [
      { type: 'PLAY_SOUND', sound: 'tile-discard' },
      {
        type: 'TIMEOUT',
        id: 'clear-recent-discard',
        ms: 2000,
        callback: () => {
          /* Clear mostRecentDiscard - will be handled by UI */
        },
      },
    ],
  };
}

/**
 * Handle CallWindowOpened event
 *
 * Opens call window if player is eligible to call.
 *
 * Original location: GameBoard.tsx lines 646-677
 * ```typescript
 * if ('CallWindowOpened' in event) {
 *   const { tile, discarded_by, can_call, timer, started_at_ms } = event.CallWindowOpened;
 *   const isEligible = can_call.includes(gameState?.your_seat || 'East');
 *   if (isEligible) {
 *     setCallWindowState({ active: true, tile, ... });
 *   }
 * }
 * ```
 */
export function handleCallWindowOpened(
  event: Extract<PublicEvent, { CallWindowOpened: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { tile, discarded_by, can_call, timer, started_at_ms } = event.CallWindowOpened;
  const isEligible = can_call.includes(context.yourSeat);

  if (isEligible) {
    return {
      stateUpdates: [],
      uiActions: [
        {
          type: 'OPEN_CALL_WINDOW',
          params: {
            tile,
            discardedBy: discarded_by,
            canCall: can_call,
            timerDuration: timer,
            timerStart: Number(started_at_ms),
          },
        },
      ],
      sideEffects: [],
    };
  } else {
    // Not eligible - just show informational message
    return {
      stateUpdates: [],
      uiActions: [],
      sideEffects: [],
    };
  }
}

/**
 * Handle CallWindowProgress event
 *
 * Updates call window with current intents and remaining players who can act.
 *
 * Original location: GameBoard.tsx lines 679-692
 * ```typescript
 * if ('CallWindowProgress' in event) {
 *   const { can_act, intents } = event.CallWindowProgress;
 *   callIntentsRef.current.intents = intents;
 *   setCallWindowState((prev) => prev ? { ...prev, canAct: can_act, intents } : prev);
 * }
 * ```
 */
export function handleCallWindowProgress(
  event: Extract<PublicEvent, { CallWindowProgress: unknown }>
): EventHandlerResult {
  const { can_act, intents } = event.CallWindowProgress;

  return {
    stateUpdates: [],
    uiActions: [{ type: 'UPDATE_CALL_WINDOW_PROGRESS', canAct: can_act, intents }],
    sideEffects: [],
  };
}

/**
 * Handle CallResolved event
 *
 * Shows resolution overlay if there was competition.
 *
 * Original location: GameBoard.tsx lines 695-742
 * ```typescript
 * if ('CallResolved' in event) {
 *   const { resolution, tie_break } = event.CallResolved;
 *   const allCallers = callIntentsRef.current.intents;
 *   if (resolution !== 'NoCall' && allCallers.length > 0) {
 *     setResolutionOverlay({ resolution, tie_break, allCallers, discardedBy });
 *   }
 *   setCallWindowState(null);
 * }
 * ```
 */
export function handleCallResolved(
  event: Extract<PublicEvent, { CallResolved: unknown }>,
  context: { callIntents: CallIntentSummary[]; discardedBy: Seat }
): EventHandlerResult {
  const { resolution, tie_break } = event.CallResolved;
  const allCallers = context.callIntents;
  const discardedBy = context.discardedBy;

  const uiActions: UIStateAction[] = [{ type: 'CLOSE_CALL_WINDOW' }];

  // Show resolution overlay if there was competition
  if (resolution !== 'NoCall' && allCallers.length > 0) {
    uiActions.push({
      type: 'SHOW_RESOLUTION_OVERLAY',
      data: {
        resolution,
        tieBreak: tie_break,
        allCallers,
        discardedBy,
      },
    });
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects: [],
  };
}

/**
 * Handle CallWindowClosed event
 *
 * Closes call window.
 *
 * Original location: GameBoard.tsx lines 346-354, 745-754
 * ```typescript
 * if ('CallWindowClosed' in event) {
 *   setCallWindowState(null);
 *   setCallWindowTimer(null);
 *   clearTimeout(callWindowTimeoutRef.current);
 * }
 * ```
 */
export function handleCallWindowClosed(): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'CLOSE_CALL_WINDOW' }],
    sideEffects: [{ type: 'CLEAR_TIMEOUT', id: 'call-window' }],
  };
}

/**
 * Handle TileCalled event
 *
 * Adds meld to player's exposed melds and removes tiles from their hand if it's the caller.
 *
 * Original location: GameBoard.tsx lines 757-844
 * ```typescript
 * if ('TileCalled' in event) {
 *   const { player, meld, called_tile, called_from } = event.TileCalled;
 *   // Add to exposed_melds
 *   // Remove tiles from hand if caller
 *   // Mark discard as called
 * }
 * ```
 */
export function handleTileCalled(
  event: Extract<PublicEvent, { TileCalled: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { player, meld } = event.TileCalled;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        // Update the player's exposed melds in the players array
        const newPlayers = prev.players.map((p) => {
          if (p.seat === player) {
            return {
              ...p,
              exposed_melds: [...p.exposed_melds, meld],
            };
          }
          return p;
        });

        // If I'm the caller, remove tiles from my hand
        let newHand = prev.your_hand;
        if (player === context.yourSeat) {
          const tilesToRemove = meld.tiles.slice(1); // First tile is the called tile
          newHand = prev.your_hand.filter((handTile) => {
            // Remove tiles that match the meld
            for (let i = 0; i < tilesToRemove.length; i++) {
              if (handTile === tilesToRemove[i]) {
                tilesToRemove.splice(i, 1);
                return false;
              }
            }
            return true;
          });
        }

        // Note: DiscardInfo in bindings doesn't have a 'called' field
        // The discard_pile remains unchanged (server tracks call status separately)
        return {
          ...prev,
          your_hand: newHand,
          players: newPlayers,
        };
      },
    ],
    uiActions: [],
    sideEffects: [],
  };
}

/**
 * Handle WallExhausted event
 *
 * Shows wall exhausted message (draw game).
 *
 * Original location: GameBoard.tsx lines 628-643
 * ```typescript
 * if ('WallExhausted' in event) {
 *   setGameState((prev) =>
 *     prev ? { ...prev, wall_tiles_remaining: event.WallExhausted.remaining_tiles } : null
 *   );
 *   setErrorMessage('Wall exhausted - Draw game');
 * }
 * ```
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
    uiActions: [{ type: 'SET_ERROR_MESSAGE', message: 'Wall exhausted - Draw game' }],
    sideEffects: [
      {
        type: 'TIMEOUT',
        id: 'wall-exhausted-message',
        ms: 5000,
        callback: () => {
          /* Clear error message */
        },
      },
    ],
  };
}

export interface PublicEventDispatchContext extends EventContext {
  yourSeat: Seat | null;
  callIntents: CallIntentSummary[];
  discardedBy: Seat | null;
}

export function handlePublicEvent(
  event: PublicEvent,
  context: PublicEventDispatchContext
): EventHandlerResult {
  if (event === 'CallWindowClosed') return handleCallWindowClosed();

  if (typeof event !== 'object' || event === null) {
    return EMPTY_RESULT;
  }

  if ('DiceRolled' in event) return handleDiceRolled(event);
  if ('WallBroken' in event) return handleWallBroken(event);
  if ('PhaseChanged' in event) return handlePhaseChanged(event);
  if ('CharlestonPhaseChanged' in event) return handleCharlestonPhaseChanged(event);
  if ('CharlestonTimerStarted' in event) return handleCharlestonTimerStarted(event);
  if ('PlayerReadyForPass' in event) return handlePlayerReadyForPass(event, context.gameState);
  if ('TilesPassing' in event) return handleTilesPassing(event);
  if ('BlindPassPerformed' in event) return handleBlindPassPerformed(event, context.gameState);
  if ('PlayerVoted' in event) return handlePlayerVoted(event, context.gameState);
  if ('VoteResult' in event) return handleVoteResult(event);
  if ('TurnChanged' in event) return handleTurnChanged(event);
  if ('TileDrawnPublic' in event) return handleTileDrawnPublic(event);
  if ('TileDiscarded' in event) return handleTileDiscarded(event);
  if ('CallWindowOpened' in event) {
    if (context.yourSeat) {
      return handleCallWindowOpened(event, { yourSeat: context.yourSeat });
    }
    return EMPTY_RESULT;
  }
  if ('CallWindowProgress' in event) return handleCallWindowProgress(event);
  if ('CallResolved' in event) {
    if (context.discardedBy) {
      return handleCallResolved(event, {
        callIntents: context.callIntents,
        discardedBy: context.discardedBy,
      });
    }
    return EMPTY_RESULT;
  }
  if ('TileCalled' in event) {
    if (context.yourSeat) {
      return handleTileCalled(event, { yourSeat: context.yourSeat });
    }
    return EMPTY_RESULT;
  }
  if ('WallExhausted' in event) return handleWallExhausted(event);

  return EMPTY_RESULT;
}
