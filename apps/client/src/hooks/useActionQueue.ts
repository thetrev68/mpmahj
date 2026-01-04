/**
 * Action Queue Hook
 *
 * Manages FIFO event processing with animation gating.
 * Events are queued and processed one at a time, with animations
 * delaying state updates until completion.
 *
 * RULES:
 * - FIFO ordering (no reordering)
 * - Only apply event to gameStore after animation completes
 * - On reconnect, clear queue and apply pending events immediately
 * - User can disable animations to apply instantly
 */

import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { runAnimation } from '@/animations/orchestrator';
import type { GameEvent } from '@/types/bindings';

interface QueuedEvent {
  event: GameEvent;
  timestamp: number;
}

export function useActionQueue() {
  const applyEvent = useGameStore((state) => state.applyEvent);
  const animationsEnabled = useUIStore((state) => state.animationsEnabled);

  // Event queue
  const queueRef = useRef<QueuedEvent[]>([]);
  const isProcessingRef = useRef(false);

  /**
   * Process the next event in the queue
   */
  const processNext = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (queueRef.current.length === 0) return;

    isProcessingRef.current = true;

    const queued = queueRef.current.shift();
    if (!queued) {
      isProcessingRef.current = false;
      return;
    }

    const { event } = queued;

    try {
      // Run animation (or skip if disabled)
      await runAnimation(event, animationsEnabled);

      // Apply event to game store AFTER animation completes
      applyEvent(event);
    } catch (error) {
      console.error('Error processing event:', error);
      // Still apply the event even if animation failed
      applyEvent(event);
    } finally {
      isProcessingRef.current = false;

      // Process next event if any
      if (queueRef.current.length > 0) {
        // Use setTimeout to avoid deep recursion
        setTimeout(() => processNext(), 0);
      }
    }
  }, [applyEvent, animationsEnabled]);

  /**
   * Enqueue a new event
   */
  const enqueueEvent = useCallback(
    (event: GameEvent) => {
      queueRef.current.push({
        event,
        timestamp: Date.now(),
      });

      // Start processing if not already running
      if (!isProcessingRef.current) {
        processNext();
      }
    },
    [processNext]
  );

  /**
   * Clear the queue (e.g., on reconnect)
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    isProcessingRef.current = false;
  }, []);

  /**
   * Get current queue status
   */
  const getQueueStatus = useCallback(() => {
    return {
      queueLength: queueRef.current.length,
      isProcessing: isProcessingRef.current,
      isAnimating: isProcessingRef.current && queueRef.current.length > 0,
    };
  }, []);

  /**
   * Apply events immediately without queueing (for reconnect snapshot)
   */
  const applyImmediate = useCallback(
    (events: GameEvent[]) => {
      events.forEach((event) => applyEvent(event));
    },
    [applyEvent]
  );

  return {
    enqueueEvent,
    clearQueue,
    getQueueStatus,
    applyImmediate,
  };
}

/**
 * Hook to get queue status for UI display
 */
export function useQueueStatus() {
  const queueRef = useRef<number>(0);

  useEffect(() => {
    // This is a simplified version - in production you'd want to
    // expose this state from the main queue hook via a store
    const interval = setInterval(() => {
      // Force re-render to update queue status
      queueRef.current = Date.now();
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return {
    isAnimating: false, // Would be pulled from actual queue state
    queueLength: 0, // Would be pulled from actual queue state
  };
}
