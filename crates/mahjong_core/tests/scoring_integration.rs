//! Integration tests for scoring and settlement (Phase 0.2).
//!
//! Tests the complete scoring flow including:
//! - Self-draw vs called discard scoring
//! - Concealed hand bonuses
//! - Dealer bonuses
//! - Dealer rotation on wins and draws
//! - Wall exhaustion handling

use mahjong_core::{
    call_resolution::CallIntentKind,
    command::GameCommand,
    event::{public_events::PublicEvent, Event},
    flow::outcomes::GameEndCondition,
    flow::playing::TurnStage,
    flow::GamePhase,
    hand::Hand,
    player::{Player, PlayerStatus, Seat},
    table::Table,
    tile::{tiles, Tile},
};

/// Helper to set up a table in playing phase ready for scoring tests
fn setup_table_in_playing_phase() -> Table {
    let mut table = Table::new("test-scoring".to_string(), 42);

    // Add 4 players with hands
    for seat in Seat::all() {
        let mut player = Player::new(format!("player_{:?}", seat), seat, false);
        // Give each player 13 tiles
        let tiles: Vec<Tile> = (0..13).map(Tile).collect();
        player.hand = Hand::new(tiles);
        player.status = PlayerStatus::Active;
        table.players.insert(seat, player);
    }

    // Force transition to Playing phase (East's turn to discard)
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });
    table.current_turn = Seat::East;
    table.dealer = Seat::East;

    table
}

#[test]
fn test_self_draw_scoring_structure() {
    let mut table = setup_table_in_playing_phase();

    // East (dealer) declares self-draw mahjong
    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(Tile(13));
    }
    let winning_hand = table.get_player(Seat::East).unwrap().hand.clone();

    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::East,
            hand: winning_hand,
            winning_tile: None, // Self-draw
        })
        .unwrap();

    // Find the GameOver event
    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .expect("GameOver event should be emitted");

    // Verify winner
    assert_eq!(game_over.winner, Some(Seat::East));
    assert_eq!(game_over.end_condition, GameEndCondition::Win);

    // Verify score breakdown exists
    let score = game_over.score_breakdown.as_ref().unwrap();
    assert!(score.base_score > 0);

    // Self-draw means all other players pay
    assert_eq!(score.payments.len(), 3);
    for &seat in &[Seat::South, Seat::West, Seat::North] {
        assert!(score.payments.contains_key(&seat));
        assert!(*score.payments.get(&seat).unwrap() > 0);
    }

    // Dealer won, so dealer should retain seat
    assert_eq!(game_over.next_dealer, Seat::East);
}

#[test]
fn test_called_discard_scoring_structure() {
    let mut table = setup_table_in_playing_phase();

    // East discards
    table
        .process_command(GameCommand::DiscardTile {
            player: Seat::East,
            tile: tiles::BAM_1,
        })
        .unwrap();

    if let GamePhase::Playing(TurnStage::CallWindow { .. }) = &table.phase {
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
    } else {
        panic!("Table should be in CallWindow phase after discard");
    }

    let winning_hand = table.get_player(Seat::South).unwrap().hand.clone();
    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::South,
            hand: winning_hand,
            winning_tile: Some(tiles::BAM_1), // Called discard
        })
        .unwrap();

    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .expect("GameOver event should be emitted");

    assert_eq!(game_over.winner, Some(Seat::South));

    // Winner is not dealer, so dealer rotates
    assert_eq!(game_over.next_dealer, Seat::South);
}

#[test]
fn test_wall_exhausted_draw() {
    let mut table = setup_table_in_playing_phase();

    // Change to Drawing phase
    table.phase = GamePhase::Playing(TurnStage::Drawing { player: Seat::East });

    // Drain the wall
    while table.wall.remaining() > 0 {
        let _ = table.wall.draw();
    }

    // Try to draw with empty wall
    let events = table
        .process_command(GameCommand::DrawTile { player: Seat::East })
        .unwrap();

    // Find the WallExhausted event
    let wall_exhausted = events
        .iter()
        .any(|e| matches!(e, Event::Public(PublicEvent::WallExhausted { .. })));
    assert!(wall_exhausted, "WallExhausted event should be emitted");

    // Find the GameOver event
    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .expect("GameOver event should be emitted on wall exhaustion");

    // Verify no winner
    assert_eq!(game_over.winner, None);
    assert_eq!(game_over.end_condition, GameEndCondition::WallExhausted);

    // Verify all scores are zero
    for seat in Seat::all() {
        assert_eq!(*game_over.final_scores.get(&seat).unwrap(), 0);
    }

    // Dealer should rotate on draw
    assert_eq!(game_over.next_dealer, Seat::South);

    // Verify phase transitioned to GameOver
    if let GamePhase::GameOver(result) = &table.phase {
        assert_eq!(result.winner, None);
    } else {
        panic!("Table should be in GameOver phase");
    }
}

#[test]
fn test_dealer_rotation_on_non_dealer_win() {
    let mut table = setup_table_in_playing_phase();

    if let Some(south) = table.get_player_mut(Seat::South) {
        south.hand.add_tile(Tile(13));
    }
    // South (not dealer) wins
    table.phase = GamePhase::Playing(TurnStage::Discarding {
        player: Seat::South,
    });

    let winning_hand = table.get_player(Seat::South).unwrap().hand.clone();

    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::South,
            hand: winning_hand,
            winning_tile: None,
        })
        .unwrap();

    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .unwrap();

    // Dealer should rotate clockwise: East -> South
    assert_eq!(game_over.next_dealer, Seat::South);
}

#[test]
fn test_score_breakdown_fields() {
    let mut table = setup_table_in_playing_phase();

    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(Tile(13));
    }
    let winning_hand = table.get_player(Seat::East).unwrap().hand.clone();

    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::East,
            hand: winning_hand,
            winning_tile: None, // Self-draw
        })
        .unwrap();

    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .unwrap();

    let score = game_over.score_breakdown.as_ref().unwrap();

    // Verify all breakdown fields are present
    assert!(score.base_score > 0, "Base score should be positive");
    assert!(score.total > 0, "Total score should be positive");
    assert_eq!(
        score.total,
        score.base_score + score.concealed_bonus + score.self_draw_bonus + score.dealer_bonus
    );

    // Verify final_scores are calculated
    assert!(game_over.final_scores.contains_key(&Seat::East));
    assert!(game_over.final_scores.contains_key(&Seat::South));
    assert!(game_over.final_scores.contains_key(&Seat::West));
    assert!(game_over.final_scores.contains_key(&Seat::North));

    // Winner should have positive score (payments received)
    let winner_score = game_over.final_scores.get(&Seat::East).unwrap();
    assert!(*winner_score > 0, "Winner should have positive net score");

    // Losers should have negative scores
    for &seat in &[Seat::South, Seat::West, Seat::North] {
        let loser_score = game_over.final_scores.get(&seat).unwrap();
        assert!(*loser_score < 0, "Losers should have negative net score");
    }

    // Sum of all scores should be zero (zero-sum game)
    let total: i32 = game_over.final_scores.values().sum();
    assert_eq!(total, 0, "Game should be zero-sum");
}

#[test]
fn test_dealer_retains_on_win() {
    let mut table = setup_table_in_playing_phase();

    // East is dealer and wins
    if let Some(east) = table.get_player_mut(Seat::East) {
        east.hand.add_tile(Tile(13));
    }
    let winning_hand = table.get_player(Seat::East).unwrap().hand.clone();

    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::East,
            hand: winning_hand,
            winning_tile: None,
        })
        .unwrap();

    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .unwrap();

    // Dealer won, should retain East
    assert_eq!(game_over.next_dealer, Seat::East);
}

#[test]
fn test_dealer_rotates_on_loss() {
    let mut table = setup_table_in_playing_phase();

    // West (not dealer) wins
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::West });
    if let Some(west) = table.get_player_mut(Seat::West) {
        west.hand.add_tile(Tile(13));
    }

    let winning_hand = table.get_player(Seat::West).unwrap().hand.clone();

    let events = table
        .process_command(GameCommand::DeclareMahjong {
            player: Seat::West,
            hand: winning_hand,
            winning_tile: None,
        })
        .unwrap();

    let game_over = events
        .iter()
        .find_map(|e| match e {
            Event::Public(PublicEvent::GameOver { result, .. }) => Some(result),
            _ => None,
        })
        .unwrap();

    // Dealer should rotate clockwise: East -> South (not to winner)
    assert_eq!(game_over.next_dealer, Seat::South);
}
