//! MCTS simulation and determinization.

use crate::context::VisibleTiles;
use crate::evaluation::StrategicEvaluation;
use mahjong_core::hand::Hand;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use rand::rngs::StdRng;
use rand::seq::SliceRandom;
use rand::Rng;

/// Determinize the wall (assign unknown tiles randomly).
///
/// This is necessary for MCTS in hidden information games.
/// We randomly assign unknown tiles to create a "possible world"
/// where we can perform perfect-information search.
///
/// # Arguments
/// * `hand` - AI's current hand
/// * `visible` - Tiles visible to all players
/// * `rng` - Random number generator
///
/// # Returns
/// Shuffled wall of remaining tiles
pub fn determinize_wall(hand: &Hand, visible: &VisibleTiles, rng: &mut StdRng) -> Vec<Tile> {
    let mut wall = Vec::new();

    // For each tile type, add remaining copies to wall
    for tile_id in 0..35 {
        let tile = Tile(tile_id);
        let total: usize = if tile.is_flower() || tile.is_joker() {
            8
        } else {
            4
        };

        let visible_count = visible.count_visible(tile);
        let in_hand = hand.count_tile(tile);
        let remaining = total.saturating_sub(visible_count + in_hand);

        for _ in 0..remaining {
            wall.push(tile);
        }
    }

    // Shuffle wall
    wall.shuffle(rng);

    wall
}

/// Simulate a random playout from current state to terminal state.
///
/// # Arguments
/// * `hand` - Starting hand
/// * `validator` - Validation engine
/// * `visible` - Visible tiles for probability calculations
/// * `wall` - Determinized wall
/// * `rng` - Random number generator
/// * `max_turns` - Maximum turns to simulate
///
/// # Returns
/// Evaluation score (higher = better)
pub fn simulate_playout(
    hand: &Hand,
    validator: &HandValidator,
    visible: &VisibleTiles,
    wall: &mut Vec<Tile>,
    rng: &mut StdRng,
    max_turns: usize,
) -> f64 {
    let mut sim_hand = hand.clone();
    let mut turns = 0;

    while turns < max_turns && !wall.is_empty() {
        // Draw tile
        if let Some(tile) = wall.pop() {
            sim_hand.add_tile(tile);
        } else {
            break; // Wall exhausted
        }

        // Check for win
        if validator.validate_win(&sim_hand).is_some() {
            return 100.0; // Win!
        }

        // Discard random tile (not joker if possible)
        let discard = select_random_discard(&sim_hand, rng);
        if sim_hand.remove_tile(discard).is_err() {
            break;
        }

        turns += 1;
    }

    // Didn't win - evaluate final hand
    evaluate_terminal_hand(&sim_hand, validator, visible)
}

/// Select a random tile to discard (prefer non-jokers).
fn select_random_discard(hand: &Hand, rng: &mut StdRng) -> Tile {
    // Try to find a non-joker tile
    let non_jokers: Vec<Tile> = hand
        .concealed
        .iter()
        .filter(|t| !t.is_joker())
        .copied()
        .collect();

    if !non_jokers.is_empty() {
        *non_jokers.choose(rng).unwrap()
    } else {
        // All jokers (rare) - pick any
        hand.concealed[rng.gen_range(0..hand.concealed.len())]
    }
}

/// Evaluate a terminal hand (didn't win).
///
/// Blends deficiency-based score with pattern expected value (EV).
/// - Deficiency score: How close to winning (0-10 scale)
/// - Pattern EV: score × probability of completion
///
/// The blend weights deficiency more heavily since it directly measures
/// progress, while EV adds value awareness (prefer high-scoring patterns).
fn evaluate_terminal_hand(hand: &Hand, validator: &HandValidator, visible: &VisibleTiles) -> f64 {
    let analyses = validator.analyze(hand, 3);
    if analyses.is_empty() {
        return 0.0;
    }

    // Get strategic evaluations with EV calculations
    let evaluations: Vec<StrategicEvaluation> = analyses
        .into_iter()
        .filter_map(|analysis| {
            let target_histogram = validator.histogram_for_variation(&analysis.variation_id)?;
            Some(StrategicEvaluation::from_analysis(
                analysis,
                hand,
                visible,
                target_histogram,
            ))
        })
        .collect();

    if evaluations.is_empty() {
        return 0.0;
    }

    // Find best by deficiency and best by EV
    let best_by_deficiency = evaluations.iter().min_by_key(|e| e.deficiency).unwrap();
    let best_by_ev = evaluations.iter().max_by(|a, b| {
        a.expected_value
            .partial_cmp(&b.expected_value)
            .expect("expected_value should not be NaN in simulation")
    }).unwrap();

    // Deficiency score: closer to win = higher (0-10 scale)
    let deficiency_score = (10 - best_by_deficiency.deficiency).max(0) as f64;

    // Normalized EV score (typical scores 25-50, scale to ~0-10)
    let ev_score = (best_by_ev.expected_value / 5.0).min(10.0);

    // Blend: 70% deficiency (progress), 30% EV (value awareness)
    deficiency_score * 0.7 + ev_score * 0.3
}

#[cfg(test)]
/// Unit tests for wall determinization and playout simulation.
mod tests {
    use super::*;
    use mahjong_core::rules::card::UnifiedCard;
    use mahjong_core::tile::tiles::*;
    use rand::SeedableRng;

    fn load_test_card() -> UnifiedCard {
        let json =
            std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
        UnifiedCard::from_json(&json).expect("Parse card")
    }

    #[test]
    fn test_determinize_wall() {
        let mut rng = StdRng::seed_from_u64(42);
        let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3]);
        let visible = VisibleTiles::new();

        let wall = determinize_wall(&hand, &visible, &mut rng);

        // Should have remaining tiles (most tiles are still available)
        // 35 tile types × 4 copies = 140 regular + 8 flowers + 8 jokers = 156 total
        // but American Mahjong has 152 total (different distribution)
        // Minus 3 in hand = ~149 tiles
        assert!(wall.len() > 140); // Most tiles should be in wall

        // Should not contain tiles in hand or visible
        // Actually they can appear since we only removed the counts we have
        // The hand check removes count_tile() copies, not all
        let bam1_count = wall.iter().filter(|&&t| t == BAM_1).count();
        assert!(bam1_count <= 3); // At most 3 left (4 total - 1 in hand)
    }

    #[test]
    fn test_determinize_wall_with_visible() {
        let mut rng = StdRng::seed_from_u64(42);
        let hand = Hand::new(vec![BAM_1, BAM_2]);
        let mut visible = VisibleTiles::new();

        // Discard 2 BAM_1
        visible.add_discard(BAM_1);
        visible.add_discard(BAM_1);

        let wall = determinize_wall(&hand, &visible, &mut rng);

        // Count BAM_1 in wall (should be 1: total 4 - 1 in hand - 2 visible = 1)
        let bam1_count = wall.iter().filter(|&&t| t == BAM_1).count();
        assert_eq!(bam1_count, 1);
    }

    #[test]
    fn test_simulate_playout() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut rng = StdRng::seed_from_u64(42);

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH,
        ]);

        let visible = VisibleTiles::new();
        let mut wall = determinize_wall(&hand, &visible, &mut rng);

        let score = simulate_playout(&hand, &validator, &visible, &mut wall, &mut rng, 20);

        // Should return a score between 0 and 100
        assert!((0.0..=100.0).contains(&score));
    }

    #[test]
    fn test_select_random_discard() {
        let mut rng = StdRng::seed_from_u64(42);
        let hand = Hand::new(vec![BAM_1, BAM_2, JOKER, CRAK_3]);

        let discard = select_random_discard(&hand, &mut rng);

        // Should be one of the tiles in hand
        assert!(hand.concealed.contains(&discard));
    }

    #[test]
    fn test_evaluate_terminal_hand() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH,
        ]);

        let score = evaluate_terminal_hand(&hand, &validator, &visible);

        // Should return a score >= 0 (blended deficiency + EV)
        assert!(score >= 0.0);
    }
}
