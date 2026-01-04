//! Strategic evaluation functions for pattern analysis.

use crate::context::VisibleTiles;
use crate::probability::calculate_probability;
use mahjong_core::hand::Hand;
use mahjong_core::rules::validator::AnalysisResult;
use mahjong_core::tile::Tile;
use serde::{Deserialize, Serialize};

/// Strategic evaluation of a hand against a specific pattern.
///
/// Extends `AnalysisResult` with AI-specific metrics like probability,
/// difficulty, and expected value.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategicEvaluation {
    /// The pattern being evaluated.
    pub pattern_id: String,
    pub variation_id: String,

    /// Deficiency from validator (exact tiles needed).
    pub deficiency: i32,

    /// Difficulty-weighted deficiency (accounts for tile scarcity).
    pub difficulty: f64,

    /// Probability of completing this pattern (0.0-1.0).
    pub probability: f64,

    /// Expected Value: V(pattern) × P(completion).
    pub expected_value: f64,

    /// Pattern score if won.
    pub score: u16,

    /// Is this pattern still viable? (false if required tiles are dead)
    pub viable: bool,
}

impl StrategicEvaluation {
    /// Create from AnalysisResult and VisibleTiles context.
    ///
    /// # Arguments
    /// * `analysis` - Result from validator's analyze() method
    /// * `hand` - Current hand
    /// * `visible` - Visible tiles tracker
    /// * `target_histogram` - Pattern's target tile histogram
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

        Self {
            pattern_id: analysis.pattern_id,
            variation_id: analysis.variation_id,
            deficiency: analysis.deficiency,
            difficulty,
            probability,
            expected_value,
            score: analysis.score,
            viable,
        }
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
pub fn calculate_tile_flexibility(_tile: Tile, evaluations: &[StrategicEvaluation]) -> usize {
    // This is a simplified version that counts patterns with deficiency <= 3
    // A full implementation would check pattern histograms
    evaluations
        .iter()
        .filter(|e| e.viable && e.deficiency <= 3)
        .count()
}

/// Calculate utility score for a tile based on pattern evaluations.
///
/// U(tile) = Σ I(tile ∈ pattern_i) × w_i
/// where w_i = EV of pattern i
///
/// # Arguments
/// * `tile` - The tile to evaluate
/// * `evaluations` - List of pattern evaluations
/// * `hand` - Current hand
///
/// # Returns
/// Utility score (higher = more valuable to keep)
pub fn calculate_tile_utility(
    _tile: Tile,
    evaluations: &[StrategicEvaluation],
    _hand: &Hand,
) -> f64 {
    // Simplified: Sum EVs of viable patterns
    // A full implementation would check if tile appears in each pattern's histogram
    evaluations
        .iter()
        .filter(|e| e.viable)
        .map(|e| e.expected_value)
        .sum()
}

#[cfg(test)]
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
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
        };

        let eval2 = StrategicEvaluation {
            pattern_id: "P2".to_string(),
            variation_id: "V2".to_string(),
            deficiency: 3,
            difficulty: 10.0,
            probability: 0.0,
            expected_value: 0.0,
            score: 50,
            viable: false,
        };

        let evaluations = vec![eval1.clone(), eval2];
        let filtered = filter_dead_patterns(evaluations);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].pattern_id, "P1");
    }
}
