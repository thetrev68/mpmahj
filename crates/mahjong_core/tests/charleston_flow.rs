use mahjong_core::{
    command::GameCommand,
    event::{private_events::PrivateEvent, public_events::PublicEvent, Event},
    flow::charleston::{CharlestonStage, CharlestonVote},
    flow::GamePhase,
    hand::Hand,
    player::{Player, PlayerStatus, Seat},
    table::Table,
    tile::Tile,
};

fn setup_table_in_charleston() -> Table {
    let mut table = Table::new("test".to_string(), 42);

    // Add 4 players with dummy hands (enough non-jokers to pass)
    for seat in Seat::all() {
        let mut player = Player::new(format!("player_{}", seat.index()), seat, false);
        // Give 13 tiles, none are jokers
        let tiles: Vec<Tile> = (0..13).map(Tile).collect();
        player.hand = Hand::new(tiles);
        player.status = PlayerStatus::Active;
        table.players.insert(seat, player);
    }

    // Force transition to Charleston FirstRight
    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    table.charleston_state = Some(mahjong_core::flow::charleston::CharlestonState::new(60));

    table
}

fn pass_tiles_for_all(table: &mut Table, stage: CharlestonStage) {
    assert_eq!(table.phase, GamePhase::Charleston(stage));

    // Each player passes their first 3 tiles from hand (forward_incoming_count=0).
    for seat in Seat::all() {
        // Get the player's current hand and take the first 3 non-joker tiles.
        let tiles: Vec<Tile> = if let Some(player) = table.get_player(seat) {
            player
                .hand
                .concealed
                .iter()
                .filter(|t| !t.is_joker())
                .take(3)
                .copied()
                .collect()
        } else {
            panic!("Player not found");
        };

        assert!(
            tiles.len() >= 3,
            "Player {} doesn't have 3 tiles to pass",
            seat.index()
        );

        let cmd = GameCommand::CommitCharlestonPass {
            player: seat,
            from_hand: tiles.clone(),
            forward_incoming_count: 0,
        };

        // We expect success
        let events = table.process_command(cmd).expect("Command failed");

        // Check event
        assert!(events
            .iter()
            .any(|e| matches!(e, Event::Public(PublicEvent::PlayerReadyForPass { player: p }) if *p == seat)));
    }
}

#[test]
fn test_commit_pass_emits_incremental_staged_events_before_ready() {
    let mut table = setup_table_in_charleston();

    let seat = Seat::East;
    let tiles: Vec<Tile> = table
        .get_player(seat)
        .expect("player should exist")
        .hand
        .concealed
        .iter()
        .filter(|t| !t.is_joker())
        .take(3)
        .copied()
        .collect();

    let events = table
        .process_command(GameCommand::CommitCharlestonPass {
            player: seat,
            from_hand: tiles,
            forward_incoming_count: 0,
        })
        .expect("pass should succeed");

    let staged_counts: Vec<u8> = events
        .iter()
        .filter_map(|event| match event {
            Event::Public(PublicEvent::PlayerStagedTile { player, count }) if *player == seat => {
                Some(*count)
            }
            _ => None,
        })
        .collect();

    assert_eq!(staged_counts, vec![1, 2, 3]);

    let ready_index = events
        .iter()
        .position(|event| {
            matches!(
                event,
                Event::Public(PublicEvent::PlayerReadyForPass { player }) if *player == seat
            )
        })
        .expect("ready event should be emitted");
    let last_staged_index = events
        .iter()
        .rposition(|event| {
            matches!(
                event,
                Event::Public(PublicEvent::PlayerStagedTile { player, count })
                if *player == seat && *count == 3
            )
        })
        .expect("staged count=3 should be emitted");

    assert!(last_staged_index < ready_index);
}

#[test]
fn test_charleston_first_sequence() {
    let mut table = setup_table_in_charleston();

    // 1. First Right
    pass_tiles_for_all(&mut table, CharlestonStage::FirstRight);

    // Should now be FirstAcross
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstAcross)
    );

    // 2. First Across
    pass_tiles_for_all(&mut table, CharlestonStage::FirstAcross);

    // Should now be FirstLeft
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstLeft)
    );

    // 3. First Left
    pass_tiles_for_all(&mut table, CharlestonStage::FirstLeft);

    // Should now be VotingToContinue
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::VotingToContinue)
    );
}

#[test]
fn test_charleston_voting_continue() {
    let mut table = setup_table_in_charleston();

    // Fast forward to voting
    table.phase = GamePhase::Charleston(CharlestonStage::VotingToContinue);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::VotingToContinue;
    }

    // All players vote continue
    for seat in Seat::all() {
        let cmd = GameCommand::VoteCharleston {
            player: seat,
            vote: CharlestonVote::Continue,
        };
        let _ = table.process_command(cmd).unwrap();
    }

    // Should transition to SecondLeft
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::SecondLeft)
    );
}

#[test]
fn test_charleston_voting_stop() {
    let mut table = setup_table_in_charleston();

    // Fast forward to voting
    table.phase = GamePhase::Charleston(CharlestonStage::VotingToContinue);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::VotingToContinue;
    }

    // 3 vote continue, 1 votes stop
    let votes = [
        (Seat::East, CharlestonVote::Continue),
        (Seat::South, CharlestonVote::Continue),
        (Seat::West, CharlestonVote::Stop),
        (Seat::North, CharlestonVote::Continue),
    ];

    for (seat, vote) in votes {
        let cmd = GameCommand::VoteCharleston { player: seat, vote };
        let _ = table.process_command(cmd).unwrap();
    }

    // Should transition to CourtesyAcross
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::CourtesyAcross)
    );
}

#[test]
fn test_second_charleston_sequence() {
    let mut table = setup_table_in_charleston();

    // Start at SecondLeft
    table.phase = GamePhase::Charleston(CharlestonStage::SecondLeft);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::SecondLeft;
    }

    // 1. Second Left
    pass_tiles_for_all(&mut table, CharlestonStage::SecondLeft);
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::SecondAcross)
    );

    // 2. Second Across
    pass_tiles_for_all(&mut table, CharlestonStage::SecondAcross);
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::SecondRight)
    );

    // 3. Second Right
    pass_tiles_for_all(&mut table, CharlestonStage::SecondRight);
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::CourtesyAcross)
    );
}

#[test]
fn test_courtesy_pass_flow() {
    let mut table = setup_table_in_charleston();

    // Start at CourtesyAcross
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    // Step 1: All players propose (1 tile each)
    for seat in Seat::all() {
        let cmd = GameCommand::ProposeCourtesyPass {
            player: seat,
            tile_count: 1,
        };
        table.process_command(cmd).unwrap();
    }

    // Step 2: All players submit tiles
    for seat in Seat::all() {
        let tiles = vec![Tile(0)]; // 1 tile
        let cmd = GameCommand::AcceptCourtesyPass {
            player: seat,
            tiles,
        };
        let events = table.process_command(cmd).unwrap();

        assert!(events
            .iter()
            .any(|e| matches!(e, Event::Public(PublicEvent::PlayerReadyForPass { .. }))));
    }

    // Should be Playing(Discarding { East }) after CharlestonComplete.
    if let GamePhase::Playing(mahjong_core::flow::playing::TurnStage::Discarding { player }) =
        table.phase
    {
        assert_eq!(player, Seat::East);
    } else {
        panic!("Expected Playing phase, got {:?}", table.phase);
    }
}

// ============================================================================
// Staging semantics: incoming tiles staged, not applied directly to hand
// ============================================================================

#[test]
fn test_ordinary_pass_emits_tiles_received_not_staged() {
    // US-058 AC-1/AC-2: FirstRight (ordinary stage) must emit TilesReceived,
    // not IncomingTilesStaged. Tiles go directly into the recipient's hand.
    let mut table = setup_table_in_charleston();

    let mut received_events: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut staged_events: Vec<(Seat, Vec<Tile>)> = Vec::new();

    for seat in Seat::all() {
        let tiles: Vec<Tile> = table
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();

        let events = table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .expect("pass should succeed");

        for e in &events {
            match e {
                Event::Private(PrivateEvent::TilesReceived { player, tiles, .. }) => {
                    received_events.push((*player, tiles.clone()));
                }
                Event::Private(PrivateEvent::IncomingTilesStaged { player, tiles, .. }) => {
                    staged_events.push((*player, tiles.clone()));
                }
                _ => {}
            }
        }
    }

    // Ordinary stage: 4 TilesReceived (one per player), zero IncomingTilesStaged.
    assert_eq!(
        received_events.len(),
        4,
        "Expected 4 TilesReceived events for ordinary FirstRight pass"
    );
    assert_eq!(
        staged_events.len(),
        0,
        "Expected zero IncomingTilesStaged events for ordinary FirstRight pass"
    );
    for (_, tiles) in &received_events {
        assert_eq!(
            tiles.len(),
            3,
            "Each TilesReceived event should carry 3 tiles"
        );
    }
}

#[test]
fn test_first_across_to_first_left_receive_first() {
    // US-058 AC-1: After FirstAcross, tiles arrive as TilesReceived (not IncomingTilesStaged).
    // Hand count returns to 13 before FirstLeft (blind pass) begins.
    let mut table = setup_table_in_charleston();

    // Complete FirstRight so we can move to FirstAcross.
    for seat in Seat::all() {
        let tiles: Vec<Tile> = table
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
    }

    // After FirstRight (ordinary): hand = 13, no staging.
    for seat in Seat::all() {
        let hand_count = table.get_player(seat).unwrap().hand.concealed.len();
        assert_eq!(
            hand_count, 13,
            "seat {:?} should have 13 tiles after ordinary FirstRight pass",
            seat
        );
        let incoming_count = table
            .charleston_state
            .as_ref()
            .unwrap()
            .incoming_tiles
            .get(&seat)
            .map(|v| v.len())
            .unwrap_or(0);
        assert_eq!(
            incoming_count, 0,
            "seat {:?} should have 0 staged incoming after ordinary pass",
            seat
        );
    }

    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstAcross)
    );

    // Complete FirstAcross — collect TilesReceived events, ensure no IncomingTilesStaged.
    let mut received_events: Vec<(Seat, Vec<Tile>)> = Vec::new();
    let mut staged_events: Vec<(Seat, Vec<Tile>)> = Vec::new();

    for seat in Seat::all() {
        let tiles: Vec<Tile> = table
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        let events = table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
        for e in &events {
            match e {
                Event::Private(PrivateEvent::TilesReceived { player, tiles, .. }) => {
                    received_events.push((*player, tiles.clone()));
                }
                Event::Private(PrivateEvent::IncomingTilesStaged { player, tiles, .. }) => {
                    staged_events.push((*player, tiles.clone()));
                }
                _ => {}
            }
        }
    }

    assert_eq!(
        staged_events.len(),
        0,
        "FirstAcross (ordinary) must emit zero IncomingTilesStaged events"
    );
    assert_eq!(
        received_events.len(),
        4,
        "FirstAcross must emit TilesReceived for all 4 players"
    );

    // Stage should now be FirstLeft.
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::FirstLeft)
    );

    // All hands back to 13 before blind pass begins (AC-3 invariant).
    for seat in Seat::all() {
        let hand_count = table.get_player(seat).unwrap().hand.concealed.len();
        assert_eq!(
            hand_count, 13,
            "seat {:?} must have 13 tiles at the start of FirstLeft blind pass",
            seat
        );
    }
}

#[test]
fn test_second_across_to_second_right_receive_first() {
    // US-058 AC-2: After SecondAcross, tiles arrive as TilesReceived (not IncomingTilesStaged).
    // Hand count returns to 13 before SecondRight (blind pass) begins.
    let mut table = setup_table_in_charleston();

    // Jump straight to SecondAcross with fresh hands.
    table.phase = GamePhase::Charleston(CharlestonStage::SecondAcross);
    if let Some(cs) = &mut table.charleston_state {
        cs.stage = CharlestonStage::SecondAcross;
    }

    let mut staged_events: usize = 0;
    let mut received_events: usize = 0;

    for seat in Seat::all() {
        let tiles: Vec<Tile> = table
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        let events = table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
        for e in &events {
            match e {
                Event::Private(PrivateEvent::TilesReceived { .. }) => received_events += 1,
                Event::Private(PrivateEvent::IncomingTilesStaged { .. }) => staged_events += 1,
                _ => {}
            }
        }
    }

    assert_eq!(
        staged_events, 0,
        "SecondAcross (ordinary) must emit zero IncomingTilesStaged"
    );
    assert_eq!(
        received_events, 4,
        "SecondAcross must emit TilesReceived for all 4 players"
    );
    assert_eq!(
        table.phase,
        GamePhase::Charleston(CharlestonStage::SecondRight)
    );

    for seat in Seat::all() {
        let hand_count = table.get_player(seat).unwrap().hand.concealed.len();
        assert_eq!(
            hand_count, 13,
            "seat {:?} must have 13 tiles at the start of SecondRight",
            seat
        );
    }
}

#[test]
fn test_blind_stage_incoming_staged_has_null_from() {
    // US-058 AC-4 / EC-2: Blind-stage IncomingTilesStaged events must carry from: None.
    // A non-null from on a blind-stage event is a violation.
    let mut table = setup_table_in_charleston();

    // Jump to FirstLeft, pre-populate incoming tiles.
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    if let Some(cs) = &mut table.charleston_state {
        cs.stage = CharlestonStage::FirstLeft;
        for seat in Seat::all() {
            cs.incoming_tiles
                .insert(seat, vec![Tile(20), Tile(21), Tile(22)]);
            cs.pending_passes.insert(seat, None);
        }
    }

    // But we actually need to drive through a complete FirstAcross→FirstLeft
    // transition so the server generates the IncomingTilesStaged events.
    // Reset to FirstAcross and run properly.
    let mut table2 = setup_table_in_charleston();
    // Complete FirstRight first.
    for seat in Seat::all() {
        let tiles: Vec<Tile> = table2
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        table2
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
    }
    // Now complete FirstAcross → triggers FirstLeft blind staging.
    let mut blind_staged_events: Vec<Event> = Vec::new();
    for seat in Seat::all() {
        let tiles: Vec<Tile> = table2
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        let events = table2
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
        for e in events {
            if matches!(e, Event::Private(PrivateEvent::IncomingTilesStaged { .. })) {
                blind_staged_events.push(e);
            }
        }
    }

    // FirstAcross is ordinary → no blind staging events from it.
    // Now we're at FirstLeft. Commit FirstLeft to trigger IncomingTilesStaged.
    let mut first_left_staged: Vec<Event> = Vec::new();
    for seat in Seat::all() {
        let tiles: Vec<Tile> = table2
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();
        let events = table2
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: tiles,
                forward_incoming_count: 0,
            })
            .unwrap();
        for e in events {
            if matches!(e, Event::Private(PrivateEvent::IncomingTilesStaged { .. })) {
                first_left_staged.push(e);
            }
        }
    }

    assert_eq!(
        first_left_staged.len(),
        4,
        "Expected 4 IncomingTilesStaged events from FirstLeft blind pass"
    );

    for event in &first_left_staged {
        if let Event::Private(PrivateEvent::IncomingTilesStaged { from, .. }) = event {
            assert!(
                from.is_none(),
                "EC-2: blind-stage IncomingTilesStaged must have from: None, got Some({:?})",
                from
            );
        }
    }
}

#[test]
fn test_forward_incoming_count_forwarded_not_absorbed() {
    let mut table = setup_table_in_charleston();

    // Manually inject incoming tiles for East in FirstLeft
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    if let Some(cs) = &mut table.charleston_state {
        cs.stage = CharlestonStage::FirstLeft;
        cs.incoming_tiles.insert(
            Seat::East,
            vec![Tile(20), Tile(21), Tile(22)], // 3 staged incoming
        );
        cs.pending_passes.insert(Seat::East, None);
    }

    // East passes: 1 from hand, 2 forwarded from incoming
    let east_hand_before: Vec<Tile> = table
        .get_player(Seat::East)
        .unwrap()
        .hand
        .concealed
        .iter()
        .take(1)
        .copied()
        .collect();

    let result = table.process_command(GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: east_hand_before.clone(),
        forward_incoming_count: 2,
    });

    assert!(result.is_ok(), "CommitCharlestonPass should succeed");

    // East's incoming_tiles should now be empty: 2 forwarded + 1 absorbed into hand
    let east_incoming = table
        .charleston_state
        .as_ref()
        .unwrap()
        .incoming_tiles
        .get(&Seat::East)
        .map(|v| v.len())
        .unwrap_or(0);
    assert_eq!(east_incoming, 0);

    // East's pass bundle should be [east_hand_tile, Tile(20), Tile(21)]
    let pass_bundle = table
        .charleston_state
        .as_ref()
        .unwrap()
        .pending_passes
        .get(&Seat::East)
        .and_then(|p| p.as_ref())
        .cloned()
        .unwrap();
    assert_eq!(pass_bundle.len(), 3);
    assert!(pass_bundle.contains(&east_hand_before[0]));
    assert!(pass_bundle.contains(&Tile(20)));
    assert!(pass_bundle.contains(&Tile(21)));
    // Tile(22) should NOT be in the bundle (it was absorbed into hand)
    assert!(!pass_bundle.contains(&Tile(22)));

    // Tile(22) should now be in East's hand
    assert!(table
        .get_player(Seat::East)
        .unwrap()
        .hand
        .concealed
        .contains(&Tile(22)));
}

// ============================================================================
// Validation: new invariants
// ============================================================================

#[test]
fn test_forward_incoming_exceeds_available_rejected() {
    let mut table = setup_table_in_charleston();

    // Inject 1 incoming tile for East in FirstLeft
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    if let Some(cs) = &mut table.charleston_state {
        cs.stage = CharlestonStage::FirstLeft;
        cs.incoming_tiles.insert(Seat::East, vec![Tile(20)]);
        cs.pending_passes.insert(Seat::East, None);
    }

    // forward_incoming_count=2 with only 1 available — EC-1.
    // from_hand has 1 tile so total = 1 + 2 = 3 (valid count), but EC-1 fires first.
    let result = table.process_command(GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0)],  // 1 from hand
        forward_incoming_count: 2, // 2 forwarded: total 3, but only 1 incoming available
    });

    assert!(
        matches!(
            result,
            Err(mahjong_core::table::CommandError::InvalidCommand(_))
        ),
        "Expected InvalidCommand, got {:?}",
        result
    );
}

#[test]
fn test_duplicate_commit_returns_already_submitted() {
    let mut table = setup_table_in_charleston();

    let cmd = GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0), Tile(1), Tile(2)],
        forward_incoming_count: 0,
    };

    // First submit: succeeds
    let result = table.process_command(cmd.clone());
    assert!(result.is_ok());

    // Second submit (duplicate): AlreadySubmitted — EC-2
    let result = table.process_command(cmd);
    assert!(matches!(
        result,
        Err(mahjong_core::table::CommandError::AlreadySubmitted)
    ));
}

#[test]
fn test_commit_with_invalid_tile_returns_tile_not_in_hand() {
    let mut table = setup_table_in_charleston();

    // Tile(40) not in any player's hand (hands have tiles 0-12)
    let cmd = GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0), Tile(1), Tile(40)],
        forward_incoming_count: 0,
    };

    let result = table.process_command(cmd);
    assert!(matches!(
        result,
        Err(mahjong_core::table::CommandError::TileNotInHand)
    ));
}

#[test]
fn test_commit_invalid_count_returns_invalid_pass_count() {
    let mut table = setup_table_in_charleston();

    // 2 from hand + 0 forwarded = 2, not 3
    let cmd = GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0), Tile(1)],
        forward_incoming_count: 0,
    };

    let result = table.process_command(cmd);
    assert!(matches!(
        result,
        Err(mahjong_core::table::CommandError::InvalidPassCount)
    ));
}

#[test]
fn test_commit_with_joker_in_from_hand_rejected() {
    use mahjong_core::tile::tiles::JOKER;

    let mut table = setup_table_in_charleston();

    // Give East a Joker
    if let Some(p) = table.get_player_mut(Seat::East) {
        p.hand.add_tile(JOKER);
    }

    let cmd = GameCommand::CommitCharlestonPass {
        player: Seat::East,
        from_hand: vec![Tile(0), Tile(1), JOKER],
        forward_incoming_count: 0,
    };

    let result = table.process_command(cmd);
    assert!(matches!(
        result,
        Err(mahjong_core::table::CommandError::ContainsJokers)
    ));
}

#[test]
fn test_normal_commit_succeeds_for_each_player() {
    let mut table = setup_table_in_charleston();

    // All 4 players commit with 3 from hand — all succeed
    for seat in Seat::all() {
        let tiles: Vec<Tile> = table
            .get_player(seat)
            .unwrap()
            .hand
            .concealed
            .iter()
            .filter(|t| !t.is_joker())
            .take(3)
            .copied()
            .collect();

        let cmd = GameCommand::CommitCharlestonPass {
            player: seat,
            from_hand: tiles,
            forward_incoming_count: 0,
        };

        let result = table.process_command(cmd);
        assert!(result.is_ok(), "Pass failed for seat {:?}", seat);
    }
}

#[test]
fn test_courtesy_pass_negotiation_flow() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    // East proposes 2 tiles
    let events = table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 2,
        })
        .unwrap();

    assert!(events.iter().any(|e| matches!(
        e,
        Event::Private(PrivateEvent::CourtesyPassProposed { player, tile_count })
        if *player == Seat::East && *tile_count == 2
    )));

    // West proposes 3 tiles (mismatch!)
    let events = table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::West,
            tile_count: 3,
        })
        .unwrap();

    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Private(PrivateEvent::CourtesyPassProposed { .. }))));
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Private(PrivateEvent::CourtesyPassMismatch { pair, proposed, agreed_count })
        if *pair == (Seat::East, Seat::West) && *proposed == (2, 3) && *agreed_count == 2
    )));
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Private(PrivateEvent::CourtesyPairReady { pair, tile_count })
        if *pair == (Seat::East, Seat::West) && *tile_count == 2
    )));
}

#[test]
fn test_courtesy_pass_mismatch_smallest_wins() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::North,
            tile_count: 3,
        })
        .unwrap();

    let events = table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::South,
            tile_count: 1,
        })
        .unwrap();

    assert!(events.iter().any(|e| matches!(
        e,
        Event::Private(PrivateEvent::CourtesyPairReady { pair: _, tile_count })
        if *tile_count == 1
    )));
}

#[test]
fn test_courtesy_pass_zero_blocks() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 0,
        })
        .unwrap();

    let events = table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::West,
            tile_count: 3,
        })
        .unwrap();

    assert!(events.iter().any(|e| matches!(
        e,
        Event::Private(PrivateEvent::CourtesyPairReady { tile_count, .. })
        if *tile_count == 0
    )));
}

#[test]
fn test_courtesy_pass_pairs_independent() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 2,
        })
        .unwrap();
    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::West,
            tile_count: 2,
        })
        .unwrap();
    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::North,
            tile_count: 0,
        })
        .unwrap();
    let events = table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::South,
            tile_count: 0,
        })
        .unwrap();

    let pair_ready_events: Vec<_> = events
        .iter()
        .filter(|e| matches!(e, Event::Private(PrivateEvent::CourtesyPairReady { .. })))
        .collect();
    assert_eq!(pair_ready_events.len(), 1);

    let east_tiles = vec![Tile(0), Tile(1)];
    table
        .process_command(GameCommand::AcceptCourtesyPass {
            player: Seat::East,
            tiles: east_tiles.clone(),
        })
        .unwrap();

    let west_tiles = vec![Tile(2), Tile(3)];
    table
        .process_command(GameCommand::AcceptCourtesyPass {
            player: Seat::West,
            tiles: west_tiles.clone(),
        })
        .unwrap();

    table
        .process_command(GameCommand::AcceptCourtesyPass {
            player: Seat::North,
            tiles: vec![],
        })
        .unwrap();

    let events = table
        .process_command(GameCommand::AcceptCourtesyPass {
            player: Seat::South,
            tiles: vec![],
        })
        .unwrap();

    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::CourtesyPassComplete))));
    assert!(matches!(table.phase, GamePhase::Playing(_)));
}

#[test]
fn test_courtesy_pass_validation_rejects_without_proposal() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    let result = table.process_command(GameCommand::AcceptCourtesyPass {
        player: Seat::East,
        tiles: vec![Tile(0)],
    });

    assert!(result.is_err());
}

#[test]
fn test_courtesy_pass_validation_rejects_mismatched_count() {
    let mut table = setup_table_in_charleston();
    table.phase = GamePhase::Charleston(CharlestonStage::CourtesyAcross);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::CourtesyAcross;
    }

    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 2,
        })
        .unwrap();
    table
        .process_command(GameCommand::ProposeCourtesyPass {
            player: Seat::West,
            tile_count: 2,
        })
        .unwrap();

    let result = table.process_command(GameCommand::AcceptCourtesyPass {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1), Tile(2)],
    });

    assert!(result.is_err());
}

// ============================================================================
// IOU scenario: all forward all 3 incoming
// ============================================================================

#[test]
fn test_iou_scenario_all_forward_all_incoming() {
    let mut table = setup_table_in_charleston();

    // Set up a blind pass stage (FirstLeft) with 3 incoming tiles per player.
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    if let Some(cs) = &mut table.charleston_state {
        cs.stage = CharlestonStage::FirstLeft;
        for seat in Seat::all() {
            cs.incoming_tiles
                .insert(seat, vec![Tile(20), Tile(21), Tile(22)]);
            cs.pending_passes.insert(seat, None);
        }
    }

    let mut iou_detected = false;

    // All players forward all 3 incoming (nothing from hand).
    for seat in Seat::all() {
        let events = table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: vec![],
                forward_incoming_count: 3,
            })
            .expect("IOU pass should succeed");

        if events
            .iter()
            .any(|e| matches!(e, Event::Public(PublicEvent::IOUDetected { .. })))
        {
            iou_detected = true;
        }
    }

    assert!(iou_detected, "IOUDetected event should have been emitted");

    // Charleston should have ended — tile counts should be valid.
    for seat in Seat::all() {
        let hand_len = table.get_player(seat).unwrap().hand.concealed.len();
        // Each player started with 13, passed 0 from hand, got 3 back via IOU return.
        // Tiles 20,21,22 are returned to each owner. Since all forwarded all 3,
        // each player's pending_pass bundle (their own tiles 20,21,22) is returned.
        assert!(
            hand_len >= 13,
            "seat {:?} should have at least 13 tiles after IOU resolution, got {}",
            seat,
            hand_len
        );
    }
}
