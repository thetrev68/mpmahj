import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

export type HintSoundType = 'Chime' | 'Ping' | 'Bell';

export interface HintSettings {
  verbosity: HintVerbosity;
  sound_enabled: boolean;
  sound_type: HintSoundType;
}

export const HINT_SETTINGS_STORAGE_KEY = 'hint_settings';

export const DEFAULT_HINT_SETTINGS: HintSettings = {
  verbosity: 'Beginner',
  sound_enabled: true,
  sound_type: 'Chime',
};

function isHintVerbosity(value: unknown): value is HintVerbosity {
  return (
    value === 'Beginner' || value === 'Intermediate' || value === 'Expert' || value === 'Disabled'
  );
}

function isHintSoundType(value: unknown): value is HintSoundType {
  return value === 'Chime' || value === 'Ping' || value === 'Bell';
}

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

export function saveHintSettings(settings: HintSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
