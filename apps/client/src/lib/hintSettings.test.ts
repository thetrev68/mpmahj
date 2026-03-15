import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HINT_SETTINGS, loadHintSettings, saveHintSettings } from './hintSettings';

describe('hintSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('migrates old Disabled verbosity to useHints false', () => {
    localStorage.setItem(
      'hint_settings',
      JSON.stringify({
        verbosity: 'Disabled',
        sound_enabled: true,
        sound_type: 'Chime',
      })
    );

    expect(loadHintSettings()).toEqual({ useHints: false });
  });

  it('migrates old Intermediate verbosity to useHints true', () => {
    localStorage.setItem(
      'hint_settings',
      JSON.stringify({
        verbosity: 'Intermediate',
        sound_enabled: false,
        sound_type: 'Bell',
      })
    );

    expect(loadHintSettings()).toEqual({ useHints: true });
  });

  it('round trips the new schema through storage', () => {
    saveHintSettings({ useHints: false });

    expect(loadHintSettings()).toEqual({ useHints: false });
  });

  it('returns defaults for invalid JSON', () => {
    localStorage.setItem('hint_settings', '{invalid');

    expect(loadHintSettings()).toEqual(DEFAULT_HINT_SETTINGS);
  });

  it('returns defaults during SSR', () => {
    const windowSpy = vi
      .spyOn(globalThis, 'window', 'get')
      .mockImplementation(() => undefined as unknown as Window & typeof globalThis);

    expect(loadHintSettings()).toEqual(DEFAULT_HINT_SETTINGS);
    expect(() => saveHintSettings({ useHints: false })).not.toThrow();

    windowSpy.mockRestore();
  });
});
