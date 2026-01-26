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
//!     None, // charleston_stage
//! );
//! ```

use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::{CallRecommendationContext, HintAdvisor};
use mahjong_ai::r#trait::{BasicBotAI, MahjongAI};
use mahjong_ai::strategies::greedy::GreedyAI;
use mahjong_ai::strategies::mcts_ai::MCTSAI;
use mahjong_core::flow::charleston::CharlestonStage;
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
    ///
    /// # Charleston Support
    /// When `charleston_stage` is `Some`, the AI will recommend 3 tiles to pass
    /// and populate `charleston_pass_recommendations` in the returned `HintData`.
    pub fn compose(
        analysis: &HandAnalysis,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
        verbosity: HintVerbosity,
        call_context: Option<CallContext>,
        charleston_stage: Option<CharlestonStage>,
    ) -> HintData {
        if verbosity == HintVerbosity::Disabled {
            return HintData::empty();
        }

        if analysis.top_patterns.is_empty() || analysis.distance_to_win == i32::MAX {
            return HintData::empty();
        }

        let discard_rec =
            HintAdvisor::recommend_discard_with_scores(hand, visible, validator, verbosity);
        let recommended_discard = discard_rec.tile;
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

        // Charleston recommendations (if in Charleston phase)
        let (charleston_pass_recommendations, tile_scores, utility_scores) = if let Some(stage) =
            charleston_stage
        {
            match verbosity {
                HintVerbosity::Beginner => {
                    let mut ai = BasicBotAI::new(0);
                    let tiles = ai.select_charleston_tiles(hand, stage, visible, validator);
                    (
                        tiles,
                        std::collections::HashMap::new(),
                        std::collections::HashMap::new(),
                    )
                }
                HintVerbosity::Intermediate => {
                    let mut ai = GreedyAI::new(0);
                    let tiles = ai.select_charleston_tiles(hand, stage, visible, validator);
                    let scores = ai.get_charleston_tile_scores(hand, visible, validator);
                    (tiles, scores, std::collections::HashMap::new())
                }
                HintVerbosity::Expert => {
                    // MCTS delegates to Greedy for Charleston
                    let mut mcts_ai = MCTSAI::new(1000, 0);
                    let tiles = mcts_ai.select_charleston_tiles(hand, stage, visible, validator);
                    // Get scores from Greedy (which MCTS uses for Charleston)
                    let mut greedy_ai = GreedyAI::new(0);
                    let scores = greedy_ai.get_charleston_tile_scores(hand, visible, validator);
                    (tiles, scores, std::collections::HashMap::new())
                }
                HintVerbosity::Disabled => (
                    Vec::new(),
                    std::collections::HashMap::new(),
                    std::collections::HashMap::new(),
                ),
            }
        } else {
            // Regular gameplay - get both MCTS and utility scores from the DiscardRecommendation
            let (mcts_scores, utility_scores) = if discard_rec.tile_scores.is_empty() {
                match verbosity {
                    HintVerbosity::Intermediate => {
                        let mut ai = GreedyAI::new(0);
                        let scores = ai.get_discard_tile_scores(hand, visible, validator);
                        (scores, std::collections::HashMap::new())
                    }
                    HintVerbosity::Expert => {
                        let mut ai = MCTSAI::new(1000, 0);
                        let mcts = ai.get_discard_tile_scores(hand, visible, validator);
                        let utility = ai.get_tile_utility_scores(hand, visible, validator);
                        (mcts, utility)
                    }
                    _ => (
                        std::collections::HashMap::new(),
                        std::collections::HashMap::new(),
                    ),
                }
            } else {
                (
                    discard_rec.tile_scores.clone(),
                    discard_rec.utility_scores.clone(),
                )
            };
            (Vec::new(), mcts_scores, utility_scores)
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
            charleston_pass_recommendations,
            tile_scores,
            utility_scores,
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
