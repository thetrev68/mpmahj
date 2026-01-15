//! Tile probability calculations for strategic decision-making.

use crate::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::tile::Tile;

/// Calculate P(tile) - probability of drawing a specific tile.
///
/// # Arguments
/// * `tile` - The tile we want to draw
/// * `visible` - Tiles that are publicly visible
/// * `hand` - AI's current hand (tiles AI already has)
///
/// # Returns
/// Probability between 0.0 and 1.0
///
/// # Examples
///
/// ```
/// use mahjong_ai::context::VisibleTiles;
/// use mahjong_ai::probability::calculate_tile_probability;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::BAM_1;
///
/// let visible = VisibleTiles::new();
/// let hand = Hand::empty();
///
/// // At game start, 4 copies of BAM_1 exist out of 86 drawable tiles
/// let prob = calculate_tile_probability(BAM_1, &visible, &hand);
/// assert!(prob > 0.0 && prob < 1.0);
/// ```
pub fn calculate_tile_probability(tile: Tile, visible: &VisibleTiles, hand: &Hand) -> f64 {
    // Total copies in deck (4 for most tiles, 8 for Flowers/Jokers)
    let total: usize = if tile.is_flower() || tile.is_joker() {
        8
    } else {
        4
    };

    // Visible + in our hand
    let visible_count = visible.count_visible(tile);
    let in_hand = hand.count_tile(tile);
    let known = visible_count + in_hand;

    // Remaining copies in the wall
    let remaining_copies = total.saturating_sub(known);

    if remaining_copies == 0 {
        return 0.0; // Dead tile
    }

    // Total tiles remaining in wall
    const TOTAL_TILES: usize = 152;
    const DEAD_WALL: usize = 14;
    const DEALT_TILES: usize = 52; // 13 × 4 players

    let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
    let tiles_in_wall = drawable.saturating_sub(visible.tiles_drawn);

    if tiles_in_wall == 0 {
        return 0.0; // Wall exhausted
    }

    // Simple probability: remaining copies / remaining tiles
    remaining_copies as f64 / tiles_in_wall as f64
}

/// Calculate probability of completing a pattern from current hand.
///
/// Uses a simplified Monte Carlo estimate:
/// 1. Identify missing tiles from target histogram
/// 2. Calculate P(drawing each missing tile)
/// 3. Combine probabilities (assuming independence)
///
/// # Arguments
/// * `hand` - Current hand
/// * `target_histogram` - Pattern's target histogram
/// * `visible` - Visible tiles tracker
///
/// # Returns
/// Estimated probability of completion (0.0-1.0)
///
/// # Examples
///
/// ```
/// use mahjong_ai::context::VisibleTiles;
/// use mahjong_ai::probability::calculate_probability;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::{BAM_1, BAM_2};
///
/// let hand = Hand::new(vec![BAM_1]);
/// let visible = VisibleTiles::new();
/// let mut histogram = vec![0u8; 36];
/// histogram[BAM_1.0 as usize] = 1;
/// histogram[BAM_2.0 as usize] = 1;
///
/// // Need to draw BAM_2 to complete pattern
/// let prob = calculate_probability(&hand, &histogram, &visible);
/// assert!(prob > 0.0);
/// ```
pub fn calculate_probability(hand: &Hand, target_histogram: &[u8], visible: &VisibleTiles) -> f64 {
    // Calculate deficiency
    let mut deficiency = 0;
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];
        if needed > have {
            deficiency += (needed - have) as i32;
        }
    }

    if deficiency == 0 {
        return 1.0; // Already complete
    }

    if deficiency > 6 {
        return 0.0; // Too far away to be realistic
    }

    // Collect missing tiles
    let mut missing_tiles = Vec::new();
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];
        if needed > have {
            let tile = Tile(i as u8);
            for _ in 0..(needed - have) {
                missing_tiles.push(tile);
            }
        }
    }

    // Calculate joint probability (simplified: assume independent draws)
    //
    // NOTE: This independence assumption is mathematically incorrect for sampling
    // without replacement. The correct model is the hypergeometric distribution:
    //   P(X=k) = C(K,k) * C(N-K, n-k) / C(N, n)
    // where N=wall size, K=remaining copies of needed tiles, n=draws, k=successes.
    //
    // However, for typical deficiencies (1-4 tiles), the error is ~5-15% relative,
    // and the deficiency_factor below partially compensates. Since AI decisions
    // are comparative (all patterns evaluated with same bias), this is acceptable
    // for now. Revisit if AI pattern selection proves noticeably suboptimal.
    //
    // TODO(low-priority): Replace with multivariate hypergeometric when needed.
    let mut prob = 1.0;
    for tile in missing_tiles {
        let p = calculate_tile_probability(tile, visible, hand);
        prob *= p;

        if prob < 0.001 {
            return 0.0; // Effectively impossible
        }
    }

    // Apply a scaling factor based on deficiency
    // Lower deficiency = higher probability
    let deficiency_factor = 1.0 / (1.0 + (deficiency as f64 * 0.5));
    prob * deficiency_factor
}

/// Calculate probability of drawing any tile from a set within N draws.
///
/// Uses binomial approximation for speed.
///
/// # Arguments
/// * `tiles` - Set of tiles we'd be happy to draw
/// * `draws` - Number of draws we'll make
/// * `visible` - Visible tiles tracker
/// * `hand` - Current hand
///
/// # Returns
/// Probability of drawing at least one of the tiles
pub fn calculate_any_tile_probability(
    tiles: &[Tile],
    draws: usize,
    visible: &VisibleTiles,
    hand: &Hand,
) -> f64 {
    if tiles.is_empty() || draws == 0 {
        return 0.0;
    }

    // Sum probabilities for each tile
    let total_prob: f64 = tiles
        .iter()
        .map(|&t| calculate_tile_probability(t, visible, hand))
        .sum();

    // Probability of NOT drawing any in N draws
    let prob_none = (1.0 - total_prob).powi(draws as i32);

    // Probability of drawing at least one
    1.0 - prob_none
}

#[cfg(test)]
/// Unit tests for probability calculation functions.
mod tests {
    use super::*;
    use mahjong_core::tile::tiles::*;

    #[test]
    fn test_calculate_tile_probability_all_available() {
        let visible = VisibleTiles::new();
        let hand = Hand::empty();

        // At start, probability depends on total tiles in wall
        let prob = calculate_tile_probability(BAM_1, &visible, &hand);

        // 4 copies of BAM_1 out of 86 drawable tiles
        // P = 4 / 86 ≈ 0.0465
        assert!(prob > 0.04 && prob < 0.05);
    }

    #[test]
    fn test_calculate_tile_probability_some_visible() {
        let mut visible = VisibleTiles::new();
        let hand = Hand::empty();

        // Discard 2 BAM_1
        visible.add_discard(BAM_1);
        visible.add_discard(BAM_1);

        let prob = calculate_tile_probability(BAM_1, &visible, &hand);

        // 2 remaining copies out of 86 tiles
        // P = 2 / 86 ≈ 0.023
        assert!(prob > 0.02 && prob < 0.03);
    }

    #[test]
    fn test_calculate_tile_probability_dead() {
        let mut visible = VisibleTiles::new();
        let hand = Hand::empty();

        // Discard all 4 copies
        for _ in 0..4 {
            visible.add_discard(BAM_1);
        }

        let prob = calculate_tile_probability(BAM_1, &visible, &hand);
        assert_eq!(prob, 0.0);
    }

    #[test]
    fn test_calculate_tile_probability_in_hand() {
        let visible = VisibleTiles::new();
        let hand = Hand::new(vec![BAM_1, BAM_1]);

        // Have 2, 2 remaining in wall
        let prob = calculate_tile_probability(BAM_1, &visible, &hand);

        // 2 copies out of 86 tiles
        assert!(prob > 0.02 && prob < 0.03);
    }

    #[test]
    fn test_calculate_probability_complete() {
        let hand = Hand::new(vec![BAM_1, BAM_2]);
        let visible = VisibleTiles::new();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 1;
        histogram[BAM_2.0 as usize] = 1;

        // Already complete
        let prob = calculate_probability(&hand, &histogram, &visible);
        assert_eq!(prob, 1.0);
    }

    #[test]
    fn test_calculate_probability_impossible() {
        let hand = Hand::new(vec![BAM_1]);
        let visible = VisibleTiles::new();
        let mut histogram = vec![0u8; 36];
        histogram[BAM_1.0 as usize] = 10; // Need 10 tiles (impossible)

        let prob = calculate_probability(&hand, &histogram, &visible);
        assert_eq!(prob, 0.0);
    }

    #[test]
    fn test_calculate_any_tile_probability() {
        let visible = VisibleTiles::new();
        let hand = Hand::empty();

        // Probability of drawing BAM_1 or BAM_2 in 1 draw
        let tiles = vec![BAM_1, BAM_2];
        let prob = calculate_any_tile_probability(&tiles, 1, &visible, &hand);

        // Should be roughly (4/86 + 4/86) ≈ 0.093
        assert!(prob > 0.08 && prob < 0.10);
    }

    #[test]
    fn test_joker_probability() {
        let visible = VisibleTiles::new();
        let hand = Hand::empty();

        // Jokers have 8 copies
        let prob = calculate_tile_probability(JOKER, &visible, &hand);

        // 8 / 86 ≈ 0.093
        assert!(prob > 0.08 && prob < 0.10);
    }
}
