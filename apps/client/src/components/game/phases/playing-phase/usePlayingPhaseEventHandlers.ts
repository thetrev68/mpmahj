import { useEffect } from 'react';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import type { Seat } from '@/types/bindings/generated/Seat';

interface EventBus {
  on: (event: string, handler: (data: unknown) => void) => () => void;
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
  animations: ReturnType<typeof useGameAnimations>;
  autoDraw: ReturnType<typeof useAutoDraw>;
  clearSelection: () => void;
  eventBus?: EventBus;
  historyPlayback: ReturnType<typeof useHistoryPlayback>;
  hintSystem: ReturnType<typeof useHintSystem>;
  playing: ReturnType<typeof usePlayingPhaseState>;
  turnKey: Seat;
}

export function usePlayingPhaseEventHandlers({
  animations,
  autoDraw,
  clearSelection,
  eventBus,
  historyPlayback,
  hintSystem,
  playing,
  turnKey,
}: UsePlayingPhaseEventHandlersOptions): void {
  // ── server-event subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.on('server-event', (data: unknown) => {
      if (hintSystem.handleServerEvent(data)) return;
      historyPlayback.handleServerEvent(data);
    });

    return unsubscribe;
  }, [eventBus, hintSystem, historyPlayback]);

  // ── turn-key reset effect ────────────────────────────────────────────────
  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    hintSystem.resetForTurnChange();
    autoDraw.resetDrawRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);
}

