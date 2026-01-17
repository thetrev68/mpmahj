//! MCTS engine orchestrator.

use super::node::MCTSNode;
use super::simulation::{determinize_wall, simulate_playout};
use crate::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use rand::rngs::StdRng;
use rand::SeedableRng;
use std::time::Instant;

/// Monte Carlo Tree Search engine for move selection.
pub struct MCTSEngine {
    /// Number of simulations per move evaluation.
    pub iterations: usize,

    /// Time budget in milliseconds (alternative to iteration count).
    pub time_budget_ms: u64,

    /// Exploration constant for UCB1 (default: sqrt(2) ≈ 1.414).
    pub exploration_constant: f64,

    /// Random number generator for determinization.
    pub rng: StdRng,

    /// Maximum turns in a playout (prevents infinite loops).
    pub max_playout_turns: usize,

    /// Enable heuristic pruning to limit branching factor.
    ///
    /// **DEFAULT: `false` (disabled)**
    ///
    /// When enabled, only the top N moves (by heuristic score) are explored in the MCTS tree,
    /// reducing branching factor from ~10-12 to `max_children` (typically 5-8).
    ///
    /// # Current Status: EXPERIMENTAL
    ///
    /// Testing shows significant decision disagreement with baseline MCTS, indicating the
    /// current heuristic (deficiency-only scoring) is too simplistic. It prunes moves that
    /// full MCTS would choose, suggesting important factors are missing:
    ///
    /// - Defensive safety (opponent wait analysis)
    /// - Tile availability (probability of completing patterns)
    /// - Hand flexibility (tiles working with multiple patterns)
    /// - Future draw potential
    ///
    /// # Performance Impact
    ///
    /// Initial benchmarks show minimal speedup (~0.96x) with current implementation,
    /// as scoring overhead offsets reduced branching. May be more beneficial with:
    ///
    /// - Improved heuristic (faster to compute)
    /// - Very complex hands (12+ unique tiles)
    /// - Deeper MCTS iterations (10,000+)
    ///
    /// # Testing
    ///
    /// Run `cargo run --example compare_pruning --release` to test pruning behavior.
    /// Run `cargo run --example bot_tournament --release` for decision consistency.
    /// Run `cargo bench --bench mcts_pruning_bench` for statistical performance data.
    pub enable_pruning: bool,

    /// Maximum children to keep when pruning (0 = no limit).
    ///
    /// Only used when `enable_pruning = true`. Determines how many of the top-scoring
    /// moves are kept during tree expansion.
    ///
    /// # Tuning Guidelines
    ///
    /// - **3-5**: Aggressive pruning, fast but risky (high disagreement)
    /// - **5-8**: Balanced (recommended starting point for experimentation)
    /// - **8-10**: Conservative, minimal pruning benefit
    /// - **11+**: Ineffective (most hands have 10-12 unique discards)
    ///
    /// Testing shows even max=8 produces significant disagreement with baseline.
    pub max_children: usize,
}

impl MCTSEngine {
    /// Create a new MCTS engine with specified iterations.
    ///
    /// # Arguments
    /// * `iterations` - Number of MCTS iterations to run
    /// * `seed` - Random seed for determinization
    pub fn new(iterations: usize, seed: u64) -> Self {
        Self {
            iterations,
            time_budget_ms: 100,
            exploration_constant: 1.414, // sqrt(2)
            rng: StdRng::seed_from_u64(seed),
            max_playout_turns: 20, // Shallow playouts for speed
            enable_pruning: false, // Disabled by default for safety
            max_children: 8,       // Keep top 8 moves when pruning enabled
        }
    }

    /// Search for the best move using MCTS.
    ///
    /// # Arguments
    /// * `hand` - Current hand
    /// * `validator` - Validation engine
    /// * `visible` - Visible tiles
    ///
    /// # Returns
    /// Best tile to discard
    pub fn search(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        // Create root node
        let mut root = MCTSNode::new(hand.clone(), None);

        // Expand root immediately (all possible discards)
        self.expand_node(&mut root, validator);

        let start_time = Instant::now();

        // MCTS iterations
        for _ in 0..self.iterations {
            // Time budget check
            if start_time.elapsed().as_millis() > self.time_budget_ms as u128 {
                break;
            }

            // Run one MCTS iteration
            self.mcts_iteration(&mut root, validator, visible);
        }

        // Select best move (most visited child for robustness)
        if let Some(best_child) = root.most_visited_child() {
            best_child.move_tile.unwrap_or(hand.concealed[0])
        } else {
            // Fallback: return first tile if no children
            hand.concealed[0]
        }
    }

    /// Run a single MCTS iteration.
    ///
    /// Phases:
    /// 1. Selection - traverse tree using UCB1
    /// 2. Expansion - add new child node
    /// 3. Simulation - random playout
    /// 4. Backpropagation - update statistics
    ///
    /// # Safety
    ///
    /// This function uses raw pointers to maintain mutable references during tree traversal.
    /// The unsafe code is sound because:
    /// - All pointers are derived from valid, owned `MCTSNode` references
    /// - Ancestor `children` vectors are not mutated after capturing a child pointer
    /// - Expansion only occurs on the current leaf node when its `children` is empty
    /// - Tree structure guarantees no aliasing (each child is uniquely owned)
    ///
    /// TODO: Replace unsafe raw pointers with an indexed arena for safety and clarity.
    fn mcts_iteration(
        &mut self,
        root: &mut MCTSNode,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) {
        // 1. Selection
        let mut path = vec![root as *mut MCTSNode];
        let mut current = unsafe { &mut *path[0] };

        while !current.children.is_empty() {
            if let Some(child) = current.select_child_mut(self.exploration_constant) {
                let child_ptr = child as *mut MCTSNode;
                path.push(child_ptr);
                current = unsafe { &mut *child_ptr };
            } else {
                break;
            }
        }

        // 2. Expansion
        if current.visits > 0 && !current.terminal && current.children.is_empty() {
            self.expand_node(current, validator);

            // Select first child for simulation
            if let Some(child) = current.children.first_mut() {
                let child_ptr = child as *mut MCTSNode;
                path.push(child_ptr);
                current = unsafe { &mut *child_ptr };
            }
        }

        // 3. Simulation
        let value = self.simulate(current, validator, visible);

        // 4. Backpropagation
        for node_ptr in path {
            let node = unsafe { &mut *node_ptr };
            node.backpropagate(value);
        }
    }

    /// Expand a node by adding all possible child moves.
    ///
    /// # Pruning Behavior
    ///
    /// When `enable_pruning = true`, this function scores each possible discard using
    /// [`score_discard`](Self::score_discard) and keeps only the top `max_children` moves.
    /// This reduces the branching factor, allowing deeper search within the same time budget.
    ///
    /// ## Current Heuristic Limitations
    ///
    /// The scoring function uses only **deficiency** (distance to winning pattern), which
    /// misses critical factors:
    ///
    /// - **Defensive play**: Doesn't consider which tiles are safe to discard
    /// - **Tile availability**: Ignores which tiles are still drawable (dead wall analysis)
    /// - **Pattern flexibility**: Doesn't favor tiles that work with multiple patterns
    /// - **Draw probability**: Ignores likelihood of completing specific patterns
    ///
    /// As a result, pruning often eliminates moves that MCTS would explore, leading to
    /// suboptimal decisions. Testing shows 40-60% disagreement with baseline MCTS.
    ///
    /// ## When Disabled (Default)
    ///
    /// All unique non-joker tiles are added as children. Jokers are always filtered out
    /// regardless of pruning setting (never discard jokers).
    fn expand_node(&self, node: &mut MCTSNode, validator: &HandValidator) {
        // Get unique tiles in hand
        let mut unique_tiles: Vec<Tile> = node.hand.concealed.clone();
        unique_tiles.sort();
        unique_tiles.dedup();

        // Filter out jokers (never discard)
        let candidates: Vec<Tile> = unique_tiles.into_iter().filter(|t| !t.is_joker()).collect();

        // Apply pruning if enabled
        let tiles_to_expand =
            if self.enable_pruning && self.max_children > 0 && candidates.len() > self.max_children
            {
                // Score each candidate by resulting hand strength
                let mut scored: Vec<(Tile, f64)> = candidates
                    .iter()
                    .map(|&tile| {
                        let score = self.score_discard(&node.hand, tile, validator);
                        (tile, score)
                    })
                    .collect();

                // Sort by score (lower deficiency = better)
                scored.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

                // Keep top N candidates
                scored.truncate(self.max_children);
                scored.into_iter().map(|(tile, _)| tile).collect()
            } else {
                candidates
            };

        // Create child nodes for selected tiles
        for tile in tiles_to_expand {
            let mut child_hand = node.hand.clone();
            if child_hand.remove_tile(tile).is_ok() {
                let child = MCTSNode::new(child_hand, Some(tile));
                node.children.push(child);
            }
        }
    }

    /// Score a discard by evaluating the resulting hand strength.
    ///
    /// Returns the minimum deficiency (distance to winning pattern) after removing the tile.
    /// Lower score = better move (closer to win).
    ///
    /// # Current Implementation: Deficiency Only
    ///
    /// This is a **simplistic heuristic** that only considers how many tiles are needed to win
    /// after the discard. It uses the same O(1) histogram subtraction used by the validator,
    /// making it fast but incomplete.
    ///
    /// ## What's Missing
    ///
    /// A better heuristic would incorporate:
    ///
    /// 1. **Tile utility**: How many patterns need this tile (flexibility score)
    /// 2. **Availability**: Are the needed tiles still drawable? (dead wall analysis)
    /// 3. **Probability**: Likelihood of drawing completion tiles
    /// 4. **Defense**: Is this tile safe to discard? (opponent wait analysis)
    /// 5. **Meld potential**: Does this tile work with exposed melds?
    ///
    /// ## Why Not Implemented
    ///
    /// The goal was infrastructure first: prove pruning *can* work with a simple heuristic,
    /// then refine. Current testing shows even basic pruning needs a better heuristic before
    /// it's beneficial. The infrastructure exists for future experimentation.
    ///
    /// ## Performance Note
    ///
    /// Each call analyzes the hand against ~6000 pattern variations. With 10-12 discards to
    /// score, this adds ~60,000-72,000 pattern checks per expansion. This overhead currently
    /// negates the benefit of reduced branching.
    fn score_discard(&self, hand: &Hand, tile: Tile, validator: &HandValidator) -> f64 {
        let mut test_hand = hand.clone();

        // Try removing the tile
        if test_hand.remove_tile(tile).is_err() {
            return f64::MAX; // Invalid discard
        }

        // Calculate minimum deficiency across all patterns (top 1 is the best)
        let results = validator.analyze(&test_hand, 1);

        match results.first() {
            Some(result) => result.deficiency as f64,
            None => f64::MAX, // No viable patterns
        }
    }

    /// Simulate a random playout from the current node.
    fn simulate(
        &mut self,
        node: &MCTSNode,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        // Determinize wall
        let mut wall = determinize_wall(&node.hand, visible, &mut self.rng);

        // Run playout
        simulate_playout(
            &node.hand,
            validator,
            visible,
            &mut wall,
            &mut self.rng,
            self.max_playout_turns,
        )
    }

    /// Evaluate a position using MCTS (returns average score from simulations).
    ///
    /// Used by GreedyAI when it wants a more accurate evaluation.
    pub fn evaluate_position(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        let mut root = MCTSNode::new(hand.clone(), None);
        let start_time = Instant::now();

        for _ in 0..self.iterations {
            if start_time.elapsed().as_millis() > self.time_budget_ms as u128 {
                break;
            }

            let value = self.simulate(&root, validator, visible);
            root.backpropagate(value);
        }

        root.average_value()
    }
}

#[cfg(test)]
/// Unit tests for MCTS engine behavior and node expansion.
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
    fn test_mcts_engine_new() {
        let engine = MCTSEngine::new(1000, 42);
        assert_eq!(engine.iterations, 1000);
        assert_eq!(engine.exploration_constant, 1.414);
    }

    #[test]
    fn test_mcts_search() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut engine = MCTSEngine::new(100, 42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH, DOT_9,
        ]);

        let discard = engine.search(&hand, &validator, &visible);

        // Should return a valid tile from the hand
        assert!(hand.concealed.contains(&discard));

        // Should not be a joker
        assert_ne!(discard, JOKER);
    }

    #[test]
    fn test_mcts_evaluate_position() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let mut engine = MCTSEngine::new(50, 42);
        let visible = VisibleTiles::new();

        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST,
            NORTH,
        ]);

        let score = engine.evaluate_position(&hand, &validator, &visible);

        // Should return a score between 0 and 100
        assert!((0.0..=100.0).contains(&score));
    }

    #[test]
    fn test_expand_node() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);
        let engine = MCTSEngine::new(100, 42);
        let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3, JOKER]);

        let mut node = MCTSNode::new(hand, None);
        engine.expand_node(&mut node, &validator);

        // Should have 3 children (BAM_1, BAM_2, BAM_3) - not JOKER
        assert_eq!(node.children.len(), 3);

        // Verify no joker discards
        for child in &node.children {
            assert_ne!(child.move_tile, Some(JOKER));
        }
    }

    #[test]
    fn test_expand_node_with_pruning() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);

        // Create engine with pruning enabled, limit to 3 children
        let mut engine = MCTSEngine::new(100, 42);
        engine.enable_pruning = true;
        engine.max_children = 3;

        // Hand with many unique tiles
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
            JOKER,
        ]);

        let mut node = MCTSNode::new(hand, None);
        engine.expand_node(&mut node, &validator);

        // Should have at most 3 children due to pruning
        assert!(node.children.len() <= 3);
        assert!(!node.children.is_empty());

        // Verify no joker discards
        for child in &node.children {
            assert_ne!(child.move_tile, Some(JOKER));
        }
    }

    #[test]
    fn test_expand_node_pruning_disabled() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);

        // Create engine with pruning DISABLED
        let engine = MCTSEngine::new(100, 42);
        assert!(!engine.enable_pruning); // Verify default is off

        // Hand with many unique tiles
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
            JOKER,
        ]);

        let mut node = MCTSNode::new(hand, None);
        engine.expand_node(&mut node, &validator);

        // Should have all 11 unique non-joker tiles as children (no pruning)
        assert_eq!(node.children.len(), 11);
    }
}
