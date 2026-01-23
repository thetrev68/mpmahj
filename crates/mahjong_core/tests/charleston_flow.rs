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

    // Each player passes their first 3 tiles (whatever they currently have)
    for seat in Seat::all() {
        // Get the player's current hand and take the first 3 non-joker tiles
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

        let cmd = GameCommand::PassTiles {
            player: seat,
            tiles: tiles.clone(),
            blind_pass_count: None,
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

    // Should be Complete now
    // Wait, the state machine actually transitions to Playing immediately after CharlestonComplete
    // But the event CharlestonComplete is emitted first.
    // Let's check table.phase. It should be Playing(TurnStage::Discarding { player: East })
    // because transition_phase(CharlestonComplete) is called automatically.

    // In table.rs: apply_accept_courtesy_pass calls transition_phase(CharlestonComplete)
    // which transitions GamePhase::Charleston -> GamePhase::Playing

    if let GamePhase::Playing(mahjong_core::flow::playing::TurnStage::Discarding { player }) =
        table.phase
    {
        assert_eq!(player, Seat::East);
    } else {
        panic!("Expected Playing phase, got {:?}", table.phase);
    }
}

#[test]
fn test_blind_pass_rules() {
    let mut table = setup_table_in_charleston();

    // FirstRight: No blind pass
    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::FirstRight;
    }

    let cmd = GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1)],
        blind_pass_count: Some(1),
    };
    let res = table.process_command(cmd);
    assert!(matches!(
        res,
        Err(mahjong_core::table::CommandError::BlindPassNotAllowed)
    ));

    // FirstLeft: Blind pass ALLOWED
    table.phase = GamePhase::Charleston(CharlestonStage::FirstLeft);
    if let Some(state) = &mut table.charleston_state {
        state.stage = CharlestonStage::FirstLeft;
        state
            .incoming_tiles
            .insert(Seat::East, vec![Tile(2)]);
    }

    // Reset player readiness
    if let Some(state) = &mut table.charleston_state {
        state.pending_passes.insert(Seat::East, None);
    }

    let cmd = GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1)],
        blind_pass_count: Some(1),
    };
    let res = table.process_command(cmd);
    assert!(res.is_ok());
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

    // Should emit proposal, mismatch (agreed=2), and pair ready
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

    // North proposes 3, South proposes 1
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

    // Agreed count should be 1 (smallest)
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

    // East proposes 0 (blocking), West proposes 3
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

    // Agreed count should be 0
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

    // East/West pair proposes and agrees on 2
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

    // North/South pair proposes and agrees on 0
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

    // Should have two separate PairReady events (South triggers the second pair)
    let pair_ready_events: Vec<_> = events
        .iter()
        .filter(|e| matches!(e, Event::Private(PrivateEvent::CourtesyPairReady { .. })))
        .collect();
    assert_eq!(pair_ready_events.len(), 1); // Only South triggers the second pair

    // Now submit tiles - East/West should exchange 2 each, North/South should exchange 0
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

    // North/South pass 0 tiles
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

    // Should transition to Playing
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

    // Try to accept without proposing first
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

    // Propose 2, but try to submit 3
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

    // Try to submit 3 tiles when agreed count is 2
    let result = table.process_command(GameCommand::AcceptCourtesyPass {
        player: Seat::East,
        tiles: vec![Tile(0), Tile(1), Tile(2)],
    });

    assert!(result.is_err());
}
