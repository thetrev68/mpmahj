use serde::{Deserialize, Serialize};

/// The top-level container for the Unified Card format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCard {
    pub meta: CardMeta,
    pub patterns: Vec<Pattern>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardMeta {
    pub year: u16,
    pub version: String,
    pub generated_at: Option<String>,
}

/// A playable hand pattern (e.g., "13579 Line 1").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub id: String,
    pub category: String,
    pub description: String,
    pub score: u16,
    pub concealed: bool,
    pub structure: Vec<PatternComponent>,
    pub variations: Vec<Variation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternComponent {
    #[serde(rename = "type")]
    pub component_type: String,
    pub value: String,
    pub suit_var: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variation {
    pub id: String,
    pub note: Option<String>,
    pub histogram: Vec<u8>,
    #[serde(default)]
    pub ineligible_histogram: Vec<u8>,
}

impl UnifiedCard {
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

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

#[derive(Debug, Clone)]
pub struct AnalysisEntry {
    pub histogram: Vec<u8>,
    pub ineligible_histogram: Vec<u8>,
    pub pattern_id: String,
    pub variation_id: String,
    pub score: u16,
    pub concealed: bool,
}
