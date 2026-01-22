//! Strategic evaluation functions for pattern analysis.

use crate::context::VisibleTiles;
use crate::probability::calculate_probability;
use mahjong_core::event::types::PatternDifficulty;
use mahjong_core::hand::Hand;
use mahjong_core::rules::validator::AnalysisResult;
use mahjong_core::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Strategic evaluation of a hand against a specific pattern.
///
/// Extends `AnalysisResult` with AI-specific metrics like probability,
/// difficulty, and expected value.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct StrategicEvaluation {
    /// The pattern being evaluated.
    pub pattern_id: String,
    /// Specific variation identifier for the pattern.
    pub variation_id: String,

    /// Deficiency from validator (exact tiles needed).
    pub deficiency: i32,

    /// Difficulty-weighted deficiency (accounts for tile scarcity).
    pub difficulty: f64,

    /// Human-readable classification of difficulty.
    pub difficulty_class: PatternDifficulty,

    /// Probability of completing this pattern (0.0-1.0).
    pub probability: f64,

    /// Expected Value: V(pattern) × P(completion).
    pub expected_value: f64,

    /// Pattern score if won.
    pub score: u16,

    /// Is this pattern still viable? (false if required tiles are dead)
    pub viable: bool,

    /// The target histogram for this pattern variation.
    /// Used for tile utility calculations (which tiles matter for this pattern).
    pub target_histogram: Vec<u8>,
}

impl StrategicEvaluation {
    /// Creates a strategic evaluation from a validator's analysis result.
    ///
    /// Enriches the basic deficiency-based analysis with AI-specific metrics:
    /// - **Difficulty**: Weighted by tile scarcity (harder = tiles are rare)
    /// - **Probability**: Likelihood of completing this pattern
    /// - **Expected Value**: `score × probability`
    /// - **Viability**: Can this pattern still be achieved?
    ///
    /// # Arguments
    /// * `analysis` - Result from validator's analyze() method
    /// * `hand` - Current hand
    /// * `visible` - Visible tiles tracker
    /// * `target_histogram` - Pattern's target tile histogram
    ///
    /// # Returns
    /// Strategic evaluation with AI decision-making metrics
    pub fn from_analysis(
        analysis: AnalysisResult,
        hand: &Hand,
        visible: &VisibleTiles,
        target_histogram: &[u8],
    ) -> Self {
        let difficulty = calculate_difficulty(hand, target_histogram, visible);
        let probability = calculate_probability(hand, target_histogram, visible);
        let viable = check_viability(target_histogram, visible);

        let expected_value = if viable {
            (analysis.score as f64) * probability
        } else {
            0.0
        };

        let mut eval = Self {
            pattern_id: analysis.pattern_id,
            variation_id: analysis.variation_id,
            deficiency: analysis.deficiency,
            difficulty,
            difficulty_class: PatternDifficulty::Impossible, // Computed below
            probability,
            expected_value,
            score: analysis.score,
            viable,
            target_histogram: target_histogram.to_vec(),
        };

        // Calculate classification
        eval.difficulty_class = eval.classify_difficulty();

        eval
    }

    /// Classify pattern difficulty based on viability, distance, and probability
    pub fn classify_difficulty(&self) -> PatternDifficulty {
        // Impossible if not viable
        if !self.viable {
            return PatternDifficulty::Impossible;
        }

        // Easy: Close to winning with high probability
        if self.deficiency <= 1 && self.probability >= 0.7 {
            return PatternDifficulty::Easy;
        }

        // Hard: Far from winning or very low probability
        if self.deficiency >= 4 || self.probability < 0.2 {
            return PatternDifficulty::Hard;
        }

        // Medium: Everything else
        PatternDifficulty::Medium
    }
}

/// Calculate difficulty-weighted deficiency for a pattern.
///
/// Formula: C(H) = Σ (count_i × weight_i)
/// where weight_i = 1 / (available_i + 1)
///
/// Higher difficulty = harder to complete (tiles are scarce)
///
/// # Arguments
/// * `hand` - Current hand
/// * `target_histogram` - Target pattern histogram
/// * `visible` - Visible tiles tracker
///
/// # Returns
/// Difficulty score (higher = harder to achieve)
pub fn calculate_difficulty(hand: &Hand, target_histogram: &[u8], visible: &VisibleTiles) -> f64 {
    let mut difficulty = 0.0;

    // Only check the first 35 tiles (not jokers)
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];

        if needed > have {
            let missing = (needed - have) as usize;
            let tile = Tile(i as u8);
            let available = visible.count_available(tile);

            // Weight = 1 / (available + 1)
            // If available = 0 (dead), weight = 1.0 (maximum difficulty)
            // If available = 3 (all remaining), weight = 0.25
            let weight = 1.0 / (available as f64 + 1.0);

            difficulty += (missing as f64) * weight;
        }
    }

    difficulty
}

/// Calculate Expected Value for a pattern.
///
/// EV(pattern) = V(pattern) × P(completion)
///
/// * V(pattern) = score if won
/// * P(completion) = probability of drawing required tiles
pub fn calculate_expected_value(evaluation: &StrategicEvaluation) -> f64 {
    if !evaluation.viable {
        return 0.0;
    }

    (evaluation.score as f64) * evaluation.probability
}

/// Check if a pattern is still viable (all required tiles are available).
///
/// Returns false if any required tile is completely dead (all copies visible).
///
/// # Arguments
/// * `target_histogram` - Pattern's target histogram
/// * `visible` - Visible tiles tracker
///
/// # Returns
/// true if pattern is still achievable, false if dead
///
/// # Examples
///
/// ```
/// use mahjong_ai::context::VisibleTiles;
/// use mahjong_ai::evaluation::check_viability;
/// use mahjong_core::tile::tiles::BAM_1;
///
/// let mut visible = VisibleTiles::new();
/// let mut histogram = vec![0u8; 36];
/// histogram[BAM_1.0 as usize] = 2; // Need 2 BAM_1
///
/// // Pattern is viable at game start
/// assert!(check_viability(&histogram, &visible));
///
/// // After all 4 copies are discarded, pattern becomes dead
/// for _ in 0..4 {
///     visible.add_discard(BAM_1);
/// }
/// assert!(!check_viability(&histogram, &visible));
/// ```
pub fn check_viability(target_histogram: &[u8], visible: &VisibleTiles) -> bool {
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        if needed > 0 {
            let tile = Tile(i as u8);
            let available = visible.count_available(tile);

            if available < needed as usize {
                return false; // Not enough tiles left
            }
        }
    }
    true
}

/// Filter out dead patterns from evaluations.
pub fn filter_dead_patterns(evaluations: Vec<StrategicEvaluation>) -> Vec<StrategicEvaluation> {
    evaluations.into_iter().filter(|e| e.viable).collect()
}

/// Calculate flexibility of a tile (how many viable patterns it appears in).
///
/// Higher flexibility = more strategic value (keep this tile).
///
/// # Arguments
/// * `tile` - The tile to evaluate
/// * `evaluations` - List of pattern evaluations
///
/// # Returns
/// Count of viable patterns that require this tile
pub fn calculate_tile_flexibility(tile: Tile, evaluations: &[StrategicEvaluation]) -> usize {
    let tile_idx = tile.0 as usize;
    evaluations
        .iter()
        .filter(|e| {
            // Pattern must be viable, within reach, and actually use this tile
            e.viable
                && e.deficiency <= 3
                && e.target_histogram.get(tile_idx).copied().unwrap_or(0) > 0
        })
        .count()
}

/// Calculate utility score for a tile based on pattern evaluations.
///
/// U(tile) = Σ I(tile needed by pattern_i) × EV_i
///
/// Only counts patterns where discarding this tile would hurt progress
/// (i.e., pattern needs more of this tile than we currently have).
///
/// # Arguments
/// * `tile` - The tile to evaluate
/// * `evaluations` - List of pattern evaluations
/// * `hand` - Current hand
///
/// # Returns
/// Utility score (higher = more valuable to keep)
pub fn calculate_tile_utility(tile: Tile, evaluations: &[StrategicEvaluation], hand: &Hand) -> f64 {
    let tile_idx = tile.0 as usize;
    let hand_count = hand.counts.get(tile_idx).copied().unwrap_or(0);

    evaluations
        .iter()
        .filter(|e| {
            if !e.viable {
                return false;
            }
            // Only count patterns where we need this tile
            // (pattern requires more than we have, so discarding hurts)
            let pattern_needs = e.target_histogram.get(tile_idx).copied().unwrap_or(0);
            pattern_needs > hand_count
        })
        .map(|e| e.expected_value)
        .sum()
}

#[cfg(test)]
/// Unit tests for strategic evaluation functions and difficulty classification.
mod tests {
    use super::*;
    use mahjong_core::tile::tiles::*;

    #[test]
    fn test_check_viability_viable() {
        let visible = VisibleTiles::new();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 2; // Need 2 BAM_1

        // All tiles available at start
        assert!(check_viability(&histogram, &visible));
    }

    #[test]
    fn test_check_viability_dead() {
        let mut visible = VisibleTiles::new();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 3; // Need 3 BAM_1

        // Make only 2 available by discarding 2
        visible.add_discard(BAM_1);
        visible.add_discard(BAM_1);

        // Can't complete pattern (need 3 but only 2 left)
        assert!(!check_viability(&histogram, &visible));
    }

    #[test]
    fn test_calculate_difficulty_returns_value() {
        let visible = VisibleTiles::new();
        let hand = Hand::empty();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 2;

        // Should return a non-negative difficulty
        let difficulty = calculate_difficulty(&hand, &histogram, &visible);
        assert!(difficulty >= 0.0);
    }

    #[test]
    fn test_filter_dead_patterns() {
        let eval1 = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
            target_histogram: vec![0u8; 42],
        };

        let eval2 = StrategicEvaluation {
            pattern_id: "P2".to_string(),
            variation_id: "V2".to_string(),
            deficiency: 3,
            difficulty: 10.0,
            difficulty_class: PatternDifficulty::Impossible,
            probability: 0.0,
            expected_value: 0.0,
            score: 50,
            viable: false,
            target_histogram: vec![0u8; 42],
        };

        let evaluations = vec![eval1.clone(), eval2];
        let filtered = filter_dead_patterns(evaluations);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].pattern_id, "P1");
    }

    #[test]
    fn test_difficulty_classification_impossible() {
        // Impossible: Not viable
        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Impossible,
            probability: 0.5,
            expected_value: 0.0,
            score: 50,
            viable: false,
            target_histogram: vec![0u8; 42],
        };
        assert_eq!(eval.classify_difficulty(), PatternDifficulty::Impossible);
    }

    #[test]
    fn test_difficulty_classification_easy() {
        // Easy: 1 tile away, high probability (>= 0.7)
        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 1,
            difficulty: 0.5,
            difficulty_class: PatternDifficulty::Easy,
            probability: 0.8,
            expected_value: 40.0,
            score: 50,
            viable: true,
            target_histogram: vec![0u8; 42],
        };
        assert_eq!(eval.classify_difficulty(), PatternDifficulty::Easy);
    }

    #[test]
    fn test_difficulty_classification_hard_distance() {
        // Hard: Far away (>= 4 tiles)
        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 5,
            difficulty: 3.0,
            difficulty_class: PatternDifficulty::Hard,
            probability: 0.3,
            expected_value: 15.0,
            score: 50,
            viable: true,
            target_histogram: vec![0u8; 42],
        };
        assert_eq!(eval.classify_difficulty(), PatternDifficulty::Hard);
    }

    #[test]
    fn test_difficulty_classification_hard_probability() {
        // Hard: Low probability (< 0.2)
        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 2,
            difficulty: 2.0,
            difficulty_class: PatternDifficulty::Hard,
            probability: 0.15,
            expected_value: 7.5,
            score: 50,
            viable: true,
            target_histogram: vec![0u8; 42],
        };
        assert_eq!(eval.classify_difficulty(), PatternDifficulty::Hard);
    }

    #[test]
    fn test_difficulty_classification_medium() {
        // Medium: 2-3 tiles away, moderate probability
        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
            target_histogram: vec![0u8; 42],
        };
        assert_eq!(eval.classify_difficulty(), PatternDifficulty::Medium);
    }

    #[test]
    fn test_tile_flexibility_counts_only_patterns_using_tile() {
        // Pattern 1: needs BAM_1 (index 0)
        let mut hist1 = vec![0u8; 42];
        hist1[BAM_1.0 as usize] = 2;

        // Pattern 2: needs BAM_2 (index 1), not BAM_1
        let mut hist2 = vec![0u8; 42];
        hist2[BAM_2.0 as usize] = 3;

        let eval1 = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
            target_histogram: hist1,
        };

        let eval2 = StrategicEvaluation {
            pattern_id: "P2".to_string(),
            variation_id: "V2".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
            target_histogram: hist2,
        };

        let evaluations = vec![eval1, eval2];

        // BAM_1 appears in only 1 pattern
        assert_eq!(calculate_tile_flexibility(BAM_1, &evaluations), 1);

        // BAM_2 appears in only 1 pattern
        assert_eq!(calculate_tile_flexibility(BAM_2, &evaluations), 1);

        // BAM_3 appears in no patterns
        assert_eq!(calculate_tile_flexibility(BAM_3, &evaluations), 0);
    }

    #[test]
    fn test_tile_utility_only_counts_patterns_needing_more_tiles() {
        // Pattern needs 3x BAM_1
        let mut hist = vec![0u8; 42];
        hist[BAM_1.0 as usize] = 3;

        let eval = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 1,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
            target_histogram: hist,
        };

        let evaluations = vec![eval];

        // Hand with 2x BAM_1 - pattern needs more, so tile has utility
        let hand_with_2 = Hand::new(vec![BAM_1, BAM_1]);
        assert_eq!(
            calculate_tile_utility(BAM_1, &evaluations, &hand_with_2),
            25.0
        );

        // Hand with 3x BAM_1 - pattern is satisfied, discarding won't hurt
        let hand_with_3 = Hand::new(vec![BAM_1, BAM_1, BAM_1]);
        assert_eq!(
            calculate_tile_utility(BAM_1, &evaluations, &hand_with_3),
            0.0
        );

        // Hand with 4x BAM_1 - pattern is satisfied, discarding won't hurt
        let hand_with_4 = Hand::new(vec![BAM_1, BAM_1, BAM_1, BAM_1]);
        assert_eq!(
            calculate_tile_utility(BAM_1, &evaluations, &hand_with_4),
            0.0
        );
    }

    #[test]
    fn test_check_viability_fully_exhausted() {
        // Test 5 (Continuation): Check viability rejects dead tiles
        let mut visible = VisibleTiles::new();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 1;

        // Discard all 4 copies
        for _ in 0..4 {
            visible.add_discard(BAM_1);
        }

        assert!(!check_viability(&histogram, &visible));
    }

    #[test]
    fn test_joker_availability() {
        // Test 6: Joker Edge Cases (Availability)
        let mut visible = VisibleTiles::new();

        // 8 total jokers. Discard 3.
        for _ in 0..3 {
            visible.add_discard(JOKER);
        }

        // Should have 5 left
        assert_eq!(visible.count_available(JOKER), 5);

        // Discard remaining 5
        for _ in 0..5 {
            visible.add_discard(JOKER);
        }

        assert_eq!(visible.count_available(JOKER), 0);
    }
}
