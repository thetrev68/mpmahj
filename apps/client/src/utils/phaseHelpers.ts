import type { GamePhase } from '@/types/bindings/generated/GamePhase';

/**
 * Check if phase is WaitingForPlayers.
 */
export function isWaitingForPlayers(phase: GamePhase): boolean {
  return phase === 'WaitingForPlayers';
}

/**
 * Check if phase is Playing (main gameplay).
 */
export function isPlayingPhase(phase: GamePhase): boolean {
  return typeof phase === 'object' && 'Playing' in phase;
}

/**
 * Check if phase is Charleston.
 */
export function isCharlestonPhase(phase: GamePhase): boolean {
  return typeof phase === 'object' && 'Charleston' in phase;
}

/**
 * Check if phase is Setup.
 */
export function isSetupPhase(phase: GamePhase): boolean {
  return typeof phase === 'object' && 'Setup' in phase;
}

/**
 * Check if phase is GameOver.
 */
export function isGameOver(phase: GamePhase): boolean {
  return typeof phase === 'object' && 'GameOver' in phase;
}

/**
 * Check if game has started (not WaitingForPlayers).
 */
export function hasGameStarted(phase: GamePhase): boolean {
  return !isWaitingForPlayers(phase);
}
