/**
 * Game WebSocket Hook
 *
 * Manages WebSocket connection to the game server.
 * Handles connection, authentication, message routing, and reconnection.
 *
 * RESPONSIBILITIES:
 * - Connect and authenticate
 * - Parse Message envelope
 * - Route Event to action queue
 * - Surface Error to UI
 * - Reconnect with exponential backoff
 * - Request state on reconnect
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { useActionQueue } from './useActionQueue';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Event } from '@/types/bindings/generated/Event';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

interface UseGameSocketOptions {
  url: string;
  gameId: string;
  playerId: string;
  authToken?: string;
  authMethod?: 'guest' | 'token' | 'jwt';
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

type Envelope =
  | {
      kind: 'Authenticate';
      payload: {
        method: 'guest' | 'token' | 'jwt';
        credentials?: { token: string };
        version: string;
      };
    }
  | {
      kind: 'AuthSuccess';
      payload: {
        player_id: string;
        display_name: string;
        session_token: string;
        room_id?: string | null;
        seat?: Seat | null;
      };
    }
  | { kind: 'AuthFailure'; payload: { reason: string } }
  | { kind: 'Command'; payload: { command: GameCommand } }
  | { kind: 'CreateRoom'; payload: CreateRoomPayload }
  | { kind: 'JoinRoom'; payload: { room_id: string } }
  | { kind: 'LeaveRoom'; payload: Record<string, never> }
  | { kind: 'CloseRoom'; payload: Record<string, never> }
  | { kind: 'Event'; payload: { event: Event } }
  | { kind: 'Error'; payload: { message: string } }
  | { kind: 'RoomJoined'; payload: { room_id: string; seat: Seat } }
  | { kind: 'RoomLeft'; payload: { room_id: string } }
  | { kind: 'RoomClosed'; payload: { room_id: string } }
  | { kind: 'RoomMemberLeft'; payload: { room_id: string; player_id: string; seat: Seat } }
  | { kind: 'StateSnapshot'; payload: { snapshot: GameStateSnapshot } }
  | { kind: 'Ping'; payload: { timestamp: string } }
  | { kind: 'Pong'; payload: { timestamp: string } };

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useGameSocket({
  url,
  gameId,
  authToken,
  authMethod = authToken ? 'token' : 'guest',
}: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const seatRef = useRef<Seat | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  const replaceFromSnapshot = useGameStore((state) => state.replaceFromSnapshot);
  const setYourSeat = useGameStore((state) => state.setYourSeat);
  const addError = useUIStore((state) => state.addError);
  const { enqueueEvent, clearQueue } = useActionQueue();

  /**
   * Send a message to the server
   */
  const sendMessage = useCallback((message: Envelope) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, []);

  /**
   * Send a command to the server
   */
  const sendCommand = useCallback(
    (command: GameCommand) => {
      return sendMessage({ kind: 'Command', payload: { command } });
    },
    [sendMessage]
  );

  const createRoom = useCallback(
    (
      payload: CreateRoomPayload = { card_year: 2025, bot_difficulty: null, fill_with_bots: false }
    ) => {
      return sendMessage({ kind: 'CreateRoom', payload });
    },
    [sendMessage]
  );

  const joinRoom = useCallback(
    (roomId: string) => {
      roomIdRef.current = roomId;
      return sendMessage({ kind: 'JoinRoom', payload: { room_id: roomId } });
    },
    [sendMessage]
  );

  const leaveRoom = useCallback(() => {
    roomIdRef.current = null;
    return sendMessage({ kind: 'LeaveRoom', payload: {} });
  }, [sendMessage]);

  const closeRoom = useCallback(() => {
    return sendMessage({ kind: 'CloseRoom', payload: {} });
  }, [sendMessage]);

  /**
   * Request current game state (for reconnect)
   */
  const requestState = useCallback(
    (seat: Seat | null) => {
      if (!seat) {
        console.warn('Cannot request state without assigned seat');
        return false;
      }
      const command: GameCommand = { RequestState: { player: seat } };
      return sendMessage({ kind: 'Command', payload: { command } });
    },
    [sendMessage]
  );

  /**
   * Handle incoming messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as Envelope;

        switch (message.kind) {
          case 'AuthSuccess':
            sessionTokenRef.current = message.payload.session_token;
            roomIdRef.current = message.payload.room_id ?? null;
            seatRef.current = message.payload.seat ?? null;
            setYourSeat(seatRef.current);
            if (message.payload.room_id && message.payload.seat) {
              requestState(message.payload.seat);
            } else if (gameId) {
              joinRoom(gameId);
            }
            break;

          case 'AuthFailure':
            addError(message.payload.reason);
            break;

          case 'Event':
            enqueueEvent(message.payload.event);
            break;

          case 'Error':
            addError(message.payload.message);
            console.error('Server error:', message.payload.message);
            break;

          case 'StateSnapshot':
            clearQueue();
            replaceFromSnapshot(message.payload.snapshot);
            break;

          case 'RoomJoined':
            roomIdRef.current = message.payload.room_id;
            seatRef.current = message.payload.seat;
            setYourSeat(message.payload.seat);
            requestState(message.payload.seat);
            break;

          case 'RoomLeft':
          case 'RoomClosed':
            roomIdRef.current = null;
            seatRef.current = null;
            setYourSeat(null);
            break;

          case 'RoomMemberLeft':
            break;

          case 'Ping':
            sendMessage({ kind: 'Pong', payload: { timestamp: message.payload.timestamp } });
            break;

          case 'Pong':
            break;

          default:
            console.warn('Unknown envelope kind:', message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    },
    [
      enqueueEvent,
      addError,
      clearQueue,
      replaceFromSnapshot,
      requestState,
      sendMessage,
      setYourSeat,
      gameId,
      joinRoom,
    ]
  );

  /**
   * Start ping interval
   */
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      sendMessage({ kind: 'Ping', payload: { timestamp: new Date().toISOString() } });
    }, 30000); // Ping every 30 seconds
  }, [sendMessage]);

  /**
   * Stop ping interval
   */
  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Calculate reconnect delay with exponential backoff
   */
  const getReconnectDelay = useCallback((attempt: number): number => {
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(
    function connectImpl() {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('Already connected');
        return;
      }

      setStatus((prev) => ({ ...prev, connecting: true, error: null }));

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setStatus({
            connected: true,
            connecting: false,
            error: null,
            reconnectAttempts: reconnectAttemptsRef.current,
          });

          const wasReconnect = reconnectAttemptsRef.current > 0;
          reconnectAttemptsRef.current = 0;

          const payload: Envelope = {
            kind: 'Authenticate',
            payload: {
              method: authMethod,
              credentials: authToken ? { token: authToken } : undefined,
              version: '1.0',
            },
          };
          sendMessage(payload);

          // Start ping
          startPing();

          // Request current state if this is a reconnect
          if (wasReconnect) {
            requestState(seatRef.current);
          }
        };

        ws.onmessage = handleMessage;

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus((prev) => ({
            ...prev,
            error: 'Connection error',
            connected: false,
          }));
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          stopPing();

          setStatus((prev) => ({
            ...prev,
            connected: false,
            connecting: false,
          }));

          // Attempt to reconnect unless it was a clean close
          if (event.code !== 1000) {
            // Reconnect after delay
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              const delay = getReconnectDelay(reconnectAttemptsRef.current);
              reconnectAttemptsRef.current += 1;

              setStatus((prev) => ({
                ...prev,
                reconnectAttempts: reconnectAttemptsRef.current,
                connecting: true,
              }));

              console.log(
                `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current})`
              );

              reconnectTimeoutRef.current = setTimeout(() => {
                // Recursive call to reconnect
                if (connectFnRef.current) {
                  connectFnRef.current();
                }
              }, delay);
            } else {
              setStatus((prev) => ({
                ...prev,
                error: 'Max reconnection attempts reached',
                connecting: false,
              }));
            }
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        setStatus((prev) => ({
          ...prev,
          error: 'Failed to create connection',
          connected: false,
          connecting: false,
        }));
      }
    },
    [
      url,
      authToken,
      authMethod,
      handleMessage,
      sendMessage,
      startPing,
      stopPing,
      requestState,
      getReconnectDelay,
    ]
  );

  // Store connect function reference for recursive calls
  useEffect(() => {
    connectFnRef.current = connect;
  }, [connect]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPing();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setStatus({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    });
  }, [stopPing]);

  // Auto-connect on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    sendCommand,
    sendMessage,
    requestState,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    connect,
    disconnect,
  };
}
