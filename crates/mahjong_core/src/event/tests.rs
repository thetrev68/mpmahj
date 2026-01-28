//! Unit tests for the refactored event module.
//!
//! Coverage includes privacy classification, actor extraction, and
//! serialization behavior for the new event enums.

use super::{
    analysis_events::AnalysisEvent, helpers::Event, private_events::PrivateEvent,
    public_events::PublicEvent, types,
};
use crate::{
    flow::charleston::PassDirection,
    hint::HintData,
    meld::{Meld, MeldType},
    player::Seat,
    tile::{tiles::*, Tile},
};

#[test]
fn test_private_event_detection() {
    let tiles_dealt = Event::Private(PrivateEvent::TilesDealt { your_tiles: vec![] });
    assert!(tiles_dealt.is_private());

    let tiles_received = Event::Private(PrivateEvent::TilesReceived {
        player: Seat::South,
        tiles: vec![BAM_1],
        from: None,
    });
    assert!(tiles_received.is_private());

    let tile_drawn_private = Event::Private(PrivateEvent::TileDrawnPrivate {
        tile: BAM_1,
        remaining_tiles: 50,
    });
    assert!(tile_drawn_private.is_private());

    let analysis_update = Event::Analysis(AnalysisEvent::HintUpdate {
        hint: Box::new(HintData::empty()),
    });
    assert!(analysis_update.is_private());

    let tile_drawn_public = Event::Public(PublicEvent::TileDrawnPublic { remaining_tiles: 50 });
    assert!(!tile_drawn_public.is_private());

    let game_created = Event::Public(PublicEvent::GameCreated {
        game_id: "test".to_string(),
    });
    assert!(!game_created.is_private());
}

#[test]
fn test_error_detection() {
    let error_event = Event::Public(PublicEvent::CommandRejected {
        player: Seat::East,
        reason: "Invalid move".to_string(),
    });
    assert!(error_event.is_error());

    let normal_event = Event::Public(PublicEvent::GameStarting);
    assert!(!normal_event.is_error());
}

#[test]
fn test_associated_player_extraction() {
    let player_joined = Event::Public(PublicEvent::PlayerJoined {
        player: Seat::South,
        player_id: "player2".to_string(),
        is_bot: false,
    });
    assert_eq!(player_joined.associated_player(), Some(Seat::South));

    let tile_discarded = Event::Public(PublicEvent::TileDiscarded {
        player: Seat::West,
        tile: DOT_5,
    });
    assert_eq!(tile_discarded.associated_player(), Some(Seat::West));

    let tiles_passed = Event::Private(PrivateEvent::TilesPassed {
        player: Seat::North,
        tiles: vec![CRAK_7],
    });
    assert_eq!(tiles_passed.associated_player(), Some(Seat::North));

    let game_starting = Event::Public(PublicEvent::GameStarting);
    assert_eq!(game_starting.associated_player(), None);

    let game_over = Event::Public(PublicEvent::GameOver {
        winner: Some(Seat::North),
        result: crate::flow::outcomes::GameResult {
            winner: Some(Seat::North),
            winning_pattern: Some("Test Pattern".to_string()),
            score_breakdown: None,
            final_scores: std::collections::HashMap::new(),
            final_hands: std::collections::HashMap::new(),
            next_dealer: Seat::East,
            end_condition: crate::flow::outcomes::GameEndCondition::Win,
        },
    });
    assert_eq!(game_over.associated_player(), Some(Seat::North));
}

#[test]
fn test_serialization_round_trip() {
    let bam3: Tile = BAM_3;
    let event = Event::Public(PublicEvent::TileCalled {
        player: Seat::East,
        meld: Meld {
            meld_type: MeldType::Pung,
            tiles: vec![bam3; 3],
            called_tile: Some(bam3),
            joker_assignments: std::collections::HashMap::new(),
        },
        called_tile: bam3,
    });

    let json = serde_json::to_string(&event).unwrap();
    let deserialized: Event = serde_json::from_str(&json).unwrap();

    match deserialized {
        Event::Public(PublicEvent::TileCalled { player, called_tile, .. }) => {
            assert_eq!(player, Seat::East);
            assert_eq!(called_tile, bam3);
        }
        other => panic!("Wrong event type after deserialization: {other:?}"),
    }
}

#[test]
fn test_charleston_event_visibility() {
    let tiles_passing = Event::Public(PublicEvent::TilesPassing {
        direction: PassDirection::Right,
    });
    assert!(!tiles_passing.is_private());
    assert!(!tiles_passing.is_for_seat(Seat::East));

    let courtesy_proposed = Event::Private(PrivateEvent::CourtesyPassProposed {
        player: Seat::East,
        tile_count: 2,
    });
    assert!(courtesy_proposed.is_for_seat(Seat::East));
    assert!(courtesy_proposed.is_for_seat(Seat::West));
    assert!(!courtesy_proposed.is_for_seat(Seat::South));
    assert_eq!(courtesy_proposed.target_player(), None);

    let courtesy_pair_event = Event::Private(PrivateEvent::CourtesyPassMismatch {
        pair: (Seat::North, Seat::South),
        proposed: (1, 3),
        agreed_count: 1,
    });
    assert!(courtesy_pair_event.is_for_seat(Seat::North));
    assert!(courtesy_pair_event.is_for_seat(Seat::South));
    assert!(!courtesy_pair_event.is_for_seat(Seat::East));
    assert!(courtesy_pair_event.is_private());
}

#[test]
fn test_analysis_event_privacy() {
    let update = Event::Analysis(AnalysisEvent::AnalysisUpdate {
        patterns: vec![types::PatternAnalysis {
            pattern_name: "Seven Pairs".to_string(),
            distance: 2,
            viable: true,
            difficulty: types::PatternDifficulty::Medium,
            probability: 0.25,
            score: 30,
        }],
    });
    assert!(update.is_private());
    assert_eq!(update.target_player(), None);
    assert!(!update.is_for_seat(Seat::East));

    let hand_update = Event::Analysis(AnalysisEvent::HandAnalysisUpdated {
        distance_to_win: 1,
        viable_count: 5,
        impossible_count: 2,
    });
    assert!(hand_update.is_private());
    assert_eq!(hand_update.target_player(), None);

    let hint = Event::Analysis(AnalysisEvent::HintUpdate {
        hint: Box::new(HintData::empty()),
    });
    assert!(hint.is_private());
    assert_eq!(hint.target_player(), None);
}

#[test]
fn test_tile_draw_split() {
    let public_draw = Event::Public(PublicEvent::TileDrawnPublic {
        remaining_tiles: 50,
    });
    assert!(!public_draw.is_private());
    assert_eq!(public_draw.target_player(), None);
    assert_eq!(public_draw.associated_player(), None);

    let private_draw = Event::Private(PrivateEvent::TileDrawnPrivate {
        tile: BAM_1,
        remaining_tiles: 49,
    });
    assert!(private_draw.is_private());
    assert_eq!(private_draw.target_player(), None);
    assert_eq!(private_draw.associated_player(), None);
    assert!(!private_draw.is_for_seat(Seat::East));

    let replacement = Event::Private(PrivateEvent::ReplacementDrawn {
        player: Seat::South,
        tile: JOKER,
        reason: types::ReplacementReason::Kong,
    });
    assert!(replacement.is_private());
    assert_eq!(replacement.target_player(), Some(Seat::South));
    assert!(replacement.is_for_seat(Seat::South));
    assert_eq!(replacement.associated_player(), Some(Seat::South));
}

#[test]
fn test_lifecycle_event_associated_player() {
    let paused = Event::Public(PublicEvent::GamePaused {
        by: Seat::East,
        reason: Some("bio break".to_string()),
    });
    assert_eq!(paused.associated_player(), Some(Seat::East));

    let resumed = Event::Public(PublicEvent::GameResumed { by: Seat::West });
    assert_eq!(resumed.associated_player(), Some(Seat::West));

    let forfeited = Event::Public(PublicEvent::PlayerForfeited {
        player: Seat::South,
        reason: None,
    });
    assert_eq!(forfeited.associated_player(), Some(Seat::South));

    let admin_forfeit = Event::Public(PublicEvent::AdminForfeitOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Moderator".to_string(),
        forfeited_player: Seat::North,
        reason: "disconnected".to_string(),
    });
    assert_eq!(admin_forfeit.associated_player(), Some(Seat::North));

    let admin_pause = Event::Public(PublicEvent::AdminPauseOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Moderator".to_string(),
        reason: "maintenance".to_string(),
    });
    assert_eq!(admin_pause.associated_player(), None);

    let admin_resume = Event::Public(PublicEvent::AdminResumeOverride {
        admin_id: "admin".to_string(),
        admin_display_name: "Moderator".to_string(),
    });
    assert_eq!(admin_resume.associated_player(), None);
}
