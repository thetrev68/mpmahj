/**
 * Custom hook for playing game sound effects
 *
 * Provides sound playback with volume control and enable/disable toggle.
 * Uses Web Audio API (with webkit fallback for older browsers).
 * Audio context is lazily initialized on first user interaction (browser security requirement).
 *
 * Current implementation uses synthesized beep tones. Production version should load
 * actual audio files from `/public/sounds/`. Sound file naming convention:
 * `{effect-name}.mp3` or `.wav` (e.g., `tile-draw.mp3`, `mahjong.wav`)
 *
 * @see See component implementations (e.g., GameBoard) for usage examples
 */

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Sound effect identifiers for game events.
 * Each maps to a sound file or synthesized audio pattern.
 *
 * - `'tile-draw'` — Player draws a tile
 * - `'tile-discard'` — Player discards a tile
 * - `'tile-call'` — Meld call (Pung, Kong, etc.)
 * - `'charleston-pass'` — Tiles passed during Charleston
 * - `'mahjong'` — Player declares Mahjong (win)
 * - `'wall-break'` — Wall breaking at game setup
 * - `'dice-roll'` — Dice rolled
 */
export type SoundEffect =
  | 'tile-draw'
  | 'tile-discard'
  | 'tile-call'
  | 'charleston-pass'
  | 'mahjong'
  | 'wall-break'
  | 'dice-roll'
  | 'tile-select';

export const SOUND_EFFECT_AUDIO_PATHS: Partial<Record<SoundEffect, string>> = {
  'tile-select': '/assets/audio/tile-select.wav',
};

/**
 * Hook options for sound playback configuration.
 *
 * @property volume - Initial volume (0.0 = silent, 1.0 = full volume, default 0.5)
 * @property enabled - Whether to play sounds on mount (default true)
 */
export interface UseSoundEffectsOptions {
  /** Volume level 0.0 to 1.0 */
  volume?: number;
  /** Whether sounds are enabled */
  enabled?: boolean;
}

/**
 * Return type for useSoundEffects hook.
 *
 * @property playSound - Play a sound effect (respects enabled and volume settings)
 * @property setVolume - Update volume (0.0 to 1.0, clamped)
 * @property setEnabled - Toggle sound playback on/off
 * @property volume - Current volume level
 * @property enabled - Current enabled state
 */
export interface UseSoundEffectsReturn {
  /** Play a sound effect */
  playSound: (effect: SoundEffect) => void;
  /** Set volume (0.0 to 1.0) */
  setVolume: (volume: number) => void;
  /** Enable/disable sounds */
  setEnabled: (enabled: boolean) => void;
  /** Current volume */
  volume: number;
  /** Current enabled state */
  enabled: boolean;
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Hook for playing game sound effects
 *
 * @example
 * ```tsx
 * const { playSound } = useSoundEffects({ volume: 0.5 });
 *
 * // Play draw sound
 * playSound('tile-draw');
 * ```
 */
export function useSoundEffects(options: UseSoundEffectsOptions = {}): UseSoundEffectsReturn {
  const { volume: initialVolume = 0.5, enabled: initialEnabled = true } = options;

  const [volume, setVolumeState] = useState(initialVolume);
  const [enabled, setEnabledState] = useState(initialEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>({});

  // Initialize AudioContext on first interaction (required by browsers)
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current && typeof window !== 'undefined') {
        const AudioContextClass =
          window.AudioContext || (window as unknown as WebkitWindow).webkitAudioContext;
        if (AudioContextClass) {
          try {
            audioContextRef.current = new AudioContextClass();
          } catch (error) {
            console.warn('Failed to initialize AudioContext:', error);
          }
        }
      }
    };

    // Listen for user interaction to initialize audio
    if (typeof window !== 'undefined') {
      window.addEventListener('click', initAudio, { once: true });
      window.addEventListener('keydown', initAudio, { once: true });
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playSound = useCallback(
    (effect: SoundEffect) => {
      if (!enabled || volume === 0) return;

      try {
        const audioPath = SOUND_EFFECT_AUDIO_PATHS[effect];
        if (audioPath && typeof Audio !== 'undefined') {
          const existingAudio = audioRef.current[effect];
          const audio = existingAudio ?? new Audio(audioPath);
          audioRef.current[effect] = audio;
          audio.volume = volume;
          audio.currentTime = 0;
          const playResult = audio.play();
          if (playResult && typeof playResult.catch === 'function') {
            void playResult.catch((error) => {
              console.warn('Failed to play sound:', error);
            });
          }
          return;
        }

        // Fall back to simple synthesized tones when no file path is configured.
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Different frequencies for different sounds
        const frequencies: Record<SoundEffect, number> = {
          'tile-draw': 440,
          'tile-discard': 520,
          'tile-call': 660,
          'charleston-pass': 400,
          mahjong: 880,
          'wall-break': 330,
          'dice-roll': 220,
          'tile-select': 620,
        };

        oscillator.frequency.value = frequencies[effect] || 440;
        oscillator.type = 'sine';

        gainNode.gain.value = volume * 0.1; // Keep it subtle

        const now = ctx.currentTime;
        oscillator.start(now);
        oscillator.stop(now + 0.1); // Short beep
      } catch (error) {
        console.warn('Failed to play sound:', error);
      }
    },
    [enabled, volume]
  );

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(Math.max(0, Math.min(1, newVolume)));
  }, []);

  const setEnabled = useCallback((newEnabled: boolean) => {
    setEnabledState(newEnabled);
  }, []);

  return {
    playSound,
    setVolume,
    setEnabled,
    volume,
    enabled,
  };
}
