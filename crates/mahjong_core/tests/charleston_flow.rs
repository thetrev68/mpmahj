use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    flow::{CharlestonStage, CharlestonVote, GamePhase},
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
    table.charleston_state = Some(mahjong_core::flow::CharlestonState::new());

    table
}

fn pass_tiles_for_all(table: &mut Table, stage: CharlestonStage) {
    assert_eq!(table.phase, GamePhase::Charleston(stage));

    // Each player passes 3 tiles (indices 0, 1, 2)
    for seat in Seat::all() {
        let tiles = vec![Tile(0), Tile(1), Tile(2)];

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
            .any(|e| matches!(e, GameEvent::PlayerReadyForPass { player: p } if *p == seat)));
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

    // Players agree to pass 0-3 tiles. For MVP, we just accept whatever they send.
    // Let's have everyone pass 1 tile.
    for seat in Seat::all() {
        let tiles = vec![Tile(0)]; // 1 tile
        let cmd = GameCommand::AcceptCourtesyPass {
            player: seat,
            tiles,
        };
        let events = table.process_command(cmd).unwrap();

        assert!(events
            .iter()
            .any(|e| matches!(e, GameEvent::PlayerReadyForPass { .. })));
    }

    // Should be Complete now
    // Wait, the state machine actually transitions to Playing immediately after CharlestonComplete
    // But the event CharlestonComplete is emitted first.
    // Let's check table.phase. It should be Playing(TurnStage::Discarding { player: East })
    // because transition_phase(CharlestonComplete) is called automatically.

    // In table.rs: apply_accept_courtesy_pass calls transition_phase(CharlestonComplete)
    // which transitions GamePhase::Charleston -> GamePhase::Playing

    if let GamePhase::Playing(mahjong_core::flow::TurnStage::Discarding { player }) = table.phase {
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
