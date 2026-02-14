//! Monte Carlo Tree Search (MCTS) engine for Mahjong AI.
//!
//! Implements a complete MCTS framework for evaluating discard decisions through simulation-based search.
//! Used by [`MCTSAI`](crate::strategies::mcts_ai::MCTSAI) difficulty levels Easy through Hard.
//!
//! # Algorithm: Selection → Expansion → Simulation → Backpropagation
//!
//! 1. **Selection**: Navigate existing tree using UCB1 (Upper Confidence Bound)
//!    - Balances exploitation (play best moves) vs exploration (try new moves)
//!    - Formula: `UCB1 = (wins / visits) + C × √(ln(parent_visits) / visits)`
//!
//! 2. **Expansion**: Create child nodes for unvisited moves
//!    - Each unvisited move becomes a child node in the tree
//!    - Hand state copied to new node
//!
//! 3. **Simulation** (Playout): Random game from node to terminal state
//!    - Roll dice to draw from wall (determinize hidden tiles)
//!    - Simulate 1-4 more turns of random play
//!    - Score terminal state: win = 100.0, loss = -deficiency to win
//!
//! 4. **Backpropagation**: Update all nodes on path with simulation result
//!    - Increment visit counts
//!    - Add value to accumulated scores
//!    - Propagate up to root
//!
//! # Tree Structure: Arena-Based Storage
//!
//! All nodes stored in a flat `Vec<MCTSNode>` indexed by position. Nodes reference children
//! via indices (not pointers). This provides:
//! - Type-safe navigation (no `unsafe` code)
//! - Cache-friendly memory layout
//! - Easy serialization for debugging
//!
//! See [`MCTSEngine`] for migration from unsafe raw pointers and performance details.
//!
//! # Configuration
//!
//! - **Iterations**: Number of simulations (100-10,000+)
//! - **Exploration constant**: Tuning parameter for exploitation vs exploration (default: √2)
//! - **Pruning** (experimental): Optional heuristic branching factor reduction
//!
//! # Submodules

/// Core search engine orchestrating selection and backpropagation.
///
/// See [`MCTSEngine`] for comprehensive algorithm documentation and performance notes.
pub mod engine;
/// Tree node representation for MCTS.
///
/// See [`MCTSNode`] for UCB1 scoring and tree structure details.
pub mod node;
/// Simulation helpers for playout and wall determinization.
///
/// Implements random game simulation from a given hand state.
pub mod simulation;

/// Public re-export of the MCTS engine type.
pub use engine::MCTSEngine;
/// Public re-export of the MCTS node type.
pub use node::MCTSNode;
