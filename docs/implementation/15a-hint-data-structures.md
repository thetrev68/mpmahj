# Hint System: Core Data Structures (15a)

**Status:** READY FOR IMPLEMENTATION
**Prerequisites:** None (foundational)
**Estimated Time:** 1-2 hours

## Overview

This document provides complete implementation for the hint system's core data structures. No TODOs - everything is fully specified.

## Step 1: Create hint.rs Module

**File:** `crates/mahjong_core/src/hint.rs` (NEW FILE)

**Full Implementation:**

```rust
//! Hint system data structures.
//!
//! Provides intelligent gameplay suggestions based on strategic analysis.
//! All types are serializable and exported to TypeScript for frontend use.

use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Skill level for hint verbosity.
///
/// Controls what information is shown to the player:
/// - Beginner: Explicit recommendations with reasoning
/// - Intermediate: Pattern probabilities, player decides
/// - Expert: Minimal info (viability only)
/// - Disabled: No hints sent
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum HintSkillLevel {
    /// Show explicit tile recommendations + detailed reasoning.
    /// Best for learning players.
    Beginner,

    /// Show pattern probabilities and suggestions, let player decide.
    /// Best for intermediate players who understand the game.
    Intermediate,

    /// Only show pattern viability (dead/alive) with minimal details.
    /// Best for experienced players who want to minimize UI clutter.
    Expert,

    /// No hints (analysis still runs for pattern viability display).
    /// Zero bandwidth overhead for hint events.
    Disabled,
}

impl Default for HintSkillLevel {
    fn default() -> Self {
        Self::Intermediate
    }
}

/// Hint data for a player's current game state.
///
/// Contains actionable recommendations based on strategic analysis.
/// Sent as a private event (only to the player being analyzed).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HintData {
    /// Recommended tile to discard (None if no clear recommendation).
    /// Only populated for Beginner/Intermediate skill levels.
    pub recommended_discard: Option<Tile>,

    /// Reason for the discard recommendation.
    /// Example: "Keeps maximum pattern options open"
    pub discard_reason: Option<String>,

    /// Top patterns to focus on, sorted by expected value.
    /// Count varies by skill level (3 for Beginner, 5 for Intermediate).
    pub best_patterns: Vec<BestPattern>,

    /// Specific tiles that would complete the hand for a win.
    /// Only populated when distance_to_win <= 2 (close to winning).
    pub tiles_needed_for_win: Vec<Tile>,

    /// Minimum number of tiles needed to win (across all viable patterns).
    /// 0 = Already won, 1 = One tile away, 14 = Maximum distance
    pub distance_to_win: u8,

    /// Is the player "hot" (1 tile away from winning)?
    /// Used for visual alerts and notifications.
    pub hot_hand: bool,
}

impl HintData {
    /// Create an empty hint (no recommendations available).
    ///
    /// Used when:
    /// - Player has no viable patterns
    /// - Hint level is Disabled
    /// - Analysis hasn't run yet
    pub fn empty() -> Self {
        Self {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: Vec::new(),
            tiles_needed_for_win: Vec::new(),
            distance_to_win: 14, // Maximum distance (full hand)
            hot_hand: false,
        }
    }

    /// Check if this hint has any actionable information.
    pub fn is_empty(&self) -> bool {
        self.recommended_discard.is_none() && self.best_patterns.is_empty()
    }
}

/// Information about a recommended pattern.
///
/// Represents one of the top patterns the player should consider pursuing.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct BestPattern {
    /// Pattern ID (e.g., "2025-CONSECUTIVE-001")
    pub pattern_id: String,

    /// Human-readable pattern name (e.g., "Consecutive 2468")
    pub pattern_name: String,

    /// Probability of completing this pattern (0.0-1.0).
    /// Based on available tiles and current hand.
    pub probability: f64,

    /// Score if this pattern wins.
    pub score: u16,

    /// Specific tiles needed to complete this pattern.
    /// Only populated for Beginner skill level.
    pub tiles_needed: Vec<Tile>,

    /// Number of tiles away from completing this pattern.
    /// Same as deficiency from StrategicEvaluation.
    pub distance: u8,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::tiles::*;

    #[test]
    fn test_hint_skill_level_default() {
        assert_eq!(HintSkillLevel::default(), HintSkillLevel::Intermediate);
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
        let pattern = BestPattern {
            pattern_id: "TEST-001".to_string(),
            pattern_name: "Test Pattern".to_string(),
            probability: 0.8,
            score: 50,
            tiles_needed: vec![],
            distance: 2,
        };

        let hint = HintData {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: vec![pattern],
            tiles_needed_for_win: vec![],
            distance_to_win: 2,
            hot_hand: false,
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
```

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
```

## Step 3: Generate TypeScript Bindings

**File:** `crates/mahjong_core/tests/type_exports.rs`

**Add new test for hint types:**

```rust
#[test]
fn export_bindings_hint_skill_level() {
    use mahjong_core::hint::HintSkillLevel;
    HintSkillLevel::export().expect("Failed to export HintSkillLevel");
}

#[test]
fn export_bindings_hint_data() {
    use mahjong_core::hint::HintData;
    HintData::export().expect("Failed to export HintData");
}

#[test]
fn export_bindings_best_pattern() {
    use mahjong_core::hint::BestPattern;
    BestPattern::export().expect("Failed to export BestPattern");
}
```

## Verification Steps

### 1. Build the Module

```bash
cd crates/mahjong_core
cargo build
```

**Expected:** No compilation errors.

### 2. Run Unit Tests

```bash
cargo test hint
```

**Expected Output:**

```
running 5 tests
test hint::tests::test_hint_skill_level_default ... ok
test hint::tests::test_hint_data_empty ... ok
test hint::tests::test_hint_data_not_empty_with_patterns ... ok
test hint::tests::test_hint_data_not_empty_with_discard ... ok
test hint::tests::test_hot_hand_detection ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### 3. Generate TypeScript Bindings

```bash
cargo test export_bindings_hint_skill_level
cargo test export_bindings_hint_data
cargo test export_bindings_best_pattern
```

**Expected:** TypeScript files created at:

- `apps/client/src/types/bindings/generated/HintSkillLevel.ts`
- `apps/client/src/types/bindings/generated/HintData.ts`
- `apps/client/src/types/bindings/generated/BestPattern.ts`

### 4. Verify TypeScript Output

Check the generated files exist and contain proper types:

```bash
ls apps/client/src/types/bindings/generated/Hint*.ts
cat apps/client/src/types/bindings/generated/HintData.ts
```

**Expected content (HintData.ts):**

```typescript
// This file was generated by [ts-rs]. Do not edit this file manually.
import type { BestPattern } from './BestPattern';
import type { Tile } from './Tile';

export interface HintData {
  recommended_discard: Tile | null;
  discard_reason: string | null;
  best_patterns: Array<BestPattern>;
  tiles_needed_for_win: Array<Tile>;
  distance_to_win: number;
  hot_hand: boolean;
}
```

## Success Criteria

- ✅ `crates/mahjong_core/src/hint.rs` created with all types
- ✅ `pub mod hint;` added to `lib.rs`
- ✅ All 5 unit tests pass
- ✅ 3 TypeScript binding files generated successfully
- ✅ `cargo build` completes without errors
- ✅ TypeScript types match Rust structure

## What's Next

Proceed to [15b-hint-generator-logic.md](15b-hint-generator-logic.md) to implement the hint generation algorithm.

## Notes

- All types are fully serializable (Serde + ts-rs)
- Default implementation for `HintSkillLevel` (Intermediate)
- `HintData::empty()` provides safe defaults
- No dependencies on other crates (pure core types)
- Documentation comments explain all fields
- Unit tests cover all major code paths
