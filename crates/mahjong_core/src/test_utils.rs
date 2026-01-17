//! Test utilities and constants shared across test files.
//!
//! # Multi-Year Card Testing
//!
//! This module provides a centralized way to configure which NMJL card year
//! to use across all tests in the workspace. All test files that need card
//! data should use [`load_test_card_json()`] to ensure consistency.
//!
//! ## Changing the Test Card Year
//!
//! To test with a different card year, simply change the [`TEST_CARD_YEAR`]
//! constant and recompile. All tests in the workspace will automatically use
//! the new year.
//!
//! ```ignore
//! // In test_utils.rs, change this line:
//! pub const TEST_CARD_YEAR: u16 = 2020;  // Changed from 2025 to 2020
//!
//! // Then run tests:
//! // cargo test --workspace
//! ```
//!
//! ## Example Usage
//!
//! ```ignore
//! use mahjong_core::test_utils::load_test_card_json;
//! use mahjong_core::rules::card::UnifiedCard;
//!
//! #[test]
//! fn test_pattern_validation() {
//!     let json = load_test_card_json();
//!     let card = UnifiedCard::from_json(json).unwrap();
//!     // Test logic using the configured card year
//! }
//! ```
//!
//! ## Available Years
//!
//! Supported NMJL card years: **2017, 2018, 2019, 2020, 2025**

/// Card year to use for all tests.
///
/// Change this constant to test with different card years. All test files
/// that use [`load_test_card_json()`] will automatically use this year.
///
/// # Examples
///
/// ```ignore
/// // To test with 2020 card instead of 2025:
/// pub const TEST_CARD_YEAR: u16 = 2020;
/// ```
///
/// Available years: 2017, 2018, 2019, 2020, 2025
pub const TEST_CARD_YEAR: u16 = 2025;

/// Load the test card data for the configured [`TEST_CARD_YEAR`].
///
/// Returns the JSON string for the unified card of the test year.
/// This uses compile-time inclusion, so changing [`TEST_CARD_YEAR`]
/// requires recompiling the test suite.
///
/// # Examples
///
/// ```ignore
/// use mahjong_core::test_utils::load_test_card_json;
/// use mahjong_core::rules::card::UnifiedCard;
///
/// // In any test file:
/// #[test]
/// fn test_with_configured_year() {
///     let json = load_test_card_json();
///     let card = UnifiedCard::from_json(json).unwrap();
///     assert_eq!(card.year, mahjong_core::test_utils::TEST_CARD_YEAR);
/// }
/// ```
///
/// # Panics
///
/// Panics if [`TEST_CARD_YEAR`] is set to an unsupported year.
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
