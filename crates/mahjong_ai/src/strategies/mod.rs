//! Strategy implementations used by the AI trait factory.

/// Greedy, EV-driven strategy.
pub mod greedy;
/// Monte Carlo Tree Search-driven strategy.
pub mod mcts_ai;
/// Random baseline strategy for testing and comparison.
pub mod random;
