//! Public game events broadcast to all seated players.
//!
//! This module defines the public-facing event enum used by the server to
//! notify every client about state transitions.

use crate::{
    call_resolution::CallResolution,
    flow::{
        charleston::{CharlestonStage, CharlestonVote, PassDirection},
        outcomes::{AbandonReason, GameResult},
        playing::TurnStage,
        GamePhase,
    },
    history::{HistoryMode, MoveHistorySummary},
    meld::Meld,
    player::Seat,
    table::TimerMode,
    tile::Tile,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Events broadcast to all players at the table.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum PublicEvent {
    /// Full history list sent to client.
    HistoryList {
        /// Summaries of prior moves for reconstruction or replay.
        entries: Vec<MoveHistorySummary>,
    },
    /// State restored to a specific move.
    StateRestored {
        /// Move number the game was rewound to.
        move_number: u32,
        /// Human-readable description of the restore action.
        description: String,
        /// Mode used for the restore.
        mode: HistoryMode,
    },
    /// Future moves deleted when resuming from history.
    HistoryTruncated {
        /// First move removed from history.
        from_move: u32,
    },
    /// Error: invalid history request.
    HistoryError {
        /// Reason the history request failed.
        message: String,
    },

    // ===== GAME LIFECYCLE =====
    /// Game was created and is waiting for players.
    GameCreated {
        /// Server-generated game identifier.
        game_id: String,
    },
    /// A player joined the game.
    PlayerJoined {
        /// Seat assigned to the player.
        player: Seat,
        /// Backend player identifier.
        player_id: String,
        /// True if the player is an automated bot.
        is_bot: bool,
    },
    /// All players joined, game is starting.
    GameStarting,

    // ===== SETUP PHASE =====
    /// East rolled the dice.
    DiceRolled {
        /// Dice roll value (2-12).
        roll: u8,
    },
    /// Wall was broken at the dice position.
    WallBroken {
        /// Index of the wall break position.
        position: usize,
    },

    // ===== CHARLESTON PHASE =====
    /// Charleston phase changed.
    CharlestonPhaseChanged {
        /// Current Charleston stage.
        stage: CharlestonStage,
    },
    /// A player submitted their tiles for the current pass.
    PlayerReadyForPass {
        /// Seat that is ready to pass tiles.
        player: Seat,
    },
    /// All players ready, tiles are being passed now.
    TilesPassing {
        /// Direction tiles are being passed.
        direction: PassDirection,
    },
    /// A player voted during the continue/stop decision.
    PlayerVoted {
        /// Seat that cast the vote.
        player: Seat,
    },
    /// Voting complete, result announced.
    VoteResult {
        /// Outcome of the Charleston vote.
        result: CharlestonVote,
    },
    /// Charleston is complete, main game starting.
    CharlestonComplete,
    /// Charleston timer started for current pass stage.
    CharlestonTimerStarted {
        /// Charleston stage the timer applies to.
        stage: CharlestonStage,
        /// Timer duration in seconds.
        duration: u32,
        /// Server start timestamp (epoch ms).
        started_at_ms: u64,
        /// Whether the timer should be visible to clients.
        timer_mode: TimerMode,
    },
    /// Courtesy pass complete for the entire table.
    CourtesyPassComplete,

    // ===== MAIN GAME PHASE =====
    /// Game phase changed.
    PhaseChanged {
        /// New phase.
        phase: GamePhase,
    },
    /// Turn changed to a new player.
    TurnChanged {
        /// Seat whose turn it is.
        player: Seat,
        /// Sub-stage of the turn.
        stage: TurnStage,
    },
    /// A tile was drawn from the wall; tile value hidden.
    TileDrawnPublic {
        /// Remaining tiles after the draw.
        remaining_tiles: usize,
    },
    /// A tile was discarded.
    TileDiscarded {
        /// Seat that discarded.
        player: Seat,
        /// Tile discarded.
        tile: Tile,
    },
    /// Call window opened (other players can call or pass).
    CallWindowOpened {
        /// Tile available for call.
        tile: Tile,
        /// Seat that discarded the tile.
        discarded_by: Seat,
        /// Seats eligible to call.
        can_call: Vec<Seat>,
        /// Timer duration in seconds.
        timer: u32,
        /// Server start timestamp (epoch ms).
        started_at_ms: u64,
        /// Whether the timer should be shown.
        timer_mode: TimerMode,
    },
    /// Call window closed, no one called.
    CallWindowClosed,
    /// Call window resolved after buffering intents.
    CallResolved {
        /// Final call resolution (who called, meld shape).
        resolution: CallResolution,
    },
    /// A player called the discard and exposed a meld.
    TileCalled {
        /// Seat that called the tile.
        player: Seat,
        /// Meld exposed with the called tile.
        meld: Meld,
        /// Tile that was called.
        called_tile: Tile,
    },

    // ===== SPECIAL ACTIONS =====
    /// A Joker was exchanged from an exposed meld.
    JokerExchanged {
        /// Seat performing the exchange.
        player: Seat,
        /// Seat owning the target meld.
        target_seat: Seat,
        /// Joker removed from the meld.
        joker: Tile,
        /// Tile inserted into the meld.
        replacement: Tile,
    },
    /// A blank tile was exchanged (secret, no tile revealed).
    BlankExchanged {
        /// Seat performing the exchange.
        player: Seat,
    },

    // ===== WIN/SCORING =====
    /// A player declared Mahjong.
    MahjongDeclared {
        /// Seat declaring mahjong.
        player: Seat,
    },
    /// Hand validation result.
    HandValidated {
        /// Seat whose hand was validated.
        player: Seat,
        /// Whether the hand is valid.
        valid: bool,
        /// Optional winning pattern name.
        pattern: Option<String>,
    },
    /// Wall exhausted with no winner (draw).
    WallExhausted {
        /// Tiles remaining when the wall exhausted.
        remaining_tiles: usize,
    },
    /// Game was abandoned before completion.
    GameAbandoned {
        /// Reason for abandonment.
        reason: AbandonReason,
        /// Seat that initiated abandonment, if any.
        initiator: Option<Seat>,
    },

    // ===== GAME END =====
    /// Game over.
    GameOver {
        /// Winner, if any.
        winner: Option<Seat>,
        /// Final game result.
        result: GameResult,
    },

    // ===== MULTIPLAYER STALLING CONTROLS =====
    /// Game was paused by the host or admin.
    GamePaused {
        /// Seat that paused the game.
        by: Seat,
        /// Optional reason for the pause.
        reason: Option<String>,
    },
    /// Game was resumed by the host or admin.
    GameResumed {
        /// Seat that resumed the game.
        by: Seat,
    },
    /// A player forfeited the game.
    PlayerForfeited {
        /// Seat that forfeited.
        player: Seat,
        /// Optional reason for forfeiting.
        reason: Option<String>,
    },

    // ===== ADMIN OVERRIDES =====
    /// Admin forced a player to forfeit.
    AdminForfeitOverride {
        /// Admin user ID from JWT.
        admin_id: String,
        /// Admin display name for UI.
        admin_display_name: String,
        /// Seat that was forced to forfeit.
        forfeited_player: Seat,
        /// Reason provided by admin.
        reason: String,
    },
    /// Admin paused the game.
    AdminPauseOverride {
        /// Admin user ID from JWT.
        admin_id: String,
        /// Admin display name for UI.
        admin_display_name: String,
        /// Reason provided by admin.
        reason: String,
    },
    /// Admin resumed the game.
    AdminResumeOverride {
        /// Admin user ID from JWT.
        admin_id: String,
        /// Admin display name for UI.
        admin_display_name: String,
    },

    // ===== ERRORS =====
    /// A command was rejected.
    CommandRejected {
        /// Seat whose command was rejected.
        player: Seat,
        /// Reason the command was rejected.
        reason: String,
    },
}
