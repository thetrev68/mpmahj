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
//! - **Basic**: Simple heuristics from BasicBot (<10ms)
//! - **Medium**: Greedy EV maximization (~20ms)
//! - **Hard**: MCTS with 1,000 iterations (~50ms)
//! - **Expert**: MCTS with 10,000 iterations (~100ms)

pub mod context;
pub mod evaluation;
pub mod hint;
pub mod mcts;
pub mod probability;
pub mod strategies;
pub mod r#trait;

// Re-exports
pub use context::{GamePhaseContext, VisibleTiles};
pub use evaluation::StrategicEvaluation;
pub use hint::HintAdvisor;
pub use mcts::MCTSEngine;
pub use r#trait::{create_ai, Difficulty, MahjongAI};
pub use strategies::greedy::GreedyAI;
pub use strategies::mcts_ai::MCTSAI;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
