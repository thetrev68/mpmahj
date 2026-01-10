# Hint System: Event and Command Integration (15c)

**Status:** READY FOR IMPLEMENTATION
**Prerequisites:** 15a (Core Data Structures), 15b (Hint Generator Logic)
**Estimated Time:** 1-2 hours

## Overview

This document integrates hint functionality into the core command/event system. All changes are minimal and surgical - no TODOs.

## Step 1: Add HintUpdate Event

**File:** `crates/mahjong_core/src/event.rs`

### Location 1: Add Import

**Line ~10** (after other imports):

```rust
use crate::hint::HintData;
```

### Location 2: Add Event Variant

**Line ~265** (after `AnalysisUpdate` event):

```rust
/// Hint data sent to player (private event, only to requesting player).
/// Contains gameplay suggestions based on current hand analysis.
/// Emitted automatically after state changes (piggybacking on analysis).
/// Can also be requested explicitly via RequestHint command.
HintUpdate {
    hint: HintData,
},
```

**Full context:**

```rust
// ===== ANALYSIS =====
/// Hand analysis updated (private event, sent only to the player)
/// Emitted after state changes that affect pattern viability
HandAnalysisUpdated {
    distance_to_win: i32,
    viable_count: usize,
    impossible_count: usize,
},

/// FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event
/// This event contains pattern viability data for the Card Viewer UI.
/// Event structure: { patterns: Vec<PatternAnalysis> }
/// TypeScript bindings: apps/client/src/types/bindings/generated/GameEvent.ts
/// Expected behavior: Client should update pattern viability display in Card Viewer
///
/// Analysis update for a specific player (private event)
/// Contains pattern viability and difficulty information
AnalysisUpdate { patterns: Vec<PatternAnalysis> },

/// Hint data sent to player (private event, only to requesting player).
/// Contains gameplay suggestions based on current hand analysis.
/// Emitted automatically after state changes (piggybacking on analysis).
/// Can also be requested explicitly via RequestHint command.
HintUpdate {
    hint: HintData,
},  // ADD THIS

// ===== ERRORS =====
```

### Location 3: Update is_private() Method

**Line ~274** (in the `is_private()` method):

**Find:**

```rust
pub fn is_private(&self) -> bool {
    matches!(
        self,
        Self::TilesDealt { .. }
            | Self::TilesReceived { .. }
            | Self::TilesPassed { .. }
            | Self::TileDrawn { .. }
            | Self::HandAnalysisUpdated { .. }
            | Self::AnalysisUpdate { .. }
            | Self::CallIntentBuffered { .. }
    )
}
```

**Change to:**

```rust
pub fn is_private(&self) -> bool {
    matches!(
        self,
        Self::TilesDealt { .. }
            | Self::TilesReceived { .. }
            | Self::TilesPassed { .. }
            | Self::TileDrawn { .. }
            | Self::HandAnalysisUpdated { .. }
            | Self::AnalysisUpdate { .. }
            | Self::HintUpdate { .. }  // ADD THIS LINE
            | Self::CallIntentBuffered { .. }
    )
}
```

## Step 2: Add Hint Commands

**File:** `crates/mahjong_core/src/command.rs`

### Location 1: Add Import

**Line ~8** (after other imports):

```rust
use crate::hint::HintSkillLevel;
```

### Location 2: Add RequestHint Command

**Line ~128** (after `GetAnalysis` command):

```rust
/// Request hint data for current game state.
/// Server responds with HintUpdate event containing recommendations.
/// Always allowed during active game (Practice Mode or Multiplayer).
RequestHint {
    player: Seat,
    /// Desired hint verbosity level (Beginner/Intermediate/Expert/Disabled)
    skill_level: HintSkillLevel,
},
```

**Full context:**

```rust
/// Request full hand analysis (all pattern evaluations).
/// Always allowed during active game.
/// Returns complete analysis with all viable patterns, probabilities, and scores.
GetAnalysis { player: Seat },

/// Request hint data for current game state.
/// Server responds with HintUpdate event containing recommendations.
/// Always allowed during active game (Practice Mode or Multiplayer).
RequestHint {
    player: Seat,
    /// Desired hint verbosity level (Beginner/Intermediate/Expert/Disabled)
    skill_level: HintSkillLevel,
},  // ADD THIS
```

### Location 3: Add SetHintLevel Command

**Line ~135** (after `RequestHint`):

```rust
/// Set hint skill level preference for this game.
/// Player can adjust hint verbosity during gameplay.
/// Setting persists for the current game session only.
SetHintLevel {
    player: Seat,
    level: HintSkillLevel,
},
```

**Full context:**

```rust
/// Request hint data for current game state.
/// Server responds with HintUpdate event containing recommendations.
/// Always allowed during active game (Practice Mode or Multiplayer).
RequestHint {
    player: Seat,
    skill_level: HintSkillLevel,
},

/// Set hint skill level preference for this game.
/// Player can adjust hint verbosity during gameplay.
/// Setting persists for the current game session only.
SetHintLevel {
    player: Seat,
    level: HintSkillLevel,
},  // ADD THIS

// End of commands
```

## Step 3: Generate TypeScript Bindings

**File:** `crates/mahjong_core/tests/type_exports.rs`

### Add Test for GameEvent (if not already exporting)

**Add to bottom of file:**

```rust
#[test]
fn export_bindings_game_event() {
    use mahjong_core::event::GameEvent;
    GameEvent::export().expect("Failed to export GameEvent");
}

#[test]
fn export_bindings_game_command() {
    use mahjong_core::command::GameCommand;
    GameCommand::export().expect("Failed to export GameCommand");
}
```

**Note:** These tests might already exist. If so, the existing exports will automatically include the new variants.

## Step 4: Verify Compilation

**Run:**

```bash
cd crates/mahjong_core
cargo build
```

**Expected:** No errors. The new event and commands compile successfully.

## Step 5: Generate TypeScript Bindings

**Run:**

```bash
cd crates/mahjong_core
cargo test export_bindings
```

**Expected Output:**

```
running N tests
test type_exports::export_bindings_hint_skill_level ... ok
test type_exports::export_bindings_hint_data ... ok
test type_exports::export_bindings_best_pattern ... ok
test type_exports::export_bindings_game_event ... ok
test type_exports::export_bindings_game_command ... ok
...
```

**Verify Files:**

```bash
ls apps/client/src/types/bindings/generated/GameEvent.ts
ls apps/client/src/types/bindings/generated/GameCommand.ts
```

**Check GameEvent.ts includes:**

```typescript
export type GameEvent =
  | { TilesDealt: { ... } }
  | { AnalysisUpdate: { patterns: Array<PatternAnalysis> } }
  | { HintUpdate: { hint: HintData } }  // NEW
  | ...
```

**Check GameCommand.ts includes:**

```typescript
export type GameCommand =
  | { GetAnalysis: { player: Seat } }
  | { RequestHint: { player: Seat; skill_level: HintSkillLevel } }  // NEW
  | { SetHintLevel: { player: Seat; level: HintSkillLevel } }  // NEW
  | ...
```

## Complete Code Reference

### event.rs Changes

**Full diff:**

```rust
// At top of file
use crate::hint::HintData;

// In GameEvent enum (around line 265)
    AnalysisUpdate { patterns: Vec<PatternAnalysis> },

+   /// Hint data sent to player (private event, only to requesting player).
+   HintUpdate {
+       hint: HintData,
+   },

    // ===== ERRORS =====

// In is_private() method (around line 280)
    pub fn is_private(&self) -> bool {
        matches!(
            self,
            Self::TilesDealt { .. }
                | Self::TilesReceived { .. }
                | Self::TilesPassed { .. }
                | Self::TileDrawn { .. }
                | Self::HandAnalysisUpdated { .. }
                | Self::AnalysisUpdate { .. }
+               | Self::HintUpdate { .. }
                | Self::CallIntentBuffered { .. }
        )
    }
```

### command.rs Changes

**Full diff:**

```rust
// At top of file
use crate::hint::HintSkillLevel;

// In GameCommand enum (around line 128)
    GetAnalysis { player: Seat },

+   /// Request hint data for current game state.
+   RequestHint {
+       player: Seat,
+       skill_level: HintSkillLevel,
+   },
+
+   /// Set hint skill level preference for this game.
+   SetHintLevel {
+       player: Seat,
+       level: HintSkillLevel,
+   },
```

## Verification Steps

### 1. Compile Check

```bash
cd crates/mahjong_core
cargo build
```

**Expected:** ✅ Compiles successfully

### 2. Event Privacy Test

Create quick test to verify `HintUpdate` is marked private:

**File:** `crates/mahjong_core/tests/event_privacy_test.rs` (if doesn't exist)

```rust
#[test]
fn test_hint_update_is_private() {
    use mahjong_core::event::GameEvent;
    use mahjong_core::hint::HintData;

    let event = GameEvent::HintUpdate {
        hint: HintData::empty(),
    };

    assert!(event.is_private());
}
```

**Run:**

```bash
cargo test event_privacy_test
```

**Expected:** ✅ Test passes

### 3. TypeScript Binding Verification

```bash
cargo test export_bindings
cat apps/client/src/types/bindings/generated/GameEvent.ts | grep HintUpdate
cat apps/client/src/types/bindings/generated/GameCommand.ts | grep RequestHint
```

**Expected:** ✅ Both types appear in generated files

### 4. Full Test Suite

```bash
cd crates/mahjong_core
cargo test
```

**Expected:** ✅ All existing tests still pass (no regressions)

## Success Criteria

- ✅ `HintUpdate` event added to `GameEvent` enum
- ✅ `HintUpdate` marked as private in `is_private()`
- ✅ `RequestHint` command added to `GameCommand` enum
- ✅ `SetHintLevel` command added to `GameCommand` enum
- ✅ All imports added correctly
- ✅ `cargo build` succeeds with no errors
- ✅ `cargo test` passes all tests
- ✅ TypeScript bindings generated correctly
- ✅ GameEvent.ts includes `HintUpdate` variant
- ✅ GameCommand.ts includes both hint commands

## What's Next

Proceed to [15d-server-integration-settings.md](15d-server-integration-settings.md) to integrate hint generation into the server's Always-On Analyst and add player settings.

## Notes

- **Minimal Changes:** Only 3 lines added to event.rs, 2 commands to command.rs
- **Type Safety:** Rust compiler ensures all pattern matches handle new variants
- **Privacy:** `HintUpdate` automatically private (only sent to requesting player)
- **Backwards Compatible:** Existing code unaffected (new variants are additive)
- **No TODOs:** All integration points fully specified
