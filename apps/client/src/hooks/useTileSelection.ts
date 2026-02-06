import { useState, useCallback, useEffect } from 'react';
import type { Tile } from '@/types/bindings';

/**
 * Options for useTileSelection hook
 */
export interface UseTileSelectionOptions {
  /** Maximum tiles that can be selected */
  maxSelection: number;

  /** Tiles that cannot be selected (e.g., Jokers during Charleston) */
  disabledTiles?: Tile[];

  /** Initial selection */
  initialSelection?: Tile[];

  /** Callback when selection changes */
  onSelectionChange?: (selected: Tile[]) => void;

  /** Auto-clear selection after action */
  autoClear?: boolean;
}

/**
 * Return type for useTileSelection hook
 */
export interface UseTileSelectionReturn {
  /** Currently selected tiles */
  selectedTiles: Tile[];

  /** Toggle a tile's selection */
  toggleTile: (tile: Tile) => void;

  /** Check if a tile can be selected */
  canSelect: (tile: Tile) => boolean;

  /** Check if a tile is selected */
  isSelected: (tile: Tile) => boolean;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select specific tiles (for programmatic selection) */
  selectTiles: (tiles: Tile[]) => void;

  /** Selection state */
  selectionCount: number;
  isMaxReached: boolean;
}

/**
 * Hook for managing tile selection logic
 *
 * Handles:
 * - Max selection limits (e.g., 3 for Charleston, 1 for discard)
 * - Disabled tiles (e.g., Jokers during Charleston)
 * - Selection/deselection
 * - Programmatic selection
 *
 * Uses the Tile type from backend bindings (number 0-36).
 *
 * Based on spec: docs/implementation/frontend/component-specs/hooks/useTileSelection.md
 */
export function useTileSelection(
  options: UseTileSelectionOptions
): UseTileSelectionReturn {
  const {
    maxSelection,
    disabledTiles = [],
    initialSelection = [],
    onSelectionChange,
    autoClear = false,
  } = options;

  // State
  const [selectedTiles, setSelectedTiles] = useState<Tile[]>(initialSelection);

  // Derived state
  const selectionCount = selectedTiles.length;
  const isMaxReached = selectionCount >= maxSelection;

  /**
   * Check if a tile is currently selected
   */
  const isSelected = useCallback(
    (tile: Tile): boolean => {
      return selectedTiles.includes(tile);
    },
    [selectedTiles]
  );

  /**
   * Check if a tile can be selected
   *
   * Rules:
   * - Already selected tiles can always be toggled (to deselect)
   * - Disabled tiles cannot be selected
   * - Cannot select beyond max limit
   */
  const canSelect = useCallback(
    (tile: Tile): boolean => {
      // Already selected tiles can always be toggled (to deselect)
      if (isSelected(tile)) return true;

      // Check if disabled
      if (disabledTiles.includes(tile)) return false;

      // Check if max reached
      if (selectionCount >= maxSelection) return false;

      return true;
    },
    [disabledTiles, selectionCount, maxSelection, isSelected]
  );

  /**
   * Toggle a tile's selection state
   */
  const toggleTile = useCallback(
    (tile: Tile) => {
      if (isSelected(tile)) {
        // Deselect
        setSelectedTiles((prev) => prev.filter((t) => t !== tile));
      } else if (canSelect(tile)) {
        // Select
        setSelectedTiles((prev) => [...prev, tile]);
      }
      // If can't select (disabled or max reached), do nothing
    },
    [isSelected, canSelect]
  );

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedTiles([]);
  }, []);

  /**
   * Set tiles directly (programmatic selection)
   *
   * Filters out disabled tiles and respects max selection limit
   */
  const selectTiles = useCallback(
    (tiles: Tile[]) => {
      // Filter out disabled tiles
      const validTiles = tiles.filter((tile) => !disabledTiles.includes(tile));

      // Respect max selection limit
      const limitedTiles = validTiles.slice(0, maxSelection);

      setSelectedTiles(limitedTiles);
    },
    [disabledTiles, maxSelection]
  );

  /**
   * Trigger callback when selection changes
   */
  useEffect(() => {
    onSelectionChange?.(selectedTiles);

    if (autoClear && selectedTiles.length === maxSelection) {
      // Clear after a brief delay (allow UI to show selection)
      const timer = setTimeout(() => clearSelection(), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedTiles, onSelectionChange, autoClear, maxSelection, clearSelection]);

  return {
    selectedTiles,
    toggleTile,
    canSelect,
    isSelected,
    clearSelection,
    selectTiles,
    selectionCount,
    isMaxReached,
  };
}
