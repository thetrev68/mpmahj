/**
 * useGameSocket Hook
 *
 * Manages WebSocket connection, authentication, and envelope messaging
 * with the game server.
 *
 * Features:
 * - Auto-connect with guest authentication
 * - Envelope send/receive with type safety
 * - Connection state management
 * - Automatic reconnection
 * - Event subscription system
 * - Heartbeat handling to prevent timeouts
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * WebSocket Envelope types
 */
export interface Envelope {
  kind: string;
  payload?: unknown;
}

export interface CreateRoomEnvelope {
  kind: 'CreateRoom';
  payload: CreateRoomPayload;
}

export interface JoinRoomEnvelope {
  kind: 'JoinRoom';
  payload: {
    room_id: string;
  };
}

export interface RoomJoinedEnvelope {
  kind: 'RoomJoined';
  payload: {
    room_id: string;
    seat: Seat;
  };
}

export interface ErrorEnvelope {
  kind: 'Error';
  payload: {
    code: string;
    message: string;
    context?: unknown;
  };
}

export interface AuthSuccessEnvelope {
  kind: 'AuthSuccess';
  payload: {
    player_id: string;
    display_name: string;
    session_token: string;
    room_id?: string;
    seat?: Seat;
  };
}

export interface AuthenticateEnvelope {
  kind: 'Authenticate';
  payload: {
    method: 'guest' | 'token' | 'jwt';
    credentials?: { token: string };
    version: string;
  };
}

/**
 * Connection states
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type RecoveryAction = 'none' | 'return_login' | 'return_lobby';

/**
 * Envelope listener callback
 */
export type EnvelopeListener = (envelope: Envelope) => void;

/**
 * useGameSocket hook return type
 */
export interface UseGameSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Send an envelope to the server */
  send: (envelope: Envelope) => void;
  /** Subscribe to envelopes of a specific kind */
  subscribe: (kind: string, listener: EnvelopeListener) => () => void;
  /** Manually connect (auto-connects by default) */
  connect: () => void;
  /** Disconnect from server */
  disconnect: () => void;
  /** Current player ID (after auth) */
  playerId: string | null;
  /** Session token (for reconnection) */
  sessionToken: string | null;
  /** Current seat, if known */
  seat: Seat | null;
  /** Current reconnect attempt number */
  reconnectAttempt: number;
  /** True while auto-reconnect cycle is active */
  isReconnecting: boolean;
  /** True when manual retry should be shown */
  canManualRetry: boolean;
  /** Retry reconnect immediately */
  retryNow: () => void;
  /** Recovery target for terminal reconnect failures */
  recoveryAction: RecoveryAction;
  /** Error message associated with recoveryAction */
  recoveryMessage: string | null;
  /** Clear recovery action/message */
  clearRecoveryAction: () => void;
  /** True when a reconnect just succeeded */
  showReconnectedToast: boolean;
  /** Dismiss reconnect success toast */
  dismissReconnectedToast: () => void;
}

/**
 * WebSocket URL (from env or default to localhost)
 */
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
const SESSION_TOKEN_KEY = 'session_token';
const SESSION_SEAT_KEY = 'session_seat';
const RECONNECT_MANUAL_RETRY_MS = 30_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

function isSeat(value: unknown): value is Seat {
  return value === 'East' || value === 'South' || value === 'West' || value === 'North';
}

/**
 * Game Socket Hook
 *
 * @returns WebSocket connection interface
 */
export function useGameSocket(): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<Envelope[]>([]);
  const listenersRef = useRef<Map<string, Set<EnvelopeListener>>>(new Map());
  const heartbeatIntervalRef = useRef<number | null>(null);
  const pingTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectStartedAtRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
  const connectRef = useRef<() => void>(() => {});
  const reconnectingRef = useRef(false);
  const expectsResyncRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  // seatRef mirrors the seat state so handleEnvelope can read the current seat without
  // being listed as a dependency (which would cause connect to recreate on every seat update
  // and trigger an unintended disconnect/reconnect cycle from the mount useEffect).
  const seatRef = useRef<Seat | null>(
    (() => {
      const stored = localStorage.getItem(SESSION_SEAT_KEY);
      return isSeat(stored) ? stored : null;
    })()
  );
  // Timer ref for showing the manual-retry button after RECONNECT_MANUAL_RETRY_MS.
  const manualRetryTimerRef = useRef<number | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => localStorage.getItem(SESSION_TOKEN_KEY) ?? null
  );
  const [seat, setSeatState] = useState<Seat | null>(() => {
    const storedSeat = localStorage.getItem(SESSION_SEAT_KEY);
    return isSeat(storedSeat) ? storedSeat : null;
  });
  // Wrapper that keeps seatRef in sync so closures can read current seat without stale refs.
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

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const resetReconnectState = useCallback(() => {
    clearReconnectTimer();
    if (manualRetryTimerRef.current) {
      clearTimeout(manualRetryTimerRef.current);
      manualRetryTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    reconnectStartedAtRef.current = null;
    reconnectingRef.current = false;
    setReconnectAttempt(0);
    setIsReconnecting(false);
    setCanManualRetry(false);
  }, [clearReconnectTimer]);

  /**
   * Send a ping message to the server
   */
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ kind: 'Ping' }));
      // Set timeout to wait for pong
      pingTimeoutRef.current = window.setTimeout(() => {
        console.error('Ping timeout - closing connection');
        wsRef.current?.close();
      }, 10000); // 10 second timeout
    }
  }, []);

  /**
   * Start heartbeat interval
   */
  const startHeartbeat = useCallback(() => {
    // Send ping every 25 seconds to ensure we stay within server's 60 second timeout
    heartbeatIntervalRef.current = window.setInterval(sendPing, 25000);
  }, [sendPing]);

  /**
   * Stop heartbeat interval
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Send an envelope to the server
   */
  const send = useCallback((envelope: Envelope) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(envelope));
    } else {
      // Queue the message — it will be flushed once authentication succeeds.
      pendingQueueRef.current.push(envelope);
    }
  }, []);

  /**
   * Handle incoming envelope
   */
  const handleEnvelope = useCallback(
    (envelope: Envelope) => {
      if (envelope.kind === 'AuthFailure') {
        const payload = envelope.payload as { message?: string } | undefined;
        console.error('AuthFailure:', payload?.message);
        // If a stale token caused the failure, clear it so the next reconnect uses guest auth.
        if (localStorage.getItem(SESSION_TOKEN_KEY)) {
          localStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.removeItem(SESSION_SEAT_KEY);
          setSessionToken(null);
          setSeat(null);
        } else {
          // Even guest auth failed — stop the reconnect loop to avoid hammering the server.
          shouldReconnectRef.current = false;
          resetReconnectState();
        }
      }

      if (envelope.kind === 'RoomJoined') {
        const payload = envelope.payload as RoomJoinedEnvelope['payload'] | undefined;
        if (payload && isSeat(payload.seat)) {
          setSeat(payload.seat);
          localStorage.setItem(SESSION_SEAT_KEY, payload.seat);
        }
      }

      if (envelope.kind === 'StateSnapshot') {
        const payload = envelope.payload as { snapshot?: { your_seat?: unknown } } | undefined;
        const snapshotSeat = payload?.snapshot?.your_seat;
        if (isSeat(snapshotSeat)) {
          setSeat(snapshotSeat);
          localStorage.setItem(SESSION_SEAT_KEY, snapshotSeat);
          expectsResyncRef.current = false;
        } else if (expectsResyncRef.current) {
          setRecoveryAction('return_lobby');
          setRecoveryMessage('Unable to restore seat');
          expectsResyncRef.current = false;
        }
      }

      if (envelope.kind === 'Error') {
        const payload = envelope.payload as ErrorEnvelope['payload'] | undefined;
        if (payload) {
          const code = payload.code?.toLowerCase() ?? '';
          const message = payload.message?.toLowerCase() ?? '';
          const authError =
            code.includes('auth') ||
            code.includes('token') ||
            code.includes('unauthorized') ||
            message.includes('auth') ||
            message.includes('token') ||
            message.includes('expired') ||
            message.includes('unauthorized');

          if (authError) {
            localStorage.removeItem(SESSION_TOKEN_KEY);
            localStorage.removeItem(SESSION_SEAT_KEY);
            setSessionToken(null);
            setSeat(null);
            setRecoveryAction('return_login');
            setRecoveryMessage(payload.message);
            shouldReconnectRef.current = false;
            expectsResyncRef.current = false;
            resetReconnectState();
          } else if (
            expectsResyncRef.current &&
            (code.includes('not_found') ||
              message.includes('not found') ||
              message.includes('game ended') ||
              message.includes('room no longer exists'))
          ) {
            setRecoveryAction('return_lobby');
            setRecoveryMessage(payload.message);
            expectsResyncRef.current = false;
          }
        }
      }

      // Call all listeners subscribed to this envelope kind
      const listeners = listenersRef.current.get(envelope.kind);
      if (listeners) {
        listeners.forEach((listener) => listener(envelope));
      }

      // Call wildcard listeners (subscribed to '*')
      const wildcardListeners = listenersRef.current.get('*');
      if (wildcardListeners) {
        wildcardListeners.forEach((listener) => listener(envelope));
      }

      // Handle auth success
      if (envelope.kind === 'AuthSuccess') {
        const payload = envelope.payload as AuthSuccessEnvelope['payload'];
        setPlayerId(payload.player_id);
        setSessionToken(payload.session_token);
        localStorage.setItem(SESSION_TOKEN_KEY, payload.session_token);
        isAuthenticatedRef.current = true;

        if (payload.seat && isSeat(payload.seat)) {
          setSeat(payload.seat);
          localStorage.setItem(SESSION_SEAT_KEY, payload.seat);
        }

        setConnectionState('connected');
        startHeartbeat(); // Start heartbeat after successful authentication

        // Flush any messages that were queued while the connection was establishing.
        const pending = pendingQueueRef.current.splice(0);
        for (const env of pending) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(env));
          }
        }

        if (reconnectingRef.current) {
          setShowReconnectedToast(true);
          setIsReconnecting(false);
        }

        if (expectsResyncRef.current) {
          const resyncSeat = payload.seat && isSeat(payload.seat) ? payload.seat : seatRef.current;
          if (resyncSeat) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  kind: 'Command',
                  payload: {
                    command: {
                      RequestState: {
                        player: resyncSeat,
                      },
                    },
                  },
                })
              );
            } else {
              console.warn('Cannot request state: WebSocket not open');
              setRecoveryAction('return_lobby');
              setRecoveryMessage('Unable to restore connection');
              expectsResyncRef.current = false;
              return;
            }
          } else {
            setRecoveryAction('return_lobby');
            setRecoveryMessage('Unable to restore seat');
            expectsResyncRef.current = false;
          }
        }

        resetReconnectState();
      }
    },
    [resetReconnectState, setSeat, startHeartbeat]
  );

  /**
   * Subscribe to envelopes of a specific kind
   */
  const subscribe = useCallback((kind: string, listener: EnvelopeListener) => {
    if (!listenersRef.current.has(kind)) {
      listenersRef.current.set(kind, new Set());
    }
    listenersRef.current.get(kind)?.add(listener);

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(kind)?.delete(listener);
      if (listenersRef.current.get(kind)?.size === 0) {
        listenersRef.current.delete(kind);
      }
    };
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return; // Already connecting
    }

    setConnectionState('connecting');
    clearReconnectTimer();

    const ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
      console.log('WebSocket connected');
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      const authEnvelope: AuthenticateEnvelope = {
        kind: 'Authenticate',
        payload: {
          method: token ? 'token' : 'guest',
          credentials: token ? { token } : undefined,
          version: '1.0',
        },
      };
      ws.send(JSON.stringify(authEnvelope));
    });

    ws.addEventListener('message', (event) => {
      try {
        const envelope = JSON.parse(event.data) as Envelope;

        // Handle pong response to our ping
        if (envelope.kind === 'Pong') {
          if (pingTimeoutRef.current) {
            clearTimeout(pingTimeoutRef.current);
            pingTimeoutRef.current = null;
          }
          return;
        }

        // Handle ping from server - respond with pong
        if (envelope.kind === 'Ping') {
          const payload = envelope.payload as { timestamp: string } | undefined;
          if (payload && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                kind: 'Pong',
                payload: { timestamp: payload.timestamp },
              })
            );
          }
          return;
        }

        console.debug('[WS] received envelope:', envelope.kind, envelope.payload);
        handleEnvelope(envelope);
      } catch (error) {
        console.error('Failed to parse envelope:', error);
      }
    });

    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionState('error');
    });

    ws.addEventListener('close', (event) => {
      console.log('WebSocket closed:', event.code, event.reason);

      // Guard: if this WS instance has already been replaced (e.g. by React
      // StrictMode's double-invoke creating a new connection before this close
      // event fires), do not touch shared state or schedule a reconnect.
      if (wsRef.current !== ws && wsRef.current !== null) {
        return;
      }

      stopHeartbeat();
      setConnectionState('disconnected');
      wsRef.current = null;

      if (!shouldReconnectRef.current) {
        resetReconnectState();
        return;
      }

      if (reconnectStartedAtRef.current === null) {
        reconnectStartedAtRef.current = Date.now();
      }
      reconnectingRef.current = true;
      expectsResyncRef.current =
        isAuthenticatedRef.current || !!localStorage.getItem(SESSION_TOKEN_KEY);
      setIsReconnecting(true);

      const nextAttempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = nextAttempt;
      setReconnectAttempt(nextAttempt);
      const backoffMs = Math.min(1000 * 2 ** (nextAttempt - 1), RECONNECT_MAX_DELAY_MS);

      // Schedule the manual-retry button to appear after RECONNECT_MANUAL_RETRY_MS from when
      // reconnecting started (not from when this particular attempt failed). This ensures the
      // button appears even during long backoff wait periods, not only on the next close event.
      const elapsed = reconnectStartedAtRef.current
        ? Date.now() - reconnectStartedAtRef.current
        : 0;
      const remainingMs = RECONNECT_MANUAL_RETRY_MS - elapsed;
      if (remainingMs <= 0) {
        setCanManualRetry(true);
      } else if (!manualRetryTimerRef.current) {
        manualRetryTimerRef.current = window.setTimeout(() => {
          manualRetryTimerRef.current = null;
          setCanManualRetry(true);
        }, remainingMs);
      }

      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (shouldReconnectRef.current) {
          connectRef.current();
        }
      }, backoffMs);
    });

    wsRef.current = ws;
  }, [clearReconnectTimer, handleEnvelope, resetReconnectState, stopHeartbeat]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const retryNow = useCallback(() => {
    if (!isReconnecting) {
      return;
    }
    clearReconnectTimer();
    connect();
  }, [clearReconnectTimer, connect, isReconnecting]);

  /**
   * Disconnect from server
   */
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    pendingQueueRef.current = [];
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopHeartbeat();
    resetReconnectState();
    setConnectionState('disconnected');
  }, [resetReconnectState, stopHeartbeat]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    shouldReconnectRef.current = true;
    // WebSocket connection is an external system; initiating it on mount is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connectionState,
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
export function createRoomEnvelope(payload: CreateRoomPayload): CreateRoomEnvelope {
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
