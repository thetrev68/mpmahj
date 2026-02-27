//! Tests for event visibility and routing.
//!
//! These tests ensure that private events are correctly routed to the
//! intended recipients and not broadcast to all players.

use mahjong_core::{
    command::GameCommand,
    event::{
        private_events::{IncomingContext, PrivateEvent},
        public_events::PublicEvent,
        types::ReplacementReason,
        Event,
    },
    player::Seat,
    table::TimerMode,
    tile::Tile,
};
use mahjong_server::{
    event_delivery::EventVisibility, network::visibility::compute_event_delivery,
};

#[test]
fn test_tiles_passed_has_delivery_target() {
    let event = Event::Private(PrivateEvent::TilesPassed {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1), Tile(2)],
    });

    let command = GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0), Tile(1), Tile(2)],
        forward_incoming_count: 0,
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
    let event = Event::Private(PrivateEvent::ReplacementDrawn {
        player: Seat::South,
        tile: Tile(5),
        reason: ReplacementReason::Kong,
    });

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
    let event = Event::Private(PrivateEvent::TilesReceived {
        player: Seat::West,
        tiles: vec![Tile(10), Tile(11), Tile(12)],
        from: Some(Seat::North),
    });

    let command = GameCommand::CommitCharlestonPass {
        player: Seat::North,
        from_hand: vec![Tile(10), Tile(11), Tile(12)],
        forward_incoming_count: 0,
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
fn test_incoming_tiles_staged_has_delivery_target() {
    let event = Event::Private(PrivateEvent::IncomingTilesStaged {
        player: Seat::West,
        tiles: vec![Tile(10), Tile(11), Tile(12)],
        from: Some(Seat::North),
        context: IncomingContext::Charleston,
    });

    let command = GameCommand::CommitCharlestonPass {
        player: Seat::North,
        from_hand: vec![Tile(10), Tile(11), Tile(12)],
        forward_incoming_count: 0,
    };

    let mut dealt_targets = Seat::all().into_iter();
    let delivery = compute_event_delivery(&event, &command, Seat::West, &mut dealt_targets);

    assert!(
        delivery.is_some(),
        "IncomingTilesStaged event should have a delivery target"
    );
    let delivery = delivery.unwrap();
    assert_eq!(
        delivery.visibility,
        EventVisibility::Private,
        "IncomingTilesStaged should be private"
    );
    assert_eq!(
        delivery.target_player,
        Some(Seat::West),
        "IncomingTilesStaged should target the receiving player"
    );
}

#[test]
fn test_tile_drawn_has_delivery_target() {
    let event = Event::Private(PrivateEvent::TileDrawnPrivate {
        tile: Tile(15),
        remaining_tiles: 60,
    });

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
        Event::Public(PublicEvent::GameStarting),
        Event::Public(PublicEvent::TileDiscarded {
            player: Seat::East,
            tile: Tile(0),
        }),
        Event::Public(PublicEvent::CallWindowOpened {
            tile: Tile(0),
            discarded_by: Seat::East,
            can_call: vec![Seat::South, Seat::West, Seat::North],
            timer: 15,
            started_at_ms: 0,
            timer_mode: TimerMode::Hidden,
        }),
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
            Event::Private(PrivateEvent::TilesDealt {
                your_tiles: vec![Tile(0); 13],
            }),
        ),
        (
            "TilesReceived",
            Event::Private(PrivateEvent::TilesReceived {
                player: Seat::East,
                tiles: vec![Tile(0), Tile(1), Tile(2)],
                from: Some(Seat::South),
            }),
        ),
        (
            "TilesPassed",
            Event::Private(PrivateEvent::TilesPassed {
                player: Seat::East,
                tiles: vec![Tile(0), Tile(1), Tile(2)],
            }),
        ),
        (
            "TileDrawn",
            Event::Private(PrivateEvent::TileDrawnPrivate {
                tile: Tile(5),
                remaining_tiles: 50,
            }),
        ),
        (
            "ReplacementDrawn",
            Event::Private(PrivateEvent::ReplacementDrawn {
                player: Seat::East,
                tile: Tile(5),
                reason: ReplacementReason::Kong,
            }),
        ),
        (
            "IncomingTilesStaged",
            Event::Private(PrivateEvent::IncomingTilesStaged {
                player: Seat::East,
                tiles: vec![Tile(0), Tile(1), Tile(2)],
                from: Some(Seat::South),
                context: IncomingContext::Charleston,
            }),
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
