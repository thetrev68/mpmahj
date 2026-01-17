//! Strategic AI engine for American Mahjong.
//!
//! This crate provides intelligent computer opponents using Monte Carlo Tree Search
//! and strategic evaluation functions. It complements the validation engine in
//! `mahjong_core` by answering "What should I do?" rather than "Is this legal?"
//!
//! # Architecture
//!
//! - `mahjong_core`: Deterministic validation ("Is this legal?")
//! - `mahjong_ai`: Probabilistic strategy ("What should I do?")
//!
//! # Difficulty Levels
//!
//! - **Easy**: Simple heuristics from BasicBot (<10ms)
//! - **Medium**: Random baseline decisions
//! - **Hard**: Greedy EV maximization (~20ms)
//! - **Expert**: MCTS with 10,000 iterations (~100ms)

/// Shared context types for tracking visible game state.
pub mod context;
/// Heuristics and scoring utilities for AI decision-making.
pub mod evaluation;
/// Hint generation helpers and public hint advisor APIs.
pub mod hint;
/// Monte Carlo Tree Search engine and supporting types.
pub mod mcts;
/// Probability estimates used by strategic evaluators.
pub mod probability;
/// Concrete AI strategy implementations.
pub mod strategies;
/// Test utilities and constants.
pub mod test_utils;
/// Core AI trait and difficulty-level construction.
pub mod r#trait;

/// Public re-exports for commonly used AI types.
pub use context::{GamePhaseContext, VisibleTiles};
pub use evaluation::StrategicEvaluation;
pub use hint::HintAdvisor;
pub use mcts::MCTSEngine;
pub use r#trait::{create_ai, Difficulty, MahjongAI};
pub use strategies::greedy::GreedyAI;
pub use strategies::mcts_ai::MCTSAI;

#[cfg(test)]
/// Test-only sanity checks for the crate wiring.
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
