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
///
/// # Arena-Based Tree Storage
///
/// All MCTS nodes are stored in a flat [`Vec<MCTSNode>`] arena, and nodes reference
/// their children via indices rather than owning them directly. This eliminates the
/// need for unsafe raw pointers during tree traversal (see [Migration from Unsafe](#migration-from-unsafe)).
///
/// ## Structure
///
/// ```text
/// nodes: Vec<MCTSNode>
///   [0] Root node           (children: [1, 2, 3])
///   [1]   Child A           (children: [4, 5])
///   [2]   Child B           (children: [6])
///   [3]   Child C           (children: [])
///   [4]     Grandchild A1   (children: [])
///   [5]     Grandchild A2   (children: [])
///   [6]     Grandchild B1   (children: [])
/// ```
///
/// ## Migration from Unsafe
///
/// **Previous implementation** (before 2026-01-17):
/// - Nodes owned their children: `children: Vec<MCTSNode>`
/// - Tree traversal used raw pointers: `unsafe { &mut *child_ptr }`
/// - Required careful reasoning about pointer aliasing and lifetimes
///
/// **Current implementation**:
/// - Nodes store child indices: `children: Vec<usize>`
/// - Tree traversal uses safe indexing: `&mut self.nodes[child_idx]`
/// - Borrow checker enforces safety at compile time
///
/// ## Performance Characteristics
///
/// - **Memory layout**: Nodes stored contiguously (cache-friendly)
/// - **Traversal cost**: O(1) index lookup vs O(1) pointer dereference (equivalent)
/// - **Expansion cost**: O(1) append to arena + O(1) child index addition
/// - **No overhead**: Zero-cost abstraction over raw pointers
///
/// Benchmarking shows no measurable performance difference from the unsafe version.
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

    /// Arena storage for all MCTS nodes.
    ///
    /// Nodes are never removed during a search, only appended. The root node is always at index 0.
    /// The arena is cleared at the start of each [`search()`](Self::search) call.
    nodes: Vec<MCTSNode>,

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
            max_playout_turns: 20,           // Shallow playouts for speed
            nodes: Vec::with_capacity(1000), // Pre-allocate for typical tree size
            enable_pruning: false,           // Disabled by default for safety
            max_children: 8,                 // Keep top 8 moves when pruning enabled
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
    ///
    /// # Arena Management
    ///
    /// Each search starts with a fresh arena. The root node is always at index 0,
    /// and child nodes are appended as the tree is expanded during iterations.
    pub fn search(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        // Clear arena and create root node
        self.nodes.clear();
        let root = MCTSNode::new(hand.clone(), None);
        self.nodes.push(root);
        let root_idx = 0;

        // Expand root immediately (all possible discards)
        self.expand_node(root_idx, validator);

        let start_time = Instant::now();

        // MCTS iterations
        for _ in 0..self.iterations {
            // Time budget check
            if start_time.elapsed().as_millis() > self.time_budget_ms as u128 {
                break;
            }

            // Run one MCTS iteration
            self.mcts_iteration(root_idx, validator, visible);
        }

        // Select best move (most visited child for robustness)
        self.most_visited_child(root_idx)
            .and_then(|child_idx| self.nodes[child_idx].move_tile)
            .unwrap_or(hand.concealed[0])
    }

    /// Run a single MCTS iteration.
    ///
    /// Phases:
    /// 1. **Selection** - Traverse tree from root to leaf using UCB1 policy
    /// 2. **Expansion** - Add new child nodes if the leaf has been visited
    /// 3. **Simulation** - Run a random playout from the selected node
    /// 4. **Backpropagation** - Update visit counts and values along the path
    ///
    /// # Index-Based Traversal
    ///
    /// All node access uses safe indexing into the `self.nodes` arena:
    /// - Path stores node indices (not pointers): `Vec<usize>`
    /// - Selection uses [`select_best_child_idx`](Self::select_best_child_idx)
    /// - Expansion appends to arena and updates parent's `children` vector
    /// - Backpropagation iterates over path indices
    ///
    /// No unsafe code required - the borrow checker ensures safety.
    fn mcts_iteration(
        &mut self,
        root_idx: usize,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) {
        // 1. Selection - traverse tree using UCB1
        let mut path = vec![root_idx];
        let mut current_idx = root_idx;

        loop {
            let has_children = !self.nodes[current_idx].children.is_empty();
            if !has_children {
                break;
            }

            if let Some(child_idx) = self.select_best_child_idx(current_idx) {
                path.push(child_idx);
                current_idx = child_idx;
            } else {
                break;
            }
        }

        // 2. Expansion - add children if this node has been visited
        let should_expand = {
            let node = &self.nodes[current_idx];
            node.visits > 0 && !node.terminal && node.children.is_empty()
        };

        if should_expand {
            self.expand_node(current_idx, validator);

            // Select first child for simulation
            if let Some(&first_child_idx) = self.nodes[current_idx].children.first() {
                path.push(first_child_idx);
                current_idx = first_child_idx;
            }
        }

        // 3. Simulation - run random playout
        let value = self.simulate(current_idx, validator, visible);

        // 4. Backpropagation - update all nodes in path
        for &node_idx in &path {
            self.nodes[node_idx].backpropagate(value);
        }
    }

    /// Select best child using UCB1 score.
    ///
    /// # Arguments
    /// * `parent_idx` - Index of parent node in arena
    ///
    /// # Returns
    /// Index of best child, or None if no children
    fn select_best_child_idx(&self, parent_idx: usize) -> Option<usize> {
        let parent = &self.nodes[parent_idx];
        if parent.children.is_empty() {
            return None;
        }

        let parent_visits = parent.visits;
        parent
            .children
            .iter()
            .max_by(|&&a_idx, &&b_idx| {
                let score_a =
                    self.nodes[a_idx].ucb1_score(parent_visits, self.exploration_constant);
                let score_b =
                    self.nodes[b_idx].ucb1_score(parent_visits, self.exploration_constant);
                score_a
                    .partial_cmp(&score_b)
                    .expect("UCB1 scores should not be NaN - check visits > 0")
            })
            .copied()
    }

    /// Get most visited child of a node.
    ///
    /// Used for final move selection after search completes.
    fn most_visited_child(&self, parent_idx: usize) -> Option<usize> {
        let parent = &self.nodes[parent_idx];
        parent
            .children
            .iter()
            .max_by_key(|&&child_idx| self.nodes[child_idx].visits)
            .copied()
    }

    /// Expand a node by adding all possible child moves.
    ///
    /// # Arguments
    /// * `node_idx` - Index of node to expand in arena
    /// * `validator` - Hand validator for pattern analysis
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
    ///
    /// # Arena Management
    ///
    /// Child nodes are appended to `self.nodes` and their indices are stored in the parent's
    /// `children` vector. This function modifies both the arena and the parent node.
    fn expand_node(&mut self, node_idx: usize, validator: &HandValidator) {
        // Get unique tiles in hand (need to clone to avoid borrow conflicts)
        let hand = self.nodes[node_idx].hand.clone();
        let mut unique_tiles: Vec<Tile> = hand.concealed.clone();
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
                        let score = self.score_discard(&hand, tile, validator);
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
            let mut child_hand = hand.clone();
            if child_hand.remove_tile(tile).is_ok() {
                let child = MCTSNode::new(child_hand, Some(tile));
                let child_idx = self.nodes.len();
                self.nodes.push(child);
                self.nodes[node_idx].children.push(child_idx);
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
    ///
    /// # Arguments
    /// * `node_idx` - Index of node to simulate from
    /// * `validator` - Hand validator
    /// * `visible` - Visible tiles
    fn simulate(
        &mut self,
        node_idx: usize,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        let hand = &self.nodes[node_idx].hand;

        // Determinize wall
        let mut wall = determinize_wall(hand, visible, &mut self.rng);

        // Run playout
        simulate_playout(
            hand,
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
    ///
    /// # Arguments
    /// * `hand` - Hand to evaluate
    /// * `validator` - Hand validator
    /// * `visible` - Visible tiles
    ///
    /// # Returns
    /// Average value from Monte Carlo simulations
    pub fn evaluate_position(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        // Clear arena and create root
        self.nodes.clear();
        let root = MCTSNode::new(hand.clone(), None);
        self.nodes.push(root);
        let root_idx = 0;

        let start_time = Instant::now();

        for _ in 0..self.iterations {
            if start_time.elapsed().as_millis() > self.time_budget_ms as u128 {
                break;
            }

            let value = self.simulate(root_idx, validator, visible);
            self.nodes[root_idx].backpropagate(value);
        }

        self.nodes[root_idx].average_value()
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
        let mut engine = MCTSEngine::new(100, 42);
        let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3, JOKER]);

        // Add root to arena
        engine.nodes.clear();
        let node = MCTSNode::new(hand, None);
        engine.nodes.push(node);
        let node_idx = 0;

        engine.expand_node(node_idx, &validator);

        // Should have 3 children (BAM_1, BAM_2, BAM_3) - not JOKER
        assert_eq!(engine.nodes[node_idx].children.len(), 3);

        // Verify no joker discards
        for &child_idx in &engine.nodes[node_idx].children {
            assert_ne!(engine.nodes[child_idx].move_tile, Some(JOKER));
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

        // Add root to arena
        engine.nodes.clear();
        let node = MCTSNode::new(hand, None);
        engine.nodes.push(node);
        let node_idx = 0;

        engine.expand_node(node_idx, &validator);

        // Should have at most 3 children due to pruning
        assert!(engine.nodes[node_idx].children.len() <= 3);
        assert!(!engine.nodes[node_idx].children.is_empty());

        // Verify no joker discards
        for &child_idx in &engine.nodes[node_idx].children {
            assert_ne!(engine.nodes[child_idx].move_tile, Some(JOKER));
        }
    }

    #[test]
    fn test_expand_node_pruning_disabled() {
        let card = load_test_card();
        let validator = HandValidator::new(&card);

        // Create engine with pruning DISABLED
        let mut engine = MCTSEngine::new(100, 42);
        assert!(!engine.enable_pruning); // Verify default is off

        // Hand with many unique tiles
        let hand = Hand::new(vec![
            BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
            JOKER,
        ]);

        // Add root to arena
        engine.nodes.clear();
        let node = MCTSNode::new(hand, None);
        engine.nodes.push(node);
        let node_idx = 0;

        engine.expand_node(node_idx, &validator);

        // Should have all 11 unique non-joker tiles as children (no pruning)
        assert_eq!(engine.nodes[node_idx].children.len(), 11);
    }
}
