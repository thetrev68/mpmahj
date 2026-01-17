//! Tests for event visibility and routing.
//!
//! These tests ensure that private events are correctly routed to the
//! intended recipients and not broadcast to all players.

use mahjong_core::{
    command::GameCommand,
    event::{GameEvent, ReplacementReason},
    player::Seat,
    table::TimerMode,
    tile::Tile,
};
use mahjong_server::{
    event_delivery::EventVisibility, network::visibility::compute_event_delivery,
};

#[test]
fn test_tiles_passed_has_delivery_target() {
    let event = GameEvent::TilesPassed {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1), Tile(2)],
    };

    let command = GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1), Tile(2)],
        blind_pass_count: None,
    };

    let mut dealt_targets = Seat::all().into_iter();
    let delivery = compute_event_delivery(&event, &command, Seat::East, &mut dealt_targets);

    assert!(
        delivery.is_some(),
        "TilesPassed event should have a delivery target"
    );
    let delivery = delivery.unwrap();
    assert_eq!(
        delivery.visibility,
        EventVisibility::Private,
        "TilesPassed should be private"
    );
    assert_eq!(
        delivery.target_player,
        Some(Seat::East),
        "TilesPassed should target the player who passed the tiles"
    );
}

#[test]
fn test_replacement_drawn_has_delivery_target() {
    let event = GameEvent::ReplacementDrawn {
        player: Seat::South,
        tile: Tile(5),
        reason: ReplacementReason::Kong,
    };

    // Use a simple command that doesn't require complex setup
    let command = GameCommand::RequestState {
        player: Seat::South,
    };

    let mut dealt_targets = Seat::all().into_iter();
    let delivery = compute_event_delivery(&event, &command, Seat::South, &mut dealt_targets);

    assert!(
        delivery.is_some(),
        "ReplacementDrawn event should have a delivery target"
    );
    let delivery = delivery.unwrap();
    assert_eq!(
        delivery.visibility,
        EventVisibility::Private,
        "ReplacementDrawn should be private"
    );
    assert_eq!(
        delivery.target_player,
        Some(Seat::South),
        "ReplacementDrawn should target the player who drew the replacement"
    );
}

#[test]
fn test_tiles_received_has_delivery_target() {
    let event = GameEvent::TilesReceived {
        player: Seat::West,
        tiles: vec![Tile(10), Tile(11), Tile(12)],
        from: Some(Seat::North),
    };

    let command = GameCommand::PassTiles {
        player: Seat::North,
        tiles: vec![Tile(10), Tile(11), Tile(12)],
        blind_pass_count: None,
    };

    let mut dealt_targets = Seat::all().into_iter();
    let delivery = compute_event_delivery(&event, &command, Seat::West, &mut dealt_targets);

    assert!(
        delivery.is_some(),
        "TilesReceived event should have a delivery target"
    );
    let delivery = delivery.unwrap();
    assert_eq!(
        delivery.visibility,
        EventVisibility::Private,
        "TilesReceived should be private"
    );
    assert_eq!(
        delivery.target_player,
        Some(Seat::West),
        "TilesReceived should target the player who received the tiles"
    );
}

#[test]
fn test_tile_drawn_has_delivery_target() {
    let event = GameEvent::TileDrawn {
        tile: Some(Tile(15)),
        remaining_tiles: 60,
    };

    let command = GameCommand::DrawTile {
        player: Seat::North,
    };

    let mut dealt_targets = Seat::all().into_iter();
    let delivery = compute_event_delivery(&event, &command, Seat::North, &mut dealt_targets);

    assert!(
        delivery.is_some(),
        "TileDrawn (with tile value) event should have a delivery target"
    );
    let delivery = delivery.unwrap();
    assert_eq!(
        delivery.visibility,
        EventVisibility::Private,
        "TileDrawn should be private"
    );
    assert_eq!(
        delivery.target_player,
        Some(Seat::North),
        "TileDrawn should target the player from the command"
    );
}

#[test]
fn test_public_events_are_broadcast() {
    let public_events = vec![
        GameEvent::GameStarting,
        GameEvent::TileDiscarded {
            player: Seat::East,
            tile: Tile(0),
        },
        GameEvent::CallWindowOpened {
            tile: Tile(0),
            discarded_by: Seat::East,
            can_call: vec![Seat::South, Seat::West, Seat::North],
            timer: 15,
            started_at_ms: 0,
            timer_mode: TimerMode::Hidden,
        },
    ];

    let command = GameCommand::RequestState { player: Seat::East };

    for event in public_events {
        let mut dealt_targets = Seat::all().into_iter();
        let delivery = compute_event_delivery(&event, &command, Seat::East, &mut dealt_targets);

        assert!(
            delivery.is_some(),
            "Public event {:?} should have delivery",
            event
        );
        assert_eq!(
            delivery.unwrap().visibility,
            EventVisibility::Public,
            "Public event {:?} should be broadcast",
            event
        );
    }
}

#[test]
fn test_all_private_events_have_delivery() {
    // This test ensures we don't forget to handle new private events
    let private_events = vec![
        (
            "TilesDealt",
            GameEvent::TilesDealt {
                your_tiles: vec![Tile(0); 13],
            },
        ),
        (
            "TilesReceived",
            GameEvent::TilesReceived {
                player: Seat::East,
                tiles: vec![Tile(0), Tile(1), Tile(2)],
                from: Some(Seat::South),
            },
        ),
        (
            "TilesPassed",
            GameEvent::TilesPassed {
                player: Seat::East,
                tiles: vec![Tile(0), Tile(1), Tile(2)],
            },
        ),
        (
            "TileDrawn",
            GameEvent::TileDrawn {
                tile: Some(Tile(5)),
                remaining_tiles: 50,
            },
        ),
        (
            "ReplacementDrawn",
            GameEvent::ReplacementDrawn {
                player: Seat::East,
                tile: Tile(5),
                reason: ReplacementReason::Kong,
            },
        ),
    ];

    let command = GameCommand::DrawTile { player: Seat::East };

    for (name, event) in private_events {
        assert!(event.is_private(), "{} should be marked as private", name);

        let mut dealt_targets = Seat::all().into_iter();
        let delivery = compute_event_delivery(&event, &command, Seat::East, &mut dealt_targets);

        assert!(
            delivery.is_some(),
            "Private event {} must have a delivery target computed, or it will fail to be sent",
            name
        );
    }
}
