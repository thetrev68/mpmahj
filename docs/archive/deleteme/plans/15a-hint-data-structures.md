# Hint System: Core Data Structures (15a)

**Status:** ✅ **COMPLETE**
**Prerequisites:** None (foundational)
**Estimated Time:** 1 hour

## Overview

This document provides complete implementation for the hint system's core data structures using `HintVerbosity` (not `HintSkillLevel`). The hint system is about **presentation verbosity**, not AI skill level.

**Key Distinction:**

- `Difficulty` (in AI crate) = How smart the bot opponent is
- `HintVerbosity` = How much detail the player wants to see

## Step 1: Create hint.rs Module

**File:** `crates/mahjong_core/src/hint.rs` (NEW FILE)

**Complete Implementation:**

```rust
//! Hint system data structures.
//!
//! Provides intelligent gameplay suggestions based on strategic analysis.
//! All types are serializable and exported to TypeScript for frontend use.
//!
//! # Design Philosophy
//! Hint composition happens server-side. These types are pure data.

use crate::meld::MeldType;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Controls how much text detail is shown to the player.
///
/// This is NOT about AI intelligence - all verbosity levels use the same
/// expert-level AI. Only the text presentation differs.
///
/// **Visual Hint Always Shown:** For Beginner, Intermediate, and Expert,
/// the frontend should visually highlight the recommended tile.
/// Text is supplementary to the visual indicator.
///
/// # Hierarchy
/// - `Beginner`: Visual + full text reasoning
/// - `Intermediate`: Visual + tile name only
/// - `Expert`: Visual only (no text)
/// - `Disabled`: No hints sent
///
/// # Example
/// ```
/// use mahjong_core::hint::HintVerbosity;
///
/// let level = HintVerbosity::Beginner; // Show reasoning
/// let level = HintVerbosity::Expert;   // Show tile only
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum HintVerbosity {
    /// Show explicit tile recommendations + detailed reasoning.
    /// Best for learning players who need to understand why.
    ///
    /// Example output: "Discard 7B - keeps 3 patterns viable"
    Beginner,

    /// Show short labels without deep reasoning.
    /// Best for intermediate players who understand the game.
    ///
    /// Example output: "Discard 7B"
    Intermediate,

    /// Only show visual hint (tile glow), no text explanation.
    /// Best for experienced players who want minimal UI clutter.
    ///
    /// Example output: (tile highlighted, no text)
    Expert,

    /// No hints sent. Analysis may still run for pattern viability display.
    /// Zero bandwidth overhead.
    Disabled,
}

impl Default for HintVerbosity {
    fn default() -> Self {
        Self::Intermediate
    }
}

/// Hint data for a player's current game state.
///
/// Contains actionable recommendations based on strategic analysis.
/// Sent as a private event (only to the player being analyzed).
///
/// **Frontend Integration:**
/// - For `Beginner`: Show text explanation + visual highlight
/// - For `Intermediate`: Show tile name + visual highlight
/// - For `Expert`: Visual highlight only (no text)
/// - For `Disabled`: `is_empty()` returns true, no events sent
///
/// # Example
/// ```ignore
/// let hint = HintData {
///     recommended_discard: Some(BAM_7),
///     discard_reason: Some("Keeps 3 patterns viable".to_string()),
///     best_patterns: vec![/* ... */],
///     tiles_needed_for_win: vec![BAM_3, CRAK_6],
///     distance_to_win: 2,
///     hot_hand: false,
///     call_opportunities: vec![],
///     defensive_hints: vec![],
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HintData {
    /// Recommended tile to discard (None if Disabled).
    /// **Always show visual highlight** for Beginner/Intermediate/Expert.
    /// The tile the AI recommends discarding.
    pub recommended_discard: Option<Tile>,

    /// Reason for the discard recommendation (None if not Beginner).
    /// Intermediate shows tile name; Expert shows nothing.
    /// Explains WHY this tile should be discarded.
    ///
    /// Example: "Keeps 3 patterns viable: Consecutive 13579, Odd Numbers, Pairs"
    pub discard_reason: Option<String>,

    /// Top patterns to focus on, sorted by expected value.
    /// **Beginner only:** Shows pattern details with probabilities.
    /// Empty for Intermediate/Expert/Disabled.
    pub best_patterns: Vec<PatternSummary>,

    /// Specific tiles that would complete the hand for a win.
    /// Only populated when distance_to_win <= 2 (close to winning).
    pub tiles_needed_for_win: Vec<Tile>,

    /// Minimum number of tiles needed to win (across all viable patterns).
    /// 0 = Already won, 1 = One tile away, 14 = Maximum distance.
    pub distance_to_win: u8,

    /// Is the player "hot" (1 tile away from winning)?
    /// Used for visual alerts and notifications.
    pub hot_hand: bool,

    /// Call suggestions (only populated during CallWindow).
    /// Empty outside CallWindow or when verbosity is Disabled.
    pub call_opportunities: Vec<CallOpportunity>,

    /// Defensive hints about safe discards.
    /// Empty for Expert/Disabled.
    pub defensive_hints: Vec<DefensiveHint>,
}

impl HintData {
    /// Create an empty hint (no recommendations available).
    ///
    /// Used when:
    /// - Player has no viable patterns
    /// - Verbosity level is Disabled
    /// - Analysis hasn't run yet
    pub fn empty() -> Self {
        Self {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: Vec::new(),
            tiles_needed_for_win: Vec::new(),
            distance_to_win: 14, // Maximum distance (full hand)
            hot_hand: false,
            call_opportunities: Vec::new(),
            defensive_hints: Vec::new(),
        }
    }

    /// Check if this hint has any actionable information.
    pub fn is_empty(&self) -> bool {
        self.recommended_discard.is_none() && self.best_patterns.is_empty()
    }
}

/// Summary of a pattern the player is pursuing.
///
/// Represents one of the top patterns the player should consider.
/// Used for Beginner verbosity level to show pattern details.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct PatternSummary {
    /// Pattern ID (e.g., "2025-CONSECUTIVE-001")
    pub pattern_id: String,

    /// Variation ID (e.g., "2025-GRP1-H1-VAR1")
    pub variation_id: String,

    /// Human-readable pattern name (e.g., "Consecutive 2468")
    /// Use UnifiedCard description, fallback to pattern_id if not available.
    pub pattern_name: String,

    /// Probability of completing this pattern (0.0-1.0).
    /// Based on available tiles and current hand.
    pub probability: f64,

    /// Score if this pattern wins.
    pub score: u16,

    /// Number of tiles away from completing this pattern.
    /// Same as deficiency from StrategicEvaluation.
    pub distance: u8,
}

/// A call opportunity suggestion during CallWindow.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CallOpportunity {
    /// The tile being considered for a call.
    pub tile: Tile,

    /// The meld type being offered (Pung/Kong/Quint).
    pub meld_type: MeldType,

    /// Should the player call? (AI recommendation)
    pub recommended: bool,

    /// Short explanation for the recommendation.
    pub reason: String,
}

impl CallOpportunity {
    pub fn new(tile: Tile, meld_type: MeldType, recommended: bool, reason: String) -> Self {
        Self {
            tile,
            meld_type,
            recommended,
            reason,
        }
    }
}

/// Defensive hint for a candidate discard.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct DefensiveHint {
    /// Tile being evaluated for safety.
    pub tile: Tile,

    /// Safety classification.
    pub safety: DefensiveSafety,

    /// Short explanation for the classification.
    pub reason: String,
}

impl DefensiveHint {
    pub fn safe(tile: Tile, reason: String) -> Self {
        Self {
            tile,
            safety: DefensiveSafety::Safe,
            reason,
        }
    }

    pub fn risky(tile: Tile, reason: String) -> Self {
        Self {
            tile,
            safety: DefensiveSafety::Risky,
            reason,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum DefensiveSafety {
    Safe,
    Caution,
    Risky,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::tiles::*;

    #[test]
    fn test_hint_verbosity_default() {
        assert_eq!(HintVerbosity::default(), HintVerbosity::Intermediate);
    }

    #[test]
    fn test_hint_data_empty() {
        let hint = HintData::empty();
        assert!(hint.is_empty());
        assert_eq!(hint.distance_to_win, 14);
        assert!(!hint.hot_hand);
        assert!(hint.recommended_discard.is_none());
        assert!(hint.best_patterns.is_empty());
    }

    #[test]
    fn test_hint_data_not_empty_with_patterns() {
        let pattern = PatternSummary {
            pattern_id: "TEST-001".to_string(),
            variation_id: "TEST-001-VAR1".to_string(),
            pattern_name: "Test Pattern".to_string(),
            probability: 0.8,
            score: 50,
            distance: 2,
        };

        let hint = HintData {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: vec![pattern],
            tiles_needed_for_win: vec![],
            distance_to_win: 2,
            hot_hand: false,
            call_opportunities: vec![],
            defensive_hints: vec![],
        };

        assert!(!hint.is_empty());
    }

    #[test]
    fn test_hint_data_not_empty_with_discard() {
        let hint = HintData {
            recommended_discard: Some(BAM_7),
            discard_reason: Some("Test reason".to_string()),
            best_patterns: vec![],
            tiles_needed_for_win: vec![],
            distance_to_win: 5,
            hot_hand: false,
            call_opportunities: vec![],
            defensive_hints: vec![],
        };

        assert!(!hint.is_empty());
    }

    #[test]
    fn test_hot_hand_detection() {
        let hint = HintData {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: vec![],
            tiles_needed_for_win: vec![BAM_3, CRAK_6],
            distance_to_win: 1,
            hot_hand: true,
            call_opportunities: vec![],
            defensive_hints: vec![],
        };

        assert_eq!(hint.distance_to_win, 1);
        assert!(hint.hot_hand);
        assert_eq!(hint.tiles_needed_for_win.len(), 2);
    }
}
```

## Step 2: Add Module to lib.rs

**File:** `crates/mahjong_core/src/lib.rs`

**Location:** Add after other module declarations (around line 10-15):

```rust
pub mod hint;
```text

**Full context:**

```rust
pub mod call_resolution;
pub mod command;
pub mod deck;
pub mod event;
pub mod flow;
pub mod hand;
pub mod hint;  // ADD THIS LINE
pub mod meld;
// ... rest of modules
```text

## Step 3: Generate TypeScript Bindings

**File:** `crates/mahjong_core/tests/type_exports.rs`

**Add new test for hint types:**

```rust
#[test]
fn export_bindings_hint_verbosity() {
    use mahjong_core::hint::HintVerbosity;
    HintVerbosity::export().expect("Failed to export HintVerbosity");
}

#[test]
fn export_bindings_hint_data() {
    use mahjong_core::hint::HintData;
    HintData::export().expect("Failed to export HintData");
}

#[test]
fn export_bindings_pattern_summary() {
    use mahjong_core::hint::PatternSummary;
    PatternSummary::export().expect("Failed to export PatternSummary");
}

#[test]
fn export_bindings_call_opportunity() {
    use mahjong_core::hint::CallOpportunity;
    CallOpportunity::export().expect("Failed to export CallOpportunity");
}

#[test]
fn export_bindings_defensive_hint() {
    use mahjong_core::hint::DefensiveHint;
    DefensiveHint::export().expect("Failed to export DefensiveHint");
}

#[test]
fn export_bindings_defensive_safety() {
    use mahjong_core::hint::DefensiveSafety;
    DefensiveSafety::export().expect("Failed to export DefensiveSafety");
}
```text

## Verification Steps

### 1. Build the Module

```bash
cd crates/mahjong_core
cargo build
```text

**Expected:** No compilation errors.

### 2. Run Unit Tests

```bash
cargo test hint
```text

**Expected Output:**

```text
running 5 tests
test hint::tests::test_hint_verbosity_default ... ok
test hint::tests::test_hint_data_empty ... ok
test hint::tests::test_hint_data_not_empty_with_patterns ... ok
test hint::tests::test_hint_data_not_empty_with_discard ... ok
test hint::tests::test_hot_hand_detection ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```text

### 3. Generate TypeScript Bindings

```bash
cargo test export_bindings_hint_verbosity
cargo test export_bindings_hint_data
cargo test export_bindings_pattern_summary
cargo test export_bindings_call_opportunity
cargo test export_bindings_defensive_hint
cargo test export_bindings_defensive_safety
```text

**Expected:** TypeScript files created at:

- `apps/client/src/types/bindings/generated/HintVerbosity.ts`
- `apps/client/src/types/bindings/generated/HintData.ts`
- `apps/client/src/types/bindings/generated/PatternSummary.ts`
- `apps/client/src/types/bindings/generated/CallOpportunity.ts`
- `apps/client/src/types/bindings/generated/DefensiveHint.ts`
- `apps/client/src/types/bindings/generated/DefensiveSafety.ts`

### 4. Verify TypeScript Output

Check the generated files exist and contain proper types:

```bash
ls apps/client/src/types/bindings/generated/Hint*.ts
cat apps/client/src/types/bindings/generated/HintData.ts
```text

**Expected content (HintData.ts):**

```typescript
// This file was generated by [ts-rs]. Do not edit this file manually.
import type { PatternSummary } from './PatternSummary';
import type { Tile } from './Tile';
import type { CallOpportunity } from './CallOpportunity';
import type { DefensiveHint } from './DefensiveHint';

export interface HintData {
  recommended_discard: Tile | null;
  discard_reason: string | null;
  best_patterns: Array<PatternSummary>;
  tiles_needed_for_win: Array<Tile>;
  distance_to_win: number;
  hot_hand: boolean;
  call_opportunities: Array<CallOpportunity>;
  defensive_hints: Array<DefensiveHint>;
}
```text

## Success Criteria

- ✅ `crates/mahjong_core/src/hint.rs` created with all types
- ✅ `pub mod hint;` added to `lib.rs`
- ✅ All 5 unit tests pass
- ✅ 6 TypeScript binding files generated successfully
- ✅ `cargo build` completes without errors
- ✅ TypeScript types match Rust structure
- ✅ `HintVerbosity::default()` returns `Intermediate`

## What's Next

Proceed to [15b-hint-service.md](15b-hint-service.md) to implement `HintAdvisor` in `mahjong_ai`.

## Notes

- All types are fully serializable (Serde + ts-rs)
- Default implementation for `HintVerbosity` (Intermediate)
- `HintData::empty()` provides safe defaults
- No dependencies on other crates (pure core types)
- Documentation comments explain all fields
- Unit tests cover all major code paths
- **Design:** This is presentation only - actual AI logic lives in the AI crate
