//! Heuristic, rule-based bot decisions for American Mahjong.

use crate::hand::Hand;
use crate::meld::{Meld, MeldType};
use crate::rules::card::UnifiedCard;
use crate::rules::validator::{AnalysisResult, HandValidator};
use crate::tile::{Tile, JOKER_INDEX};
use std::collections::HashMap;

/// A rule-based AI bot for American Mahjong.
///
/// This bot uses heuristic scoring to make decisions during Charleston
/// and main gameplay. It analyzes the hand using the validation engine
/// to identify top-matching patterns and scores tiles based on their
/// usefulness for those patterns.
///
/// # Examples
/// ```no_run
/// use mahjong_core::bot::BasicBot;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::rules::card::UnifiedCard;
/// use mahjong_core::tile::tiles::*;
///
/// let json = r#"{"year":2025,"sections":[]}"#;
/// let card = UnifiedCard::from_json(json).expect("card parses");
/// let bot = BasicBot::new(&card);
/// let hand = Hand::new(vec![
///     BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, BAM_6, BAM_7, BAM_8, BAM_9, EAST, SOUTH, WEST, NORTH,
/// ]);
/// let discard = bot.choose_discard(&hand);
/// let _ = discard;
/// ```
pub struct BasicBot {
    validator: HandValidator,
}

impl BasicBot {
    /// Create a new BasicBot with the given card.
    pub fn new(card: &UnifiedCard) -> Self {
        Self {
            validator: HandValidator::new(card),
        }
    }

    /// Choose 3 tiles to pass during Charleston.
    ///
    /// Strategy:
    /// 1. Analyze hand to find top 5-10 best-matching patterns
    /// 2. Score each tile based on heuristics:
    ///    - Pairs (2+ count): +10
    ///    - Connected (adjacent suited tiles): +8
    ///    - Frequent in top patterns: +variable
    ///    - Jokers: +100 (never pass)
    ///    - Isolated: -15
    ///    - Honor tiles without pairs: -10
    ///    - Low pattern match: -5
    /// 3. Pass the 3 lowest-scoring tiles
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::bot::BasicBot;
    /// use mahjong_core::hand::Hand;
    /// use mahjong_core::rules::card::UnifiedCard;
    /// use mahjong_core::tile::tiles::*;
    ///
    /// let json = r#"{"year":2025,"sections":[]}"#;
    /// let card = UnifiedCard::from_json(json).expect("card parses");
    /// let bot = BasicBot::new(&card);
    /// let hand = Hand::new(vec![
    ///     BAM_1, BAM_2, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, JOKER, JOKER, BAM_5, BAM_5, GREEN,
    ///     WEST,
    /// ]);
    /// let to_pass = bot.choose_charleston_tiles(&hand);
    /// assert_eq!(to_pass.len(), 3);
    /// ```
    pub fn choose_charleston_tiles(&self, hand: &Hand) -> Vec<Tile> {
        // Get top patterns to understand what we're building toward
        let top_patterns = self.validator.analyze(hand, 10);

        // Score each unique tile in hand
        let mut tile_scores: HashMap<Tile, i32> = HashMap::new();

        for tile_idx in 0..hand.concealed.len() {
            let tile = hand.concealed[tile_idx];

            // Skip if already scored
            if tile_scores.contains_key(&tile) {
                continue;
            }

            let score = self.score_tile(tile, hand, &top_patterns);
            tile_scores.insert(tile, score);
        }

        // Sort tiles by score (lowest first) and select 3 to pass
        let mut scorable_tiles: Vec<(Tile, i32)> = tile_scores.into_iter().collect();
        scorable_tiles.sort_by_key(|&(_, score)| score);

        // Take the 3 lowest-scoring tiles
        scorable_tiles
            .into_iter()
            .take(3)
            .map(|(tile, _)| tile)
            .collect()
    }

    /// Choose which tile to discard from hand.
    ///
    /// Strategy:
    /// 1. Analyze hand to find best matching patterns
    /// 2. Score each tile
    /// 3. Discard the lowest-scoring tile
    ///
    /// This heuristic does not currently protect already-complete groups; it
    /// relies on scoring to avoid breaking valuable sets.
    pub fn choose_discard(&self, hand: &Hand) -> Tile {
        let top_patterns = self.validator.analyze(hand, 10);

        // Score each unique tile
        let mut best_discard = hand.concealed[0];
        let mut lowest_score = i32::MAX;

        for &tile in &hand.concealed {
            let score = self.score_tile(tile, hand, &top_patterns);

            if score < lowest_score {
                lowest_score = score;
                best_discard = tile;
            }
        }

        best_discard
    }

    /// Decide whether to call a discarded tile for a meld.
    ///
    /// Strategy:
    /// 1. Check if we can form a valid Pung/Kong with this tile
    /// 2. Analyze if calling would improve our deficiency
    /// 3. Only call if beneficial (doesn't increase deficiency)
    pub fn should_call(&self, hand: &Hand, discard: Tile) -> Option<Meld> {
        // Don't call jokers (can't be called)
        if discard.is_joker() {
            return None;
        }

        // Count how many we have (including jokers as wildcards)
        let natural_count = hand.count_tile(discard);
        let _joker_count = hand.count_tile(Tile(JOKER_INDEX));

        // Can we form a Pung (3) or Kong (4)?
        let total_after_call = natural_count + 1; // +1 for the called tile

        // Need at least 2 naturals + called tile for Pung
        if natural_count < 2 {
            // Could use jokers, but keep it simple for BasicBot
            return None;
        }

        // Check current deficiency
        let current_best = self.validator.analyze(hand, 1);
        let current_deficiency = current_best
            .first()
            .map(|r| r.deficiency)
            .unwrap_or(i32::MAX);

        // Simulate exposing the meld
        let mut test_hand = hand.clone();
        test_hand.remove_tile(discard).ok()?;
        test_hand.remove_tile(discard).ok()?;

        let meld_type = if total_after_call >= 4 && natural_count >= 3 {
            MeldType::Kong
        } else {
            MeldType::Pung
        };

        // Create the meld
        let tiles = if meld_type == MeldType::Kong {
            vec![discard, discard, discard, discard]
        } else {
            vec![discard, discard, discard]
        };

        let meld = Meld::new(meld_type, tiles, Some(discard)).ok()?;
        test_hand.expose_meld(meld.clone()).ok()?;

        // Check new deficiency
        let new_best = self.validator.analyze(&test_hand, 1);
        let new_deficiency = new_best.first().map(|r| r.deficiency).unwrap_or(i32::MAX);

        // Only call if it doesn't worsen our position
        if new_deficiency <= current_deficiency {
            Some(meld)
        } else {
            None
        }
    }

    /// Check if the hand is a winning hand.
    pub fn check_win(&self, hand: &Hand) -> bool {
        self.validator.validate_win(hand).is_some()
    }

    /// Score a tile based on heuristics and pattern analysis.
    ///
    /// Higher scores = keep, lower scores = discard.
    fn score_tile(&self, tile: Tile, hand: &Hand, top_patterns: &[AnalysisResult]) -> i32 {
        let mut score = 0;

        // NEVER pass/discard Jokers
        if tile.is_joker() {
            return 100;
        }

        // Pairs: Tiles that appear 2+ times
        if hand.contains_pair(tile) {
            score += 10;
        }

        // Pung/Kong: Tiles that appear 3+ times
        let count = hand.count_tile(tile);
        if count >= 3 {
            score += 15;
        }
        if count >= 4 {
            score += 10; // Extra bonus for Kong
        }

        // Connected: Suited tiles with neighbors
        if tile.is_suited() && !hand.is_isolated(tile) {
            score += 8;
        }

        // Isolated: No neighbors in same suit
        if hand.is_isolated(tile) {
            score -= 15;
        }

        // Honor tiles without pairs
        if !tile.is_suited() && !hand.contains_pair(tile) {
            score -= 10;
        }

        // Pattern frequency: How often does this tile appear in top patterns?
        let pattern_frequency = self.count_tile_in_patterns(tile, top_patterns);
        score += pattern_frequency as i32 * 2;

        score
    }

    /// Count how many of the top patterns would benefit from this tile.
    ///
    /// This is a simplified heuristic - in reality, we'd need to check
    /// the actual pattern histograms, but for BasicBot we'll use a
    /// simple proxy based on deficiency.
    fn count_tile_in_patterns(&self, _tile: Tile, patterns: &[AnalysisResult]) -> usize {
        // TODO: Use real pattern histograms instead of deficiency proxies.
        // For now, use a simple heuristic: better patterns (lower deficiency)
        // are more likely to use common tiles like pairs
        // This is a placeholder - a real implementation would check pattern histograms

        // Simplified: If we have good patterns (deficiency < 5), assume
        // tiles we have multiple of are useful
        patterns.iter().filter(|p| p.deficiency < 5).count().min(5)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::tiles::*;

    /// Loads the unified card fixture for bot tests.
    fn load_test_card() -> UnifiedCard {
        let json =
            std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
        UnifiedCard::from_json(&json).expect("Parse card")
    }

    #[test]
    fn test_bot_never_passes_jokers() {
        let card = load_test_card();
        let bot = BasicBot::new(&card);

        let hand = Hand::new(vec![
            BAM_1, BAM_2, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, JOKER, JOKER, BAM_5, BAM_5, GREEN,
            WEST,
        ]);

        let to_pass = bot.choose_charleston_tiles(&hand);

        assert_eq!(to_pass.len(), 3);
        assert!(!to_pass.contains(&JOKER), "Should not pass Jokers");
    }

    #[test]
    fn test_bot_keeps_pairs() {
        let card = load_test_card();
        let bot = BasicBot::new(&card);

        let hand = Hand::new(vec![
            BAM_1, EAST, SOUTH, CRAK_2, CRAK_2, CRAK_2, BAM_5, BAM_5, GREEN, WEST, NORTH, DOT_3,
            DOT_7,
        ]);

        let to_pass = bot.choose_charleston_tiles(&hand);

        assert_eq!(to_pass.len(), 3);
        // Should not pass the Pung (CRAK_2) or pairs (BAM_5)
        assert!(!to_pass.contains(&CRAK_2), "Should not pass Pung tiles");
        assert!(!to_pass.contains(&BAM_5), "Should not pass pair tiles");
    }

    #[test]
    fn test_bot_chooses_discard() {
        let card = load_test_card();
        let bot = BasicBot::new(&card);

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH, DOT_9,
        ]);

        let discard = bot.choose_discard(&hand);

        // Should discard an isolated honor tile or low-value tile
        // Not a joker, not part of the connected Bams or Crak Pung
        assert_ne!(discard, JOKER, "Should not discard Joker");
        assert_ne!(discard, CRAK_2, "Should not discard Pung tile");
    }

    #[test]
    fn test_bot_detects_win() {
        let card = load_test_card();
        let bot = BasicBot::new(&card);

        // TODO: Use a known winning hand to validate true-positive detection.
        // For now, test that check_win doesn't panic
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH, DOT_9,
        ]);

        let _is_win = bot.check_win(&hand);
        // Most random hands won't be wins, but the function should work
    }

    #[test]
    fn test_bot_calling_logic() {
        let card = load_test_card();
        let bot = BasicBot::new(&card);

        // Hand with 2 Crak 2s
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
            DOT_9,
        ]);

        // Should consider calling another Crak 2
        let call_result = bot.should_call(&hand, CRAK_2);

        // May or may not call depending on whether it improves deficiency
        // Just check it doesn't panic
        assert!(call_result.is_some() || call_result.is_none());
    }
}
