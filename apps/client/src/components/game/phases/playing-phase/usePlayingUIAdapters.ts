/**
 * Store-backed adapters for PlayingPhase hook replacement.
 *
 * Introduced in Phase 4, slice 4.3 of the frontend refactor.
 * Replaces useCallWindowState and usePlayingPhaseState with thin adapters
 * that read state from useGameUIStore and dispatch actions back to it, so
 * there is one authoritative owner for all transient UI state.
 *
 * These adapters satisfy the same interfaces as the original hooks so that
 * PlayingPhasePresentation, PlayingPhaseOverlays, and usePlayingPhaseActions
 * do not require signature changes in this slice.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { CallWindowState, CallWindowData, CallIntentsRef } from '@/hooks/useCallWindowState';
import type { PlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import type { OpenCallWindowParams } from '@/lib/game-events/types';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { StagedTile } from '@/components/game/StagingStrip';

// ---------------------------------------------------------------------------
// useCallWindowFromStore
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for useCallWindowState() that reads all state from
 * the game UI Zustand store and dispatches actions back to it.
 *
 * Shape is identical to CallWindowState so downstream props do not change.
 * Field name mapping: store.callWindow.responded → callWindow.hasResponded,
 *                     store.callWindow.respondedMessage → callWindow.responseMessage.
 */
export function useCallWindowFromStore(): CallWindowState {
  const storeCallWindow = useGameUIStore((s) => s.callWindow);
  const dispatch = useGameUIStore((s) => s.dispatch);

  // Stable ref that mirrors store intents — kept for API compatibility with
  // any consumer that reads callIntentsRef directly.
  const callIntentsRef = useRef<CallIntentsRef>({
    intents: [],
    discardedBy: null,
  });
  // Keep ref in sync after render (useEffect to avoid ref mutation in render body).
  useEffect(() => {
    callIntentsRef.current = {
      intents: storeCallWindow?.intents ?? [],
      discardedBy: storeCallWindow?.discardedBy ?? null,
    };
  }, [storeCallWindow]);

  const callWindowData: CallWindowData | null = storeCallWindow
    ? {
        active: true,
        tile: storeCallWindow.tile,
        discardedBy: storeCallWindow.discardedBy,
        canCall: storeCallWindow.canCall,
        canAct: storeCallWindow.canAct,
        intents: storeCallWindow.intents,
        timerStart: storeCallWindow.timerStart,
        timerDuration: storeCallWindow.timerDuration,
        // Map store field names to legacy hook field names.
        hasResponded: storeCallWindow.responded,
        responseMessage: storeCallWindow.respondedMessage,
      }
    : null;

  const openCallWindow = useCallback(
    (params: OpenCallWindowParams) => dispatch({ type: 'OPEN_CALL_WINDOW', params }),
    [dispatch],
  );

  const updateProgress = useCallback(
    (canAct: Seat[], intents: CallIntentSummary[]) =>
      dispatch({ type: 'UPDATE_CALL_WINDOW_PROGRESS', canAct, intents }),
    [dispatch],
  );

  const closeCallWindow = useCallback(
    () => dispatch({ type: 'CLOSE_CALL_WINDOW' }),
    [dispatch],
  );

  const markResponded = useCallback(
    (message?: string) => dispatch({ type: 'MARK_CALL_WINDOW_RESPONDED', message }),
    [dispatch],
  );

  const setTimerRemaining = useCallback(
    (remaining: number | null) => dispatch({ type: 'SET_CALL_WINDOW_TIMER', remaining }),
    [dispatch],
  );

  const reset = useCallback(
    () => dispatch({ type: 'CLOSE_CALL_WINDOW' }),
    [dispatch],
  );

  return {
    callWindow: callWindowData,
    timerRemaining: storeCallWindow?.timerRemaining ?? null,
    callIntentsRef,
    openCallWindow,
    updateProgress,
    closeCallWindow,
    markResponded,
    setTimerRemaining,
    reset,
  };
}

// ---------------------------------------------------------------------------
// usePlayingStateFromStore
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for usePlayingPhaseState() that reads all state from
 * the game UI Zustand store and dispatches actions back to it.
 *
 * Shape is identical to PlayingPhaseState so downstream props do not change.
 */
export function usePlayingStateFromStore(): PlayingPhaseState {
  const isProcessing = useGameUIStore((s) => s.isProcessing);
  const mostRecentDiscard = useGameUIStore((s) => s.mostRecentDiscard);
  const discardAnimationTile = useGameUIStore((s) => s.discardAnimationTile);
  const resolutionOverlay = useGameUIStore((s) => s.resolutionOverlay);
  const stagedIncomingTile = useGameUIStore((s) => s.stagedIncomingDrawTile);
  const dispatch = useGameUIStore((s) => s.dispatch);

  const setProcessing = useCallback(
    (value: boolean) => dispatch({ type: 'SET_IS_PROCESSING', value }),
    [dispatch],
  );

  const setMostRecentDiscard = useCallback(
    (tile: Tile | null) => dispatch({ type: 'SET_MOST_RECENT_DISCARD', tile }),
    [dispatch],
  );

  const setDiscardAnimation = useCallback(
    (tile: Tile | null) => dispatch({ type: 'SET_DISCARD_ANIMATION_TILE', tile }),
    [dispatch],
  );

  const showResolutionOverlay = useCallback(
    (data: ResolutionOverlayData) => dispatch({ type: 'SHOW_RESOLUTION_OVERLAY', data }),
    [dispatch],
  );

  const dismissResolutionOverlay = useCallback(
    () => dispatch({ type: 'DISMISS_RESOLUTION_OVERLAY' }),
    [dispatch],
  );

  const setStagedIncomingTile = useCallback(
    (tile: StagedTile | null) => {
      if (tile === null) {
        dispatch({ type: 'CLEAR_STAGED_INCOMING_DRAW_TILE' });
      } else {
        dispatch({ type: 'SET_STAGED_INCOMING_DRAW_TILE', tileId: tile.id, tile: tile.tile });
      }
    },
    [dispatch],
  );

  const reset = useCallback(() => dispatch({ type: 'RESET_PLAYING_STATE' }), [dispatch]);

  return {
    isProcessing,
    mostRecentDiscard,
    discardAnimationTile,
    resolutionOverlay,
    stagedIncomingTile,
    setProcessing,
    setMostRecentDiscard,
    setDiscardAnimation,
    showResolutionOverlay,
    dismissResolutionOverlay,
    setStagedIncomingTile,
    reset,
  };
}
