//! Unified Card schema definitions for American Mahjong patterns.

use serde::{Deserialize, Serialize};

/// The top-level container for the Unified Card format.
///
/// # Examples
/// ```
/// use mahjong_core::rules::card::UnifiedCard;
///
/// let json = r#"{"meta":{"year":2025,"version":"1.0","generated_at":null},"patterns":[]}"#;
/// let card = UnifiedCard::from_json(json).unwrap();
/// assert_eq!(card.meta.year, 2025);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCard {
    /// Card metadata (year, version, and generation info).
    pub meta: CardMeta,
    /// All playable patterns in the card.
    pub patterns: Vec<Pattern>,
}

/// Metadata for a unified card file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardMeta {
    /// Card year (e.g., 2025).
    pub year: u16,
    /// Schema or data version string.
    pub version: String,
    /// Optional generation timestamp.
    pub generated_at: Option<String>,
}

/// A playable hand pattern (e.g., "13579 Line 1").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    /// Pattern identifier.
    pub id: String,
    /// Category or section name.
    pub category: String,
    /// Human-readable description.
    pub description: String,
    /// Base score for the pattern.
    pub score: u16,
    /// Whether the pattern must be fully concealed.
    pub concealed: bool,
    /// Structured component definitions used for UI or analysis.
    pub structure: Vec<PatternComponent>,
    /// Pattern variations with tile histograms.
    pub variations: Vec<Variation>,
}

/// A structured component used to describe a pattern section.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternComponent {
    /// Component type identifier from the card schema.
    #[serde(rename = "type")]
    pub component_type: String,
    /// Component value for display or parsing.
    pub value: String,
    /// Suit variance hint from the card schema.
    pub suit_var: String,
}

/// A concrete tile variation for a pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variation {
    /// Variation identifier.
    pub id: String,
    /// Optional variation note from the card.
    pub note: Option<String>,

    /// The complete tile requirement histogram for this pattern variation.
    /// Each index corresponds to a tile type (see tile index map), and the value
    /// is the count of that tile needed for a winning hand.
    /// Example: `[2, 0, 3, 0, 4, ...]` means: 2× tile_0, 3× tile_2, 4× tile_4, etc.
    pub histogram: Vec<u8>,

    /// The "joker-ineligible" tile requirement histogram.
    /// This specifies which tile positions CANNOT be filled by jokers.
    ///
    /// ## Joker Rules:
    /// - **Singles (count=1)**: Cannot use jokers → ineligible = histogram
    /// - **Pairs (count=2)**: Cannot use jokers → ineligible = histogram
    /// - **Flowers**: Cannot use jokers → ineligible = histogram
    /// - **Pungs/Kongs/Quints (count≥3)**: CAN use jokers → ineligible = 0 (usually)
    ///
    /// ## How It Works:
    /// During validation, the engine:
    /// 1. Calculates `missing_naturals` = tiles needed to satisfy `ineligible_histogram`
    /// 2. Calculates `missing_flexible` = remaining tiles (can be filled by jokers)
    /// 3. Total deficiency = `missing_naturals + max(0, missing_flexible - jokers_available)`
    ///
    /// ## Example:
    /// Pattern "11 333 5555" requires:
    /// - `histogram`: [2, 0, 3, 0, 4, ...] (2× 1B, 3× 3B, 4× 5B)
    /// - `ineligible_histogram`: [2, 0, 0, 0, 0, ...] (pair of 1B must be natural)
    ///
    /// Hand [1B, J, 3B, 3B, 3B, 5B, 5B, 5B, 5B]:
    /// - Missing 1 natural 1B (joker can't fill pair) → deficiency = 1
    ///
    /// Hand [1B, 1B, J, J, 5B, 5B, 5B, 5B]:
    /// - Pair of 1B satisfied with naturals ✓
    /// - 2 jokers fill 3B pung ✓ → deficiency = 0 (win!)
    // TODO: Audit ineligible_histogram generation against Phase 0.4 joker restriction rules.
    #[serde(default)]
    pub ineligible_histogram: Vec<u8>,
}

impl UnifiedCard {
    /// Parse a unified card from JSON.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::rules::card::UnifiedCard;
    ///
    /// let json = r#"{"meta":{"year":2025,"version":"1.0","generated_at":null},"patterns":[]}"#;
    /// let card = UnifiedCard::from_json(json).unwrap();
    /// assert!(card.patterns.is_empty());
    /// ```
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Flatten all pattern variations into analysis entries.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::rules::card::{Pattern, PatternComponent, UnifiedCard, Variation};
    ///
    /// let card = UnifiedCard {
    ///     meta: mahjong_core::rules::card::CardMeta {
    ///         year: 2025,
    ///         version: "1.0".to_string(),
    ///         generated_at: None,
    ///     },
    ///     patterns: vec![Pattern {
    ///         id: "TEST".to_string(),
    ///         category: "Test".to_string(),
    ///         description: "Test pattern".to_string(),
    ///         score: 25,
    ///         concealed: false,
    ///         structure: vec![PatternComponent {
    ///             component_type: "test".to_string(),
    ///             value: "1".to_string(),
    ///             suit_var: "any".to_string(),
    ///         }],
    ///         variations: vec![Variation {
    ///             id: "TEST-V1".to_string(),
    ///             note: None,
    ///             histogram: vec![0u8; 37],
    ///             ineligible_histogram: vec![],
    ///         }],
    ///     }],
    /// };
    /// let table = card.to_analysis_table();
    /// assert_eq!(table.len(), 1);
    /// ```
    pub fn to_analysis_table(&self) -> Vec<AnalysisEntry> {
        let mut table = Vec::new();
        for pattern in &self.patterns {
            for variation in &pattern.variations {
                table.push(AnalysisEntry {
                    histogram: variation.histogram.clone(),
                    ineligible_histogram: variation.ineligible_histogram.clone(),
                    pattern_id: pattern.id.clone(),
                    variation_id: variation.id.clone(),
                    score: pattern.score,
                    concealed: pattern.concealed,
                });
            }
        }
        table
    }
}

/// A flattened analysis entry used by the hand validator for O(1) pattern matching.
/// This is the engine-ready representation of a pattern variation.
#[derive(Debug, Clone)]
pub struct AnalysisEntry {
    /// Total tile requirements for this pattern (see `Variation::histogram`)
    pub histogram: Vec<u8>,

    /// Joker-ineligible tile requirements (see `Variation::ineligible_histogram`)
    pub ineligible_histogram: Vec<u8>,

    pub pattern_id: String,
    pub variation_id: String,
    pub score: u16,
    pub concealed: bool,
}
