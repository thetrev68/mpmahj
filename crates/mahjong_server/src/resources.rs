//! Card data loading for validators and pattern metadata.
//!
//! ```no_run
//! use mahjong_server::resources::load_validator;
//! let validator = load_validator(2025);
//! assert!(validator.is_some());
//! ```
use mahjong_core::rules::{card::UnifiedCard, validator::HandValidator};
use std::collections::HashMap;

/// Card resources including validator and pattern lookup.
pub struct CardResources {
    /// Validator configured for the loaded card.
    pub validator: HandValidator,
    /// Mapping of pattern ID to description.
    pub pattern_lookup: HashMap<String, String>,
}

/// Load card resources (validator + pattern lookup) for a specific card year.
/// Returns None if the card file doesn't exist or can't be parsed.
pub fn load_card_resources(card_year: u16) -> Option<CardResources> {
    // Map year to file - unified format for 2025, individual year files for others
    // TODO: Add unified or per-year card data for 2021-2024.
    let filename = match card_year {
        2025 => "unified_card2025.json",
        2020 => "card2020.json",
        2019 => "card2019.json",
        2018 => "card2018.json",
        2017 => "card2017.json",
        _ => {
            tracing::error!("No card data available for year {}", card_year);
            return None;
        }
    };

    // Try workspace-relative path first (production), then parent path (tests in crate directory).
    let paths = [
        std::path::Path::new("data/cards").join(filename),
        std::path::Path::new("../../data/cards").join(filename),
    ];

    for path in &paths {
        if let Ok(json) = std::fs::read_to_string(path) {
            match UnifiedCard::from_json(&json) {
                Ok(card) => {
                    let validator = HandValidator::new(&card);
                    let pattern_lookup = card
                        .patterns
                        .iter()
                        .map(|p| (p.id.clone(), p.description.clone()))
                        .collect();
                    return Some(CardResources {
                        validator,
                        pattern_lookup,
                    });
                }
                Err(e) => {
                    tracing::error!("Failed to parse card {}: {}", path.display(), e);
                    return None;
                }
            }
        }
    }

    tracing::error!(
        "Failed to load card file {} from any of: {:?}",
        filename,
        paths
    );
    None
}

/// Load validator for a specific card year (legacy function).
/// Returns None if the card file doesn't exist or can't be parsed.
pub fn load_validator(card_year: u16) -> Option<HandValidator> {
    load_card_resources(card_year).map(|r| r.validator)
}

#[cfg(test)]
mod tests {
    //! Tests for card resource loading paths.

    use super::*;

    /// Ensures the 2025 card file loads in test environments.
    #[test]
    fn test_validator_loads_for_2025() {
        let validator = load_validator(2025);
        assert!(
            validator.is_some(),
            "Failed to load 2025 card validator. Ensure:
                     1. data/cards/unified_card2025.json exists
                     2. Tests run from workspace root (use: cargo test --manifest-path Cargo.toml)
                     Current dir: {:?}",
            std::env::current_dir()
        );
    }

    /// Ensures missing card years return `None`.
    #[test]
    fn test_validator_returns_none_for_missing_year() {
        // Year with no card data should return None
        let validator = load_validator(2016);
        assert!(
            validator.is_none(),
            "Validator should return None for unavailable year 2016"
        );
    }
}
