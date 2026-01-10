//! Hint composition using analysis_cache and AI helpers.

use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::HintAdvisor;
use mahjong_core::hand::Hand;
use mahjong_core::hint::{HintData, HintVerbosity, PatternSummary};
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

use crate::analysis::HandAnalysis;

pub struct HintComposer;

impl HintComposer {
    pub fn compose(
        analysis: &HandAnalysis,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
        verbosity: HintVerbosity,
        pattern_lookup: &std::collections::HashMap<String, String>,
        call_context: Option<CallContext>,
    ) -> HintData {
        if verbosity == HintVerbosity::Disabled {
            return HintData::empty();
        }

        let recommended_discard = HintAdvisor::recommend_discard(hand, visible, validator);
        let discard_reason = match verbosity {
            HintVerbosity::Beginner => {
                let top = analysis.top_patterns.first();
                top.map(|eval| {
                    let name = pattern_lookup
                        .get(&eval.pattern_id)
                        .cloned()
                        .unwrap_or_else(|| eval.pattern_id.clone());
                    format!(
                        "Discard {} - best EV: {} ({} away)",
                        recommended_discard, name, eval.deficiency
                    )
                })
            }
            HintVerbosity::Intermediate => Some(format!("Discard {}", recommended_discard)),
            HintVerbosity::Expert | HintVerbosity::Disabled => None,
        };

        let best_patterns = if matches!(verbosity, HintVerbosity::Beginner) {
            analysis
                .top_patterns
                .iter()
                .map(|eval| {
                    let name = pattern_lookup
                        .get(&eval.pattern_id)
                        .cloned()
                        .unwrap_or_else(|| eval.pattern_id.clone());
                    PatternSummary {
                        pattern_id: eval.pattern_id.clone(),
                        variation_id: eval.variation_id.clone(),
                        pattern_name: name,
                        probability: eval.probability,
                        score: eval.score,
                        distance: eval.deficiency.max(0) as u8,
                    }
                })
                .collect()
        } else {
            Vec::new()
        };

        let tiles_needed_for_win =
            Self::tiles_needed_for_best_pattern(analysis, hand, validator, visible);

        let call_opportunities = if let Some(ctx) = call_context {
            HintAdvisor::recommend_calls(
                hand,
                visible,
                validator,
                ctx.discarded_by,
                ctx.current_seat,
                ctx.discarded_tile,
                ctx.turn_number,
            )
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

        let distance_to_win = if analysis.distance_to_win == i32::MAX {
            14
        } else {
            analysis.distance_to_win.max(0) as u8
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

pub struct CallContext {
    pub discarded_tile: Tile,
    pub discarded_by: mahjong_core::player::Seat,
    pub current_seat: mahjong_core::player::Seat,
    pub turn_number: u32,
}
