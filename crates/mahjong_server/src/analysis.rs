//! Always-On Analyst - Strategic hand analysis integrated into the game loop.
//!
//! This module provides automatic hand analysis that runs after state changes,
//! powering bot decision-making, pattern viability tracking, and future hint systems.
//!
//! ## Architecture
//!
//! - `HandAnalysis`: Cached analysis results for a single player
//! - `AnalysisConfig`: Configuration for when and how analysis runs
//! - `AnalysisMode`: Trigger strategy (AlwaysOn, ActivePlayerOnly, OnDemand)
//!
//! ## Usage
//!
//! Analysis is triggered automatically by the Room after specific game events:
//! - TilesDealt (initial hand)
//! - TurnChanged (player's turn starts)
//! - DrawTile (player draws a tile)
//! - MeldExposed (hand composition or viability changes)
//!
//! Results are cached in `Room::analysis_cache` and sent to clients via
//! `HandAnalysisUpdated` events (delta updates) or `FullAnalysis` events (on request).

use chrono::{DateTime, Utc};
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_core::player::Seat;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Analysis results for a single player's hand.
///
/// This structure caches the most recent analysis to avoid redundant computation.
/// It stores both the full evaluation list and pre-computed summaries for quick access.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandAnalysis {
    /// When this analysis was performed
    pub timestamp: DateTime<Utc>,

    /// All pattern evaluations (sorted by expected_value descending)
    pub evaluations: Vec<StrategicEvaluation>,

    /// Top 3 most viable patterns (by expected value)
    pub top_patterns: Vec<StrategicEvaluation>,

    /// Critical pattern IDs (top patterns that need tracking)
    /// The actual tiles can be extracted from histograms when needed via validator
    pub top_pattern_ids: Vec<String>,

    /// Minimum deficiency across all viable patterns
    /// (0 = mahjong, 1 = one tile away, etc.)
    pub distance_to_win: i32,

    /// Count of viable patterns (viable == true)
    pub viable_count: usize,

    /// Count of impossible patterns (viable == false)
    pub impossible_count: usize,
}

impl HandAnalysis {
    /// Create a new HandAnalysis from a list of evaluations.
    ///
    /// This constructor:
    /// 1. Sorts evaluations by expected_value (descending)
    /// 2. Extracts top 3 patterns
    /// 3. Calculates distance_to_win (minimum deficiency)
    /// 4. Counts viable vs impossible patterns
    /// 5. Builds critical_tiles set (tiles needed for top patterns)
    ///
    /// # Arguments
    /// * `evaluations` - All pattern evaluations from the validator
    ///
    /// # Returns
    /// A fully-populated HandAnalysis ready for caching
    pub fn from_evaluations(mut evaluations: Vec<StrategicEvaluation>) -> Self {
        // Sort by expected value (highest first)
        evaluations.sort_by(|a, b| {
            b.expected_value
                .partial_cmp(&a.expected_value)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Calculate viable/impossible counts
        let viable_count = evaluations.iter().filter(|e| e.viable).count();
        let impossible_count = evaluations.len() - viable_count;

        // Extract top 3 viable patterns
        let top_patterns: Vec<_> = evaluations
            .iter()
            .filter(|e| e.viable)
            .take(3)
            .cloned()
            .collect();

        // Calculate minimum deficiency (distance to win)
        let distance_to_win = evaluations
            .iter()
            .filter(|e| e.viable)
            .map(|e| e.deficiency)
            .min()
            .unwrap_or(i32::MAX);

        // Store top pattern IDs for quick reference
        // (actual tile extraction happens during game loop when validator is available)
        let top_pattern_ids = top_patterns
            .iter()
            .map(|e| e.variation_id.clone())
            .collect();

        Self {
            timestamp: Utc::now(),
            evaluations,
            top_patterns,
            top_pattern_ids,
            distance_to_win,
            viable_count,
            impossible_count,
        }
    }

    /// Check if this analysis has changed significantly compared to a previous one.
    ///
    /// Used to determine whether to emit a `HandAnalysisUpdated` event (delta logic).
    ///
    /// Significant changes:
    /// - Distance to win changed by ≥2 tiles
    /// - Top 3 patterns changed (different pattern IDs)
    /// - Viable count changed by >5
    ///
    /// # Arguments
    /// * `other` - Previous analysis to compare against
    ///
    /// # Returns
    /// true if changes warrant an event broadcast
    pub fn has_significant_change(&self, other: &HandAnalysis) -> bool {
        // Distance to win changed significantly
        if (self.distance_to_win - other.distance_to_win).abs() >= 2 {
            return true;
        }

        // Top patterns changed
        if self.top_patterns.len() != other.top_patterns.len() {
            return true;
        }

        for (a, b) in self.top_patterns.iter().zip(other.top_patterns.iter()) {
            if a.pattern_id != b.pattern_id || a.variation_id != b.variation_id {
                return true;
            }
        }

        // Viable count changed significantly
        if (self.viable_count as i32 - other.viable_count as i32).abs() > 5 {
            return true;
        }

        false
    }

    /// Get a summary suitable for lightweight event broadcast.
    ///
    /// Returns only essential information (top 3 patterns, counts, distance).
    /// Full evaluations can be requested separately via GetAnalysis command.
    pub fn to_summary(&self) -> HandAnalysisSummary {
        HandAnalysisSummary {
            distance_to_win: self.distance_to_win,
            top_patterns: self
                .top_patterns
                .iter()
                .map(|e| PatternSummary {
                    pattern_id: e.pattern_id.clone(),
                    variation_id: e.variation_id.clone(),
                    deficiency: e.deficiency,
                    probability: e.probability,
                    score: e.score,
                    viable: e.viable,
                })
                .collect(),
            viable_count: self.viable_count,
            impossible_count: self.impossible_count,
        }
    }
}

/// Lightweight summary of hand analysis for event broadcast.
///
/// This is sent to clients via `HandAnalysisUpdated` events.
/// It contains only top-level metrics and top 3 patterns to minimize bandwidth.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandAnalysisSummary {
    pub distance_to_win: i32,
    pub top_patterns: Vec<PatternSummary>,
    pub viable_count: usize,
    pub impossible_count: usize,
}

/// Summary of a single pattern for lightweight broadcast.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternSummary {
    pub pattern_id: String,
    pub variation_id: String,
    pub deficiency: i32,
    pub probability: f64,
    pub score: u16,
    pub viable: bool,
}

/// Configuration for when and how hand analysis runs.
///
/// This is stored in `Room` and controls the analysis trigger strategy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisConfig {
    /// When to trigger analysis
    pub mode: AnalysisMode,

    /// Maximum patterns to evaluate (for performance control)
    /// Default: 500 (all patterns in standard NMJL card)
    pub max_patterns: usize,

    /// Maximum time per analysis in milliseconds
    /// If exceeded, analysis is skipped and cached result is reused
    /// Default: 100ms
    pub timeout_ms: u64,
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        Self {
            mode: AnalysisMode::ActivePlayerOnly, // Conservative default
            max_patterns: 500,
            timeout_ms: 100,
        }
    }
}

/// Analysis trigger strategy.
///
/// Determines when the always-on analyst runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnalysisMode {
    /// Analyze all 4 players after every relevant state change
    /// (TurnChanged, TileDrawn, MeldExposed, etc.)
    ///
    /// Use case: Real-time pattern viability for all players
    /// Performance: ~200ms per game event (4 players × 50ms)
    AlwaysOn,

    /// Analyze only the active player when their turn starts
    ///
    /// Use case: Bot decision-making, turn-based hints
    /// Performance: ~50ms per turn change
    /// **This is the default mode for MVP**
    ActivePlayerOnly,

    /// Never trigger automatic analysis
    /// Analysis only runs when explicitly requested via GetAnalysis command
    ///
    /// Use case: Performance-constrained environments, testing
    OnDemand,
}

/// Per-player analysis cache stored in Room.
///
/// Maps each seat to their most recent HandAnalysis.
/// This cache is invalidated and recomputed when:
/// - The player draws or discards a tile
/// - The player exposes a meld
/// - A new turn starts (in ActivePlayerOnly mode)
/// - Any state change occurs (in AlwaysOn mode)
pub type AnalysisCache = HashMap<Seat, HandAnalysis>;

#[cfg(test)]
mod tests {
    use super::*;

    fn make_evaluation(
        pattern_id: &str,
        deficiency: i32,
        probability: f64,
        score: u16,
        viable: bool,
    ) -> StrategicEvaluation {
        StrategicEvaluation {
            pattern_id: pattern_id.to_string(),
            variation_id: format!("{}_v1", pattern_id),
            deficiency,
            difficulty: deficiency as f64,
            probability,
            expected_value: (score as f64) * probability,
            score,
            viable,
        }
    }

    #[test]
    fn test_hand_analysis_from_evaluations_sorts_by_expected_value() {
        let evals = vec![
            make_evaluation("P1", 3, 0.2, 50, true), // EV = 10
            make_evaluation("P2", 1, 0.8, 50, true), // EV = 40 (best)
            make_evaluation("P3", 2, 0.5, 50, true), // EV = 25
        ];

        let analysis = HandAnalysis::from_evaluations(evals);

        assert_eq!(analysis.evaluations[0].pattern_id, "P2");
        assert_eq!(analysis.evaluations[1].pattern_id, "P3");
        assert_eq!(analysis.evaluations[2].pattern_id, "P1");
    }

    #[test]
    fn test_hand_analysis_calculates_top_patterns() {
        let evals = vec![
            make_evaluation("P1", 1, 0.8, 50, true),  // Top 1
            make_evaluation("P2", 2, 0.6, 50, true),  // Top 2
            make_evaluation("P3", 3, 0.4, 50, true),  // Top 3
            make_evaluation("P4", 4, 0.2, 50, true),  // Not in top 3
            make_evaluation("P5", 5, 0.0, 50, false), // Dead
        ];

        let analysis = HandAnalysis::from_evaluations(evals);

        assert_eq!(analysis.top_patterns.len(), 3);
        assert_eq!(analysis.top_patterns[0].pattern_id, "P1");
        assert_eq!(analysis.top_patterns[1].pattern_id, "P2");
        assert_eq!(analysis.top_patterns[2].pattern_id, "P3");
    }

    #[test]
    fn test_hand_analysis_calculates_distance_to_win() {
        let evals = vec![
            make_evaluation("P1", 3, 0.5, 50, true),
            make_evaluation("P2", 1, 0.8, 50, true), // Minimum deficiency
            make_evaluation("P3", 2, 0.6, 50, true),
        ];

        let analysis = HandAnalysis::from_evaluations(evals);

        assert_eq!(analysis.distance_to_win, 1);
    }

    #[test]
    fn test_hand_analysis_counts_viable_patterns() {
        let evals = vec![
            make_evaluation("P1", 1, 0.8, 50, true),
            make_evaluation("P2", 2, 0.6, 50, true),
            make_evaluation("P3", 10, 0.0, 50, false),
            make_evaluation("P4", 10, 0.0, 50, false),
        ];

        let analysis = HandAnalysis::from_evaluations(evals);

        assert_eq!(analysis.viable_count, 2);
        assert_eq!(analysis.impossible_count, 2);
    }

    #[test]
    fn test_has_significant_change_detects_distance_change() {
        let old = HandAnalysis::from_evaluations(vec![make_evaluation("P1", 5, 0.5, 50, true)]);

        let new = HandAnalysis::from_evaluations(vec![make_evaluation("P1", 3, 0.5, 50, true)]);

        assert!(new.has_significant_change(&old)); // 5 → 3 is ≥2 change
    }

    #[test]
    fn test_has_significant_change_detects_pattern_change() {
        let old = HandAnalysis::from_evaluations(vec![
            make_evaluation("P1", 1, 0.9, 50, true),
            make_evaluation("P2", 2, 0.8, 50, true),
        ]);

        let new = HandAnalysis::from_evaluations(vec![
            make_evaluation("P3", 1, 0.9, 50, true), // Different pattern now top
            make_evaluation("P2", 2, 0.8, 50, true),
        ]);

        assert!(new.has_significant_change(&old));
    }

    #[test]
    fn test_has_significant_change_ignores_small_changes() {
        let old = HandAnalysis::from_evaluations(vec![
            make_evaluation("P1", 3, 0.5, 50, true),
            make_evaluation("P2", 4, 0.4, 50, true),
        ]);

        let new = HandAnalysis::from_evaluations(vec![
            make_evaluation("P1", 3, 0.5, 50, true), // Same patterns
            make_evaluation("P2", 4, 0.4, 50, true),
        ]);

        assert!(!new.has_significant_change(&old));
    }

    #[test]
    fn test_to_summary_creates_lightweight_summary() {
        let evals = vec![
            make_evaluation("P1", 1, 0.8, 50, true),
            make_evaluation("P2", 2, 0.6, 50, true),
        ];

        let analysis = HandAnalysis::from_evaluations(evals);
        let summary = analysis.to_summary();

        assert_eq!(summary.distance_to_win, 1);
        assert_eq!(summary.top_patterns.len(), 2);
        assert_eq!(summary.viable_count, 2);
        assert_eq!(summary.impossible_count, 0);
    }

    #[test]
    fn test_analysis_config_default() {
        let config = AnalysisConfig::default();

        assert_eq!(config.mode, AnalysisMode::ActivePlayerOnly);
        assert_eq!(config.max_patterns, 500);
        assert_eq!(config.timeout_ms, 100);
    }
}
