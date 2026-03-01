import type { MutableRefObject } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import { isAuthErrorPayload, isResyncNotFoundPayload } from './gameSocketRecovery';
import { buildRequestStateEnvelope } from './gameSocketEnvelopes';
import { clearStoredSession, isSeat, persistSeat, persistSessionToken } from './gameSocketSession';
import { decodeInboundEnvelope } from './gameSocketDecoder';
import type {
  AuthSuccessEnvelope,
  EnvelopeListener,
  InboundEnvelope,
  OutboundEnvelope,
  RecoveryAction,
} from './gameSocketTypes';

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
          setters.setRecoveryAction('return_lobby');
          setters.setRecoveryMessage('Unable to restore connection');
          refs.expectsResyncRef.current = false;
          return;
        }
      } else {
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage('Unable to restore seat');
        refs.expectsResyncRef.current = false;
      }
    } else if (payload.room_id && authSeat) {
      actions.sendRaw(buildRequestStateEnvelope(authSeat));
    }

    actions.resetReconnectState();
  };

  const handleEnvelope = (envelope: InboundEnvelope) => {
    if (envelope.kind === 'AuthFailure') {
      console.error('AuthFailure:', envelope.payload?.message);
      if (actions.getStoredSessionToken()) {
        clearStoredSession();
        setters.setSessionToken(null);
        setters.setSeat(null);
      } else {
        actions.setShouldReconnect(false);
        actions.resetReconnectState();
      }
    }

    if (envelope.kind === 'RoomJoined') {
      if (isSeat(envelope.payload.seat)) {
        setters.setSeat(envelope.payload.seat);
        persistSeat(envelope.payload.seat);
      }
    }

    if (envelope.kind === 'StateSnapshot') {
      const snapshotSeat = envelope.payload.snapshot.your_seat;
      if (isSeat(snapshotSeat)) {
        setters.setSeat(snapshotSeat);
        persistSeat(snapshotSeat);
        refs.expectsResyncRef.current = false;
      } else if (refs.expectsResyncRef.current) {
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage('Unable to restore seat');
        refs.expectsResyncRef.current = false;
      }
    }

    if (envelope.kind === 'Error') {
      const payload = envelope.payload;
      if (isAuthErrorPayload(payload)) {
        clearStoredSession();
        setters.setSessionToken(null);
        setters.setSeat(null);
        setters.setRecoveryAction('return_login');
        setters.setRecoveryMessage(payload.message);
        actions.setShouldReconnect(false);
        refs.expectsResyncRef.current = false;
        actions.resetReconnectState();
      } else if (refs.expectsResyncRef.current && isResyncNotFoundPayload(payload)) {
        setters.setRecoveryAction('return_lobby');
        setters.setRecoveryMessage(payload.message);
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
