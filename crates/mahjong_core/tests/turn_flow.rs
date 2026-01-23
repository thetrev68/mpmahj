use mahjong_core::{
    call_resolution::CallIntentKind,
    command::GameCommand,
    event::{public_events::PublicEvent, Event},
    flow::playing::TurnStage,
    flow::GamePhase,
    hand::Hand,
    meld::{Meld, MeldType},
    player::{Player, PlayerStatus, Seat},
    table::{CommandError, Table},
    tile::Tile,
};

fn setup_table_playing() -> Table {
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

#[test]
fn test_standard_turn_flow() {
    let mut table = setup_table_playing();

    // 1. East Discards
    let tile_to_discard = Tile(13);
    let cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: tile_to_discard,
    };
    let events = table.process_command(cmd).unwrap();

    // Should verify events and phase change
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::CallWindowOpened { .. }))));

    // 2. Everyone passes
    let passers = vec![Seat::South, Seat::West, Seat::North];
    for seat in passers {
        let cmd = GameCommand::Pass { player: seat };
        let _ = table.process_command(cmd).unwrap();
    }

    // Should now be South's turn to Draw
    if let GamePhase::Playing(TurnStage::Drawing { player }) = table.phase {
        assert_eq!(player, Seat::South);
    } else {
        panic!("Expected South Drawing phase");
    }

    // 3. South Draws
    let cmd = GameCommand::DrawTile {
        player: Seat::South,
    };
    let _ = table.process_command(cmd).unwrap();

    // Should now be South's turn to Discard
    if let GamePhase::Playing(TurnStage::Discarding { player }) = table.phase {
        assert_eq!(player, Seat::South);
    } else {
        panic!("Expected South Discarding phase");
    }
}

#[test]
fn test_call_sequence() {
    let mut table = setup_table_playing();

    // Setup South to have a pair of BAM_1 (let's say Tile(0))
    // Tile(0) is BAM_1 in our convention usually, or we can use constants
    let target_tile = Tile(0);

    if let Some(p) = table.players.get_mut(&Seat::South) {
        // Ensure he has 2 of them
        p.hand = Hand::new(vec![
            target_tile,
            target_tile,
            Tile(10),
            Tile(11),
            Tile(12),
            Tile(13),
            Tile(14),
            Tile(15),
            Tile(16),
            Tile(17),
            Tile(18),
            Tile(19),
            Tile(20),
        ]);
    }

    // 1. East Discards BAM_1
    // Give East BAM_1 first
    if let Some(p) = table.players.get_mut(&Seat::East) {
        p.hand.add_tile(target_tile);
    }

    let cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: target_tile,
    };
    let _ = table.process_command(cmd).unwrap();

    // 2. South Calls Pung (others pass first)
    // West and North pass
    let _ = table
        .process_command(GameCommand::Pass { player: Seat::West })
        .unwrap();
    let _ = table
        .process_command(GameCommand::Pass {
            player: Seat::North,
        })
        .unwrap();

    // South has 2, East discarded 1 -> Makes 3
    let meld = Meld::new(
        MeldType::Pung,
        vec![target_tile, target_tile, target_tile],
        Some(target_tile),
    )
    .unwrap();

    // South declares intent - this will resolve immediately since all others have passed
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::South,
        intent: CallIntentKind::Meld(meld.clone()),
    };

    let events = table.process_command(cmd).unwrap();

    // Verify call event
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::TileCalled { player, .. }) if *player == Seat::South)));

    // Should now be South Discarding (skips Drawing)
    if let GamePhase::Playing(TurnStage::Discarding { player }) = table.phase {
        assert_eq!(player, Seat::South);
    } else {
        panic!("Expected South Discarding after call");
    }

    // Verify South has exposed meld
    let south = table.players.get(&Seat::South).unwrap();
    assert_eq!(south.hand.exposed.len(), 1);
    assert_eq!(south.hand.exposed[0], meld);
}

#[test]
fn test_cannot_call_own_discard() {
    let mut table = setup_table_playing();
    let tile = Tile(0);

    // Give East the tile
    if let Some(p) = table.players.get_mut(&Seat::East) {
        // Need pairs to call pung, even if it's own (logic check)
        // But rule is: can't call own discard.
        p.hand.add_tile(tile);
        p.hand.add_tile(tile);
        p.hand.add_tile(tile);
    }

    // East discards
    let _ = table.process_command(GameCommand::DiscardTile {
        player: Seat::East,
        tile,
    });

    // East tries to call it
    let meld = Meld::new(MeldType::Pung, vec![tile, tile, tile], Some(tile)).unwrap();
    let cmd = GameCommand::DeclareCallIntent {
        player: Seat::East,
        intent: CallIntentKind::Meld(meld),
    };

    let res = table.process_command(cmd);
    assert_eq!(res.unwrap_err(), CommandError::CannotCallOwnDiscard);
}

#[test]
fn test_self_draw_win() {
    let mut table = setup_table_playing();

    // East draws a tile
    // Wait, phase is Discarding first.
    // Let's pretend East just drew and is now in Discarding phase.

    // We don't have pattern validation enabled in this minimal test context
    // TODO: Add validation for DeclareMahjong command (currently auto-accepts)

    let cmd = GameCommand::DeclareMahjong {
        player: Seat::East,
        hand: table.players.get(&Seat::East).unwrap().hand.clone(),
        winning_tile: None, // Self draw
    };

    let events = table.process_command(cmd).unwrap();

    // Verify Game Over
    assert!(events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::GameOver { .. }))));
    assert!(matches!(table.phase, GamePhase::GameOver(_)));
}

#[test]
fn test_called_win() {
    let mut table = setup_table_playing();
    let tile = Tile(0);

    // East Discards
    if let Some(p) = table.players.get_mut(&Seat::East) {
        p.hand.add_tile(tile);
    }
    let _ = table.process_command(GameCommand::DiscardTile {
        player: Seat::East,
        tile,
    });

    // South declares Mahjong intent on that tile
    table
        .process_command(GameCommand::DeclareCallIntent {
            player: Seat::South,
            intent: CallIntentKind::Mahjong,
        })
        .unwrap();
    table
        .process_command(GameCommand::Pass { player: Seat::West })
        .unwrap();
    table
        .process_command(GameCommand::Pass {
            player: Seat::North,
        })
        .unwrap();

    // South completes DeclareMahjong after AwaitingMahjong
    let winning_hand = table.players.get(&Seat::South).unwrap().hand.clone();

    let cmd = GameCommand::DeclareMahjong {
        player: Seat::South,
        hand: winning_hand,
        winning_tile: Some(tile),
    };

    let events = table.process_command(cmd).unwrap();

    assert!(events.iter().any(|e| matches!(
        e,
        Event::Public(PublicEvent::GameOver {
            winner: Some(Seat::South),
            ..
        })
    )));
}
