export interface HintSettings {
  useHints: boolean;
  sortDiscards: boolean;
}

const HINT_SETTINGS_STORAGE_KEY = 'hint_settings';

export const DEFAULT_HINT_SETTINGS: HintSettings = {
  useHints: true,
  sortDiscards: false,
};

function isHintSettings(value: unknown): value is HintSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const partial = value as Partial<HintSettings>;
  return typeof partial.useHints === 'boolean' && typeof partial.sortDiscards === 'boolean';
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
      return {
        useHints: (parsed as { verbosity: string }).verbosity !== 'Disabled',
        sortDiscards: false,
      };
    }

    if (isHintSettings(parsed)) return parsed;

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Partial<HintSettings>).useHints === 'boolean'
    ) {
      return {
        useHints: (parsed as Partial<HintSettings>).useHints!,
        sortDiscards:
          typeof (parsed as Partial<HintSettings>).sortDiscards === 'boolean'
            ? (parsed as Partial<HintSettings>).sortDiscards!
            : false,
      };
    }

    return DEFAULT_HINT_SETTINGS;
  } catch {
    return DEFAULT_HINT_SETTINGS;
  }
}

export function saveHintSettings(settings: HintSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HINT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save hint settings:', error);
  }
}
