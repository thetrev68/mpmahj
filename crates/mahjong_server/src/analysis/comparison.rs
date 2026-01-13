//! AI strategy comparison for debugging and development.
//!
//! This module provides functionality to run multiple AI strategies on the same
//! game state and log their recommendations for comparison and analysis.
//!
//! Only enabled when DEBUG_AI_COMPARISON=1 environment variable is set.
//!
//! ```no_run
//! use mahjong_server::analysis::comparison::run_strategy_comparison;
//! use mahjong_ai::r#trait::create_ai;
//! use mahjong_ai::Difficulty;
//! use mahjong_ai::context::VisibleTiles;
//! use mahjong_core::hand::Hand;
//! use mahjong_core::rules::card::UnifiedCard;
//! use mahjong_core::rules::validator::HandValidator;
//! let hand = Hand::new(vec![]);
//! let visible = VisibleTiles::new();
//! let card_json = include_str!("../../../../data/cards/unified_card2025.json");
//! let card = UnifiedCard::from_json(card_json).unwrap();
//! let validator = HandValidator::new(&card);
//! let mut strategies = vec![create_ai(Difficulty::Easy, 1)];
//! let _ = run_strategy_comparison(&hand, &visible, &validator, &mut strategies, &["BasicBot"]);
//! ```

use mahjong_ai::context::VisibleTiles;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_core::hand::Hand;
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents what a single AI strategy would do in a given situation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    /// Which tile the AI would discard from the current hand
    pub discard_tile: Tile,

    /// Call opportunities the AI evaluated (empty in MVP)
    pub call_opportunities: Vec<CallOpportunity>,

    /// Expected value of the recommended discard
    pub expected_value: f64,

    /// Debug reasoning (optional, human-readable explanation)
    pub reasoning: Option<String>,
}

/// Represents a potential call the AI considered.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallOpportunity {
    /// The tile that could be called
    pub tile: Tile,

    /// Type of meld this would create (Pung/Kong/Quint)
    pub meld_type: MeldType,

    /// Whether the AI would actually make this call
    pub would_call: bool,

    /// Expected value if this call were made
    pub expected_value_if_called: f64,
}

/// Log entry for a single turn comparing multiple AI strategies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisLogEntry {
    /// Turn number (using discard pile length as proxy)
    pub turn_number: u32,

    /// Seat being analyzed
    pub seat: Seat,

    /// Snapshot of the hand at this decision point
    pub hand_snapshot: Hand,

    /// Strategy name → Recommendation
    /// Keys: "Greedy", "MCTS", "BasicBot"
    pub recommendations: HashMap<String, Recommendation>,
}

/// Run multiple AI strategies and collect their recommendations.
///
/// This function runs each AI strategy on the same game state and logs
/// what each strategy would recommend. Used for debugging and comparison.
///
/// # Arguments
/// * `hand` - Current hand to analyze (14 tiles after drawing)
/// * `visible` - Visible tile context (discards, exposed melds)
/// * `validator` - Pattern validator for analysis
/// * `strategies` - Mutable slice of AI implementations
/// * `strategy_names` - Corresponding names for each strategy (must match length)
///
/// # Returns
/// HashMap of strategy name → Recommendation
///
/// # Panics
/// Panics if strategies.len() != strategy_names.len()
pub fn run_strategy_comparison(
    hand: &Hand,
    visible: &VisibleTiles,
    validator: &HandValidator,
    strategies: &mut [Box<dyn MahjongAI>],
    strategy_names: &[&str],
) -> HashMap<String, Recommendation> {
    assert_eq!(
        strategies.len(),
        strategy_names.len(),
        "strategies and strategy_names must have same length"
    );

    let mut results = HashMap::new();

    for (strategy, name) in strategies.iter_mut().zip(strategy_names) {
        // Get discard recommendation
        let discard_tile = strategy.select_discard(hand, visible, validator);

        // TODO: Populate call opportunities for analysis comparisons.
        // Would require iterating over all possible discards and checking should_call()
        // for each (Pung, Kong, Quint) combination. Too expensive for debug logging.
        let call_opportunities = vec![];

        // TODO: Populate expected value by running validator analysis.
        let expected_value = 0.0;

        let recommendation = Recommendation {
            discard_tile,
            call_opportunities,
            expected_value,
            reasoning: Some(format!("{} strategy recommendation", name)),
        };

        results.insert(name.to_string(), recommendation);
    }

    results
}

#[cfg(test)]
mod tests {
    //! Unit tests for AI comparison helpers.

    use super::*;
    use mahjong_ai::r#trait::create_ai;
    use mahjong_ai::Difficulty;
    use mahjong_core::hand::Hand;
    use mahjong_core::tile::tiles::*;

    #[test]
    fn test_run_strategy_comparison_basic() {
        // Create a simple hand
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, EAST, SOUTH, WEST,
            NORTH, FLOWER,
        ]);

        let visible = VisibleTiles::new();

        // Load validator
        let json = include_str!("../../../../data/cards/unified_card2025.json");
        let card = mahjong_core::rules::card::UnifiedCard::from_json(json).unwrap();
        let validator = mahjong_core::rules::validator::HandValidator::new(&card);

        // Create strategies
        let mut strategies: Vec<Box<dyn MahjongAI>> = vec![
            create_ai(Difficulty::Easy, 42),
            create_ai(Difficulty::Hard, 42),
        ];
        let strategy_names = vec!["BasicBot", "Greedy"];

        // Run comparison
        let results = run_strategy_comparison(
            &hand,
            &visible,
            &validator,
            &mut strategies,
            &strategy_names,
        );

        // Verify results
        assert_eq!(results.len(), 2);
        assert!(results.contains_key("BasicBot"));
        assert!(results.contains_key("Greedy"));

        // Each recommendation should have a discard
        for (name, rec) in &results {
            assert!(
                hand.concealed.contains(&rec.discard_tile),
                "{} recommended {:?} which is not in hand",
                name,
                rec.discard_tile
            );
        }
    }

    #[test]
    #[should_panic(expected = "strategies and strategy_names must have same length")]
    fn test_run_strategy_comparison_panics_on_length_mismatch() {
        let hand = Hand::new(vec![]);
        let visible = VisibleTiles::new();
        let json = include_str!("../../../../data/cards/unified_card2025.json");
        let card = mahjong_core::rules::card::UnifiedCard::from_json(json).unwrap();
        let validator = mahjong_core::rules::validator::HandValidator::new(&card);

        let mut strategies: Vec<Box<dyn MahjongAI>> = vec![create_ai(Difficulty::Easy, 42)];
        let strategy_names = vec!["BasicBot", "Greedy"]; // ❌ Length mismatch

        run_strategy_comparison(
            &hand,
            &visible,
            &validator,
            &mut strategies,
            &strategy_names,
        );
    }

    #[test]
    fn test_recommendation_serialization() {
        use mahjong_core::tile::tiles::*;

        let rec = Recommendation {
            discard_tile: BAM_1,
            call_opportunities: vec![],
            expected_value: 42.5,
            reasoning: Some("Test reasoning".to_string()),
        };

        // Test JSON serialization
        let json = serde_json::to_string(&rec).unwrap();
        let deserialized: Recommendation = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.discard_tile, BAM_1);
        assert_eq!(deserialized.expected_value, 42.5);
    }

    #[test]
    fn test_analysis_log_entry_creation() {
        use mahjong_core::hand::Hand;
        use mahjong_core::player::Seat;
        use mahjong_core::tile::tiles::*;

        let hand = Hand::new(vec![BAM_1; 14]);

        let mut recommendations = HashMap::new();
        recommendations.insert(
            "TestAI".to_string(),
            Recommendation {
                discard_tile: BAM_1,
                call_opportunities: vec![],
                expected_value: 0.0,
                reasoning: None,
            },
        );

        let entry = AnalysisLogEntry {
            turn_number: 5,
            seat: Seat::East,
            hand_snapshot: hand.clone(),
            recommendations: recommendations.clone(),
        };

        assert_eq!(entry.turn_number, 5);
        assert_eq!(entry.seat, Seat::East);
        assert_eq!(entry.hand_snapshot.concealed.len(), 14);
        assert_eq!(entry.recommendations.len(), 1);
    }
}
