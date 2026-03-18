import { create } from 'zustand';
import { DEFAULT_AUDIO_SETTINGS, loadAudioSettings } from './audioSettings';

const initialSettings = loadAudioSettings();
let sharedAudioContext: AudioContext | null = null;
let sharedAudioContextConsumers = 0;

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

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

function closeSharedAudioContext(): void {
  if (!sharedAudioContext) {
    return;
  }

  const contextToClose = sharedAudioContext;
  sharedAudioContext = null;

  try {
    void contextToClose.close();
  } catch (error) {
    console.warn('Failed to close AudioContext:', error);
  }
}

export function acquireSharedAudioContextConsumer(): void {
  sharedAudioContextConsumers += 1;
}

export function releaseSharedAudioContextConsumer(): void {
  sharedAudioContextConsumers = Math.max(0, sharedAudioContextConsumers - 1);

  if (sharedAudioContextConsumers === 0) {
    closeSharedAudioContext();
  }
}

export function getOrCreateSharedAudioContext(): AudioContext | null {
  if (sharedAudioContext) {
    return sharedAudioContext;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass =
    window.AudioContext || (window as unknown as WebkitWindow).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  try {
    sharedAudioContext = new AudioContextClass();
    return sharedAudioContext;
  } catch (error) {
    console.warn('Failed to initialize AudioContext:', error);
    return null;
  }
}

export function resetSoundEffectsState(): void {
  useSoundEffectsStore.getState().reset();
  sharedAudioContextConsumers = 0;
  closeSharedAudioContext();
}
