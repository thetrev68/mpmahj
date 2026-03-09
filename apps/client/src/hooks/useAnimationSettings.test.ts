import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useAnimationSettings } from './useAnimationSettings';

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
    mockMatchMedia(false);
  });

  test('returns normal timing defaults when reduced motion is off', () => {
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.prefersReducedMotion).toBe(false);
    expect(result.current.getDuration(500)).toBe(500);
    expect(result.current.isEnabled()).toBe(true);
  });

  test('disables all animations when reduced motion is active', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.getDuration(500)).toBe(0);
    expect(result.current.isEnabled()).toBe(false);
  });

  test('reacts to runtime reduced-motion preference changes', () => {
    const controls = mockMatchMedia(false);
    const { result } = renderHook(() => useAnimationSettings());

    expect(result.current.getDuration(400)).toBe(400);

    act(() => {
      controls.setMatches(true);
    });

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.getDuration(400)).toBe(0);
    expect(result.current.isEnabled()).toBe(false);
  });
});
