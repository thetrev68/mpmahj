//! Example: validate hands against the unified card.

use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

fn main() {
    println!("=== American Mahjong Validation Example ===\n");

    // Load the 2025 NMJL card
    let json = std::fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to load card");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse card");

    println!(
        "Loaded {} patterns with {} variations",
        card.patterns.len(),
        card.patterns
            .iter()
            .map(|p| p.variations.len())
            .sum::<usize>()
    );

    // Create validator
    let validator = HandValidator::new(&card);

    // Example 1: Winning hand - 11 333 5555 777 99 (all Bams)
    println!("\n--- Example 1: Winning Hand ---");
    let winning_hand = Hand::new(vec![
        Tile(0),
        Tile(0), // 1 Bam × 2
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam × 3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam × 4
        Tile(6),
        Tile(6),
        Tile(6), // 7 Bam × 3
        Tile(8),
        Tile(8), // 9 Bam × 2
    ]);

    print_hand(&winning_hand);

    match validator.validate_win(&winning_hand) {
        Some(result) => {
            println!("\n✅ MAHJONG!");
            println!("Pattern: {}", result.pattern_id);
            println!("Variation: {}", result.variation_id);
            println!("Score: {}", result.score);
        }
        None => println!("\n❌ Not a winning hand"),
    }

    // Example 2: Near-win hand (one tile away)
    println!("\n--- Example 2: Near-Win Hand (Missing one 9 Bam) ---");
    let near_win_hand = Hand::new(vec![
        Tile(0),
        Tile(0),
        Tile(2),
        Tile(2),
        Tile(2),
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(6),
        Tile(6),
        Tile(6),
        Tile(8), // Only one 9 Bam (need 2)
    ]);

    print_hand(&near_win_hand);

    match validator.validate_win(&near_win_hand) {
        Some(_) => println!("\n✅ MAHJONG!"),
        None => {
            println!("\n❌ Not a winning hand");

            // Show closest patterns
            let top_5 = validator.analyze(&near_win_hand, 5);
            println!("\nClosest patterns:");
            for (i, result) in top_5.iter().enumerate() {
                println!(
                    "{}. {} - {} tiles away (score: {})",
                    i + 1,
                    result.pattern_id,
                    result.deficiency,
                    result.score
                );
            }
        }
    }

    // Example 3: Hand with a joker
    println!("\n--- Example 3: Winning Hand with Joker ---");
    let joker_hand = Hand::new(vec![
        Tile(0),
        Tile(0),
        Tile(2),
        Tile(2),
        Tile(2),
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(35), // Joker substituting for 5 Bam
        Tile(6),
        Tile(6),
        Tile(6),
        Tile(8),
        Tile(8),
    ]);

    print_hand(&joker_hand);

    match validator.validate_win(&joker_hand) {
        Some(result) => {
            println!("\n✅ MAHJONG!");
            println!("Pattern: {}", result.pattern_id);
            println!("Score: {}", result.score);
            println!("(Joker successfully substituted in group)");
        }
        None => println!("\n❌ Not a winning hand"),
    }

    // Example 4: Random hand (probably not winning)
    println!("\n--- Example 4: Random Hand ---");
    let random_hand = Hand::new(vec![
        Tile(0),
        Tile(1),
        Tile(2), // Some Bams
        Tile(9),
        Tile(10),
        Tile(11), // Some Craks
        Tile(18),
        Tile(19), // Some Dots
        Tile(27),
        Tile(28), // Some Winds
        Tile(31),
        Tile(32), // Some Dragons
        Tile(35), // A Joker
    ]);

    print_hand(&random_hand);

    match validator.validate_win(&random_hand) {
        Some(result) => {
            println!("\n✅ MAHJONG!");
            println!("Pattern: {}", result.pattern_id);
        }
        None => {
            println!("\n❌ Not a winning hand");

            let top_3 = validator.analyze(&random_hand, 3);
            println!("\nBest matching patterns:");
            for (i, result) in top_3.iter().enumerate() {
                println!(
                    "{}. {} - {} tiles away (score: {})",
                    i + 1,
                    result.pattern_id,
                    result.deficiency,
                    result.score
                );
            }
        }
    }
}

/// Print a compact list of tiles in the hand.
fn print_hand(hand: &Hand) {
    println!("Hand ({} tiles):", hand.total_tiles());
    print!("  ");
    for tile in &hand.concealed {
        print!("{}, ", tile);
    }
    println!();
}
