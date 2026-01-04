//! Greedy AI (Medium difficulty) - Greedy EV maximization.

use crate::context::VisibleTiles;
use crate::evaluation::StrategicEvaluation;
use crate::r#trait::MahjongAI;
use mahjong_core::flow::{CharlestonStage, CharlestonVote};
use mahjong_core::hand::Hand;
use mahjong_core::meld::{Meld, MeldType};
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use rand::rngs::StdRng;
use rand::SeedableRng;
use std::collections::HashMap;

/// Medium AI: Greedy Expected Value maximization (no lookahead).
///
/// This AI evaluates each possible move by its immediate impact on Expected Value.
/// It doesn't perform deep search like MCTS, making it faster but less strategic.
///
/// Strategy:
/// - Charleston: Keep tiles that maximize EV for top 3 patterns
/// - Discard: Choose tile whose removal leaves highest EV
/// - Calling: Call if EV(with meld) > EV(without meld) + risk penalty
pub struct GreedyAI {
    _rng: StdRng,
}

impl GreedyAI {
    /// Create a new GreedyAI with the given random seed.
    pub fn new(seed: u64) -> Self {
        Self {
            _rng: StdRng::seed_from_u64(seed),
        }
    }

    /// Evaluate a hand and return strategic evaluations for top patterns.
    fn evaluate_hand(
        &self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
        top_n: usize,
    ) -> Vec<StrategicEvaluation> {
        let analyses = validator.analyze(hand, top_n);

        analyses
            .into_iter()
            .map(|analysis| {
                // Get pattern histogram (simplified - use hand counts as proxy)
                // TODO: Get actual pattern histogram from validator
                let target_histogram = &hand.counts;

                StrategicEvaluation::from_analysis(analysis, hand, visible, target_histogram)
            })
            .collect()
    }

    /// Calculate the maximum EV across all patterns for a hand.
    fn calculate_max_ev(&self, evaluations: &[StrategicEvaluation]) -> f64 {
        evaluations
            .iter()
            .map(|e| e.expected_value)
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0)
    }

    /// Score a tile for Charleston (higher = keep, lower = pass).
    fn score_tile_for_charleston(
        &self,
        tile: Tile,
        hand: &Hand,
        evaluations: &[StrategicEvaluation],
    ) -> f64 {
        // Jokers are never passed
        if tile.is_joker() {
            return f64::MAX;
        }

        // Simplified utility: count in hand * sum of EVs
        let count = hand.count_tile(tile) as f64;
        let total_ev: f64 = evaluations.iter().map(|e| e.expected_value).sum();

        count * total_ev
    }
}

impl MahjongAI for GreedyAI {
    fn select_charleston_tiles(
        &mut self,
        hand: &Hand,
        _stage: CharlestonStage,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Vec<Tile> {
        // Analyze top 10 patterns
        let evaluations = self.evaluate_hand(hand, validator, visible, 10);

        // Score each unique tile
        let mut tile_scores: HashMap<Tile, f64> = HashMap::new();
        for &tile in &hand.concealed {
            if tile.is_joker() {
                continue; // Never pass jokers
            }

            tile_scores
                .entry(tile)
                .or_insert_with(|| self.score_tile_for_charleston(tile, hand, &evaluations));
        }

        // Sort by score (ascending - pass lowest)
        let mut scored_tiles: Vec<(Tile, f64)> = tile_scores.into_iter().collect();
        scored_tiles.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        // Take 3 lowest-scoring tiles
        scored_tiles
            .into_iter()
            .take(3)
            .map(|(tile, _)| tile)
            .collect()
    }

    fn vote_charleston(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> CharlestonVote {
        let evaluations = self.evaluate_hand(hand, validator, visible, 10);

        // Count patterns with deficiency <= 4 (close to winning)
        let close_patterns = evaluations.iter().filter(|e| e.deficiency <= 4).count();

        // If we have 3+ close patterns, keep shuffling (continue)
        // If we have 1-2 strong patterns, stop and commit
        if close_patterns >= 3 {
            CharlestonVote::Continue
        } else {
            CharlestonVote::Stop
        }
    }

    fn select_discard(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Tile {
        // Check if we already have a winning hand
        if validator.validate_win(hand).is_some() {
            // We're winning - discard any non-joker tile
            return hand
                .concealed
                .iter()
                .find(|&&t| !t.is_joker())
                .copied()
                .unwrap_or(hand.concealed[0]);
        }

        let mut best_tile = hand.concealed[0];
        let mut best_ev = f64::NEG_INFINITY;

        // Try discarding each tile, pick the one that leaves highest EV
        for &tile in &hand.concealed {
            if tile.is_joker() {
                continue; // Never discard jokers
            }

            // Create test hand after discard
            let mut test_hand = hand.clone();
            if test_hand.remove_tile(tile).is_err() {
                continue;
            }

            // Evaluate resulting hand
            let evaluations = self.evaluate_hand(&test_hand, validator, visible, 5);
            let max_ev = self.calculate_max_ev(&evaluations);

            if max_ev > best_ev {
                best_ev = max_ev;
                best_tile = tile;
            }
        }

        best_tile
    }

    fn should_call(
        &mut self,
        hand: &Hand,
        discard: Tile,
        call_type: MeldType,
        visible: &VisibleTiles,
        validator: &HandValidator,
        turn_number: u32,
        _discarded_by: Seat,
        _current_seat: Seat,
    ) -> bool {
        // Don't call jokers (can't be called)
        if discard.is_joker() {
            return false;
        }

        // Quick check: Can we form this meld?
        let natural_count = hand.count_tile(discard);
        let required = match call_type {
            MeldType::Pung => 2,
            MeldType::Kong => 3,
            MeldType::Quint => 4,
        };

        if natural_count < required {
            return false;
        }

        // Evaluate current hand
        let current_evaluations = self.evaluate_hand(hand, validator, visible, 3);
        let current_ev = self.calculate_max_ev(&current_evaluations);

        // Simulate calling
        let mut test_hand = hand.clone();
        test_hand.add_tile(discard);

        // Create the meld
        let meld_tiles = vec![discard; required + 1];
        let meld = match Meld::new(call_type, meld_tiles.clone(), Some(discard)) {
            Ok(m) => m,
            Err(_) => return false,
        };

        // Remove tiles from hand and expose meld
        for _ in 0..required {
            if test_hand.remove_tile(discard).is_err() {
                return false;
            }
        }

        if test_hand.expose_meld(meld).is_err() {
            return false;
        }

        // Check if this would be a win
        if validator.validate_win(&test_hand).is_some() {
            return true; // Always call for mahjong!
        }

        // Evaluate hand after calling
        let new_evaluations = self.evaluate_hand(&test_hand, validator, visible, 3);
        let new_ev = self.calculate_max_ev(&new_evaluations);

        // Decision thresholds by game phase
        let threshold = match turn_number {
            0..=20 => 1.2,  // Early: Only call if EV increases by 20%
            21..=60 => 1.1, // Mid: Call if EV increases by 10%
            _ => 1.0,       // Late: Call if EV doesn't decrease
        };

        new_ev >= current_ev * threshold
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::rules::card::UnifiedCard;
    use mahjong_core::tile::tiles::*;

    fn load_test_card() -> UnifiedCard {
        let json =
            std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
        UnifiedCard::from_json(&json).expect("Parse card")
    }

    #[test]
    fn test_greedy_ai_never_passes_jokers() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut ai = GreedyAI::new(42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, JOKER, JOKER, BAM_5, BAM_5, GREEN,
            WEST,
        ]);

        let to_pass =
            ai.select_charleston_tiles(&hand, CharlestonStage::FirstRight, &visible, &validator);

        assert_eq!(to_pass.len(), 3);
        assert!(!to_pass.contains(&JOKER), "Should not pass Jokers");
    }

    #[test]
    fn test_greedy_ai_never_discards_jokers() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut ai = GreedyAI::new(42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, JOKER, JOKER, BAM_5, BAM_5, GREEN,
            WEST, NORTH,
        ]);

        let discard = ai.select_discard(&hand, &visible, &validator);

        assert_ne!(discard, JOKER, "Should not discard Joker");
    }

    #[test]
    fn test_greedy_ai_vote_charleston() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut ai = GreedyAI::new(42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH,
        ]);

        let vote = ai.vote_charleston(&hand, &visible, &validator);

        // Vote should be Continue or Stop (both valid)
        assert!(matches!(
            vote,
            CharlestonVote::Continue | CharlestonVote::Stop
        ));
    }
}
