import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ANIMATION_SETTINGS_STORAGE_KEY,
  DEFAULT_ANIMATION_SETTINGS,
  useAnimationSettings,
} from './useAnimationSettings';

interface MatchMediaControls {
  setMatches: (next: boolean) => void;
}

function mockMatchMedia(initialMatches: boolean): MatchMediaControls {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    })),
  });

  return {
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

describe('useAnimationSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
  });

  test('loads defaults when storage is empty', () => {
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.settings).toEqual(DEFAULT_ANIMATION_SETTINGS);
    expect(result.current.speedMultiplier).toBe(1);
  });

  test('loads persisted settings from localStorage', () => {
    localStorage.setItem(
      ANIMATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        speed: 'fast',
        tile_movement: false,
        charleston_pass: true,
        meld_formation: false,
        dice_roll: true,
        win_celebration: true,
        respect_reduced_motion: true,
      })
    );

    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.settings.speed).toBe('fast');
    expect(result.current.settings.tile_movement).toBe(false);
    expect(result.current.speedMultiplier).toBe(0.5);
  });

  test('persists updated settings to localStorage', () => {
    const { result } = renderHook(() => useAnimationSettings());

    act(() => {
      result.current.updateSettings({ speed: 'slow', charleston_pass: false });
    });

    const stored = JSON.parse(localStorage.getItem(ANIMATION_SETTINGS_STORAGE_KEY) ?? '{}') as {
      speed?: string;
      charleston_pass?: boolean;
    };
    expect(stored.speed).toBe('slow');
    expect(stored.charleston_pass).toBe(false);
  });

  test('applies speed multipliers to duration', () => {
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.getDuration(400)).toBe(400);

    act(() => {
      result.current.updateSettings({ speed: 'fast' });
    });
    expect(result.current.getDuration(400)).toBe(200);

    act(() => {
      result.current.updateSettings({ speed: 'slow' });
    });
    expect(result.current.getDuration(400)).toBe(800);
  });

  test('disables all animations when speed is off', () => {
    const { result } = renderHook(() => useAnimationSettings());

    act(() => {
      result.current.updateSettings({ speed: 'off' });
    });

    expect(result.current.speedMultiplier).toBe(0);
    expect(result.current.isEnabled('tile_movement')).toBe(false);
    expect(result.current.isEnabled('charleston_pass')).toBe(false);
  });

  test('supports per-animation toggles independently', () => {
    const { result } = renderHook(() => useAnimationSettings());

    act(() => {
      result.current.updateSettings({
        tile_movement: false,
        charleston_pass: true,
        meld_formation: false,
      });
    });

    expect(result.current.isEnabled('tile_movement')).toBe(false);
    expect(result.current.isEnabled('charleston_pass')).toBe(true);
    expect(result.current.isEnabled('meld_formation')).toBe(false);
  });

  test('respects reduced motion by default when media query matches', () => {
    const controls = mockMatchMedia(true);
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.speedMultiplier).toBe(0);
    expect(result.current.isEnabled('win_celebration')).toBe(false);

    act(() => {
      controls.setMatches(false);
    });

    expect(result.current.prefersReducedMotion).toBe(false);
    expect(result.current.reducedMotion).toBe(false);
  });

  test('allows overriding reduced motion', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.reducedMotion).toBe(true);

    act(() => {
      result.current.updateSettings({ respect_reduced_motion: false });
    });

    expect(result.current.reducedMotion).toBe(false);
    expect(result.current.isEnabled('tile_movement')).toBe(true);
  });
});
