use mahjong_core::{
    command::GameCommand,
    event::{public_events::PublicEvent, Event},
    flow::charleston::CharlestonStage,
    flow::playing::TurnStage,
    flow::GamePhase,
    player::{Player, Seat},
    table::{HouseRules, Ruleset, Table, TimerMode},
    tile::Tile,
};

#[test]
fn test_charleston_timer_from_ruleset() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 90, // Custom duration
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Add 4 players and set phase to OrganizingHands so ReadyToStart triggers Charleston
    for seat in Seat::all() {
        table
            .players
            .insert(seat, Player::new(format!("player-{:?}", seat), seat, false));
    }
    table.phase = GamePhase::Setup(mahjong_core::flow::SetupStage::OrganizingHands);

    // All players ready to start
    let mut events = vec![];
    for seat in [Seat::East, Seat::South, Seat::West] {
        table
            .process_command(GameCommand::ReadyToStart { player: seat })
            .unwrap();
    }
    events.extend(
        table
            .process_command(GameCommand::ReadyToStart {
                player: Seat::North,
            })
            .unwrap(),
    );

    // Charleston should start with 90 second timer
    if let Some(charleston) = &table.charleston_state {
        assert_eq!(charleston.timer, Some(90));
    } else {
        panic!("Charleston state not created");
    }

    // Should emit CharlestonTimerStarted event with duration 90
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Public(PublicEvent::CharlestonTimerStarted { duration, .. }) if duration == &90
    )));
}

#[test]
fn test_call_window_timer_from_ruleset() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 15, // Custom duration
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Setup game in Playing phase
    for seat in Seat::all() {
        let mut player = Player::new(format!("player-{:?}", seat), seat, false);
        player.hand.add_tile(Tile(0));
        player.hand.add_tile(Tile(1));
        table.players.insert(seat, player);
    }
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    // Discard a tile to open call window
    let events = table
        .process_command(GameCommand::DiscardTile {
            player: Seat::East,
            tile: Tile(0),
        })
        .unwrap();

    // CallWindowOpened should have timer = 15
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Public(PublicEvent::CallWindowOpened { timer, .. }) if timer == &15
    )));

    // TurnStage should have timer = 15
    if let GamePhase::Playing(TurnStage::CallWindow { timer, .. }) = table.phase {
        assert_eq!(timer, 15);
    } else {
        panic!("Expected CallWindow stage");
    }
}

#[test]
fn test_timer_mode_visible() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    let snapshot = table.create_snapshot(Seat::East);
    assert!(matches!(snapshot.timer_mode(), TimerMode::Visible));
    assert!(snapshot.timers_visible());
}

#[test]
fn test_timer_mode_hidden() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Hidden,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    let snapshot = table.create_snapshot(Seat::East);
    assert!(matches!(snapshot.timer_mode(), TimerMode::Hidden));
    assert!(!snapshot.timers_visible());
}

#[test]
fn test_charleston_stage_advances_with_new_timer_event() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Add players
    for seat in Seat::all() {
        table
            .players
            .insert(seat, Player::new(format!("player-{:?}", seat), seat, false));
    }

    // Manually setup Charleston state to skip handshake
    table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
    table.charleston_state = Some(mahjong_core::flow::charleston::CharlestonState::new(60));

    // Pass tiles to advance to FirstAcross
    // We need 3 tiles for each player to pass
    let t0 = Tile(0);
    let t1 = Tile(1);
    let t2 = Tile(2);

    for seat in Seat::all() {
        // Give players tiles to pass (normally they have hands dealt)
        if let Some(p) = table.get_player_mut(seat) {
            p.hand.add_tile(t0);
            p.hand.add_tile(t1);
            p.hand.add_tile(t2);
        }
    }

    // Everyone passes except North (to trigger the change on last pass)
    for seat in [Seat::East, Seat::South, Seat::West] {
        table
            .process_command(GameCommand::CommitCharlestonPass {
                player: seat,
                from_hand: vec![t0, t1, t2],
                forward_incoming_count: 0,
            })
            .unwrap();
    }

    // North passes, triggering stage change
    let events = table
        .process_command(GameCommand::CommitCharlestonPass {
            player: Seat::North,
            from_hand: vec![t0, t1, t2],
            forward_incoming_count: 0,
        })
        .unwrap();

    // Should emit CharlestonTimerStarted for FirstAcross
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Public(PublicEvent::CharlestonTimerStarted { stage, duration, .. })
        if stage == &CharlestonStage::FirstAcross && duration == &60
    )));
}

#[test]
fn test_default_timer_values() {
    let table = Table::new("test-game".to_string(), 42);
    let snapshot = table.create_snapshot(Seat::East);

    // Defaults from Ruleset::default()
    assert_eq!(snapshot.house_rules.ruleset.call_window_seconds, 10);
    assert_eq!(snapshot.house_rules.ruleset.charleston_timer_seconds, 60);
    assert!(matches!(
        snapshot.house_rules.ruleset.timer_mode,
        TimerMode::Visible
    ));
}

#[test]
fn test_call_window_opened_includes_timer() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 12,
        charleston_timer_seconds: 60,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    // Setup and discard
    for seat in Seat::all() {
        let mut player = Player::new(format!("player-{:?}", seat), seat, false);
        player.hand.add_tile(Tile(0));
        player.hand.add_tile(Tile(1));
        table.players.insert(seat, player);
    }
    table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

    let events = table
        .process_command(GameCommand::DiscardTile {
            player: Seat::East,
            tile: Tile(0),
        })
        .unwrap();

    // Verify CallWindowOpened event has correct timer
    let call_window_event = events
        .iter()
        .find(|e| matches!(e, Event::Public(PublicEvent::CallWindowOpened { .. })));

    assert!(call_window_event.is_some());
    if let Some(Event::Public(PublicEvent::CallWindowOpened { timer, .. })) = call_window_event {
        assert_eq!(timer, &12);
    }
}

#[test]
fn test_charleston_timer_started_on_phase_change() {
    let ruleset = Ruleset {
        card_year: 2025,
        timer_mode: TimerMode::Visible,
        blank_exchange_enabled: false,
        call_window_seconds: 10,
        charleston_timer_seconds: 75,
    };
    let house_rules = HouseRules::with_ruleset(ruleset);
    let mut table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

    for seat in Seat::all() {
        table
            .players
            .insert(seat, Player::new(format!("player-{:?}", seat), seat, false));
    }
    table.phase = GamePhase::Setup(mahjong_core::flow::SetupStage::OrganizingHands);

    // Trigger transition
    let mut events = vec![];
    for seat in [Seat::East, Seat::South, Seat::West] {
        table
            .process_command(GameCommand::ReadyToStart { player: seat })
            .unwrap();
    }
    events.extend(
        table
            .process_command(GameCommand::ReadyToStart {
                player: Seat::North,
            })
            .unwrap(),
    );

    // Should have CharlestonTimerStarted with duration 75
    assert!(events.iter().any(|e| matches!(
        e,
        Event::Public(PublicEvent::CharlestonTimerStarted { stage, duration, .. })
        if stage == &CharlestonStage::FirstRight && duration == &75
    )));
}
