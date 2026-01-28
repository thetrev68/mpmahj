//! Analysis and hint events that are private by design.
//!
//! These events carry evaluation data, pattern viability scores, or hinting
//! guidance intended for a single player's client.

use crate::{event::types::PatternAnalysis, hint::HintData};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Private analysis events used for hints and pattern viability updates.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum AnalysisEvent {
    /// Pattern viability and scoring update for the active hand.
    AnalysisUpdate {
        /// Analysis for each viable pattern.
        patterns: Vec<PatternAnalysis>,
    },
    /// Distance-to-win update for the active hand.
    HandAnalysisUpdated {
        /// Minimum tile changes needed to win.
        distance_to_win: i32,
        /// Count of viable patterns.
        viable_count: usize,
        /// Count of impossible patterns.
        impossible_count: usize,
    },
    /// Hint data for the requesting player.
    HintUpdate {
        /// Suggested move and context.
        hint: Box<HintData>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings_analysis_event() {
        use ts_rs::TS;
        AnalysisEvent::export().expect("Failed to export AnalysisEvent");
    }
}
