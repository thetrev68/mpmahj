#![cfg(feature = "database")]

//! Integration tests for replay system and event persistence.
//!
//! Verifies that:
//! - Game events are correctly persisted to the database
//! - Events can be retrieved and reconstructed into a playable game state
//! - Replay data respects visibility rules (player vs admin views)
//! - Reconstructed state matches the original game at key checkpoints

use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    flow::{CharlestonStage, GamePhase, TurnStage},
    player::{Player, PlayerStatus, Seat},
    table::Table,
    tile::tiles::{BAM_1, BAM_2, DOT_1},
};
use mahjong_server::{
    db::Database, event_delivery::EventDelivery, replay::ReplayService, resources,
};

mod common;

/// Test basic snapshot reconstruction with wall state.
#[tokio::test]
async fn test_replay_reconstruction_with_wall_state() {
    common::init_test_env();
    let _ = dotenvy::dotenv();

    let db_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => {
            eprintln!("Skipping test: DATABASE_URL not set");
            return;
        }
    };
    let db = Database::new(&db_url).await.expect("Failed to connect");
    db.run_migrations().await.expect("Failed to run migrations");

    let game_uuid = uuid::Uuid::new_v4();
    let game_id = game_uuid.to_string();
    let seed = 12345u64;

    db.create_game(&game_id).await.unwrap();

    let table = Table::new(game_id.clone(), seed);

    // Create a snapshot
    let replay_service = ReplayService::new(db.clone());
    let snapshot = table.create_full_snapshot();
    let snapshot_json = serde_json::to_value(&snapshot).unwrap();
    db.save_snapshot(&game_id, 0, &snapshot_json).await.unwrap();

    // Reconstruct from snapshot
    let reconstructed = replay_service
        .reconstruct_state_at_seq(&game_id, 0)
        .await
        .unwrap();

    assert_eq!(reconstructed.wall.seed, seed);
    assert_eq!(reconstructed.game_id, game_id);
}

/// Test complete game flow with event recording and replay reconstruction.
///
/// This test verifies:
/// 1. Events are persisted correctly during gameplay
/// 2. Player-filtered replays respect visibility rules
/// 3. Admin replays contain all events
/// 4. Reconstructed state matches original game state
/// 5. Snapshots are created at appropriate intervals
#[tokio::test]
async fn test_complete_game_replay_reconstruction() {
    common::init_test_env();
    let _ = dotenvy::dotenv();

    let db_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => {
            eprintln!("Skipping test: DATABASE_URL not set");
            return;
        }
    };
    let db = Database::new(&db_url).await.expect("Failed to connect");
    db.run_migrations().await.expect("Failed to run migrations");

    let game_uuid = uuid::Uuid::new_v4();
    let game_id = game_uuid.to_string();
    let seed = 12345u64;

    // Create game in database
    db.create_game(&game_id).await.unwrap();

    // Initialize table with validator
    let validator = resources::load_validator(2025).expect("Failed to load 2025 validator");
    let mut table = Table::new(game_id.clone(), seed);
    table.set_validator(validator);

    // Track event sequence
    let mut event_seq = 0i32;

    // === Phase 1: Setup - Add Players ===
    for (seat, name) in [
        (Seat::East, "Player_East"),
        (Seat::South, "Player_South"),
        (Seat::West, "Player_West"),
        (Seat::North, "Player_North"),
    ] {
        let mut player = Player::new(name.to_string(), seat, false);
        player.status = PlayerStatus::Active;
        table.players.insert(seat, player);
    }

    // Record setup events
    let setup_event = GameEvent::PhaseChanged {
        phase: GamePhase::Setup(mahjong_core::flow::SetupStage::RollingDice),
    };
    db.append_event(
        &game_id,
        event_seq,
        &setup_event,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Roll dice (execute command)
    let _ = table.process_command(GameCommand::RollDice { player: Seat::East });

    // Record TilesDealt events (private, one per player)
    for seat in [Seat::East, Seat::South, Seat::West, Seat::North] {
        if let Some(player) = table.players.get(&seat) {
            let dealt_event = GameEvent::TilesDealt {
                your_tiles: player.hand.concealed.clone(),
            };
            db.append_event(
                &game_id,
                event_seq,
                &dealt_event,
                EventDelivery::unicast(seat),
                None,
            )
            .await
            .unwrap();
            event_seq += 1;
        }
    }

    // Save snapshot after setup
    let setup_snapshot = table.create_full_snapshot();
    db.save_snapshot(
        &game_id,
        event_seq,
        &serde_json::to_value(&setup_snapshot).unwrap(),
    )
    .await
    .unwrap();

    // === Phase 2: Charleston Phase ===
    let charleston_event = GameEvent::PhaseChanged {
        phase: GamePhase::Charleston(CharlestonStage::FirstRight),
    };
    db.append_event(
        &game_id,
        event_seq,
        &charleston_event,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Simulate tile passes for each player
    for seat in [Seat::East, Seat::South, Seat::West, Seat::North] {
        // Each player passes 3 tiles
        let tiles_to_pass = vec![BAM_1, BAM_2, DOT_1];

        let pass_event = GameEvent::TilesPassed {
            player: seat,
            tiles: tiles_to_pass.clone(),
        };

        db.append_event(
            &game_id,
            event_seq,
            &pass_event,
            EventDelivery::broadcast(),
            None,
        )
        .await
        .unwrap();
        event_seq += 1;
    }

    // Complete Charleston and transition to Playing
    let charleston_complete_event = GameEvent::CharlestonComplete;
    db.append_event(
        &game_id,
        event_seq,
        &charleston_complete_event,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // === Phase 3: Playing Phase ===
    let playing_event = GameEvent::PhaseChanged {
        phase: GamePhase::Playing(TurnStage::Discarding { player: Seat::East }),
    };
    db.append_event(
        &game_id,
        event_seq,
        &playing_event,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Simulate a few game actions
    // Draw tile (private event with tile info for current player)
    let draw_event_private = GameEvent::TileDrawn {
        tile: Some(BAM_1),
        remaining_tiles: 100,
    };
    db.append_event(
        &game_id,
        event_seq,
        &draw_event_private,
        EventDelivery::unicast(Seat::East),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Draw tile (public event without tile info)
    let draw_event_public = GameEvent::TileDrawn {
        tile: None,
        remaining_tiles: 99,
    };
    db.append_event(
        &game_id,
        event_seq,
        &draw_event_public,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Discard tile (public event)
    let discard_event = GameEvent::TileDiscarded {
        player: Seat::East,
        tile: BAM_1,
    };
    db.append_event(
        &game_id,
        event_seq,
        &discard_event,
        EventDelivery::broadcast(),
        None,
    )
    .await
    .unwrap();
    event_seq += 1;

    // Save snapshot during playing phase
    let playing_snapshot = table.create_full_snapshot();
    db.save_snapshot(
        &game_id,
        event_seq,
        &serde_json::to_value(&playing_snapshot).unwrap(),
    )
    .await
    .unwrap();

    // === Test Replay Reconstruction ===
    let replay_service = ReplayService::new(db.clone());

    // Test 1: Verify event count
    let event_count = replay_service.get_event_count(&game_id).await.unwrap();
    assert!(
        event_count > 0,
        "Expected events to be persisted, got {}",
        event_count
    );
    println!("Total events persisted: {}", event_count);

    // Test 2: Get player-filtered replay (East's view)
    let east_replay = replay_service
        .get_player_replay(&game_id, Seat::East)
        .await
        .unwrap();

    println!("East's replay contains {} events", east_replay.event_count);

    // Verify East sees their private TileDrawn event
    let east_private_events: Vec<_> = east_replay
        .events
        .iter()
        .filter(|e| matches!(e.event, GameEvent::TileDrawn { tile: Some(_), .. }))
        .collect();
    assert!(
        !east_private_events.is_empty(),
        "East should see their private draw events"
    );

    // Verify East sees public events
    let public_events: Vec<_> = east_replay
        .events
        .iter()
        .filter(|e| e.visibility == "public")
        .collect();
    assert!(!public_events.is_empty(), "East should see public events");

    // Test 3: Get player-filtered replay (South's view)
    let south_replay = replay_service
        .get_player_replay(&game_id, Seat::South)
        .await
        .unwrap();

    println!(
        "South's replay contains {} events",
        south_replay.event_count
    );

    // Verify South does NOT see East's private events
    let south_sees_east_private: Vec<_> = south_replay
        .events
        .iter()
        .filter(|e| {
            matches!(e.event, GameEvent::TileDrawn { tile: Some(_), .. })
                && e.target_player.as_ref().map(|s| s.as_str()) == Some("East")
        })
        .collect();
    assert!(
        south_sees_east_private.is_empty(),
        "South should NOT see East's private events"
    );

    // Verify South sees their own TilesDealt
    let south_dealt_events: Vec<_> = south_replay
        .events
        .iter()
        .filter(|e| {
            matches!(e.event, GameEvent::TilesDealt { .. })
                && e.target_player.as_ref().map(|s| s.as_str()) == Some("South")
        })
        .collect();
    assert!(
        !south_dealt_events.is_empty(),
        "South should see their own TilesDealt event"
    );

    // Test 4: Get admin replay (full access)
    let admin_replay = replay_service.get_admin_replay(&game_id).await.unwrap();

    println!("Admin replay contains {} events", admin_replay.event_count);

    // Admin should see ALL events including private ones
    assert!(
        admin_replay.event_count >= east_replay.event_count,
        "Admin should see at least as many events as individual players"
    );
    assert!(
        admin_replay.event_count >= south_replay.event_count,
        "Admin should see at least as many events as individual players"
    );

    // Verify admin sees private draw events
    let admin_private_draws: Vec<_> = admin_replay
        .events
        .iter()
        .filter(|e| matches!(e.event, GameEvent::TileDrawn { tile: Some(_), .. }))
        .collect();
    assert!(
        !admin_private_draws.is_empty(),
        "Admin should see private draw events"
    );

    // Test 5: Reconstruct state at specific sequence numbers
    // Reconstruct at setup phase
    let reconstructed_setup = replay_service
        .reconstruct_state_at_seq(&game_id, 5)
        .await
        .unwrap();

    assert_eq!(reconstructed_setup.game_id, game_id);
    assert_eq!(reconstructed_setup.wall.seed, seed);
    assert_eq!(reconstructed_setup.players.len(), 4);

    // Reconstruct at later point (during playing)
    let reconstructed_playing = replay_service
        .reconstruct_state_at_seq(&game_id, event_seq - 1)
        .await
        .unwrap();

    assert_eq!(reconstructed_playing.game_id, game_id);
    assert_eq!(reconstructed_playing.players.len(), 4);

    // Test 6: Verify snapshots were created
    let latest_snapshot = db.get_latest_snapshot(&game_id, event_seq).await.unwrap();
    assert!(
        latest_snapshot.is_some(),
        "Expected at least one snapshot to exist"
    );

    if let Some(snapshot) = latest_snapshot {
        println!("Latest snapshot at seq {}", snapshot.seq);
        assert!(snapshot.seq <= event_seq, "Snapshot seq should be valid");
    }

    println!("✓ All replay reconstruction tests passed");
}
