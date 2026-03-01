import type { MutableRefObject } from 'react';
import type { OutboundEnvelope } from './gameSocketTypes';
import { RECONNECT_MANUAL_RETRY_MS, RECONNECT_MAX_DELAY_MS, WS_URL } from './gameSocketSession';
import { WS_HEARTBEAT_INTERVAL_MS } from '@/lib/constants';

interface GameSocketTransportRefs {
  wsRef: MutableRefObject<WebSocket | null>;
  pendingQueueRef: MutableRefObject<OutboundEnvelope[]>;
  heartbeatIntervalRef: MutableRefObject<number | null>;
  reconnectTimeoutRef: MutableRefObject<number | null>;
  reconnectAttemptRef: MutableRefObject<number>;
  reconnectStartedAtRef: MutableRefObject<number | null>;
  reconnectingRef: MutableRefObject<boolean>;
  shouldReconnectRef: MutableRefObject<boolean>;
  connectRef: MutableRefObject<() => void>;
  isAuthenticatedRef: MutableRefObject<boolean>;
  expectsResyncRef: MutableRefObject<boolean>;
  manualRetryTimerRef: MutableRefObject<number | null>;
}

interface GameSocketTransportSetters {
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  setReconnectAttempt: (attempt: number) => void;
  setIsReconnecting: (value: boolean) => void;
  setCanManualRetry: (value: boolean) => void;
}

interface GameSocketTransportCallbacks {
  onOpen: (ws: WebSocket) => void;
  onMessage: (event: MessageEvent, ws: WebSocket) => void;
  onError?: (event: Event) => void;
}

interface GameSocketTransportOptions {
  refs: GameSocketTransportRefs;
  setters: GameSocketTransportSetters;
  callbacks: GameSocketTransportCallbacks;
  getStoredSessionToken: () => string | null;
}

export interface GameSocketTransport {
  connect: () => void;
  disconnect: () => void;
  retryNow: () => void;
  send: (envelope: OutboundEnvelope) => void;
  sendRaw: (envelope: OutboundEnvelope) => boolean;
  flushPendingQueue: () => void;
  clearReconnectTimer: () => void;
  resetReconnectState: () => void;
  startHeartbeat: (sendHeartbeatPong: () => void) => void;
  stopHeartbeat: () => void;
}

export function createGameSocketTransport(
  options: GameSocketTransportOptions
): GameSocketTransport {
  const { refs, setters, callbacks, getStoredSessionToken } = options;

  const clearReconnectTimer = () => {
    if (refs.reconnectTimeoutRef.current) {
      clearTimeout(refs.reconnectTimeoutRef.current);
      refs.reconnectTimeoutRef.current = null;
    }
  };

  const resetReconnectState = () => {
    clearReconnectTimer();
    if (refs.manualRetryTimerRef.current) {
      clearTimeout(refs.manualRetryTimerRef.current);
      refs.manualRetryTimerRef.current = null;
    }
    refs.reconnectAttemptRef.current = 0;
    refs.reconnectStartedAtRef.current = null;
    refs.reconnectingRef.current = false;
    setters.setReconnectAttempt(0);
    setters.setIsReconnecting(false);
    setters.setCanManualRetry(false);
  };

  const sendRaw = (envelope: OutboundEnvelope): boolean => {
    if (refs.wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }
    refs.wsRef.current.send(JSON.stringify(envelope));
    return true;
  };

  const send = (envelope: OutboundEnvelope) => {
    if (!sendRaw(envelope)) {
      refs.pendingQueueRef.current.push(envelope);
    }
  };

  const flushPendingQueue = () => {
    if (refs.wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    const pending = refs.pendingQueueRef.current.splice(0);
    for (const envelope of pending) {
      refs.wsRef.current.send(JSON.stringify(envelope));
    }
  };

  const stopHeartbeat = () => {
    if (refs.heartbeatIntervalRef.current) {
      clearInterval(refs.heartbeatIntervalRef.current);
      refs.heartbeatIntervalRef.current = null;
    }
  };

  const startHeartbeat = (sendHeartbeatPong: () => void) => {
    refs.heartbeatIntervalRef.current = window.setInterval(
      sendHeartbeatPong,
      WS_HEARTBEAT_INTERVAL_MS
    );
  };

  const handleClose = (ws: WebSocket) => {
    if (refs.wsRef.current !== ws && refs.wsRef.current !== null) {
      return;
    }

    stopHeartbeat();
    setters.setConnectionState('disconnected');
    refs.wsRef.current = null;

    if (!refs.shouldReconnectRef.current) {
      resetReconnectState();
      return;
    }

    if (refs.reconnectStartedAtRef.current === null) {
      refs.reconnectStartedAtRef.current = Date.now();
    }

    refs.reconnectingRef.current = true;
    refs.expectsResyncRef.current =
      refs.isAuthenticatedRef.current || getStoredSessionToken() !== null;
    setters.setIsReconnecting(true);

    const nextAttempt = refs.reconnectAttemptRef.current + 1;
    refs.reconnectAttemptRef.current = nextAttempt;
    setters.setReconnectAttempt(nextAttempt);
    const backoffMs = Math.min(1000 * 2 ** (nextAttempt - 1), RECONNECT_MAX_DELAY_MS);

    const elapsed = refs.reconnectStartedAtRef.current
      ? Date.now() - refs.reconnectStartedAtRef.current
      : 0;
    const remainingMs = RECONNECT_MANUAL_RETRY_MS - elapsed;
    if (remainingMs <= 0) {
      setters.setCanManualRetry(true);
    } else if (!refs.manualRetryTimerRef.current) {
      refs.manualRetryTimerRef.current = window.setTimeout(() => {
        refs.manualRetryTimerRef.current = null;
        setters.setCanManualRetry(true);
      }, remainingMs);
    }

    refs.reconnectTimeoutRef.current = window.setTimeout(() => {
      if (refs.shouldReconnectRef.current) {
        refs.connectRef.current();
      }
    }, backoffMs);
  };

  const connect = () => {
    if (refs.wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    if (refs.wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setters.setConnectionState('connecting');
    clearReconnectTimer();

    const ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
      callbacks.onOpen(ws);
    });

    ws.addEventListener('message', (event) => {
      callbacks.onMessage(event, ws);
    });

    ws.addEventListener('error', (event) => {
      setters.setConnectionState('error');
      if (callbacks.onError) {
        callbacks.onError(event);
      }
    });

    ws.addEventListener('close', () => {
      handleClose(ws);
    });

    refs.wsRef.current = ws;
  };

  const retryNow = () => {
    if (!refs.reconnectingRef.current) {
      return;
    }
    clearReconnectTimer();
    connect();
  };

  const disconnect = () => {
    refs.shouldReconnectRef.current = false;
    refs.pendingQueueRef.current = [];
    if (refs.wsRef.current) {
      refs.wsRef.current.close();
      refs.wsRef.current = null;
    }
    stopHeartbeat();
    resetReconnectState();
    setters.setConnectionState('disconnected');
  };

  return {
    connect,
    disconnect,
    retryNow,
    send,
    sendRaw,
    flushPendingQueue,
    clearReconnectTimer,
    resetReconnectState,
    startHeartbeat,
    stopHeartbeat,
  };
}
