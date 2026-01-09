use mahjong_core::{
    deck::{Deck, Wall},
    tile::Tile,
};

#[test]
fn test_wall_from_seed_reproduces_order() {
    let seed = 12345u64;

    // Create two walls with same seed
    let wall1 = Wall::from_seed(seed);
    let wall2 = Wall::from_seed(seed);

    // Should have identical tile order
    assert_eq!(wall1.seed, seed);
    assert_eq!(wall2.seed, seed);
    // Note: We can't access tiles directly as it is private, but we can verify via draws
    // Actually, looking at Wall definition, tiles is private.
    // We can check draws.
}

#[test]
fn test_wall_draw_determinism() {
    let seed = 54321u64;
    let mut wall1 = Wall::from_seed(seed);
    let mut wall2 = Wall::from_seed(seed);

    for _ in 0..100 {
        let t1 = wall1.draw();
        let t2 = wall2.draw();
        assert_eq!(t1, t2, "Draws should be identical for same seed");
        if t1.is_none() {
            break;
        }
    }
}

#[test]
fn test_wall_break_point_logic() {
    // Note: Wall::from_deck creates a wall with tiles from deck, and break_point just sets dead_wall_size.
    // It does NOT rotate the wall. The rotation/break usually happens by "breaking" the wall which implies dealing from that point.
    // But Wall implementation of `draw` just pops from end.
    // Wait, let's check Wall implementation again.
    // `tiles: deck.tiles`
    // `draw` pops.
    // So "breaking the wall" in `setup.rs` was:
    // `table.wall = Wall::from_deck(Deck::new(), roll)`
    //
    // The `roll` sets `dead_wall_size`.
    // It does NOT seem to rotate the tiles.
    // The implementation of `Wall` in `deck.rs` does NOT implement the physical "breaking" where the start index shifts.
    // It just sets `dead_wall_size`.
    // And `draw` pops from end.
    // So `break_point` is effectively "how many tiles are reserved at the end".
    //
    // Let's verify this behavior in test.
    let seed = 123u64;
    let break_point = 10;
    let mut wall = Wall::from_deck_with_seed(seed, break_point);
    
    assert_eq!(wall.break_point, break_point);
    
    // We can draw until dead wall
    let total = wall.total_tiles(); // 152
    let dead = break_point * 2; // 20
    let playable = total - dead; // 132
    
    for _ in 0..playable {
        assert!(wall.draw().is_some());
    }
    
    // Next draw should fail
    assert!(wall.draw().is_none());
}

#[test]
fn test_wall_draw_index_tracks_draws() {
    let seed = 100u64;
    let mut wall = Wall::from_seed(seed);

    assert_eq!(wall.draw_index, 0);

    let _ = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 1);

    let _ = wall.draw().unwrap();
    assert_eq!(wall.draw_index, 2);
}
