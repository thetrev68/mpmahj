import type { MutableRefObject } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import { decodeInboundEnvelope } from './gameSocketDecoder';
import type {
  AuthSuccessEnvelope,
  CommandEnvelope,
  EnvelopeListener,
  ErrorEnvelopePayload,
  InboundEnvelope,
  OutboundEnvelope,
  RecoveryAction,
} from './gameSocketTypes';
import { isSeat } from './gameSocketTypes';
import { clearStoredSession, persistSeat, persistSessionToken } from './gameSocketStorage';

// ─── Recovery predicates ──────────────────────────────────────────────────────

function isAuthErrorPayload(payload: ErrorEnvelopePayload): boolean {
  const code = payload.code?.toLowerCase() ?? '';
  const message = payload.message?.toLowerCase() ?? '';
  return (
    code.includes('auth') ||
    code.includes('token') ||
    code.includes('unauthorized') ||
    message.includes('auth') ||
    message.includes('token') ||
    message.includes('expired') ||
    message.includes('unauthorized')
  );
}

function isResyncNotFoundPayload(payload: ErrorEnvelopePayload): boolean {
  const code = payload.code?.toLowerCase() ?? '';
  const message = payload.message?.toLowerCase() ?? '';
  return (
    code.includes('not_found') ||
    message.includes('not found') ||
    message.includes('game ended') ||
    message.includes('room no longer exists')
  );
}

// ─── Envelope builders ────────────────────────────────────────────────────────

function buildRequestStateEnvelope(seat: Seat): CommandEnvelope {
  return {
    kind: 'Command',
    payload: {
      command: {
        RequestState: {
          player: seat,
        },
      },
    },
  };
}

interface GameSocketProtocolRefs {
  listenersRef: MutableRefObject<Map<string, Set<EnvelopeListener>>>;
  expectsResyncRef: MutableRefObject<boolean>;
  reconnectingRef: MutableRefObject<boolean>;
  isAuthenticatedRef: MutableRefObject<boolean>;
  seatRef: MutableRefObject<Seat | null>;
}

interface GameSocketProtocolSetters {
  setPlayerId: (playerId: string | null) => void;
  setSessionToken: (token: string | null) => void;
  setSeat: (seat: Seat | null) => void;
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  setRecoveryAction: (action: RecoveryAction) => void;
  setRecoveryMessage: (message: string | null) => void;
  setShowReconnectedToast: (show: boolean) => void;
  setIsReconnecting: (value: boolean) => void;
  /**
   * Clears the resync-pending flag when a StateSnapshot arrives or when the
   * resync is abandoned due to a terminal error. Set to true by the transport
   * layer on connection drop when a prior session existed.
   */
  setResyncPending: (pending: boolean) => void;
}

interface GameSocketProtocolActions {
  startHeartbeat: () => void;
  sendRaw: (envelope: OutboundEnvelope) => boolean;
  flushPendingQueue: () => void;
  resetReconnectState: () => void;
  getStoredSessionToken: () => string | null;
  setShouldReconnect: (value: boolean) => void;
}

interface GameSocketProtocol {
  sendHeartbeatPong: (timestamp?: string) => void;
  handleEnvelope: (envelope: InboundEnvelope) => void;
  handleMessage: (event: MessageEvent) => void;
}

interface GameSocketProtocolOptions {
  refs: GameSocketProtocolRefs;
  setters: GameSocketProtocolSetters;
  actions: GameSocketProtocolActions;
}

export function createGameSocketProtocol(options: GameSocketProtocolOptions): GameSocketProtocol {
  const { refs, setters, actions } = options;

  const sendHeartbeatPong = (timestamp?: string) => {
    actions.sendRaw({
      kind: 'Pong',
      payload: { timestamp: timestamp ?? new Date().toISOString() },
    });
  };

  const notifyListeners = (envelope: InboundEnvelope) => {
    const listeners = refs.listenersRef.current.get(envelope.kind);
    if (listeners) {
      listeners.forEach((listener) => listener(envelope));
    }

    const wildcardListeners = refs.listenersRef.current.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((listener) => listener(envelope));
    }
  };

  const handleAuthSuccess = (payload: AuthSuccessEnvelope['payload']) => {
    setters.setPlayerId(payload.player_id);
    setters.setSessionToken(payload.session_token);
    persistSessionToken(payload.session_token);
    refs.isAuthenticatedRef.current = true;

    if (payload.seat && isSeat(payload.seat)) {
      setters.setSeat(payload.seat);
      persistSeat(payload.seat);
    }

    setters.setConnectionState('connected');
    actions.startHeartbeat();
    actions.flushPendingQueue();

    if (refs.reconnectingRef.current) {
      setters.setShowReconnectedToast(true);
      setters.setIsReconnecting(false);
    }

    const authSeat = payload.seat && isSeat(payload.seat) ? payload.seat : refs.seatRef.current;

    if (refs.expectsResyncRef.current) {
      const resyncSeat = authSeat;
      if (resyncSeat) {
        const requested = actions.sendRaw(buildRequestStateEnvelope(resyncSeat));
        if (!requested) {
          // Lifecycle: resync_pending → terminal_recovery (send failed)
          setters.setRecoveryAction('return_lobby');
          setters.setRecoveryMessage('Unable to restore connection');
          setters.setResyncPending(false);
          refs.expectsResyncRef.current = false;
          return;
        }
        // Lifecycle: reconnecting → resync_pending (RequestState sent; awaiting StateSnapshot)
      } else {
        // Lifecycle: resync_pending → terminal_recovery (seat lost)
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage('Unable to restore seat');
        setters.setResyncPending(false);
        refs.expectsResyncRef.current = false;
      }
    } else if (payload.room_id && authSeat) {
      // Lifecycle: connecting → resync_pending (auth with room_id; RequestState sent)
      refs.expectsResyncRef.current = true;
      setters.setResyncPending(true);
      actions.sendRaw(buildRequestStateEnvelope(authSeat));
    }

    actions.resetReconnectState();
  };

  const handleEnvelope = (envelope: InboundEnvelope) => {
    if (envelope.kind === 'AuthFailure') {
      console.error('AuthFailure:', envelope.payload?.reason);
      if (actions.getStoredSessionToken()) {
        // Session token rejected — clear stored session. Next reconnect will
        // return to login; no resync should be expected.
        // Lifecycle: connecting/resync_pending → connecting (session cleared, retry)
        clearStoredSession();
        setters.setSessionToken(null);
        setters.setSeat(null);
        setters.setResyncPending(false);
        setters.setRecoveryAction('return_login');
        setters.setRecoveryMessage('Session expired. Please log in again.');
        actions.setShouldReconnect(false);
        actions.resetReconnectState();
      } else {
        // No session; permanent failure.
        // Lifecycle: connecting → disconnected (reconnect disabled)
        setters.setResyncPending(false);
        actions.setShouldReconnect(false);
        actions.resetReconnectState();
      }
    }

    if (envelope.kind === 'RoomJoined') {
      if (isSeat(envelope.payload.seat)) {
        setters.setSeat(envelope.payload.seat);
        persistSeat(envelope.payload.seat);
        // Lifecycle: authenticated → resync_pending (joined a room; RequestState sent)
        refs.expectsResyncRef.current = true;
        setters.setResyncPending(true);
        actions.sendRaw(buildRequestStateEnvelope(envelope.payload.seat));
      }
    }

    if (envelope.kind === 'StateSnapshot') {
      const snapshotSeat = envelope.payload.snapshot.your_seat;
      if (isSeat(snapshotSeat)) {
        setters.setSeat(snapshotSeat);
        persistSeat(snapshotSeat);
        // Lifecycle: resync_pending → authenticated (snapshot received, resync complete)
        setters.setResyncPending(false);
        refs.expectsResyncRef.current = false;
      } else if (refs.expectsResyncRef.current) {
        // Lifecycle: resync_pending → terminal_recovery (snapshot had no usable seat)
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage('Unable to restore seat');
        setters.setResyncPending(false);
        refs.expectsResyncRef.current = false;
      }
    }

    if (envelope.kind === 'Error') {
      const payload = envelope.payload;
      if (isAuthErrorPayload(payload)) {
        // Lifecycle: any → terminal_recovery (auth error, session invalid)
        clearStoredSession();
        setters.setSessionToken(null);
        setters.setSeat(null);
        setters.setRecoveryAction('return_login');
        setters.setRecoveryMessage(payload.message);
        setters.setResyncPending(false);
        actions.setShouldReconnect(false);
        refs.expectsResyncRef.current = false;
        actions.resetReconnectState();
      } else if (refs.expectsResyncRef.current && isResyncNotFoundPayload(payload)) {
        // Lifecycle: resync_pending → terminal_recovery (room no longer exists)
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage(payload.message);
        setters.setResyncPending(false);
        refs.expectsResyncRef.current = false;
      }
    }

    notifyListeners(envelope);

    if (envelope.kind === 'AuthSuccess') {
      handleAuthSuccess(envelope.payload);
    }
  };

  const handleMessage = (event: MessageEvent) => {
    const result = decodeInboundEnvelope(event.data as string);
    if (!result.ok) {
      console.warn('[WS] Rejected inbound message:', result.error, result.raw);
      return;
    }

    const { envelope } = result;
    if (envelope.kind === 'Ping') {
      sendHeartbeatPong(envelope.payload.timestamp);
      return;
    }

    console.debug('[WS] received envelope:', envelope.kind, envelope.payload);
    handleEnvelope(envelope);
  };

  return {
    sendHeartbeatPong,
    handleEnvelope,
    handleMessage,
  };
}
