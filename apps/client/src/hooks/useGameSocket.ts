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
import type { ServerMessage, ClientMessage, Command } from '@/types/bindings';

interface UseGameSocketOptions {
  url: string;
  gameId: string;
  playerId: string;
  authToken?: string;
}

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useGameSocket({ url, gameId, playerId, authToken }: UseGameSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  const replaceFromSnapshot = useGameStore((state) => state.replaceFromSnapshot);
  const addError = useUIStore((state) => state.addError);
  const { enqueueEvent, clearQueue } = useActionQueue();

  /**
   * Send a message to the server
   */
  const sendMessage = useCallback((message: ClientMessage) => {
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
    (command: Command) => {
      return sendMessage({ type: 'Command', command });
    },
    [sendMessage],
  );

  /**
   * Request current game state (for reconnect)
   */
  const requestState = useCallback(() => {
    return sendMessage({ type: 'RequestState' });
  }, [sendMessage]);

  /**
   * Handle incoming messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'Event':
            // Route to action queue for animation and state update
            enqueueEvent(message.event);
            break;

          case 'Error':
            // Display error to user
            addError(message.message);
            console.error('Server error:', message.message);
            break;

          case 'StateSnapshot':
            // Reconnect: replace entire state
            clearQueue();
            replaceFromSnapshot(message.snapshot);
            break;

          case 'Pong':
            // Pong received, connection is alive
            break;

          default:
            console.warn('Unknown message type:', message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    },
    [enqueueEvent, addError, clearQueue, replaceFromSnapshot],
  );

  /**
   * Start ping interval
   */
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'Ping', timestamp: Date.now() });
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
  const connect = useCallback(function connectImpl() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    setStatus((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      // Build WebSocket URL with auth
      const wsUrl = new URL(url);
      wsUrl.searchParams.set('game_id', gameId);
      wsUrl.searchParams.set('player_id', playerId);
      if (authToken) {
        wsUrl.searchParams.set('token', authToken);
      }

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus({
          connected: true,
          connecting: false,
          error: null,
          reconnectAttempts: reconnectAttemptsRef.current,
        });

        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;

        // Start ping
        startPing();

        // Request current state if this is a reconnect
        if (reconnectAttemptsRef.current > 0) {
          requestState();
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
              `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current})`,
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
  }, [url, gameId, playerId, authToken, handleMessage, startPing, stopPing, requestState, getReconnectDelay]);

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
    connect,
    disconnect,
  };
}
