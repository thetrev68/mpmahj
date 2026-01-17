//! Test utilities and constants shared across test files.
//!
//! This module provides common test utilities, including the ability
//! to configure which card year to use for testing.

/// Card year to use for all tests.
///
/// This can be changed to test different card years.
/// Available years: 2017, 2018, 2019, 2020, 2025
pub const TEST_CARD_YEAR: u16 = 2025;

/// Load the test card data for the configured TEST_CARD_YEAR.
///
/// Returns the JSON string for the unified card of the test year.
/// This uses compile-time inclusion, so the year must be known at compile time.
pub fn load_test_card_json() -> &'static str {
    match TEST_CARD_YEAR {
        2025 => include_str!("../../../data/cards/unified_card2025.json"),
        2020 => include_str!("../../../data/cards/unified_card2020.json"),
        2019 => include_str!("../../../data/cards/unified_card2019.json"),
        2018 => include_str!("../../../data/cards/unified_card2018.json"),
        2017 => include_str!("../../../data/cards/unified_card2017.json"),
        _ => panic!(
            "Unsupported TEST_CARD_YEAR: {}. Supported years: 2017, 2018, 2019, 2020, 2025",
            TEST_CARD_YEAR
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_card_year_is_valid() {
        // Ensure TEST_CARD_YEAR is one of the supported years
        assert!(
            matches!(TEST_CARD_YEAR, 2017 | 2018 | 2019 | 2020 | 2025),
            "TEST_CARD_YEAR must be one of: 2017, 2018, 2019, 2020, 2025"
        );
    }

    #[test]
    fn test_load_test_card_json() {
        // Ensure the test card can be loaded
        let json = load_test_card_json();
        assert!(!json.is_empty());
        assert!(json.contains("patterns"));
    }
}
