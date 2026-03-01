/**
 * @module clientGameState
 *
 * Client-facing game state types.
 *
 * Terminology:
 * - Server snapshot: fields sourced directly from the server's `GameStateSnapshot` binding.
 *   These fields must not be mutated or re-shaped on the client side.
 * - Client view model: fields that exist only on the client, either extending server data
 *   with display metadata or holding client-only transient concerns.
 *
 * `ClientGameState` is the client's working representation of game state.
 * It is structurally a superset of `GameStateSnapshot` — it includes all server-owned
 * fields plus client-only fields that must not be attached directly to generated types.
 *
 * Phase 1 of the frontend refactor moves this definition out of `GameBoard.tsx` so that
 * the boundary between server-owned and client-owned state is explicit at the type level.
 */

import type { CharlestonState } from '@/types/bindings/generated/CharlestonState';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { PlayerStatus } from '@/types/bindings/generated/PlayerStatus';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';

/**
 * Client-extended discard entry.
 *
 * Extends the server's `DiscardInfo` with metadata that is computed client-side
 * (turn number, safe/called status). These fields are not present on the server snapshot.
 */
export interface LocalDiscardInfo extends DiscardInfo {
  /** Legacy alias for discarded_by — kept for existing consumer compatibility. */
  player: Seat;
  /** Turn on which this tile was discarded. */
  turn: number;
  /** Whether the tile is safe to call from the current player's perspective. */
  safe: boolean;
  /** Whether this discard was already called by another player. */
  called: boolean;
}

/**
 * Client game state: the client's working view of an active game.
 *
 * --- Server-owned fields (mirror GameStateSnapshot — do not mutate) ---
 *   game_id, phase, current_turn, dealer, round_number, turn_number,
 *   your_seat, your_hand, house_rules, charleston_state, players,
 *   remaining_tiles, wall_seed, wall_draw_index, wall_break_point, wall_tiles_remaining
 *
 * --- Client-only fields (not present on GameStateSnapshot) ---
 *   discard_pile  – extended with client metadata via LocalDiscardInfo
 *
 * --- Client-extended player fields ---
 *   players[i].exposed_melds – melds enriched client-side with `called_from` metadata
 *     set by call-resolution event handlers. The base `Meld` fields come from the server
 *     snapshot; `called_from` is added when a `TileCalled` event is processed.
 */
export interface ClientGameState {
  // --- Server-owned fields ---

  game_id: string;
  phase: GamePhase;
  current_turn: Seat;
  dealer: Seat;
  round_number: number;
  turn_number: number;
  your_seat: Seat;
  your_hand: Tile[];
  house_rules: {
    ruleset: {
      card_year: number;
      timer_mode: TimerMode;
      blank_exchange_enabled: boolean;
      call_window_seconds: number;
      charleston_timer_seconds: number;
    };
    analysis_enabled: boolean;
    concealed_bonus_enabled: boolean;
    dealer_bonus_enabled: boolean;
  };
  charleston_state: CharlestonState | null;
  players: Array<{
    seat: Seat;
    player_id: string;
    is_bot: boolean;
    status: PlayerStatus;
    tile_count: number;
    /**
     * Exposed melds for this player.
     * CLIENT-EXTENDED: may include `called_from` metadata added client-side by
     * call-resolution event handlers. The base `Meld` fields mirror the server snapshot.
     */
    exposed_melds: Array<Meld & { called_from?: Seat }>;
  }>;
  remaining_tiles: number;
  wall_seed: bigint;
  wall_draw_index: number;
  wall_break_point: number;
  wall_tiles_remaining: number;

  // --- Client-extended fields ---

  /**
   * Discard pile extended with client-side metadata (turn, safe, called).
   * The base `tile` and `discarded_by` fields come from the server snapshot.
   */
  discard_pile: Array<LocalDiscardInfo>;
}

/**
 * Backward-compatible alias for `ClientGameState`.
 * Prefer `ClientGameState` in new code.
 */
export type GameState = ClientGameState;
