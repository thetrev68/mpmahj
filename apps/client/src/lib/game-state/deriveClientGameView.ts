/**
 * @module deriveClientGameView
 *
 * Derivation boundary: converts a server GameStateSnapshot into the client view model.
 *
 * This is the single authoritative place where server-owned snapshot data is transformed
 * into client-facing shape. No other module should extend or mutate GameStateSnapshot to
 * produce client-only fields.
 *
 * Called inside useGameEvents whenever a new StateSnapshot arrives from the server,
 * and also when an initialState is provided for offline or test scenarios.
 */

import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { ClientGameState, LocalDiscardInfo } from '@/types/clientGameState';

/**
 * Derives the client game view from a server snapshot.
 *
 * Server-owned fields are passed through without mutation.
 * Client-extended fields are initialized with their default values:
 *   - `discard_pile` entries gain `player`, `turn`, `safe`, and `called` metadata.
 *   - `exposed_melds` is left undefined; it is populated by call-resolution event handlers.
 *
 * @param snapshot - The authoritative server state snapshot.
 * @returns A `ClientGameState` ready for use by the UI layer.
 */
export function deriveClientGameView(snapshot: GameStateSnapshot): ClientGameState {
  const discard_pile: LocalDiscardInfo[] = snapshot.discard_pile.map((entry, index) => ({
    ...entry,
    // Alias: `player` mirrors `discarded_by` for backward-compatible consumers.
    player: entry.discarded_by,
    // Positional approximation for turn; event handlers track precise turn numbers.
    turn: index,
    // Client-computed safety and called status; always false at snapshot time.
    safe: false,
    called: false,
  }));

  return {
    ...snapshot,
    discard_pile,
  } as ClientGameState;
}
