//! Integration tests for call priority and adjudication.
//!
//! Tests the complete flow of multiple players declaring call intents
//! and the system resolving them according to priority rules.

use mahjong_core::{
    call_resolution::{CallIntentKind, CallResolution},
    command::GameCommand,
    event::{public_events::PublicEvent, Event},
    flow::playing::TurnStage,
    flow::GamePhase,
    hand::Hand,
    meld::{Meld, MeldType},
    player::{Player, PlayerStatus, Seat},
    table::Table,
    tile::Tile,
};

#[test]
fn test_simultaneous_meld_calls_resolved_by_seat_order() {
    let mut table = setup_table_for_playing();

    // East discards a tile
    let discard_cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0), // 1 Bam
    };
    table.process_command(discard_cmd).unwrap();

    if let Some(south) = table.get_player_mut(Seat::South) {
        south.hand.add_tile(Tile(0));
        south.hand.add_tile(Tile(0));
    }
    if let Some(west) = table.get_player_mut(Seat::West) {
        west.hand.add_tile(Tile(0));
        west.hand.add_tile(Tile(0));
    }

    // Both South (right) and West (left) want to meld
    let meld = Meld::new(
        MeldType::Pung,
        vec![Tile(0), Tile(0), Tile(0)],
        Some(Tile(0)),
    )
    .unwrap();

    let south_intent = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld.clone()),
    };
    let west_intent = GameCommand::DeclareCallIntent {
        player: Seat::West,
        intent: CallIntentKind::Meld(meld.clone()),
    };

    // Process both intents
    table.process_command(south_intent).unwrap();
    table.process_command(west_intent).unwrap();

    // North passes to trigger resolution
    let north_pass = GameCommand::Pass {
        player: Seat::North,
    };
    let events = table.process_command(north_pass).unwrap();

    // Verify CallResolved event shows South won (seat priority)
    let resolved_event = events
        .iter()
        .find(|e| matches!(e, Event::Public(PublicEvent::CallResolved { .. })));
    assert!(resolved_event.is_some());

    if let Event::Public(PublicEvent::CallResolved { resolution, .. }) = resolved_event.unwrap() {
        assert!(matches!(
            resolution,
            CallResolution::Meld {
                seat: Seat::South,
                ..
            }
        ));
    }

    // Verify TileCalled event
    let called_event = events
        .iter()
        .find(|e| matches!(e, Event::Public(PublicEvent::TileCalled { .. })));
    assert!(called_event.is_some());
}

#[test]
fn test_mahjong_call_beats_meld_call() {
    let mut table = setup_table_for_playing();

    // East discards a tile
    let discard_cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0),
    };
    table.process_command(discard_cmd).unwrap();

    if let Some(south) = table.get_player_mut(Seat::South) {
        south.hand.add_tile(Tile(0));
        south.hand.add_tile(Tile(0));
    }

    // South wants to meld
    let meld = Meld::new(
        MeldType::Pung,
        vec![Tile(0), Tile(0), Tile(0)],
        Some(Tile(0)),
    )
    .unwrap();
    let south_intent = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };

    // West wants to win
    let west_intent = GameCommand::DeclareCallIntent {
        player: Seat::West,
        intent: CallIntentKind::Mahjong,
    };

    // Process both intents
    table.process_command(south_intent).unwrap();
    table.process_command(west_intent).unwrap();

    // North passes to trigger resolution
    let north_pass = GameCommand::Pass {
        player: Seat::North,
    };
    let events = table.process_command(north_pass).unwrap();

    // Verify CallResolved event shows West won (Mahjong priority)
    let resolved_event = events
        .iter()
        .find(|e| matches!(e, Event::Public(PublicEvent::CallResolved { .. })));
    assert!(resolved_event.is_some());

    if let Event::Public(PublicEvent::CallResolved { resolution, .. }) = resolved_event.unwrap() {
        assert_eq!(resolution, &CallResolution::Mahjong(Seat::West));
    }
}

#[test]
fn test_all_pass_no_call_resolution() {
    let mut table = setup_table_for_playing();

    // East discards a tile
    let discard_cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0),
    };
    table.process_command(discard_cmd).unwrap();

    // All players pass
    for seat in [Seat::South, Seat::West, Seat::North] {
        let pass_cmd = GameCommand::Pass { player: seat };
        table.process_command(pass_cmd).unwrap();
    }

    // Verify NoCall resolution
    // After all pass, should advance to next player's Drawing stage
    assert!(matches!(
        table.phase,
        GamePhase::Playing(TurnStage::Drawing { .. })
    ));
}

#[test]
fn test_cannot_declare_intent_after_passing() {
    let mut table = setup_table_for_playing();

    // East discards
    let discard_cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: Tile(0),
    };
    table.process_command(discard_cmd).unwrap();

    // South passes
    let pass_cmd = GameCommand::Pass {
        player: Seat::South,
    };
    table.process_command(pass_cmd).unwrap();

    // South tries to declare intent after passing - should fail
    let meld = Meld::new(
        MeldType::Pung,
        vec![Tile(0), Tile(0), Tile(0)],
        Some(Tile(0)),
    )
    .unwrap();
    let intent_cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };

    let result = table.process_command(intent_cmd);
    assert!(result.is_err()); // Should be rejected
}

/// Helper to set up a table in Playing phase for testing.
fn setup_table_for_playing() -> Table {
    let mut table = Table::new("test".to_string(), 42);

    // Add 4 players
    for seat in Seat::all() {
        let mut player = Player::new(format!("player_{}", seat.index()), seat, false);
        // Give 13 tiles
        let tiles: Vec<Tile> = (0..13).map(Tile).collect();
        player.hand = Hand::new(tiles);
        player.status = PlayerStatus::Active;
        table.players.insert(seat, player);
    }

    // Set phase to Playing (East Discarding - initial state)
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    // East needs 14th tile
    if let Some(p) = table.players.get_mut(&Seat::East) {
        p.hand.add_tile(Tile(13));
    }

    table
}
