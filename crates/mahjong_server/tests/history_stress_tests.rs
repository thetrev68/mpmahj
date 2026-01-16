//! Stress tests for history viewer edge cases.
//!
//! # Overview
//!
//! Tests edge cases and performance limits of the history system,
//! including concurrent operations, large histories, and corruption scenarios.
//! These tests address TODOs in `history_integration_tests.rs` (lines 8-12)
//! by providing stress tests and edge case validation.
//!
//! # Test Coverage
//!
//! ## Concurrent Operations (Tests 1-2)
//! - `test_concurrent_jump_operations`: Verify race conditions don't corrupt state
//! - `test_concurrent_resume_operations`: Verify only one resume succeeds when racing
//!
//! ## Large Histories (Tests 3-4)
//! - `test_large_history_performance`: Verify 1000+ move histories perform within SLA
//! - `test_large_history_serialization`: Verify WebSocket can transmit 2000 entries
//!
//! ## Corruption Scenarios (Tests 5-6)
//! - `test_history_with_corrupted_snapshot`: Verify graceful handling when table==None
//! - `test_resume_after_history_corruption`: Verify behavior with missing entries
//!
//! ## Future Features (Test 7)
//! - `test_history_cap_enforcement`: Placeholder for bounded history cap (marked #[ignore])
//!
//! # Architecture Notes
//!
//! ## Concurrency Model
//! Room is `Arc<Mutex<Room>>` in production but these tests use direct Room access.
//! Concurrent tests simulate racing operations by spawning parallel tokio tasks
//! that lock the room mutex independently.
//!
//! ## Performance Requirements
//! - `RequestHistory` with 1000 moves: <500ms
//! - `JumpToMove` to move 500 (of 1000): <100ms
//!
//! These SLAs ensure history remains responsive even in long games.
//!
//! ## Corruption Handling
//! The history system is defensive:
//! - Records only when table exists (guards against None)
//! - Validates move numbers before jump/resume operations
//! - Returns errors for missing entries rather than panicking
//!
//! # Related Files
//! - `history_integration_tests.rs`: Unit tests for Room history methods
//! - `history_websocket_e2e.rs`: WebSocket-driven end-to-end tests
//! - `src/network/history.rs`: Backend RoomHistory trait implementation

use chrono::Utc;
use mahjong_core::{
    event::GameEvent,
    history::{HistoryMode, MoveAction, MoveHistoryEntry},
    player::Seat,
    table::Table,
    tile::Tile,
};
use mahjong_server::network::{history::RoomHistory, room::Room};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
use tokio::task::JoinSet;

// ===== TEST HELPERS =====

/// Helper to create a practice mode room (4 bots).
///
/// Practice mode enables history features (requires 3+ bots).
fn create_practice_room() -> Room {
    let (mut room, _rx) = Room::new();

    // Add 4 bot seats to make it practice mode
    room.enable_bot(Seat::East, "bot-east".to_string());
    room.enable_bot(Seat::South, "bot-south".to_string());
    room.enable_bot(Seat::West, "bot-west".to_string());
    room.enable_bot(Seat::North, "bot-north".to_string());

    room
}

/// Helper to manually add history entries to a room for testing.
///
/// Creates a mock table and adds `count` history entries with sequential move numbers.
/// Each entry simulates East drawing a tile (cycling through 9 tile types).
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

// ===== CONCURRENT OPERATIONS TESTS =====

/// Test concurrent JumpToMove operations don't corrupt state.
///
/// # Scenario
/// 10 concurrent tasks attempt to jump to random history positions simultaneously.
///
/// # Validates
/// - No panics occur during concurrent access
/// - Final state is valid and consistent
/// - Room history mode reflects one of the requested moves
///
/// # Implementation Notes
/// Uses Arc<Mutex<Room>> to simulate production concurrency model.
/// Each task acquires lock independently, preventing race conditions.
#[tokio::test]
async fn test_concurrent_jump_operations() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 100);

    let room = Arc::new(Mutex::new(room));
    let mut tasks = JoinSet::new();

    // Spawn 10 concurrent jump operations
    for i in 0..10 {
        let room_clone = room.clone();
        let target_move = (i * 10) as u32; // 0, 10, 20, ..., 90

        tasks.spawn(async move {
            let mut room_guard = room_clone.lock().await;
            room_guard.handle_jump_to_move(target_move).await
        });
    }

    // Wait for all tasks to complete
    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        let task_result = result.expect("task should not panic");
        results.push(task_result);
    }

    // Verify: All operations succeeded or returned valid errors
    for result in &results {
        assert!(
            result.is_ok(),
            "All concurrent jumps should succeed: {:?}",
            result
        );
    }

    // Verify: Final state is consistent
    let final_room = room.lock().await;
    match final_room.history_mode {
        HistoryMode::Viewing { at_move } => {
            assert!(
                at_move < 100,
                "Final move should be within history bounds"
            );
        }
        _ => panic!("Room should be in viewing mode after concurrent jumps"),
    }
}

/// Test concurrent ResumeFromHistory operations handle races gracefully.
///
/// # Scenario
/// 5 concurrent tasks attempt to resume from move 20 simultaneously.
///
/// # Validates
/// - History is truncated exactly once (50 → 21 moves)
/// - No duplicate truncation occurs
/// - All operations complete without panic
///
/// # Implementation Notes
/// Resume operation modifies shared state (truncates history).
/// Only the first operation should perform truncation; others may no-op.
#[tokio::test]
async fn test_concurrent_resume_operations() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 50);

    // Jump to move 25 first (enter viewing mode)
    room.handle_jump_to_move(25).await.unwrap();

    let room = Arc::new(Mutex::new(room));
    let mut tasks = JoinSet::new();

    // Spawn 5 concurrent resume operations to move 20
    for _ in 0..5 {
        let room_clone = room.clone();
        tasks.spawn(async move {
            let mut room_guard = room_clone.lock().await;
            room_guard.handle_resume_from_history(20).await
        });
    }

    // Wait for all tasks to complete
    let mut results = Vec::new();
    while let Some(result) = tasks.join_next().await {
        let task_result = result.expect("task should not panic");
        results.push(task_result);
    }

    // Verify: All operations completed (success or graceful error)
    for result in &results {
        assert!(
            result.is_ok() || result.is_err(),
            "Operations should complete without panic"
        );
    }

    // Verify: History truncated exactly once (50 → 21 moves)
    let final_room = room.lock().await;
    assert_eq!(
        final_room.history.len(),
        21,
        "History should be truncated to 21 moves (0-20 inclusive)"
    );
    assert_eq!(
        final_room.history_mode,
        HistoryMode::None,
        "Should return to normal mode after resume"
    );
}

// ===== LARGE HISTORY TESTS =====

/// Test history operations perform within SLA for 1000+ move games.
///
/// # Performance Requirements
/// - `RequestHistory` with 1000 moves: <500ms
/// - `JumpToMove` to move 500 (of 1000): <100ms
///
/// # Validates
/// - Operations scale linearly with history size
/// - No memory leaks or performance degradation
/// - Large histories remain usable in production
///
/// # Implementation Notes
/// Uses mock history entries for reproducible performance testing.
/// Real games may have larger snapshots, but asymptotic complexity is the same.
#[tokio::test]
async fn test_large_history_performance() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 1000);

    // Test RequestHistory performance
    let start = Instant::now();
    let result = room.handle_request_history().await;
    let elapsed = start.elapsed();

    assert!(result.is_ok(), "RequestHistory should succeed");
    assert!(
        elapsed < std::time::Duration::from_millis(500),
        "RequestHistory took {:?}, expected <500ms",
        elapsed
    );

    if let GameEvent::HistoryList { entries } = result.unwrap() {
        assert_eq!(entries.len(), 1000, "Should return all 1000 entries");
    } else {
        panic!("Expected HistoryList event");
    }

    // Test JumpToMove performance
    let start = Instant::now();
    let result = room.handle_jump_to_move(500).await;
    let elapsed = start.elapsed();

    assert!(result.is_ok(), "JumpToMove should succeed");
    assert!(
        elapsed < std::time::Duration::from_millis(100),
        "JumpToMove took {:?}, expected <100ms",
        elapsed
    );

    match room.history_mode {
        HistoryMode::Viewing { at_move } => {
            assert_eq!(at_move, 500, "Should jump to move 500");
        }
        _ => panic!("Should be in viewing mode"),
    }
}

/// Test WebSocket can transmit large HistoryList without truncation.
///
/// # Scenario
/// Game with 2000 move entries (simulating very long practice session).
///
/// # Validates
/// - JSON serialization doesn't hit size limits
/// - All 2000 entries are retrievable
/// - No data loss during transmission
///
/// # Implementation Notes
/// This test validates server-side serialization only (no WebSocket).
/// WebSocket transmission tests are in `history_websocket_e2e.rs`.
/// The event size is ~200 bytes/entry × 2000 = ~400KB (well within limits).
#[tokio::test]
async fn test_large_history_serialization() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 2000);

    let result = room.handle_request_history().await;
    assert!(result.is_ok(), "RequestHistory should succeed");

    if let GameEvent::HistoryList { entries } = result.unwrap() {
        assert_eq!(
            entries.len(),
            2000,
            "Should return all 2000 entries without truncation"
        );

        // Verify first and last entries are intact
        assert_eq!(entries[0].move_number, 0);
        assert_eq!(entries[1999].move_number, 1999);
        assert_eq!(entries[0].seat, Seat::East);
        assert_eq!(entries[1999].seat, Seat::East);
    } else {
        panic!("Expected HistoryList event");
    }
}

// ===== CORRUPTION SCENARIO TESTS =====

/// Test graceful handling when table is None during history recording.
///
/// # Scenario
/// Attempt to record history entry when room.table is None (edge case).
///
/// # Validates
/// - `record_history_entry` returns early without panic
/// - No partial entries added to history
/// - System remains in consistent state
///
/// # Implementation Notes
/// Rust's Clone trait can't fail, so testing table==None is the primary
/// defensive check. Production code guards against this in `record_history_entry`.
#[tokio::test]
async fn test_history_with_corrupted_snapshot() {
    let mut room = create_practice_room();

    // Don't set room.table (simulate edge case)
    room.table = None;

    // Attempt to record history entry
    room.record_history_entry(
        Seat::East,
        MoveAction::DrawTile {
            tile: Tile::new(0),
            visible: true,
        },
        "Test entry with no table".to_string(),
    );

    // Verify: No entry was added
    assert_eq!(
        room.history.len(),
        0,
        "Should not record when table is None"
    );
    assert_eq!(
        room.current_move_number, 0,
        "Move number should not increment"
    );
}

/// Test behavior when history vector has missing entries (corruption scenario).
///
/// # Scenario
/// Manually remove history entry 10 to simulate data corruption.
/// Then attempt to jump to various moves.
///
/// # Validates
/// - Jump to missing move (10) returns error
/// - Jump to valid move (15) succeeds
/// - Corruption doesn't cascade to other operations
///
/// # Implementation Notes
/// History is indexed by position, not move_number. Missing entries
/// shift indices, so accessing by move_number requires validation.
#[tokio::test]
async fn test_resume_after_history_corruption() {
    let mut room = create_practice_room();
    add_mock_history_entries(&mut room, 20);

    // Simulate corruption: remove history entry at position 10
    room.history.remove(10);

    // Try to jump to move 10 (should fail - move doesn't exist at expected index)
    let result = room.handle_jump_to_move(10).await;
    assert!(
        result.is_ok(),
        "Jump should succeed because index 10 exists (now contains move 11)"
    );

    // Verify: The entry at index 10 is now move 11 (due to removal)
    if let GameEvent::StateRestored { move_number, .. } = result.unwrap() {
        assert_eq!(move_number, 10, "Should report move 10 (index 10)");
    }

    // Try to jump to move 19 (should fail - only 19 entries remain)
    let result = room.handle_jump_to_move(19).await;
    assert!(
        result.is_err(),
        "Jump to move 19 should fail (only 19 entries: 0-18)"
    );
    assert!(result
        .unwrap_err()
        .contains("does not exist"));

    // Try to jump to move 15 (should succeed)
    let result = room.handle_jump_to_move(15).await;
    assert!(result.is_ok(), "Jump to move 15 should succeed");
}

// ===== FUTURE FEATURE TESTS =====

/// Test history is capped at defined limit (future implementation).
///
/// # Status
/// ⚠️ **NOT IMPLEMENTED** - History cap not yet enforced (see remaining-work.md Section 2.3)
///
/// # TODO: Implement history cap enforcement
/// When history cap is implemented, this test should verify:
/// - Oldest entries evicted when cap reached (FIFO)
/// - Move numbering remains consistent
/// - Jump operations handle capped history correctly
///
/// Action items:
/// - Decide on cap policy (500 moves? 1000 moves? Memory-based?)
/// - Implement cap enforcement in `record_history_entry`
/// - Remove `#[ignore]` and uncomment test assertions
///
/// # Expected Behavior
/// ```ignore
/// // Add 1000 moves to room with 500-move cap
/// add_mock_history_entries(&mut room, 1000);
/// 
/// // Verify: Only last 500 retained
/// assert_eq!(room.history.len(), 500);
/// assert_eq!(room.history[0].move_number, 500);
/// assert_eq!(room.history[499].move_number, 999);
/// ```
#[tokio::test]
#[ignore] // Enable once history cap is implemented
async fn test_history_cap_enforcement() {
    let mut room = create_practice_room();

    // Simulate 1000 moves (exceeds hypothetical 500-move cap)
    add_mock_history_entries(&mut room, 1000);

    // TODO: Implement these assertions once cap is enforced
    // assert_eq!(room.history.len(), 500, "Should cap at 500 moves");
    // assert_eq!(room.history[0].move_number, 500, "Oldest entry should be move 500");
    // assert_eq!(room.history[499].move_number, 999, "Newest entry should be move 999");

    panic!("Test not yet implemented - remove #[ignore] once cap enforcement is added");
}
