import { describe, expect, test, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTileSelection } from './useTileSelection';
import type { Tile } from '@/types/bindings';

/**
 * Tests for useTileSelection hook
 *
 * Coverage:
 * - P0: Tracks selected tile indices
 * - P0: Toggles selection on tile click
 * - P0: Enforces max selection limit (e.g., 3 for Charleston)
 * - P0: Prevents selection of disabled tiles
 * - P0: Clears selection on command
 *
 * Based on spec: docs/implementation/frontend/component-specs/hooks/useTileSelection.md
 */
describe('useTileSelection Hook', () => {
  describe('Selection Tracking - P0', () => {
    test('initializes with empty selection by default', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      expect(result.current.selectedTiles).toEqual([]);
      expect(result.current.selectionCount).toBe(0);
      expect(result.current.isMaxReached).toBe(false);
    });

    test('initializes with provided initial selection', () => {
      const initialTiles: Tile[] = [0, 5, 10];
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: initialTiles,
        })
      );

      expect(result.current.selectedTiles).toEqual(initialTiles);
      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isMaxReached).toBe(true);
    });
  });

  describe('Toggle Selection - P0', () => {
    test('selects a tile when toggled from unselected state', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).toContain(5);
      expect(result.current.selectionCount).toBe(1);
    });

    test('deselects a tile when toggled from selected state', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).not.toContain(5);
      expect(result.current.selectedTiles).toEqual([0, 10]);
      expect(result.current.selectionCount).toBe(2);
    });

    test('allows multiple tiles to be selected up to max', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      act(() => {
        result.current.toggleTile(0);
        result.current.toggleTile(5);
        result.current.toggleTile(10);
      });

      expect(result.current.selectedTiles).toEqual([0, 5, 10]);
      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isMaxReached).toBe(true);
    });
  });

  describe('Max Selection Limit - P0', () => {
    test('prevents selection beyond max limit', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      // Try to select a 4th tile
      act(() => {
        result.current.toggleTile(15);
      });

      // Selection should remain unchanged
      expect(result.current.selectedTiles).toEqual([0, 5, 10]);
      expect(result.current.selectionCount).toBe(3);
      expect(result.current.isMaxReached).toBe(true);
    });

    test('allows selection after deselecting when at max', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      // Deselect one tile
      act(() => {
        result.current.toggleTile(5);
      });

      // Now we can select a different tile
      act(() => {
        result.current.toggleTile(15);
      });

      expect(result.current.selectedTiles).toEqual([0, 10, 15]);
      expect(result.current.selectionCount).toBe(3);
    });

    test('canSelect returns false when max is reached for unselected tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      expect(result.current.canSelect(15)).toBe(false);
      expect(result.current.canSelect(20)).toBe(false);
    });

    test('canSelect returns true for already selected tiles even at max', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      // Selected tiles can always be toggled (to deselect)
      expect(result.current.canSelect(0)).toBe(true);
      expect(result.current.canSelect(5)).toBe(true);
      expect(result.current.canSelect(10)).toBe(true);
    });
  });

  describe('Disabled Tiles - P0', () => {
    test('prevents selection of disabled tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: [42, 43], // Joker and Blank
        })
      );

      act(() => {
        result.current.toggleTile(42);
      });

      expect(result.current.selectedTiles).not.toContain(42);
      expect(result.current.selectionCount).toBe(0);
    });

    test('canSelect returns false for disabled tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: [42, 43],
        })
      );

      expect(result.current.canSelect(42)).toBe(false);
      expect(result.current.canSelect(43)).toBe(false);
      expect(result.current.canSelect(0)).toBe(true);
    });

    test('allows selection of non-disabled tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: [42],
        })
      );

      act(() => {
        result.current.toggleTile(0);
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).toEqual([0, 5]);
      expect(result.current.selectionCount).toBe(2);
    });
  });

  describe('Clear Selection - P0', () => {
    test('clears all selected tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedTiles).toEqual([]);
      expect(result.current.selectionCount).toBe(0);
      expect(result.current.isMaxReached).toBe(false);
    });
  });

  describe('isSelected Helper - P0', () => {
    test('correctly identifies selected tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
        })
      );

      expect(result.current.isSelected(0)).toBe(true);
      expect(result.current.isSelected(5)).toBe(true);
      expect(result.current.isSelected(10)).toBe(true);
      expect(result.current.isSelected(15)).toBe(false);
    });
  });

  describe('Programmatic Selection - P0', () => {
    test('selectTiles sets tiles directly', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      act(() => {
        result.current.selectTiles([0, 5, 10]);
      });

      expect(result.current.selectedTiles).toEqual([0, 5, 10]);
      expect(result.current.selectionCount).toBe(3);
    });

    test('selectTiles respects max selection limit', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      act(() => {
        result.current.selectTiles([0, 5, 10, 15]);
      });

      // Should only select first 3 tiles
      expect(result.current.selectedTiles).toEqual([0, 5, 10]);
      expect(result.current.selectionCount).toBe(3);
    });

    test('selectTiles filters out disabled tiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: [42],
        })
      );

      act(() => {
        result.current.selectTiles([0, 42, 10]);
      });

      expect(result.current.selectedTiles).toEqual([0, 10]);
      expect(result.current.selectionCount).toBe(2);
    });
  });

  describe('Callback Integration - P0', () => {
    test('calls onSelectionChange when selection changes', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          onSelectionChange,
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(onSelectionChange).toHaveBeenCalledWith([5]);
    });

    test('calls onSelectionChange with updated selection on deselect', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
          onSelectionChange,
        })
      );

      // Clear the initial call
      onSelectionChange.mockClear();

      act(() => {
        result.current.toggleTile(5);
      });

      expect(onSelectionChange).toHaveBeenCalledWith([0, 10]);
    });

    test('calls onSelectionChange when cleared', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          initialSelection: [0, 5, 10],
          onSelectionChange,
        })
      );

      // Clear the initial call
      onSelectionChange.mockClear();

      act(() => {
        result.current.clearSelection();
      });

      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Edge Cases - P0', () => {
    test('handles selecting the same tile multiple times', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
        })
      );

      // Each toggle must be in separate act() to ensure state updates between calls
      act(() => {
        result.current.toggleTile(5);
      });
      act(() => {
        result.current.toggleTile(5);
      });
      act(() => {
        result.current.toggleTile(5);
      });

      // Should end up selected (toggled odd number of times from unselected)
      // Toggle 1: selected, Toggle 2: unselected, Toggle 3: selected
      expect(result.current.isSelected(5)).toBe(true);
      expect(result.current.selectionCount).toBe(1);
    });

    test('handles max selection of 1', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 1,
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).toEqual([5]);
      expect(result.current.isMaxReached).toBe(true);

      // Try to select another
      act(() => {
        result.current.toggleTile(10);
      });

      // Should still only have first selection
      expect(result.current.selectedTiles).toEqual([5]);
    });

    test('handles empty disabledTiles array', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: [],
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).toContain(5);
    });

    test('handles undefined disabledTiles', () => {
      const { result } = renderHook(() =>
        useTileSelection({
          maxSelection: 3,
          disabledTiles: undefined,
        })
      );

      act(() => {
        result.current.toggleTile(5);
      });

      expect(result.current.selectedTiles).toContain(5);
    });
  });
});
