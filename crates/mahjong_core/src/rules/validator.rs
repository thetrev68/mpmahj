use crate::hand::Hand;
use crate::rules::card::{AnalysisEntry, UnifiedCard};
use serde::Serialize;

/// The result of analyzing a hand against a specific pattern variation.
#[derive(Debug, Clone, Serialize)]
pub struct AnalysisResult {
    /// The ID of the pattern (e.g., "2025-GRP1-H1").
    pub pattern_id: String,

    /// The ID of the specific variation (e.g., "2025-GRP1-H1-VAR1").
    pub variation_id: String,

    /// How many tiles are missing to win? (0 = Mahjong).
    pub deficiency: i32,

    /// Score of the hand if won.
    pub score: u16,
}

#[derive(Debug, Clone)]
pub struct HandValidator {
    /// The flattened lookup table of all possible hands.
    lookup_table: Vec<AnalysisEntry>,
}

impl HandValidator {
    /// Create a new validator from a Unified Card.
    pub fn new(card: &UnifiedCard) -> Self {
        Self {
            lookup_table: card.to_analysis_table(),
        }
    }

    /// Find the closest winning patterns for a given hand.
    /// Returns the top N results sorted by deficiency (lowest first).
    pub fn analyze(&self, hand: &Hand, limit: usize) -> Vec<AnalysisResult> {
        let mut results = Vec::with_capacity(self.lookup_table.len());

        for entry in &self.lookup_table {
            // Skip concealed patterns if hand has exposed melds
            if entry.concealed && !hand.exposed.is_empty() {
                continue;
            }

            let dist = hand.calculate_deficiency(&entry.histogram, &entry.ineligible_histogram);

            // Filter out "impossible" hands (if we defined MAX distance)
            // Currently calculate_deficiency returns total missing count.

            results.push(AnalysisResult {
                pattern_id: entry.pattern_id.clone(),
                variation_id: entry.variation_id.clone(),
                deficiency: dist,
                score: entry.score,
            });
        }

        // Sort: Primary = Deficiency (asc), Secondary = Score (desc)
        results.sort_by(|a, b| {
            match a.deficiency.cmp(&b.deficiency) {
                std::cmp::Ordering::Equal => b.score.cmp(&a.score), // Higher score first if tied
                other => other,
            }
        });

        results.into_iter().take(limit).collect()
    }

    /// Check if a hand is a winning hand (Mahjong).
    /// Returns Some(AnalysisResult) if it wins, None otherwise.
    pub fn validate_win(&self, hand: &Hand) -> Option<AnalysisResult> {
        // Quick check: Must have 14 tiles (for standard win)
        if hand.total_tiles() != 14 {
            return None;
        }

        let best = self.analyze(hand, 1).pop();

        if let Some(res) = best {
            if res.deficiency == 0 {
                return Some(res);
            }
        }
        None
    }

    /// Lookup the histogram for a specific variation id.
    pub fn histogram_for_variation(&self, variation_id: &str) -> Option<&[u8]> {
        self.lookup_table
            .iter()
            .find(|entry| entry.variation_id == variation_id)
            .map(|entry| entry.histogram.as_slice())
    }
}
