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
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Difficulty } from '@/types/bindings/generated/Difficulty';
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
    seat?: string;
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
}

/**
 * WebSocket URL (from env or default to localhost)
 */
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

/**
 * Game Socket Hook
 *
 * @returns WebSocket connection interface
 */
export function useGameSocket(): UseGameSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EnvelopeListener>>>(new Map());

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  /**
   * Send an envelope to the server
   */
  const send = useCallback((envelope: Envelope) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(envelope));
    } else {
      console.warn('Cannot send envelope: WebSocket not open', envelope);
    }
  }, []);

  /**
   * Handle incoming envelope
   */
  const handleEnvelope = useCallback((envelope: Envelope) => {
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
      setConnectionState('connected');
    }
  }, []);

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

    setConnectionState('connecting');

    const ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
      console.log('WebSocket connected');
      // Send guest authentication
      const authEnvelope: AuthenticateEnvelope = {
        kind: 'Authenticate',
        payload: {
          method: 'guest',
          version: '1.0',
        },
      };
      ws.send(JSON.stringify(authEnvelope));
    });

    ws.addEventListener('message', (event) => {
      try {
        const envelope = JSON.parse(event.data) as Envelope;
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
      setConnectionState('disconnected');
    });

    wsRef.current = ws;
  }, [handleEnvelope]);

  /**
   * Disconnect from server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    // Connecting to external WebSocket system on mount is the correct use of effects
    /* eslint-disable react-hooks/set-state-in-effect */
    connect();
    /* eslint-enable react-hooks/set-state-in-effect */
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
  };
}

/**
 * Helper: Create a CreateRoom envelope
 */
export function createRoomEnvelope(
  roomName: string,
  cardYear: number = 2025,
  fillWithBots: boolean = false,
  botDifficulty: Difficulty | null = null
): CreateRoomEnvelope {
  return {
    kind: 'CreateRoom',
    payload: {
      room_name: roomName,
      card_year: cardYear,
      fill_with_bots: fillWithBots,
      bot_difficulty: botDifficulty,
    },
  };
}

/**
 * Helper: Create a JoinRoom envelope
 */
export function createJoinRoomEnvelope(
  roomId: string
): JoinRoomEnvelope {
  return {
    kind: 'JoinRoom',
    payload: {
      room_id: roomId,
    },
  };
}
