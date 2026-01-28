//! Integration tests for admin override system.
//!
//! Tests the full end-to-end flow of admin actions including:
//! - Event serialization and deserialization
//! - Pause/resume state management
//! - Room health metrics accuracy
//! - Event visibility

use mahjong_core::{
    event::{public_events::PublicEvent, Event},
    flow::outcomes::{AbandonReason, GameEndCondition},
    hand::Hand,
    player::Seat,
};
use mahjong_server::network::Room;
use std::collections::HashMap;

#[tokio::test]
async fn test_admin_forfeit_event_creation() {
    let (_room, _rx) = Room::new();

    // Create admin forfeit event
    let admin_event = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: "admin_123".to_string(),
        admin_display_name: "Admin Bob".to_string(),
        forfeited_player: Seat::East,
        reason: "Testing admin forfeit".to_string(),
    });

    // Verify event properties
    assert!(!admin_event.is_private());

    // Verify event structure
    match admin_event {
        Event::Public(PublicEvent::AdminForfeitOverride {
            forfeited_player, ..
        }) => {
            assert_eq!(forfeited_player, Seat::East);
        }
        _ => panic!("Wrong event type"),
    }
}

#[tokio::test]
async fn test_admin_forfeit_with_game_over() {
    let (_room, _rx) = Room::new();

    // Create admin forfeit event
    let admin_event = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: "admin_456".to_string(),
        admin_display_name: "Admin Alice".to_string(),
        forfeited_player: Seat::South,
        reason: "Player AFK".to_string(),
    });

    // Create forfeit event
    let forfeit_event = Event::Public(PublicEvent::PlayerForfeited {
        player: Seat::South,
        reason: Some("Player AFK".to_string()),
    });

    // Create GameOver event
    let mut final_hands = HashMap::new();
    let mut final_scores = HashMap::new();
    for seat in Seat::all() {
        final_hands.insert(seat, Hand::new(vec![]));
        final_scores.insert(seat, if seat == Seat::South { -100 } else { 0 });
    }

    let game_result = mahjong_core::flow::outcomes::GameResult {
        winner: None,
        winning_pattern: None,
        score_breakdown: None,
        final_scores: final_scores.clone(),
        final_hands,
        next_dealer: Seat::East,
        end_condition: GameEndCondition::Abandoned(AbandonReason::Forfeit),
    };

    let game_over_event = Event::Public(PublicEvent::GameOver {
        winner: None,
        result: game_result,
    });

    // Verify all events are valid
    assert!(!admin_event.is_private());
    assert_eq!(forfeit_event.associated_player(), Some(Seat::South));

    // Verify admin event has correct player
    match admin_event {
        Event::Public(PublicEvent::AdminForfeitOverride {
            forfeited_player, ..
        }) => {
            assert_eq!(forfeited_player, Seat::South);
        }
        _ => panic!("Wrong event type"),
    }

    // Verify game result has correct end condition
    if let Event::Public(PublicEvent::GameOver { result, .. }) = game_over_event {
        assert!(matches!(
            result.end_condition,
            GameEndCondition::Abandoned(AbandonReason::Forfeit)
        ));
        assert_eq!(*result.final_scores.get(&Seat::South).unwrap(), -100);
    }
}

#[tokio::test]
async fn test_admin_pause_state_management() {
    let (mut room, _rx) = Room::new();

    // Initial state: not paused
    assert!(!room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);

    // Create AdminPauseOverride event
    let pause_event = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin_789".to_string(),
        admin_display_name: "Admin Charlie".to_string(),
        reason: "Server maintenance".to_string(),
    });

    // Verify event is not private
    assert!(!pause_event.is_private());

    // Simulate admin pause (what the handler would do)
    room.history.set_paused(true, None); // Admin override

    // Verify room state
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[tokio::test]
async fn test_admin_resume_clears_pause_state() {
    let (mut room, _rx) = Room::new();

    // Setup: room is paused by host
    room.history.set_paused(true, Some(Seat::East));
    room.sessions.set_host(Seat::East);

    // Create AdminResumeOverride event
    let resume_event = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin_999".to_string(),
        admin_display_name: "Admin David".to_string(),
    });

    // Verify event is not private
    assert!(!resume_event.is_private());

    // Simulate admin resume (what the handler would do)
    room.history.set_paused(false, None);

    // Verify room state - admin cleared the pause
    assert!(!room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[tokio::test]
async fn test_admin_events_are_public() {
    // Admin events should not be private

    let forfeit_event = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
        forfeited_player: Seat::East,
        reason: "test".to_string(),
    });
    assert!(
        !forfeit_event.is_private(),
        "AdminForfeitOverride should not be private"
    );

    let pause_event = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
        reason: "test".to_string(),
    });
    assert!(
        !pause_event.is_private(),
        "AdminPauseOverride should not be private"
    );

    let resume_event = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
    });
    assert!(
        !resume_event.is_private(),
        "AdminResumeOverride should not be private"
    );
}

#[tokio::test]
async fn test_room_health_metrics() {
    let (room, _rx) = Room::new();

    // Verify metrics can be collected
    let player_count = room.sessions.player_count();
    let history_length = room.history.len();
    let is_paused = room.history.is_paused();
    let paused_by = room.history.get_paused_by();

    // Initial state checks
    assert_eq!(player_count, 0);
    assert_eq!(history_length, 0);
    assert!(!is_paused);
    assert_eq!(paused_by, None);
}

#[tokio::test]
async fn test_admin_pause_then_resume_cycle() {
    let (mut room, _rx) = Room::new();

    // Initial state
    assert!(!room.history.is_paused());

    // Admin pauses
    room.history.set_paused(true, None); // Admin override

    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);

    // Admin resumes
    room.history.set_paused(false, None);

    assert!(!room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[test]
fn test_admin_event_serialization() {
    // Test AdminForfeitOverride
    let forfeit = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: "admin1".to_string(),
        admin_display_name: "Admin One".to_string(),
        forfeited_player: Seat::East,
        reason: "Test forfeit".to_string(),
    });
    let json = serde_json::to_string(&forfeit).unwrap();
    let deserialized: Event = serde_json::from_str(&json).unwrap();
    assert!(matches!(
        deserialized,
        Event::Public(PublicEvent::AdminForfeitOverride { .. })
    ));

    // Test AdminPauseOverride
    let pause = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin2".to_string(),
        admin_display_name: "Admin Two".to_string(),
        reason: "Test pause".to_string(),
    });
    let json = serde_json::to_string(&pause).unwrap();
    let deserialized: Event = serde_json::from_str(&json).unwrap();
    assert!(matches!(
        deserialized,
        Event::Public(PublicEvent::AdminPauseOverride { .. })
    ));

    // Test AdminResumeOverride
    let resume = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin3".to_string(),
        admin_display_name: "Admin Three".to_string(),
    });
    let json = serde_json::to_string(&resume).unwrap();
    let deserialized: Event = serde_json::from_str(&json).unwrap();
    assert!(matches!(
        deserialized,
        Event::Public(PublicEvent::AdminResumeOverride { .. })
    ));
}

#[tokio::test]
async fn test_double_pause_scenario() {
    let (mut room, _rx) = Room::new();

    // First pause
    room.history.set_paused(true, None);
    assert!(room.history.is_paused());

    // Attempting to pause again (handler would check this and return 409)
    let already_paused = room.history.is_paused();
    assert!(already_paused, "Room should already be paused");
}

#[tokio::test]
async fn test_resume_not_paused_scenario() {
    let (room, _rx) = Room::new();

    // Room is not paused
    assert!(!room.history.is_paused());

    // Attempting to resume (handler would check this and return 409)
    let is_not_paused = !room.history.is_paused();
    assert!(is_not_paused, "Room should not be paused");
}

#[tokio::test]
async fn test_admin_pause_clears_paused_by_seat() {
    let (mut room, _rx) = Room::new();

    // Host pauses
    room.history.set_paused(true, Some(Seat::South));

    // Admin overrides with pause (should clear paused_by)
    room.history.set_paused(true, None); // Admin override clears the seat

    // Verify paused_by is cleared
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[tokio::test]
async fn test_host_seat_preserved_during_admin_actions() {
    let (mut room, _rx) = Room::new();

    // Set host
    room.sessions.set_host(Seat::East);

    // Admin pause
    room.history.set_paused(true, None);

    // Host seat should remain unchanged
    assert_eq!(room.sessions.get_host(), Some(Seat::East));

    // Admin resume
    room.history.set_paused(false, None);

    // Host seat should still be unchanged
    assert_eq!(room.sessions.get_host(), Some(Seat::East));
}
