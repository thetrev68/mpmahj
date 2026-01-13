//! Monte Carlo Tree Search engine and supporting modules.

/// Core search engine orchestrating selection and backpropagation.
pub mod engine;
/// Tree node representation for MCTS.
pub mod node;
/// Simulation helpers for playout and wall determinization.
pub mod simulation;

/// Public re-export of the MCTS engine type.
pub use engine::MCTSEngine;
/// Public re-export of the MCTS node type.
pub use node::MCTSNode;
