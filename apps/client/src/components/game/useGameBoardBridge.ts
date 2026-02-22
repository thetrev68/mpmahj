import { useCallback, useEffect, useMemo } from 'react';
import { useGameEvents, type UseGameEventsReturn } from '@/hooks/useGameEvents';
import type { Envelope, UseGameSocketReturn } from '@/hooks/useGameSocket';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';

interface WebSocketLike {
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  removeEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
}

export interface UseGameBoardBridgeOptions {
  ws?: WebSocketLike;
  socketClient: UseGameSocketReturn;
  initialState?: GameStateSnapshot;
  dispatchUIAction: (action: UIStateAction) => void;
  currentRoom: { room_id: string } | null;
}

export interface UseGameBoardBridgeReturn {
  eventBridgeResult: UseGameEventsReturn;
  gameState: GameStateSnapshot | null;
  usingInternalSocket: boolean;
  interactionsDisabled: boolean;
  sendCommand: (command: GameCommand) => void;
}

function buildRequestStateEnvelope(seat: Seat): Envelope {
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

export function useGameBoardBridge({
  ws,
  socketClient,
  initialState,
  dispatchUIAction,
  currentRoom,
}: UseGameBoardBridgeOptions): UseGameBoardBridgeReturn {
  const eventBridgeSocket = useMemo(() => {
    if (ws) {
      const socket = ws;
      return {
        send: (envelope: Envelope) => {
          socket.send(JSON.stringify(envelope));
        },
        subscribe: (kind: string, listener: (envelope: Envelope) => void) => {
          const handler = (event: MessageEvent) => {
            try {
              const envelope = JSON.parse(event.data) as Envelope;
              if (envelope.kind === kind) {
                listener(envelope);
              }
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
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
    dispatchUIAction,
    debug: import.meta.env.DEV,
    enabled: true,
  });

  const gameState = eventBridgeResult.gameState;
  const usingInternalSocket = !ws;
  const interactionsDisabled = usingInternalSocket && socketClient.connectionState !== 'connected';

  useEffect(() => {
    if (!usingInternalSocket || !currentRoom || gameState) {
      return;
    }
    if (socketClient.connectionState !== 'connected' || !socketClient.seat) {
      return;
    }
    const seat = socketClient.seat;

    let attempts = 0;
    const maxAttempts = 8;
    const requestState = () => {
      if (attempts >= maxAttempts) {
        return;
      }
      attempts += 1;
      socketClient.send(buildRequestStateEnvelope(seat));
    };

    requestState();
    const timer = window.setInterval(requestState, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentRoom,
    gameState,
    socketClient.connectionState,
    socketClient.seat,
    socketClient.send,
    usingInternalSocket,
  ]);

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
  };
}
