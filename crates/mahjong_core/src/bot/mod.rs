//! Bot implementations for automated play heuristics.

pub mod basic;

/// A rule-based bot that scores tiles against the current card.
pub use basic::BasicBot;
