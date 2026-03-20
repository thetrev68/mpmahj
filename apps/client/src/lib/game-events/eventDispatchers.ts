import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { InboundEnvelope } from '@/hooks/gameSocketTypes';
import { emitAnalysisEventNotifications, emitPublicEventNotifications } from './eventNotifications';
import { handlePrivateEvent, type PrivateEventContext } from './privateEventHandlers';
import { handlePublicEvent, type PublicEventDispatchContext } from './publicEventHandlers';
import type { EventHandlerResult, ServerEventNotification } from './types';

export interface EventDispatchContext {
  /** Whether to print detailed debug logs. */
  debug: boolean;
  /** Returns latest state snapshot currently held by the hook. */
  getServerSnapshot: () => GameStateSnapshot | null;
  /** Returns current call-window context from UI store. */
  getCallWindowContext: () => {
    intents: CallIntentSummary[];
    discardedBy: Seat | null;
    hasSubmittedPass: boolean;
  };
  /** Current player seat in the active game. */
  getYourSeat: () => Seat | null;
  /** Emits event notifications (history/hint channels). */
  emitServerEvent: (event: ServerEventNotification) => void;
  /** Applies `EventHandlerResult` to state + ui + side effects. */
  applyHandlerResult: (result: EventHandlerResult) => void;
  /** Requests a `StateSnapshot` for a seat. */
  requestStateBySeat: (seat: Seat) => void;
  /** Replaces the cached server snapshot and advances revision. */
  setServerSnapshot: (snapshot: GameStateSnapshot) => void;
  incrementSnapshotRevision: () => void;
}

export interface EventDispatchers {
  handleEventEnvelope: (envelope: InboundEnvelope) => void;
  handleStateSnapshotEnvelope: (envelope: InboundEnvelope) => void;
  handleErrorEnvelope: (envelope: InboundEnvelope) => void;
}

function withPublicContext(context: EventDispatchContext): PublicEventDispatchContext {
  const state = context.getServerSnapshot();
  const callContext = context.getCallWindowContext();

  return {
    gameState: state,
    yourSeat: state?.your_seat ?? null,
    callIntents: callContext.intents,
    discardedBy: callContext.discardedBy,
  };
}

function withPrivateContext(context: EventDispatchContext): PrivateEventContext {
  const state = context.getServerSnapshot();

  return {
    gameState: state,
    hasSubmittedPass: context.getCallWindowContext().hasSubmittedPass,
    yourSeat: context.getYourSeat() ?? undefined,
  };
}

function isCharlestonPhase(phase: GameStateSnapshot['phase'] | null | undefined): boolean {
  return typeof phase === 'object' && phase !== null && 'Charleston' in phase;
}

export function createEventDispatchers(context: EventDispatchContext): EventDispatchers {
  const requestState = () => {
    const seat = context.getYourSeat();
    if (!seat) return;
    context.requestStateBySeat(seat);
  };

  const handleEventEnvelope = (envelope: InboundEnvelope) => {
    if (envelope.kind !== 'Event') return;

    const event = envelope.payload.event;
    if (typeof event !== 'object' || event === null) return;

    if ('Analysis' in event) {
      emitAnalysisEventNotifications(context.emitServerEvent, event.Analysis);
    }

    if ('Public' in event) {
      emitPublicEventNotifications(context.emitServerEvent, event.Public);
      const publicContext = withPublicContext(context);
      const result = handlePublicEvent(event.Public, publicContext);
      context.applyHandlerResult(result);
    }

    if ('Private' in event) {
      const privateContext = withPrivateContext(context);
      const result = handlePrivateEvent(event.Private, privateContext);
      context.applyHandlerResult(result);
    }
  };

  const handleStateSnapshotEnvelope = (envelope: InboundEnvelope) => {
    if (envelope.kind !== 'StateSnapshot') return;

    const { snapshot } = envelope.payload;
    if (context.debug) {
      console.log('[useGameEvents] Received state snapshot:', snapshot.game_id);
    }

    context.setServerSnapshot(snapshot);
    context.incrementSnapshotRevision();
  };

  const handleErrorEnvelope = (envelope: InboundEnvelope) => {
    if (envelope.kind !== 'Error') return;

    const payload = envelope.payload;
    if (!payload.message) return;

    console.warn('[useGameEvents] Received error:', payload.code, payload.message);

    const currentState = context.getServerSnapshot();
    const inCharleston = isCharlestonPhase(currentState?.phase);

    if (inCharleston && payload.code === 'ALREADY_SUBMITTED') {
      if (context.debug) {
        console.info('[useGameEvents] Pass already submitted — treating as idempotent success');
      }
      return;
    }

    const uiActions: EventHandlerResult['uiActions'] = [
      { type: 'SET_ERROR_MESSAGE', message: payload.message },
    ];

    const isInvalidTileError =
      payload.code === 'INVALID_TILE' || /tile not in hand/i.test(payload.message);
    const isRateLimitError =
      payload.code === 'RATE_LIMIT_EXCEEDED' || /rate limit/i.test(payload.message);

    if (inCharleston && /blind pass/i.test(payload.message)) {
      uiActions.push(
        { type: 'CLEAR_SELECTION' },
        { type: 'CLEAR_STAGING' },
        { type: 'SET_HAS_SUBMITTED_PASS', value: false }
      );
    }

    if (inCharleston && isInvalidTileError) {
      uiActions.push({ type: 'CLEAR_SELECTION' }, { type: 'SET_HAS_SUBMITTED_PASS', value: false });
      if (currentState?.your_seat) {
        requestState();
      }
    }

    if (inCharleston && isRateLimitError) {
      uiActions.push({ type: 'SET_HAS_SUBMITTED_PASS', value: false });
    }

    context.applyHandlerResult({
      stateUpdates: [],
      uiActions,
      sideEffects: [{ type: 'TIMEOUT', id: 'error-message', ms: 3000 }],
    });
  };

  return {
    handleEventEnvelope,
    handleStateSnapshotEnvelope,
    handleErrorEnvelope,
  };
}

export type { PublicEvent, PrivateEvent };
