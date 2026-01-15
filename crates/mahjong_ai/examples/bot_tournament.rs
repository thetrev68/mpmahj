//! Bot vs bot tournament to measure decision consistency of MCTS pruning.
//!
//! Tests if pruning causes bots to make different decisions on the same hands.
//!
//! Run with: cargo run --example bot_tournament --release

use mahjong_ai::strategies::mcts_ai::MCTSAI;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_ai::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use std::time::Instant;

struct BotConfig {
    name: String,
    enable_pruning: bool,
    max_children: usize,
    iterations: usize,
}

struct DecisionTest {
    agreement: usize,
    disagreement: usize,
    total_time_ms: u128,
}

fn load_card() -> UnifiedCard {
    let json = std::fs::read_to_string("data/cards/unified_card2025.json")
        .expect("Load card");
    UnifiedCard::from_json(&json).expect("Parse card")
}

/// Test bots on a set of predefined hands to check decision consistency.
fn test_decisions(config1: &BotConfig, config2: &BotConfig, card: &UnifiedCard) -> DecisionTest {
    let validator = HandValidator::new(card);
    let visible = VisibleTiles::new();
    
    // Test hands with varying complexity
    let test_hands = vec![
        // Simple hand
        Hand::new(vec![BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_2, CRAK_3, JOKER]),
        // Complex hand (11 unique tiles)
        Hand::new(vec![
            BAM_1, BAM_2, BAM_3, BAM_4, BAM_5,
            CRAK_1, CRAK_2, CRAK_3,
            DOT_1, DOT_2, DOT_3,
            JOKER, JOKER,
        ]),
        // Mid-complexity
        Hand::new(vec![
            BAM_1, BAM_1, BAM_2, CRAK_5, CRAK_6,
            DOT_7, DOT_8, DOT_9, JOKER, EAST, WEST,
            GREEN, RED, WHITE,
        ]),
    ];
    
    let mut agreement = 0;
    let mut disagreement = 0;
    let start = Instant::now();
    
    for hand in &test_hands {
        let mut bot1 = MCTSAI::new(config1.iterations, 42);
        bot1.engine_mut().enable_pruning = config1.enable_pruning;
        bot1.engine_mut().max_children = config1.max_children;
        
        let mut bot2 = MCTSAI::new(config2.iterations, 42);
        bot2.engine_mut().enable_pruning = config2.enable_pruning;
        bot2.engine_mut().max_children = config2.max_children;
        
        let discard1 = bot1.select_discard(hand, &visible, &validator);
        let discard2 = bot2.select_discard(hand, &visible, &validator);
        
        if discard1 == discard2 {
            agreement += 1;
        } else {
            disagreement += 1;
        }
    }
    
    DecisionTest {
        agreement,
        disagreement,
        total_time_ms: start.elapsed().as_millis(),
    }
}

fn main() {
    let card = load_card();
    
    let baseline = BotConfig {
        name: "Baseline (No Pruning)".to_string(),
        enable_pruning: false,
        max_children: 0,
        iterations: 500,
    };
    
    let test_configs = vec![
        BotConfig {
            name: "Pruned (max=3)".to_string(),
            enable_pruning: true,
            max_children: 3,
            iterations: 500,
        },
        BotConfig {
            name: "Pruned (max=5)".to_string(),
            enable_pruning: true,
            max_children: 5,
            iterations: 500,
        },
        BotConfig {
            name: "Pruned (max=8)".to_string(),
            enable_pruning: true,
            max_children: 8,
            iterations: 500,
        },
    ];

    println!("=== MCTS PRUNING DECISION CONSISTENCY TEST ===\n");
    println!("Comparing pruned bots against baseline (500 iterations each)");
    println!("Testing on 3 hands with varying complexity\n");

    for test_config in &test_configs {
        println!("Testing: {}", test_config.name);
        println!("  pruning={}, max_children={}", test_config.enable_pruning, test_config.max_children);
        
        let result = test_decisions(&baseline, test_config, &card);
        
        let agreement_pct = (result.agreement as f64 / (result.agreement + result.disagreement) as f64) * 100.0;
        
        println!("  Agreement: {}/{} ({:.1}%)", 
                 result.agreement, 
                 result.agreement + result.disagreement,
                 agreement_pct);
        println!("  Time: {} ms", result.total_time_ms);
        
        if agreement_pct >= 90.0 {
            println!("  ✓ Good - decisions are consistent");
        } else if agreement_pct >= 70.0 {
            println!("  ⚠ Caution - some disagreement");
        } else {
            println!("  ✗ Warning - significant disagreement");
        }
        println!();
    }
    
    println!("NOTE: High agreement means pruning isn't eliminating good moves.");
    println!("Some disagreement is OK if the pruned moves are still reasonable.");
}