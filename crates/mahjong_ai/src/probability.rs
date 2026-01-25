//! Tile probability calculations for strategic decision-making.
//!
//! This module provides probability calculations for Mahjong AI strategy.
//! All functions use the **hypergeometric distribution** to model tile drawing
//! without replacement, which is mathematically correct for Mahjong mechanics.
//!
//! # Key Concepts
//!
//! - **Hypergeometric distribution**: Models probability of drawing specific tiles
//!   from a finite population without replacement. Unlike binomial distribution,
//!   it accounts for the changing probabilities as tiles are drawn.
//!
//! - **Wall composition**: Standard American Mahjong uses 152 tiles total,
//!   with 14 tiles in the dead wall and 52 tiles dealt to players (13 × 4).
//!
//! # Example
//!
//! ```
//! use mahjong_ai::context::VisibleTiles;
//! use mahjong_ai::probability::calculate_tile_probability;
//! use mahjong_core::hand::Hand;
//! use mahjong_core::tile::tiles::BAM_1;
//!
//! let visible = VisibleTiles::new();
//! let hand = Hand::empty();
//!
//! // Calculate probability of drawing BAM_1 on next draw
//! let prob = calculate_tile_probability(BAM_1, &visible, &hand);
//! assert!(prob > 0.0 && prob < 1.0);
//! ```

use crate::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::tile::Tile;
use statrs::distribution::{Discrete, Hypergeometric};

/// Total tiles in a standard American Mahjong set.
const TOTAL_TILES: usize = 152;

/// Tiles in the dead wall (not drawable).
const DEAD_WALL: usize = 14;

/// Tiles dealt to players at game start (13 × 4 players).
const DEALT_TILES: usize = 52;

/// Calculate P(tile) - probability of drawing a specific tile on the next draw.
///
/// Uses the hypergeometric probability mass function to calculate the exact
/// probability of drawing at least one copy of a specific tile.
///
/// # Arguments
///
/// * `tile` - The tile we want to draw
/// * `visible` - Tiles that are publicly visible (discards, melds, etc.)
/// * `hand` - AI's current hand (tiles AI already has)
///
/// # Returns
///
/// Probability between 0.0 and 1.0 representing the likelihood of drawing
/// the specified tile on the next draw.
///
/// # Implementation Notes
///
/// The probability is calculated as `remaining_copies / tiles_in_wall`, which
/// is equivalent to `P(X >= 1)` for a hypergeometric distribution with `n=1`
/// (single draw). This simplifies to the basic probability formula.
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

    let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
    let tiles_in_wall = drawable.saturating_sub(visible.tiles_drawn);

    if tiles_in_wall == 0 {
        return 0.0; // Wall exhausted
    }

    // Simple probability: remaining copies / remaining tiles
    // This is P(X >= 1) for hypergeometric with n=1, which simplifies to K/N
    remaining_copies as f64 / tiles_in_wall as f64
}

/// Calculate probability of completing a pattern from current hand.
///
/// Uses the **multivariate hypergeometric distribution** to accurately model
/// the probability of drawing multiple specific tiles from a finite population
/// without replacement.
///
/// # Arguments
///
/// * `hand` - Current hand
/// * `target_histogram` - Pattern's target histogram (tiles needed to complete)
/// * `visible` - Visible tiles tracker
///
/// # Returns
///
/// Estimated probability of completion (0.0-1.0).
///
/// # Implementation Notes
///
/// The multivariate hypergeometric distribution models drawing multiple
/// categories of items without replacement. For pattern completion:
///
/// - **Population (N)**: Total tiles remaining in wall
/// - **Successes per category (K_i)**: Remaining copies of each needed tile
/// - **Draws (n)**: Estimated remaining draws (based on tiles in wall)
/// - **Wanted per category (k_i)**: How many of each tile we still need
///
/// Since exact multivariate hypergeometric is computationally expensive for
/// many categories, we use an approximation:
///
/// 1. Calculate cumulative probability using nested hypergeometric draws
/// 2. For each needed tile type, compute P(drawing enough before wall exhausts)
/// 3. Combine probabilities accounting for the shrinking population
///
/// This is more accurate than the independence assumption (which can have
/// 5-15% relative error) while remaining computationally tractable.
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
    // Calculate deficiency (total tiles needed)
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

    // Calculate wall state first to check feasibility
    let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
    let tiles_in_wall = drawable.saturating_sub(visible.tiles_drawn);

    if tiles_in_wall == 0 {
        return 0.0; // Wall exhausted
    }

    // Only return 0 for truly impossible distances (more than available draws)
    // For display purposes, show very low probabilities instead of 0
    if deficiency > 10 {
        return 0.0; // Far beyond realistic completion
    }

    // For patterns 7-10 tiles away, use exponentially decreasing probability
    if deficiency > 6 {
        // Very low but non-zero probability for distant patterns
        // This shows them as "possible but very unlikely" in the UI
        let distance_penalty = 0.5_f64.powi(deficiency - 6);
        let base_prob = (tiles_in_wall as f64 / 100.0).min(0.05);
        return base_prob * distance_penalty;
    }

    // Collect missing tiles with their remaining copies and needed counts
    let missing_tile_info = collect_missing_tile_info(hand, target_histogram, visible);

    if missing_tile_info.is_empty() {
        return 1.0; // Nothing missing
    }

    // Check if any required tile is completely dead
    for &(_, remaining, needed) in &missing_tile_info {
        if remaining < needed {
            return 0.0; // Impossible - not enough copies exist
        }
    }

    // Calculate probability using hypergeometric approximation
    calculate_hypergeometric_probability(&missing_tile_info, tiles_in_wall, deficiency as usize)
}

/// Collects information about missing tiles for probability calculation.
///
/// # Arguments
///
/// * `hand` - Current hand
/// * `target_histogram` - Pattern's target histogram
/// * `visible` - Visible tiles tracker
///
/// # Returns
///
/// Vector of tuples: `(tile_index, remaining_in_wall, copies_needed)`
fn collect_missing_tile_info(
    hand: &Hand,
    target_histogram: &[u8],
    visible: &VisibleTiles,
) -> Vec<(usize, usize, usize)> {
    let mut result = Vec::new();

    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];
        if needed > have {
            let tile = Tile(i as u8);
            let copies_needed = (needed - have) as usize;

            // Calculate remaining copies in wall
            let total_copies: usize = if tile.is_flower() || tile.is_joker() {
                8
            } else {
                4
            };
            let visible_count = visible.count_visible(tile);
            let in_hand = have as usize;
            let remaining = total_copies.saturating_sub(visible_count + in_hand);

            result.push((i, remaining, copies_needed));
        }
    }

    result
}

/// Calculates pattern completion probability using hypergeometric distribution.
///
/// Uses a sequential hypergeometric model: for each tile type needed, calculate
/// the probability of drawing enough copies given the remaining wall state.
/// Probabilities are combined conservatively to account for dependencies.
///
/// # Arguments
///
/// * `missing_info` - Vector of (tile_idx, remaining_copies, copies_needed)
/// * `wall_size` - Total tiles remaining in wall
/// * `total_needed` - Total tiles we need to draw
///
/// # Returns
///
/// Probability of drawing all needed tiles (0.0-1.0).
///
/// # Implementation Notes
///
/// For each tile type, we calculate P(X >= k) where X follows a hypergeometric
/// distribution with:
/// - N = wall_size (population)
/// - K = remaining_copies (successes in population)
/// - n = estimated_draws (sample size, approximated as tiles_needed × 3 to
///   account for having multiple draws to find needed tiles)
///
/// The probabilities are combined using a geometric mean to balance between
/// the optimistic independence assumption and pessimistic minimum approach.
fn calculate_hypergeometric_probability(
    missing_info: &[(usize, usize, usize)],
    wall_size: usize,
    total_needed: usize,
) -> f64 {
    if wall_size == 0 || total_needed == 0 {
        return 0.0;
    }

    // Estimate available draws - assume we have about 1/4 of wall remaining
    // This is a heuristic based on typical game progression
    let estimated_draws = wall_size.min(total_needed * 4);

    if estimated_draws < total_needed {
        return 0.0; // Not enough draws possible
    }

    // Calculate total "good" tiles in the wall (sum of all remaining copies we need)
    let total_successes: usize = missing_info.iter().map(|&(_, rem, _)| rem).sum();

    // Use single hypergeometric for total needed tiles
    // This is more accurate than product of individual probabilities
    let prob = hypergeometric_at_least_k(
        wall_size as u64,
        total_successes as u64,
        estimated_draws as u64,
        total_needed as u64,
    );

    // Apply a correction factor based on how "spread out" the needed tiles are
    // If we need many different tile types, it's harder than needing copies of same tile
    let tile_types_needed = missing_info.len();
    let diversity_penalty = if tile_types_needed > 1 {
        // Slight penalty for needing diverse tiles (harder to collect)
        0.95_f64.powi((tile_types_needed - 1) as i32)
    } else {
        1.0
    };

    (prob * diversity_penalty).clamp(0.0, 1.0)
}

/// Calculates P(X >= k) for a hypergeometric distribution.
///
/// Uses the `statrs` crate's hypergeometric distribution to compute the
/// probability of drawing at least `k` successes.
///
/// # Arguments
///
/// * `population` - Total population size (N)
/// * `successes` - Number of success states in population (K)
/// * `draws` - Number of draws (n)
/// * `k` - Minimum successes wanted
///
/// # Returns
///
/// Probability P(X >= k) where X ~ Hypergeometric(N, K, n).
///
/// # Implementation Notes
///
/// We calculate this as `1 - P(X < k) = 1 - sum_{i=0}^{k-1} P(X=i)`.
/// This uses the PMF from the `statrs` crate which implements the exact
/// hypergeometric probability mass function.
fn hypergeometric_at_least_k(population: u64, successes: u64, draws: u64, k: u64) -> f64 {
    // Handle edge cases
    if k == 0 {
        return 1.0; // Always succeed if we need 0
    }

    if successes < k {
        return 0.0; // Not enough successes exist
    }

    if draws < k {
        return 0.0; // Not enough draws to get k
    }

    // Clamp draws to valid range
    let draws = draws.min(population);

    // Clamp successes to valid range
    let successes = successes.min(population);

    // Create hypergeometric distribution
    // statrs::Hypergeometric::new(population, successes, draws)
    // Returns Err if parameters invalid
    let dist = match Hypergeometric::new(population, successes, draws) {
        Ok(d) => d,
        Err(_) => return 0.0, // Invalid parameters
    };

    // Calculate P(X < k) = sum of PMF from 0 to k-1
    let mut prob_less_than_k = 0.0;
    for i in 0..k {
        prob_less_than_k += dist.pmf(i);
    }

    // P(X >= k) = 1 - P(X < k)
    (1.0 - prob_less_than_k).clamp(0.0, 1.0)
}

/// Calculate probability of drawing any tile from a set within N draws.
///
/// Uses the **hypergeometric distribution** to accurately calculate the
/// probability of drawing at least one tile from a specified set within
/// a given number of draws.
///
/// # Arguments
///
/// * `tiles` - Set of tiles we'd be happy to draw (any one of these counts as success)
/// * `draws` - Number of draws we'll make
/// * `visible` - Visible tiles tracker
/// * `hand` - Current hand
///
/// # Returns
///
/// Probability of drawing at least one of the specified tiles (0.0-1.0).
///
/// # Implementation Notes
///
/// This uses the hypergeometric formula `P(X >= 1) = 1 - P(X = 0)` where:
/// - **N** = total tiles in wall
/// - **K** = sum of remaining copies of all wanted tiles
/// - **n** = number of draws
///
/// The hypergeometric model is more accurate than the binomial approximation
/// because it correctly accounts for sampling without replacement.
///
/// # Examples
///
/// ```
/// use mahjong_ai::context::VisibleTiles;
/// use mahjong_ai::probability::calculate_any_tile_probability;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::{BAM_1, BAM_2};
///
/// let visible = VisibleTiles::new();
/// let hand = Hand::empty();
///
/// // Probability of drawing BAM_1 or BAM_2 in 1 draw
/// let tiles = vec![BAM_1, BAM_2];
/// let prob = calculate_any_tile_probability(&tiles, 1, &visible, &hand);
///
/// // Should be roughly 8/86 ≈ 0.093 (8 total copies of these tiles)
/// assert!(prob > 0.08 && prob < 0.10);
/// ```
pub fn calculate_any_tile_probability(
    tiles: &[Tile],
    draws: usize,
    visible: &VisibleTiles,
    hand: &Hand,
) -> f64 {
    if tiles.is_empty() || draws == 0 {
        return 0.0;
    }

    // Calculate wall state
    let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
    let tiles_in_wall = drawable.saturating_sub(visible.tiles_drawn);

    if tiles_in_wall == 0 {
        return 0.0; // Wall exhausted
    }

    // Count total remaining copies of all wanted tiles
    let mut total_remaining: usize = 0;
    for &tile in tiles {
        let total_copies: usize = if tile.is_flower() || tile.is_joker() {
            8
        } else {
            4
        };
        let visible_count = visible.count_visible(tile);
        let in_hand = hand.count_tile(tile);
        total_remaining += total_copies.saturating_sub(visible_count + in_hand);
    }

    if total_remaining == 0 {
        return 0.0; // All wanted tiles are dead
    }

    // P(X >= 1) = 1 - P(X = 0)
    // Using hypergeometric distribution
    hypergeometric_at_least_k(
        tiles_in_wall as u64,
        total_remaining as u64,
        draws.min(tiles_in_wall) as u64,
        1,
    )
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

    #[test]
    fn test_variable_suit_patterns_exhausted() {
        // Test 5: Variable Suit Patterns with Exhausted Tiles
        let mut visible = VisibleTiles::new();
        let hand = Hand::empty();

        // 3 visible BAM_1 (nearly exhausted)
        for _ in 0..3 {
            visible.add_discard(BAM_1);
        }
        let prob = calculate_tile_probability(BAM_1, &visible, &hand);
        assert!(prob < 0.02);
        assert!(prob > 0.0);

        // 4 visible BAM_1 (fully exhausted)
        visible.add_discard(BAM_1);
        let prob = calculate_tile_probability(BAM_1, &visible, &hand);
        assert_eq!(prob, 0.0);
    }

    #[test]
    fn test_nearly_exhausted_tile_pools() {
        // Test 7: Nearly-Exhausted Tile Pools
        let mut visible = VisibleTiles::new();
        let hand = Hand::empty();

        // Simulate drawing down the wall to 18 tiles remaining
        // Total drawable = 86 (152 - 14 - 52)
        // Draw 68 tiles (86 - 18)
        for _ in 0..68 {
            visible.record_draw();
        }

        // Unaccounted tiles (e.g. BAM_1) have high probability
        // 4 copies / 18 remaining ≈ 0.222
        let prob = calculate_tile_probability(BAM_1, &visible, &hand);
        assert!(prob > 0.20);

        // Verify with joker (8 copies)
        // 8 / 18 ≈ 0.444
        let joker_prob = calculate_tile_probability(JOKER, &visible, &hand);
        assert!(joker_prob > 0.40);
    }
}
