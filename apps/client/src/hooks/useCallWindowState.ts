/**
 * useCallWindowState Hook
 *
 * Manages all call window state in a single, testable hook.
 * Extracted from GameBoard.tsx lines 214-242 as part of Phase 3 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3
 */

import { useState, useCallback, useRef, type MutableRefObject } from 'react';
import type { OpenCallWindowParams } from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import { CALL_WINDOW_INTENTS_CLEAR_DELAY_MS } from '@/lib/constants';

export type { OpenCallWindowParams } from '@/lib/game-events/types';

/**
 * Call window state structure
 */
export interface CallWindowData {
  active: boolean;
  tile: Tile;
  discardedBy: Seat;
  canCall: Seat[];
  canAct: Seat[];
  intents: CallIntentSummary[];
  timerStart: number;
  timerDuration: number;
  hasResponded: boolean;
  responseMessage?: string;
}

/**
 * Call intents tracking (ref for reliable access in CallResolved)
 */
export interface CallIntentsRef {
  intents: CallIntentSummary[];
  discardedBy: Seat | null;
}

/**
 * Call window state return type
 */
export interface CallWindowState {
  // State
  callWindow: CallWindowData | null;
  timerRemaining: number | null;
  callIntentsRef: MutableRefObject<CallIntentsRef>;

  // Actions
  openCallWindow: (params: OpenCallWindowParams) => void;
  updateProgress: (canAct: Seat[], intents: CallIntentSummary[]) => void;
  closeCallWindow: () => void;
  markResponded: (message?: string) => void;
  setTimerRemaining: (seconds: number | null) => void;
  reset: () => void;
}

/**
 * Custom hook for managing call window state
 *
 * Consolidates call window state from GameBoard.tsx into a single,
 * testable state container with clear actions.
 *
 * Note: Timer countdown is display-only. No auto-pass logic.
 *
 * @example
 * ```tsx
 * const callWindow = useCallWindowState();
 *
 * // Open call window
 * callWindow.openCallWindow({
 *   tile: 5,
 *   discardedBy: 'East',
 *   canCall: ['South', 'West'],
 *   timerDuration: 10,
 *   timerStart: Date.now()
 * });
 *
 * // Update with progress
 * callWindow.updateProgress(['South'], [intent1, intent2]);
 *
 * // Mark responded
 * callWindow.markResponded('Called for Pung');
 *
 * // Close window
 * callWindow.closeCallWindow();
 * ```
 */
export function useCallWindowState(): CallWindowState {
  const [callWindow, setCallWindow] = useState<CallWindowData | null>(null);
  const [timerRemaining, setTimerRemainingState] = useState<number | null>(null);

  // Ref for reliable access to intents in CallResolved event (avoid async state issues)
  const callIntentsRef = useRef<CallIntentsRef>({
    intents: [],
    discardedBy: null,
  });

  /**
   * Open call window with initial state
   */
  const openCallWindow = useCallback((params: OpenCallWindowParams) => {
    const { tile, discardedBy, canCall, timerDuration, timerStart } = params;

    setCallWindow({
      active: true,
      tile,
      discardedBy,
      canCall,
      canAct: canCall, // Initially, all eligible players can act
      intents: [],
      timerStart,
      timerDuration,
      hasResponded: false,
    });

    // Initialize intents ref for CallResolved
    callIntentsRef.current = {
      intents: [],
      discardedBy,
    };
  }, []);

  /**
   * Update call window progress (intents submitted, players who can still act)
   */
  const updateProgress = useCallback((canAct: Seat[], intents: CallIntentSummary[]) => {
    // Update state
    setCallWindow((prev) =>
      prev
        ? {
            ...prev,
            canAct,
            intents,
          }
        : null
    );

    // Update ref for reliable access in CallResolved
    callIntentsRef.current.intents = intents;
  }, []);

  /**
   * Close call window and reset state
   */
  const closeCallWindow = useCallback(() => {
    setCallWindow(null);
    setTimerRemainingState(null);

    // Clear intents ref (with slight delay to allow CallResolved to read it)
    setTimeout(() => {
      callIntentsRef.current = {
        intents: [],
        discardedBy: null,
      };
    }, CALL_WINDOW_INTENTS_CLEAR_DELAY_MS);
  }, []);

  /**
   * Mark current player as responded (prevents double-submission)
   */
  const markResponded = useCallback((message?: string) => {
    setCallWindow((prev) =>
      prev
        ? {
            ...prev,
            hasResponded: true,
            responseMessage: message,
          }
        : null
    );
  }, []);

  /**
   * Update timer countdown (display-only, no auto-pass logic)
   */
  const setTimerRemaining = useCallback((seconds: number | null) => {
    setTimerRemainingState(seconds);
  }, []);

  /**
   * Reset all call window state
   */
  const reset = useCallback(() => {
    setCallWindow(null);
    setTimerRemainingState(null);
    callIntentsRef.current = {
      intents: [],
      discardedBy: null,
    };
  }, []);

  return {
    // State
    callWindow,
    timerRemaining,
    callIntentsRef,

    // Actions
    openCallWindow,
    updateProgress,
    closeCallWindow,
    markResponded,
    setTimerRemaining,
    reset,
  };
}
