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

    expect(loadHintSettings()).toEqual({ useHints: false, sortDiscards: false });
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

    expect(loadHintSettings()).toEqual({ useHints: true, sortDiscards: false });
  });

  it('round trips the new schema through storage', () => {
    saveHintSettings({ useHints: false, sortDiscards: false });

    expect(loadHintSettings()).toEqual({ useHints: false, sortDiscards: false });
  });

  it('round trips sortDiscards enabled through storage', () => {
    saveHintSettings({ useHints: true, sortDiscards: true });

    expect(loadHintSettings()).toEqual({ useHints: true, sortDiscards: true });
  });

  it('migrates pre-sortDiscards schema by defaulting sortDiscards to false', () => {
    localStorage.setItem('hint_settings', JSON.stringify({ useHints: true }));

    expect(loadHintSettings()).toEqual({ useHints: true, sortDiscards: false });
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
    expect(() => saveHintSettings({ useHints: false, sortDiscards: false })).not.toThrow();

    windowSpy.mockRestore();
  });

  it('warns instead of throwing when localStorage writes fail', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => saveHintSettings({ useHints: false, sortDiscards: false })).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
