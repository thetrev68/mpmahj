//! MCTS tree node structure and UCB1 selection.

use mahjong_core::hand::Hand;
use mahjong_core::tile::Tile;

/// A node in the MCTS tree.
///
/// Nodes are stored in an arena (flat `Vec`) in [`MCTSEngine`](super::engine::MCTSEngine),
/// and reference each other via indices rather than owning child nodes directly.
/// This eliminates the need for unsafe raw pointers during tree traversal.
#[derive(Debug, Clone)]
pub struct MCTSNode {
    /// Game state at this node.
    pub hand: Hand,

    /// The move that led to this state (tile discarded).
    pub move_tile: Option<Tile>,

    /// Number of times this node has been visited.
    pub visits: u32,

    /// Total value accumulated from simulations.
    pub total_value: f64,

    /// Indices of child nodes in the arena.
    ///
    /// Instead of owning children directly (`Vec<MCTSNode>`), we store indices into
    /// the parent [`MCTSEngine::nodes`](super::engine::MCTSEngine::nodes) arena.
    /// This allows safe mutable access during tree traversal without raw pointers.
    pub children: Vec<usize>,

    /// Is this a terminal node? (win or wall exhausted).
    pub terminal: bool,
}

impl MCTSNode {
    /// Create a new MCTS node.
    pub fn new(hand: Hand, move_tile: Option<Tile>) -> Self {
        Self {
            hand,
            move_tile,
            visits: 0,
            total_value: 0.0,
            children: Vec::new(),
            terminal: false,
        }
    }

    /// Calculate UCB1 score for selection.
    ///
    /// UCB1(node) = (value / visits) + C × sqrt(ln(parent_visits) / visits)
    ///
    /// - First term: Exploitation (pick best-performing child)
    /// - Second term: Exploration (try less-visited children)
    /// - C: Exploration constant (typically sqrt(2) ≈ 1.414)
    ///
    /// # Arguments
    /// * `parent_visits` - Number of visits to parent node
    /// * `exploration_constant` - Exploration parameter C
    ///
    /// # Returns
    /// UCB1 score (higher = should select this node)
    pub fn ucb1_score(&self, parent_visits: u32, exploration_constant: f64) -> f64 {
        if self.visits == 0 {
            return f64::INFINITY; // Unvisited nodes have infinite priority
        }

        let exploitation = self.total_value / (self.visits as f64);
        let exploration =
            exploration_constant * ((parent_visits as f64).ln() / (self.visits as f64)).sqrt();

        exploitation + exploration
    }

    /// Backpropagate simulation result up the tree.
    ///
    /// # Arguments
    /// * `value` - Value to add (win = 100.0, partial = deficiency-based)
    pub fn backpropagate(&mut self, value: f64) {
        self.visits += 1;
        self.total_value += value;
    }

    /// Get average value (exploitation term).
    pub fn average_value(&self) -> f64 {
        if self.visits == 0 {
            0.0
        } else {
            self.total_value / (self.visits as f64)
        }
    }
}

#[cfg(test)]
/// Unit tests for MCTS node scoring and backpropagation.
///
/// Note: Child selection tests have been moved to engine.rs since they now require
/// access to the node arena for index-based lookups.
mod tests {
    use super::*;

    #[test]
    fn test_mcts_node_new() {
        let hand = Hand::empty();
        let node = MCTSNode::new(hand, None);

        assert_eq!(node.visits, 0);
        assert_eq!(node.total_value, 0.0);
        assert_eq!(node.children.len(), 0);
        assert!(!node.terminal);
    }

    #[test]
    fn test_ucb1_unvisited() {
        let hand = Hand::empty();
        let node = MCTSNode::new(hand, None);

        let score = node.ucb1_score(10, 1.414);
        assert_eq!(score, f64::INFINITY);
    }

    #[test]
    fn test_ucb1_visited() {
        let hand = Hand::empty();
        let mut node = MCTSNode::new(hand, None);
        node.visits = 5;
        node.total_value = 50.0;

        // UCB1 = 50/5 + 1.414 * sqrt(ln(10) / 5)
        // UCB1 = 10.0 + 1.414 * sqrt(2.3 / 5)
        // UCB1 = 10.0 + 1.414 * 0.678 ≈ 10.96
        let score = node.ucb1_score(10, 1.414);
        assert!(score > 10.9 && score < 11.0);
    }

    #[test]
    fn test_backpropagate() {
        let hand = Hand::empty();
        let mut node = MCTSNode::new(hand, None);

        node.backpropagate(10.0);
        assert_eq!(node.visits, 1);
        assert_eq!(node.total_value, 10.0);

        node.backpropagate(20.0);
        assert_eq!(node.visits, 2);
        assert_eq!(node.total_value, 30.0);
    }

    #[test]
    fn test_average_value() {
        let hand = Hand::empty();
        let mut node = MCTSNode::new(hand, None);

        assert_eq!(node.average_value(), 0.0);

        node.visits = 5;
        node.total_value = 50.0;

        assert_eq!(node.average_value(), 10.0);
    }
}
