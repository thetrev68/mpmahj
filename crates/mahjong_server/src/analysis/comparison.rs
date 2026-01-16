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
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_core::hand::Hand;
use mahjong_core::meld::{Meld, MeldType};
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

/// Calculate call opportunities the AI would consider.
///
/// Iterates over all unique tiles and checks if the AI would call them for
/// Pung, Kong, or Quint melds. This is potentially expensive as it requires
/// checking all possible tile types across multiple meld types.
///
/// # Arguments
/// * `strategy` - AI strategy to query
/// * `hand` - Current hand (14 tiles after drawing)
/// * `visible` - Visible tiles context
/// * `validator` - Pattern validator
///
/// # Returns
/// Vector of call opportunities with AI decisions and expected values
fn calculate_call_opportunities(
    strategy: &mut Box<dyn MahjongAI>,
    hand: &Hand,
    visible: &VisibleTiles,
    validator: &HandValidator,
) -> Vec<CallOpportunity> {
    let mut opportunities = Vec::new();

    // Use placeholder values for turn context since this is analysis
    let turn_number = 1;
    let discarded_by = Seat::East;
    let current_seat = Seat::South;

    // Iterate over all possible tile types (0-36)
    for tile_id in 0..37 {
        let tile = Tile::new(tile_id);

        // Skip jokers (can't be called) and blanks
        if tile.is_joker() || tile.is_blank() {
            continue;
        }

        // Check each possible meld type
        for meld_type in [MeldType::Pung, MeldType::Kong, MeldType::Quint] {
            // Only include opportunities where the call is possible
            // Skip if the hand doesn't have enough tiles to form the meld
            let tiles_in_hand = hand.concealed.iter().filter(|&&t| t == tile).count();
            let needed_count = match meld_type {
                MeldType::Pung => 2,  // Need 2 in hand + 1 called = 3 total
                MeldType::Kong => 3,  // Need 3 in hand + 1 called = 4 total
                MeldType::Quint => 4, // Need 4 in hand + 1 called = 5 total
            };

            if tiles_in_hand < needed_count {
                continue; // Can't form this meld
            }

            // Check if the AI would call this tile for this meld type
            let would_call = strategy.should_call(
                hand,
                tile,
                meld_type,
                visible,
                validator,
                turn_number,
                discarded_by,
                current_seat,
            );

            // Calculate expected value if this call were made
            let expected_value_if_called =
                calculate_call_ev(hand, tile, meld_type, visible, validator);

            opportunities.push(CallOpportunity {
                tile,
                meld_type,
                would_call,
                expected_value_if_called,
            });
        }
    }

    opportunities
}

/// Calculate the expected value of a hand after making a call.
///
/// Simulates adding the called tile, exposing the meld, and evaluates
/// the resulting hand against all patterns.
///
/// # Arguments
/// * `hand` - Current hand (14 tiles)
/// * `called_tile` - Tile being called
/// * `meld_type` - Type of meld being formed
/// * `visible` - Visible tiles context
/// * `validator` - Pattern validator
///
/// # Returns
/// Maximum expected value across all viable patterns, or 0.0 if invalid
fn calculate_call_ev(
    hand: &Hand,
    called_tile: Tile,
    meld_type: MeldType,
    visible: &VisibleTiles,
    validator: &HandValidator,
) -> f64 {
    // Create a test hand with the called meld exposed
    let mut test_hand = hand.clone();

    // Determine how many tiles total in the meld
    let meld_size = match meld_type {
        MeldType::Pung => 3,
        MeldType::Kong => 4,
        MeldType::Quint => 5,
    };

    // Remove tiles from hand that will form the meld (excluding the called tile)
    let count_needed = meld_size - 1; // -1 because one tile comes from the call
    let mut meld_tiles = vec![called_tile]; // Start with the called tile

    for _ in 0..count_needed {
        if test_hand.remove_tile(called_tile).is_err() {
            return 0.0; // Invalid call - not enough tiles
        }
        meld_tiles.push(called_tile);
    }

    // Create the exposed meld
    let meld = match Meld::new(meld_type, meld_tiles, Some(called_tile)) {
        Ok(m) => m,
        Err(_) => return 0.0,
    };

    test_hand.exposed.push(meld);

    // Analyze the resulting hand (concealed should now have 11/10/9 tiles)
    let analyses = validator.analyze(&test_hand, 5);

    // Convert to strategic evaluations and find max EV
    analyses
        .into_iter()
        .filter_map(|analysis| {
            let target_histogram = validator.histogram_for_variation(&analysis.variation_id)?;
            let eval =
                StrategicEvaluation::from_analysis(analysis, &test_hand, visible, target_histogram);
            if eval.viable {
                Some(eval.expected_value)
            } else {
                None
            }
        })
        .fold(0.0_f64, f64::max)
}

/// Calculate the expected value of a hand after discarding a specific tile.
///
/// Simulates the discard and evaluates the resulting 13-tile hand against
/// all patterns, returning the maximum expected value across viable patterns.
///
/// # Arguments
/// * `hand` - Current hand (14 tiles)
/// * `discard` - Tile to discard
/// * `visible` - Visible tiles context
/// * `validator` - Pattern validator
///
/// # Returns
/// Maximum expected value across all viable patterns, or 0.0 if hand is invalid
fn calculate_post_discard_ev(
    hand: &Hand,
    discard: Tile,
    visible: &VisibleTiles,
    validator: &HandValidator,
) -> f64 {
    // Create a copy and simulate the discard
    let mut test_hand = hand.clone();
    if test_hand.remove_tile(discard).is_err() {
        return 0.0;
    }

    // Analyze the resulting hand against top patterns
    let analyses = validator.analyze(&test_hand, 5);

    // Convert to strategic evaluations and find max EV
    analyses
        .into_iter()
        .filter_map(|analysis| {
            let target_histogram = validator.histogram_for_variation(&analysis.variation_id)?;
            let eval =
                StrategicEvaluation::from_analysis(analysis, &test_hand, visible, target_histogram);
            if eval.viable {
                Some(eval.expected_value)
            } else {
                None
            }
        })
        .fold(0.0_f64, f64::max)
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

        // Populate call opportunities for analysis comparisons
        let call_opportunities = calculate_call_opportunities(strategy, hand, visible, validator);

        // Calculate expected value of the hand after discarding the recommended tile
        let expected_value = calculate_post_discard_ev(hand, discard_tile, visible, validator);

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

    #[test]
    fn test_expected_value_is_calculated() {
        // Create a simple hand
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, EAST, SOUTH, WEST,
            NORTH, FLOWER,
        ]);

        let visible = VisibleTiles::new();

        let json = include_str!("../../../../data/cards/unified_card2025.json");
        let card = mahjong_core::rules::card::UnifiedCard::from_json(json).unwrap();
        let validator = mahjong_core::rules::validator::HandValidator::new(&card);

        let mut strategies: Vec<Box<dyn MahjongAI>> = vec![create_ai(Difficulty::Hard, 42)];
        let strategy_names = vec!["Greedy"];

        let results = run_strategy_comparison(
            &hand,
            &visible,
            &validator,
            &mut strategies,
            &strategy_names,
        );

        let greedy_rec = results.get("Greedy").unwrap();

        // The expected_value field should be populated (may be 0.0 for poor hands,
        // but it should be a finite number that was actually calculated)
        assert!(
            greedy_rec.expected_value.is_finite(),
            "Expected value should be a finite number, got {}",
            greedy_rec.expected_value
        );

        // Also verify the discard is valid
        assert!(
            hand.concealed.contains(&greedy_rec.discard_tile),
            "Discard should be from the hand"
        );
    }

    #[test]
    fn test_calculate_post_discard_ev_helper() {
        let hand = Hand::new(vec![
            BAM_1, BAM_1, BAM_1, CRAK_2, CRAK_2, CRAK_2, DOT_3, DOT_3, DOT_3, EAST, EAST, EAST,
            JOKER, FLOWER,
        ]);

        let visible = VisibleTiles::new();

        let json = include_str!("../../../../data/cards/unified_card2025.json");
        let card = mahjong_core::rules::card::UnifiedCard::from_json(json).unwrap();
        let validator = mahjong_core::rules::validator::HandValidator::new(&card);

        // EV after discarding FLOWER should be non-negative
        let ev = calculate_post_discard_ev(&hand, FLOWER, &visible, &validator);
        assert!(ev >= 0.0, "EV should be non-negative, got {}", ev);

        // EV for a tile not in hand should be 0
        let ev_invalid = calculate_post_discard_ev(&hand, SOUTH, &visible, &validator);
        assert_eq!(ev_invalid, 0.0, "EV for invalid discard should be 0.0");
    }

    #[test]
    fn test_call_opportunities_populated() {
        // Create a hand with multiple tiles of the same type to enable calls
        let hand = Hand::new(vec![
            BAM_1, BAM_1, BAM_1, CRAK_2, CRAK_2, CRAK_2, DOT_3, DOT_3, DOT_3, EAST, EAST, EAST,
            JOKER, FLOWER,
        ]);

        let visible = VisibleTiles::new();

        let json = include_str!("../../../../data/cards/unified_card2025.json");
        let card = mahjong_core::rules::card::UnifiedCard::from_json(json).unwrap();
        let validator = mahjong_core::rules::validator::HandValidator::new(&card);

        // Create a strategy
        let mut strategies: Vec<Box<dyn MahjongAI>> = vec![create_ai(Difficulty::Hard, 42)];
        let strategy_names = vec!["Greedy"];

        // Run comparison
        let results = run_strategy_comparison(
            &hand,
            &visible,
            &validator,
            &mut strategies,
            &strategy_names,
        );

        let greedy_rec = results.get("Greedy").unwrap();

        // Verify call opportunities are populated (should have some since hand has multiple sets)
        // The hand has 3 BAM_1, 3 CRAK_2, 3 DOT_3, 3 EAST, so should have call opportunities
        assert!(
            !greedy_rec.call_opportunities.is_empty(),
            "Call opportunities should be populated for a hand with multiple matching tiles"
        );

        // Verify each call opportunity has valid structure
        for opp in &greedy_rec.call_opportunities {
            // Expected value should be finite
            assert!(
                opp.expected_value_if_called.is_finite(),
                "Expected value should be finite, got {}",
                opp.expected_value_if_called
            );

            // Tile should not be joker or blank
            assert!(
                !opp.tile.is_joker() && !opp.tile.is_blank(),
                "Call opportunity should not be for joker or blank"
            );
        }
    }
}
