import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { EventHandlerResult } from './types';

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

    sideEffects.push({ type: 'TIMEOUT', id: 'bot-pass-message', ms: 2500 });
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects,
  };
}

export function handlePlayerStagedTile(
  event: Extract<PublicEvent, { PlayerStagedTile: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [
      {
        type: 'SET_OPPONENT_STAGED_COUNT',
        seat: event.PlayerStagedTile.player,
        count: event.PlayerStagedTile.count,
      },
    ],
    sideEffects: [],
  };
}

export function handleTilesPassing(
  event: Extract<PublicEvent, { TilesPassing: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [
      { type: 'CLEAR_OPPONENT_STAGED_COUNTS' },
      { type: 'SET_PASS_DIRECTION', direction: event.TilesPassing.direction },
    ],
    sideEffects: [{ type: 'TIMEOUT', id: 'pass-direction', ms: 600 }],
  };
}

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
    sideEffects: [{ type: 'TIMEOUT', id: 'bot-pass-message', ms: 3000 }],
  };
}

export function handlePlayerVoted(
  event: Extract<PublicEvent, { PlayerVoted: unknown }>,
  gameState: GameStateSnapshot | null,
  yourSeat: Seat | null = gameState?.your_seat ?? null
): EventHandlerResult {
  const votedSeat = event.PlayerVoted.player;
  const uiActions: EventHandlerResult['uiActions'] = [
    { type: 'ADD_VOTED_PLAYER', seat: votedSeat },
  ];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  if (yourSeat && votedSeat === yourSeat) {
    uiActions.push({ type: 'CLEAR_PENDING_VOTE_RETRY' });
  }

  const matchingPlayer = gameState?.players.find((p) => p.seat === votedSeat);
  if (matchingPlayer?.is_bot) {
    uiActions.push({
      type: 'SET_BOT_VOTE_MESSAGE',
      message: `${votedSeat} (Bot) has voted`,
    });

    sideEffects.push({ type: 'TIMEOUT', id: 'bot-vote-message', ms: 2500 });
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects,
  };
}

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

export function handleCourtesyPassComplete(): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'RESET_COURTESY_STATE' }],
    sideEffects: [],
  };
}

export function handleIOUDetected(
  event: Extract<PublicEvent, { IOUDetected: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [
      {
        type: 'SET_IOU_STATE',
        state: {
          active: true,
          debts: event.IOUDetected.debts,
          resolved: false,
        },
      },
    ],
    sideEffects: [],
  };
}

export function handleIOUResolved(
  event: Extract<PublicEvent, { IOUResolved: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'RESOLVE_IOU', summary: event.IOUResolved.summary }],
    sideEffects: [{ type: 'TIMEOUT', id: 'iou-overlay', ms: 3000 }],
  };
}
