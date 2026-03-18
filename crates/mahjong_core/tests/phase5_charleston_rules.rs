//! Phase 5: Charleston Rules Tests
//!
//! This module tests the Phase 5 implementation from the rules audit checklist:
//! - 5.1: Staging-first pass (all stages), including blind forward on FirstLeft/SecondRight
//! - 5.2: IOU resolution (all-blind-pass scenario)
//! - 5.3: Heavenly hand detection (East wins before Charleston)
//!
//! Updated for staging-first protocol (US-STAGE-001):
//! - `commit_charleston_pass` replaces `pass_tiles`
//! - All passes stage via incoming_tiles; hand mutation happens at commit time
//! - `BlindPassPerformed` is no longer emitted; use forward_incoming_count instead

use mahjong_core::{
    event::{public_events::PublicEvent, Event},
    flow::charleston::CharlestonStage,
    flow::GamePhase,
    player::{Player, PlayerStatus, Seat},
    rules::card::UnifiedCard,
    rules::validator::HandValidator,
    table::Table,
    tile::tiles::*,
};

/// Helper to set up a basic 4-player table in Setup phase
fn setup_test_table() -> Table {
    let mut table = Table::new("test".to_string(), 42);

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

// ============================================================================
// 5.3: Heavenly Hand Detection
// ============================================================================

#[test]
#[ignore = "Heavenly hand detection requires specific pattern in validator - needs investigation"]
fn test_heavenly_hand_detection() {
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(BAM_1);
        east.hand.add_tile(BAM_3);
        east.hand.add_tile(BAM_5);
        east.hand.add_tile(BAM_7);
        east.hand.add_tile(BAM_9);
        east.hand.add_tile(DOT_1);
        east.hand.add_tile(DOT_3);
        east.hand.add_tile(DOT_5);
        east.hand.add_tile(DOT_7);
        east.hand.add_tile(DOT_9);
        east.hand.add_tile(CRAK_1);
        east.hand.add_tile(CRAK_3);
        east.hand.add_tile(CRAK_5);
        east.hand.add_tile(CRAK_7);
        east.status = PlayerStatus::Active;
    }

    table.phase = GamePhase::Setup(mahjong_core::flow::SetupStage::OrganizingHands);

    let mut all_events = vec![];
    for seat in Seat::all() {
        let events = mahjong_core::table::handlers::setup::ready_to_start(&mut table, seat);
        all_events.extend(events);
    }
    let events = all_events;

    let has_heavenly_hand = events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::HeavenlyHand { .. })));
    assert!(
        has_heavenly_hand,
        "Should emit HeavenlyHand event when East has winning hand"
    );

    let has_game_over = events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::GameOver { .. })));
    assert!(
        has_game_over,
        "Should emit GameOver event for heavenly hand"
    );

    assert!(
        table.charleston_state.is_none(),
        "Charleston should be skipped for heavenly hand"
    );
}

#[test]
fn test_no_heavenly_hand_starts_charleston() {
    let mut table = setup_test_table();
    table.validator = Some(setup_validator());

    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(BAM_1);
        east.hand.add_tile(BAM_2);
        east.hand.add_tile(BAM_3);
        east.hand.add_tile(DOT_1);
        east.hand.add_tile(DOT_2);
        east.hand.add_tile(DOT_3);
        east.hand.add_tile(CRAK_1);
        east.hand.add_tile(CRAK_2);
        east.hand.add_tile(CRAK_3);
        east.hand.add_tile(FLOWER);
        east.hand.add_tile(FLOWER);
        east.hand.add_tile(FLOWER);
        east.hand.add_tile(FLOWER);
        east.hand.add_tile(JOKER);
        east.status = PlayerStatus::Active;
    }

    table.phase = GamePhase::Setup(mahjong_core::flow::SetupStage::OrganizingHands);

    let mut all_events = vec![];
    for seat in Seat::all() {
        let events = mahjong_core::table::handlers::setup::ready_to_start(&mut table, seat);
        all_events.extend(events);
    }
    let events = all_events;

    let has_heavenly_hand = events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::HeavenlyHand { .. })));
    assert!(
        !has_heavenly_hand,
        "Should NOT emit HeavenlyHand event when East lacks winning hand"
    );

    assert!(
        table.charleston_state.is_some(),
        "Charleston should start when no heavenly hand"
    );

    let has_charleston_start = events.iter().any(|e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::FirstRight
            })
        )
    });
    assert!(has_charleston_start, "Should start Charleston");
}

// ============================================================================
// 5.1: Staging-first pass / blind forwarding
// ============================================================================

#[test]
fn test_ordinary_pass_delivers_tiles_to_hand_directly() {
    // US-058 receive-first contract: after FirstAcross (ordinary stage), received tiles
    // go directly into the recipient's hand as TilesReceived — NOT into incoming_tiles.
    let mut table = setup_test_table();
    table.phase = GamePhase::Charleston(CharlestonStage::FirstAcross);
    let mut charleston_state = mahjong_core::flow::charleston::CharlestonState::new(60);
    charleston_state.stage = CharlestonStage::FirstAcross;
    table.charleston_state = Some(charleston_state);

    // Give each player 3 tiles
    for seat in Seat::all() {
        if let Some(player) = table.get_player_mut(seat) {
            player.status = PlayerStatus::Active;
            player.hand.add_tile(BAM_1);
            player.hand.add_tile(BAM_2);
            player.hand.add_tile(BAM_3);
        }
    }

    // All players commit pass
    for seat in Seat::all() {
        mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[BAM_1, BAM_2, BAM_3],
            0,
        );
    }

    // After ordinary FirstAcross: incoming_tiles must be empty (tiles went straight to hand).
    if let Some(charleston) = &table.charleston_state {
        for seat in Seat::all() {
            let incoming_count = charleston
                .incoming_tiles
                .get(&seat)
                .map(|tiles| tiles.len())
                .unwrap_or(0);
            assert_eq!(
                incoming_count, 0,
                "Ordinary pass: each player's incoming_tiles should be empty after FirstAcross"
            );
        }
    } else {
        panic!("Charleston state should exist");
    }

    // Each player passed 3 tiles and received 3 tiles directly → 3 remaining
    // (started with 3, passed 3, received 3 from the player across → back to 3)
    for seat in Seat::all() {
        let hand_count = table.get_player(seat).unwrap().hand.concealed.len();
        assert_eq!(
            hand_count, 3,
            "Each player should have 3 tiles in hand after ordinary pass (passed 3, received 3)"
        );
    }
}

#[test]
fn test_forward_incoming_tiles_in_blind_stage() {
    // During FirstLeft, player can forward staged incoming tiles.
    let mut table = setup_test_table();
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    let mut charleston = mahjong_core::flow::charleston::CharlestonState::new(60);
    charleston.stage = CharlestonStage::FirstLeft;

    // Populate incoming tiles for East (as if from FirstAcross)
    charleston
        .incoming_tiles
        .insert(Seat::East, vec![DOT_1, DOT_2, DOT_3]);
    table.charleston_state = Some(charleston);

    // Give East one hand tile
    if let Some(east) = table.get_player_mut(Seat::East) {
        east.status = PlayerStatus::Active;
        east.hand.add_tile(BAM_1);
    }

    // East passes: 1 from hand + 2 forwarded from incoming
    mahjong_core::table::handlers::charleston::commit_charleston_pass(
        &mut table,
        Seat::East,
        &[BAM_1],
        2, // forward 2 of the 3 staged incoming tiles
    );

    if let Some(charleston) = &table.charleston_state {
        // Pass bundle should have 3 tiles (1 hand + 2 forwarded)
        if let Some(Some(passed_tiles)) = charleston.pending_passes.get(&Seat::East) {
            assert_eq!(
                passed_tiles.len(),
                3,
                "East should have pass bundle of 3 tiles (1 hand + 2 forwarded)"
            );
        } else {
            panic!("East's pending pass should exist");
        }

        // Incoming should be empty (2 forwarded + 1 absorbed into hand)
        let remaining_incoming = charleston
            .incoming_tiles
            .get(&Seat::East)
            .map(|tiles| tiles.len())
            .unwrap_or(0);
        assert_eq!(
            remaining_incoming, 0,
            "East's incoming_tiles should be empty after commit"
        );
    }

    // DOT_3 (not forwarded) should now be in East's hand
    assert!(
        table
            .get_player(Seat::East)
            .unwrap()
            .hand
            .concealed
            .contains(&DOT_3),
        "The non-forwarded incoming tile should be absorbed into East's hand"
    );
}

// ============================================================================
// 5.2: IOU Detection and Resolution
// ============================================================================

#[test]
#[ignore = "IOU detection may require additional logic - needs investigation"]
fn test_iou_detection_all_forward_all_incoming() {
    // When all players forward all 3 staged tiles, IOU should trigger.
    let mut table = setup_test_table();
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    let mut charleston = mahjong_core::flow::charleston::CharlestonState::new(60);
    charleston.stage = CharlestonStage::FirstLeft;

    for seat in Seat::all() {
        charleston
            .incoming_tiles
            .insert(seat, vec![BAM_1, BAM_2, BAM_3]);
    }
    table.charleston_state = Some(charleston);

    for seat in Seat::all() {
        if let Some(p) = table.get_player_mut(seat) {
            p.status = PlayerStatus::Active;
        }
    }

    let mut all_events = vec![];
    for seat in Seat::all() {
        let events = mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[],
            3, // forward all 3
        );
        all_events.extend(events);
    }

    let has_iou_detected = all_events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::IOUDetected { .. })));
    assert!(
        has_iou_detected,
        "Should emit IOUDetected event when all players forward all incoming"
    );

    let has_iou_resolved = all_events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::IOUResolved { .. })));
    assert!(has_iou_resolved, "Should emit IOUResolved event");

    let has_charleston_complete = all_events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::CharlestonComplete)));
    assert!(has_charleston_complete, "Charleston should cease on IOU");
}

#[test]
fn test_no_iou_when_some_players_have_hand_tiles() {
    // IOU should NOT trigger if some players pass from hand (forward_count < 3).
    let mut table = setup_test_table();
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    let mut charleston = mahjong_core::flow::charleston::CharlestonState::new(60);
    charleston.stage = CharlestonStage::FirstLeft;

    for seat in Seat::all() {
        charleston
            .incoming_tiles
            .insert(seat, vec![BAM_1, BAM_2, BAM_3]);
    }
    table.charleston_state = Some(charleston);

    // Give East hand tiles and set all Active
    for seat in Seat::all() {
        if let Some(p) = table.get_player_mut(seat) {
            p.status = PlayerStatus::Active;
        }
    }
    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(DOT_1);
        east.hand.add_tile(DOT_2);
        east.hand.add_tile(DOT_3);
    }

    // East passes 3 from hand (forward_incoming_count=0), absorbs all 3 incoming
    mahjong_core::table::handlers::charleston::commit_charleston_pass(
        &mut table,
        Seat::East,
        &[DOT_1, DOT_2, DOT_3],
        0,
    );

    let mut all_events = vec![];
    for seat in [Seat::South, Seat::West, Seat::North] {
        let events = mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[],
            3, // forward all 3
        );
        all_events.extend(events);
    }

    let has_iou_detected = all_events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::IOUDetected { .. })));
    assert!(
        !has_iou_detected,
        "Should NOT emit IOUDetected when some players pass from hand"
    );
}

// ============================================================================
// Integration Test: Full Charleston with Staging
// ============================================================================

#[test]
fn test_full_charleston_with_staging() {
    // Test a complete Charleston flow including blind-forward on FirstLeft.
    let mut table = setup_test_table();
    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    table.charleston_state = Some(mahjong_core::flow::charleston::CharlestonState::new(60));

    for seat in Seat::all() {
        if let Some(player) = table.get_player_mut(seat) {
            player.status = PlayerStatus::Active;
            for _ in 0..13 {
                player.hand.add_tile(BAM_1);
            }
        }
    }

    // FirstRight: all pass 3 from hand
    for seat in Seat::all() {
        mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[BAM_1, BAM_1, BAM_1],
            0,
        );
    }

    assert!(matches!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstAcross)
    ));

    // FirstAcross: absorb 3 incoming (from FirstRight), pass 3 from hand
    for seat in Seat::all() {
        mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[BAM_1, BAM_1, BAM_1],
            0,
        );
    }

    assert!(matches!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstLeft)
    ));

    // All players should have 13 tiles in hand before FirstLeft (receive-first contract).
    // US-058: ordinary FirstAcross delivered tiles directly to hand (no incoming_tiles staging).
    for seat in Seat::all() {
        let hand_count = table.get_player(seat).unwrap().hand.concealed.len();
        assert_eq!(
            hand_count, 13,
            "seat {:?} must have 13 tiles before FirstLeft blind pass (receive-first)",
            seat
        );
        if let Some(cs) = &table.charleston_state {
            let incoming = cs.incoming_tiles.get(&seat).map(|v| v.len()).unwrap_or(0);
            assert_eq!(
                incoming, 0,
                "No incoming_tiles staging before FirstLeft; tiles are already in hand"
            );
        }
    }

    // FirstLeft (blind): all 3 from hand, no forwarding of pre-existing staging.
    for seat in Seat::all() {
        mahjong_core::table::handlers::charleston::commit_charleston_pass(
            &mut table,
            seat,
            &[BAM_1, BAM_1, BAM_1],
            0,
        );
    }

    assert!(matches!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::VotingToContinue)
    ));
}
