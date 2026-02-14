/**
 * TypeScript type definitions matching Rust backend types
 * These types mirror the structures in crates/mahjong_core/src
 *
 * @deprecated
 * This file contains legacy hand-written type declarations that diverge from the
 * auto-generated types in {@link ./generated/}. Prefer using types from
 * `generated/` whenever available. This file is maintained for backward compatibility only.
 * See {@link generated/GameStateSnapshot.ts} for the canonical type definitions.
 */
import type { Event as ServerEvent } from './generated/Event';

// ===== TILE TYPES =====

/**
 * A tile represented as a single number (0-43)
 * - 0-8:    Bams (1-9)
 * - 9-17:   Cracks (1-9)
 * - 18-26:  Dots (1-9)
 * - 27-30:  Winds (East, South, West, North)
 * - 31-33:  Dragons (Green, Red, White/Soap)
 * - 34-41:  Flowers (8 variants for different seasons)
 * - 42:     Joker (wild tile)
 * - 43:     Blank (unused/placeholder)
 *
 * @see See {@link ../../../lib/utils/tileUtils.ts} for tile utility functions and constants.
 */
export type Tile = number;

// ===== PLAYER TYPES =====

export type Seat = 'East' | 'South' | 'West' | 'North';

export type PlayerStatus = 'Active' | 'Dead' | 'Waiting' | 'Disconnected';

export interface PlayerPublic {
  seat: Seat;
  player_id: string;
  is_bot: boolean;
  status: PlayerStatus;
  tile_count: number;
  exposed_melds: Meld[];
}

// ===== MELD TYPES =====

export type MeldType = 'Pung' | 'Kong' | 'Quint';

export interface Meld {
  meld_type: MeldType;
  tiles: Tile[];
  called_tile: Tile | null;
  joker_assignments: Record<number, Tile>;
}

// ===== GAME PHASE TYPES =====

export type SetupStage = 'RollingDice' | 'BreakingWall' | 'Dealing' | 'OrganizingHands';

export type CharlestonStage =
  | 'FirstRight'
  | 'FirstAcross'
  | 'FirstLeft'
  | 'VotingToContinue'
  | 'SecondLeft'
  | 'SecondAcross'
  | 'SecondRight'
  | 'CourtesyAcross'
  | 'Complete';

export type PassDirection = 'Right' | 'Across' | 'Left';

export type CharlestonVote = 'Continue' | 'Stop';

export type TurnStage = 'Drawing' | 'Discarding' | 'CallWindow';

export interface WinContext {
  winner: Seat;
  tile: Tile | null;
  was_called: boolean;
}

export interface GameResult {
  winner: Seat;
  winning_pattern: string;
  final_hands: Record<string, unknown>; // HashMap<Seat, Hand>
}

export type GamePhase =
  | { type: 'WaitingForPlayers' }
  | { type: 'Setup'; stage: SetupStage }
  | { type: 'Charleston'; stage: CharlestonStage }
  | { type: 'Playing'; stage: TurnStage; player: Seat }
  | { type: 'Scoring'; context: WinContext }
  | { type: 'GameOver'; result: GameResult };

// Event types are generated via ts-rs under `types/bindings/generated`.

// ===== COMMAND TYPES =====

export type Command =
  | { type: 'JoinGame'; player_id: string }
  | { type: 'Ready' }
  | { type: 'SelectCharlestonTiles'; tiles: Tile[] }
  | { type: 'VoteCharleston'; vote: CharlestonVote }
  | { type: 'Discard'; tile: Tile }
  | { type: 'Call'; meld_type: MeldType }
  | { type: 'Pass' }
  | { type: 'ExchangeJoker'; target_seat: Seat; meld_index: number; replacement: Tile }
  | { type: 'DeclareMahjong' };

// ===== HAND TYPES =====

export interface Hand {
  concealed: Tile[];
  exposed: Meld[];
}

// ===== WEBSOCKET MESSAGE TYPES =====

export type ServerMessage =
  | { type: 'Event'; event: ServerEvent }
  | { type: 'Error'; message: string }
  | { type: 'StateSnapshot'; snapshot: GameStateSnapshot }
  | { type: 'Pong'; timestamp: number };

export type ClientMessage =
  | { type: 'Command'; command: Command }
  | { type: 'RequestState' }
  | { type: 'Ping'; timestamp: number };

// ===== STATE SNAPSHOT (for reconnect) =====

export interface GameStateSnapshot {
  phase: GamePhase;
  players: Record<string, PlayerPublic>; // Seat -> PlayerPublic
  my_seat: Seat | null;
  turn: Seat | null;
  wall_remaining: number;
  discard_pile: Tile[];
  hand: Hand;
}

// ===== UTILITY TYPES =====

export interface TileWithKey {
  tile: Tile;
  key: string;
}
