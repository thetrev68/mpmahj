/**
 * usePlayingPhaseState Hook
 *
 * Manages all Playing phase state in a single, testable hook.
 * Extracted from GameBoard.tsx lines 209-236 as part of Phase 3 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3
 */

import { useState, useCallback } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';

/**
 * Call resolution overlay data
 */
export interface ResolutionOverlayData {
  resolution: CallResolution;
  tieBreak: CallTieBreakReason | null;
  allCallers: CallIntentSummary[];
  discardedBy: Seat;
}

/**
 * Playing phase state return type
 */
export interface PlayingPhaseState {
  // State
  isProcessing: boolean;
  mostRecentDiscard: Tile | null;
  discardAnimationTile: Tile | null;
  resolutionOverlay: ResolutionOverlayData | null;

  // Actions
  setProcessing: (value: boolean) => void;
  setMostRecentDiscard: (tile: Tile | null) => void;
  setDiscardAnimation: (tile: Tile | null) => void;
  showResolutionOverlay: (data: ResolutionOverlayData) => void;
  dismissResolutionOverlay: () => void;
  reset: () => void;
}

/**
 * Custom hook for managing Playing phase state
 *
 * Consolidates Playing phase state from GameBoard.tsx into a single,
 * testable state container with clear actions.
 *
 * @example
 * ```tsx
 * const playing = usePlayingPhaseState();
 *
 * // Mark processing
 * playing.setProcessing(true);
 *
 * // Set most recent discard
 * playing.setMostRecentDiscard(5);
 *
 * // Show discard animation
 * playing.setDiscardAnimation(5);
 *
 * // Show resolution overlay
 * playing.showResolutionOverlay({
 *   resolution: { Won: 'East' },
 *   tieBreak: null,
 *   allCallers: [{ player: 'East', intent: 'Mahjong' }],
 *   discardedBy: 'South'
 * });
 *
 * // Dismiss overlay
 * playing.dismissResolutionOverlay();
 *
 * // Reset all state
 * playing.reset();
 * ```
 */
export function usePlayingPhaseState(): PlayingPhaseState {
  const [isProcessing, setIsProcessing] = useState(false);
  const [mostRecentDiscard, setMostRecentDiscardState] = useState<Tile | null>(null);
  const [discardAnimationTile, setDiscardAnimationState] = useState<Tile | null>(null);
  const [resolutionOverlay, setResolutionOverlayState] = useState<ResolutionOverlayData | null>(
    null
  );

  /**
   * Set processing flag (during discard, draw, etc.)
   */
  const setProcessing = useCallback((value: boolean) => {
    setIsProcessing(value);
  }, []);

  /**
   * Set most recent discard tile (for highlighting in discard pool)
   */
  const setMostRecentDiscard = useCallback((tile: Tile | null) => {
    setMostRecentDiscardState(tile);
  }, []);

  /**
   * Set discard animation tile (triggers DiscardAnimationLayer)
   */
  const setDiscardAnimation = useCallback((tile: Tile | null) => {
    setDiscardAnimationState(tile);
  }, []);

  /**
   * Show call resolution overlay
   */
  const showResolutionOverlay = useCallback((data: ResolutionOverlayData) => {
    setResolutionOverlayState(data);
  }, []);

  /**
   * Dismiss call resolution overlay
   */
  const dismissResolutionOverlay = useCallback(() => {
    setResolutionOverlayState(null);
  }, []);

  /**
   * Reset all playing phase state
   */
  const reset = useCallback(() => {
    setIsProcessing(false);
    setMostRecentDiscardState(null);
    setDiscardAnimationState(null);
    setResolutionOverlayState(null);
  }, []);

  return {
    // State
    isProcessing,
    mostRecentDiscard,
    discardAnimationTile,
    resolutionOverlay,

    // Actions
    setProcessing,
    setMostRecentDiscard,
    setDiscardAnimation,
    showResolutionOverlay,
    dismissResolutionOverlay,
    reset,
  };
}
