//! Hint composition using analysis cache and AI helpers.
//!
//! ```no_run
//! use mahjong_server::hint::HintComposer;
//! use mahjong_server::analysis::HandAnalysis;
//! use mahjong_ai::context::VisibleTiles;
//! use mahjong_core::hand::Hand;
//! use mahjong_core::hint::HintVerbosity;
//! use mahjong_core::rules::validator::HandValidator;
//! # let analysis = HandAnalysis::from_evaluations(Vec::new());
//! # let hand = Hand::new(Vec::new());
//! # let visible = VisibleTiles::new();
//! # let card_json = include_str!("../../../../data/cards/unified_card2025.json");
//! # let card = mahjong_core::rules::card::UnifiedCard::from_json(card_json).unwrap();
//! # let validator = HandValidator::new(&card);
//! let _ = HintComposer::compose(
//!     &analysis,
//!     &hand,
//!     &visible,
//!     &validator,
//!     HintVerbosity::Beginner,
//!     None,
//! );
//! ```

use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::{CallRecommendationContext, HintAdvisor};
use mahjong_core::hand::Hand;
use mahjong_core::hint::{HintData, HintVerbosity, PatternSummary};
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

use crate::analysis::HandAnalysis;

/// Builds hint payloads from analysis results and the current table state.
pub struct HintComposer;

impl HintComposer {
    /// Composes hint data for a player based on current analysis and visibility.
    ///
    /// Each verbosity level uses a different AI engine:
    /// - Beginner: BasicBotAI (simple rule-based)
    /// - Intermediate: GreedyAI (EV maximization)
    /// - Expert: MCTSAI (Monte Carlo Tree Search)
    pub fn compose(
        analysis: &HandAnalysis,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
        verbosity: HintVerbosity,
        call_context: Option<CallContext>,
    ) -> HintData {
        if verbosity == HintVerbosity::Disabled {
            return HintData::empty();
        }

        if analysis.top_patterns.is_empty() || analysis.distance_to_win == i32::MAX {
            return HintData::empty();
        }

        let recommended_discard =
            HintAdvisor::recommend_discard(hand, visible, validator, verbosity);
        let discard_reason = match verbosity {
            HintVerbosity::Beginner => {
                let top = analysis.top_patterns.first();
                top.map(|eval| {
                    format!(
                        "Discard {} - best EV: {} ({} away)",
                        recommended_discard, eval.pattern_id, eval.deficiency
                    )
                })
            }
            HintVerbosity::Intermediate => Some(format!("Discard {}", recommended_discard)),
            HintVerbosity::Expert | HintVerbosity::Disabled => None,
        };

        // Populate best_patterns for all verbosity levels (except Disabled)
        // Each verbosity uses a different AI, so patterns will differ
        let best_patterns = if matches!(verbosity, HintVerbosity::Disabled) {
            Vec::new()
        } else {
            analysis
                .top_patterns
                .iter()
                .map(|eval| PatternSummary {
                    pattern_id: eval.pattern_id.clone(),
                    variation_id: eval.variation_id.clone(),
                    pattern_name: eval.pattern_id.clone(), // Use pattern_id as name
                    probability: eval.probability,
                    score: eval.score,
                    distance: eval.deficiency.max(0) as u8,
                })
                .collect()
        };

        let call_opportunities = if let Some(ctx) = call_context {
            HintAdvisor::recommend_calls(hand, visible, validator, &ctx, verbosity)
        } else {
            Vec::new()
        };

        let defensive_hints = if matches!(
            verbosity,
            HintVerbosity::Beginner | HintVerbosity::Intermediate
        ) {
            vec![HintAdvisor::evaluate_defense(recommended_discard, visible)]
        } else {
            Vec::new()
        };

        let distance_to_win = analysis.distance_to_win.max(0) as u8;
        let tiles_needed_for_win = if distance_to_win <= 2 {
            Self::tiles_needed_for_best_pattern(analysis, hand, validator, visible)
        } else {
            Vec::new()
        };

        HintData {
            recommended_discard: Some(recommended_discard),
            discard_reason,
            best_patterns,
            tiles_needed_for_win,
            distance_to_win,
            hot_hand: distance_to_win <= 1,
            call_opportunities,
            defensive_hints,
        }
    }

    /// Computes a list of tiles needed to complete the best pattern.
    fn tiles_needed_for_best_pattern(
        analysis: &HandAnalysis,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Vec<Tile> {
        let best = analysis.top_patterns.first();
        let Some(best) = best else {
            return Vec::new();
        };
        let Some(target) = validator.histogram_for_variation(&best.variation_id) else {
            return Vec::new();
        };

        let mut missing = Vec::new();
        for (idx, &needed) in target.iter().enumerate() {
            let have = hand.counts.get(idx).copied().unwrap_or(0);
            if needed > have {
                let tile = Tile(idx as u8);
                if !tile.is_joker() && !visible.is_dead(tile) {
                    missing.push(tile);
                }
            }
        }

        missing.sort();
        missing.dedup();
        missing
    }
}

/// Alias to the AI call recommendation context to keep server wiring simple.
pub type CallContext = CallRecommendationContext;
