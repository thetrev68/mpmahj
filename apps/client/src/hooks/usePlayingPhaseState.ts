/**
 * usePlayingPhaseState Hook
 *
 * Manages all Playing phase state in a single, testable hook.
 * Extracted from GameBoard.tsx as part of Phase 3 refactoring.
 */

import { useState, useCallback } from 'react';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
import type { StagedTile } from '@/components/game/StagingStrip';
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
  stagedIncomingTile: StagedTile | null;

  // Actions
  setProcessing: (value: boolean) => void;
  setMostRecentDiscard: (tile: Tile | null) => void;
  setDiscardAnimation: (tile: Tile | null) => void;
  showResolutionOverlay: (data: ResolutionOverlayData) => void;
  dismissResolutionOverlay: () => void;
  setStagedIncomingTile: (tile: StagedTile | null) => void;
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
  const [stagedIncomingTile, setStagedIncomingTile] = useState<StagedTile | null>(null);

  const dismissResolutionOverlay = useCallback(() => {
    setResolutionOverlay(null);
  }, []);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setMostRecentDiscard(null);
    setDiscardAnimation(null);
    setResolutionOverlay(null);
    setStagedIncomingTile(null);
  }, []);

  return {
    isProcessing,
    mostRecentDiscard,
    discardAnimationTile,
    resolutionOverlay,
    stagedIncomingTile,
    setProcessing: setIsProcessing,
    setMostRecentDiscard,
    setDiscardAnimation,
    showResolutionOverlay: setResolutionOverlay,
    dismissResolutionOverlay,
    setStagedIncomingTile,
    reset,
  };
}
