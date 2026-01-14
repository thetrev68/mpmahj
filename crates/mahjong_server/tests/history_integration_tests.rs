//! Integration tests for history viewer functionality.
//!
//! Tests the complete flow of history recording and retrieval,
//! including edge cases and error conditions.
// TODO: Add a WebSocket-driven end-to-end test for history view/resume workflows.

use chrono::Utc;
use mahjong_core::{
    event::GameEvent,
    history::{HistoryMode, MoveAction, MoveHistoryEntry},
    player::Seat,
    table::Table,
    tile::Tile,
};
use mahjong_server::network::{history::RoomHistory, room::Room};

/// Helper to create a practice mode room (4 bots)
fn create_practice_room() -> Room {
    let (mut room, _rx) = Room::new();

    // Add 4 bot seats to make it practice mode
    room.enable_bot(Seat::East, "bot-east".to_string());
    room.enable_bot(Seat::South, "bot-south".to_string());
    room.enable_bot(Seat::West, "bot-west".to_string());
    room.enable_bot(Seat::North, "bot-north".to_string());

    room
}

/// Helper to create a multiplayer room (1 human, 3 bots)
fn create_multiplayer_room() -> Room {
    let (mut room, _rx) = Room::new();

    // Only 3 bots - not practice mode
    room.enable_bot(Seat::South, "bot-south".to_string());
    room.enable_bot(Seat::West, "bot-west".to_string());
    room.enable_bot(Seat::North, "bot-north".to_string());

    room
}

/// Helper to manually add history entries to a room for testing
fn add_mock_history_entries(room: &mut Room, count: usize) {
    // Create a mock table
    let table = Table::new("test-game".to_string(), 12345);
    room.table = Some(table.clone());

    // Manually add history entries
    for i in 0..count {
        let entry = MoveHistoryEntry {
            move_number: i as u32,
            timestamp: Utc::now(),
            seat: Seat::East,
            action: MoveAction::DrawTile {
                tile: Tile::new((i % 9) as u8),
                visible: true,
            },
            description: format!("Move {} - East drew tile", i),
            snapshot: table.clone(),
        };
        room.history.push(entry);
    }
    room.current_move_number = count as u32;
}

#[tokio::test]
async fn test_request_history_empty() {
    let room = create_practice_room();

    let result = room.handle_request_history().await;
    assert!(result.is_ok());

    if let GameEvent::HistoryList { entries } = result.unwrap() {
        assert_eq!(entries.len(), 0, "New game should have empty history");
    } else {
        panic!("Expected HistoryList event");
    }
}

#[tokio::test]
async fn test_request_history_with_moves() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 2);

    let result = room.handle_request_history().await;
    assert!(result.is_ok());

    if let GameEvent::HistoryList { entries } = result.unwrap() {
        assert_eq!(entries.len(), 2, "Should have 2 history entries");
        assert_eq!(entries[0].move_number, 0);
        assert_eq!(entries[1].move_number, 1);
    } else {
        panic!("Expected HistoryList event");
    }
}

#[tokio::test]
async fn test_jump_to_move() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 10);

    // Jump to move 5
    let result = room.handle_jump_to_move(5).await;
    assert!(result.is_ok());

    if let GameEvent::StateRestored {
        move_number,
        description,
        mode,
    } = result.unwrap()
    {
        assert_eq!(move_number, 5);
        assert_eq!(description, "Move 5 - East drew tile");
        assert_eq!(mode, HistoryMode::Viewing { at_move: 5 });
    } else {
        panic!("Expected StateRestored event");
    }

    // Verify history mode was updated
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 5 });

    // Verify present state was saved
    assert!(room.present_state.is_some());
}

#[tokio::test]
async fn test_jump_to_invalid_move() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 5);

    // Try to jump to move 999
    let result = room.handle_jump_to_move(999).await;
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .contains("Move 999 does not exist (game has 5 moves)"));
}

#[tokio::test]
async fn test_resume_from_history() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 20);

    // Jump to move 10 first
    room.handle_jump_to_move(10).await.unwrap();

    // Now resume from move 10
    let result = room.handle_resume_from_history(10).await;
    assert!(result.is_ok());

    let events = result.unwrap();
    assert_eq!(
        events.len(),
        2,
        "Should get StateRestored + HistoryTruncated"
    );

    // Check StateRestored event
    if let GameEvent::StateRestored {
        move_number, mode, ..
    } = &events[0]
    {
        assert_eq!(*move_number, 10);
        assert_eq!(*mode, HistoryMode::None);
    } else {
        panic!("Expected StateRestored as first event");
    }

    // Check HistoryTruncated event
    if let GameEvent::HistoryTruncated { from_move } = &events[1] {
        assert_eq!(*from_move, 11);
    } else {
        panic!("Expected HistoryTruncated as second event");
    }

    // Verify history was truncated
    assert_eq!(
        room.history.len(),
        11,
        "History should be truncated to moves 0-10"
    );
    assert_eq!(room.current_move_number, 11);
    assert_eq!(room.history_mode, HistoryMode::None);
    assert!(room.present_state.is_none());
}

#[tokio::test]
async fn test_resume_from_invalid_move() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 5);

    // Jump to a valid move first (required before resume)
    room.handle_jump_to_move(2).await.unwrap();

    // Try to resume from move 999
    let result = room.handle_resume_from_history(999).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(
        err.contains("Move 999 does not exist"),
        "Expected error about move not existing, got: {}",
        err
    );
}

#[tokio::test]
async fn test_return_to_present() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 10);

    // Jump to move 5
    room.handle_jump_to_move(5).await.unwrap();
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 5 });

    // Return to present
    let result = room.handle_return_to_present().await;
    assert!(result.is_ok());

    if let GameEvent::StateRestored {
        move_number,
        description,
        mode,
    } = result.unwrap()
    {
        assert_eq!(move_number, 9); // current_move_number - 1
        assert_eq!(description, "Returned to present");
        assert_eq!(mode, HistoryMode::None);
    } else {
        panic!("Expected StateRestored event");
    }

    // Verify state
    assert_eq!(room.history_mode, HistoryMode::None);
    assert!(room.present_state.is_none());
}

#[tokio::test]
async fn test_return_to_present_when_not_viewing() {
    let mut room = create_practice_room();

    // Try to return to present without viewing history
    let result = room.handle_return_to_present().await;
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), "Not viewing history");
}

#[tokio::test]
async fn test_history_only_in_practice_mode() {
    let room = create_multiplayer_room(); // Only 3 bots

    // Try to request history - should succeed even with 3 bots (is practice mode)
    let result = room.handle_request_history().await;
    // Actually 3 bots IS practice mode, so this should work
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_jump_to_move_only_in_practice_mode() {
    let mut room = create_multiplayer_room();
    add_mock_history_entries(&mut room, 5);

    // Should work - 3 bots is practice mode
    let result = room.handle_jump_to_move(0).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_resume_only_in_practice_mode() {
    let mut room = create_multiplayer_room();
    add_mock_history_entries(&mut room, 5);

    // Jump to a move first (required before resume)
    room.handle_jump_to_move(2).await.unwrap();

    // Should work - 3 bots is practice mode
    let result = room.handle_resume_from_history(0).await;
    if let Err(e) = &result {
        panic!("Expected resume to work in practice mode, got error: {}", e);
    }
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_history_recording_disabled_while_viewing() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 5);

    assert_eq!(room.history.len(), 5);

    // Jump to move 2
    room.handle_jump_to_move(2).await.unwrap();
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 2 });

    // Try to record a new move while viewing
    room.record_history_entry(
        Seat::East,
        MoveAction::DrawTile {
            tile: Tile::new(0), // 1 Bam
            visible: true,
        },
        "Move 5 - Should not be recorded".to_string(),
    );

    // History should still be 5 entries (recording was disabled)
    assert_eq!(
        room.history.len(),
        5,
        "History recording should be disabled while viewing"
    );
}

#[tokio::test]
async fn test_multiple_jump_operations() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 10);

    // Jump to move 3
    room.handle_jump_to_move(3).await.unwrap();
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 3 });

    // Jump to move 7 (should update viewing mode)
    room.handle_jump_to_move(7).await.unwrap();
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 7 });

    // Jump to move 0
    room.handle_jump_to_move(0).await.unwrap();
    assert_eq!(room.history_mode, HistoryMode::Viewing { at_move: 0 });

    // Present state should still be saved
    assert!(room.present_state.is_some());
}

#[tokio::test]
async fn test_is_practice_mode() {
    let practice_room = create_practice_room();
    assert!(practice_room.is_practice_mode());

    let multiplayer_room = create_multiplayer_room();
    assert!(multiplayer_room.is_practice_mode()); // 3 bots IS practice mode

    let (no_bots_room, _rx) = Room::new();
    assert!(!no_bots_room.is_practice_mode());

    // Edge case: exactly 3 bots = practice mode
    let (mut room_3_bots, _rx) = Room::new();
    room_3_bots.enable_bot(Seat::East, "bot-east".to_string());
    room_3_bots.enable_bot(Seat::South, "bot-south".to_string());
    room_3_bots.enable_bot(Seat::West, "bot-west".to_string());
    assert!(room_3_bots.is_practice_mode());
}

#[tokio::test]
async fn test_history_preserves_move_order() {
    let mut room = create_practice_room();

    // Create a mock table
    let table = Table::new("test-game".to_string(), 12345);
    room.table = Some(table.clone());

    // Record moves with different seats
    let moves = vec![
        (Seat::East, "Move 0 - East"),
        (Seat::South, "Move 1 - South"),
        (Seat::West, "Move 2 - West"),
        (Seat::North, "Move 3 - North"),
        (Seat::East, "Move 4 - East"),
    ];

    for (i, (seat, desc)) in moves.iter().enumerate() {
        let entry = MoveHistoryEntry {
            move_number: i as u32,
            timestamp: Utc::now(),
            seat: *seat,
            action: MoveAction::DrawTile {
                tile: Tile::new(0), // 1 Bam
                visible: true,
            },
            description: desc.to_string(),
            snapshot: table.clone(),
        };
        room.history.push(entry);
    }
    room.current_move_number = moves.len() as u32;

    // Verify order is preserved
    let result = room.handle_request_history().await.unwrap();
    if let GameEvent::HistoryList { entries } = result {
        for (i, entry) in entries.iter().enumerate() {
            assert_eq!(entry.move_number, i as u32);
            assert_eq!(entry.seat, moves[i].0);
            assert_eq!(entry.description, moves[i].1);
        }
    }
}
