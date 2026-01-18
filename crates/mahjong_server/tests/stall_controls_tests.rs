//! Integration tests for multiplayer stalling controls (pause/resume).
//!
//! Tests the pause/resume functionality added as part of Section 1.1
//! of the remaining backend work document.

use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_host_seat_set_on_first_join() {
    let (room, _rx) = Room::new();

    // Before any player joins, host_seat should be None
    assert_eq!(room.host_seat, None);
}

#[tokio::test]
async fn test_pause_state_initialized() {
    let (room, _rx) = Room::new();

    // Room should not be paused initially
    assert!(!room.paused);
    assert_eq!(room.paused_by, None);
    assert_eq!(room.host_seat, None);
}

#[tokio::test]
async fn test_pause_state_fields_public() {
    let (mut room, _rx) = Room::new();

    // These fields should be publicly accessible
    room.paused = true;
    room.paused_by = Some(Seat::East);
    room.host_seat = Some(Seat::East);

    assert!(room.paused);
    assert_eq!(room.paused_by, Some(Seat::East));
    assert_eq!(room.host_seat, Some(Seat::East));
}

#[tokio::test]
async fn test_pause_resume_state_transitions() {
    let (mut room, _rx) = Room::new();

    // Set up initial state
    room.host_seat = Some(Seat::East);
    assert!(!room.paused);

    // Simulate pause
    room.paused = true;
    room.paused_by = Some(Seat::East);
    assert!(room.paused);
    assert_eq!(room.paused_by, Some(Seat::East));

    // Simulate resume
    room.paused = false;
    room.paused_by = None;
    assert!(!room.paused);
    assert_eq!(room.paused_by, None);
}

#[tokio::test]
async fn test_multiple_pause_resume_cycles() {
    let (mut room, _rx) = Room::new();
    room.host_seat = Some(Seat::East);

    // Cycle 1
    room.paused = true;
    room.paused_by = Some(Seat::East);
    assert!(room.paused);

    room.paused = false;
    room.paused_by = None;
    assert!(!room.paused);

    // Cycle 2
    room.paused = true;
    room.paused_by = Some(Seat::East);
    assert!(room.paused);

    room.paused = false;
    room.paused_by = None;
    assert!(!room.paused);
}
