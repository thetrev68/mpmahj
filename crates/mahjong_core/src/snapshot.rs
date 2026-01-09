//! State snapshot types for client reconnection.
//!
//! When a player reconnects, they need to receive the current game state.
//! This module defines the snapshot format that includes both public information
//! (visible to all players) and private information (only for the reconnecting player).

use crate::{
    flow::{CharlestonState, GamePhase},
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
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct PublicPlayerInfo {
    pub seat: Seat,
    pub player_id: String,
    pub is_bot: bool,
    pub status: PlayerStatus,
    pub tile_count: usize,
    pub exposed_melds: Vec<Meld>,
}

/// Discarded tile with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct DiscardInfo {
    pub tile: Tile,
    pub discarded_by: Seat,
}

/// Complete game state snapshot for reconnection.
/// Contains all public game state plus the reconnecting player's private hand.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct GameStateSnapshot {
    pub game_id: String,
    pub phase: GamePhase,
    pub current_turn: Seat,
    pub dealer: Seat,
    pub round_number: u32,
    pub remaining_tiles: usize,
    pub discard_pile: Vec<DiscardInfo>,
    pub players: Vec<PublicPlayerInfo>,
    pub house_rules: HouseRules,
    pub charleston_state: Option<CharlestonState>,

    // Private data - only sent to the reconnecting player
    pub your_seat: Seat,
    pub your_hand: Vec<Tile>,

    /// Wall state for deterministic replay.
    pub wall_seed: u64,
    pub wall_draw_index: usize,
    pub wall_break_point: u8,
    pub wall_tiles_remaining: usize,

    /// Full hands for all players (only populated for server-side snapshots/admin).
    #[ts(optional)]
    pub all_player_hands: Option<std::collections::HashMap<Seat, Vec<Tile>>>,
}

impl GameStateSnapshot {
    /// Get the card year for this game's ruleset.
    pub fn card_year(&self) -> u16 {
        self.house_rules.ruleset.card_year
    }

    /// Get the timer mode for this game's ruleset.
    pub fn timer_mode(&self) -> &TimerMode {
        &self.house_rules.ruleset.timer_mode
    }

    /// Check if timers should be visible to players.
    /// Returns true for Visible mode, false for Hidden mode.
    pub fn timers_visible(&self) -> bool {
        matches!(self.house_rules.ruleset.timer_mode, TimerMode::Visible)
    }
}
