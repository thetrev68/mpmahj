use super::*;
use crate::command::GameCommand;
use crate::event::GameEvent;
use crate::flow::{CharlestonStage, CharlestonState, GamePhase, SetupStage, TurnStage};
use crate::hand::Hand;
use crate::player::{Player, PlayerStatus, Seat};
use crate::tile::{Tile, BLANK_INDEX, DOT_START, JOKER_INDEX};

// Helper to create tiles
fn dot(n: u8) -> Tile {
    Tile(DOT_START + (n - 1))
}

#[test]
fn test_table_creation() {
    let table = Table::new("game123".to_string(), 42);
    assert_eq!(table.game_id, "game123");
    assert_eq!(table.dealer, Seat::East);
    assert_eq!(table.round_number, 1);
    assert!(matches!(table.phase, GamePhase::WaitingForPlayers));
}

#[test]
fn test_seat_navigation() {
    let table = Table::new("test".to_string(), 0);
    assert_eq!(table.current_turn, Seat::East);

    let mut table = table;
    table.advance_turn();
    assert_eq!(table.current_turn, Seat::South);
    table.advance_turn();
    assert_eq!(table.current_turn, Seat::West);
    table.advance_turn();
    assert_eq!(table.current_turn, Seat::North);
    table.advance_turn();
    assert_eq!(table.current_turn, Seat::East);
}

#[test]
fn test_add_players() {
    let mut table = Table::new("test".to_string(), 0);

    // Add 4 players
    for seat in Seat::all() {
        let player = Player::new(format!("player_{}", seat.index()), seat, false);
        table.players.insert(seat, player);
    }

    assert_eq!(table.players.len(), 4);
    assert!(table.get_player(Seat::East).is_some());
    assert!(table.get_player(Seat::South).is_some());
}

#[test]
fn test_roll_dice_command() {
    let mut table = Table::new("test".to_string(), 42);

    // Add East player
    table.players.insert(
        Seat::East,
        Player::new("east".to_string(), Seat::East, false),
    );

    // Transition to Setup phase
    table.phase = GamePhase::Setup(SetupStage::RollingDice);

    let cmd = GameCommand::RollDice { player: Seat::East };
    let events = table.process_command(cmd).unwrap();

    assert!(events
        .iter()
        .any(|e| matches!(e, GameEvent::DiceRolled { .. })));
    assert!(events
        .iter()
        .any(|e| matches!(e, GameEvent::WallBroken { .. })));
    assert!(events
        .iter()
        .any(|e| matches!(e, GameEvent::TilesDealt { .. })));
    assert!(matches!(
        table.phase,
        GamePhase::Setup(SetupStage::OrganizingHands)
    ));
}

#[test]
fn test_only_east_can_roll_dice() {
    let mut table = Table::new("test".to_string(), 42);

    // Add South player
    table.players.insert(
        Seat::South,
        Player::new("south".to_string(), Seat::South, false),
    );

    table.phase = GamePhase::Setup(SetupStage::RollingDice);

    let cmd = GameCommand::RollDice {
        player: Seat::South,
    };
    let result = table.process_command(cmd);

    assert!(matches!(result, Err(CommandError::OnlyEastCanRoll)));
}

#[test]
fn test_discard_tile_validation() {
    let mut table = Table::new("test".to_string(), 42);

    // Set up player with hand
    let mut player = Player::new("east".to_string(), Seat::East, false);
    player.hand = Hand::new(vec![dot(1), dot(2), dot(3)]);
    player.status = PlayerStatus::Active;
    table.players.insert(Seat::East, player);

    // Set phase to Discarding
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    // Try to discard a tile not in hand
    let cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: dot(5),
    };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::TileNotInHand)));

    // Discard a tile in hand
    let cmd = GameCommand::DiscardTile {
        player: Seat::East,
        tile: dot(1),
    };
    let result = table.process_command(cmd);
    assert!(result.is_ok());
}

#[test]
fn test_wrong_phase_rejection() {
    let mut table = Table::new("test".to_string(), 42);

    let mut player = Player::new("east".to_string(), Seat::East, false);
    player.status = PlayerStatus::Active;
    table.players.insert(Seat::East, player);

    // Try to draw during Setup phase
    table.phase = GamePhase::Setup(SetupStage::RollingDice);

    let cmd = GameCommand::DrawTile { player: Seat::East };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::WrongPhase)));
}

#[test]
fn test_not_your_turn_rejection() {
    let mut table = Table::new("test".to_string(), 42);

    // Add two players
    let mut east = Player::new("east".to_string(), Seat::East, false);
    east.status = PlayerStatus::Active;
    let mut south = Player::new("south".to_string(), Seat::South, false);
    south.status = PlayerStatus::Active;

    table.players.insert(Seat::East, east);
    table.players.insert(Seat::South, south);

    // Set to Drawing phase for East
    table.phase = GamePhase::Playing(TurnStage::Drawing { player: Seat::East });
    table.current_turn = Seat::East;

    // South tries to draw
    let cmd = GameCommand::DrawTile {
        player: Seat::South,
    };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::NotYourTurn)));
}

#[test]
fn test_charleston_no_jokers() {
    let mut table = Table::new("test".to_string(), 42);

    let mut player = Player::new("east".to_string(), Seat::East, false);
    player.hand = Hand::new(vec![dot(1), Tile(JOKER_INDEX), dot(3)]);
    player.status = PlayerStatus::Active;
    table.players.insert(Seat::East, player);

    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    table.charleston_state = Some(CharlestonState::new(60));

    // Try to pass Joker
    let cmd = GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![dot(1), Tile(JOKER_INDEX), dot(3)],
        blind_pass_count: None,
    };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::ContainsJokers)));
}

#[test]
fn test_pass_tiles_count_validation() {
    let mut table = Table::new("test".to_string(), 42);

    let mut player = Player::new("east".to_string(), Seat::East, false);
    player.hand = Hand::new(vec![dot(1), dot(2)]);
    player.status = PlayerStatus::Active;
    table.players.insert(Seat::East, player);

    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    table.charleston_state = Some(CharlestonState::new(60));

    // Try to pass only 2 tiles
    let cmd = GameCommand::PassTiles {
        player: Seat::East,
        tiles: vec![dot(1), dot(2)],
        blind_pass_count: None,
    };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::InvalidPassCount)));
}

#[test]
fn test_blank_exchange_requires_house_rule() {
    let mut table = Table::new("test".to_string(), 42);

    let mut player = Player::new("east".to_string(), Seat::East, false);
    player.hand = Hand::new(vec![Tile(BLANK_INDEX)]);
    player.status = PlayerStatus::Active;
    table.players.insert(Seat::East, player);

    table.discard_pile.push(DiscardedTile {
        tile: dot(5),
        discarded_by: Seat::South,
    });

    // House rule disabled by default
    let cmd = GameCommand::ExchangeBlank {
        player: Seat::East,
        discard_index: 0,
    };
    let result = table.process_command(cmd);
    assert!(matches!(result, Err(CommandError::BlankExchangeNotEnabled)));

    // Enable house rule
    table.house_rules.ruleset.blank_exchange_enabled = true;
    let cmd2 = GameCommand::ExchangeBlank {
        player: Seat::East,
        discard_index: 0,
    };
    let result = table.process_command(cmd2);
    assert!(result.is_ok());
}

#[test]
fn test_ruleset_default_values() {
    let ruleset = Ruleset::default();
    assert_eq!(ruleset.card_year, 2025);
    assert!(matches!(ruleset.timer_mode, TimerMode::Visible));
    assert!(!ruleset.blank_exchange_enabled);
    assert_eq!(ruleset.call_window_seconds, 10);
    assert_eq!(ruleset.charleston_timer_seconds, 60);
}

#[test]
fn test_ruleset_custom_values() {
    let ruleset = Ruleset {
        card_year: 2024,
        timer_mode: TimerMode::Hidden,
        blank_exchange_enabled: true,
        call_window_seconds: 15,
        charleston_timer_seconds: 90,
    };

    assert_eq!(ruleset.card_year, 2024);
    assert!(matches!(ruleset.timer_mode, TimerMode::Hidden));
    assert!(ruleset.blank_exchange_enabled);
}

#[test]
fn test_house_rules_default() {
    let house_rules = HouseRules::default();
    assert_eq!(house_rules.ruleset.card_year, 2025);
    assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
}

#[test]
fn test_house_rules_with_card_year() {
    let house_rules = HouseRules::with_card_year(2020);
    assert_eq!(house_rules.ruleset.card_year, 2020);
    // Other values should be defaults
    assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
}

#[test]
fn test_house_rules_with_custom_ruleset() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Hidden,
        blank_exchange_enabled: true,
        call_window_seconds: 20,
        charleston_timer_seconds: 120,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);

    assert_eq!(house_rules.ruleset.card_year, 2025);
    assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Hidden));
    assert!(house_rules.ruleset.blank_exchange_enabled);
    assert_eq!(house_rules.ruleset.call_window_seconds, 20);
}

#[test]
fn test_table_creation_with_house_rules() {
    let house_rules = HouseRules::with_card_year(2025);
    let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    assert_eq!(table.house_rules.ruleset.card_year, 2025);
    assert!(!table.house_rules.ruleset.blank_exchange_enabled);
}

#[test]
fn test_snapshot_contains_ruleset() {
    let table = Table::new("test-game".to_string(), 42);
    let snapshot = table.create_snapshot(Seat::East);

    assert_eq!(snapshot.house_rules.ruleset.card_year, 2025);
    assert!(matches!(
        snapshot.house_rules.ruleset.timer_mode,
        TimerMode::Visible
    ));
}

#[test]
fn test_snapshot_card_year_accessors() {
    let table = Table::new("test-game".to_string(), 42);
    let snapshot = table.create_snapshot(Seat::East);

    assert_eq!(snapshot.card_year(), 2025);
    assert!(matches!(snapshot.timer_mode(), TimerMode::Visible));
}
