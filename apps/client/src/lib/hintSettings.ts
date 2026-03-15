export interface HintSettings {
  useHints: boolean;
}

const HINT_SETTINGS_STORAGE_KEY = 'hint_settings';

export const DEFAULT_HINT_SETTINGS: HintSettings = {
  useHints: true,
};

function isHintSettings(value: unknown): value is HintSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return typeof (value as Partial<HintSettings>).useHints === 'boolean';
}

export function loadHintSettings(): HintSettings {
  if (typeof window === 'undefined') return DEFAULT_HINT_SETTINGS;

  const raw = localStorage.getItem(HINT_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_HINT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'verbosity' in parsed &&
      typeof (parsed as { verbosity?: unknown }).verbosity === 'string'
    ) {
      return { useHints: (parsed as { verbosity: string }).verbosity !== 'Disabled' };
    }

    return isHintSettings(parsed) ? parsed : DEFAULT_HINT_SETTINGS;
  } catch {
    return DEFAULT_HINT_SETTINGS;
  }
}

export function saveHintSettings(settings: HintSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
