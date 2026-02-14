/**
 * Hint system preferences persisted to browser localStorage
 *
 * Manages user preferences for in-game hints: verbosity level, sound feedback toggle,
 * and sound effect type. Handles SSR environments gracefully (no-op if `window` unavailable).
 * Settings are validated on load; invalid or missing data falls back to defaults.
 */

import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

/**
 * Audio effect types available for hint notifications.
 */
export type HintSoundType = 'Chime' | 'Ping' | 'Bell';

/**
 * User preferences for in-game hints and notifications.
 *
 * @property verbosity - Hint detail level ('Beginner', 'Intermediate', 'Expert', or 'Disabled')
 * @property sound_enabled - Whether to play audio feedback for hints
 * @property sound_type - Which sound effect to play (only used if sound_enabled is true)
 */
export interface HintSettings {
  verbosity: HintVerbosity;
  sound_enabled: boolean;
  sound_type: HintSoundType;
}

/** localStorage key for persisting hint settings */
const HINT_SETTINGS_STORAGE_KEY = 'hint_settings';

/**
 * Factory settings: beginner-level hints with chime sound enabled.
 * Used as fallback when localStorage is empty or contains invalid data.
 */
export const DEFAULT_HINT_SETTINGS: HintSettings = {
  verbosity: 'Beginner',
  sound_enabled: true,
  sound_type: 'Chime',
};

/**
 * Type guard for HintVerbosity enum values.
 * @internal
 */
function isHintVerbosity(value: unknown): value is HintVerbosity {
  return (
    value === 'Beginner' || value === 'Intermediate' || value === 'Expert' || value === 'Disabled'
  );
}

/**
 * Type guard for HintSoundType enum values.
 * @internal
 */
function isHintSoundType(value: unknown): value is HintSoundType {
  return value === 'Chime' || value === 'Ping' || value === 'Bell';
}

/**
 * Load hint settings from browser localStorage, or return defaults if unavailable.
 *
 * Gracefully handles SSR environments (no-op if `window` is undefined).
 * If localStorage contains invalid or unparseable data, logs a warning and returns defaults.
 *
 * @returns Validated hint settings, or {@link DEFAULT_HINT_SETTINGS} if load fails
 */
export function loadHintSettings(): HintSettings {
  if (typeof window === 'undefined') return DEFAULT_HINT_SETTINGS;

  const raw = localStorage.getItem(HINT_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_HINT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<HintSettings>;
    if (
      !isHintVerbosity(parsed.verbosity) ||
      typeof parsed.sound_enabled !== 'boolean' ||
      !isHintSoundType(parsed.sound_type)
    ) {
      console.warn('Invalid hint settings found in storage; falling back to defaults.');
      return DEFAULT_HINT_SETTINGS;
    }
    return parsed as HintSettings;
  } catch {
    console.warn('Failed to parse hint settings from storage; falling back to defaults.');
    return DEFAULT_HINT_SETTINGS;
  }
}

/**
 * Save hint settings to browser localStorage.
 *
 * Gracefully handles SSR environments (no-op if `window` is undefined).
 * Settings are serialized as JSON using the default serializer.
 *
 * @param settings - Validated hint settings object to persist
 */
export function saveHintSettings(settings: HintSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
