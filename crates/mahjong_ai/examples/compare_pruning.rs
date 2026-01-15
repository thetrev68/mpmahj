//! Quick comparison of MCTS with/without pruning on same hand.
//!
//! Run with: cargo run --example compare_pruning --release

use mahjong_ai::strategies::mcts_ai::MCTSAI;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_ai::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use std::time::Instant;

fn load_card() -> UnifiedCard {
    let json = std::fs::read_to_string("data/cards/unified_card2025.json")
        .expect("Load card");
    UnifiedCard::from_json(&json).expect("Parse card")
}

fn main() {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    // Complex hand with 11 unique tiles
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, BAM_4, BAM_5,
        CRAK_1, CRAK_2, CRAK_3,
        DOT_1, DOT_2, DOT_3,
        JOKER, JOKER,
    ]);

    println!("=== MCTS PRUNING COMPARISON ===\n");
    println!("Hand: {} unique non-joker tiles", 11);
    println!("MCTS iterations: 1000\n");

    // Test 1: No pruning
    println!("Test 1: WITHOUT PRUNING");
    println!("------------------------");
    let mut ai_baseline = MCTSAI::new(1000, 42);
    ai_baseline.engine_mut().enable_pruning = false;
    
    let start = Instant::now();
    let discard1 = ai_baseline.select_discard(&hand, &visible, &validator);
    let time1 = start.elapsed();
    
    println!("Decision: {:?}", discard1);
    println!("Time: {:?}", time1);
    println!("Branching factor: 11 (all tiles explored)\n");

    // Test 2: With pruning (max 5)
    println!("Test 2: WITH PRUNING (max_children = 5)");
    println!("----------------------------------------");
    let mut ai_pruned5 = MCTSAI::new(1000, 42);
    ai_pruned5.engine_mut().enable_pruning = true;
    ai_pruned5.engine_mut().max_children = 5;
    
    let start = Instant::now();
    let discard2 = ai_pruned5.select_discard(&hand, &visible, &validator);
    let time2 = start.elapsed();
    
    println!("Decision: {:?}", discard2);
    println!("Time: {:?}", time2);
    println!("Branching factor: 5 (top 5 by heuristic)\n");

    // Test 3: With pruning (max 8)
    println!("Test 3: WITH PRUNING (max_children = 8)");
    println!("----------------------------------------");
    let mut ai_pruned8 = MCTSAI::new(1000, 42);
    ai_pruned8.engine_mut().enable_pruning = true;
    ai_pruned8.engine_mut().max_children = 8;
    
    let start = Instant::now();
    let discard3 = ai_pruned8.select_discard(&hand, &visible, &validator);
    let time3 = start.elapsed();
    
    println!("Decision: {:?}", discard3);
    println!("Time: {:?}", time3);
    println!("Branching factor: 8 (top 8 by heuristic)\n");

    // Summary
    println!("=== SUMMARY ===");
    let speedup5 = time1.as_micros() as f64 / time2.as_micros() as f64;
    let speedup8 = time1.as_micros() as f64 / time3.as_micros() as f64;
    
    println!("Pruning (max=5) speedup: {:.2}x", speedup5);
    println!("Pruning (max=8) speedup: {:.2}x", speedup8);
    
    if discard1 == discard2 && discard2 == discard3 {
        println!("✓ All configurations selected same move");
    } else {
        println!("⚠ Different moves selected:");
        println!("  No pruning: {:?}", discard1);
        println!("  Pruned (5): {:?}", discard2);
        println!("  Pruned (8): {:?}", discard3);
    }
    
    println!("\nNote: Run with --release for accurate timing measurements");
}

