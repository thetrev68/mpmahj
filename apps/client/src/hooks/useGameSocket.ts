/**
 * useGameSocket Hook
 *
 * Manages WebSocket connection, authentication, and envelope messaging
 * with the game server.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import { buildAuthenticateEnvelope } from './gameSocketEnvelopes';
import { getStoredSeat, getStoredSessionToken } from './gameSocketSession';
import { createGameSocketTransport } from './gameSocketTransport';
import { createGameSocketProtocol } from './gameSocketProtocol';
import type {
  ConnectionState,
  CreateRoomEnvelope,
  EnvelopeListener,
  JoinRoomEnvelope,
  OutboundEnvelope,
  RecoveryAction,
  SocketLifecycleState,
  UseGameSocketOptions,
  UseGameSocketReturn,
} from './gameSocketTypes';

/**
 * Derives the named `SocketLifecycleState` from the flat state fields exposed
 * by this hook. This is a pure derivation — the source of truth for each
 * field remains in its own `useState`.
 *
 * Lifecycle precedence (highest wins):
 *   1. terminal_recovery — unrecoverable error, user must navigate away
 *   2. reconnecting      — connection lost, backoff retry running
 *   3. disconnected      — not connected, not retrying
 *   4. connecting        — WS connecting or awaiting AuthSuccess
 *   5. resync_pending    — authenticated after reconnect, awaiting StateSnapshot
 *   6. authenticated     — connected, auth complete, no pending resync
 */
function deriveLifecycleState(
  connectionState: ConnectionState,
  isReconnecting: boolean,
  resyncPending: boolean,
  recoveryAction: RecoveryAction
): SocketLifecycleState {
  if (recoveryAction !== 'none') return 'terminal_recovery';
  if (isReconnecting) return 'reconnecting';
  if (connectionState === 'disconnected') return 'disconnected';
  if (connectionState === 'connecting' || connectionState === 'error') return 'connecting';
  // connectionState === 'connected'
  if (resyncPending) return 'resync_pending';
  return 'authenticated';
}

export type {
  InboundEnvelope,
  OutboundEnvelope,
  SocketLifecycleState,
  UseGameSocketReturn,
} from './gameSocketTypes';

/**
 * Game Socket Hook
 *
 * @returns WebSocket connection interface
 */
export function useGameSocket(options: UseGameSocketOptions = {}): UseGameSocketReturn {
  const { enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<OutboundEnvelope[]>([]);
  const listenersRef = useRef<Map<string, Set<EnvelopeListener>>>(new Map());
  const heartbeatIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectStartedAtRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});
  const reconnectingRef = useRef(false);
  const expectsResyncRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const seatRef = useRef<Seat | null>(getStoredSeat());
  const manualRetryTimerRef = useRef<number | null>(null);
  const protocolRef = useRef<ReturnType<typeof createGameSocketProtocol> | null>(null);
  const transportRef = useRef<ReturnType<typeof createGameSocketTransport> | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  /**
   * Mirrors `expectsResyncRef` as React state so that the derived
   * `lifecycleState` can reflect the resync_pending phase in renders.
   * Set to true by the transport layer on connection drop (when a prior
   * session existed); cleared by the protocol layer on StateSnapshot arrival
   * or terminal error.
   */
  const [resyncPending, setResyncPending] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredSessionToken());
  const [seat, setSeatState] = useState<Seat | null>(() => getStoredSeat());
  const setSeat = useCallback((value: Seat | null) => {
    seatRef.current = value;
    setSeatState(value);
  }, []);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canManualRetry, setCanManualRetry] = useState(false);
  const [recoveryAction, setRecoveryAction] = useState<RecoveryAction>('none');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  const clearRecoveryAction = useCallback(() => {
    setRecoveryAction('none');
    setRecoveryMessage(null);
  }, []);

  const dismissReconnectedToast = useCallback(() => {
    setShowReconnectedToast(false);
  }, []);

  useEffect(() => {
    const transport = createGameSocketTransport({
      refs: {
        wsRef,
        pendingQueueRef,
        heartbeatIntervalRef,
        reconnectTimeoutRef,
        reconnectAttemptRef,
        reconnectStartedAtRef,
        reconnectingRef,
        shouldReconnectRef,
        connectRef,
        isAuthenticatedRef,
        expectsResyncRef,
        manualRetryTimerRef,
      },
      setters: {
        setConnectionState,
        setReconnectAttempt,
        setIsReconnecting,
        setCanManualRetry,
        setResyncPending,
      },
      callbacks: {
        onOpen: (ws) => {
          console.log('WebSocket connected');
          const token = getStoredSessionToken();
          ws.send(JSON.stringify(buildAuthenticateEnvelope(token)));
        },
        onMessage: (event) => {
          protocolRef.current?.handleMessage(event);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
        },
      },
      getStoredSessionToken,
    });

    const protocol = createGameSocketProtocol({
      refs: {
        listenersRef,
        expectsResyncRef,
        reconnectingRef,
        isAuthenticatedRef,
        seatRef,
      },
      setters: {
        setPlayerId,
        setSessionToken,
        setSeat,
        setConnectionState,
        setRecoveryAction,
        setRecoveryMessage,
        setShowReconnectedToast,
        setIsReconnecting,
        setResyncPending,
      },
      actions: {
        startHeartbeat: () => {
          transport.startHeartbeat(() => protocol.sendHeartbeatPong());
        },
        sendRaw: (envelope) => transport.sendRaw(envelope),
        flushPendingQueue: () => transport.flushPendingQueue(),
        resetReconnectState: () => transport.resetReconnectState(),
        getStoredSessionToken,
        setShouldReconnect: (value) => {
          shouldReconnectRef.current = value;
        },
      },
    });

    protocolRef.current = protocol;
    transportRef.current = transport;

    return () => {
      transport.disconnect();
      protocolRef.current = null;
      transportRef.current = null;
    };
  }, [setSeat]);

  const send = useCallback((envelope: OutboundEnvelope) => {
    transportRef.current?.send(envelope);
  }, []);

  const subscribe = useCallback((kind: string, listener: EnvelopeListener) => {
    if (!listenersRef.current.has(kind)) {
      listenersRef.current.set(kind, new Set());
    }
    listenersRef.current.get(kind)?.add(listener);

    return () => {
      listenersRef.current.get(kind)?.delete(listener);
      if (listenersRef.current.get(kind)?.size === 0) {
        listenersRef.current.delete(kind);
      }
    };
  }, []);

  const connect = useCallback(() => {
    transportRef.current?.connect();
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const retryNow = useCallback(() => {
    transportRef.current?.retryNow();
  }, []);

  const disconnect = useCallback(() => {
    transportRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    shouldReconnectRef.current = true;
    connect();
    return () => disconnect();
  }, [connect, disconnect, enabled]);

  const lifecycleState = deriveLifecycleState(
    connectionState,
    isReconnecting,
    resyncPending,
    recoveryAction
  );

  return {
    connectionState,
    lifecycleState,
    send,
    subscribe,
    connect,
    disconnect,
    playerId,
    sessionToken,
    seat,
    reconnectAttempt,
    isReconnecting,
    canManualRetry,
    retryNow,
    recoveryAction,
    recoveryMessage,
    clearRecoveryAction,
    showReconnectedToast,
    dismissReconnectedToast,
  };
}

/**
 * Helper: Create a CreateRoom envelope
 */
export function createRoomEnvelope(payload: CreateRoomEnvelope['payload']): CreateRoomEnvelope {
  return {
    kind: 'CreateRoom',
    payload,
  };
}

/**
 * Helper: Create a JoinRoom envelope
 */
export function createJoinRoomEnvelope(roomId: string): JoinRoomEnvelope {
  return {
    kind: 'JoinRoom',
    payload: {
      room_id: roomId,
    },
  };
}
