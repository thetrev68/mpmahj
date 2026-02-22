/**
 * Side Effect Manager
 *
 * Centralized management of named timeouts declared by event handlers.
 * Prevents memory leaks and provides named timeout tracking for debugging.
 *
 * Benefits:
 * - Named timeouts (easy to debug and cancel by ID)
 * - Automatic cleanup on unmount
 * - Prevents memory leaks
 * - Testable (mock execute() to verify side effects declared)
 *
 * Note: PLAY_SOUND effects are handled directly in useGameEvents,
 * not here, as they require no lifecycle management.
 */

import type { SideEffect } from './types';

/** The subset of SideEffect variants managed by this class */
export type TimeoutEffect = Extract<SideEffect, { type: 'TIMEOUT' | 'CLEAR_TIMEOUT' }>;

/**
 * Manages named timeout side effects declared by event handlers
 */
export class SideEffectManager {
  /** Map of timeout IDs to timeout handles */
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Execute a timeout side effect
   * @param effect - TIMEOUT or CLEAR_TIMEOUT side effect to execute
   */
  execute(effect: TimeoutEffect): void {
    switch (effect.type) {
      case 'TIMEOUT': {
        this.setTimeout(effect.id, effect.callback, effect.ms);
        break;
      }

      case 'CLEAR_TIMEOUT': {
        this.clearTimeout(effect.id);
        break;
      }

      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = effect;
        console.warn('[SideEffectManager] Unknown side effect type:', _exhaustive);
      }
    }
  }

  /**
   * Set a named timeout
   * If a timeout with the same ID already exists, it will be cleared first
   * @param id - Unique identifier for this timeout
   * @param callback - Function to execute after delay
   * @param ms - Delay in milliseconds
   */
  private setTimeout(id: string, callback: () => void, ms: number): void {
    // Clear existing timeout with same ID
    this.clearTimeout(id);

    // Set new timeout
    const timeoutHandle = setTimeout(() => {
      // Remove from map after execution
      this.timeouts.delete(id);
      callback();
    }, ms);

    this.timeouts.set(id, timeoutHandle);
  }

  /**
   * Clear a named timeout
   * Safe to call even if timeout doesn't exist
   * @param id - Unique identifier for the timeout to clear
   */
  private clearTimeout(id: string): void {
    const timeoutHandle = this.timeouts.get(id);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(id);
    }
  }

  /**
   * Clear all pending timeouts
   * Should be called on component unmount
   */
  cleanup(): void {
    this.timeouts.forEach((timeoutHandle) => {
      clearTimeout(timeoutHandle);
    });
    this.timeouts.clear();
  }

  /**
   * Get count of active timeouts (for debugging/testing)
   * @returns Number of active timeouts
   */
  getActiveTimeoutCount(): number {
    return this.timeouts.size;
  }
}
