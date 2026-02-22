/**
 * usePlayingPhaseState Hook
 *
 * Manages all Playing phase state in a single, testable hook.
 * Extracted from GameBoard.tsx as part of Phase 3 refactoring.
 */

import { useState, useCallback } from 'react';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
export type { ResolutionOverlayData } from '@/lib/game-events/types';

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
 * Custom hook for managing Playing phase state.
 *
 * Consolidates Playing phase state into a single, testable state container.
 * Individual setters are stable references (React useState setters) so
 * consumers can depend on them without extra memoization.
 */
export function usePlayingPhaseState(): PlayingPhaseState {
  const [isProcessing, setIsProcessing] = useState(false);
  const [mostRecentDiscard, setMostRecentDiscard] = useState<Tile | null>(null);
  const [discardAnimationTile, setDiscardAnimation] = useState<Tile | null>(null);
  const [resolutionOverlay, setResolutionOverlay] = useState<ResolutionOverlayData | null>(null);

  const dismissResolutionOverlay = useCallback(() => {
    setResolutionOverlay(null);
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setMostRecentDiscard(null);
    setDiscardAnimation(null);
    setResolutionOverlay(null);
  }, []);

  return {
    isProcessing,
    mostRecentDiscard,
    discardAnimationTile,
    resolutionOverlay,
    setProcessing: setIsProcessing,
    setMostRecentDiscard,
    setDiscardAnimation,
    showResolutionOverlay: setResolutionOverlay,
    dismissResolutionOverlay,
    reset,
  };
}
