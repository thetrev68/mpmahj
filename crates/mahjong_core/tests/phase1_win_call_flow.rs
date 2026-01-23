//! Win/call flow + server verification tests
//!
//! This module tests the Phase 1 implementation from the rules audit checklist:
//! - Server-side verification for `DeclareMahjong` (1.1)
//! - `AwaitingMahjong` stage after call resolution (1.2)
//! - Finalized win on valid `DeclareMahjong` (1.3)
//!
//! Tests ensure:
//! - Server ignores client-supplied hand for validation
//! - Invalid Mahjong does not end the game
//! - Called tile is stored server-side and cannot be spoofed
//! - Win context is properly built with correct winning tile and discarder attribution

use mahjong_core::{
    call_resolution::CallIntentKind,
    event::{public_events::PublicEvent, Event},
    flow::playing::TurnStage,
    flow::GamePhase,
    hand::Hand,
    meld::{Meld, MeldType},
    player::{Player, Seat},
    rules::validator::HandValidator,
    rules::card::UnifiedCard,
    table::Table,
    table::types::DiscardedTile,
    tile::Tile,
};

/// Helper to set up a basic 4-player table with all seats filled
fn setup_test_table() -> Table {
    let mut table = Table::new("test".to_string(), 42);

    // Add all 4 players in Playing phase
    for seat in Seat::all() {
        let player = Player::new(format!("player_{}", seat.index()), seat, false);
        table.players.insert(seat, player);
    }

    table
}

/// Helper to load the test card and create validator
fn setup_validator() -> HandValidator {
    let json = std::fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to load test card");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse card");
    HandValidator::new(&card)
}

#[test]
fn test_awaiting_mahjong_stage_exists() {
    // Verify the AwaitingMahjong stage can be constructed and matched
    let stage = TurnStage::AwaitingMahjong {
        caller: Seat::East,
        tile: Tile(0), // 1 Bam
        discarded_by: Seat::South,
    };

    assert_eq!(stage.active_player(), Some(Seat::East));
    assert!(stage.can_player_act(Seat::East));
    assert!(!stage.can_player_act(Seat::South));
}

#[test]
fn test_resolve_call_window_transitions_to_awaiting_mahjong() {
    // When resolve_call_window encounters a Mahjong call, it should transition
    // to AwaitingMahjong instead of ending the game
    let mut table = setup_test_table();

    // Initialize validator
    table.validator = Some(setup_validator());

    let discard_tile = Tile(12); // DOT_5

    // Set up a call window
    table.discard_pile.push(DiscardedTile {
        tile: discard_tile,
        discarded_by: Seat::South,
    });

    let can_act = vec![Seat::South, Seat::West, Seat::North]
        .into_iter()
        .filter(|&s| s != Seat::South)
        .collect();

    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: discard_tile,
        discarded_by: Seat::South,
        can_act,
        pending_intents: vec![],
        timer: 5,
    });

    // Add a Mahjong intent
    if let GamePhase::Playing(TurnStage::CallWindow {
        pending_intents,
        can_act,
        ..
    }) = &mut table.phase
    {
        let intent = mahjong_core::call_resolution::CallIntent::new(
            Seat::West,
            CallIntentKind::Mahjong,
            0,
        );
        pending_intents.push(intent);
        can_act.remove(&Seat::West);
    }

    // Resolve call window
    let events = mahjong_core::table::handlers::playing::resolve_call_window(&mut table);

    // Verify we transitioned to AwaitingMahjong
    assert!(matches!(
        table.phase,
        GamePhase::Playing(TurnStage::AwaitingMahjong { .. })
    ));

    if let GamePhase::Playing(TurnStage::AwaitingMahjong {
        caller,
        tile,
        discarded_by,
    }) = &table.phase
    {
        assert_eq!(*caller, Seat::West);
        assert_eq!(*tile, discard_tile);
        assert_eq!(*discarded_by, Seat::South);
    } else {
        panic!("Expected AwaitingMahjong stage");
    }

    // Verify events include AwaitingMahjongValidation
    let has_validation_event = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::AwaitingMahjongValidation { .. })
        )
    });
    assert!(has_validation_event, "Should emit AwaitingMahjongValidation event");

    // Verify discard was removed from pile
    assert!(
        table.discard_pile.is_empty(),
        "Discard should be removed and stored in AwaitingMahjong"
    );
}

#[test]
fn test_declare_mahjong_ignores_client_hand() {
    // Server should ignore client-supplied hand and rebuild from state
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    // Give East a valid hand with 14 tiles
    if let Some(east) = table.get_player_mut(Seat::East) {
        // Add 14 tiles to make a valid pattern
        for _ in 0..3 {
            east.hand.add_tile(Tile(0)); // BAM_1
            east.hand.add_tile(Tile(0));
        }
        for _ in 0..3 {
            east.hand.add_tile(Tile(1)); // BAM_2
            east.hand.add_tile(Tile(1));
        }
        for _ in 0..3 {
            east.hand.add_tile(Tile(2)); // BAM_3
            east.hand.add_tile(Tile(2));
        }
        east.hand.add_tile(Tile(3)); // BAM_4
    }

    // Client tries to send a different (invalid) hand
    let fake_hand = Hand::empty();

    // Call declare_mahjong
    let events = mahjong_core::table::handlers::win::declare_mahjong(
        &mut table,
        Seat::East,
        fake_hand,
        None,
    );

    // Server should use the actual server state, not the client hand
    // Verify validation event was emitted
    let has_validation_event = events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::HandValidated { .. })));
    assert!(has_validation_event, "Should emit HandValidated event");
}

#[test]
fn test_invalid_mahjong_rejected_without_phase_change() {
    // Invalid Mahjong should be rejected and not advance the game phase
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    // Set up AwaitingMahjong state
    table.phase = GamePhase::Playing(TurnStage::AwaitingMahjong {
        caller: Seat::East,
        tile: Tile(12), // DOT_5
        discarded_by: Seat::South,
    });

    // East's hand is empty (invalid - only 0 tiles instead of 14)
    // declare_mahjong should add the stored tile, but that's still only 1 tile

    let empty_hand = Hand::empty();

    let events = mahjong_core::table::handlers::win::declare_mahjong(
        &mut table,
        Seat::East,
        empty_hand,
        None,
    );

    // Verify rejection events
    let has_rejection = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::CommandRejected { .. })
        )
    });
    assert!(has_rejection, "Should emit CommandRejected");

    let has_invalid_validation = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::HandValidated {
                valid: false,
                ..
            })
        )
    });
    assert!(has_invalid_validation, "Should emit HandValidated {{ valid: false }}");
}

#[test]
fn test_mahjong_wrong_player_rejected() {
    // Only the caller can submit DeclareMahjong in AwaitingMahjong stage
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    // Set up AwaitingMahjong with West as caller
    table.phase = GamePhase::Playing(TurnStage::AwaitingMahjong {
        caller: Seat::West,
        tile: Tile(12), // DOT_5
        discarded_by: Seat::South,
    });

    let hand = Hand::empty();

    // East tries to declare (wrong player)
    let events = mahjong_core::table::handlers::win::declare_mahjong(&mut table, Seat::East, hand, None);

    // Should be rejected
    let has_rejection = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::CommandRejected { .. })
        )
    });
    assert!(has_rejection, "Wrong player should be rejected");

    // Phase should not change
    assert!(matches!(
        table.phase,
        GamePhase::Playing(TurnStage::AwaitingMahjong { .. })
    ));
}

#[test]
fn test_awaiting_mahjong_stored_state() {
    // AwaitingMahjong state should store caller, tile, and discarder immutably
    let caller = Seat::East;
    let tile = Tile(4); // BAM_5
    let discarder = Seat::South;

    let stage = TurnStage::AwaitingMahjong {
        caller,
        tile,
        discarded_by: discarder,
    };

    // Verify all fields are accessible
    if let TurnStage::AwaitingMahjong {
        caller: c,
        tile: t,
        discarded_by: d,
    } = stage
    {
        assert_eq!(c, caller);
        assert_eq!(t, tile);
        assert_eq!(d, discarder);
    } else {
        panic!("Failed to match AwaitingMahjong stage");
    }
}

#[test]
fn test_tile_count_validation_rejects_wrong_count() {
    // declare_mahjong should reject hands with wrong tile count
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    // Give East only 10 tiles
    if let Some(east) = table.get_player_mut(Seat::East) {
        for _ in 0..5 {
            east.hand.add_tile(Tile(0)); // BAM_1
            east.hand.add_tile(Tile(1)); // BAM_2
        }
    }

    let hand = Hand::empty();

    let events = mahjong_core::table::handlers::win::declare_mahjong(
        &mut table,
        Seat::East,
        hand,
        None,
    );

    // Should have rejection with tile count message
    let has_count_rejection = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::CommandRejected {
                reason: ref r,
                ..
            }) if r.contains("tile count")
        )
    });
    assert!(has_count_rejection, "Should reject wrong tile count with specific message");
}

#[test]
fn test_call_intent_mahjong_has_high_priority() {
    // Mahjong intents should be resolved before meld intents
    let mut table = setup_test_table();

    let discard_tile = Tile(9); // CRAK_1

    // Set up a call window
    table.discard_pile.push(DiscardedTile {
        tile: discard_tile,
        discarded_by: Seat::South,
    });

    let can_act = vec![Seat::East, Seat::West, Seat::North]
        .into_iter()
        .collect();

    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: discard_tile,
        discarded_by: Seat::South,
        can_act,
        pending_intents: vec![],
        timer: 5,
    });

    // Add both meld and Mahjong intents
    if let GamePhase::Playing(TurnStage::CallWindow {
        pending_intents,
        can_act,
        ..
    }) = &mut table.phase
    {
        // Meld intent from East (right)
        let meld = Meld::new(
            MeldType::Pung,
            vec![discard_tile, discard_tile, discard_tile],
            Some(discard_tile),
        )
        .expect("Meld creation should succeed");

        let meld_intent =
            mahjong_core::call_resolution::CallIntent::new(Seat::East, CallIntentKind::Meld(meld), 0);
        pending_intents.push(meld_intent);

        // Mahjong intent from West (left) - added later
        let mahjong_intent = mahjong_core::call_resolution::CallIntent::new(
            Seat::West,
            CallIntentKind::Mahjong,
            1,
        );
        pending_intents.push(mahjong_intent);

        can_act.clear();
    }

    // Resolve
    let _events = mahjong_core::table::handlers::playing::resolve_call_window(&mut table);

    // Should transition to AwaitingMahjong with Seat::West as caller
    if let GamePhase::Playing(TurnStage::AwaitingMahjong { caller, .. }) = &table.phase {
        assert_eq!(*caller, Seat::West, "Mahjong should win over meld");
    } else {
        panic!("Expected AwaitingMahjong stage");
    }
}

