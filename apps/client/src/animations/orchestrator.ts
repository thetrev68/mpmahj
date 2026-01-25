/**
 * Animation Orchestrator
 *
 * Handles timing and coordination of game animations.
 * Different event types have different animation durations.
 */

import type { Event } from '@/types/bindings/generated/Event';
import { getEventVariantName, normalizeEvent } from '@/utils/events';

export interface AnimationConfig {
  duration: number; // milliseconds
  maxDuration: number; // hard timeout to prevent hanging
  canSkip: boolean; // can user skip this animation?
}

/**
 * Get animation configuration for a specific event type
 */
const getEventKind = (event: Event): string => {
  const normalized = normalizeEvent(event);
  return getEventVariantName(normalized.event);
};

export function getAnimationConfig(event: Event): AnimationConfig {
  switch (getEventKind(event)) {
    // Fast animations (< 500ms)
    case 'TileDrawnPrivate':
    case 'TileDrawnPublic':
    case 'ReplacementDrawn':
      return {
        duration: 300,
        maxDuration: 1000,
        canSkip: true,
      };

    case 'TileDiscarded':
      return {
        duration: 500,
        maxDuration: 2000,
        canSkip: true,
      };

    case 'TileCalled':
      return {
        duration: 800,
        maxDuration: 3000,
        canSkip: true,
      };

    // Medium animations (500ms - 1s)
    case 'TilesPassing':
      return {
        duration: 1000,
        maxDuration: 3000,
        canSkip: true,
      };

    case 'TilesReceived':
      return {
        duration: 600,
        maxDuration: 2000,
        canSkip: true,
      };

    case 'JokerExchanged':
      return {
        duration: 1200,
        maxDuration: 3000,
        canSkip: true,
      };

    // Slow animations (> 1s)
    case 'TilesDealt':
      return {
        duration: 2000,
        maxDuration: 5000,
        canSkip: true,
      };

    case 'GameOver':
      return {
        duration: 1500,
        maxDuration: 5000,
        canSkip: false,
      };

    // No animation (instant)
    case 'PlayerJoined':
    case 'PlayerReadyForPass':
    case 'PlayerVoted':
    case 'TurnChanged':
    case 'PhaseChanged':
    case 'CharlestonPhaseChanged':
    case 'CallWindowOpened':
    case 'CallWindowClosed':
    case 'CommandRejected':
      return {
        duration: 0,
        maxDuration: 100,
        canSkip: true,
      };

    // Default: short animation
    default:
      return {
        duration: 300,
        maxDuration: 1000,
        canSkip: true,
      };
  }
}

/**
 * Animation completion callback type
 */
export type AnimationCallback = () => void;

/**
 * Promise-based animation runner
 *
 * Returns a promise that resolves when animation completes or times out
 */
export function runAnimation(
  event: Event,
  animationsEnabled: boolean,
  onComplete?: AnimationCallback
): Promise<void> {
  const config = getAnimationConfig(event);

  // If animations disabled, complete instantly
  if (!animationsEnabled || config.duration === 0) {
    onComplete?.();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let completed = false;
    let timer: ReturnType<typeof setTimeout>;
    let maxTimer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(maxTimer);
    };

    const complete = (logTimeout = false) => {
      if (completed) return;
      completed = true;
      if (logTimeout) {
        console.warn(
          `Animation for ${getEventKind(event)} exceeded max duration, forcing completion`
        );
      }
      cleanup();
      onComplete?.();
      resolve();
    };

    // Normal completion after duration
    timer = setTimeout(complete, config.duration);

    // Hard timeout to prevent hanging
    maxTimer = setTimeout(() => complete(true), config.maxDuration);

    // Store cleanup function for potential cancellation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (resolve as any)._cleanup = cleanup;
  });
}

/**
 * Skip animation and complete immediately
 */
export function skipAnimation(animationPromise: Promise<void>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleanup = (animationPromise as any)._cleanup;
  if (cleanup) {
    cleanup();
  }
}
