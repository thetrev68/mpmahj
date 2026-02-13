import { useCallback, useEffect, useMemo, useState } from 'react';

export type AnimationSpeed = 'off' | 'fast' | 'normal' | 'slow';
export type AnimationType =
  | 'tile_movement'
  | 'charleston_pass'
  | 'meld_formation'
  | 'dice_roll'
  | 'win_celebration';

export interface AnimationPreferences {
  speed: AnimationSpeed;
  tile_movement: boolean;
  charleston_pass: boolean;
  meld_formation: boolean;
  dice_roll: boolean;
  win_celebration: boolean;
  respect_reduced_motion: boolean;
}

export interface UseAnimationSettingsReturn {
  settings: AnimationPreferences;
  updateSettings: (settings: Partial<AnimationPreferences>) => void;
  getDuration: (baseDurationMs: number) => number;
  isEnabled: (animation: AnimationType) => boolean;
  speedMultiplier: number;
  reducedMotion: boolean;
  prefersReducedMotion: boolean;
}

export const ANIMATION_SETTINGS_STORAGE_KEY = 'animation_prefs';

export const DEFAULT_ANIMATION_SETTINGS: AnimationPreferences = {
  speed: 'normal',
  tile_movement: true,
  charleston_pass: true,
  meld_formation: true,
  dice_roll: true,
  win_celebration: true,
  respect_reduced_motion: true,
};

const SPEED_MULTIPLIERS: Record<AnimationSpeed, number> = {
  off: 0,
  fast: 0.5,
  normal: 1,
  slow: 2,
};

function isAnimationSpeed(value: unknown): value is AnimationSpeed {
  return value === 'off' || value === 'fast' || value === 'normal' || value === 'slow';
}

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

function loadAnimationSettings(): AnimationPreferences {
  if (typeof window === 'undefined') return DEFAULT_ANIMATION_SETTINGS;

  const parsed = parseAnimationSettings(localStorage.getItem(ANIMATION_SETTINGS_STORAGE_KEY));
  return parsed ?? DEFAULT_ANIMATION_SETTINGS;
}

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
