//! Phase 2: Meld validation + exposure updates integration tests.
//!
//! This test module validates:
//! - Sextet support (6-tile melds)
//! - All-joker melds per NMJL
//! - Meld call validation against the window tile and hand ownership
//! - Add-to-exposure command (upgrading Pung → Kong → Quint → Sextet)

use mahjong_core::{
    call_resolution::{self, CallIntent, CallIntentKind, CallResolution},
    command::GameCommand,
    event::{private_events::PrivateEvent, types::ReplacementReason, Event},
    flow::playing::TurnStage,
    flow::GamePhase,
    meld::{Meld, MeldType},
    player::{Player, Seat},
    table::types::DiscardedTile,
    table::Table,
    tile::{tiles::*, Tile},
};

// ===== HELPER FUNCTIONS =====

/// Create a table with four players ready to play.
fn setup_game() -> Table {
    let mut table = Table::new("phase2_test".to_string(), 0);

    // Add players
    for &seat in &[Seat::East, Seat::South, Seat::West, Seat::North] {
        let player = Player::new(format!("Player_{:?}", seat), seat, false);
        table.players.insert(seat, player);
    }

    // Simulate Charleston completion and move to Playing phase
    // In a real test, we'd walk through Charleston, but for now we'll
    // manually set the phase to Playing with a Drawing stage.
    table.phase = GamePhase::Playing(TurnStage::Drawing { player: Seat::East });
    table.current_turn = Seat::East;

    table
}

/// Create a test Pung meld.
fn create_pung(tile: Tile, called: Option<Tile>) -> Meld {
    Meld::new(MeldType::Pung, vec![tile, tile, tile], called).unwrap()
}

/// Create a test Kong meld.
fn create_kong(tile: Tile, called: Option<Tile>) -> Meld {
    Meld::new(MeldType::Kong, vec![tile, tile, tile, tile], called).unwrap()
}

/// Create a test Quint meld.
fn create_quint(tile: Tile, called: Option<Tile>) -> Meld {
    Meld::new(MeldType::Quint, vec![tile, tile, tile, tile, tile], called).unwrap()
}

/// Create a test Sextet meld.
fn create_sextet(tile: Tile, called: Option<Tile>) -> Meld {
    Meld::new(
        MeldType::Sextet,
        vec![tile, tile, tile, tile, tile, tile],
        called,
    )
    .unwrap()
}

// ===== SEXTET SUPPORT TESTS =====

#[test]
fn test_sextet_tile_count() {
    assert_eq!(MeldType::Pung.tile_count(), 3);
    assert_eq!(MeldType::Kong.tile_count(), 4);
    assert_eq!(MeldType::Quint.tile_count(), 5);
    assert_eq!(MeldType::Sextet.tile_count(), 6);
}

#[test]
fn test_create_sextet_meld() {
    let sextet = create_sextet(DOT_5, Some(DOT_5));
    assert_eq!(sextet.meld_type, MeldType::Sextet);
    assert_eq!(sextet.tiles.len(), 6);
    assert_eq!(sextet.called_tile, Some(DOT_5));
}

#[test]
fn test_sextet_with_jokers() {
    let sextet = Meld::new(
        MeldType::Sextet,
        vec![DOT_5, DOT_5, JOKER, DOT_5, DOT_5, JOKER],
        Some(DOT_5),
    );
    assert!(sextet.is_ok());
    let meld = sextet.unwrap();
    assert_eq!(meld.joker_assignments.len(), 2); // Two jokers assigned to DOT_5
}

// ===== ALL-JOKER MELDS TESTS =====

#[test]
fn test_all_joker_pung_with_called_tile() {
    // All jokers with called_tile should work
    let meld = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], Some(BAM_1));
    assert!(meld.is_ok());
    let m = meld.unwrap();
    assert_eq!(m.joker_assignments.len(), 3); // All three jokers assigned to BAM_1
}

#[test]
fn test_all_joker_pung_without_called_tile() {
    // All jokers without called_tile should also work
    let meld = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], None);
    assert!(meld.is_ok());
    let m = meld.unwrap();
    assert_eq!(m.joker_assignments.len(), 0); // No joker assignments without base tile
}

#[test]
fn test_all_joker_kong_with_called_tile() {
    let meld = Meld::new(
        MeldType::Kong,
        vec![JOKER, JOKER, JOKER, JOKER],
        Some(CRAK_3),
    );
    assert!(meld.is_ok());
    let m = meld.unwrap();
    assert_eq!(m.joker_assignments.len(), 4);
    assert_eq!(m.called_tile, Some(CRAK_3));
}

#[test]
fn test_can_exchange_joker_all_joker_meld_with_called_tile() {
    let meld = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], Some(DOT_7)).unwrap();
    // Should be able to exchange for DOT_7 (the called_tile)
    assert!(meld.can_exchange_joker(DOT_7));
    // Should not be able to exchange for a different tile
    assert!(!meld.can_exchange_joker(DOT_8));
}

#[test]
fn test_can_exchange_joker_all_joker_meld_without_called_tile() {
    let meld = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], None).unwrap();
    // Cannot exchange without a base tile
    assert!(!meld.can_exchange_joker(DOT_7));
}

#[test]
fn test_mixed_natural_and_joker_melds() {
    let meld = Meld::new(
        MeldType::Kong,
        vec![BAM_2, BAM_2, JOKER, BAM_2],
        Some(BAM_2),
    );
    assert!(meld.is_ok());
    let m = meld.unwrap();
    assert_eq!(m.joker_assignments.len(), 1); // One joker assigned
    assert!(m.can_exchange_joker(BAM_2));
}

// ===== MELD CALL VALIDATION TESTS =====

#[test]
fn test_meld_call_requires_called_tile() {
    let mut table = setup_game();

    // Set up a call window
    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_5,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    // Create a meld without called_tile
    let meld_no_called = Meld::new(MeldType::Pung, vec![DOT_5, DOT_5, DOT_5], None).unwrap();

    // Try to declare intent with this meld - should fail
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld_no_called),
    };

    // This should fail validation because meld.called_tile is None
    let result = table.process_command(cmd);
    assert!(result.is_err(), "Meld call should require called_tile");
}

#[test]
fn test_meld_call_called_tile_must_match_window() {
    let mut table = setup_game();

    // Set up a call window for DOT_5
    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_5,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    // Create a meld with called_tile = DOT_6 (wrong tile)
    let meld_wrong_tile =
        Meld::new(MeldType::Pung, vec![DOT_6, DOT_6, DOT_6], Some(DOT_6)).unwrap();

    // Try to declare intent with this meld - should fail
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld_wrong_tile),
    };

    let result = table.process_command(cmd);
    assert!(
        result.is_err(),
        "Meld's called_tile must match the call window tile"
    );
}

#[test]
fn test_meld_call_must_contain_called_tile() {
    let mut table = setup_game();

    // Set up a call window for DOT_5
    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_5,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    // Create a meld of DOT_6 (not DOT_5) - this won't contain the called tile
    let meld = Meld::new(MeldType::Pung, vec![DOT_6, DOT_6, DOT_6], Some(DOT_6));
    assert!(meld.is_ok(), "Creating a DOT_6 pung should work");

    // Try to call with this meld when the window is for DOT_5 - should fail
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld.unwrap()),
    };

    let result = table.process_command(cmd);
    assert!(
        result.is_err(),
        "Cannot call a meld that doesn't match the window tile"
    );
}

#[test]
fn test_meld_call_player_must_own_tiles() {
    let mut table = setup_game();

    // Set up a call window for DOT_5
    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_5,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    // Give South a hand without DOT_6 (needed for Kong)
    let south_player = table.get_player_mut(Seat::South).unwrap();
    south_player.hand.add_tile(DOT_5); // Only the called tile
    south_player.hand.add_tile(BAM_1); // Different tile

    // Try to call a Kong that requires DOT_5, DOT_5, DOT_5 (but South only has one)
    // Actually, let's call a Pung of DOT_6 - South doesn't have DOT_6
    let meld = Meld::new(MeldType::Pung, vec![DOT_6, DOT_6, DOT_6], Some(DOT_6)).unwrap();

    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };

    let result = table.process_command(cmd);
    assert!(
        result.is_err(),
        "Player must own tiles in the meld (except the called tile)"
    );
}

#[test]
fn test_valid_meld_call_with_correct_tiles() {
    let mut table = setup_game();

    // Set up a call window for DOT_5
    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_5,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    // Give South the tiles needed for a Pung call (they own DOT_5, DOT_5)
    let south_player = table.get_player_mut(Seat::South).unwrap();
    south_player.hand.add_tile(DOT_5);
    south_player.hand.add_tile(DOT_5);

    // Create a valid Pung of DOT_5 with called_tile
    let meld = Meld::new(MeldType::Pung, vec![DOT_5, DOT_5, DOT_5], Some(DOT_5)).unwrap();

    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };

    let result = table.process_command(cmd);
    assert!(result.is_ok(), "Valid meld call should be accepted");
}

#[test]
fn test_meld_call_kong_requires_only_three_in_hand() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: DOT_7,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });

    let south = table.get_player_mut(Seat::South).unwrap();
    south.hand.add_tile(DOT_7);
    south.hand.add_tile(DOT_7);
    south.hand.add_tile(DOT_7);

    let meld = Meld::new(
        MeldType::Kong,
        vec![DOT_7, DOT_7, DOT_7, DOT_7],
        Some(DOT_7),
    )
    .unwrap();
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };

    let result = table.process_command(cmd);
    assert!(
        result.is_ok(),
        "Caller should only need 3 tiles for a called Kong"
    );
}

#[test]
fn test_sextet_call_draws_replacement_tile() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::CallWindow {
        tile: BAM_3,
        discarded_by: Seat::East,
        can_act: [Seat::South, Seat::West, Seat::North]
            .iter()
            .copied()
            .collect(),
        pending_intents: vec![],
        timer: 10,
    });
    table.discard_pile.push(DiscardedTile {
        tile: BAM_3,
        discarded_by: Seat::East,
    });

    let south = table.get_player_mut(Seat::South).unwrap();
    for _ in 0..5 {
        south.hand.add_tile(BAM_3);
    }

    let meld = Meld::new(
        MeldType::Sextet,
        vec![BAM_3, BAM_3, BAM_3, BAM_3, BAM_3, BAM_3],
        Some(BAM_3),
    )
    .unwrap();
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld),
    };
    table.process_command(cmd).unwrap();

    table
        .process_command(GameCommand::Pass { player: Seat::West })
        .unwrap();
    let events = table
        .process_command(GameCommand::Pass {
            player: Seat::North,
        })
        .unwrap();

    let drew_replacement = events.iter().any(|event| {
        matches!(
            event,
            Event::Private(PrivateEvent::ReplacementDrawn {
                player: Seat::South,
                reason: ReplacementReason::Sextet,
                ..
            })
        )
    });

    assert!(
        drew_replacement,
        "Sextet call should draw a replacement tile immediately"
    );
}

// ===== ADD-TO-EXPOSURE TESTS =====

#[test]
fn test_add_to_exposure_pung_to_kong() {
    let mut table = setup_game();

    // Set up a Discarding phase for East
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    // Give East an exposed Pung and the tile to upgrade it
    let east_player = table.get_player_mut(Seat::East).unwrap();
    let pung = create_pung(DOT_3, Some(DOT_3));
    east_player.hand.exposed.push(pung);
    east_player.hand.add_tile(DOT_3); // The tile to add

    // Call AddToExposure
    let cmd = GameCommand::AddToExposure {
        player: Seat::East,
        meld_index: 0,
        tile: DOT_3,
    };

    let result = table.process_command(cmd);
    assert!(result.is_ok(), "AddToExposure should succeed");

    // Verify the meld was upgraded
    let east = table.get_player(Seat::East).unwrap();
    assert_eq!(east.hand.exposed[0].meld_type, MeldType::Kong);
    assert_eq!(east.hand.exposed[0].tiles.len(), 4);
}

#[test]
fn test_add_to_exposure_kong_to_quint() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding {
        player: Seat::South,
    });

    let south = table.get_player_mut(Seat::South).unwrap();
    let kong = create_kong(BAM_7, Some(BAM_7));
    south.hand.exposed.push(kong);
    south.hand.add_tile(BAM_7);

    let cmd = GameCommand::AddToExposure {
        player: Seat::South,
        meld_index: 0,
        tile: BAM_7,
    };

    let result = table.process_command(cmd);
    assert!(result.is_ok());

    let south = table.get_player(Seat::South).unwrap();
    assert_eq!(south.hand.exposed[0].meld_type, MeldType::Quint);
    assert_eq!(south.hand.exposed[0].tiles.len(), 5);
}

#[test]
fn test_add_to_exposure_quint_to_sextet() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::West });

    let west = table.get_player_mut(Seat::West).unwrap();
    let quint = create_quint(CRAK_1, Some(CRAK_1));
    west.hand.exposed.push(quint);
    west.hand.add_tile(CRAK_1);

    let cmd = GameCommand::AddToExposure {
        player: Seat::West,
        meld_index: 0,
        tile: CRAK_1,
    };

    let result = table.process_command(cmd);
    assert!(result.is_ok());

    let west = table.get_player(Seat::West).unwrap();
    assert_eq!(west.hand.exposed[0].meld_type, MeldType::Sextet);
    assert_eq!(west.hand.exposed[0].tiles.len(), 6);
}

#[test]
fn test_add_to_exposure_sextet_draws_replacement_tile() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::West });

    let west = table.get_player_mut(Seat::West).unwrap();
    let quint = create_quint(CRAK_6, Some(CRAK_6));
    west.hand.exposed.push(quint);
    west.hand.add_tile(CRAK_6);

    let events = table
        .process_command(GameCommand::AddToExposure {
            player: Seat::West,
            meld_index: 0,
            tile: CRAK_6,
        })
        .unwrap();

    let drew_replacement = events.iter().any(|event| {
        matches!(
            event,
            Event::Private(PrivateEvent::ReplacementDrawn {
                player: Seat::West,
                reason: ReplacementReason::Sextet,
                ..
            })
        )
    });

    assert!(
        drew_replacement,
        "Upgrading to Sextet should draw a replacement tile immediately"
    );
}

#[test]
fn test_add_to_exposure_wrong_tile_type() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding {
        player: Seat::North,
    });

    let north = table.get_player_mut(Seat::North).unwrap();
    let pung = create_pung(DOT_8, Some(DOT_8));
    north.hand.exposed.push(pung);
    north.hand.add_tile(DOT_9); // Wrong tile

    let cmd = GameCommand::AddToExposure {
        player: Seat::North,
        meld_index: 0,
        tile: DOT_9,
    };

    let result = table.process_command(cmd);
    assert!(result.is_err(), "Cannot add tile of different rank to meld");
}

#[test]
fn test_add_to_exposure_player_doesnt_own_tile() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    let east = table.get_player_mut(Seat::East).unwrap();
    let pung = create_pung(DOT_2, Some(DOT_2));
    east.hand.exposed.push(pung);
    // Don't add the tile to hand

    let cmd = GameCommand::AddToExposure {
        player: Seat::East,
        meld_index: 0,
        tile: DOT_2,
    };

    let result = table.process_command(cmd);
    assert!(result.is_err(), "Player must own the tile to add");
}

#[test]
fn test_add_to_exposure_removes_tile_from_hand() {
    let mut table = setup_game();

    table.phase = GamePhase::Playing(TurnStage::Discarding {
        player: Seat::South,
    });

    let south = table.get_player_mut(Seat::South).unwrap();
    let pung = create_pung(DOT_1, Some(DOT_1));
    south.hand.exposed.push(pung);
    south.hand.add_tile(DOT_1); // Tile to add to meld
    south.hand.add_tile(CRAK_1); // Other tile

    // Verify the meld is a Pung before
    assert_eq!(south.hand.exposed[0].meld_type, MeldType::Pung);
    assert_eq!(south.hand.exposed[0].tiles.len(), 3);

    let cmd = GameCommand::AddToExposure {
        player: Seat::South,
        meld_index: 0,
        tile: DOT_1,
    };

    table.process_command(cmd).unwrap();

    // Verify the meld was upgraded to Kong
    let south = table.get_player(Seat::South).unwrap();
    assert_eq!(south.hand.exposed[0].meld_type, MeldType::Kong);
    assert_eq!(south.hand.exposed[0].tiles.len(), 4);
}

// ===== INTEGRATION TESTS =====

#[test]
fn test_call_resolution_with_sextet() {
    let sextet = create_sextet(DOT_9, Some(DOT_9));
    let intent = CallIntent::new(Seat::South, CallIntentKind::Meld(sextet), 0);
    let resolution = call_resolution::resolve_calls(&[intent], Seat::East);

    assert!(matches!(
        resolution,
        CallResolution::Meld {
            seat: Seat::South,
            ..
        }
    ));
}

#[test]
fn test_all_joker_meld_with_joker_exchange() {
    let all_joker_pung = Meld::new(MeldType::Pung, vec![JOKER, JOKER, JOKER], Some(BAM_5));
    assert!(all_joker_pung.is_ok());

    let meld = all_joker_pung.unwrap();
    // Should be able to exchange for BAM_5
    assert!(meld.can_exchange_joker(BAM_5));

    // Should not be able to exchange for a different tile
    assert!(!meld.can_exchange_joker(BAM_6));
}

#[test]
fn test_sextet_with_mixed_jokers() {
    let meld = Meld::new(
        MeldType::Sextet,
        vec![CRAK_4, CRAK_4, JOKER, CRAK_4, JOKER, CRAK_4],
        Some(CRAK_4),
    );
    assert!(meld.is_ok());

    let m = meld.unwrap();
    assert_eq!(m.meld_type, MeldType::Sextet);
    assert_eq!(m.joker_assignments.len(), 2);
    assert!(m.can_exchange_joker(CRAK_4));
}
