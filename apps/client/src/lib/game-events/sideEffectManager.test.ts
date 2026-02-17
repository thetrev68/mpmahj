/**
 * Tests for SideEffectManager
 *
 * Validates centralized timeout and side effect management
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SideEffectManager } from './sideEffectManager';
import type { SideEffect } from './types';

describe('SideEffectManager', () => {
  let manager: SideEffectManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SideEffectManager();
  });

  afterEach(() => {
    manager.cleanup();
    vi.restoreAllMocks();
  });

  describe('TIMEOUT side effects', () => {
    test('executes timeout callback after specified duration', () => {
      const callback = vi.fn();
      const effect: SideEffect = {
        type: 'TIMEOUT',
        id: 'test-timeout',
        ms: 1000,
        callback,
      };

      manager.execute(effect);

      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(1000);

      // Now callback should be called
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('replaces existing timeout with same id', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'same-id',
        ms: 1000,
        callback: firstCallback,
      });

      manager.execute({
        type: 'TIMEOUT',
        id: 'same-id',
        ms: 2000,
        callback: secondCallback,
      });

      // Fast-forward past first timeout
      vi.advanceTimersByTime(1000);
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).not.toHaveBeenCalled();

      // Fast-forward to second timeout
      vi.advanceTimersByTime(1000);
      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    test('supports multiple concurrent timeouts with different ids', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-1',
        ms: 1000,
        callback: callback1,
      });

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-2',
        ms: 2000,
        callback: callback2,
      });

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-3',
        ms: 3000,
        callback: callback3,
      });

      // After 1s
      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // After 2s
      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();

      // After 3s
      vi.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe('CLEAR_TIMEOUT side effects', () => {
    test('clears pending timeout', () => {
      const callback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'test-timeout',
        ms: 1000,
        callback,
      });

      manager.execute({
        type: 'CLEAR_TIMEOUT',
        id: 'test-timeout',
      });

      // Fast-forward time
      vi.advanceTimersByTime(1000);

      // Callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });

    test('does nothing if timeout does not exist', () => {
      // Should not throw
      expect(() => {
        manager.execute({
          type: 'CLEAR_TIMEOUT',
          id: 'nonexistent-timeout',
        });
      }).not.toThrow();
    });

    test('clears timeout immediately, preventing callback execution', () => {
      const callback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'test',
        ms: 100,
        callback,
      });

      // Advance partway
      vi.advanceTimersByTime(50);

      // Clear timeout
      manager.execute({
        type: 'CLEAR_TIMEOUT',
        id: 'test',
      });

      // Advance past original timeout
      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup()', () => {
    test('clears all pending timeouts', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-1',
        ms: 1000,
        callback: callback1,
      });

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-2',
        ms: 2000,
        callback: callback2,
      });

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-3',
        ms: 3000,
        callback: callback3,
      });

      // Cleanup
      manager.cleanup();

      // Fast-forward past all timeouts
      vi.advanceTimersByTime(5000);

      // No callbacks should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    test('allows creating new timeouts after cleanup', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-1',
        ms: 1000,
        callback: callback1,
      });

      manager.cleanup();

      manager.execute({
        type: 'TIMEOUT',
        id: 'timeout-2',
        ms: 1000,
        callback: callback2,
      });

      vi.advanceTimersByTime(1000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    test('handles zero-duration timeout', () => {
      const callback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'zero-timeout',
        ms: 0,
        callback,
      });

      vi.advanceTimersByTime(0);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('handles very long timeouts', () => {
      const callback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'long-timeout',
        ms: 1000000,
        callback,
      });

      vi.advanceTimersByTime(999999);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('memory management', () => {
    test('removes timeout from internal map after execution', () => {
      const callback = vi.fn();

      manager.execute({
        type: 'TIMEOUT',
        id: 'test-timeout',
        ms: 100,
        callback,
      });

      // Execute timeout
      vi.advanceTimersByTime(100);

      // Try to clear it (should do nothing, no error)
      expect(() => {
        manager.execute({
          type: 'CLEAR_TIMEOUT',
          id: 'test-timeout',
        });
      }).not.toThrow();
    });

    test('handles rapid timeout creation and clearing', () => {
      const callback = vi.fn();

      for (let i = 0; i < 100; i++) {
        manager.execute({
          type: 'TIMEOUT',
          id: 'rapid-timeout',
          ms: 1000,
          callback,
        });

        manager.execute({
          type: 'CLEAR_TIMEOUT',
          id: 'rapid-timeout',
        });
      }

      vi.advanceTimersByTime(2000);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
