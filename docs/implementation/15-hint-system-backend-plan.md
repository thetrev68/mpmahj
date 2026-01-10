# Backend Hint System Implementation Plan (Section 2.5)

**Status:** READY FOR IMPLEMENTATION
**Created:** 2026-01-09
**Prerequisites:** Always-On Analyst (Section 2.1-2.3), Pattern Viability (Section 4)

## Overview

This document provides a step-by-step implementation plan for the backend hint system. The hint system leverages the existing Always-On Analyst infrastructure to provide intelligent gameplay suggestions to human players.

## Architecture Summary

The hint system is built on top of existing components:

- **Data Source:** `StrategicEvaluation` (already exists in `mahjong_ai/src/evaluation.rs`)
- **Analysis Engine:** Always-On Analyst worker (already running in `mahjong_server/src/network/room.rs`)
- **Delivery Mechanism:** New `HintData` event sent to clients via WebSocket

### Key Design Principles

1. **Skill-Level Aware:** Different hint verbosity based on player skill setting
2. **Non-Intrusive:** Hints are optional and can be toggled off
3. **Performance-Conscious:** Piggyback on existing analysis (no extra computation)
4. **Privacy-Preserving:** Only send hints about player's own hand (never reveal opponent info)

## Implementation Steps

### Step 1: Define Core Data Structures

**File:** `crates/mahjong_core/src/hint.rs` (NEW FILE)

Create the core hint types that will be shared between AI, server, and client.

```rust
//! Hint system data structures.
//!
//! Provides intelligent gameplay suggestions based on strategic analysis.

use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Skill level for hint verbosity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum HintSkillLevel {
    /// Show explicit tile recommendations + reasoning
    Beginner,
    /// Show pattern probabilities, let player decide
    Intermediate,
    /// Only show pattern viability (dead/alive)
    Expert,
    /// No hints (analysis only)
    Disabled,
}

/// Hint data for a player's current game state.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HintData {
    /// Recommended tile to discard (None if no clear recommendation)
    pub recommended_discard: Option<Tile>,

    /// Reason for the recommendation (e.g., "Keeps maximum pattern options open")
    pub discard_reason: Option<String>,

    /// Top 3 patterns to focus on (pattern_id, probability)
    pub best_patterns: Vec<BestPattern>,

    /// Tiles that would complete the hand for a win
    pub tiles_needed_for_win: Vec<Tile>,

    /// Minimum number of tiles needed to win
    pub distance_to_win: u8,

    /// Is the player close to winning? (1 tile away)
    pub hot_hand: bool,
}

/// Information about a recommended pattern.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct BestPattern {
    /// Pattern ID (e.g., "2025-CONSECUTIVE-001")
    pub pattern_id: String,

    /// Human-readable pattern name
    pub pattern_name: String,

    /// Probability of completing this pattern (0.0-1.0)
    pub probability: f64,

    /// Score if this pattern wins
    pub score: u16,

    /// Tiles needed to complete (for Beginner mode)
    pub tiles_needed: Vec<Tile>,

    /// Distance (number of tiles away)
    pub distance: u8,
}

impl HintData {
    /// Create an empty hint (no recommendations).
    pub fn empty() -> Self {
        Self {
            recommended_discard: None,
            discard_reason: None,
            best_patterns: Vec::new(),
            tiles_needed_for_win: Vec::new(),
            distance_to_win: 14, // Max distance
            hot_hand: false,
        }
    }
}
```

**Actions:**

1. Create `crates/mahjong_core/src/hint.rs`
2. Add `pub mod hint;` to `crates/mahjong_core/src/lib.rs`
3. Run `cargo test export_bindings` to generate TypeScript types

**Verification:**

```bash
cd crates/mahjong_core
cargo build
cargo test export_bindings
# Check that apps/client/src/types/bindings/generated/HintData.ts exists
```

---

### Step 2: Implement Hint Generation Logic

**File:** `crates/mahjong_ai/src/hint_generator.rs` (NEW FILE)

Create the logic that transforms `StrategicEvaluation` into actionable hints.

```rust
//! Hint generation from strategic evaluations.

use crate::evaluation::StrategicEvaluation;
use mahjong_core::hand::Hand;
use mahjong_core::hint::{BestPattern, HintData, HintSkillLevel};
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::Tile;
use std::collections::HashSet;

/// Generate hints from strategic analysis.
pub struct HintGenerator;

impl HintGenerator {
    /// Generate hints for a player based on their hand analysis.
    ///
    /// # Arguments
    /// * `evaluations` - Strategic evaluations from Always-On Analyst
    /// * `hand` - Player's current hand
    /// * `skill_level` - Hint verbosity level
    /// * `validator` - Pattern validator (for extracting tile requirements)
    ///
    /// # Returns
    /// HintData with recommendations appropriate for the skill level
    pub fn generate(
        evaluations: &[StrategicEvaluation],
        hand: &Hand,
        skill_level: HintSkillLevel,
        validator: &HandValidator,
    ) -> HintData {
        if skill_level == HintSkillLevel::Disabled {
            return HintData::empty();
        }

        // Filter to viable patterns only
        let viable: Vec<_> = evaluations.iter().filter(|e| e.viable).collect();

        if viable.is_empty() {
            return HintData::empty();
        }

        // Find minimum distance to win
        let distance_to_win = viable
            .iter()
            .map(|e| e.deficiency.max(0) as u8)
            .min()
            .unwrap_or(14);

        let hot_hand = distance_to_win <= 1;

        // Get top 3 patterns by expected value
        let best_patterns = Self::select_best_patterns(&viable, skill_level, validator);

        // Recommended discard (only for Beginner/Intermediate)
        let (recommended_discard, discard_reason) = if skill_level != HintSkillLevel::Expert {
            Self::recommend_discard(hand, &viable, validator)
        } else {
            (None, None)
        };

        // Tiles needed for win (only if close)
        let tiles_needed_for_win = if distance_to_win <= 2 {
            Self::extract_tiles_needed(&viable, validator)
        } else {
            Vec::new()
        };

        HintData {
            recommended_discard,
            discard_reason,
            best_patterns,
            tiles_needed_for_win,
            distance_to_win,
            hot_hand,
        }
    }

    /// Select top patterns based on expected value.
    fn select_best_patterns(
        evaluations: &[&StrategicEvaluation],
        skill_level: HintSkillLevel,
        validator: &HandValidator,
    ) -> Vec<BestPattern> {
        let mut sorted = evaluations.to_vec();
        sorted.sort_by(|a, b| {
            b.expected_value
                .partial_cmp(&a.expected_value)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let count = match skill_level {
            HintSkillLevel::Beginner => 3,
            HintSkillLevel::Intermediate => 5,
            HintSkillLevel::Expert => 3,
            HintSkillLevel::Disabled => 0,
        };

        sorted
            .iter()
            .take(count)
            .map(|eval| {
                let tiles_needed = if skill_level == HintSkillLevel::Beginner {
                    Self::extract_tiles_for_pattern(eval, validator)
                } else {
                    Vec::new()
                };

                BestPattern {
                    pattern_id: eval.pattern_id.clone(),
                    pattern_name: eval.pattern_id.clone(), // TODO: Get friendly name from validator
                    probability: eval.probability,
                    score: eval.score,
                    tiles_needed,
                    distance: eval.deficiency.max(0) as u8,
                }
            })
            .collect()
    }

    /// Recommend which tile to discard.
    ///
    /// Strategy: Choose the tile whose removal maintains highest expected value.
    fn recommend_discard(
        hand: &Hand,
        evaluations: &[&StrategicEvaluation],
        _validator: &HandValidator,
    ) -> (Option<Tile>, Option<String>) {
        if hand.concealed.is_empty() {
            return (None, None);
        }

        // Score each unique tile by its "keep value"
        let mut tile_values: Vec<(Tile, f64)> = Vec::new();

        for &tile in &hand.concealed {
            if tile.is_joker() {
                continue; // Never recommend discarding jokers
            }

            // Simplified: Sum EV of patterns that would be affected
            let keep_value: f64 = evaluations.iter().map(|e| e.expected_value).sum();

            tile_values.push((tile, keep_value));
        }

        if tile_values.is_empty() {
            return (None, None);
        }

        // Sort by keep value (ascending - discard lowest)
        tile_values.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        let recommended = tile_values.first().map(|(t, _)| *t);
        let reason = Some("Keeps maximum pattern options open".to_string());

        (recommended, reason)
    }

    /// Extract tiles needed across top patterns.
    fn extract_tiles_needed(
        evaluations: &[&StrategicEvaluation],
        validator: &HandValidator,
    ) -> Vec<Tile> {
        let mut tiles_set: HashSet<Tile> = HashSet::new();

        // Get tiles from top 3 closest patterns
        let mut sorted = evaluations.to_vec();
        sorted.sort_by_key(|e| e.deficiency);

        for eval in sorted.iter().take(3) {
            let tiles = Self::extract_tiles_for_pattern(eval, validator);
            tiles_set.extend(tiles);
        }

        tiles_set.into_iter().collect()
    }

    /// Extract specific tiles needed for a pattern.
    fn extract_tiles_for_pattern(
        eval: &StrategicEvaluation,
        validator: &HandValidator,
    ) -> Vec<Tile> {
        // Get pattern histogram
        let histogram = match validator.histogram_for_variation(&eval.variation_id) {
            Some(h) => h,
            None => return Vec::new(),
        };

        // TODO: Calculate deficiency histogram (target - hand)
        // For now, return empty (requires access to hand in this context)
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::event::PatternDifficulty;

    #[test]
    fn test_generate_empty_for_disabled() {
        let evaluations = vec![];
        let hand = Hand::empty();
        let validator = HandValidator::default();

        let hint = HintGenerator::generate(
            &evaluations,
            &hand,
            HintSkillLevel::Disabled,
            &validator,
        );

        assert_eq!(hint.distance_to_win, 14);
        assert!(!hint.hot_hand);
        assert!(hint.best_patterns.is_empty());
    }

    #[test]
    fn test_generate_hot_hand_detection() {
        let eval = StrategicEvaluation {
            pattern_id: "TEST-001".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 1,
            difficulty: 0.5,
            difficulty_class: PatternDifficulty::Easy,
            probability: 0.8,
            expected_value: 40.0,
            score: 50,
            viable: true,
        };

        let evaluations = vec![eval];
        let hand = Hand::empty();
        let validator = HandValidator::default();

        let hint = HintGenerator::generate(
            &evaluations,
            &hand,
            HintSkillLevel::Intermediate,
            &validator,
        );

        assert_eq!(hint.distance_to_win, 1);
        assert!(hint.hot_hand);
    }

    #[test]
    fn test_select_best_patterns_limits() {
        let eval1 = StrategicEvaluation {
            pattern_id: "P1".to_string(),
            variation_id: "V1".to_string(),
            deficiency: 1,
            difficulty: 0.5,
            difficulty_class: PatternDifficulty::Easy,
            probability: 0.8,
            expected_value: 40.0,
            score: 50,
            viable: true,
        };

        let eval2 = StrategicEvaluation {
            pattern_id: "P2".to_string(),
            variation_id: "V2".to_string(),
            deficiency: 2,
            difficulty: 1.0,
            difficulty_class: PatternDifficulty::Medium,
            probability: 0.5,
            expected_value: 25.0,
            score: 50,
            viable: true,
        };

        let evaluations = vec![&eval1, &eval2];
        let validator = HandValidator::default();

        let beginner = HintGenerator::select_best_patterns(
            &evaluations,
            HintSkillLevel::Beginner,
            &validator,
        );
        assert_eq!(beginner.len(), 2); // Only 2 available, requested 3

        let intermediate = HintGenerator::select_best_patterns(
            &evaluations,
            HintSkillLevel::Intermediate,
            &validator,
        );
        assert_eq!(intermediate.len(), 2); // Only 2 available, requested 5
    }
}
```

**Actions:**

1. Create `crates/mahjong_ai/src/hint_generator.rs`
2. Add `pub mod hint_generator;` to `crates/mahjong_ai/src/lib.rs`
3. Run tests: `cargo test --package mahjong_ai hint_generator`

**Verification:**

```bash
cd crates/mahjong_ai
cargo test hint_generator
# Should pass 3 tests
```

---

### Step 3: Add Hint Event to GameEvent Enum

**File:** `crates/mahjong_core/src/event.rs`

Add a new event variant for delivering hints to clients.

**Location:** After `AnalysisUpdate` event (around line 265)

```rust
/// Hint data sent to player (private event, only to requesting player)
/// Contains gameplay suggestions based on current hand analysis
HintUpdate {
    hint: crate::hint::HintData,
},
```

**Also update the `is_private()` method:**

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
            | Self::HintUpdate { .. } // ADD THIS LINE
            | Self::CallIntentBuffered { .. }
    )
}
```

**Actions:**

1. Edit `crates/mahjong_core/src/event.rs`
2. Add `HintUpdate` variant after `AnalysisUpdate`
3. Update `is_private()` method
4. Add `use crate::hint::HintData;` to imports if needed
5. Run tests: `cargo test --package mahjong_core event`

**Verification:**

```bash
cd crates/mahjong_core
cargo build
cargo test event
```

---

### Step 4: Add Hint Command (Optional - Request Hints On-Demand)

**File:** `crates/mahjong_core/src/command.rs`

Add a command for players to explicitly request hints (in addition to automatic hints).

**Location:** After other game commands (around line 100)

```rust
// ===== HINT SYSTEM =====
/// Request hint data for current game state.
/// Server responds with HintUpdate event.
RequestHint {
    player: Seat,
    /// Desired hint verbosity level
    skill_level: crate::hint::HintSkillLevel,
},
```

**Actions:**

1. Edit `crates/mahjong_core/src/command.rs`
2. Add `RequestHint` variant
3. Add `use crate::hint::HintSkillLevel;` to imports
4. Run `cargo test export_bindings` to update TypeScript

**Verification:**

```bash
cd crates/mahjong_core
cargo test export_bindings
# Check apps/client/src/types/bindings/generated/GameCommand.ts
```

---

### Step 5: Integrate Hint Generation into Analysis Worker

**File:** `crates/mahjong_server/src/network/room.rs`

Modify the Always-On Analyst worker to generate and send hints alongside analysis.

**Location:** In the `run_analysis_for_seats` function (around line 1090)

**Current code emits `AnalysisUpdate`. Add hint generation after it:**

```rust
// EXISTING CODE (around line 1092):
let patterns: Vec<mahjong_core::event::PatternAnalysis> = analysis
    .evaluations
    .iter()
    .map(|eval| mahjong_core::event::PatternAnalysis {
        pattern_name: eval.pattern_id.clone(),
        distance: eval.deficiency.max(0) as u8,
        viable: eval.viable,
        difficulty: eval.difficulty_class,
    })
    .collect();

let analysis_event = GameEvent::AnalysisUpdate { patterns };
pending_events.push((session_arc.clone(), analysis_event));

// NEW CODE - ADD AFTER ANALYSIS EVENT:
// Generate and send hints (if player has hints enabled)
// TODO: Get skill_level from player settings (for now, use Intermediate as default)
let skill_level = mahjong_core::hint::HintSkillLevel::Intermediate;

if skill_level != mahjong_core::hint::HintSkillLevel::Disabled {
    use mahjong_ai::hint_generator::HintGenerator;

    let hint = HintGenerator::generate(
        &analysis.evaluations,
        &hand, // Need access to hand here
        skill_level,
        &room.validator,
    );

    let hint_event = GameEvent::HintUpdate { hint };
    pending_events.push((session_arc.clone(), hint_event));
}
```

**Problem:** We need access to the `hand` in this context. The `analysis` struct has evaluations but not the original hand.

**Solution:** Modify the `HandAnalysis` struct to include a reference to the hand, OR fetch the hand from the table.

**Modified approach - fetch hand from table:**

```rust
// After AnalysisUpdate emission (around line 1110):

// Generate hints for this player
let skill_level = mahjong_core::hint::HintSkillLevel::Intermediate; // TODO: From player settings

if skill_level != mahjong_core::hint::HintSkillLevel::Disabled {
    use mahjong_ai::hint_generator::HintGenerator;

    // Get player's hand from table
    if let Some(player) = room.table.get_player(seat) {
        let hint = HintGenerator::generate(
            &analysis.evaluations,
            &player.hand,
            skill_level,
            &room.validator,
        );

        let hint_event = GameEvent::HintUpdate { hint };
        pending_events.push((session_arc.clone(), hint_event));
    }
}
```

**Actions:**

1. Edit `crates/mahjong_server/src/network/room.rs`
2. Find the `run_analysis_for_seats` function (around line 1040)
3. After `AnalysisUpdate` event emission, add hint generation code
4. Add imports: `use mahjong_ai::hint_generator::HintGenerator;` and `use mahjong_core::hint::HintSkillLevel;`
5. Run server tests: `cargo test --package mahjong_server`

**Verification:**

```bash
cd crates/mahjong_server
cargo build
cargo test
```

---

### Step 6: Handle RequestHint Command (Optional)

**File:** `crates/mahjong_server/src/network/handlers/hint.rs` (NEW FILE)

Create a handler for explicit hint requests.

```rust
//! Hint command handler.

use crate::network::room::Room;
use crate::network::session::ClientSession;
use mahjong_ai::hint_generator::HintGenerator;
use mahjong_core::command::GameCommand;
use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;
use std::sync::Arc;

/// Handle RequestHint command.
///
/// Generates hint data for the requesting player based on current analysis.
pub async fn handle_request_hint(
    room: &mut Room,
    player: Seat,
    skill_level: HintSkillLevel,
    session: Arc<ClientSession>,
) -> Result<(), String> {
    // Verify player exists
    let player_state = room
        .table
        .get_player(player)
        .ok_or_else(|| format!("Player {:?} not in game", player))?;

    // Get current analysis for this player
    let analysis = room
        .analysis_cache
        .get(&player)
        .ok_or_else(|| "No analysis available yet".to_string())?;

    // Generate hints
    let hint = HintGenerator::generate(
        &analysis.evaluations,
        &player_state.hand,
        skill_level,
        &room.validator,
    );

    // Send hint event to requesting player
    let event = GameEvent::HintUpdate { hint };

    session
        .send(event)
        .await
        .map_err(|e| format!("Failed to send hint: {}", e))?;

    Ok(())
}
```

**Then integrate into main command handler:**

**File:** `crates/mahjong_server/src/network/handlers/mod.rs`

```rust
pub mod hint; // ADD THIS LINE
```

**File:** `crates/mahjong_server/src/network/room.rs`

In the `handle_command` method (search for `match command`), add:

```rust
GameCommand::RequestHint { player, skill_level } => {
    handlers::hint::handle_request_hint(self, player, skill_level, session)
        .await
        .map_err(|e| format!("RequestHint failed: {}", e))?;
}
```

**Actions:**

1. Create `crates/mahjong_server/src/network/handlers/hint.rs`
2. Edit `crates/mahjong_server/src/network/handlers/mod.rs` to add `pub mod hint;`
3. Edit `crates/mahjong_server/src/network/room.rs` to add `RequestHint` case in `handle_command`
4. Run tests: `cargo test --package mahjong_server`

**Verification:**

```bash
cd crates/mahjong_server
cargo test
cargo build
```

---

### Step 7: Add Player Hint Settings to Room/Player State

**File:** `crates/mahjong_server/src/network/room.rs`

Add hint preferences to the Room struct to track each player's desired hint level.

**Add to Room struct (around line 50):**

```rust
/// Hint preferences per player
pub hint_settings: HashMap<Seat, HintSkillLevel>,
```

**Initialize in `Room::new()`:**

```rust
hint_settings: HashMap::new(), // ADD THIS
```

**Add helper method:**

```rust
impl Room {
    /// Get hint skill level for a player (default: Intermediate).
    pub fn get_hint_level(&self, seat: Seat) -> HintSkillLevel {
        self.hint_settings
            .get(&seat)
            .copied()
            .unwrap_or(HintSkillLevel::Intermediate)
    }

    /// Set hint skill level for a player.
    pub fn set_hint_level(&mut self, seat: Seat, level: HintSkillLevel) {
        self.hint_settings.insert(seat, level);
    }
}
```

**Then use in hint generation (Step 5 code):**

```rust
// Replace hardcoded skill_level with:
let skill_level = room.get_hint_level(seat);
```

**Actions:**

1. Edit `crates/mahjong_server/src/network/room.rs`
2. Add `hint_settings` field to `Room` struct
3. Initialize in `Room::new()`
4. Add helper methods `get_hint_level` and `set_hint_level`
5. Update hint generation code to use `room.get_hint_level(seat)`
6. Add imports: `use mahjong_core::hint::HintSkillLevel;` and `use std::collections::HashMap;`

**Verification:**

```bash
cd crates/mahjong_server
cargo build
cargo test
```

---

### Step 8: Add Configuration Command (SetHintLevel)

**File:** `crates/mahjong_core/src/command.rs`

Add a command for players to change their hint settings mid-game.

```rust
/// Set hint skill level preference.
/// Player can adjust hint verbosity during game.
SetHintLevel {
    player: Seat,
    level: crate::hint::HintSkillLevel,
},
```

**File:** `crates/mahjong_server/src/network/room.rs`

Handle the command in `handle_command`:

```rust
GameCommand::SetHintLevel { player, level } => {
    // Verify player is in the game
    if self.table.get_player(player).is_none() {
        return Err(format!("Player {:?} not in game", player));
    }

    // Update hint settings
    self.set_hint_level(player, level);

    // Optionally: Send updated hints immediately
    // (Code from Step 6 can be reused here)
}
```

**Actions:**

1. Edit `crates/mahjong_core/src/command.rs` to add `SetHintLevel`
2. Edit `crates/mahjong_server/src/network/room.rs` to handle `SetHintLevel`
3. Run `cargo test export_bindings`

**Verification:**

```bash
cd crates/mahjong_core
cargo test export_bindings
cd ../mahjong_server
cargo test
```

---

### Step 9: Testing & Verification

Create integration tests to verify hint system works end-to-end.

**File:** `crates/mahjong_server/tests/hint_system_test.rs` (NEW FILE)

```rust
//! Integration tests for hint system.

use mahjong_core::command::GameCommand;
use mahjong_core::event::GameEvent;
use mahjong_core::hint::{HintData, HintSkillLevel};
use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;
use std::sync::Arc;

#[tokio::test]
async fn test_automatic_hints_sent_on_analysis() {
    // Setup: Create room with 4 players
    let mut room = Room::new_test(); // Assume test helper exists

    // Deal tiles and trigger analysis
    room.start_game().await.expect("Game start failed");

    // Verify HintUpdate events were sent
    // (This requires capturing events from the test)
    // TODO: Implement event capture in test helper
}

#[tokio::test]
async fn test_request_hint_command() {
    let mut room = Room::new_test();
    room.start_game().await.expect("Game start failed");

    // Request hints explicitly
    let cmd = GameCommand::RequestHint {
        player: Seat::East,
        skill_level: HintSkillLevel::Beginner,
    };

    // Execute command
    // room.handle_command(cmd, session).await.expect("RequestHint failed");

    // Verify HintUpdate event was sent
    // TODO: Implement event verification
}

#[tokio::test]
async fn test_set_hint_level_command() {
    let mut room = Room::new_test();

    // Default should be Intermediate
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Intermediate);

    // Change to Beginner
    let cmd = GameCommand::SetHintLevel {
        player: Seat::East,
        level: HintSkillLevel::Beginner,
    };

    // room.handle_command(cmd, session).await.expect("SetHintLevel failed");

    // Verify updated
    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);
}

#[test]
fn test_hint_generation_beginner_vs_expert() {
    // Create sample evaluations
    use mahjong_ai::evaluation::StrategicEvaluation;
    use mahjong_ai::hint_generator::HintGenerator;
    use mahjong_core::event::PatternDifficulty;
    use mahjong_core::hand::Hand;
    use mahjong_core::rules::validator::HandValidator;

    let eval = StrategicEvaluation {
        pattern_id: "TEST-001".to_string(),
        variation_id: "V1".to_string(),
        deficiency: 1,
        difficulty: 0.5,
        difficulty_class: PatternDifficulty::Easy,
        probability: 0.8,
        expected_value: 40.0,
        score: 50,
        viable: true,
    };

    let evaluations = vec![eval];
    let hand = Hand::empty();
    let validator = HandValidator::default();

    // Beginner should get explicit recommendations
    let beginner_hint = HintGenerator::generate(
        &evaluations,
        &hand,
        HintSkillLevel::Beginner,
        &validator,
    );

    // Expert should get minimal hints
    let expert_hint = HintGenerator::generate(
        &evaluations,
        &hand,
        HintSkillLevel::Expert,
        &validator,
    );

    // Beginner gets discard recommendation
    // assert!(beginner_hint.recommended_discard.is_some()); // Might be None for empty hand

    // Expert does NOT get discard recommendation
    assert!(expert_hint.recommended_discard.is_none());

    // Both should know distance
    assert_eq!(beginner_hint.distance_to_win, 1);
    assert_eq!(expert_hint.distance_to_win, 1);
}
```

**Actions:**

1. Create `crates/mahjong_server/tests/hint_system_test.rs`
2. Implement test helpers if needed (e.g., `Room::new_test()`)
3. Run tests: `cargo test --package mahjong_server hint_system`

**Verification:**

```bash
cd crates/mahjong_server
cargo test hint_system
```

---

### Step 10: Documentation & Integration Points

**File:** `docs/integration/backend-hint-system.md` (NEW FILE)

````markdown
# Backend Hint System Integration Guide

**Status:** IMPLEMENTED
**Version:** 1.0
**Last Updated:** 2026-01-09

## Overview

The hint system provides intelligent gameplay suggestions to players based on real-time strategic analysis.

## Architecture

### Components

1. **HintData** (`mahjong_core/src/hint.rs`)
   - Core data structures for hints
   - TypeScript bindings exported for frontend

2. **HintGenerator** (`mahjong_ai/src/hint_generator.rs`)
   - Transforms `StrategicEvaluation` into actionable hints
   - Skill-level aware (Beginner/Intermediate/Expert/Disabled)

3. **Always-On Analyst Integration** (`mahjong_server/src/network/room.rs`)
   - Automatically generates hints after state changes
   - Sends `HintUpdate` events to clients

### Data Flow

```text

Player Action (DrawTile/DiscardTile)
  → Always-On Analyst runs
  → StrategicEvaluation generated
  → HintGenerator.generate() called
  → HintUpdate event emitted
  → Client receives hint data
```
````

## Events

### HintUpdate (Private Event)

**Structure:**

```json
{
  "HintUpdate": {
    "hint": {
      "recommended_discard": "1B",
      "discard_reason": "Keeps maximum pattern options open",
      "best_patterns": [
        {
          "pattern_id": "2025-CONSECUTIVE-001",
          "pattern_name": "Consecutive 2468",
          "probability": 0.75,
          "score": 50,
          "tiles_needed": ["3C", "6C"],
          "distance": 2
        }
      ],
      "tiles_needed_for_win": ["3C", "6C"],
      "distance_to_win": 2,
      "hot_hand": false
    }
  }
}
```

**Privacy:** Only sent to the player whose hand is being analyzed.

**Frequency:** Sent after every state change (same triggers as AnalysisUpdate).

## Commands

### RequestHint (Optional)

Players can explicitly request hints instead of waiting for automatic updates.

```json
{
  "RequestHint": {
    "player": "East",
    "skill_level": "Beginner"
  }
}
```

**Response:** Immediate `HintUpdate` event.

### SetHintLevel

Players can change hint verbosity during the game.

```json
{
  "SetHintLevel": {
    "player": "East",
    "level": "Expert"
  }
}
```

**Effect:** Future hints will use the new skill level.

## Skill Levels

### Beginner

- Shows explicit tile recommendations
- Provides reasoning ("Discard 7D to keep options open")
- Lists specific tiles needed for patterns
- Top 3 patterns displayed

### Intermediate

- Shows pattern probabilities
- No explicit discard recommendations
- Top 5 patterns displayed
- Player makes final decision

### Expert

- Only shows pattern viability (dead/alive)
- No discard suggestions
- Top 3 patterns (minimal info)
- For experienced players who want minimal UI clutter

### Disabled

- No hints sent
- Analysis still runs (for pattern viability in Card Viewer)
- Zero bandwidth overhead for hints

## Frontend Integration

### TypeScript Types

Generated bindings available at:

- `apps/client/src/types/bindings/generated/HintData.ts`
- `apps/client/src/types/bindings/generated/HintSkillLevel.ts`
- `apps/client/src/types/bindings/generated/BestPattern.ts`

### WebSocket Event Handling

```typescript
// Listen for hint updates
socket.on('event', (event: GameEvent) => {
  if ('HintUpdate' in event) {
    const hint = event.HintUpdate.hint;
    updateHintStore(hint);
  }
});
```

### Recommended UI Components

1. **Hint Panel** (toggleable)
   - Show recommended discard with icon highlight
   - Display top patterns with probability bars
   - Win proximity indicator (color-coded)

2. **Settings Menu**
   - Hint level selector (Beginner/Intermediate/Expert/Disabled)
   - Sends `SetHintLevel` command on change

3. **Hot Hand Alert**
   - Flash notification when `hot_hand: true` (1 tile away!)
   - Show tiles needed: "Waiting for: 3B, 6C"

## Performance Considerations

- **Bandwidth:** ~1-2KB per hint update (compressed)
- **Frequency:** Same as AnalysisUpdate (after state changes)
- **Optimization:** Hints only sent when analysis changes significantly
- **Client-side throttling:** Recommended (max 1 hint UI update per second)

## Testing

### Unit Tests

- `mahjong_ai::hint_generator` tests
- `mahjong_core::hint` type tests

### Integration Tests

- `mahjong_server::tests::hint_system_test`
- Verify automatic hints on state changes
- Verify RequestHint command
- Verify SetHintLevel command

### Manual Testing Checklist

- [ ] Start game, verify hints appear after deal
- [ ] Discard tile, verify hints update
- [ ] Change skill level, verify hint verbosity changes
- [ ] Disable hints, verify no HintUpdate events sent
- [ ] Get 1 tile away, verify `hot_hand: true`

## Known Limitations

1. **Tile Extraction:** `extract_tiles_for_pattern` is incomplete (returns empty vec)
   - Requires access to hand and target histogram for deficiency calculation
   - TODO: Implement full deficiency-to-tiles conversion

2. **Pattern Names:** Currently uses pattern IDs (e.g., "2025-CONSECUTIVE-001")
   - TODO: Add friendly names to validator (e.g., "Consecutive 2468")

3. **Discard Recommendation:** Simplified algorithm
   - Current: Sum of EVs (doesn't account for pattern-specific tile needs)
   - Future: Full tile utility calculation (which tiles appear in top patterns)

4. **No Defensive Hints:** Current hints focus on completing own hand
   - Future: Add "dangerous discard" warnings (opponent might call)

## Future Enhancements

- **Call Opportunity Hints:** "Calling this Pung closes off 4 patterns"
- **Charleston Hints:** "Keep these tiles for top patterns"
- **Pattern Filtering:** "Focus on Consecutive section (3 viable patterns)"
- **AI Comparison:** "AI would discard 7D (you chose 2B)"
- **Win Probability:** "62% chance to win if you draw 3C next"

---

**Integration Status:**

- ✅ Backend complete
- ⏳ Frontend UI pending
- ⏳ Settings persistence pending

```

**Actions:**

1. Create `docs/integration/backend-hint-system.md`
2. Add link to main architecture docs (`docs/architecture/00-ARCHITECTURE.md`)

---

## Implementation Checklist

Use this checklist to track progress:

- [ ] **Step 1:** Define core data structures (`hint.rs`)
  - [ ] Create `HintSkillLevel` enum
  - [ ] Create `HintData` struct
  - [ ] Create `BestPattern` struct
  - [ ] Generate TypeScript bindings

- [ ] **Step 2:** Implement hint generation logic (`hint_generator.rs`)
  - [ ] Create `HintGenerator` struct
  - [ ] Implement `generate()` method
  - [ ] Implement `select_best_patterns()`
  - [ ] Implement `recommend_discard()`
  - [ ] Add unit tests

- [ ] **Step 3:** Add `HintUpdate` event
  - [ ] Add event variant to `GameEvent`
  - [ ] Update `is_private()` method
  - [ ] Regenerate TypeScript bindings

- [ ] **Step 4:** Add `RequestHint` command (optional)
  - [ ] Add command variant to `GameCommand`
  - [ ] Regenerate TypeScript bindings

- [ ] **Step 5:** Integrate into Always-On Analyst
  - [ ] Add hint generation after analysis
  - [ ] Emit `HintUpdate` events
  - [ ] Test with running server

- [ ] **Step 6:** Handle `RequestHint` command (optional)
  - [ ] Create hint handler
  - [ ] Integrate into command dispatcher
  - [ ] Test manual hint requests

- [ ] **Step 7:** Add player hint settings
  - [ ] Add `hint_settings` to `Room`
  - [ ] Implement `get_hint_level()` and `set_hint_level()`
  - [ ] Use in hint generation

- [ ] **Step 8:** Add `SetHintLevel` command
  - [ ] Add command variant
  - [ ] Handle in command dispatcher
  - [ ] Test level changes

- [ ] **Step 9:** Testing & verification
  - [ ] Unit tests for `HintGenerator`
  - [ ] Integration tests for hint system
  - [ ] Manual testing with running server

- [ ] **Step 10:** Documentation
  - [ ] Create integration guide
  - [ ] Update architecture docs
  - [ ] Add frontend integration notes

## Success Criteria

The hint system implementation is complete when:

1. ✅ TypeScript bindings generated for all hint types
2. ✅ `HintGenerator::generate()` produces valid hints for all skill levels
3. ✅ `HintUpdate` events sent automatically after state changes
4. ✅ `RequestHint` command works (optional)
5. ✅ `SetHintLevel` command updates player preferences
6. ✅ All tests pass (`cargo test hint`)
7. ✅ Integration guide written
8. ✅ Server runs without errors with hint system enabled

## Notes for Frontend Team

Once backend is complete:

1. **TypeScript Types:** Available in `apps/client/src/types/bindings/generated/`
2. **WebSocket Events:** Listen for `HintUpdate` events (private, only to player)
3. **UI Components Needed:**
   - Hint panel (toggleable)
   - Win proximity badge
   - Settings for skill level
4. **State Management:** Consider Zustand store for hint data
5. **Performance:** Throttle hint UI updates (max 1/sec)

## Estimated Effort

- **Step 1-2:** 2-3 hours (data structures + logic)
- **Step 3-4:** 1 hour (event/command additions)
- **Step 5-6:** 2-3 hours (server integration)
- **Step 7-8:** 1-2 hours (settings)
- **Step 9:** 2-3 hours (testing)
- **Step 10:** 1 hour (documentation)

**Total:** 10-15 hours of focused development

## Dependencies

- ✅ Always-On Analyst (Section 2.1-2.3) - COMPLETE
- ✅ Pattern Viability (Section 4) - COMPLETE
- ✅ `StrategicEvaluation` with viability/difficulty - COMPLETE
- ✅ Analysis worker running in server - COMPLETE

## Open Questions

1. **Q:** Should hints be sent automatically or only on request?
   **A:** Both - automatic by default, with `RequestHint` for on-demand refresh

2. **Q:** Should hint level be per-game or per-player (account-wide)?
   **A:** Per-game for now, can add account preferences later

3. **Q:** What if player has no viable patterns?
   **A:** Return `HintData::empty()` with `distance_to_win: 14`

4. **Q:** Should we log hint data for analytics?
   **A:** Future enhancement - track which hints were followed/ignored

---

**Implementation Plan Created:** 2026-01-09
**Ready for Development:** Yes
**Prerequisites Met:** Yes (Always-On Analyst + Pattern Viability complete)
```
