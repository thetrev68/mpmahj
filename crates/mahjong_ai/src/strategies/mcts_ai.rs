//! MCTS-based AI configured by iteration count.

use crate::context::VisibleTiles;
use crate::mcts::MCTSEngine;
use crate::r#trait::MahjongAI;
use crate::strategies::greedy::GreedyAI;
use mahjong_core::flow::charleston::{CharlestonStage, CharlestonVote};
use mahjong_core::hand::Hand;
use mahjong_core::meld::MeldType;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;

/// MCTS-based AI for configurable search depths.
///
/// This AI uses Monte Carlo Tree Search for discard selection,
/// providing deep lookahead and strategic planning.
///
/// Typical settings:
/// - 1,000 MCTS iterations (~50ms)
/// - 10,000 MCTS iterations (~100ms)
pub struct MCTSAI {
    /// MCTS engine used for discard search.
    mcts_engine: MCTSEngine,
    /// Greedy fallback for non-MCTS decisions.
    greedy_fallback: GreedyAI,
}

impl MCTSAI {
    /// Create a new MCTS AI with specified iteration count.
    ///
    /// # Arguments
    /// * `iterations` - Number of MCTS iterations to run per decision
    /// * `seed` - Random seed
    pub fn new(iterations: usize, seed: u64) -> Self {
        Self {
            mcts_engine: MCTSEngine::new(iterations, seed),
            greedy_fallback: GreedyAI::new(seed),
        }
    }

    /// Get mutable access to the MCTS engine for configuration.
    ///
    /// # Primary Use: Pruning Experimentation
    ///
    /// Allows runtime configuration of experimental features, particularly heuristic pruning:
    ///
    /// ```no_run
    /// # use mahjong_ai::strategies::mcts_ai::MCTSAI;
    /// let mut ai = MCTSAI::new(1000, 42);
    ///
    /// // Enable pruning (experimental, disabled by default)
    /// ai.engine_mut().enable_pruning = true;
    /// ai.engine_mut().max_children = 5;
    /// ```
    ///
    /// # Pruning Status: Not Recommended
    ///
    /// Current testing shows pruning produces significantly different (likely worse) decisions
    /// than baseline MCTS due to simplistic heuristic. Enable only for experimentation or if
    /// you've implemented an improved scoring function.
    ///
    /// See [`MCTSEngine::enable_pruning`] for detailed status and test results.
    pub fn engine_mut(&mut self) -> &mut MCTSEngine {
        &mut self.mcts_engine
    }

    /// Get discard tile scores from MCTS tree search.
    ///
    /// Returns a map of tile -> score based on MCTS simulations.
    /// Must be called after select_discard() or after manually running search().
    pub fn get_discard_tile_scores(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> std::collections::HashMap<Tile, f64> {
        // Run MCTS search to populate the tree
        self.mcts_engine.search(hand, validator, visible);
        
        // Extract scores from the tree
        self.mcts_engine.get_tile_scores(hand)
    }
}

impl MahjongAI for MCTSAI {
    fn select_charleston_tiles(
        &mut self,
        hand: &Hand,
        stage: CharlestonStage,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Vec<Tile> {
        // Use greedy approach for Charleston (MCTS is overkill for this phase)
        self.greedy_fallback
            .select_charleston_tiles(hand, stage, visible, validator)
    }

    fn vote_charleston(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> CharlestonVote {
        // Use greedy approach for voting
        self.greedy_fallback
            .vote_charleston(hand, visible, validator)
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

        // Use MCTS for strategic discard selection
        self.mcts_engine.search(hand, validator, visible)
    }

    fn should_call(
        &mut self,
        hand: &Hand,
        discard: Tile,
        call_type: MeldType,
        visible: &VisibleTiles,
        validator: &HandValidator,
        turn_number: u32,
        discarded_by: Seat,
        current_seat: Seat,
    ) -> bool {
        // Use greedy approach for calling (time-critical decision)
        self.greedy_fallback.should_call(
            hand,
            discard,
            call_type,
            visible,
            validator,
            turn_number,
            discarded_by,
            current_seat,
        )
    }
}

#[cfg(test)]
/// Unit tests for MCTS AI decision-making with reduced iteration counts.
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
    fn test_mcts_ai_select_discard() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut ai = MCTSAI::new(50, 42); // Reduced iterations for test speed
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH, DOT_9,
        ]);

        let discard = ai.select_discard(&hand, &visible, &validator);

        // Should return a valid tile
        assert!(hand.concealed.contains(&discard));
        assert_ne!(discard, JOKER);
    }

    #[test]
    fn test_mcts_ai_charleston() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut ai = MCTSAI::new(50, 42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, JOKER, JOKER, BAM_5, BAM_5, GREEN,
            WEST,
        ]);

        let to_pass =
            ai.select_charleston_tiles(&hand, CharlestonStage::FirstRight, &visible, &validator);

        assert_eq!(to_pass.len(), 3);
        assert!(!to_pass.contains(&JOKER));
    }
}
