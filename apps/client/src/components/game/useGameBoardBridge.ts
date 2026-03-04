import { useCallback, useMemo } from 'react';
import { useGameEvents, type UseGameEventsReturn } from '@/hooks/useGameEvents';
import { decodeInboundEnvelope } from '@/hooks/gameSocketDecoder';
import type {
  InboundEnvelope,
  OutboundEnvelope,
  SocketLifecycleState,
  UseGameSocketReturn,
} from '@/hooks/useGameSocket';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { ClientGameState } from '@/types/clientGameState';

export interface WebSocketLike {
  send: (data: string) => void;
  addEventListener: (type: string, handler: (e: MessageEvent) => void) => void;
  removeEventListener: (type: string, handler: (e: MessageEvent) => void) => void;
}

export interface UseGameBoardBridgeOptions {
  ws?: WebSocketLike;
  socketClient: UseGameSocketReturn;
  /**
   * Initial game state for offline / test scenarios.
   * Accepts a raw server snapshot; the derivation boundary in useGameEvents
   * converts it to ClientGameState on first render.
   */
  initialState?: GameStateSnapshot;
}

export interface UseGameBoardBridgeReturn {
  eventBridgeResult: UseGameEventsReturn;
  /** Derived client game state, ready for consumption by the UI layer. */
  gameState: ClientGameState | null;
  usingInternalSocket: boolean;
  interactionsDisabled: boolean;
  sendCommand: (command: GameCommand) => void;
  /**
   * Socket lifecycle state forwarded from socketClient. 'authenticated' means
   * the connection is up, auth has completed, and any pending resync is done.
   * Equals 'authenticated' when using an injected ws (offline / test mode).
   */
  lifecycleState: SocketLifecycleState;
}

export function useGameBoardBridge({
  ws,
  socketClient,
  initialState,
}: UseGameBoardBridgeOptions): UseGameBoardBridgeReturn {
  const eventBridgeSocket = useMemo(() => {
    if (ws) {
      const socket = ws;
      return {
        send: (envelope: OutboundEnvelope) => {
          socket.send(JSON.stringify(envelope));
        },
        subscribe: (kind: string, listener: (envelope: InboundEnvelope) => void) => {
          const handler = (event: MessageEvent) => {
            const result = decodeInboundEnvelope(event.data as string);
            if (!result.ok) {
              console.warn('[WS] Rejected inbound message:', result.error, result.raw);
              return;
            }
            if (result.envelope.kind === kind) {
              listener(result.envelope);
            }
          };
          socket.addEventListener('message', handler);
          return () => socket.removeEventListener('message', handler);
        },
      };
    }

    return {
      send: socketClient.send,
      subscribe: socketClient.subscribe,
    };
  }, [ws, socketClient.send, socketClient.subscribe]);

  const eventBridgeResult = useGameEvents({
    socket: eventBridgeSocket,
    initialState: initialState || null,
    debug: import.meta.env.DEV,
    enabled: true,
  });

  const gameState = eventBridgeResult.gameState;
  const usingInternalSocket = !ws;
  // Interactions are disabled until the socket is fully authenticated and any
  // pending state resync has completed. This covers connecting, reconnecting,
  // and resync_pending in addition to the plain disconnected case.
  const interactionsDisabled =
    usingInternalSocket && socketClient.lifecycleState !== 'authenticated';
  // Forward the socket lifecycle state so consumers can react to it without
  // reaching into socketClient directly. Falls back to 'authenticated' when
  // using an injected ws (test / offline mode).
  const lifecycleState: SocketLifecycleState = usingInternalSocket
    ? socketClient.lifecycleState
    : 'authenticated';

  const sendCommand = useCallback(
    (command: GameCommand) => {
      if (usingInternalSocket && socketClient.connectionState !== 'connected') {
        return;
      }
      eventBridgeResult.sendCommand(command);
    },
    [usingInternalSocket, socketClient.connectionState, eventBridgeResult]
  );

  return {
    eventBridgeResult,
    gameState,
    usingInternalSocket,
    interactionsDisabled,
    sendCommand,
    lifecycleState,
  };
}
