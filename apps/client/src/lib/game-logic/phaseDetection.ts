/**
 * Phase Detection Utilities
 *
 * Pure functions for detecting and extracting game phase information.
 * Used throughout the frontend to determine which UI components to render
 * and which event handlers to activate.
 *
 * Benefits:
 * - Type-safe: Uses TypeScript type guards
 * - Testable: Pure functions with clear inputs/outputs
 * - Reusable: Can be used in components, hooks, and event handlers
 * - Maintainable: Single source of truth for phase detection logic
 */

import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';

/**
 * Check if the game is in Charleston phase
 * @param phase - Current game phase
 * @returns true if Charleston phase
 */
export function isCharlestonPhase(phase: GamePhase): phase is { Charleston: CharlestonStage } {
  return typeof phase === 'object' && phase !== null && 'Charleston' in phase;
}

/**
 * Check if the game is in Playing phase
 * @param phase - Current game phase
 * @returns true if Playing phase
 */
export function isPlayingPhase(phase: GamePhase): phase is { Playing: TurnStage } {
  return typeof phase === 'object' && phase !== null && 'Playing' in phase;
}

/**
 * Check if the game is in Setup phase
 * @param phase - Current game phase
 * @returns true if Setup phase
 */
export function isSetupPhase(phase: GamePhase): phase is { Setup: SetupStage } {
  return typeof phase === 'object' && phase !== null && 'Setup' in phase;
}

/**
 * Extract Charleston stage from phase
 * @param phase - Current game phase
 * @returns Charleston stage, or null if not in Charleston phase
 */
export function getCharlestonStage(phase: GamePhase): CharlestonStage | null {
  return isCharlestonPhase(phase) ? phase.Charleston : null;
}

/**
 * Extract Playing stage from phase
 * @param phase - Current game phase
 * @returns Playing stage, or null if not in Playing phase
 */
export function getPlayingStage(phase: GamePhase): TurnStage | null {
  return isPlayingPhase(phase) ? phase.Playing : null;
}

/**
 * Extract Setup stage from phase
 * @param phase - Current game phase
 * @returns Setup stage, or null if not in Setup phase
 */
export function getSetupStage(phase: GamePhase): SetupStage | null {
  return isSetupPhase(phase) ? phase.Setup : null;
}
