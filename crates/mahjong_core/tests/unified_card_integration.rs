//! Integration test for the Unified Card system.
//!
//! This test verifies that:
//! 1. The unified_card2025.json file loads correctly
//! 2. The HandValidator can identify winning hands
//! 3. The histogram-based validation works end-to-end

use mahjong_core::{
    hand::Hand,
    rules::{card::UnifiedCard, validator::HandValidator},
    tile::Tile,
};
use std::fs;

#[test]
fn test_load_unified_card() {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");

    // Verify metadata
    assert_eq!(card.meta.year, 2025);
    assert!(!card.patterns.is_empty(), "Card should have patterns");

    // Count total variations
    let total_variations: usize = card.patterns.iter().map(|p| p.variations.len()).sum();
    println!("Loaded {} patterns with {} total variations",
             card.patterns.len(), total_variations);

    // Verify first pattern structure
    let first_pattern = &card.patterns[0];
    assert!(!first_pattern.id.is_empty());
    assert!(!first_pattern.variations.is_empty());
    assert_eq!(first_pattern.variations[0].histogram.len(), 42);
}

#[test]
fn test_winning_hand_validation() {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Test 1: Create a hand that exactly matches the first variation
    // Pattern: 11 333 5555 777 99 (Bams)
    // Histogram at index 0: [2, 0, 3, 0, 4, 0, 3, 0, 2, 0, ...]
    let winning_tiles = vec![
        Tile(0), Tile(0),       // 1 Bam x2
        Tile(2), Tile(2), Tile(2), // 3 Bam x3
        Tile(4), Tile(4), Tile(4), Tile(4), // 5 Bam x4
        Tile(6), Tile(6), Tile(6), // 7 Bam x3
        Tile(8), Tile(8),       // 9 Bam x2
    ];

    let winning_hand = Hand::new(winning_tiles);

    // Verify this is recognized as a winning hand
    let result = validator.validate_win(&winning_hand);
    assert!(result.is_some(), "Should recognize winning hand");

    let win = result.unwrap();
    assert_eq!(win.deficiency, 0, "Winning hand should have 0 deficiency");
    assert_eq!(win.score, 25, "Should match pattern score");
    println!("✓ Winning hand validated: {} (score: {})", win.pattern_id, win.score);
}

#[test]
fn test_near_win_analysis() {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Create a hand that's one tile away from winning
    // Missing one 9 Bam from the pattern above
    let near_win_tiles = vec![
        Tile(0), Tile(0),       // 1 Bam x2
        Tile(2), Tile(2), Tile(2), // 3 Bam x3
        Tile(4), Tile(4), Tile(4), Tile(4), // 5 Bam x4
        Tile(6), Tile(6), Tile(6), // 7 Bam x3
        Tile(8),                // 9 Bam x1 (missing 1)
    ];

    let hand = Hand::new(near_win_tiles);

    // Analyze top 5 closest patterns
    let results = validator.analyze(&hand, 5);
    assert!(!results.is_empty(), "Should return analysis results");

    // The closest should be deficiency 1
    assert!(results[0].deficiency >= 1, "Should need at least 1 tile");

    println!("✓ Near-win analysis:");
    for (i, result) in results.iter().take(3).enumerate() {
        println!("  {}. {} - deficiency: {}, score: {}",
                 i + 1, result.pattern_id, result.deficiency, result.score);
    }
}

#[test]
fn test_joker_substitution() {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Create a winning hand using a joker to substitute
    // Pattern: 11 333 5555 777 99 (Bams)
    // Use a joker for one of the 7 Bams (group of 3)
    let tiles_with_joker = vec![
        Tile(0), Tile(0),       // 1 Bam x2
        Tile(2), Tile(2), Tile(2), // 3 Bam x3
        Tile(4), Tile(4), Tile(4), Tile(4), // 5 Bam x4
        Tile(6), Tile(6), Tile(35), // 7 Bam x2 + Joker
        Tile(8), Tile(8),       // 9 Bam x2
    ];

    let hand = Hand::new(tiles_with_joker);

    // Should still validate as a win (deficiency 0)
    let result = validator.validate_win(&hand);
    assert!(result.is_some(), "Should recognize win with joker");

    let win = result.unwrap();
    assert_eq!(win.deficiency, 0, "Joker should substitute successfully");
    println!("✓ Joker substitution validated: {}", win.pattern_id);
}

#[test]
fn test_random_hand_analysis_performance() {
    use std::time::Instant;

    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Create a random 13-tile hand
    let random_tiles = vec![
        Tile(0), Tile(1), Tile(2),  // Some Bams
        Tile(9), Tile(10),          // Some Craks
        Tile(18), Tile(19),         // Some Dots
        Tile(27), Tile(28),         // Some Winds
        Tile(31), Tile(32),         // Some Dragons
        Tile(34), Tile(35),         // Flower + Joker
    ];

    let hand = Hand::new(random_tiles);

    // Benchmark single analysis
    let start = Instant::now();
    let results = validator.analyze(&hand, 10);
    let duration = start.elapsed();

    assert!(!results.is_empty());
    println!("✓ Random hand analysis took: {:?}", duration);
    println!("  Best match: {} (deficiency: {})",
             results[0].pattern_id, results[0].deficiency);
}
