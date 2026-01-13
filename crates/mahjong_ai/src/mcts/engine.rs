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
        self.expand_node(&mut root);

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
            self.expand_node(current);

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
    fn expand_node(&self, node: &mut MCTSNode) {
        // TODO: Expand with heuristic pruning for large hands.
        // Get unique tiles in hand
        let mut unique_tiles: Vec<Tile> = node.hand.concealed.clone();
        unique_tiles.sort();
        unique_tiles.dedup();

        for tile in unique_tiles {
            // Don't expand joker discards (never discard jokers)
            if tile.is_joker() {
                continue;
            }

            // Create child hand
            let mut child_hand = node.hand.clone();
            if child_hand.remove_tile(tile).is_ok() {
                let child = MCTSNode::new(child_hand, Some(tile));
                node.children.push(child);
            }
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
        let engine = MCTSEngine::new(100, 42);
        let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3, JOKER]);

        let mut node = MCTSNode::new(hand, None);
        engine.expand_node(&mut node);

        // Should have 3 children (BAM_1, BAM_2, BAM_3) - not JOKER
        assert_eq!(node.children.len(), 3);

        // Verify no joker discards
        for child in &node.children {
            assert_ne!(child.move_tile, Some(JOKER));
        }
    }
}
