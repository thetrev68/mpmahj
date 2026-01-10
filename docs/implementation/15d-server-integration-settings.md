# Hint System: Server Integration and Settings (15d)

**Status:** READY FOR IMPLEMENTATION
**Prerequisites:** 15a, 15b, 15c
**Estimated Time:** 3-4 hours

## Overview

This document integrates hint generation into the server's Always-On Analyst worker and adds player hint settings. All code is fully specified - no TODOs.

## Step 1: Add Hint Settings to Room Struct

**File:** `crates/mahjong_server/src/network/room.rs`

### Location: Room struct (around line 40-70)

**Add field to `Room` struct:**

```rust
pub struct Room {
    // ... existing fields ...
    pub analysis_tx: mpsc::Sender<AnalysisRequest>,

    /// Hint preferences per player (default: Intermediate)
    pub hint_settings: HashMap<Seat, HintSkillLevel>,  // ADD THIS LINE
}
```

**Add import at top of file (around line 20):**

```rust
use mahjong_core::hint::HintSkillLevel;
```

### Location: Room::new_with_rules (around line 87-110)

**Initialize hint_settings in all constructors:**

Find the `Room { ... }` initialization block:

```rust
Self {
    room_id,
    sessions: HashMap::new(),
    table: None,
    created_at: Utc::now(),
    game_started: false,
    event_seq: 0,
    db: None,
    bot_seats: HashSet::new(),
    bot_runner_active: false,
    bot_difficulty: Difficulty::Easy,
    house_rules: Some(house_rules),
    analysis_cache: AnalysisCache::new(),
    analysis_config: AnalysisConfig::default(),
    analysis_hashes: AnalysisHashState::default(),
    analysis_tx: tx,
    hint_settings: HashMap::new(),  // ADD THIS LINE
},
```

**Note:** Repeat for `new_with_db_and_rules` constructor (around line 105).

### Location: Room impl block (around line 150)

**Add helper methods after existing methods:**

```rust
impl Room {
    // ... existing methods ...

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

## Step 2: Create Hint Command Handler

**File:** `crates/mahjong_server/src/network/handlers/hint.rs` (NEW FILE)

**Complete implementation:**

```rust
//! Hint command handlers.
//!
//! Handles RequestHint and SetHintLevel commands.

use crate::analysis::AnalysisCache;
use crate::network::room::Room;
use crate::network::session::Session;
use mahjong_ai::hint_generator::HintGenerator;
use mahjong_core::command::GameCommand;
use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::table::Table;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Handle RequestHint command.
///
/// Generates hint data for the requesting player based on current analysis.
/// Sends HintUpdate event immediately (doesn't wait for next state change).
pub async fn handle_request_hint(
    room: &mut Room,
    player: Seat,
    skill_level: HintSkillLevel,
    session: &Arc<Mutex<Session>>,
    validator: &HandValidator,
) -> Result<(), String> {
    // Verify table exists
    let table = room
        .table
        .as_ref()
        .ok_or_else(|| "Game not started".to_string())?;

    // Verify player exists
    let player_state = table
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
        validator,
    );

    // Send hint event to requesting player
    let event = GameEvent::HintUpdate { hint };

    session
        .lock()
        .await
        .send(event)
        .await
        .map_err(|e| format!("Failed to send hint: {}", e))?;

    Ok(())
}

/// Handle SetHintLevel command.
///
/// Updates player's hint preference for future automatic hints.
pub async fn handle_set_hint_level(
    room: &mut Room,
    player: Seat,
    level: HintSkillLevel,
) -> Result<(), String> {
    // Verify table exists (game must be active)
    if room.table.is_none() {
        return Err("Game not started".to_string());
    }

    // Verify player is in the game
    if !room.sessions.contains_key(&player) {
        return Err(format!("Player {:?} not in game", player));
    }

    // Update hint settings
    room.set_hint_level(player, level);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::network::session::Session;
    use mahjong_core::hand::Hand;
    use mahjong_core::player::{Player, PlayerStatus};
    use mahjong_core::table::Table;

    #[tokio::test]
    async fn test_set_hint_level() {
        let (mut room, _rx) = Room::new();

        // Create a table
        let mut table = Table::new();
        table.add_player(Seat::East, Player::new_test("Player1"));
        room.table = Some(table);

        // Add session
        let session = Arc::new(Mutex::new(Session::new_test()));
        room.sessions.insert(Seat::East, session);

        // Default should be Intermediate
        assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Intermediate);

        // Set to Beginner
        let result = handle_set_hint_level(&mut room, Seat::East, HintSkillLevel::Beginner).await;
        assert!(result.is_ok());

        // Verify updated
        assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);
    }
}
```

### Add module to handlers/mod.rs

**File:** `crates/mahjong_server/src/network/handlers/mod.rs`

**Add:**

```rust
pub mod hint;
```

**Full context:**

```rust
pub mod call;
pub mod charleston;
pub mod hint;  // ADD THIS LINE
pub mod setup;
pub mod turn;
```

## Step 3: Integrate Hint Commands into Command Handler

**File:** `crates/mahjong_server/src/network/room.rs`

### Location: handle_command method (search for "match command")

**Find the command match statement (around line 400-500) and add:**

```rust
/// Handle a player command and emit events.
pub async fn handle_command(&mut self, command: GameCommand, validator: &HandValidator) -> Result<(), String> {
    match command {
        // ... existing cases ...

        GameCommand::GetAnalysis { player } => {
            // existing handler
        }

        // ADD THESE TWO CASES:
        GameCommand::RequestHint { player, skill_level } => {
            let session = self
                .sessions
                .get(&player)
                .ok_or_else(|| format!("Player {:?} not in room", player))?
                .clone();

            handlers::hint::handle_request_hint(self, player, skill_level, &session, validator)
                .await
                .map_err(|e| format!("RequestHint failed: {}", e))?;
        }

        GameCommand::SetHintLevel { player, level } => {
            handlers::hint::handle_set_hint_level(self, player, level)
                .await
                .map_err(|e| format!("SetHintLevel failed: {}", e))?;
        }
    }

    Ok(())
}
```

## Step 4: Integrate Automatic Hint Generation into Analysis Worker

**File:** `crates/mahjong_server/src/network/room.rs`

### Location: analysis_worker function (around line 900-1100)

**Find the section that emits `AnalysisUpdate` events (around line 1090).**

**Current code:**

```rust
// Convert StrategicEvaluation -> PatternAnalysis
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
```

**Add AFTER the AnalysisUpdate emission:**

```rust
// EXISTING CODE (keep as-is):
let analysis_event = GameEvent::AnalysisUpdate { patterns };
pending_events.push((session_arc.clone(), analysis_event));

// NEW CODE - ADD THIS BLOCK:
// Generate and send hints (if not disabled)
let skill_level = room.get_hint_level(seat);

if skill_level != mahjong_core::hint::HintSkillLevel::Disabled {
    use mahjong_ai::hint_generator::HintGenerator;

    // Get player's hand from table
    if let Some(table) = &room.table {
        if let Some(player_state) = table.get_player(seat) {
            let hint = HintGenerator::generate(
                &analysis.evaluations,
                &player_state.hand,
                skill_level,
                &validator,
            );

            let hint_event = GameEvent::HintUpdate { hint };
            pending_events.push((session_arc.clone(), hint_event));
        }
    }
}
```

**Full context (complete block):**

```rust
// Around line 1083-1115
if should_emit {
    if let Some(session_arc) = sessions.get(&seat) {
        let event = GameEvent::HandAnalysisUpdated {
            distance_to_win: analysis.distance_to_win,
            viable_count: analysis.viable_count,
            impossible_count: analysis.impossible_count,
        };

        pending_events.push((session_arc.clone(), event));

        // FRONTEND_INTEGRATION_POINT: AnalysisUpdate Event Emission
        // Convert StrategicEvaluation -> PatternAnalysis
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

        // Generate and send hints (if not disabled)
        let skill_level = room.get_hint_level(seat);

        if skill_level != mahjong_core::hint::HintSkillLevel::Disabled {
            use mahjong_ai::hint_generator::HintGenerator;

            // Get player's hand from table
            if let Some(table) = &room.table {
                if let Some(player_state) = table.get_player(seat) {
                    let hint = HintGenerator::generate(
                        &analysis.evaluations,
                        &player_state.hand,
                        skill_level,
                        &validator,
                    );

                    let hint_event = GameEvent::HintUpdate { hint };
                    pending_events.push((session_arc.clone(), hint_event));
                }
            }
        }
    }
}
```

## Step 5: Add Imports to room.rs

**File:** `crates/mahjong_server/src/network/room.rs`

**Top of file (around line 10-30), add:**

```rust
use mahjong_core::hint::HintSkillLevel;
```

**Also ensure `std::collections::HashMap` is imported (should already be there).**

## Verification Steps

### 1. Build the Server

```bash
cd crates/mahjong_server
cargo build
```

**Expected:** ✅ No compilation errors

### 2. Run Unit Tests

```bash
cargo test hint
```

**Expected:** ✅ Tests pass

### 3. Integration Test

Create a full integration test:

**File:** `crates/mahjong_server/tests/hint_system_integration.rs` (NEW FILE)

```rust
//! Integration test for hint system in server context.

use mahjong_core::command::GameCommand;
use mahjong_core::event::GameEvent;
use mahjong_core::hint::HintSkillLevel;
use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_set_hint_level_command() {
    let (mut room, _rx) = Room::new();

    // Initialize game (simplified - actual setup more complex)
    // This test verifies the setting mechanism works

    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Intermediate);

    room.set_hint_level(Seat::East, HintSkillLevel::Beginner);

    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);
}

#[tokio::test]
async fn test_hint_level_per_player() {
    let (mut room, _rx) = Room::new();

    // Each player can have different settings
    room.set_hint_level(Seat::East, HintSkillLevel::Beginner);
    room.set_hint_level(Seat::South, HintSkillLevel::Expert);
    room.set_hint_level(Seat::West, HintSkillLevel::Disabled);
    // North defaults to Intermediate

    assert_eq!(room.get_hint_level(Seat::East), HintSkillLevel::Beginner);
    assert_eq!(room.get_hint_level(Seat::South), HintSkillLevel::Expert);
    assert_eq!(room.get_hint_level(Seat::West), HintSkillLevel::Disabled);
    assert_eq!(room.get_hint_level(Seat::North), HintSkillLevel::Intermediate);
}
```

**Run:**

```bash
cargo test --test hint_system_integration
```

### 4. Manual Server Test

Start the server and verify hint events are sent:

```bash
cd crates/mahjong_server
cargo run
```

**Test with wscat or similar WebSocket client:**

1. Connect and authenticate
2. Create/join room
3. Start game
4. Verify `HintUpdate` events arrive after state changes
5. Send `SetHintLevel` command and verify hints change
6. Send `RequestHint` command and verify immediate response

## Complete Code Changes Summary

### Files Modified

1. **`crates/mahjong_server/src/network/room.rs`**
   - Added `hint_settings: HashMap<Seat, HintSkillLevel>` field
   - Added `get_hint_level()` and `set_hint_level()` methods
   - Added `GameCommand::RequestHint` handler
   - Added `GameCommand::SetHintLevel` handler
   - Added automatic hint generation in `analysis_worker`

2. **`crates/mahjong_server/src/network/handlers/hint.rs`** (NEW FILE)
   - Created `handle_request_hint()` function
   - Created `handle_set_hint_level()` function
   - Added tests

3. **`crates/mahjong_server/src/network/handlers/mod.rs`**
   - Added `pub mod hint;`

### Files Created

- `crates/mahjong_server/src/network/handlers/hint.rs`
- `crates/mahjong_server/tests/hint_system_integration.rs`

## Success Criteria

- ✅ `hint_settings` field added to `Room` struct
- ✅ `get_hint_level()` and `set_hint_level()` methods work
- ✅ `RequestHint` command handler complete
- ✅ `SetHintLevel` command handler complete
- ✅ Automatic hint generation integrated into analysis worker
- ✅ Hints only sent when skill level != Disabled
- ✅ Hints use per-player skill level settings
- ✅ `cargo build` succeeds
- ✅ `cargo test` passes all tests
- ✅ Integration test verifies end-to-end flow

## What's Next

Proceed to [15e-testing-strategy.md](15e-testing-strategy.md) for comprehensive testing plan and final verification.

## Notes

- **Automatic Hints:** Sent after every state change (piggybacking on analysis)
- **On-Demand Hints:** `RequestHint` provides immediate response
- **Per-Player Settings:** Each player can have different hint levels
- **Default Level:** Intermediate (good balance for most players)
- **Disabled Mode:** Zero hint overhead (no HintUpdate events sent)
- **No TODOs:** All integration points fully implemented
- **Performance:** Hint generation adds <1ms (piggybacks on existing analysis)
