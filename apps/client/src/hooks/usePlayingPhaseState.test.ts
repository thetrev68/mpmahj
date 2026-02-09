/**
 * Tests for usePlayingPhaseState Hook
 *
 * Tests the Playing phase state management hook using React Testing Library's renderHook
 */

import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayingPhaseState } from './usePlayingPhaseState';
import type { ResolutionOverlayData } from './usePlayingPhaseState';

describe('usePlayingPhaseState', () => {
  describe('initial state', () => {
    test('returns correct initial state', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.mostRecentDiscard).toBeNull();
      expect(result.current.discardAnimationTile).toBeNull();
      expect(result.current.resolutionOverlay).toBeNull();
    });
  });

  describe('setProcessing()', () => {
    test('sets processing flag to true', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      expect(result.current.isProcessing).toBe(false);

      act(() => {
        result.current.setProcessing(true);
      });

      expect(result.current.isProcessing).toBe(true);
    });

    test('sets processing flag to false', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setProcessing(true);
      });
      expect(result.current.isProcessing).toBe(true);

      act(() => {
        result.current.setProcessing(false);
      });
      expect(result.current.isProcessing).toBe(false);
    });

    test('can toggle processing flag multiple times', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setProcessing(true);
      });
      expect(result.current.isProcessing).toBe(true);

      act(() => {
        result.current.setProcessing(false);
      });
      expect(result.current.isProcessing).toBe(false);

      act(() => {
        result.current.setProcessing(true);
      });
      expect(result.current.isProcessing).toBe(true);
    });
  });

  describe('setMostRecentDiscard()', () => {
    test('sets most recent discard tile', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setMostRecentDiscard(5);
      });

      expect(result.current.mostRecentDiscard).toBe(5);
    });

    test('updates most recent discard tile', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setMostRecentDiscard(5);
      });
      expect(result.current.mostRecentDiscard).toBe(5);

      act(() => {
        result.current.setMostRecentDiscard(10);
      });
      expect(result.current.mostRecentDiscard).toBe(10);
    });

    test('can set most recent discard to null', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setMostRecentDiscard(8);
      });
      expect(result.current.mostRecentDiscard).toBe(8);

      act(() => {
        result.current.setMostRecentDiscard(null);
      });
      expect(result.current.mostRecentDiscard).toBeNull();
    });
  });

  describe('setDiscardAnimation()', () => {
    test('sets discard animation tile', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setDiscardAnimation(12);
      });

      expect(result.current.discardAnimationTile).toBe(12);
    });

    test('updates discard animation tile', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setDiscardAnimation(5);
      });
      expect(result.current.discardAnimationTile).toBe(5);

      act(() => {
        result.current.setDiscardAnimation(15);
      });
      expect(result.current.discardAnimationTile).toBe(15);
    });

    test('can clear discard animation', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setDiscardAnimation(10);
      });
      expect(result.current.discardAnimationTile).toBe(10);

      act(() => {
        result.current.setDiscardAnimation(null);
      });
      expect(result.current.discardAnimationTile).toBeNull();
    });

    test('is independent from mostRecentDiscard', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      act(() => {
        result.current.setMostRecentDiscard(5);
        result.current.setDiscardAnimation(5);
      });

      expect(result.current.mostRecentDiscard).toBe(5);
      expect(result.current.discardAnimationTile).toBe(5);

      act(() => {
        result.current.setDiscardAnimation(null);
      });

      expect(result.current.mostRecentDiscard).toBe(5);
      expect(result.current.discardAnimationTile).toBeNull();
    });
  });

  describe('showResolutionOverlay()', () => {
    test('shows resolution overlay with data', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      const overlayData: ResolutionOverlayData = {
        resolution: { Mahjong: 'East' },
        tieBreak: null,
        allCallers: [{ seat: 'East', kind: 'Mahjong' }],
        discardedBy: 'South',
      };

      act(() => {
        result.current.showResolutionOverlay(overlayData);
      });

      expect(result.current.resolutionOverlay).toEqual(overlayData);
    });

    test('shows resolution overlay with tie break', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      const overlayData: ResolutionOverlayData = {
        resolution: {
          Meld: {
            seat: 'West',
            meld: {
              tiles: [5, 5, 5, 5],
              meld_type: 'Kong',
              called_tile: 5,
              joker_assignments: {},
            },
          },
        },
        tieBreak: { SeatOrder: { discarded_by: 'North', contenders: ['South', 'West'] } },
        allCallers: [
          { seat: 'South', kind: { Meld: { meld_type: 'Pung' } } },
          { seat: 'West', kind: { Meld: { meld_type: 'Kong' } } },
        ],
        discardedBy: 'North',
      };

      act(() => {
        result.current.showResolutionOverlay(overlayData);
      });

      expect(result.current.resolutionOverlay).toEqual(overlayData);
      expect(result.current.resolutionOverlay?.tieBreak).toEqual({
        SeatOrder: { discarded_by: 'North', contenders: ['South', 'West'] },
      });
    });

    test('replaces previous overlay data', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      const overlay1: ResolutionOverlayData = {
        resolution: { Mahjong: 'East' },
        tieBreak: null,
        allCallers: [{ seat: 'East', kind: 'Mahjong' }],
        discardedBy: 'South',
      };

      const overlay2: ResolutionOverlayData = {
        resolution: {
          Meld: {
            seat: 'West',
            meld: { tiles: [5, 5, 5], meld_type: 'Pung', called_tile: 5, joker_assignments: {} },
          },
        },
        tieBreak: { SeatOrder: { discarded_by: 'North', contenders: ['West'] } },
        allCallers: [{ seat: 'West', kind: { Meld: { meld_type: 'Pung' } } }],
        discardedBy: 'North',
      };

      act(() => {
        result.current.showResolutionOverlay(overlay1);
      });
      expect(result.current.resolutionOverlay?.discardedBy).toBe('South');

      act(() => {
        result.current.showResolutionOverlay(overlay2);
      });
      expect(result.current.resolutionOverlay?.discardedBy).toBe('North');
      expect(result.current.resolutionOverlay?.tieBreak).toEqual({
        SeatOrder: { discarded_by: 'North', contenders: ['West'] },
      });
    });
  });

  describe('dismissResolutionOverlay()', () => {
    test('clears resolution overlay', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      const overlayData: ResolutionOverlayData = {
        resolution: { Mahjong: 'East' },
        tieBreak: null,
        allCallers: [{ seat: 'East', kind: 'Mahjong' }],
        discardedBy: 'South',
      };

      act(() => {
        result.current.showResolutionOverlay(overlayData);
      });
      expect(result.current.resolutionOverlay).not.toBeNull();

      act(() => {
        result.current.dismissResolutionOverlay();
      });
      expect(result.current.resolutionOverlay).toBeNull();
    });

    test('does nothing if overlay is already null', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      expect(result.current.resolutionOverlay).toBeNull();

      act(() => {
        result.current.dismissResolutionOverlay();
      });
      expect(result.current.resolutionOverlay).toBeNull();
    });
  });

  describe('reset()', () => {
    test('clears all state to initial values', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      // Set various state values
      act(() => {
        result.current.setProcessing(true);
        result.current.setMostRecentDiscard(10);
        result.current.setDiscardAnimation(10);
        result.current.showResolutionOverlay({
          resolution: { Mahjong: 'East' },
          tieBreak: null,
          allCallers: [{ seat: 'East', kind: 'Mahjong' }],
          discardedBy: 'South',
        });
      });

      // Verify state was set
      expect(result.current.isProcessing).toBe(true);
      expect(result.current.mostRecentDiscard).toBe(10);
      expect(result.current.discardAnimationTile).toBe(10);
      expect(result.current.resolutionOverlay).not.toBeNull();

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state cleared
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.mostRecentDiscard).toBeNull();
      expect(result.current.discardAnimationTile).toBeNull();
      expect(result.current.resolutionOverlay).toBeNull();
    });

    test('can be called when already at initial state', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      expect(result.current.isProcessing).toBe(false);

      act(() => {
        result.current.reset();
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.mostRecentDiscard).toBeNull();
      expect(result.current.discardAnimationTile).toBeNull();
      expect(result.current.resolutionOverlay).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    test('full discard lifecycle', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      // 1. Start processing discard
      act(() => {
        result.current.setProcessing(true);
      });
      expect(result.current.isProcessing).toBe(true);

      // 2. Show discard animation
      act(() => {
        result.current.setDiscardAnimation(12);
      });
      expect(result.current.discardAnimationTile).toBe(12);

      // 3. Set most recent discard (after animation completes)
      act(() => {
        result.current.setDiscardAnimation(null);
        result.current.setMostRecentDiscard(12);
        result.current.setProcessing(false);
      });
      expect(result.current.discardAnimationTile).toBeNull();
      expect(result.current.mostRecentDiscard).toBe(12);
      expect(result.current.isProcessing).toBe(false);

      // 4. Clear after timeout
      act(() => {
        result.current.setMostRecentDiscard(null);
      });
      expect(result.current.mostRecentDiscard).toBeNull();
    });

    test('call resolution lifecycle', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      // 1. Multiple players call the same discard
      const overlayData: ResolutionOverlayData = {
        resolution: {
          Meld: {
            seat: 'West',
            meld: {
              tiles: [5, 5, 5, 5],
              meld_type: 'Kong',
              called_tile: 5,
              joker_assignments: {},
            },
          },
        },
        tieBreak: { SeatOrder: { discarded_by: 'East', contenders: ['South', 'West'] } },
        allCallers: [
          { seat: 'South', kind: { Meld: { meld_type: 'Pung' } } },
          { seat: 'West', kind: { Meld: { meld_type: 'Kong' } } },
        ],
        discardedBy: 'East',
      };

      // 2. Show resolution overlay
      act(() => {
        result.current.showResolutionOverlay(overlayData);
      });
      expect(result.current.resolutionOverlay).not.toBeNull();
      expect(result.current.resolutionOverlay?.allCallers).toHaveLength(2);

      // 3. User dismisses overlay
      act(() => {
        result.current.dismissResolutionOverlay();
      });
      expect(result.current.resolutionOverlay).toBeNull();
    });

    test('winning call overlay', () => {
      const { result } = renderHook(() => usePlayingPhaseState());

      const winOverlay: ResolutionOverlayData = {
        resolution: { Mahjong: 'North' },
        tieBreak: null,
        allCallers: [{ seat: 'North', kind: 'Mahjong' }],
        discardedBy: 'West',
      };

      act(() => {
        result.current.showResolutionOverlay(winOverlay);
      });

      expect(result.current.resolutionOverlay?.resolution).toEqual({ Mahjong: 'North' });
      expect(result.current.resolutionOverlay?.tieBreak).toBeNull();
    });
  });
});
