//! Example demonstrating MCTS heuristic pruning.
//!
//! Run with: cargo run --example mcts_pruning

use mahjong_ai::strategies::mcts_ai::MCTSAI;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

fn main() {
    // Load card
    let json = std::fs::read_to_string("data/cards/unified_card2025.json")
        .expect("Load card");
    let card = UnifiedCard::from_json(&json).expect("Parse card");
    let validator = HandValidator::new(&card);
    let visible = Default::default();

    // Create a test hand with many unique tiles
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, BAM_4, BAM_5,
        CRAK_1, CRAK_2, CRAK_3,
        DOT_1, DOT_2, DOT_3,
        JOKER, JOKER,
    ]);

    println!("Hand: {:?}", hand.concealed);
    println!("Unique non-joker tiles: 11\n");

    // Test WITHOUT pruning (default)
    println!("=== WITHOUT PRUNING (default) ===");
    let mut ai_no_pruning = MCTSAI::new(1000, 42);
    ai_no_pruning.engine_mut().enable_pruning = false;
    
    let discard1 = ai_no_pruning.select_discard(&hand, &visible, &validator);
    println!("Selected discard: {:?}", discard1);
    println!("(Engine explored all 11 possible discards)\n");

    // Test WITH pruning
    println!("=== WITH PRUNING (max_children = 5) ===");
    let mut ai_with_pruning = MCTSAI::new(1000, 42);
    ai_with_pruning.engine_mut().enable_pruning = true;
    ai_with_pruning.engine_mut().max_children = 5;
    
    let discard2 = ai_with_pruning.select_discard(&hand, &visible, &validator);
    println!("Selected discard: {:?}", discard2);
    println!("(Engine explored only top 5 discards by heuristic score)");
    
    println!("\nNote: Both should select reasonable discards, but pruning");
    println!("reduces branching factor from 11 to 5, potentially allowing");
    println!("deeper search within the same time budget.");
}

