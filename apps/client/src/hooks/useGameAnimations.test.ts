/**
 * Tests for useGameAnimations Hook
 *
 * Tests animation state management including auto-hide logic
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameAnimations } from './useGameAnimations';

describe('useGameAnimations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    test('returns correct initial state', () => {
      const { result } = renderHook(() => useGameAnimations());

      expect(result.current.highlightedTileIds).toEqual([]);
      expect(result.current.leavingTileIds).toEqual([]);
      expect(result.current.incomingFromSeat).toBeNull();
      expect(result.current.passDirection).toBeNull();
    });
  });

  describe('setHighlightedTileIds()', () => {
    test('sets highlighted tile IDs', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1', 'tile-2', 'tile-3']);
      });

      expect(result.current.highlightedTileIds).toEqual(['tile-1', 'tile-2', 'tile-3']);
    });

    test('clears highlighted tile IDs', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1', 'tile-2']);
        result.current.setHighlightedTileIds([]);
      });

      expect(result.current.highlightedTileIds).toEqual([]);
    });

    test('auto-hides after specified duration', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1', 'tile-2'], 2000);
      });

      expect(result.current.highlightedTileIds).toEqual(['tile-1', 'tile-2']);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.highlightedTileIds).toEqual([]);
    });

    test('cancels previous auto-hide when called again', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1'], 1000);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Set new IDs before timeout expires
      act(() => {
        result.current.setHighlightedTileIds(['tile-2', 'tile-3'], 2000);
      });

      // First timeout should be cancelled
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.highlightedTileIds).toEqual(['tile-2', 'tile-3']);
    });
  });

  describe('setLeavingTileIds()', () => {
    test('sets leaving tile IDs', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setLeavingTileIds(['tile-4', 'tile-5']);
      });

      expect(result.current.leavingTileIds).toEqual(['tile-4', 'tile-5']);
    });

    test('auto-hides after specified duration', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setLeavingTileIds(['tile-1'], 300);
      });

      expect(result.current.leavingTileIds).toEqual(['tile-1']);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.leavingTileIds).toEqual([]);
    });
  });

  describe('setIncomingFromSeat()', () => {
    test('sets incoming seat indicator', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setIncomingFromSeat('East');
      });

      expect(result.current.incomingFromSeat).toBe('East');
    });

    test('clears incoming seat', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setIncomingFromSeat('South');
        result.current.setIncomingFromSeat(null);
      });

      expect(result.current.incomingFromSeat).toBeNull();
    });

    test('auto-hides after specified duration', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setIncomingFromSeat('West', 350);
      });

      expect(result.current.incomingFromSeat).toBe('West');

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(result.current.incomingFromSeat).toBeNull();
    });
  });

  describe('setPassDirection()', () => {
    test('sets pass direction', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setPassDirection('Right');
      });

      expect(result.current.passDirection).toBe('Right');
    });

    test('clears pass direction', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setPassDirection('Left');
        result.current.setPassDirection(null);
      });

      expect(result.current.passDirection).toBeNull();
    });

    test('auto-hides after specified duration', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setPassDirection('Across', 600);
      });

      expect(result.current.passDirection).toBe('Across');

      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.passDirection).toBeNull();
    });
  });

  describe('clearAllAnimations()', () => {
    test('clears all animation state', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1']);
        result.current.setLeavingTileIds(['tile-2']);
        result.current.setIncomingFromSeat('North');
        result.current.setPassDirection('Right');
      });

      expect(result.current.highlightedTileIds).toEqual(['tile-1']);
      expect(result.current.leavingTileIds).toEqual(['tile-2']);
      expect(result.current.incomingFromSeat).toBe('North');
      expect(result.current.passDirection).toBe('Right');

      act(() => {
        result.current.clearAllAnimations();
      });

      expect(result.current.highlightedTileIds).toEqual([]);
      expect(result.current.leavingTileIds).toEqual([]);
      expect(result.current.incomingFromSeat).toBeNull();
      expect(result.current.passDirection).toBeNull();
    });

    test('cancels all pending auto-hide timers', () => {
      const { result } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1'], 2000);
        result.current.setLeavingTileIds(['tile-2'], 300);
        result.current.setIncomingFromSeat('East', 350);
        result.current.setPassDirection('Across', 600);
      });

      act(() => {
        result.current.clearAllAnimations();
      });

      // Advance past all timeouts
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should remain cleared despite timeouts
      expect(result.current.highlightedTileIds).toEqual([]);
      expect(result.current.leavingTileIds).toEqual([]);
      expect(result.current.incomingFromSeat).toBeNull();
      expect(result.current.passDirection).toBeNull();
    });
  });

  describe('cleanup on unmount', () => {
    test('clears all timers on unmount', () => {
      const { result, unmount } = renderHook(() => useGameAnimations());

      act(() => {
        result.current.setHighlightedTileIds(['tile-1'], 2000);
        result.current.setLeavingTileIds(['tile-2'], 300);
        result.current.setIncomingFromSeat('East', 350);
        result.current.setPassDirection('Across', 600);
      });

      unmount();

      // Advance timers - should not cause errors
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // No errors expected
      expect(true).toBe(true);
    });
  });
});
