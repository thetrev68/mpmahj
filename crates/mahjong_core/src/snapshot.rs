//! State snapshot types for client reconnection.
//!
//! When a player reconnects, they need to receive the current game state.
//! This module defines the snapshot format that includes both public information
//! (visible to all players) and private information (only for the reconnecting player).

use crate::{
    flow::charleston::CharlestonState,
    flow::GamePhase,
    meld::Meld,
    player::{PlayerStatus, Seat},
    table::{HouseRules, TimerMode},
    tile::Tile,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Public information about a player visible to all.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub struct PublicPlayerInfo {
    /// Player seat at the table.
    pub seat: Seat,
    /// Player identifier string.
    pub player_id: String,
    /// Whether the player is a bot.
    pub is_bot: bool,
    /// Current player status (Active, Waiting, etc.).
    pub status: PlayerStatus,
    /// Total tile count (concealed + exposed).
    pub tile_count: usize,
    /// Exposed melds visible to everyone.
    pub exposed_melds: Vec<Meld>,
}

/// Discarded tile with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub struct DiscardInfo {
    /// The tile that was discarded.
    pub tile: Tile,
    /// The seat that discarded the tile.
    pub discarded_by: Seat,
}

/// Complete game state snapshot for reconnection.
/// Contains all public game state plus the reconnecting player's private hand.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub struct GameStateSnapshot {
    /// Unique game identifier.
    pub game_id: String,
    /// Current phase and sub-phase of the game.
    pub phase: GamePhase,
    /// Seat whose turn it is.
    pub current_turn: Seat,
    /// Current dealer (East seat).
    pub dealer: Seat,
    /// Current round number (1-based).
    pub round_number: u32,
    /// Turn counter for undo/restore support and AI decisions.
    pub turn_number: u32,
    /// Tiles remaining in the wall (excluding dead wall).
    pub remaining_tiles: usize,
    /// Discard pile in order of discard.
    pub discard_pile: Vec<DiscardInfo>,
    /// Public player information for each seat.
    pub players: Vec<PublicPlayerInfo>,
    /// Active house rules and ruleset configuration.
    pub house_rules: HouseRules,
    /// Charleston state if currently in Charleston.
    pub charleston_state: Option<CharlestonState>,

    // Private data - only sent to the reconnecting player
    /// The reconnecting player's seat.
    pub your_seat: Seat,
    /// The reconnecting player's concealed hand.
    pub your_hand: Vec<Tile>,

    /// Wall state for deterministic replay.
    /// Shuffle seed used for the wall.
    pub wall_seed: u64,
    /// Number of tiles drawn from the wall so far.
    pub wall_draw_index: usize,
    /// Wall break point (dead wall size / 2).
    pub wall_break_point: u8,
    /// Remaining tiles in the wall, including the dead wall.
    pub wall_tiles_remaining: usize,

    /// Full hands for all players (only populated for server-side snapshots/admin).
    #[ts(optional)]
    pub all_player_hands: Option<std::collections::HashMap<Seat, Vec<Tile>>>,
}

impl GameStateSnapshot {
    /// Get the card year for this game's ruleset.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::snapshot::GameStateSnapshot;
    ///
    /// fn card_year(snapshot: &GameStateSnapshot) -> u16 {
    ///     snapshot.card_year()
    /// }
    /// ```
    pub fn card_year(&self) -> u16 {
        self.house_rules.ruleset.card_year
    }

    /// Get the timer mode for this game's ruleset.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::snapshot::GameStateSnapshot;
    ///
    /// fn timer_mode(snapshot: &GameStateSnapshot) {
    ///     let _ = snapshot.timer_mode();
    /// }
    /// ```
    pub fn timer_mode(&self) -> &TimerMode {
        &self.house_rules.ruleset.timer_mode
    }

    /// Check if timers should be visible to players.
    /// Returns true for Visible mode, false for Hidden mode.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::snapshot::GameStateSnapshot;
    ///
    /// fn timers_visible(snapshot: &GameStateSnapshot) -> bool {
    ///     snapshot.timers_visible()
    /// }
    /// ```
    pub fn timers_visible(&self) -> bool {
        matches!(self.house_rules.ruleset.timer_mode, TimerMode::Visible)
    }
}
