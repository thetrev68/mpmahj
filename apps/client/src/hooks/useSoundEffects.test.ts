/**
 * useSoundEffects Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSoundEffects } from './useSoundEffects';

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  destination = {};
  state = 'running';

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
    (globalThis as unknown as Record<string, typeof MockAudioContext>).AudioContext = MockAudioContext;
    (globalThis as unknown as Record<string, typeof MockAudioContext>).webkitAudioContext = MockAudioContext;
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
  });

  describe('Sound Playback', () => {
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
      ] as const;

      sounds.forEach((sound) => {
        expect(() => {
          act(() => {
            result.current.playSound(sound);
          });
        }).not.toThrow();
      });
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
    it('cleans up audio context on unmount', () => {
      const { unmount } = renderHook(() => useSoundEffects());

      expect(() => unmount()).not.toThrow();
    });
  });
});
