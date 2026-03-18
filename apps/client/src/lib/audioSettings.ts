export interface AudioSettings {
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
}

const AUDIO_SETTINGS_STORAGE_KEY = 'audio_settings';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  soundEffectsEnabled: true,
  soundEffectsVolume: 0.5,
  musicEnabled: true,
  musicVolume: 0.5,
};

function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isAudioSettings(value: unknown): value is AudioSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AudioSettings>;
  return (
    typeof candidate.soundEffectsEnabled === 'boolean' &&
    isVolume(candidate.soundEffectsVolume) &&
    typeof candidate.musicEnabled === 'boolean' &&
    isVolume(candidate.musicVolume)
  );
}

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS;

  const raw = localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_AUDIO_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isAudioSettings(parsed) ? parsed : DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save audio settings:', error);
  }
}
