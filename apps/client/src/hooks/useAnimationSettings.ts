/**
 * Custom hook for reduced-motion-aware animation utilities.
 *
 * Animation policy is simplified to two modes:
 * - Normal (default): animations enabled at base durations
 * - Reduced motion: animations disabled and durations forced to 0
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Animation utility return type.
 */
export interface UseAnimationSettingsReturn {
  getDuration: (baseDurationMs: number) => number;
  isEnabled: () => boolean;
  prefersReducedMotion: boolean;
}

/**
 * Hook for reduced-motion-aware animation behavior.
 *
 * Watches OS `prefers-reduced-motion` and exposes utility helpers.
 */
export function useAnimationSettings(): UseAnimationSettingsReturn {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  const getDuration = useCallback(
    (baseDurationMs: number) => (prefersReducedMotion ? 0 : baseDurationMs),
    [prefersReducedMotion]
  );

  const isEnabled = useCallback(() => !prefersReducedMotion, [prefersReducedMotion]);

  return {
    getDuration,
    isEnabled,
    prefersReducedMotion,
  };
}
