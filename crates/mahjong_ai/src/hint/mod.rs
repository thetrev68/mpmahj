//! Hint advisor - thin AI helper layer for discard/call/defense hints.
//!
//! This module does NOT compute pattern analysis or distances.
//! It only answers: "what would the AI do right now?"

use crate::context::VisibleTiles;
use crate::r#trait::MahjongAI;
use crate::strategies::greedy::GreedyAI;
use mahjong_core::hand::Hand;
use mahjong_core::hint::{CallOpportunity, DefensiveHint};
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

/// Helper for AI-driven hint recommendations.
#[derive(Debug, Default)]
pub struct HintAdvisor;

impl HintAdvisor {
    /// Recommend a discard using GreedyAI.
    pub fn recommend_discard(
        hand: &Hand,
        visible_tiles: &VisibleTiles,
        validator: &HandValidator,
    ) -> Tile {
        let mut ai = GreedyAI::new(0);
        ai.select_discard(hand, visible_tiles, validator)
    }

    /// Recommend call opportunities during CallWindow.
    ///
    /// Returns zero or more call suggestions; server decides how to display them
    /// based on HintVerbosity.
    pub fn recommend_calls(
        hand: &Hand,
        visible_tiles: &VisibleTiles,
        validator: &HandValidator,
        discarded_by: Seat,
        current_seat: Seat,
        discarded_tile: Tile,
        turn_number: u32,
    ) -> Vec<CallOpportunity> {
        let mut ai = GreedyAI::new(0);
        let mut opportunities = Vec::new();

        for meld_type in [MeldType::Pung, MeldType::Kong, MeldType::Quint] {
            let should_call = ai.should_call(
                hand,
                discarded_tile,
                meld_type,
                visible_tiles,
                validator,
                turn_number,
                discarded_by,
                current_seat,
            );

            if should_call {
                opportunities.push(CallOpportunity::new(
                    discarded_tile,
                    meld_type,
                    true,
                    "Improves expected value".to_string(),
                ));
            }
        }

        opportunities
    }

    /// Evaluate defensive safety of a candidate discard.
    pub fn evaluate_defense(tile: Tile, visible_tiles: &VisibleTiles) -> DefensiveHint {
        // TODO: Incorporate opponent calls and discard timing into defense heuristics.
        if visible_tiles.is_dead(tile) {
            DefensiveHint::safe(tile, "All copies are visible".to_string())
        } else {
            DefensiveHint::risky(tile, "Tile still available to opponents".to_string())
        }
    }
}

#[cfg(test)]
/// Tests for hint advisor recommendation helpers.
mod tests {
    use super::*;
    use crate::context::VisibleTiles;
    use mahjong_core::hand::Hand;
    use mahjong_core::rules::card::UnifiedCard;
    use mahjong_core::tile::tiles::*;

    /// Loads a rules card for hint advisor tests.
    fn load_test_card() -> HandValidator {
        let json =
            std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
        let card = UnifiedCard::from_json(&json).expect("Parse card");
        HandValidator::new(&card)
    }

    #[test]
    fn test_recommend_discard_never_joker() {
        let validator = load_test_card();
        let hand = Hand::new(vec![
            BAM_1, BAM_1, BAM_2, BAM_3, CRAK_1, JOKER, JOKER, DOT_1,
        ]);
        let visible = VisibleTiles::new();

        let discard = HintAdvisor::recommend_discard(&hand, &visible, &validator);
        assert!(!discard.is_joker());
    }

    #[test]
    fn test_evaluate_defense_dead_tile_safe() {
        let mut visible = VisibleTiles::new();
        for _ in 0..4 {
            visible.add_discard(BAM_1);
        }

        let hint = HintAdvisor::evaluate_defense(BAM_1, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Safe);
    }
}
