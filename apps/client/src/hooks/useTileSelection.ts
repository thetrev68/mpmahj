import { useState, useCallback, useEffect } from 'react';

/**
 * Options for useTileSelection hook
 */
export interface UseTileSelectionOptions {
  /** Maximum tiles that can be selected */
  maxSelection: number;

  /** Tiles that cannot be selected */
  disabledTiles?: (number | string)[];

  /** Initial selection */
  initialSelection?: (number | string)[];

  /** Callback when selection changes */
  onSelectionChange?: (selected: (number | string)[]) => void;

  /** Auto-clear selection after action */
  autoClear?: boolean;
}

/**
 * Return type for useTileSelection hook
 */
export interface UseTileSelectionReturn {
  /** Currently selected tiles */
  selectedTiles: (number | string)[];

  /** Toggle a tile's selection */
  toggleTile: (tile: number | string) => void;

  /** Check if a tile can be selected */
  canSelect: (tile: number | string) => boolean;

  /** Check if a tile is selected */
  isSelected: (tile: number | string) => boolean;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select specific tiles (for programmatic selection) */
  selectTiles: (tiles: (number | string)[]) => void;

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
  const [selectedTiles, setSelectedTiles] = useState<(number | string)[]>(
    initialSelection
  );

  // Derived state
  const selectionCount = selectedTiles.length;
  const isMaxReached = selectionCount >= maxSelection;

  /**
   * Check if a tile is currently selected
   */
  const isSelected = useCallback(
    (tile: number | string): boolean => {
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
    (tile: number | string): boolean => {
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
    (tile: number | string) => {
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
    (tiles: (number | string)[]) => {
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
