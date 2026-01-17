use mahjong_core::deck::Wall;

#[test]
fn test_wall_from_seed_reproduces_order() {
    let seed = 12345u64;

    // Create two walls with same seed
    let wall1 = Wall::from_seed(seed);
    let wall2 = Wall::from_seed(seed);

    // Should have identical tile order
    assert_eq!(wall1, wall2);
    assert_eq!(wall1.seed, seed);
    assert_eq!(wall2.seed, seed);
}

#[test]
fn test_wall_draw_index_tracks_draws() {
    let seed = 100u64;
    let mut wall = Wall::from_seed(seed);

    assert_eq!(wall.draw_index, 0);

    let tile1 = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 1);

    let tile2 = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 2);

    // Drawing should be deterministic
    let mut wall2 = Wall::from_seed(seed);
    assert_eq!(wall2.draw().unwrap(), tile1);
    assert_eq!(wall2.draw().unwrap(), tile2);
}

#[test]
fn test_snapshot_includes_wall_state() {
    use mahjong_core::{
        player::{Player, Seat},
        table::Table,
    };

    let seed = 999u64;
    let mut table = Table::new("test-game".to_string(), seed);

    // Add a player
    table.players.insert(
        Seat::East,
        Player::new("Test".to_string(), Seat::East, false),
    );

    // Draw some tiles to advance wall
    table.wall.draw();
    table.wall.draw();
    table.wall.draw();

    let snapshot = table.create_snapshot(Seat::East);

    assert_eq!(snapshot.wall_seed, seed);
    assert_eq!(snapshot.wall_draw_index, 3);
    assert_eq!(snapshot.wall_break_point, 0);
    assert_eq!(snapshot.wall_tiles_remaining, table.wall.total_tiles());
}

#[test]
fn test_table_restoration_from_snapshot() {
    use mahjong_core::{
        player::{Player, Seat},
        rules::card::UnifiedCard,
        rules::validator::HandValidator,
        table::Table,
    };

    let seed = 777u64;
    let mut original_table = Table::new("test-game".to_string(), seed);

    original_table.players.insert(
        Seat::East,
        Player::new("East".to_string(), Seat::East, false),
    );

    // Advance wall
    original_table.wall.draw();
    original_table.wall.draw();

    // Create snapshot
    let snapshot = original_table.create_snapshot(Seat::East);

    // Restore from snapshot
    // Load card for validator
    let card_json = mahjong_core::test_utils::load_test_card_json();
    let card: UnifiedCard = serde_json::from_str(card_json).expect("Failed to load card");
    let validator = HandValidator::new(&card);

    let restored_table = Table::from_snapshot(snapshot.clone(), validator);

    // Verify wall state matches
    assert_eq!(restored_table.wall.seed, seed);
    assert_eq!(restored_table.wall.draw_index, 2);
    assert_eq!(restored_table.wall, original_table.wall);
}
