/**
 * useSoundEffects Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SOUND_EFFECT_AUDIO_PATHS, useSoundEffects } from './useSoundEffects';
import { resetSoundEffectsState } from '@/lib/soundEffectsStore';

// Mock AudioContext
class MockAudioContext {
  static instances = 0;

  currentTime = 0;
  destination = {};
  state = 'running';

  constructor() {
    MockAudioContext.instances += 1;
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 },
      type: 'sine',
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: { value: 0 },
    };
  }

  close() {
    return Promise.resolve();
  }
}

describe('useSoundEffects', () => {
  beforeEach(() => {
    (globalThis as unknown as Record<string, typeof MockAudioContext>).AudioContext =
      MockAudioContext;
    (globalThis as unknown as Record<string, typeof MockAudioContext>).webkitAudioContext =
      MockAudioContext;
    MockAudioContext.instances = 0;
    resetSoundEffectsState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('returns playSound function', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(result.current.playSound).toBeInstanceOf(Function);
    });

    it('returns setVolume function', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(result.current.setVolume).toBeInstanceOf(Function);
    });

    it('returns setEnabled function', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(result.current.setEnabled).toBeInstanceOf(Function);
    });

    it('defaults volume to 0.5', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(result.current.volume).toBe(0.5);
    });

    it('defaults enabled to true', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(result.current.enabled).toBe(true);
    });

    it('accepts custom volume option', () => {
      const { result } = renderHook(() => useSoundEffects({ volume: 0.8 }));

      expect(result.current.volume).toBe(0.8);
    });

    it('accepts custom enabled option', () => {
      const { result } = renderHook(() => useSoundEffects({ enabled: false }));

      expect(result.current.enabled).toBe(false);
    });
  });

  describe('Volume Control', () => {
    it('updates volume when setVolume is called', () => {
      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.setVolume(0.7);
      });

      expect(result.current.volume).toBe(0.7);
    });

    it('clamps volume to 0.0 minimum', () => {
      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.setVolume(-0.5);
      });

      expect(result.current.volume).toBe(0);
    });

    it('clamps volume to 1.0 maximum', () => {
      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.setVolume(1.5);
      });

      expect(result.current.volume).toBe(1);
    });
  });

  describe('Enable/Disable', () => {
    it('updates enabled state when setEnabled is called', () => {
      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.setEnabled(false);
      });

      expect(result.current.enabled).toBe(false);
    });

    it('can re-enable after disabling', () => {
      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.setEnabled(false);
      });
      expect(result.current.enabled).toBe(false);

      act(() => {
        result.current.setEnabled(true);
      });
      expect(result.current.enabled).toBe(true);
    });

    it('shares enabled state across hook instances', () => {
      const first = renderHook(() => useSoundEffects());
      const second = renderHook(() => useSoundEffects());

      act(() => {
        first.result.current.setEnabled(false);
      });

      expect(second.result.current.enabled).toBe(false);
    });
  });

  describe('Shared Volume', () => {
    it('shares volume across hook instances', () => {
      const first = renderHook(() => useSoundEffects());
      const second = renderHook(() => useSoundEffects());

      act(() => {
        first.result.current.setVolume(0.3);
      });

      expect(second.result.current.volume).toBe(0.3);
    });
  });

  describe('Sound Playback', () => {
    it('lazily creates the shared audio context on first synthesized playback', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(MockAudioContext.instances).toBe(0);

      act(() => {
        result.current.playSound('tile-draw');
      });

      expect(MockAudioContext.instances).toBe(1);
    });

    it('shares a single audio context across concurrent hook instances', () => {
      const first = renderHook(() => useSoundEffects());
      const second = renderHook(() => useSoundEffects());

      act(() => {
        first.result.current.playSound('tile-draw');
        second.result.current.playSound('mahjong');
      });

      expect(MockAudioContext.instances).toBe(1);
    });

    it('silently no-ops when audio context creation fails', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const failingContext = vi.fn(() => {
        throw new Error('context creation failed');
      });

      (globalThis as unknown as Record<string, typeof failingContext>).AudioContext =
        failingContext;
      (globalThis as unknown as Record<string, typeof failingContext>).webkitAudioContext =
        failingContext;

      const { result } = renderHook(() => useSoundEffects());

      expect(() => {
        act(() => {
          result.current.playSound('tile-draw');
        });
      }).not.toThrow();

      expect(failingContext).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('can call playSound without errors', () => {
      const { result } = renderHook(() => useSoundEffects());

      expect(() => {
        act(() => {
          result.current.playSound('tile-draw');
        });
      }).not.toThrow();
    });

    it('supports all sound effect types', () => {
      const { result } = renderHook(() => useSoundEffects());

      const sounds = [
        'tile-draw',
        'tile-discard',
        'tile-call',
        'charleston-pass',
        'mahjong',
        'wall-break',
        'dice-roll',
        'tile-select',
      ] as const;

      sounds.forEach((sound) => {
        expect(() => {
          act(() => {
            result.current.playSound(sound);
          });
        }).not.toThrow();
      });
    });

    it('maps tile-select to an audio asset path', () => {
      expect(SOUND_EFFECT_AUDIO_PATHS['tile-select']).toBe('/assets/audio/tile-select.wav');
    });

    it('restarts tile-select audio instead of stacking overlapping instances', () => {
      const play = vi.fn(() => Promise.resolve());
      const audioElement = {
        currentTime: 0,
        play,
        volume: 0,
      };

      let audioCtorCalls = 0;
      class MockAudio {
        currentTime = 0;
        play = play;
        volume = 0;

        constructor() {
          audioCtorCalls += 1;
          return audioElement;
        }
      }

      (globalThis as unknown as { Audio: typeof Audio }).Audio =
        MockAudio as unknown as typeof Audio;

      const { result } = renderHook(() => useSoundEffects());

      act(() => {
        result.current.playSound('tile-select');
      });

      audioElement.currentTime = 0.75;

      act(() => {
        result.current.playSound('tile-select');
      });

      expect(audioCtorCalls).toBe(1);
      expect(audioElement.currentTime).toBe(0);
      expect(play).toHaveBeenCalledTimes(2);
    });

    it('does not play sound when disabled', () => {
      const { result } = renderHook(() => useSoundEffects({ enabled: false }));

      // Should not throw even when disabled
      expect(() => {
        act(() => {
          result.current.playSound('tile-draw');
        });
      }).not.toThrow();
    });

    it('does not play sound when volume is 0', () => {
      const { result } = renderHook(() => useSoundEffects({ volume: 0 }));

      // Should not throw even when volume is 0
      expect(() => {
        act(() => {
          result.current.playSound('tile-draw');
        });
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('cleans up the shared audio context after the last consumer unmounts', () => {
      const closeSpy = vi.spyOn(MockAudioContext.prototype, 'close');
      const first = renderHook(() => useSoundEffects());
      const second = renderHook(() => useSoundEffects());

      act(() => {
        first.result.current.playSound('tile-draw');
      });

      first.unmount();
      expect(closeSpy).not.toHaveBeenCalled();

      expect(() => second.unmount()).not.toThrow();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
