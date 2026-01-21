//! Shared event-specific types reused across the public, private, and analysis
//! event enums.
//!
//! Pattern metadata and replacement reasons live here to avoid repetition in
//! each event module.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Classification of pattern difficulty based on viability and probability.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub enum PatternDifficulty {
    /// Pattern is mathematically impossible (required tiles exhausted).
    Impossible,
    /// 4+ tiles needed, or low probability tiles (many already discarded).
    Hard,
    /// 2-3 tiles needed, moderate probability.
    Medium,
    /// 0-1 tiles needed, high probability tiles available.
    Easy,
}

/// Reason for a replacement draw.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub enum ReplacementReason {
    /// Drew replacement after declaring Kong.
    Kong,
    /// Drew replacement after declaring Quint.
    Quint,
    /// Drew replacement after exchanging blank tile.
    BlankExchange,
}

/// FRONTEND_INTEGRATION_POINT: Pattern Analysis Data Structure
/// This struct is sent to clients via AnalysisUpdate events.
/// TypeScript binding: apps/client/src/types/bindings/generated/PatternAnalysis.ts
///
/// Pattern analysis data sent to clients.
///
/// # Examples
/// ```
/// use mahjong_core::event::types::{PatternAnalysis, PatternDifficulty};
///
/// let analysis = PatternAnalysis {
///     pattern_name: "Seven Pairs".to_string(),
///     distance: 2,
///     viable: true,
///     difficulty: PatternDifficulty::Medium,
///     probability: 0.25,
///     score: 30,
/// };
/// assert!(analysis.viable);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub struct PatternAnalysis {
    /// Human-readable pattern name.
    pub pattern_name: String,
    /// Tiles needed to complete the pattern.
    pub distance: u8,
    /// Whether the pattern is still possible to complete.
    pub viable: bool,
    /// Difficulty bucket derived from distance and tile availability.
    pub difficulty: PatternDifficulty,
    /// Probability estimate in the range [0.0, 1.0].
    pub probability: f64,
    /// Scoring value used for sorting and hinting.
    pub score: u32,
}
