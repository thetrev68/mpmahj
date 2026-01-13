//! Table snapshot construction helpers.

use super::Table;
use crate::player::Seat;
use crate::snapshot::{DiscardInfo, GameStateSnapshot, PublicPlayerInfo};
use std::collections::HashMap;

/// Build a full snapshot that includes all player hands.
///
/// Intended for server persistence or admin tooling.
///
/// # Examples
/// ```no_run
/// use mahjong_core::table::{Table, snapshot::create_full_snapshot};
///
/// let table = Table::new("snapshot".to_string(), 0);
/// let snapshot = create_full_snapshot(&table);
/// let _ = snapshot;
/// ```
pub fn create_full_snapshot(table: &Table) -> GameStateSnapshot {
    let mut snapshot = create_snapshot(table, Seat::East);

    let mut all_hands = HashMap::new();
    for player in table.players.values() {
        all_hands.insert(player.seat, player.hand.concealed.clone());
    }
    snapshot.all_player_hands = Some(all_hands);

    snapshot
}

/// Build a snapshot scoped to the requesting seat.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::{Table, snapshot::create_snapshot};
///
/// let table = Table::new("snapshot-private".to_string(), 1);
/// let snapshot = create_snapshot(&table, Seat::East);
/// let _ = snapshot;
/// ```
pub fn create_snapshot(table: &Table, requesting_seat: Seat) -> GameStateSnapshot {
    // Convert players to public info
    let players: Vec<PublicPlayerInfo> = table
        .players
        .values()
        .map(|p| PublicPlayerInfo {
            seat: p.seat,
            player_id: p.id.clone(),
            is_bot: p.is_bot,
            status: p.status,
            tile_count: p.hand.tile_count(),
            exposed_melds: p.hand.exposed.clone(),
        })
        .collect();

    // Get private hand for requesting player
    let your_hand = table
        .players
        .get(&requesting_seat)
        .map(|p| p.hand.concealed.clone())
        .unwrap_or_default();

    // Convert discard pile
    let discard_pile: Vec<DiscardInfo> = table
        .discard_pile
        .iter()
        .map(|d| DiscardInfo {
            tile: d.tile,
            discarded_by: d.discarded_by,
        })
        .collect();

    GameStateSnapshot {
        game_id: table.game_id.clone(),
        phase: table.phase.clone(),
        current_turn: table.current_turn,
        dealer: table.dealer,
        round_number: table.round_number,
        remaining_tiles: table.wall.remaining(),
        discard_pile,
        players,
        house_rules: table.house_rules.clone(),
        charleston_state: table.charleston_state.clone(),
        your_seat: requesting_seat,
        your_hand,
        wall_seed: table.wall.seed,
        wall_draw_index: table.wall.draw_index,
        wall_break_point: table.wall.break_point as u8,
        wall_tiles_remaining: table.wall.total_tiles(),
        all_player_hands: None,
    }
}
