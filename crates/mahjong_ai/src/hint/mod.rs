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

    // TODO(phase9): Add Charleston pass recommendations (3 tiles, blind pass/steal) and
    // surface them in HintData once the backend hint payload supports pass suggestions.

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
    ///
    /// Uses multiple heuristics:
    /// - Dead tiles (all copies visible) are always safe
    /// - Genbutsu rule: previously discarded tiles are safe
    /// - Opponent meld analysis: tiles matching opponent's exposed melds are risky
    /// - Same-suit analysis: tiles in suits opponents are collecting warrant caution
    pub fn evaluate_defense(tile: Tile, visible_tiles: &VisibleTiles) -> DefensiveHint {
        // Rule 1: Dead tiles are always safe
        if visible_tiles.is_dead(tile) {
            return DefensiveHint::safe(tile, "All copies visible".to_string());
        }

        // Rule 2: Genbutsu - previously discarded tiles are safe
        if Self::is_genbutsu(tile, visible_tiles) {
            return DefensiveHint::safe(tile, "Previously discarded".to_string());
        }

        // Rule 3: Check opponent meld danger
        match Self::check_opponent_melds(tile, visible_tiles) {
            OpponentDanger::High => {
                DefensiveHint::risky(tile, "Opponent collecting this tile".to_string())
            }
            OpponentDanger::Medium => {
                DefensiveHint::caution(tile, "Opponent collecting this suit".to_string())
            }
            OpponentDanger::Low => {
                DefensiveHint::safe(tile, "No opponent interest detected".to_string())
            }
        }
    }

    /// Check if tile was previously discarded (genbutsu rule).
    ///
    /// In Mahjong, a tile that has already been discarded is generally
    /// safer to discard again since opponents had a chance to claim it.
    fn is_genbutsu(tile: Tile, visible: &VisibleTiles) -> bool {
        visible.discards.iter().any(|d| d.0 == tile.0)
    }

    /// Check if any opponent is collecting this tile or its suit.
    ///
    /// Analyzes exposed melds to detect:
    /// - High danger: exact tile match (opponent may want Kong/Quint)
    /// - Medium danger: same suit (opponent is collecting that suit)
    fn check_opponent_melds(tile: Tile, visible: &VisibleTiles) -> OpponentDanger {
        let mut max_danger = OpponentDanger::Low;

        for melds in visible.exposed_melds.values() {
            for meld in melds {
                // Find the base tile (non-joker) in the meld
                let base = meld.tiles.iter().find(|t| !t.is_joker());
                if let Some(base_tile) = base {
                    // Exact tile match = high danger
                    if base_tile.0 == tile.0 {
                        return OpponentDanger::High;
                    }
                    // Same suit = medium danger (upgrade if not already high)
                    if Self::same_suit(tile, *base_tile) && max_danger == OpponentDanger::Low {
                        max_danger = OpponentDanger::Medium;
                    }
                }
            }
        }

        max_danger
    }

    /// Check if two tiles share the same suit/category.
    fn same_suit(a: Tile, b: Tile) -> bool {
        (a.is_bam() && b.is_bam())
            || (a.is_crak() && b.is_crak())
            || (a.is_dot() && b.is_dot())
            || (a.is_wind() && b.is_wind())
            || (a.is_dragon() && b.is_dragon())
    }
}

/// Internal danger level from opponent meld analysis.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpponentDanger {
    /// No opponent interest detected.
    Low,
    /// Opponent collecting this suit.
    Medium,
    /// Opponent collecting this exact tile.
    High,
}

#[cfg(test)]
/// Unit tests for hint advisor recommendation functions.
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

    #[test]
    fn test_evaluate_defense_genbutsu_safe() {
        let mut visible = VisibleTiles::new();
        visible.add_discard(CRAK_5);

        // CRAK_5 was discarded before = safe (genbutsu rule)
        let hint = HintAdvisor::evaluate_defense(CRAK_5, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Safe);
        assert!(hint.reason.contains("Previously discarded"));
    }

    #[test]
    fn test_evaluate_defense_opponent_meld_exact_tile_risky() {
        use mahjong_core::meld::{Meld, MeldType};
        use mahjong_core::player::Seat;

        let mut visible = VisibleTiles::new();
        // Opponent exposed a Pung of BAM_3
        let meld = Meld::new(MeldType::Pung, vec![BAM_3, BAM_3, BAM_3], Some(BAM_3)).unwrap();
        visible.add_meld(Seat::South, meld);

        // BAM_3 itself should be risky (exact match - they may want Kong)
        let hint = HintAdvisor::evaluate_defense(BAM_3, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Risky);
        assert!(hint.reason.contains("this tile"));
    }

    #[test]
    fn test_evaluate_defense_same_suit_caution() {
        use mahjong_core::meld::{Meld, MeldType};
        use mahjong_core::player::Seat;

        let mut visible = VisibleTiles::new();
        let meld = Meld::new(MeldType::Pung, vec![BAM_3, BAM_3, BAM_3], Some(BAM_3)).unwrap();
        visible.add_meld(Seat::South, meld);

        // BAM_7 is same suit = caution (opponent collecting Bams)
        let hint = HintAdvisor::evaluate_defense(BAM_7, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Caution);
        assert!(hint.reason.contains("this suit"));
    }

    #[test]
    fn test_evaluate_defense_different_suit_safe() {
        use mahjong_core::meld::{Meld, MeldType};
        use mahjong_core::player::Seat;

        let mut visible = VisibleTiles::new();
        let meld = Meld::new(MeldType::Pung, vec![BAM_3, BAM_3, BAM_3], Some(BAM_3)).unwrap();
        visible.add_meld(Seat::South, meld);

        // DOT_9 is different suit = safe (opponent collecting Bams, not Dots)
        let hint = HintAdvisor::evaluate_defense(DOT_9, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Safe);
        assert!(hint.reason.contains("No opponent interest"));
    }

    #[test]
    fn test_evaluate_defense_no_melds_no_discards_safe() {
        let visible = VisibleTiles::new();

        // No exposed melds, no discards = safe
        let hint = HintAdvisor::evaluate_defense(DOT_9, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Safe);
    }

    #[test]
    fn test_evaluate_defense_genbutsu_overrides_suit_danger() {
        use mahjong_core::meld::{Meld, MeldType};
        use mahjong_core::player::Seat;

        let mut visible = VisibleTiles::new();
        // Opponent has exposed Bam meld
        let meld = Meld::new(MeldType::Pung, vec![BAM_3, BAM_3, BAM_3], Some(BAM_3)).unwrap();
        visible.add_meld(Seat::South, meld);
        // But BAM_7 was already discarded
        visible.add_discard(BAM_7);

        // Genbutsu (previously discarded) should override suit danger
        let hint = HintAdvisor::evaluate_defense(BAM_7, &visible);
        assert_eq!(hint.safety, mahjong_core::hint::DefensiveSafety::Safe);
        assert!(hint.reason.contains("Previously discarded"));
    }

    #[test]
    fn test_evaluate_defense_multiple_opponents() {
        use mahjong_core::meld::{Meld, MeldType};
        use mahjong_core::player::Seat;

        let mut visible = VisibleTiles::new();
        // South collecting Bams
        let bam_meld = Meld::new(MeldType::Pung, vec![BAM_3, BAM_3, BAM_3], Some(BAM_3)).unwrap();
        visible.add_meld(Seat::South, bam_meld);
        // West collecting Craks
        let crak_meld =
            Meld::new(MeldType::Pung, vec![CRAK_5, CRAK_5, CRAK_5], Some(CRAK_5)).unwrap();
        visible.add_meld(Seat::West, crak_meld);

        // BAM_7 = caution (South collecting Bams)
        let hint1 = HintAdvisor::evaluate_defense(BAM_7, &visible);
        assert_eq!(hint1.safety, mahjong_core::hint::DefensiveSafety::Caution);

        // CRAK_9 = caution (West collecting Craks)
        let hint2 = HintAdvisor::evaluate_defense(CRAK_9, &visible);
        assert_eq!(hint2.safety, mahjong_core::hint::DefensiveSafety::Caution);

        // DOT_1 = safe (no one collecting Dots)
        let hint3 = HintAdvisor::evaluate_defense(DOT_1, &visible);
        assert_eq!(hint3.safety, mahjong_core::hint::DefensiveSafety::Safe);
    }
}
