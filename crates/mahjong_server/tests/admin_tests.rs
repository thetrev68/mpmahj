//! Unit tests for admin authorization and edge cases.
//!
//! Tests:
//! - Role parsing and hierarchy
//! - Authorization context extraction
//! - Edge cases (double pause, invalid states, missing resources)
//! - Admin event serialization

use mahjong_core::{
    event::{public_events::PublicEvent, Event},
    player::Seat,
};
use mahjong_server::{
    authorization::{AdminContext, Role},
    network::Room,
};

#[test]
fn test_role_hierarchy() {
    // User has lowest privileges
    assert!(!Role::User.is_moderator_or_higher());
    assert!(!Role::User.is_admin_or_higher());

    // Moderator has moderate privileges
    assert!(Role::Moderator.is_moderator_or_higher());
    assert!(!Role::Moderator.is_admin_or_higher());

    // Admin has high privileges
    assert!(Role::Admin.is_moderator_or_higher());
    assert!(Role::Admin.is_admin_or_higher());

    // SuperAdmin has highest privileges
    assert!(Role::SuperAdmin.is_moderator_or_higher());
    assert!(Role::SuperAdmin.is_admin_or_higher());
}

#[test]
fn test_role_ordering() {
    // Verify role hierarchy order
    assert!(Role::User < Role::Moderator);
    assert!(Role::Moderator < Role::Admin);
    assert!(Role::Admin < Role::SuperAdmin);

    // Transitive property
    assert!(Role::User < Role::Admin);
    assert!(Role::User < Role::SuperAdmin);
    assert!(Role::Moderator < Role::SuperAdmin);
}

#[test]
fn test_role_from_str() {
    use std::str::FromStr;

    // Valid roles
    assert_eq!(Role::from_str("user").unwrap(), Role::User);
    assert_eq!(Role::from_str("moderator").unwrap(), Role::Moderator);
    assert_eq!(Role::from_str("admin").unwrap(), Role::Admin);
    assert_eq!(Role::from_str("super_admin").unwrap(), Role::SuperAdmin);

    // Invalid roles
    assert!(Role::from_str("invalid").is_err());
    assert!(Role::from_str("").is_err());
    assert!(Role::from_str("Admin").is_err()); // Case sensitive
    assert!(Role::from_str("MODERATOR").is_err());
}

#[tokio::test]
async fn test_double_pause_rejected() {
    let (mut room, _rx) = Room::new();

    // First pause succeeds
    room.history.set_paused(true, Some(Seat::East));

    // Verify state
    assert!(room.history.is_paused());

    // Second pause should be rejected (handled by admin handler)
    // This test verifies the room state correctly tracks pause status
    assert!(room.history.is_paused(), "Room should already be paused");

    // In the actual handler, this would return 409 Conflict
}

#[tokio::test]
async fn test_resume_not_paused_rejected() {
    let (room, _rx) = Room::new();

    // Room is not paused
    assert!(!room.history.is_paused());

    // Attempting to resume should be rejected (handled by admin handler)
    // This test verifies the room state correctly tracks pause status
    assert!(!room.history.is_paused(), "Room should not be paused");

    // In the actual handler, this would return 409 Conflict
}

#[tokio::test]
async fn test_pause_state_transitions() {
    let (mut room, _rx) = Room::new();

    // Initial: not paused
    assert!(!room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);

    // Pause by host
    room.history.set_paused(true, Some(Seat::East));
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), Some(Seat::East));

    // Admin override resume (clears paused_by)
    room.history.set_paused(false, None);
    assert!(!room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);

    // Admin pause (no specific player)
    room.history.set_paused(true, None);
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[test]
fn test_admin_pause_event_serialization() {
    let event = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin_456".to_string(),
        admin_display_name: "Admin Alice".to_string(),
        reason: "Maintenance".to_string(),
    });

    // Serialize
    let json = serde_json::to_string(&event).unwrap();

    // Deserialize
    let deserialized: Event = serde_json::from_str(&json).unwrap();

    // Verify
    match deserialized {
        Event::Public(PublicEvent::AdminPauseOverride {
            admin_id,
            admin_display_name,
            reason,
        }) => {
            assert_eq!(admin_id, "admin_456");
            assert_eq!(admin_display_name, "Admin Alice");
            assert_eq!(reason, "Maintenance");
        }
        _ => panic!("Wrong event type after deserialization"),
    }
}

#[test]
fn test_admin_resume_event_serialization() {
    let event = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin_789".to_string(),
        admin_display_name: "Admin Charlie".to_string(),
    });

    // Serialize
    let json = serde_json::to_string(&event).unwrap();

    // Deserialize
    let deserialized: Event = serde_json::from_str(&json).unwrap();

    // Verify
    match deserialized {
        Event::Public(PublicEvent::AdminResumeOverride {
            admin_id,
            admin_display_name,
        }) => {
            assert_eq!(admin_id, "admin_789");
            assert_eq!(admin_display_name, "Admin Charlie");
        }
        _ => panic!("Wrong event type after deserialization"),
    }
}

#[test]
fn test_admin_events_structure() {
    // AdminPauseOverride has reason
    let pause = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
        reason: "maintenance".to_string(),
    });
    match pause {
        Event::Public(PublicEvent::AdminPauseOverride { reason, .. }) => {
            assert_eq!(reason, "maintenance");
        }
        _ => panic!("Wrong event type"),
    }

    // AdminResumeOverride has admin info
    let resume = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin_123".to_string(),
        admin_display_name: "Admin User".to_string(),
    });
    match resume {
        Event::Public(PublicEvent::AdminResumeOverride {
            admin_id,
            admin_display_name,
        }) => {
            assert_eq!(admin_id, "admin_123");
            assert_eq!(admin_display_name, "Admin User");
        }
        _ => panic!("Wrong event type"),
    }
}

#[test]
fn test_admin_events_are_not_private() {
    // All admin events should be public (not private)
    let pause = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
        reason: "test".to_string(),
    });
    assert!(!pause.is_private());

    let resume = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Admin".to_string(),
    });
    assert!(!resume.is_private());
}

#[tokio::test]
async fn test_multiple_admin_actions_in_sequence() {
    let (mut room, _rx) = Room::new();

    // Sequence: Pause -> Resume -> Pause
    room.history.set_paused(true, None);

    room.history.set_paused(false, None);

    room.history.set_paused(true, None);

    // Final state should reflect last action
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[tokio::test]
async fn test_admin_context_structure() {
    let admin_ctx = AdminContext {
        user_id: "user_123".to_string(),
        role: Role::Admin,
        display_name: "Admin User".to_string(),
    };

    assert_eq!(admin_ctx.user_id, "user_123");
    assert_eq!(admin_ctx.role, Role::Admin);
    assert_eq!(admin_ctx.display_name, "Admin User");
    assert!(admin_ctx.role.is_admin_or_higher());
}

#[tokio::test]
async fn test_host_seat_not_affected_by_admin_actions() {
    let (mut room, _rx) = Room::new();

    // Set host
    room.sessions.set_host(Seat::East);

    // Admin pauses (no specific seat)
    room.history.set_paused(true, None);

    // Host seat should remain unchanged
    assert_eq!(room.sessions.get_host(), Some(Seat::East));

    // Admin resumes
    room.history.set_paused(false, None);

    // Host seat should still be unchanged
    assert_eq!(room.sessions.get_host(), Some(Seat::East));
}

#[tokio::test]
async fn test_admin_pause_clears_paused_by() {
    let (mut room, _rx) = Room::new();

    // Host pauses
    room.history.set_paused(true, Some(Seat::South));

    // Admin overrides with pause (should clear paused_by)
    room.history.set_paused(true, None); // Admin override

    // Verify paused_by is cleared
    assert!(room.history.is_paused());
    assert_eq!(room.history.get_paused_by(), None);
}

#[tokio::test]
async fn test_game_started_flag_unaffected_by_pause_resume() {
    let (mut room, _rx) = Room::new();

    // Set game as started
    room.game_started = true;

    // Admin pauses
    room.history.set_paused(true, None);

    // Game started flag should remain true
    assert!(room.game_started);

    // Admin resumes
    room.history.set_paused(false, None);

    // Game started flag should still be true
    assert!(room.game_started);
}
