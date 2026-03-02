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
import type { InboundEnvelope, OutboundEnvelope } from './useGameSocket';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { EventHandlerResult, UIStateAction, SideEffect } from '@/lib/game-events/types';
import type { ClientGameState } from '@/types/clientGameState';
import { deriveClientGameView } from '@/lib/game-state/deriveClientGameView';
import { handlePublicEvent } from '@/lib/game-events/publicEventHandlers';
import { handlePrivateEvent } from '@/lib/game-events/privateEventHandlers';
import { SideEffectManager } from '@/lib/game-events/sideEffectManager';
import { useSoundEffects } from './useSoundEffects';
import type { SoundEffect } from './useSoundEffects';
import { useGameUIStore } from '@/stores/gameUIStore';

/**
 * Game events hook options
 */
export interface UseGameEventsOptions {
  /** WebSocket socket interface */
  socket: {
    send: (envelope: OutboundEnvelope) => void;
    subscribe: (kind: string, listener: (envelope: InboundEnvelope) => void) => () => void;
  };
  /**
   * Initial game state (for testing / offline scenarios).
   * Accepts a raw server snapshot; it is passed through the derivation boundary
   * on first render so callers do not need to pre-derive.
   */
  initialState?: GameStateSnapshot | null;
  /** UI state dispatcher (receives UIStateActions from handlers) */
  dispatchUIAction: (action: UIStateAction) => void;
  /** Enable debug logging */
  debug?: boolean;
  /** Enable event bridge subscriptions */
  enabled?: boolean;
}

/**
 * Game events hook return type
 */
export interface UseGameEventsReturn {
  /**
   * Current client game state derived from the latest server snapshot.
   * Server-owned fields plus client-extended fields (e.g. enriched discard pile).
   */
  gameState: ClientGameState | null;
  /**
   * Revision counter that increments on each new StateSnapshot.
   * Used as React key on phase components to force remount on reconnect or game reset.
   * UI components can depend on this to detect when a fresh snapshot has been applied.
   */
  snapshotRevision: number;
  /** Send a game command to the server */
  sendCommand: (command: GameCommand) => void;
  /** Side effect manager (for cleanup) */
  sideEffectManager: SideEffectManager;
  /**
   * Event bus for UI components to subscribe to fine-grained events.
   *
   * Allows game phases and components to listen to specific events (e.g., 'server-event')
   * without polling gameState. Handlers receive the full event payload.
   * Returns unsubscribe function.
   *
   * Example:
   * ```tsx
   * const unsubscribe = eventBus.on('server-event', (event) => console.log(event));
   * return () => unsubscribe();
   * ```
   */
  eventBus: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
    emit: (event: string, data: unknown) => void;
  };
}

/**
 * Hook for orchestrating WebSocket events into game state and UI actions.
 *
 * Bridges WebSocket envelopes (events, state snapshots, errors) to pure event handlers
 * that produce state updates and side effects. Manages event dispatch, state sync, and
 * effect execution. Provides an event bus for UI components to subscribe to fine-grained events.
 *
 * Reconnection: When a StateSnapshot arrives, snapshotRevision increments, signaling
 * phase components to remount via React key change.
 *
 * @param options - Configuration: socket, initialState, dispatchUIAction, debug, enabled
 * @returns Game state, command sender, side effect manager, and event bus
 */
export function useGameEvents(options: UseGameEventsOptions): UseGameEventsReturn {
  const { socket, initialState = null, dispatchUIAction, debug = false, enabled = true } = options;
  const [serverSnapshot, setServerSnapshot] = useState<GameStateSnapshot | null>(initialState);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const { send, subscribe } = socket;
  const gameState = useMemo<ClientGameState | null>(
    () => (serverSnapshot ? deriveClientGameView(serverSnapshot) : null),
    [serverSnapshot]
  );
  const serverSnapshotRef = useRef<GameStateSnapshot | null>(initialState);
  const hasSubmittedPassRef = useRef(false);
  const callIntentsRef = useRef<CallIntentSummary[]>([]);
  const discardedByRef = useRef<Seat | null>(null);
  const sideEffectManager = useMemo(() => new SideEffectManager(), []);
  const { playSound } = useSoundEffects();

  const eventBusRef = useRef<{
    listeners: Map<string, Set<(data: unknown) => void>>;
  }>({
    listeners: new Map(),
  });

  useEffect(() => {
    serverSnapshotRef.current = serverSnapshot;
  }, [serverSnapshot]);

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
      if (debug) {
        const commandType = Object.keys(command)[0];
        console.log(`[useGameEvents] Sending command: ${commandType}`, command);
        if ('CommitCharlestonPass' in command) {
          console.log(
            '[useGameEvents] CommitCharlestonPass payload:',
            JSON.stringify(command.CommitCharlestonPass)
          );
        }
      }

      send({ kind: 'Command', payload: { command } });
    },
    [send, debug]
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
      const { dispatch: dispatchToStore } = useGameUIStore.getState();
      actions.forEach((action) => {
        if (debug) {
          console.log(`[useGameEvents] Dispatching UI action:`, action);
        }
        // Transitional compatibility: phase components still consume ui-actions
        // from the event bus while their local state is being migrated to the store.
        eventBus.emit('ui-action', action);
        updateLocalUiState(action);
        dispatchUIAction(action);
        dispatchToStore(action);
      });
    },
    [updateLocalUiState, dispatchUIAction, debug, eventBus]
  );

  const getTimeoutCleanupActions = useCallback((id: string): UIStateAction[] => {
    switch (id) {
      case 'bot-pass-message':
        return [{ type: 'SET_BOT_PASS_MESSAGE', message: null }];
      case 'bot-vote-message':
        return [{ type: 'SET_BOT_VOTE_MESSAGE', message: null }];
      case 'pass-direction':
        return [{ type: 'SET_PASS_DIRECTION', direction: null }];
      case 'incoming-seat':
        return [{ type: 'SET_INCOMING_FROM_SEAT', seat: null }];
      case 'highlight-tiles':
      case 'highlight-drawn-tile':
        return [{ type: 'SET_HIGHLIGHTED_TILE_IDS', ids: [] }];
      case 'leaving-tiles':
        return [{ type: 'SET_LEAVING_TILE_IDS', ids: [] }, { type: 'CLEAR_SELECTION' }];
      case 'wall-exhausted-message':
      case 'call-window-info':
      case 'call-resolution-message':
        return [{ type: 'SET_ERROR_MESSAGE', message: null }];
      case 'iou-overlay':
        return [{ type: 'CLEAR_IOU' }];
      default:
        return [];
    }
  }, []);

  // Execute side effects
  const executeSideEffects = useCallback(
    (effects: SideEffect[]) => {
      effects.forEach((effect) => {
        if (effect.type === 'PLAY_SOUND') {
          playSound(effect.sound as SoundEffect);
          return;
        }
        if (effect.type === 'TIMEOUT') {
          const cleanupActions = getTimeoutCleanupActions(effect.id);
          const wrappedEffect = {
            ...effect,
            callback: () => {
              if (cleanupActions.length > 0) {
                executeUIActions(cleanupActions);
              }
              effect.callback();
            },
          };
          sideEffectManager.execute(wrappedEffect);
          return;
        }
        sideEffectManager.execute(effect);
      });
    },
    [executeUIActions, getTimeoutCleanupActions, sideEffectManager, playSound]
  );

  const applyHandlerResult = useCallback(
    (result: EventHandlerResult) => {
      if (result.stateUpdates.length > 0) {
        setServerSnapshot((prev) =>
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
      const currentState = serverSnapshotRef.current;
      if (debug) {
        const eventType = Object.keys(event)[0];
        console.log(`[useGameEvents] Handling public event: ${eventType}`);
      }
      if (typeof event === 'object' && event !== null && 'CallWindowOpened' in event) {
        callIntentsRef.current = [];
        discardedByRef.current = event.CallWindowOpened.discarded_by;
      }
      const result: EventHandlerResult = handlePublicEvent(event, {
        gameState: currentState,
        yourSeat: currentState?.your_seat ?? null,
        callIntents: callIntentsRef.current,
        discardedBy: discardedByRef.current,
      });
      applyHandlerResult(result);
    },
    [applyHandlerResult, debug]
  );

  const handlePrivateEventHandler = useCallback(
    (event: PrivateEvent) => {
      if (debug) {
        const eventType = Object.keys(event)[0];
        console.log(`[useGameEvents] Handling private event: ${eventType}`);
      }
      const currentState = serverSnapshotRef.current;
      const result: EventHandlerResult = handlePrivateEvent(event, {
        gameState: currentState,
        hasSubmittedPass: hasSubmittedPassRef.current,
        yourSeat: currentState?.your_seat,
      });
      applyHandlerResult(result);
    },
    [applyHandlerResult, debug]
  );

  const handleEventEnvelope = useCallback(
    (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'Event') return;
      const event = envelope.payload.event;
      if (typeof event !== 'object' || event === null) return;
      eventBus.emit('server-event', event);

      if ('Public' in event) {
        handlePublicEventHandler(event.Public);
      }

      if ('Private' in event) {
        handlePrivateEventHandler(event.Private);
      }
    },
    [eventBus, handlePrivateEventHandler, handlePublicEventHandler]
  );

  const handleStateSnapshotEnvelope = useCallback(
    (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'StateSnapshot') return;
      const { snapshot } = envelope.payload;
      if (debug) {
        console.log('[useGameEvents] Received state snapshot:', snapshot.game_id);
      }
      setServerSnapshot(snapshot);
      setSnapshotRevision((prev) => prev + 1);
    },
    [debug]
  );

  const handleErrorEnvelope = useCallback(
    (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'Error') return;
      const payload = envelope.payload;
      if (!payload.message) return;

      if (debug) {
        console.warn('[useGameEvents] Received error:', payload.code, payload.message);
      }

      const currentPhase = serverSnapshotRef.current?.phase;
      const isCharleston =
        typeof currentPhase === 'object' && currentPhase && 'Charleston' in currentPhase;

      // ALREADY_SUBMITTED during Charleston = idempotent success; pass was already accepted
      if (isCharleston && payload.code === 'ALREADY_SUBMITTED') {
        if (debug) {
          console.info('[useGameEvents] Pass already submitted — treating as idempotent success');
        }
        return;
      }

      const uiActions: UIStateAction[] = [{ type: 'SET_ERROR_MESSAGE', message: payload.message }];

      // Handle Charleston errors by error code (prefer code) with message regex fallback
      const isInvalidTileError =
        payload.code === 'INVALID_TILE' || /tile not in hand/i.test(payload.message);
      const isRateLimitError =
        payload.code === 'RATE_LIMIT_EXCEEDED' || /rate limit/i.test(payload.message);

      if (isCharleston && /blind pass/i.test(payload.message)) {
        uiActions.push(
          { type: 'CLEAR_SELECTION' },
          { type: 'CLEAR_STAGING' },
          { type: 'SET_HAS_SUBMITTED_PASS', value: false }
        );
      }
      if (isCharleston && isInvalidTileError) {
        uiActions.push(
          { type: 'CLEAR_SELECTION' },
          { type: 'SET_HAS_SUBMITTED_PASS', value: false }
        );
        // Request fresh state from server to resync hand
        if (serverSnapshotRef.current?.your_seat) {
          send({
            kind: 'Command',
            payload: {
              command: { RequestState: { player: serverSnapshotRef.current.your_seat } },
            },
          });
        }
      }
      if (isCharleston && isRateLimitError) {
        uiActions.push({ type: 'SET_HAS_SUBMITTED_PASS', value: false });
      }

      executeUIActions(uiActions);
      executeSideEffects([
        {
          type: 'TIMEOUT',
          id: 'error-message',
          ms: 3000,
          callback: () => {
            executeUIActions([{ type: 'SET_ERROR_MESSAGE', message: null }]);
          },
        },
      ]);
    },
    [executeSideEffects, executeUIActions, debug, send]
  );

  useEffect(() => {
    if (!enabled) return;

    if (debug) {
      console.log('[useGameEvents] Subscribing to Event, StateSnapshot, and Error envelopes');
    }

    const unsubscribeEvent = subscribe('Event', handleEventEnvelope);
    const unsubscribeState = subscribe('StateSnapshot', handleStateSnapshotEnvelope);
    const unsubscribeError = subscribe('Error', handleErrorEnvelope);
    return () => {
      if (debug) {
        console.log('[useGameEvents] Cleaning up subscriptions and side effects');
      }
      unsubscribeEvent();
      unsubscribeState();
      unsubscribeError();
      sideEffectManager.cleanup();
    };
  }, [
    subscribe,
    handleEventEnvelope,
    handleStateSnapshotEnvelope,
    handleErrorEnvelope,
    debug,
    enabled,
    sideEffectManager,
  ]);

  return {
    gameState,
    snapshotRevision,
    sendCommand,
    sideEffectManager,
    eventBus,
  };
}
