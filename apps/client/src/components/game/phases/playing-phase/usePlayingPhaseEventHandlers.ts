import { useEffect, useRef } from 'react';
import type { ServerEventNotification } from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';

interface EventBus {
  onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
}

/**
 * Options for usePlayingPhaseEventHandlers.
 *
 * Phase 4 slice 4.3: the ui-action subscription has been removed. All
 * UIStateAction handling now happens via useGameUIStore (see PlayingPhase.tsx
 * for the explicit store → local-hook bridge effects). This hook now owns only:
 *   1. The 'server-event' bus subscription (hint system + history playback).
 *   2. The turn-key reset effect (reset local state on turn change).
 */
export interface UsePlayingPhaseEventHandlersOptions {
  animations: { clearAllAnimations: () => void };
  autoDraw: { resetDrawRetry: () => void };
  clearSelection: () => void;
  eventBus?: EventBus;
  historyPlayback: { handleServerEvent: (event: ServerEventNotification) => void };
  playing: { reset: () => void };
  turnKey: Seat;
}

export function usePlayingPhaseEventHandlers({
  animations,
  autoDraw,
  clearSelection,
  eventBus,
  historyPlayback,
  playing,
  turnKey,
}: UsePlayingPhaseEventHandlersOptions): void {
  const latestResetActionsRef = useRef({
    playingReset: playing.reset,
    clearAnimations: animations.clearAllAnimations,
    clearSelection,
    resetDrawRetry: autoDraw.resetDrawRetry,
  });

  useEffect(() => {
    latestResetActionsRef.current = {
      playingReset: playing.reset,
      clearAnimations: animations.clearAllAnimations,
      clearSelection,
      resetDrawRetry: autoDraw.resetDrawRetry,
    };
  }, [animations.clearAllAnimations, autoDraw.resetDrawRetry, clearSelection, playing.reset]);

  // ── server-event subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.onServerEvent((event) => {
      historyPlayback.handleServerEvent(event);
    });

    return unsubscribe;
  }, [eventBus, historyPlayback]);

  // ── turn-key reset effect ────────────────────────────────────────────────
  useEffect(() => {
    latestResetActionsRef.current.playingReset();
    latestResetActionsRef.current.clearAnimations();
    latestResetActionsRef.current.clearSelection();
    latestResetActionsRef.current.resetDrawRetry();
  }, [turnKey]);
}
