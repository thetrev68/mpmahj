/**
 * useGameEvents Hook
 *
 * Event bridge that connects WebSocket messages to pure event handlers.
 * Manages game state updates, UI state actions, and side effects.
 *
 * Features:
 * - WebSocket connection management
 * - Event handler dispatch
 * - State update orchestration
 * - Side effect execution
 * - Command sending
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 4
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useGameSocket, type Envelope } from './useGameSocket';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { EventHandlerResult, UIStateAction, SideEffect } from '@/lib/game-events/types';
import { handlePublicEvent } from '@/lib/game-events/publicEventHandlers';
import { handlePrivateEvent } from '@/lib/game-events/privateEventHandlers';
import { SideEffectManager } from '@/lib/game-events/sideEffectManager';

/**
 * Game events hook return type
 */
export interface UseGameEventsReturn {
  /** Current game state from server */
  gameState: GameStateSnapshot | null;
  /** Send a game command to the server */
  sendCommand: (command: GameCommand) => void;
  /** Event bus for UI components to subscribe to events */
  eventBus: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
    emit: (event: string, data: unknown) => void;
  };
}

type EventEnvelopePayload = {
  event: ServerEvent;
};

type StateSnapshotEnvelopePayload = {
  snapshot: GameStateSnapshot;
};

type ErrorEnvelopePayload = {
  code: string;
  message: string;
  context?: unknown;
};

/**
 * useGameEvents Hook
 *
 * @param initialState - Initial game state (from RoomJoined envelope)
 * @returns Game events interface
 */
export function useGameEvents(initialState: GameStateSnapshot | null): UseGameEventsReturn {
  const [gameState, setGameState] = useState<GameStateSnapshot | null>(initialState);
  const { send, subscribe } = useGameSocket();
  const gameStateRef = useRef<GameStateSnapshot | null>(initialState);
  const hasSubmittedPassRef = useRef(false);
  const callIntentsRef = useRef<CallIntentSummary[]>([]);
  const discardedByRef = useRef<Seat | null>(null);
  const sideEffectManagerRef = useRef<SideEffectManager>(new SideEffectManager());
  const eventBusRef = useRef<{
    listeners: Map<string, Set<(data: unknown) => void>>;
  }>({
    listeners: new Map(),
  });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize event bus
  const eventBus = useMemo(() => {
    const on = (event: string, handler: (data: unknown) => void) => {
      if (!eventBusRef.current.listeners.has(event)) {
        eventBusRef.current.listeners.set(event, new Set());
      }
      eventBusRef.current.listeners.get(event)?.add(handler);

      return () => {
        eventBusRef.current.listeners.get(event)?.delete(handler);
        if (eventBusRef.current.listeners.get(event)?.size === 0) {
          eventBusRef.current.listeners.delete(event);
        }
      };
    };

    const emit = (event: string, data: unknown) => {
      const listeners = eventBusRef.current.listeners.get(event);
      if (listeners) {
        listeners.forEach((handler) => handler(data));
      }
    };

    return { on, emit };
  }, []);

  // Send game command
  const sendCommand = useCallback(
    (command: GameCommand) => {
      const envelope: Envelope = {
        kind: 'GameCommand',
        payload: command,
      };
      send(envelope);
    },
    [send]
  );

  const updateLocalUiState = useCallback((action: UIStateAction) => {
    switch (action.type) {
      case 'SET_HAS_SUBMITTED_PASS':
        hasSubmittedPassRef.current = action.value;
        break;
      case 'RESET_CHARLESTON_STATE':
        hasSubmittedPassRef.current = false;
        break;
      case 'OPEN_CALL_WINDOW':
        discardedByRef.current = action.params.discardedBy;
        break;
      case 'UPDATE_CALL_WINDOW_PROGRESS':
        callIntentsRef.current = action.intents;
        break;
      case 'CLOSE_CALL_WINDOW':
        callIntentsRef.current = [];
        discardedByRef.current = null;
        break;
      default:
        break;
    }
  }, []);

  // Execute UI state actions
  const executeUIActions = useCallback(
    (actions: UIStateAction[]) => {
      actions.forEach((action) => {
        updateLocalUiState(action);
        eventBus.emit('ui-action', action);
      });
    },
    [eventBus, updateLocalUiState]
  );

  // Execute side effects
  const executeSideEffects = useCallback((effects: SideEffect[]) => {
    effects.forEach((effect) => {
      sideEffectManagerRef.current.execute(effect);
    });
  }, []);

  const applyHandlerResult = useCallback(
    (result: EventHandlerResult) => {
      if (result.stateUpdates.length > 0) {
        setGameState((prev) =>
          result.stateUpdates.reduce((state, updater) => updater(state), prev)
        );
      }

      if (result.uiActions.length > 0) {
        executeUIActions(result.uiActions);
      }

      if (result.sideEffects.length > 0) {
        executeSideEffects(result.sideEffects);
      }
    },
    [executeUIActions, executeSideEffects]
  );

  const handlePublicEventHandler = useCallback(
    (event: PublicEvent) => {
      const currentState = gameStateRef.current;
      const result: EventHandlerResult = handlePublicEvent(event, {
        gameState: currentState,
        yourSeat: currentState?.your_seat ?? null,
        callIntents: callIntentsRef.current,
        discardedBy: discardedByRef.current,
      });
      applyHandlerResult(result);
    },
    [applyHandlerResult]
  );

  const handlePrivateEventHandler = useCallback(
    (event: PrivateEvent) => {
      const result: EventHandlerResult = handlePrivateEvent(event, {
        gameState: gameStateRef.current,
        hasSubmittedPass: hasSubmittedPassRef.current,
      });
      applyHandlerResult(result);
    },
    [applyHandlerResult]
  );

  const handleEventEnvelope = useCallback(
    (envelope: Envelope) => {
      const payload = envelope.payload as EventEnvelopePayload | undefined;
      if (!payload?.event) return;

      const event = payload.event;
      if (typeof event !== 'object' || event === null) return;

      if ('Public' in event) {
        handlePublicEventHandler(event.Public);
      }

      if ('Private' in event) {
        handlePrivateEventHandler(event.Private);
      }
    },
    [handlePrivateEventHandler, handlePublicEventHandler]
  );

  const handleStateSnapshotEnvelope = useCallback((envelope: Envelope) => {
    const payload = envelope.payload as StateSnapshotEnvelopePayload | undefined;
    if (payload?.snapshot) {
      setGameState(payload.snapshot);
    }
  }, []);

  const handleErrorEnvelope = useCallback(
    (envelope: Envelope) => {
      const payload = envelope.payload as ErrorEnvelopePayload | undefined;
      if (!payload?.message) return;

      executeUIActions([{ type: 'SET_ERROR_MESSAGE', message: payload.message }]);
      executeSideEffects([
        {
          type: 'TIMEOUT',
          id: 'error-message',
          ms: 3000,
          callback: () => {
            eventBus.emit('ui-action', { type: 'SET_ERROR_MESSAGE', message: null });
          },
        },
      ]);
    },
    [executeSideEffects, executeUIActions, eventBus]
  );

  useEffect(() => {
    const unsubscribeEvent = subscribe('Event', handleEventEnvelope);
    const unsubscribeState = subscribe('StateSnapshot', handleStateSnapshotEnvelope);
    const unsubscribeError = subscribe('Error', handleErrorEnvelope);
    const sideEffectManager = sideEffectManagerRef.current;

    return () => {
      unsubscribeEvent();
      unsubscribeState();
      unsubscribeError();
      sideEffectManager.cleanup();
    };
  }, [subscribe, handleEventEnvelope, handleStateSnapshotEnvelope, handleErrorEnvelope]);

  return {
    gameState,
    sendCommand,
    eventBus,
  };
}
