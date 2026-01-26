//! Hand validation and pattern analysis utilities.

use crate::hand::Hand;
use crate::rules::card::{AnalysisEntry, UnifiedCard};
use serde::Serialize;

/// The result of analyzing a hand against a specific pattern variation.
///
/// # Examples
/// ```
/// use mahjong_core::rules::validator::AnalysisResult;
///
/// let result = AnalysisResult {
///     pattern_id: "TEST".to_string(),
///     variation_id: "TEST-V1".to_string(),
///     deficiency: 3,
///     score: 25,
///     pattern_name: "Test Pattern".to_string(),
///     description: "11 333 5555 777 99".to_string(),
///     category: "Test Section".to_string(),
/// };
/// assert_eq!(result.deficiency, 3);
/// ```
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

    /// Human-readable pattern name (e.g., "13579 Line 1").
    pub pattern_name: String,

    /// Human-readable pattern description (e.g., "11 333 5555 777 99").
    pub description: String,

    /// Pattern category or section name (e.g., "Singles and Pairs").
    pub category: String,
}

#[derive(Debug, Clone)]
pub struct HandValidator {
    /// The flattened lookup table of all possible hands.
    lookup_table: Vec<AnalysisEntry>,
}

impl HandValidator {
    /// Create a new validator from a Unified Card.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::rules::card::UnifiedCard;
    /// use mahjong_core::rules::validator::HandValidator;
    ///
    /// let json = r#"{"meta":{"year":2025,"version":"1.0","generated_at":null},"patterns":[]}"#;
    /// let card = UnifiedCard::from_json(json).unwrap();
    /// let validator = HandValidator::new(&card);
    /// let _ = validator;
    /// ```
    pub fn new(card: &UnifiedCard) -> Self {
        Self {
            lookup_table: card.to_analysis_table(),
        }
    }

    /// Find the closest winning patterns for a given hand.
    /// Returns the top N results sorted by deficiency (lowest first).
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::hand::Hand;
    /// use mahjong_core::rules::validator::HandValidator;
    ///
    /// # let validator = HandValidator::new(&mahjong_core::rules::card::UnifiedCard {
    /// #     meta: mahjong_core::rules::card::CardMeta {
    /// #         year: 2025,
    /// #         version: "1.0".to_string(),
    /// #         generated_at: None,
    /// #     },
    /// #     patterns: vec![],
    /// # });
    /// let hand = Hand::empty();
    /// let _ = validator.analyze(&hand, 5);
    /// ```
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
                pattern_name: entry.pattern_id.clone(),
                description: entry.description.clone(),
                category: entry.category.clone(),
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
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::hand::Hand;
    /// use mahjong_core::rules::validator::HandValidator;
    ///
    /// # let validator = HandValidator::new(&mahjong_core::rules::card::UnifiedCard {
    /// #     meta: mahjong_core::rules::card::CardMeta {
    /// #         year: 2025,
    /// #         version: "1.0".to_string(),
    /// #         generated_at: None,
    /// #     },
    /// #     patterns: vec![],
    /// # });
    /// let hand = Hand::empty();
    /// let _ = validator.validate_win(&hand);
    /// ```
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
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::rules::validator::HandValidator;
    /// use mahjong_core::rules::card::UnifiedCard;
    ///
    /// let json = r#"{"meta":{"year":2025,"version":"1.0","generated_at":null},"patterns":[]}"#;
    /// let card = UnifiedCard::from_json(json).unwrap();
    /// let validator = HandValidator::new(&card);
    /// assert!(validator.histogram_for_variation("missing").is_none());
    /// ```
    pub fn histogram_for_variation(&self, variation_id: &str) -> Option<&[u8]> {
        self.lookup_table
            .iter()
            .find(|entry| entry.variation_id == variation_id)
            .map(|entry| entry.histogram.as_slice())
    }
}
