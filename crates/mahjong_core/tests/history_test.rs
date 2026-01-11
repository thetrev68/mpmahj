//! Unit tests for history module types and behavior.

use chrono::Utc;
use mahjong_core::{
    history::{HistoryMode, MoveAction, MoveHistoryEntry},
    player::Seat,
    table::Table,
    tile::Tile,
};

#[test]
fn test_history_entry_creation() {
    let table = Table::new("test".to_string(), 12345);
    let entry = MoveHistoryEntry {
        move_number: 0,
        timestamp: Utc::now(),
        seat: Seat::East,
        action: MoveAction::DrawTile {
            tile: Tile::new(0), // 1 Bam
            visible: true,
        },
        description: "Move 0 - East drew 1B".to_string(),
        snapshot: table.clone(),
    };

    assert_eq!(entry.move_number, 0);
    assert_eq!(entry.seat, Seat::East);
    assert_eq!(entry.description, "Move 0 - East drew 1B");
    matches!(entry.action, MoveAction::DrawTile { .. });
}

#[test]
fn test_history_mode_default() {
    let mode = HistoryMode::default();
    assert_eq!(mode, HistoryMode::None);
}

#[test]
fn test_history_mode_transitions() {
    // None → Viewing
    let mode = HistoryMode::None;
    assert_eq!(mode, HistoryMode::None);

    let viewing = HistoryMode::Viewing { at_move: 5 };
    assert!(matches!(viewing, HistoryMode::Viewing { at_move: 5 }));

    // Viewing → Paused
    let paused = HistoryMode::Paused { at_move: 5 };
    assert!(matches!(paused, HistoryMode::Paused { at_move: 5 }));

    // Paused → None
    let back_to_none = HistoryMode::None;
    assert_eq!(back_to_none, HistoryMode::None);
}

#[test]
fn test_move_action_draw_tile() {
    let action = MoveAction::DrawTile {
        tile: Tile::new(13), // 5 Crak
        visible: false,
    };

    if let MoveAction::DrawTile { tile, visible } = action {
        assert_eq!(tile, Tile::new(13)); // 5 Crak
        assert!(!visible);
    } else {
        panic!("Expected DrawTile action");
    }
}

#[test]
fn test_move_action_discard_tile() {
    let action = MoveAction::DiscardTile {
        tile: Tile::new(26), // 9 Dot
    };

    if let MoveAction::DiscardTile { tile } = action {
        assert_eq!(tile, Tile::new(26)); // 9 Dot
    } else {
        panic!("Expected DiscardTile action");
    }
}

#[test]
fn test_move_action_descriptions() {
    // Test that descriptions are human-readable
    let descriptions = vec![
        "Move 0 - East drew 1B",
        "Move 1 - South discarded 9D",
        "Move 2 - West called Pung of 5C",
        "Move 3 - North passed 3 tiles Right",
        "Move 4 - East declared Mahjong with 'Consecutive Run' for 25 points",
    ];

    for desc in descriptions {
        // Verify descriptions contain key information
        assert!(desc.starts_with("Move "));
        assert!(desc.contains(" - "));

        // Verify they're reasonably sized (not empty, not too long)
        assert!(desc.len() > 10);
        assert!(desc.len() < 200);
    }
}

#[test]
fn test_history_entry_serialization() {
    use serde_json;

    let table = Table::new("test".to_string(), 12345);
    let entry = MoveHistoryEntry {
        move_number: 42,
        timestamp: Utc::now(),
        seat: Seat::West,
        action: MoveAction::DiscardTile {
            tile: Tile::new(31), // Green Dragon
        },
        description: "Move 42 - West discarded Green Dragon".to_string(),
        snapshot: table,
    };

    // Should serialize without errors
    let json = serde_json::to_string(&entry).expect("Failed to serialize");
    assert!(!json.is_empty());

    // Should deserialize back
    let deserialized: MoveHistoryEntry =
        serde_json::from_str(&json).expect("Failed to deserialize");
    assert_eq!(deserialized.move_number, 42);
    assert_eq!(deserialized.seat, Seat::West);
}

#[test]
fn test_history_mode_equality() {
    assert_eq!(HistoryMode::None, HistoryMode::None);
    assert_eq!(
        HistoryMode::Viewing { at_move: 10 },
        HistoryMode::Viewing { at_move: 10 }
    );
    assert_eq!(
        HistoryMode::Paused { at_move: 20 },
        HistoryMode::Paused { at_move: 20 }
    );

    // Different modes
    assert_ne!(HistoryMode::None, HistoryMode::Viewing { at_move: 0 });
    assert_ne!(
        HistoryMode::Viewing { at_move: 5 },
        HistoryMode::Paused { at_move: 5 }
    );

    // Different move numbers
    assert_ne!(
        HistoryMode::Viewing { at_move: 5 },
        HistoryMode::Viewing { at_move: 10 }
    );
}

#[test]
fn test_move_action_clone() {
    let action = MoveAction::DeclareWin {
        pattern_name: "Consecutive Run".to_string(),
        score: 25,
    };

    let cloned = action.clone();

    if let (
        MoveAction::DeclareWin {
            pattern_name: name1,
            score: score1,
        },
        MoveAction::DeclareWin {
            pattern_name: name2,
            score: score2,
        },
    ) = (action, cloned)
    {
        assert_eq!(name1, name2);
        assert_eq!(score1, score2);
    } else {
        panic!("Expected DeclareWin action");
    }
}
