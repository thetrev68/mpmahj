//! Integration tests for game forfeit functionality.
//!
//! Tests the forfeit flow added as part of Section 1.2
//! of the remaining backend work document.

use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    flow::{AbandonReason, GameEndCondition},
    player::Seat,
};

#[test]
fn test_forfeit_command_player_extraction() {
    let command = GameCommand::ForfeitGame {
        player: Seat::East,
        reason: Some("I quit".to_string()),
    };

    assert_eq!(command.player(), Seat::East);
}

#[test]
fn test_forfeit_command_optional_reason() {
    // Test with reason
    let with_reason = GameCommand::ForfeitGame {
        player: Seat::East,
        reason: Some("Emergency".to_string()),
    };
    assert_eq!(with_reason.player(), Seat::East);

    // Test without reason
    let without_reason = GameCommand::ForfeitGame {
        player: Seat::North,
        reason: None,
    };
    assert_eq!(without_reason.player(), Seat::North);
}

#[test]
fn test_player_forfeited_event_associated_player() {
    let event = GameEvent::PlayerForfeited {
        player: Seat::South,
        reason: Some("Connection lost".to_string()),
    };

    // Verify event has associated player
    assert_eq!(event.associated_player(), Some(Seat::South));
    assert!(!event.is_private());
}

#[test]
fn test_forfeit_game_result_structure() {
    use std::collections::HashMap;

    // Create a sample GameResult for forfeit
    let result = mahjong_core::flow::GameResult {
        winner: None,
        winning_pattern: None,
        score_breakdown: None,
        final_scores: HashMap::from([
            (Seat::East, -100), // Forfeiting player
            (Seat::South, 0),
            (Seat::West, 0),
            (Seat::North, 0),
        ]),
        final_hands: HashMap::new(),
        next_dealer: Seat::East,
        end_condition: GameEndCondition::Abandoned(AbandonReason::Forfeit),
    };

    // Verify structure
    assert_eq!(result.winner, None);
    assert_eq!(result.winning_pattern, None);
    assert!(matches!(
        result.end_condition,
        GameEndCondition::Abandoned(AbandonReason::Forfeit)
    ));
}

#[test]
fn test_player_forfeited_event_serialization() {
    let event = GameEvent::PlayerForfeited {
        player: Seat::West,
        reason: Some("Test reason".to_string()),
    };

    // Verify event serializes correctly
    let json = serde_json::to_string(&event).unwrap();
    let deserialized: GameEvent = serde_json::from_str(&json).unwrap();

    match deserialized {
        GameEvent::PlayerForfeited { player, reason } => {
            assert_eq!(player, Seat::West);
            assert_eq!(reason, Some("Test reason".to_string()));
        }
        _ => panic!("Wrong event type after deserialization"),
    }
}

#[test]
fn test_forfeit_command_serialization() {
    let command = GameCommand::ForfeitGame {
        player: Seat::North,
        reason: Some("Leaving early".to_string()),
    };

    // Verify command serializes correctly
    let json = serde_json::to_string(&command).unwrap();
    let deserialized: GameCommand = serde_json::from_str(&json).unwrap();

    match deserialized {
        GameCommand::ForfeitGame { player, reason } => {
            assert_eq!(player, Seat::North);
            assert_eq!(reason, Some("Leaving early".to_string()));
        }
        _ => panic!("Wrong command type after deserialization"),
    }
}
