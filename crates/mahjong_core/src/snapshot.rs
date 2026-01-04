//! State snapshot types for client reconnection.
//!
//! When a player reconnects, they need to receive the current game state.
//! This module defines the snapshot format that includes both public information
//! (visible to all players) and private information (only for the reconnecting player).

use crate::{
    flow::GamePhase,
    meld::Meld,
    player::{Seat, PlayerStatus},
    table::HouseRules,
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

    // Private data - only sent to the reconnecting player
    pub your_seat: Seat,
    pub your_hand: Vec<Tile>,
}
