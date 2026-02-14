/**
 * Custom hook for managing animation preferences and accessibility
 *
 * Persists user preferences to localStorage (animation speeds, per-animation toggles,
 * respect for system `prefers-reduced-motion` setting). Provides utilities for adjusting
 * animation durations and checking if specific animations should be shown.
 *
 * Automatically detects system motion preferences using the CSS Media Query API and
 * respects the user's `respect_reduced_motion` setting (opt-in accessibility).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Animation playback speed multiplier options.
 *
 * - `'off'` — no animations, instant transitions (speedMultiplier = 0)
 * - `'fast'` — 0.5x duration (speedMultiplier = 0.5)
 * - `'normal'` — 1x duration (speedMultiplier = 1)
 * - `'slow'` — 2x duration (speedMultiplier = 2)
 */
export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow';

/**
 * Animation categories that can be individually toggled.
 */
export type AnimationType =
  | 'tile_movement'
  | 'charleston_pass'
  | 'meld_formation'
  | 'dice_roll'
  | 'win_celebration';

/**
 * User preferences for animation playback and accessibility.
 *
 * @property speed - Global animation speed multiplier
 * @property tile_movement - Show tile draw/discard/pass animations
 * @property charleston_pass - Show tile passing animations during Charleston
 * @property meld_formation - Show meld (Pung/Kong) formation animations
 * @property dice_roll - Show dice roll animation at game start
 * @property win_celebration - Show winner celebration animation
 * @property respect_reduced_motion - Honor system `prefers-reduced-motion` CSS media query (accessibility)
 */
export interface AnimationPreferences {
  speed: AnimationSpeed;
  tile_movement: boolean;
  charleston_pass: boolean;
  meld_formation: boolean;
  dice_roll: boolean;
  win_celebration: boolean;
  respect_reduced_motion: boolean;
}

/**
 * Return type for useAnimationSettings hook.
 *
 * @property settings - Current animation preferences
 * @property updateSettings - Merge partial preferences into current state
 * @property getDuration - Adjust a base duration by the current speed multiplier
 * @property isEnabled - Check if a specific animation should play
 * @property speedMultiplier - Current effective multiplier (0-2)
 * @property reducedMotion - Effective reduced-motion state (OS preference AND respect flag)
 * @property prefersReducedMotion - OS-level CSS media query preference (read-only)
 */
export interface UseAnimationSettingsReturn {
  settings: AnimationPreferences;
  updateSettings: (settings: Partial<AnimationPreferences>) => void;
  getDuration: (baseDurationMs: number) => number;
  isEnabled: (animation: AnimationType) => boolean;
  speedMultiplier: number;
  reducedMotion: boolean;
  prefersReducedMotion: boolean;
}

/** localStorage key for persisting animation preferences */
export const ANIMATION_SETTINGS_STORAGE_KEY = 'animation_prefs';

/**
 * Factory settings: normal speed with all animations enabled and system motion respected.
 * Used as fallback when localStorage is empty or contains invalid data.
 */
export const DEFAULT_ANIMATION_SETTINGS: AnimationPreferences = {
  speed: 'normal',
  tile_movement: true,
  charleston_pass: true,
  meld_formation: true,
  dice_roll: true,
  win_celebration: true,
  respect_reduced_motion: true,
};

/**
 * Speed multiplier per AnimationSpeed option.
 * @internal
 */
const SPEED_MULTIPLIERS: Record<AnimationSpeed, number> = {
  off: 0,
  fast: 0.5,
  normal: 1,
  slow: 2,
};

/**
 * Type guard for AnimationSpeed values.
 * @internal
 */
function isAnimationSpeed(value: unknown): value is AnimationSpeed {
  return value === 'off' || value === 'fast' || value === 'normal' || value === 'slow';
}

/**
 * Parse raw JSON string to AnimationPreferences, or return null if invalid.
 * @internal
 */
function parseAnimationSettings(raw: string | null): AnimationPreferences | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AnimationPreferences>;
    if (
      !isAnimationSpeed(parsed.speed) ||
      typeof parsed.tile_movement !== 'boolean' ||
      typeof parsed.charleston_pass !== 'boolean' ||
      typeof parsed.meld_formation !== 'boolean' ||
      typeof parsed.dice_roll !== 'boolean' ||
      typeof parsed.win_celebration !== 'boolean' ||
      typeof parsed.respect_reduced_motion !== 'boolean'
    ) {
      return null;
    }
    return parsed as AnimationPreferences;
  } catch {
    return null;
  }
}

/**
 * Load animation preferences from localStorage, or return defaults if unavailable.
 * Gracefully handles SSR environments (no-op if `window` is undefined).
 * @internal
 */
function loadAnimationSettings(): AnimationPreferences {
  if (typeof window === 'undefined') return DEFAULT_ANIMATION_SETTINGS;

  const parsed = parseAnimationSettings(localStorage.getItem(ANIMATION_SETTINGS_STORAGE_KEY));
  return parsed ?? DEFAULT_ANIMATION_SETTINGS;
}

/**
 * Hook for managing animation preferences and accessibility settings.
 *
 * Provides the current animation settings from localStorage, methods to update them,
 * and utilities to apply speed multipliers and check animation toggles. Automatically
 * detects and respects system `prefers-reduced-motion` preferences.
 *
 * @returns Animation settings management object
 *
 * @example
 * ```tsx
 * const anim = useAnimationSettings();
 * const tileMoveDuration = anim.getDuration(500); // 500ms at normal speed
 * if (anim.isEnabled('tile_movement')) {
 *   // Show tile animation
 * }
 * ```
 */
export function useAnimationSettings(): UseAnimationSettingsReturn {
  const [settings, setSettings] = useState<AnimationPreferences>(() => loadAnimationSettings());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ANIMATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AnimationPreferences>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const reducedMotion = prefersReducedMotion && settings.respect_reduced_motion;

  const speedMultiplier = useMemo(() => {
    if (reducedMotion) return 0;
    return SPEED_MULTIPLIERS[settings.speed];
  }, [reducedMotion, settings.speed]);

  const getDuration = useCallback(
    (baseDurationMs: number) => Math.round(baseDurationMs * speedMultiplier),
    [speedMultiplier]
  );

  const isEnabled = useCallback(
    (animation: AnimationType) => {
      if (reducedMotion) return false;
      if (settings.speed === 'off') return false;
      return settings[animation];
    },
    [reducedMotion, settings]
  );

  return {
    settings,
    updateSettings,
    getDuration,
    isEnabled,
    speedMultiplier,
    reducedMotion,
    prefersReducedMotion,
  };
}
