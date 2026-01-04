/**
 * TypeScript type definitions matching Rust backend types
 * These types mirror the structures in crates/mahjong_core/src
 */

// ===== TILE TYPES =====

/**
 * A tile represented as a single number (0-36)
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34:    Flower
 * - 35:    Joker
 * - 36:    Blank (House Rule)
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

// ===== GAME EVENT TYPES =====

export type GameEvent =
  // Game Lifecycle
  | { type: 'GameCreated'; game_id: string }
  | { type: 'PlayerJoined'; player: Seat; player_id: string; is_bot: boolean }
  | { type: 'GameStarting' }
  // Setup Phase
  | { type: 'DiceRolled'; roll: number }
  | { type: 'WallBroken'; position: number }
  | { type: 'TilesDealt'; your_tiles: Tile[] }
  // Charleston Phase
  | { type: 'CharlestonPhaseChanged'; stage: CharlestonStage }
  | { type: 'PlayerReadyForPass'; player: Seat }
  | { type: 'TilesPassing'; direction: PassDirection }
  | { type: 'TilesReceived'; tiles: Tile[] }
  | { type: 'PlayerVoted'; player: Seat }
  | { type: 'VoteResult'; result: CharlestonVote }
  | { type: 'CharlestonComplete' }
  // Main Game Phase
  | { type: 'PhaseChanged'; phase: GamePhase }
  | { type: 'TurnChanged'; player: Seat; stage: TurnStage }
  | { type: 'TileDrawn'; tile: Tile | null; remaining_tiles: number }
  | { type: 'TileDiscarded'; player: Seat; tile: Tile }
  | { type: 'CallWindowOpened'; tile: Tile; discarded_by: Seat; can_call: Seat[] }
  | { type: 'CallWindowClosed' }
  | { type: 'TileCalled'; player: Seat; meld: Meld; called_tile: Tile }
  // Special Actions
  | { type: 'JokerExchanged'; player: Seat; target_seat: Seat; joker: Tile; replacement: Tile }
  | { type: 'BlankExchanged'; player: Seat }
  // Win/Scoring
  | { type: 'MahjongDeclared'; player: Seat }
  | { type: 'HandValidated'; player: Seat; valid: boolean; pattern: string | null }
  // Game End
  | { type: 'GameOver'; winner: Seat | null; result: GameResult }
  // Errors
  | { type: 'CommandRejected'; player: Seat; reason: string }
  // Player Connection
  | { type: 'PlayerDisconnected'; player: Seat }
  | { type: 'PlayerReconnected'; player: Seat };

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
  | { type: 'Event'; event: GameEvent }
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
