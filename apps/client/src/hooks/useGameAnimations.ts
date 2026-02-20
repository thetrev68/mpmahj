/**
 * useGameAnimations Hook
 *
 * Manages game animation state with auto-hide logic.
 * Extracted from GameBoard.tsx lines 149-151 as part of Phase 2 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 2
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';

/**
 * Animation state return type
 */
interface GameAnimations {
  // State
  highlightedTileIds: string[];
  leavingTileIds: string[];
  incomingFromSeat: Seat | null;
  passDirection: PassDirection | null;

  // Actions
  setHighlightedTileIds: (ids: string[], autoHideMs?: number) => void;
  setLeavingTileIds: (ids: string[], autoHideMs?: number) => void;
  setIncomingFromSeat: (seat: Seat | null, autoHideMs?: number) => void;
  setPassDirection: (direction: PassDirection | null, autoHideMs?: number) => void;
  clearAllAnimations: () => void;
}

/**
 * Custom hook for managing game animations
 *
 * Consolidates animation state with built-in auto-hide logic.
 * All animations support optional automatic clearing after a duration.
 *
 * @example
 * ```tsx
 * const animations = useGameAnimations();
 *
 * // Highlight tiles for 2 seconds
 * animations.setHighlightedTileIds(['tile-1', 'tile-2'], 2000);
 *
 * // Show pass direction for 600ms
 * animations.setPassDirection('Right', 600);
 *
 * // Manual clear
 * animations.clearAllAnimations();
 * ```
 */
export function useGameAnimations(): GameAnimations {
  // Animation state
  const [highlightedTileIds, setHighlightedTileIds] = useState<string[]>([]);
  const [leavingTileIds, setLeavingTileIds] = useState<string[]>([]);
  const [incomingFromSeat, setIncomingFromSeat] = useState<Seat | null>(null);
  const [passDirection, setPassDirection] = useState<PassDirection | null>(null);

  // Timeout refs for auto-hide
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leavingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passDirectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear all pending timeouts
   */
  const clearAllTimeouts = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    if (leavingTimeoutRef.current) {
      clearTimeout(leavingTimeoutRef.current);
      leavingTimeoutRef.current = null;
    }
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }
    if (passDirectionTimeoutRef.current) {
      clearTimeout(passDirectionTimeoutRef.current);
      passDirectionTimeoutRef.current = null;
    }
  }, []);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  /**
   * Set highlighted tile IDs with optional auto-hide
   */
  const handleSetHighlightedTileIds = useCallback((ids: string[], autoHideMs?: number) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }

    setHighlightedTileIds(ids);

    if (autoHideMs !== undefined && autoHideMs > 0) {
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTileIds([]);
        highlightTimeoutRef.current = null;
      }, autoHideMs);
    }
  }, []);

  /**
   * Set leaving tile IDs with optional auto-hide
   */
  const handleSetLeavingTileIds = useCallback((ids: string[], autoHideMs?: number) => {
    if (leavingTimeoutRef.current) {
      clearTimeout(leavingTimeoutRef.current);
      leavingTimeoutRef.current = null;
    }

    setLeavingTileIds(ids);

    if (autoHideMs !== undefined && autoHideMs > 0) {
      leavingTimeoutRef.current = setTimeout(() => {
        setLeavingTileIds([]);
        leavingTimeoutRef.current = null;
      }, autoHideMs);
    }
  }, []);

  /**
   * Set incoming seat indicator with optional auto-hide
   */
  const handleSetIncomingFromSeat = useCallback((seat: Seat | null, autoHideMs?: number) => {
    if (incomingTimeoutRef.current) {
      clearTimeout(incomingTimeoutRef.current);
      incomingTimeoutRef.current = null;
    }

    setIncomingFromSeat(seat);

    if (seat !== null && autoHideMs !== undefined && autoHideMs > 0) {
      incomingTimeoutRef.current = setTimeout(() => {
        setIncomingFromSeat(null);
        incomingTimeoutRef.current = null;
      }, autoHideMs);
    }
  }, []);

  /**
   * Set pass direction animation with optional auto-hide
   */
  const handleSetPassDirection = useCallback(
    (direction: PassDirection | null, autoHideMs?: number) => {
      if (passDirectionTimeoutRef.current) {
        clearTimeout(passDirectionTimeoutRef.current);
        passDirectionTimeoutRef.current = null;
      }

      setPassDirection(direction);

      if (direction !== null && autoHideMs !== undefined && autoHideMs > 0) {
        passDirectionTimeoutRef.current = setTimeout(() => {
          setPassDirection(null);
          passDirectionTimeoutRef.current = null;
        }, autoHideMs);
      }
    },
    []
  );

  /**
   * Clear all animations and cancel pending timeouts
   */
  const clearAllAnimations = useCallback(() => {
    clearAllTimeouts();
    setHighlightedTileIds([]);
    setLeavingTileIds([]);
    setIncomingFromSeat(null);
    setPassDirection(null);
  }, [clearAllTimeouts]);

  return {
    // State
    highlightedTileIds,
    leavingTileIds,
    incomingFromSeat,
    passDirection,

    // Actions
    setHighlightedTileIds: handleSetHighlightedTileIds,
    setLeavingTileIds: handleSetLeavingTileIds,
    setIncomingFromSeat: handleSetIncomingFromSeat,
    setPassDirection: handleSetPassDirection,
    clearAllAnimations,
  };
}
