use mahjong_core::bot::BasicBot;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::tile::tiles::*;

fn load_test_card() -> UnifiedCard {
    let json =
        std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
    UnifiedCard::from_json(&json).expect("Parse card")
}

#[test]
fn test_bot_chooses_charleston_tiles() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // Hand with some isolated tiles
    let hand = Hand::new(vec![
        BAM_1, BAM_2, // 1-2 Bam (not connected to anything else)
        EAST, SOUTH, // Isolated honors
        CRAK_2, CRAK_2, CRAK_2, // Pung (keep!)
        JOKER, JOKER, // Jokers (keep!)
        BAM_5, BAM_5, // Pair (keep)
        GREEN, // Isolated dragon
        WEST,  // Another isolated honor
    ]);

    let to_pass = bot.choose_charleston_tiles(&hand);

    assert_eq!(to_pass.len(), 3, "Should pass exactly 3 tiles");
    assert!(
        !to_pass.contains(&JOKER),
        "Should not pass Jokers (they score +100)"
    );
    assert!(
        !to_pass.contains(&CRAK_2),
        "Should not pass Pung tiles (high score)"
    );

    // Should prefer passing isolated honors and low-value tiles
    // The exact tiles may vary based on scoring, but jokers and pungs should stay
}

#[test]
fn test_bot_never_passes_jokers() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // Hand with multiple jokers and bad tiles
    let hand = Hand::new(vec![
        JOKER, JOKER, JOKER, JOKER, // 4 jokers
        BAM_1, EAST, SOUTH, WEST, NORTH, GREEN, RED, WHITE, DOT_9,
    ]);

    let to_pass = bot.choose_charleston_tiles(&hand);

    assert_eq!(to_pass.len(), 3);
    assert!(
        !to_pass.contains(&JOKER),
        "Should never pass jokers regardless of hand"
    );
}

#[test]
fn test_bot_keeps_pairs_and_pungs() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    let hand = Hand::new(vec![
        CRAK_5, CRAK_5, CRAK_5, CRAK_5, // Kong
        DOT_3, DOT_3, DOT_3, // Pung
        BAM_7, BAM_7, // Pair
        EAST, SOUTH, WEST, // Isolated honors (should pass these)
        GREEN,
    ]);

    let to_pass = bot.choose_charleston_tiles(&hand);

    assert_eq!(to_pass.len(), 3);
    assert!(!to_pass.contains(&CRAK_5), "Should not pass Kong tiles");
    assert!(!to_pass.contains(&DOT_3), "Should not pass Pung tiles");
    assert!(!to_pass.contains(&BAM_7), "Should not pass pair tiles");

    // Should pass the isolated honors
    assert!(
        to_pass.contains(&EAST)
            || to_pass.contains(&SOUTH)
            || to_pass.contains(&WEST)
            || to_pass.contains(&GREEN),
        "Should pass isolated honor tiles"
    );
}

#[test]
fn test_bot_discard_selection() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, // Connected run
        CRAK_2, CRAK_2, CRAK_2, // Pung
        JOKER,  // Keep
        EAST,   // Isolated
        BAM_5, BAM_5, // Pair
        GREEN, // Isolated
        WEST,  // Isolated
        NORTH, // Isolated
        DOT_9, // Isolated
    ]);

    let discard = bot.choose_discard(&hand);

    // Should discard an isolated tile, not joker or pung or connected run
    assert_ne!(discard, JOKER, "Should not discard Joker");
    assert_ne!(discard, CRAK_2, "Should not discard Pung tile");
    assert_ne!(discard, BAM_5, "Should prefer not to discard pair");

    // Should be one of the isolated tiles
    let isolated_tiles = [EAST, GREEN, WEST, NORTH, DOT_9];
    assert!(
        isolated_tiles.contains(&discard),
        "Should discard an isolated tile, got {:?}",
        discard
    );
}

#[test]
fn test_bot_win_detection() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // A random non-winning hand
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
        DOT_9,
    ]);

    let _is_win = bot.check_win(&hand);

    // This hand is unlikely to be a perfect match
    // We're just checking the function works
}

#[test]
fn test_bot_calling_requires_pairs() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // Hand with only 1 Crak 2 (can't call another)
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH, DOT_9, DOT_8,
    ]);

    // Try to call Crak 2 (but we only have 1, need 2 for Pung)
    let call_result = bot.should_call(&hand, CRAK_2);

    assert!(
        call_result.is_none(),
        "Should not call with only 1 tile (need 2 for Pung)"
    );
}

#[test]
fn test_bot_calling_with_pair() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // Hand with 2 Crak 2s (can call to form Pung)
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH, DOT_9,
    ]);

    // Try to call Crak 2 (we have 2, so calling makes a Pung)
    let call_result = bot.should_call(&hand, CRAK_2);

    // May call if it doesn't worsen deficiency
    // Just verify it returns a valid result
    if let Some(meld) = call_result {
        assert_eq!(meld.tiles.len(), 3, "Pung should have 3 tiles");
        assert_eq!(
            meld.called_tile,
            Some(CRAK_2),
            "Called tile should be recorded"
        );
    }
}

#[test]
fn test_bot_never_calls_jokers() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    let hand = Hand::new(vec![
        JOKER, JOKER, BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
    ]);

    // Try to call a Joker (not allowed in rules)
    let call_result = bot.should_call(&hand, JOKER);

    assert!(
        call_result.is_none(),
        "Should never call Jokers (not allowed)"
    );
}

#[test]
fn test_bot_handles_empty_patterns_gracefully() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // A very bad hand that won't match many patterns
    let hand = Hand::new(vec![
        BAM_1, BAM_9, CRAK_1, CRAK_9, DOT_1, DOT_9, EAST, SOUTH, WEST, NORTH, GREEN, RED, WHITE,
    ]);

    // Should still be able to choose tiles to pass
    let to_pass = bot.choose_charleston_tiles(&hand);
    assert_eq!(to_pass.len(), 3, "Should always pass 3 tiles");

    // Should still be able to choose a discard
    let discard = bot.choose_discard(&hand);
    assert!(hand.has_tile(discard), "Should discard a tile from hand");
}

#[test]
fn test_bot_prefers_connected_tiles() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    let hand = Hand::new(vec![
        BAM_4, BAM_5, BAM_6,  // Connected run (should keep)
        CRAK_1, // Isolated
        CRAK_9, // Isolated
        DOT_1,  // Isolated
        EAST, SOUTH, WEST, NORTH, GREEN, RED, WHITE,
    ]);

    let to_pass = bot.choose_charleston_tiles(&hand);

    // Should not pass the connected Bam tiles
    assert!(
        !to_pass.contains(&BAM_4) && !to_pass.contains(&BAM_5) && !to_pass.contains(&BAM_6),
        "Should keep connected run"
    );

    // Should pass isolated tiles (either suited or honors)
    let isolated_tiles = vec![
        CRAK_1, CRAK_9, DOT_1, EAST, SOUTH, WEST, NORTH, GREEN, RED, WHITE,
    ];
    let passed_isolated = to_pass
        .iter()
        .filter(|t| isolated_tiles.contains(t))
        .count();
    assert!(
        passed_isolated >= 3,
        "Should pass isolated tiles (got {:?})",
        to_pass
    );
}

#[test]
fn test_full_bot_decision_sequence() {
    let card = load_test_card();
    let bot = BasicBot::new(&card);

    // Simulate a turn sequence
    let mut hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
    ]);

    // 1. Charleston decision
    let charleston_tiles = bot.choose_charleston_tiles(&hand);
    assert_eq!(charleston_tiles.len(), 3);

    // 2. Draw a tile (simulate)
    hand.add_tile(DOT_7);

    // 3. Discard decision
    let discard = bot.choose_discard(&hand);
    assert!(hand.has_tile(discard));

    // 4. Check if we can win
    let _can_win = bot.check_win(&hand);

    // 5. Calling decision
    let _call = bot.should_call(&hand, DOT_3);
}
