import { create } from 'zustand';
import { DEFAULT_AUDIO_SETTINGS, loadAudioSettings } from './audioSettings';

const initialSettings = loadAudioSettings();

interface SoundEffectsState {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  reset: () => void;
}

export const useSoundEffectsStore = create<SoundEffectsState>((set) => ({
  enabled: initialSettings.soundEffectsEnabled,
  volume: initialSettings.soundEffectsVolume,
  setEnabled: (enabled) => set({ enabled }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  reset: () =>
    set({
      enabled: DEFAULT_AUDIO_SETTINGS.soundEffectsEnabled,
      volume: DEFAULT_AUDIO_SETTINGS.soundEffectsVolume,
    }),
}));

export function resetSoundEffectsState(): void {
  useSoundEffectsStore.getState().reset();
}
