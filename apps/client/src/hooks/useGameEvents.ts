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
 * Related: FRONTEND_REFACTOR_IMPLEMENTATION_PLAN.md Phase 5
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { InboundEnvelope, OutboundEnvelope } from './useGameSocket';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Seat } from '@/types/bindings/generated/Seat';
import type {
  EventHandlerResult,
  UIStateAction,
  SideEffect,
  ServerEventNotification,
} from '@/lib/game-events/types';
import type { ClientGameState } from '@/types/clientGameState';
import { deriveClientGameView } from '@/lib/game-state/deriveClientGameView';
import { SideEffectManager } from '@/lib/game-events/sideEffectManager';
import { createEventDispatchers } from '@/lib/game-events/eventDispatchers';
import { executeSideEffects as executeSideEffectBatch } from '@/lib/game-events/eventSideEffects';
import { applyEventHandlerResult } from '@/lib/game-events/eventResult';
import { useSoundEffects } from './useSoundEffects';
import { useGameUIStore } from '@/stores/gameUIStore';
import { useRoomStore } from '@/stores/roomStore';

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
   * Narrow event channel for non-state consumers (history + hint systems).
   * Emits a typed notification union instead of rebroadcasting raw server events.
   */
  eventBus: {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
  };
}

/**
 * Hook for orchestrating WebSocket events into game state and UI actions.
 *
 * Bridges WebSocket envelopes (events, state snapshots, errors) to pure event handlers
 * that produce state updates and side effects. Manages event dispatch, state sync, and
 * effect execution. Provides a typed notification channel for non-state consumers.
 *
 * Reconnection: When a StateSnapshot arrives, snapshotRevision increments, signaling
 * phase components to remount via React key change.
 *
 * @param options - Configuration: socket, initialState, debug, enabled
 * @returns Game state, command sender, side effect manager, and event bus
 */
export function useGameEvents(options: UseGameEventsOptions): UseGameEventsReturn {
  const { socket, initialState = null, debug = false, enabled = true } = options;
  const [serverSnapshot, setServerSnapshot] = useState<GameStateSnapshot | null>(initialState);
  const [snapshotRevision, setSnapshotRevision] = useState(0);
  const { send, subscribe } = socket;
  // Ref so the GameStarting bootstrap effect can read the latest snapshot without
  // going stale inside the subscription closure.
  const serverSnapshotRef = useRef<GameStateSnapshot | null>(serverSnapshot);
  useEffect(() => {
    serverSnapshotRef.current = serverSnapshot;
  }, [serverSnapshot]);
  const gameState = useMemo<ClientGameState | null>(
    () => (serverSnapshot ? deriveClientGameView(serverSnapshot) : null),
    [serverSnapshot]
  );
  const sideEffectManager = useMemo(() => new SideEffectManager(), []);
  const { playSound } = useSoundEffects();

  const eventBusRef = useRef<Set<(event: ServerEventNotification) => void>>(new Set());

  const eventBus = useMemo(() => {
    const onServerEvent = (handler: (event: ServerEventNotification) => void) => {
      eventBusRef.current.add(handler);
      return () => {
        eventBusRef.current.delete(handler);
      };
    };

    return { onServerEvent };
  }, []);

  const emitServerEvent = useCallback((event: ServerEventNotification) => {
    eventBusRef.current.forEach((handler) => handler(event));
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

  // Execute UI state actions
  const executeUIActions = useCallback(
    (actions: UIStateAction[]) => {
      const { dispatch } = useGameUIStore.getState();
      actions.forEach((action) => {
        if (debug) {
          console.log(`[useGameEvents] Dispatching UI action:`, action);
        }
        dispatch(action);
      });
    },
    [debug]
  );

  const executeSideEffects = useCallback(
    (effects: SideEffect[]) => {
      executeSideEffectBatch(effects, {
        playSound,
        executeUIActions,
        sideEffectManager,
      });
    },
    [playSound, executeUIActions, sideEffectManager]
  );

  const applyHandlerResult = useCallback(
    (result: EventHandlerResult) => {
      applyEventHandlerResult(result, {
        setServerSnapshot,
        executeUIActions,
        executeSideEffects,
      });
    },
    [executeUIActions, executeSideEffects]
  );

  const requestStateBySeat = useCallback(
    (seat: Seat) => {
      send({
        kind: 'Command',
        payload: { command: { RequestState: { player: seat } } },
      });
    },
    [send]
  );

  const dispatchers = useMemo(
    () =>
      // Listener and UI-store callbacks intentionally dereference refs at event time.
      // eslint-disable-next-line react-hooks/refs
      createEventDispatchers({
        debug,
        getServerSnapshot: () => serverSnapshot,
        getCallWindowContext: () => {
          const callWindow = useGameUIStore.getState().callWindow;
          return {
            intents: callWindow?.intents ?? [],
            discardedBy: callWindow?.discardedBy ?? null,
            hasSubmittedPass: useGameUIStore.getState().hasSubmittedPass,
          };
        },
        getYourSeat: () => serverSnapshot?.your_seat ?? null,
        emitServerEvent,
        applyHandlerResult,
        requestStateBySeat,
        setServerSnapshot,
        incrementSnapshotRevision: () => {
          setSnapshotRevision((prev) => prev + 1);
        },
      }),
    [debug, serverSnapshot, applyHandlerResult, emitServerEvent, requestStateBySeat]
  );

  const handleEventEnvelope = dispatchers.handleEventEnvelope;
  const handleStateSnapshotEnvelope = dispatchers.handleStateSnapshotEnvelope;
  const handleErrorEnvelope = dispatchers.handleErrorEnvelope;

  // Mount-time bootstrap: if GameBoard mounts with no snapshot and we're in a room,
  // immediately request state. This handles the race where the server's initial
  // StateSnapshot push (and the LobbyScreen RequestState response) both arrived
  // before GameBoard mounted and its subscriptions were registered.
  const mountBootstrapSentRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (mountBootstrapSentRef.current) return;
    if (serverSnapshotRef.current) return;
    const seat = useRoomStore.getState().currentRoom?.seat;
    if (seat) {
      mountBootstrapSentRef.current = true;
      send({
        kind: 'Command',
        payload: { command: { RequestState: { player: seat as Seat } } },
      });
    }
  }, [enabled, send]);

  // Bootstrap: when GameStarting arrives and we still have no snapshot, the earlier
  // RequestState (sent from LobbyScreen on RoomJoined) raced with game start and lost.
  // Re-send RequestState now — the game is definitely running at this point.
  useEffect(() => {
    if (!enabled) return;

    const unsubscribeBootstrap = subscribe('Event', (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'Event') return;
      const event = envelope.payload.event;
      if (typeof event !== 'object' || event === null) return;
      if (!('Public' in event) || event.Public !== 'GameStarting') return;

      if (!serverSnapshotRef.current) {
        const seat = useRoomStore.getState().currentRoom?.seat;
        if (seat) {
          send({
            kind: 'Command',
            payload: { command: { RequestState: { player: seat as Seat } } },
          });
        }
      }
    });

    return unsubscribeBootstrap;
  }, [enabled, subscribe, send]);

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
