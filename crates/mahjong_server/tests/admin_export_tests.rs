//! Unit tests for admin export and replay download data structures.

use chrono::Utc;
use mahjong_core::{
    history::{MoveAction, MoveHistoryEntry, MoveHistorySummary},
    player::Seat,
    table::Table,
    tile::tiles::BAM_1,
};
use mahjong_server::network::admin::ReplayData;
use std::collections::HashMap;
use ts_rs::TS;

#[test]
fn test_replay_data_serialization() {
    // 1. Create a dummy history summary
    let summary = MoveHistorySummary {
        move_number: 1,
        timestamp: Utc::now(),
        seat: Seat::East,
        action: MoveAction::DiscardTile { tile: BAM_1 },
        description: "East discards 1 Bamboo".to_string(),
    };

    // 2. Create ReplayData
    let mut players = HashMap::new();
    players.insert(Seat::East, "player_123".to_string());
    players.insert(Seat::South, "player_456".to_string());

    let replay_data = ReplayData {
        room_id: "room_xyz".to_string(),
        created_at: Utc::now(),
        players,
        history: vec![summary.clone()],
    };

    // 3. Serialize
    let json = serde_json::to_string(&replay_data).expect("Failed to serialize ReplayData");

    // 4. Deserialize (to verify round-trip)
    let deserialized: ReplayData =
        serde_json::from_str(&json).expect("Failed to deserialize ReplayData");

    // 5. Verify fields
    assert_eq!(deserialized.room_id, "room_xyz");
    assert_eq!(deserialized.players.len(), 2);
    assert_eq!(
        deserialized.players.get(&Seat::East).map(|s| s.as_str()),
        Some("player_123")
    );
    assert_eq!(deserialized.history.len(), 1);

    let history_entry = &deserialized.history[0];
    assert_eq!(history_entry.move_number, 1);
    assert_eq!(history_entry.seat, Seat::East);
    if let MoveAction::DiscardTile { tile } = history_entry.action {
        assert_eq!(tile, BAM_1);
    } else {
        panic!("Wrong action type");
    }
}

#[test]
fn test_export_history_structure() {
    // admin_export_history returns Vec<MoveHistoryEntry> directly
    // Verify pure Vec<MoveHistoryEntry> serialization

    let snapshot = Table::new("export_test".to_string(), 0);
    let entry1 = MoveHistoryEntry {
        move_number: 0,
        timestamp: Utc::now(),
        seat: Seat::East,
        action: MoveAction::DrawTile {
            tile: BAM_1,
            visible: true,
        },
        description: "Start".to_string(),
        is_decision_point: true,
        snapshot: snapshot.clone(),
    };

    let history = vec![entry1];

    let json = serde_json::to_string(&history).expect("Failed to serialize history vector");
    let deserialized: Vec<MoveHistoryEntry> =
        serde_json::from_str(&json).expect("Failed to deserialize history vector");

    assert_eq!(deserialized.len(), 1);
    assert_eq!(deserialized[0].description, "Start");
}

#[test]
fn test_export_bindings() {
    // This will write ReplayData.ts to the configured path.
    // If path is wrong, it might fail or write to wrong place.
    // We mainly check that it doesn't panic.
    ReplayData::export().expect("Failed to export ReplayData bindings");
}
