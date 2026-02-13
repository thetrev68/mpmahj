import { useState, useCallback, useEffect } from 'react';
export type TileSelectionId = string;

type SelectionBlockReason = 'disabled' | 'max';

export type ToggleSelectionResult =
  | { status: 'selected' | 'deselected' }
  | { status: 'blocked'; reason: SelectionBlockReason };

/**
 * Options for useTileSelection hook
 */
export interface UseTileSelectionOptions {
  /** Maximum tiles that can be selected */
  maxSelection: number;

  /** Tile ids that cannot be selected (e.g., Jokers during Charleston) */
  disabledIds?: TileSelectionId[];

  /** Initial selection */
  initialSelection?: TileSelectionId[];

  /** Callback when selection changes */
  onSelectionChange?: (selected: TileSelectionId[]) => void;

  /** Auto-clear selection after action */
  autoClear?: boolean;
}

/**
 * Return type for useTileSelection hook
 */
export interface UseTileSelectionReturn {
  /** Currently selected tiles */
  selectedIds: TileSelectionId[];

  /** Toggle a tile's selection */
  toggleTile: (tileId: TileSelectionId) => ToggleSelectionResult;

  /** Check if a tile can be selected */
  canSelect: (tileId: TileSelectionId) => boolean;

  /** Check if a tile is selected */
  isSelected: (tileId: TileSelectionId) => boolean;

  /** Clear all selections */
  clearSelection: () => void;

  /** Select specific tiles (for programmatic selection) */
  selectTiles: (tileIds: TileSelectionId[]) => void;

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
export function useTileSelection(options: UseTileSelectionOptions): UseTileSelectionReturn {
  const {
    maxSelection,
    disabledIds = [],
    initialSelection = [],
    onSelectionChange,
    autoClear = false,
  } = options;

  // State
  const [selectedIds, setSelectedIds] = useState<TileSelectionId[]>(initialSelection);

  // Derived state
  const selectionCount = selectedIds.length;
  const isMaxReached = selectionCount >= maxSelection;

  /**
   * Check if a tile is currently selected
   */
  const isSelected = useCallback(
    (tileId: TileSelectionId): boolean => {
      return selectedIds.includes(tileId);
    },
    [selectedIds]
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
    (tileId: TileSelectionId): boolean => {
      // Already selected tiles can always be toggled (to deselect)
      if (isSelected(tileId)) return true;

      // Check if disabled
      if (disabledIds.includes(tileId)) return false;

      // Check if max reached
      if (selectionCount >= maxSelection) return false;

      return true;
    },
    [disabledIds, selectionCount, maxSelection, isSelected]
  );

  /**
   * Toggle a tile's selection state
   */
  const toggleTile = useCallback(
    (tileId: TileSelectionId): ToggleSelectionResult => {
      if (isSelected(tileId)) {
        // Deselect
        setSelectedIds((prev) => prev.filter((t) => t !== tileId));
        return { status: 'deselected' };
      }

      if (disabledIds.includes(tileId)) {
        return { status: 'blocked', reason: 'disabled' };
      }

      if (selectionCount >= maxSelection) {
        return { status: 'blocked', reason: 'max' };
      }

      if (canSelect(tileId)) {
        // Select
        setSelectedIds((prev) => [...prev, tileId]);
        return { status: 'selected' };
      }
      // If can't select (disabled or max reached), do nothing
      return { status: 'blocked', reason: 'max' };
    },
    [isSelected, canSelect, disabledIds, selectionCount, maxSelection]
  );

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  /**
   * Set tiles directly (programmatic selection)
   *
   * Filters out disabled tiles and respects max selection limit
   */
  const selectTiles = useCallback(
    (tileIds: TileSelectionId[]) => {
      // Filter out disabled tiles
      const validTiles = tileIds.filter((tileId) => !disabledIds.includes(tileId));

      // Respect max selection limit
      const limitedTiles = validTiles.slice(0, maxSelection);

      setSelectedIds(limitedTiles);
    },
    [disabledIds, maxSelection]
  );

  /**
   * Trigger callback when selection changes
   */
  useEffect(() => {
    onSelectionChange?.(selectedIds);

    if (autoClear && selectedIds.length === maxSelection) {
      // Clear after a brief delay (allow UI to show selection)
      const timer = setTimeout(() => clearSelection(), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedIds, onSelectionChange, autoClear, maxSelection, clearSelection]);

  return {
    selectedIds,
    toggleTile,
    canSelect,
    isSelected,
    clearSelection,
    selectTiles,
    selectionCount,
    isMaxReached,
  };
}
