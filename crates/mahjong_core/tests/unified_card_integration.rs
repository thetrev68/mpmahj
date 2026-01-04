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
    println!(
        "Loaded {} patterns with {} total variations",
        card.patterns.len(),
        total_variations
    );

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
        Tile(0),
        Tile(0), // 1 Bam x2
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam x3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam x4
        Tile(6),
        Tile(6),
        Tile(6), // 7 Bam x3
        Tile(8),
        Tile(8), // 9 Bam x2
    ];

    let winning_hand = Hand::new(winning_tiles);

    // Verify this is recognized as a winning hand
    let result = validator.validate_win(&winning_hand);
    assert!(result.is_some(), "Should recognize winning hand");

    let win = result.unwrap();
    assert_eq!(win.deficiency, 0, "Winning hand should have 0 deficiency");
    assert_eq!(win.score, 25, "Should match pattern score");
    println!(
        "✓ Winning hand validated: {} (score: {})",
        win.pattern_id, win.score
    );
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
        Tile(0),
        Tile(0), // 1 Bam x2
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam x3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam x4
        Tile(6),
        Tile(6),
        Tile(6), // 7 Bam x3
        Tile(8), // 9 Bam x1 (missing 1)
    ];

    let hand = Hand::new(near_win_tiles);

    // Analyze top 5 closest patterns
    let results = validator.analyze(&hand, 5);
    assert!(!results.is_empty(), "Should return analysis results");

    // The closest should be deficiency 1
    assert!(results[0].deficiency >= 1, "Should need at least 1 tile");

    println!("✓ Near-win analysis:");
    for (i, result) in results.iter().take(3).enumerate() {
        println!(
            "  {}. {} - deficiency: {}, score: {}",
            i + 1,
            result.pattern_id,
            result.deficiency,
            result.score
        );
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
        Tile(0),
        Tile(0), // 1 Bam x2
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam x3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam x4
        Tile(6),
        Tile(6),
        Tile(35), // 7 Bam x2 + Joker
        Tile(8),
        Tile(8), // 9 Bam x2
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
fn test_joker_in_pair_invalid() {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Try to use Joker in the pair of 1 Bams (should NOT work)
    // Pattern: 11 333 5555 777 99 but using Joker for one of the 1s in the pair
    let tiles_with_joker_in_pair = vec![
        Tile(0),
        Tile(35), // 1 Bam + Joker (trying to make pair)
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam x3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam x4
        Tile(6),
        Tile(6),
        Tile(6), // 7 Bam x3
        Tile(8),
        Tile(8), // 9 Bam x2
    ];

    let hand = Hand::new(tiles_with_joker_in_pair);

    // Should NOT validate because joker can't be in pair
    let result = validator.validate_win(&hand);
    assert!(
        result.is_none() || result.unwrap().deficiency > 0,
        "Joker in pair should not validate as win"
    );

    println!("✓ Joker-in-pair correctly rejected");
}

#[test]
fn test_concealed_pattern_filtering() {
    use mahjong_core::meld::{Meld, MeldType};

    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");

    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");

    // Find a concealed-only pattern in the card
    let concealed_pattern = card
        .patterns
        .iter()
        .find(|p| p.concealed)
        .expect("Should have at least one concealed pattern");

    println!("Testing concealed pattern: {}", concealed_pattern.id);

    // Create a hand that matches this pattern's first variation
    let first_var = &concealed_pattern.variations[0];
    let mut tiles = Vec::new();
    for (idx, &count) in first_var.histogram.iter().enumerate() {
        for _ in 0..count {
            tiles.push(Tile(idx as u8));
        }
    }
    let hand = Hand::new(tiles.clone());

    // Hand with no exposed melds should match
    let validator = HandValidator::new(&card);
    let result = validator.validate_win(&hand);
    assert!(
        result.is_some(),
        "Concealed hand should validate against concealed pattern"
    );

    // Same hand but with one exposed meld should NOT match concealed pattern
    let mut hand_with_exposed = Hand::new(tiles);

    // Find 3 matching tiles to create a valid Pung
    // Look for any tile that appears at least 3 times
    let mut pung_tile = None;
    for (idx, &count) in hand_with_exposed.counts.iter().enumerate() {
        if count >= 3 {
            pung_tile = Some(Tile(idx as u8));
            break;
        }
    }

    if let Some(tile) = pung_tile {
        // Remove 3 instances of this tile from concealed
        let mut removed = 0;
        hand_with_exposed.concealed.retain(|&t| {
            if t == tile && removed < 3 {
                removed += 1;
                false
            } else {
                true
            }
        });

        // Update counts
        hand_with_exposed.counts[tile.0 as usize] -= 3;

        // Create the exposed Pung
        let meld = Meld::new(MeldType::Pung, vec![tile, tile, tile], Some(tile)).unwrap();
        hand_with_exposed.exposed.push(meld);
    }

    let result_exposed = validator.validate_win(&hand_with_exposed);
    // Should either be None or match a different (non-concealed) pattern
    if let Some(win) = result_exposed {
        let matched_pattern = card
            .patterns
            .iter()
            .find(|p| p.id == win.pattern_id)
            .unwrap();
        assert!(
            !matched_pattern.concealed,
            "Should not match concealed pattern when hand has exposed melds"
        );
    }

    println!("✓ Concealed pattern filtering works correctly");
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
        Tile(0),
        Tile(1),
        Tile(2), // Some Bams
        Tile(9),
        Tile(10), // Some Craks
        Tile(18),
        Tile(19), // Some Dots
        Tile(27),
        Tile(28), // Some Winds
        Tile(31),
        Tile(32), // Some Dragons
        Tile(34),
        Tile(35), // Flower + Joker
    ];

    let hand = Hand::new(random_tiles);

    // Benchmark single analysis
    let start = Instant::now();
    let results = validator.analyze(&hand, 10);
    let duration = start.elapsed();

    assert!(!results.is_empty());
    println!("✓ Random hand analysis took: {:?}", duration);
    println!(
        "  Best match: {} (deficiency: {})",
        results[0].pattern_id, results[0].deficiency
    );
}
