/**
 * Tests for useCallWindowState Hook
 *
 * Tests the call window state management hook using React Testing Library's renderHook
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallWindowState } from './useCallWindowState';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { OpenCallWindowParams } from './useCallWindowState';

describe('useCallWindowState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    test('returns correct initial state', () => {
      const { result } = renderHook(() => useCallWindowState());

      expect(result.current.callWindow).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
      expect(result.current.callIntentsRef.current).toEqual({
        intents: [],
        discardedBy: null,
      });
    });
  });

  describe('openCallWindow()', () => {
    test('opens call window with provided parameters', () => {
      const { result } = renderHook(() => useCallWindowState());

      const params: OpenCallWindowParams = {
        tile: 5,
        discardedBy: 'East',
        canCall: ['South', 'West'],
        timerDuration: 10,
        timerStart: Date.now(),
      };

      act(() => {
        result.current.openCallWindow(params);
      });

      expect(result.current.callWindow).toEqual({
        active: true,
        tile: 5,
        discardedBy: 'East',
        canCall: ['South', 'West'],
        canAct: ['South', 'West'], // Initially same as canCall
        intents: [],
        timerStart: params.timerStart,
        timerDuration: 10,
        hasResponded: false,
      });
    });

    test('initializes callIntents ref', () => {
      const { result } = renderHook(() => useCallWindowState());

      const params: OpenCallWindowParams = {
        tile: 10,
        discardedBy: 'North',
        canCall: ['East'],
        timerDuration: 15,
        timerStart: Date.now(),
      };

      act(() => {
        result.current.openCallWindow(params);
      });

      expect(result.current.callIntentsRef.current).toEqual({
        intents: [],
        discardedBy: 'North',
      });
    });

    test('overwrites previous call window state', () => {
      const { result } = renderHook(() => useCallWindowState());

      // Open first window
      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      expect(result.current.callWindow?.tile).toBe(5);

      // Open second window
      act(() => {
        result.current.openCallWindow({
          tile: 15,
          discardedBy: 'West',
          canCall: ['North', 'South'],
          timerDuration: 8,
          timerStart: Date.now(),
        });
      });

      expect(result.current.callWindow?.tile).toBe(15);
      expect(result.current.callWindow?.discardedBy).toBe('West');
      expect(result.current.callWindow?.canCall).toEqual(['North', 'South']);
    });
  });

  describe('updateProgress()', () => {
    test('updates canAct and intents in call window state', () => {
      const { result } = renderHook(() => useCallWindowState());

      // Open window first
      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South', 'West', 'North'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      const intents: CallIntentSummary[] = [
        { seat: 'South', kind: { Meld: { meld_type: 'Pung' } } },
        { seat: 'West', kind: { Meld: { meld_type: 'Kong' } } },
      ];

      act(() => {
        result.current.updateProgress(['North'], intents);
      });

      expect(result.current.callWindow?.canAct).toEqual(['North']);
      expect(result.current.callWindow?.intents).toEqual(intents);
    });

    test('updates callIntents ref', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South', 'West'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      const intents: CallIntentSummary[] = [{ seat: 'South', kind: 'Mahjong' }];

      act(() => {
        result.current.updateProgress(['West'], intents);
      });

      expect(result.current.callIntentsRef.current.intents).toEqual(intents);
    });

    test('does nothing if call window is not open', () => {
      const { result } = renderHook(() => useCallWindowState());

      const intents: CallIntentSummary[] = [
        { seat: 'South', kind: { Meld: { meld_type: 'Pung' } } },
      ];

      act(() => {
        result.current.updateProgress(['South'], intents);
      });

      expect(result.current.callWindow).toBeNull();
      // Ref should still update
      expect(result.current.callIntentsRef.current.intents).toEqual(intents);
    });

    test('preserves other call window properties', () => {
      const { result } = renderHook(() => useCallWindowState());

      const timerStart = Date.now();
      act(() => {
        result.current.openCallWindow({
          tile: 8,
          discardedBy: 'North',
          canCall: ['East', 'South'],
          timerDuration: 12,
          timerStart,
        });
      });

      act(() => {
        result.current.updateProgress(['East'], []);
      });

      // Should preserve original properties
      expect(result.current.callWindow?.tile).toBe(8);
      expect(result.current.callWindow?.discardedBy).toBe('North');
      expect(result.current.callWindow?.timerDuration).toBe(12);
      expect(result.current.callWindow?.timerStart).toBe(timerStart);
    });
  });

  describe('closeCallWindow()', () => {
    test('clears call window and timer state', () => {
      const { result } = renderHook(() => useCallWindowState());

      // Open window and set timer
      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
        result.current.setTimerRemaining(7);
      });

      expect(result.current.callWindow).not.toBeNull();
      expect(result.current.timerRemaining).toBe(7);

      act(() => {
        result.current.closeCallWindow();
      });

      expect(result.current.callWindow).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
    });

    test('clears callIntents ref after 100ms delay', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
        result.current.updateProgress(
          ['South'],
          [{ seat: 'South', kind: { Meld: { meld_type: 'Pung' } } }]
        );
      });

      // Verify ref has data
      expect(result.current.callIntentsRef.current.intents).toHaveLength(1);

      act(() => {
        result.current.closeCallWindow();
      });

      // Ref should still have data immediately
      expect(result.current.callIntentsRef.current.intents).toHaveLength(1);

      // Advance timers to clear ref
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.callIntentsRef.current).toEqual({
        intents: [],
        discardedBy: null,
      });
    });
  });

  describe('markResponded()', () => {
    test('marks call window as responded without message', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      expect(result.current.callWindow?.hasResponded).toBe(false);

      act(() => {
        result.current.markResponded();
      });

      expect(result.current.callWindow?.hasResponded).toBe(true);
      expect(result.current.callWindow?.responseMessage).toBeUndefined();
    });

    test('marks call window as responded with message', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      act(() => {
        result.current.markResponded('Called for Pung');
      });

      expect(result.current.callWindow?.hasResponded).toBe(true);
      expect(result.current.callWindow?.responseMessage).toBe('Called for Pung');
    });

    test('does nothing if call window is not open', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.markResponded('Test message');
      });

      expect(result.current.callWindow).toBeNull();
    });

    test('preserves other call window properties', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 10,
          discardedBy: 'West',
          canCall: ['North'],
          timerDuration: 15,
          timerStart: Date.now(),
        });
      });

      act(() => {
        result.current.markResponded('Passed');
      });

      expect(result.current.callWindow?.tile).toBe(10);
      expect(result.current.callWindow?.discardedBy).toBe('West');
    });
  });

  describe('setTimerRemaining()', () => {
    test('updates timer remaining value', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.setTimerRemaining(10);
      });

      expect(result.current.timerRemaining).toBe(10);
    });

    test('can countdown timer', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.setTimerRemaining(5);
      });
      expect(result.current.timerRemaining).toBe(5);

      act(() => {
        result.current.setTimerRemaining(4);
      });
      expect(result.current.timerRemaining).toBe(4);

      act(() => {
        result.current.setTimerRemaining(0);
      });
      expect(result.current.timerRemaining).toBe(0);
    });

    test('can set timer to null', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.setTimerRemaining(10);
      });
      expect(result.current.timerRemaining).toBe(10);

      act(() => {
        result.current.setTimerRemaining(null);
      });
      expect(result.current.timerRemaining).toBeNull();
    });
  });

  describe('reset()', () => {
    test('clears all state to initial values', () => {
      const { result } = renderHook(() => useCallWindowState());

      // Set various state values
      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South', 'West'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
        result.current.updateProgress(
          ['South'],
          [{ seat: 'South', kind: { Meld: { meld_type: 'Pung' } } }]
        );
        result.current.markResponded('Test response');
        result.current.setTimerRemaining(7);
      });

      // Verify state was set
      expect(result.current.callWindow).not.toBeNull();
      expect(result.current.timerRemaining).toBe(7);
      expect(result.current.callIntentsRef.current.intents).toHaveLength(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify all state cleared
      expect(result.current.callWindow).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
      expect(result.current.callIntentsRef.current).toEqual({
        intents: [],
        discardedBy: null,
      });
    });

    test('can be called when already at initial state', () => {
      const { result } = renderHook(() => useCallWindowState());

      expect(result.current.callWindow).toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.callWindow).toBeNull();
      expect(result.current.timerRemaining).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    test('full call window lifecycle', () => {
      const { result } = renderHook(() => useCallWindowState());

      // 1. Open call window
      act(() => {
        result.current.openCallWindow({
          tile: 12,
          discardedBy: 'North',
          canCall: ['East', 'South', 'West'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      expect(result.current.callWindow?.active).toBe(true);
      expect(result.current.callWindow?.canAct).toEqual(['East', 'South', 'West']);

      // 2. Update with first intent
      act(() => {
        result.current.updateProgress(
          ['South', 'West'],
          [{ seat: 'East', kind: { Meld: { meld_type: 'Pung' } } }]
        );
      });

      expect(result.current.callWindow?.canAct).toEqual(['South', 'West']);
      expect(result.current.callWindow?.intents).toHaveLength(1);

      // 3. Update with more intents
      act(() => {
        result.current.updateProgress(
          ['West'],
          [
            { seat: 'East', kind: { Meld: { meld_type: 'Pung' } } },
            { seat: 'South', kind: { Meld: { meld_type: 'Kong' } } },
          ]
        );
      });

      expect(result.current.callWindow?.canAct).toEqual(['West']);
      expect(result.current.callWindow?.intents).toHaveLength(2);

      // 4. Mark responded
      act(() => {
        result.current.markResponded('Called for Mahjong');
      });

      expect(result.current.callWindow?.hasResponded).toBe(true);

      // 5. Close window
      act(() => {
        result.current.closeCallWindow();
      });

      expect(result.current.callWindow).toBeNull();
    });

    test('timer countdown lifecycle', () => {
      const { result } = renderHook(() => useCallWindowState());

      act(() => {
        result.current.openCallWindow({
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        });
      });

      // Simulate timer countdown
      for (let i = 10; i >= 0; i--) {
        act(() => {
          result.current.setTimerRemaining(i);
        });
        expect(result.current.timerRemaining).toBe(i);
      }

      // Note: No auto-pass logic - timer is display-only
      expect(result.current.callWindow?.hasResponded).toBe(false);
    });
  });
});
