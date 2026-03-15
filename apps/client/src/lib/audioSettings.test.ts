import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from './audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when storage is empty', () => {
    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when stored JSON is invalid', () => {
    localStorage.setItem('audio_settings', '{invalid');

    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('round trips valid stored values', () => {
    const settings: AudioSettings = {
      soundEffectsEnabled: false,
      soundEffectsVolume: 0.2,
      musicEnabled: true,
      musicVolume: 0.8,
    };

    saveAudioSettings(settings);

    expect(loadAudioSettings()).toEqual(settings);
  });

  it('writes settings to audio_settings storage', () => {
    saveAudioSettings({
      soundEffectsEnabled: false,
      soundEffectsVolume: 0.2,
      musicEnabled: false,
      musicVolume: 0.1,
    });

    expect(localStorage.getItem('audio_settings')).toBe(
      JSON.stringify({
        soundEffectsEnabled: false,
        soundEffectsVolume: 0.2,
        musicEnabled: false,
        musicVolume: 0.1,
      })
    );
  });

  it('returns defaults and does not throw during SSR', () => {
    const windowSpy = vi
      .spyOn(globalThis, 'window', 'get')
      .mockImplementation(() => undefined as unknown as Window & typeof globalThis);

    expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(() => saveAudioSettings(DEFAULT_AUDIO_SETTINGS)).not.toThrow();

    windowSpy.mockRestore();
  });
});
