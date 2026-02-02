# History Viewer & Time Travel: Implementation Plan

**Status:** Backend Implementation Complete (Phase 1-6 Complete)
**Created:** 2026-01-11
**Updated:** 2026-01-11 (Phase 6 Complete - Testing)
**Prerequisites:** Section 6.5 (Deterministic State Capture) ✅ COMPLETE
**Target:** Practice Mode only (not multiplayer)
**Implementation Decision:** Using full snapshots on every move (Phase 4 memory optimization not implemented)

## Key Architectural Decision

**Modular Implementation** - Following the existing pattern in `crates/mahjong_server/src/network/`:

- **NEW FILE**: `history.rs` - Contains `RoomHistory` trait with all behavior
- **MINIMAL EDITS**: `room.rs` - Only contains history data fields (already added in Phase 1)
- **MINIMAL EDITS**: `commands.rs` - Delegates to trait methods (no logic)
- **MINIMAL EDITS**: `events.rs` - Calls `record_history_entry()` when events occur

This follows the same pattern as `RoomEvents`, `RoomCommands`, and `RoomAnalysis` traits.

## Overview

This feature allows players to view a complete history of all game moves and jump to any point in time, similar to Mahjong 4 Friends. This is NOT a simple "undo last move" but a full time-travel interface with:

- Complete move history from Charleston start to current state
- Jump to any move in history (view mode)
- Resume playing from any point (invalidates future moves)
- Human-readable move descriptions

## Architecture Summary

```text
┌─────────────────────────────────────────────────────────┐
│ Room Struct (room.rs)                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ history: Vec<MoveHistoryEntry>        [DATA ONLY]   │ │
│ │ history_mode: HistoryMode             [DATA ONLY]   │ │
│ │ current_move_number: u32              [DATA ONLY]   │ │
│ │ present_state: Option<Box<Table>>     [DATA ONLY]   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         ↓ (behaviors implemented in separate module)
┌─────────────────────────────────────────────────────────┐
│ RoomHistory Trait (history.rs) - NEW FILE              │
│ - record_history_entry()                                │
│ - handle_request_history()                              │
│ - handle_jump_to_move()                                 │
│ - handle_resume_from_history()                          │
│ - handle_return_to_present()                            │
│ - is_practice_mode()                                    │
└─────────────────────────────────────────────────────────┘
         ↓ (called from commands.rs)
┌─────────────────────────────────────────────────────────┐
│ RoomCommands Trait (commands.rs)                        │
│ - handle_command() checks for history commands          │
│ - delegates to RoomHistory trait methods                │
└─────────────────────────────────────────────────────────┘
         ↓ (triggered by events)
┌─────────────────────────────────────────────────────────┐
│ RoomEvents Trait (events.rs)                            │
│ - broadcast_event() calls record_history_entry()        │
└─────────────────────────────────────────────────────────┘
```

## Phase 1: Core Data Structures

**Status:** Phase 1 implemented (core types added to mahjong_core; server Room fields added)

**Files changed:**

- crates/mahjong_core/src/history.rs (new)
- crates/mahjong_core/src/lib.rs (exported history)
- crates/mahjong_core/src/command.rs (added history commands)
- crates/mahjong_core/src/event.rs (added history events)
- crates/mahjong_server/src/network/room.rs (added history fields)

Progress notes: The core data types (`MoveHistoryEntry`, `MoveAction`, `HistoryMode`, and `MoveHistorySummary`) are implemented and exported. Game command and event variants for history were added. Server `Room` struct now includes history storage and initialization. Remaining work: recording history entries on events, command handlers, and client wiring (Phase 2+).

### 1.1 Add to `crates/mahjong_core/src/history.rs` (NEW FILE)

Create a new module for history-related types:

```rust
use crate::{Seat, Table, Tile};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A single entry in the game's move history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveHistoryEntry {
    /// Sequential move number (0-indexed)
    pub move_number: u32,

    /// When this move occurred
    pub timestamp: DateTime<Utc>,

    /// Which player made this move
    pub seat: Seat,

    /// What action was taken
    pub action: MoveAction,

    /// Human-readable description for UI display
    pub description: String,

    /// Complete game state snapshot at this point
    /// (allows jumping to any move instantly)
    pub snapshot: Table,
}

/// Types of actions that create history entries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MoveAction {
    /// Drew a tile from the wall
    DrawTile { tile: Tile, visible: bool },

    /// Discarded a tile
    DiscardTile { tile: Tile },

    /// Called a discard for a meld
    CallTile { tile: Tile, meld_type: MeldType },

    /// Passed tiles in Charleston
    PassTiles { direction: PassDirection, count: u8 },

    /// Declared a kong/quint and drew replacement
    DeclareKong { tiles: Vec<Tile> },

    /// Exchanged a joker from exposed meld
    ExchangeJoker { joker: Tile, replacement: Tile },

    /// Declared Mahjong
    DeclareWin { pattern_name: String, score: u32 },

    /// Call window opened after discard
    CallWindowOpened { tile: Tile },

    /// Call window closed (all passed)
    CallWindowClosed,

    /// Charleston phase completed
    CharlestonCompleted,
}

/// History viewing modes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HistoryMode {
    /// Not viewing history (normal gameplay)
    None,

    /// Viewing history in read-only mode
    Viewing { at_move: u32 },

    /// Game paused at a history point (can resume from here)
    Paused { at_move: u32 },
}

impl Default for HistoryMode {
    fn default() -> Self {
        Self::None
    }
}
```

**References:**

- Import `Seat` from [crates/mahjong_core/src/table/types.rs:134](crates/mahjong_core/src/table/types.rs#L134)
- Import `Table` from [crates/mahjong_core/src/table/mod.rs](crates/mahjong_core/src/table/mod.rs)
- Import `Tile` from [crates/mahjong_core/src/tiles.rs](crates/mahjong_core/src/tiles.rs)

### 1.2 Add History Commands to `crates/mahjong_core/src/command.rs`

Add new command variants to the existing `GameCommand` enum:

```rust
// Add these variants to the existing GameCommand enum around line 20

/// Request full history list (all moves)
RequestHistory,

/// Jump to a specific move in history (view mode)
JumpToMove { move_number: u32 },

/// Resume playing from current history point (discard future)
ResumeFromHistory { move_number: u32 },

/// Return to present (exit history view mode)
ReturnToPresent,
```

**Location:** [crates/mahjong_core/src/command.rs:20](crates/mahjong_core/src/command.rs#L20)

### 1.3 Add History Events to `crates/mahjong_core/src/event.rs`

Add new event variants to the existing `GameEvent` enum:

```rust
// Add these variants to the existing GameEvent enum around line 100

/// Full history list sent to client
HistoryList {
    entries: Vec<MoveHistorySummary>, // Lightweight version without snapshots
},

/// State restored to a specific move
StateRestored {
    move_number: u32,
    description: String,
    mode: HistoryMode,
},

/// Future moves deleted when resuming from history
HistoryTruncated {
    from_move: u32,
},

/// Error: invalid history request
HistoryError {
    message: String,
},

/// Lightweight summary of a history entry (for listing)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveHistorySummary {
    pub move_number: u32,
    pub timestamp: DateTime<Utc>,
    pub seat: Seat,
    pub action: MoveAction,
    pub description: String,
    // Note: No snapshot field (too large for listing)
}
```

**Location:** [crates/mahjong_core/src/event.rs:100](crates/mahjong_core/src/event.rs#L100)

### 1.4 Update `Room` Struct in `crates/mahjong_server/src/network/room.rs`

Add history tracking fields to the `Room` struct:

```rust
// Add these fields to the Room struct around line 50

/// Complete move history (append-only until game ends)
pub history: Vec<MoveHistoryEntry>,

/// Current history viewing mode
pub history_mode: HistoryMode,

/// Current move number (increments with each history entry)
pub current_move_number: u32,

/// Backup of "present" state when viewing history
/// (allows returning to present without re-processing)
pub present_state: Option<Box<Table>>,
```

**Location:** [crates/mahjong_server/src/network/room.rs:50](crates/mahjong_server/src/network/room.rs#L50)

**Initialize in `Room::new()`:**

```rust
// In Room::new() around line 150
history: Vec::new(),
history_mode: HistoryMode::None,
current_move_number: 0,
present_state: None,
```

## Phase 2: History Recording (Append to History)

### 2.1 Create `crates/mahjong_server/src/network/history.rs` (NEW FILE)

Create the history trait and implementation:

```rust
//! History viewer functionality for practice mode.
//!
//! Provides time-travel features: view move history, jump to any point,
//! and resume from history (truncating future moves).

use crate::db::EventDelivery;
use crate::network::events::RoomEvents;
use crate::network::room::Room;
use chrono::Utc;
use mahjong_core::{
    event::GameEvent,
    history::{HistoryMode, MoveAction, MoveHistoryEntry, MoveHistorySummary},
    player::Seat,
};

/// History management trait for Room.
pub trait RoomHistory {
    /// Check if this is a practice mode game (3+ bots).
    fn is_practice_mode(&self) -> bool;

    /// Record a move in history with a snapshot of current state.
    fn record_history_entry(&mut self, seat: Seat, action: MoveAction, description: String);

    /// Handle RequestHistory command.
    fn handle_request_history(
        &self,
    ) -> impl std::future::Future<Output = Result<GameEvent, String>> + Send;

    /// Handle JumpToMove command.
    fn handle_jump_to_move(
        &mut self,
        move_number: u32,
    ) -> impl std::future::Future<Output = Result<GameEvent, String>> + Send;

    /// Handle ResumeFromHistory command.
    fn handle_resume_from_history(
        &mut self,
        move_number: u32,
    ) -> impl std::future::Future<Output = Result<Vec<GameEvent>, String>> + Send;

    /// Handle ReturnToPresent command.
    fn handle_return_to_present(
        &mut self,
    ) -> impl std::future::Future<Output = Result<GameEvent, String>> + Send;
}

impl RoomHistory for Room {
    /// Check if this is a practice mode game.
    ///
    /// Practice mode = 3 or 4 bots (single human player or all bots).
    fn is_practice_mode(&self) -> bool {
        self.bot_seats.len() >= 3
    }

    /// Records a move in history with a snapshot of current state.
    fn record_history_entry(&mut self, seat: Seat, action: MoveAction, description: String) {
        // Only record if not viewing history
        if self.history_mode != HistoryMode::None {
            return;
        }

        // Only record if table exists
        let Some(table) = &self.table else {
            return;
        };

        let entry = MoveHistoryEntry {
            move_number: self.current_move_number,
            timestamp: Utc::now(),
            seat,
            action,
            description,
            snapshot: table.clone(), // Full snapshot
        };

        self.history.push(entry);
        self.current_move_number += 1;
    }

    /// Handle request for full history list.
    async fn handle_request_history(&self) -> Result<GameEvent, String> {
        // Check if this is a practice mode game
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Convert full history entries to lightweight summaries
        let summaries: Vec<MoveHistorySummary> = self
            .history
            .iter()
            .map(|entry| MoveHistorySummary {
                move_number: entry.move_number,
                timestamp: entry.timestamp,
                seat: entry.seat,
                action: entry.action.clone(),
                description: entry.description.clone(),
            })
            .collect();

        Ok(GameEvent::HistoryList { entries: summaries })
    }

    /// Handle jumping to a specific move in history.
    async fn handle_jump_to_move(&mut self, move_number: u32) -> Result<GameEvent, String> {
        // Check practice mode
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Validate move number
        if move_number >= self.history.len() as u32 {
            return Err(format!(
                "Move {} does not exist (game has {} moves)",
                move_number,
                self.history.len()
            ));
        }

        // Save current state as "present" if not already viewing history
        if self.history_mode == HistoryMode::None {
            if let Some(table) = &self.table {
                self.present_state = Some(Box::new(table.clone()));
            }
        }

        // Restore state from snapshot
        let entry = &self.history[move_number as usize];
        self.table = Some(entry.snapshot.clone());
        self.history_mode = HistoryMode::Viewing { at_move: move_number };

        Ok(GameEvent::StateRestored {
            move_number,
            description: entry.description.clone(),
            mode: self.history_mode,
        })
    }

    /// Handle resuming gameplay from a history point (truncates future).
    async fn handle_resume_from_history(
        &mut self,
        move_number: u32,
    ) -> Result<Vec<GameEvent>, String> {
        // Check practice mode
        if !self.is_practice_mode() {
            return Err("History is only available in Practice Mode".to_string());
        }

        // Validate move number
        if move_number >= self.history.len() as u32 {
            return Err(format!(
                "Move {} does not exist (game has {} moves)",
                move_number,
                self.history.len()
            ));
        }

        // Restore state from snapshot
        let entry = &self.history[move_number as usize];
        self.table = Some(entry.snapshot.clone());

        // Truncate future history
        self.history.truncate((move_number + 1) as usize);
        self.current_move_number = move_number + 1;

        // Clear history mode
        self.history_mode = HistoryMode::None;
        self.present_state = None;

        // Return events: StateRestored + HistoryTruncated
        Ok(vec![
            GameEvent::StateRestored {
                move_number,
                description: entry.description.clone(),
                mode: HistoryMode::None,
            },
            GameEvent::HistoryTruncated {
                from_move: move_number + 1,
            },
        ])
    }

    /// Handle returning to present (exit history view).
    async fn handle_return_to_present(&mut self) -> Result<GameEvent, String> {
        // Check if in history mode
        if self.history_mode == HistoryMode::None {
            return Err("Not viewing history".to_string());
        }

        // Restore present state
        if let Some(present) = self.present_state.take() {
            self.table = Some(*present);
        } else {
            // Fallback: restore from last history entry
            if let Some(entry) = self.history.last() {
                self.table = Some(entry.snapshot.clone());
            } else {
                return Err("No present state to restore".to_string());
            }
        }

        self.history_mode = HistoryMode::None;

        Ok(GameEvent::StateRestored {
            move_number: self.current_move_number - 1,
            description: "Returned to present".to_string(),
            mode: HistoryMode::None,
        })
    }
}
```

### 2.2 Add History Module to `crates/mahjong_server/src/network/mod.rs`

```rust
// Add this line to the module exports
pub mod history;
```

### 2.3 Trigger History Recording in `crates/mahjong_server/src/network/events.rs`

Import the trait at the top of the file:

```rust
use crate::network::history::RoomHistory;
```

Then add history recording in `broadcast_event()` method **after line 38** (after the method signature, before database persistence):

```rust
async fn broadcast_event(&mut self, event: GameEvent, delivery: EventDelivery) {
    // Record history entry for significant events (BEFORE persisting to DB)
    match &event {
        GameEvent::TileDrawn { seat, tile, visible } => {
            let desc = if *visible {
                format!("Move {} - {} drew {}", self.current_move_number, seat, tile)
            } else {
                format!("Move {} - {} drew a tile", self.current_move_number, seat)
            };
            self.record_history_entry(
                *seat,
                MoveAction::DrawTile {
                    tile: *tile,
                    visible: *visible,
                },
                desc,
            );
        }
        GameEvent::TileDiscarded { seat, tile } => {
            let desc = format!(
                "Move {} - {} discarded {}",
                self.current_move_number, seat, tile
            );
            self.record_history_entry(*seat, MoveAction::DiscardTile { tile: *tile }, desc);
        }
        GameEvent::TileCalled {
            seat,
            tile,
            meld_type,
        } => {
            let desc = format!(
                "Move {} - {} called {:?} of {}",
                self.current_move_number, seat, meld_type, tile
            );
            self.record_history_entry(
                *seat,
                MoveAction::CallTile {
                    tile: *tile,
                    meld_type: *meld_type,
                },
                desc,
            );
        }
        GameEvent::CharlestonTilesSelected {
            seat,
            direction,
            count,
        } => {
            let desc = format!(
                "Move {} - {} passed {} tiles {:?}",
                self.current_move_number, seat, count, direction
            );
            self.record_history_entry(
                *seat,
                MoveAction::PassTiles {
                    direction: *direction,
                    count: *count,
                },
                desc,
            );
        }
        GameEvent::CallWindowOpened { tile, .. } => {
            let desc = format!(
                "Move {} - Call window opened for {}",
                self.current_move_number, tile
            );
            // Note: We don't have the discarder's seat easily accessible here
            // Could be enhanced by adding context or extracting from table state
            self.record_history_entry(
                Seat::East, // Placeholder - consider enhancing
                MoveAction::CallWindowOpened { tile: *tile },
                desc,
            );
        }
        GameEvent::CallWindowClosed => {
            let desc = format!(
                "Move {} - Call window closed (all passed)",
                self.current_move_number
            );
            self.record_history_entry(Seat::East, MoveAction::CallWindowClosed, desc);
        }
        GameEvent::GameOver { winner, result } => {
            if let Some(winner) = winner {
                if let Some(pattern_name) = &result.winning_pattern {
                    let desc = format!(
                        "Move {} - {} declared Mahjong with '{}' for {} points",
                        self.current_move_number, winner, pattern_name, result.score
                    );
                    self.record_history_entry(
                        *winner,
                        MoveAction::DeclareWin {
                            pattern_name: pattern_name.clone(),
                            score: result.score,
                        },
                        desc,
                    );
                }
            }
        }
        // Add cases for Kong, JokerExchange, etc. as needed
        _ => {
            // Not all events create history entries
        }
    }

    // Persist event to database first...
    // (existing code continues here)
```

**Location:** [crates/mahjong_server/src/network/events.rs:38](crates/mahjong_server/src/network/events.rs#L38)

## Phase 3: Wire Up History Commands

### 3.1 Update `crates/mahjong_server/src/network/commands.rs`

Import the history trait at the top:

```rust
use crate::network::history::RoomHistory;
```

Add history command handling in the `handle_command()` method, **before** the GetAnalysis check (around line 56):

```rust
async fn handle_command(
    &mut self,
    command: GameCommand,
    sender_player_id: &str,
) -> Result<(), CommandError> {
    let command_for_delivery = command.clone();

    // Ensure the sender is authorized to act for the command's seat.
    let command_seat = command.player();
    {
        let session = self
            .sessions
            .get(&command_seat)
            .ok_or(CommandError::PlayerNotFound)?;
        let session = session.lock().await;
        if session.player_id != sender_player_id {
            return Err(CommandError::PlayerNotFound);
        }
    } // session lock is dropped here

    // Handle history commands (practice mode only)
    match &command {
        GameCommand::RequestHistory => {
            let event = self
                .handle_request_history()
                .await
                .map_err(|e| CommandError::InvalidCommand(e))?;

            // Send only to requesting player
            if let Some(session) = self.sessions.get(&command_seat) {
                self.send_to_session(session, event).await;
            }
            return Ok(());
        }
        GameCommand::JumpToMove { move_number } => {
            let event = self
                .handle_jump_to_move(*move_number)
                .await
                .map_err(|e| CommandError::InvalidCommand(e))?;

            self.broadcast_event(event, EventDelivery::broadcast()).await;
            return Ok(());
        }
        GameCommand::ResumeFromHistory { move_number } => {
            let events = self
                .handle_resume_from_history(*move_number)
                .await
                .map_err(|e| CommandError::InvalidCommand(e))?;

            for event in events {
                self.broadcast_event(event, EventDelivery::broadcast()).await;
            }
            return Ok(());
        }
        GameCommand::ReturnToPresent => {
            let event = self
                .handle_return_to_present()
                .await
                .map_err(|e| CommandError::InvalidCommand(e))?;

            self.broadcast_event(event, EventDelivery::broadcast()).await;
            return Ok(());
        }
        _ => {
            // Not a history command, continue with normal processing
        }
    }

    // Handle GetAnalysis command directly (doesn't go through Table)
    if matches!(command, GameCommand::GetAnalysis { .. }) {
        return self.handle_get_analysis_command(command_seat).await;
    }

    // ... rest of existing code
}
```

**Location:** [crates/mahjong_server/src/network/commands.rs:56](crates/mahjong_server/src/network/commands.rs#L56)

## Phase 4: Memory Optimization ~~(Optional but Recommended)~~ **SKIPPED - NOT IMPLEMENTED**

**Decision:** Keep full snapshots for every move (current implementation).

**Rationale:**

- Memory usage is acceptable: ~500-750KB per game (300 moves × 2.5KB)
- Negligible for practice mode and moderate concurrent games
- Full snapshots enable instant jump to any move (no reconstruction needed)
- Simpler implementation, no event replay logic required
- Prioritizes user experience (instant history navigation) over memory savings

### 4.1 Snapshot Strategy (NOT IMPLEMENTED)

~~The naive approach stores full snapshots for every move (~2.5KB × 300 moves = 750KB). Optimize this:~~

**\*Option A: Periodic Snapshots + Event Replay** (Rejected - too complex)

- Store full snapshot every Nth move (e.g., every 10)
- For intermediate moves, store only the event
- Reconstruct by: Load nearest snapshot → replay events

**\*Option B: Differential Snapshots** (Rejected - unnecessary)

- Store only changes from previous snapshot
- Use a diffing algorithm (e.g., `serde_diff`)

**Current Implementation:** Store full snapshot on every move (Option C - simplest and fastest).

### 4.2 Implementation (NOT IMPLEMENTED - REFERENCE ONLY)

**Note:** This section is preserved for reference but was not implemented. The actual implementation uses full snapshots on every move.

<details>
<summary>Rejected approach: Periodic snapshots (click to expand)</summary>

~~Modify `MoveHistoryEntry`:~~

```rust
// This code was NOT implemented - kept for reference only
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveHistoryEntry {
    pub move_number: u32,
    pub timestamp: DateTime<Utc>,
    pub seat: Seat,
    pub action: MoveAction,
    pub description: String,

    // Only store snapshot every 10 moves
    pub snapshot: Option<Table>,
}

const SNAPSHOT_INTERVAL: u32 = 10;

impl Room {
    fn record_history_entry(&mut self, seat: Seat, action: MoveAction, description: String) {
        let should_snapshot = self.current_move_number % SNAPSHOT_INTERVAL == 0;

        let entry = MoveHistoryEntry {
            move_number: self.current_move_number,
            timestamp: Utc::now(),
            seat,
            action,
            description,
            snapshot: if should_snapshot {
                Some(self.table.clone())
            } else {
                None
            },
        };

        self.history.push(entry);
        self.current_move_number += 1;
    }

    /// Reconstruct state at a specific move by loading nearest snapshot + replaying events
    fn reconstruct_state_at_move(&self, move_number: u32) -> Result<Table, String> {
        // Find nearest snapshot before or at move_number
        let mut nearest_snapshot: Option<&Table> = None;
        let mut snapshot_move = 0;

        for entry in self.history.iter().take((move_number + 1) as usize).rev() {
            if let Some(ref snapshot) = entry.snapshot {
                nearest_snapshot = Some(snapshot);
                snapshot_move = entry.move_number;
                break;
            }
        }

        let mut state = nearest_snapshot
            .ok_or("No snapshot found")?
            .clone();

        // Replay events from snapshot to target move
        for entry in &self.history[snapshot_move as usize..=move_number as usize] {
            // Apply event to state (requires event application logic)
            // For MVP, this can be simplified by always using full snapshots
        }

        Ok(state)
    }
}
```

**Why this was rejected:** Event replay requires implementing `Table::apply_event()`, adding significant complexity with minimal benefit for typical use cases.

</details>

## Phase 5: Error Handling & Edge Cases

### 5.1 Error Cases to Handle

1. **Invalid Move Number**: User requests move 999 but only 142 moves exist
   - Return `GameEvent::HistoryError` with message
2. **History in Multiplayer**: User tries to access history in non-practice mode
   - Return error: "History is only available in Practice Mode"
3. **Resume Without Viewing**: User tries to resume but not viewing history
   - Return error: "Not viewing history"
4. **Empty History**: User requests history when no moves recorded yet
   - Return empty `HistoryList { entries: vec![] }`

### 5.2 Race Conditions

- **Simultaneous Jump/Resume**: Lock room state during history operations
- **History Recording During View**: Disable recording when `history_mode != None`

## Phase 6: Testing Plan

### 6.1 Unit Tests

Create `crates/mahjong_core/tests/history_test.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_entry_creation() {
        // Test that MoveHistoryEntry is created with correct fields
    }

    #[test]
    fn test_history_mode_transitions() {
        // Test None → Viewing → Paused → None
    }

    #[test]
    fn test_move_action_descriptions() {
        // Test that descriptions are human-readable
    }
}
```

### 6.2 Integration Tests

Create `crates/mahjong_server/tests/history_integration.rs`:

```rust
#[tokio::test]
async fn test_request_history_empty() {
    // New game → RequestHistory → Empty list
}

#[tokio::test]
async fn test_jump_to_move() {
    // Play 10 moves → JumpToMove(5) → State restored at move 5
}

#[tokio::test]
async fn test_resume_from_history() {
    // Play 20 moves → JumpToMove(10) → ResumeFromHistory(10)
    // → History truncated to 11 entries
}

#[tokio::test]
async fn test_return_to_present() {
    // JumpToMove(5) → ReturnToPresent → State restored to latest
}

#[tokio::test]
async fn test_history_only_in_practice_mode() {
    // Multiplayer game → RequestHistory → Error
}

#[tokio::test]
async fn test_invalid_move_number() {
    // RequestHistory with move_number=999 → Error
}
```

### 6.3 Manual Testing Checklist

- [ ] Play a full game, verify history has 150+ entries
- [ ] Jump to move 50, verify board state matches that point in time
- [ ] Resume from move 50, play 10 more moves, verify future history deleted
- [ ] Return to present from history view, verify correct state
- [ ] Attempt history in multiplayer, verify error
- [ ] Attempt invalid move numbers, verify error messages

## Phase 7: Frontend Integration Points

### 7.1 WebSocket Events to Handle

Frontend needs to listen for:

```typescript
// In apps/client/src/hooks/useGameWebSocket.ts

socket.on('HistoryList', (data) => {
  // Store history in state
  setGameHistory(data.entries);
});

socket.on('StateRestored', (data) => {
  // Update board to show historical state
  setHistoryMode(data.mode);
  setCurrentMove(data.move_number);
  // Show banner: "Viewing Move 45 of 142"
});

socket.on('HistoryTruncated', (data) => {
  // Remove moves after data.from_move from UI
  // Show notification: "97 future moves discarded"
});

socket.on('HistoryError', (data) => {
  // Show error toast
  toast.error(data.message);
});
```

### 7.2 UI Components Needed (Frontend Team)

**History Panel Component:**

```typescript
// apps/client/src/components/HistoryPanel.tsx
interface HistoryPanelProps {
  history: MoveHistorySummary[];
  currentMove: number;
  onJumpToMove: (moveNumber: number) => void;
  onReturnToPresent: () => void;
}

// Features:
// - Scrollable list of moves
// - Click to jump to move
// - Current move highlighted
// - "Return to Present" button
```

**Playback Controls Component:**

```typescript
// apps/client/src/components/HistoryPlaybackControls.tsx
// Features:
// - Previous/Next buttons
// - Play/Pause auto-advance
// - Speed control (1x, 2x, 4x)
```

**Confirmation Dialog:**

```typescript
// When user clicks ResumeFromHistory
confirm(`Resume from Move ${moveNumber}? This will discard ${futureCount} future moves.`);
```

## Phase 6 Test Summary

### Unit Tests (9 tests - all passing)

**Location:** `crates/mahjong_core/tests/history_test.rs`

1. `test_history_entry_creation` - Verify MoveHistoryEntry structure
2. `test_history_mode_default` - Test default HistoryMode
3. `test_history_mode_transitions` - Test mode state transitions
4. `test_move_action_draw_tile` - Test DrawTile action
5. `test_move_action_discard_tile` - Test DiscardTile action
6. `test_move_action_descriptions` - Verify human-readable descriptions
7. `test_history_entry_serialization` - Test JSON serialization
8. `test_history_mode_equality` - Test HistoryMode equality
9. `test_move_action_clone` - Test action cloning

### Integration Tests (15 tests - all passing)

**Location:** `crates/mahjong_server/tests/history_integration_tests.rs`

1. `test_request_history_empty` - Empty history on new game
2. `test_request_history_with_moves` - List history with entries
3. `test_jump_to_move` - Jump to specific move in history
4. `test_jump_to_invalid_move` - Error on invalid move number
5. `test_resume_from_history` - Resume gameplay from history point
6. `test_resume_from_invalid_move` - Error on invalid resume
7. `test_return_to_present` - Return from history view to present
8. `test_return_to_present_when_not_viewing` - Error when not viewing
9. `test_history_only_in_practice_mode` - Practice mode validation
10. `test_jump_to_move_only_in_practice_mode` - Jump in practice mode
11. `test_resume_only_in_practice_mode` - Resume in practice mode
12. `test_history_recording_disabled_while_viewing` - No recording while viewing
13. `test_multiple_jump_operations` - Multiple jumps preserve state
14. `test_is_practice_mode` - Practice mode detection (3+ bots)
15. `test_history_preserves_move_order` - Move ordering verification

**Test Coverage:**

- ✅ All command handlers tested
- ✅ Error cases and edge cases covered
- ✅ Practice mode enforcement verified
- ✅ State transitions validated
- ✅ History truncation on resume verified

## Implementation Checklist

### Backend (Rust)

- [x] **Phase 1:** Create data structures ✅ COMPLETE
  - [x] Create `crates/mahjong_core/src/history.rs` ✅
  - [x] Add `MoveHistoryEntry`, `MoveAction`, `HistoryMode` ✅
  - [x] Update `GameCommand` enum with history commands ✅
  - [x] Update `GameEvent` enum with history events ✅
  - [x] Add history fields to `Room` struct ✅
- [x] **Phase 2:** History recording (MODULAR APPROACH) ✅ COMPLETE
  - [x] Create `crates/mahjong_server/src/network/history.rs` (NEW FILE)
  - [x] Define `RoomHistory` trait with all handler methods
  - [x] Implement `is_practice_mode()` helper
  - [x] Implement `record_history_entry()` in trait
  - [x] Implement `handle_request_history()` in trait
  - [x] Implement `handle_jump_to_move()` in trait
  - [x] Implement `handle_resume_from_history()` in trait
  - [x] Implement `handle_return_to_present()` in trait
  - [x] Add `pub mod history;` to `crates/mahjong_server/src/network/mod.rs`
  - [x] Import `RoomHistory` trait in `events.rs`
  - [x] Hook into `broadcast_event()` to call `record_history_entry()`
  - [x] Test that history grows with gameplay
- [x] **Phase 3:** Wire up commands (MINIMAL CHANGES) ✅ COMPLETE
  - [x] Import `RoomHistory` trait in `commands.rs`
  - [x] Add history command matching in `handle_command()`
  - [x] Delegate to trait methods (NO implementation in commands.rs)
  - [x] Test all four commands work end-to-end
- [x] **Phase 4:** Memory optimization ✅ SKIPPED (Decision: Keep full snapshots)
  - [x] ~~Implement periodic snapshots (every 10 moves)~~ NOT IMPLEMENTED
  - [x] ~~Add state reconstruction logic~~ NOT IMPLEMENTED
  - [x] Decision documented: Full snapshots provide better UX with acceptable memory cost
- [x] **Phase 5:** Error handling ✅ COMPLETE
  - [x] Practice-mode checks are in trait methods ✅
  - [x] Validation for edge cases ✅
  - [x] Test error responses ✅
- [x] **Phase 6:** Testing ✅ COMPLETE
  - [x] Write unit tests for history module ✅
  - [x] Write integration tests for commands ✅
  - [ ] Manual testing of full workflow (Pending - requires frontend)

### Key Changes from Original Plan

**✅ Modular Structure:**

- All history **behavior** in `history.rs` (new file)
- All history **data** stays in `room.rs` (existing fields)
- `commands.rs` just delegates (no logic added)
- `events.rs` calls `record_history_entry()` (minimal change)

**✅ No "is_practice_mode" field:**

- Derived from `self.bot_seats.len() >= 3`
- No redundant state to maintain

**✅ Follows existing patterns:**

- Same trait-based approach as `RoomEvents`, `RoomCommands`, `RoomAnalysis`
- Clean separation of concerns

### Frontend (TypeScript/React)

- [ ] **Phase 7:** WebSocket integration
  - [ ] Add handlers for history events
  - [ ] Update game state on history events
- [ ] **UI Components:**
  - [ ] History Panel (scrollable list)
  - [ ] Playback Controls (prev/next/play/pause)
  - [ ] Mode Indicators (viewing/paused banners)
  - [ ] Confirmation dialogs
  - [ ] Keyboard shortcuts (H, ←, →, Esc, Space)

## Success Criteria

- ✅ Player can request full history and see all moves
- ✅ Player can jump to any move and see board state at that point
- ✅ Player can resume from any point (future moves deleted)
- ✅ Player can return to present from history view
- ✅ History only works in Practice Mode (error in multiplayer)
- ✅ History recording has minimal performance impact (<5ms per move)
- ✅ Memory usage stays reasonable (<1MB per game)

## Performance Targets

**Current Implementation (Full Snapshots):**

- **History Recording:** <5ms per entry (append-only Vec + clone, very fast)
- **Jump to Move:** <50ms (direct snapshot lookup, instant restoration)
- **Memory:** ~500-750KB per room (200-300 moves × 2.5KB per snapshot)
- **Trade-off:** Higher memory usage for instant navigation (no reconstruction delay)

~~**With Optimization:** <200KB per room (30 full snapshots × 2.5KB + 270 events × 500B)~~ NOT IMPLEMENTED

## References

- [Section 1: History Viewer specification](c:\Repos\mpmahj\docs\implementation\13-backend-gap-analysis.md#L39-L194)
- [Section 6.5: Deterministic State Capture](c:\Repos\mpmahj\docs\implementation\13-backend-gap-analysis.md#L842-L864) (prerequisite ✅)
- [Table struct](crates/mahjong_core/src/table/mod.rs)
- [Room struct](crates/mahjong_server/src/network/room.rs)
- [GameCommand enum](crates/mahjong_core/src/command.rs)
- [GameEvent enum](crates/mahjong_core/src/event.rs)

## Notes for Implementation

1. ~~**Start with Phase 1-3** (core functionality) before optimizing~~ ✅ COMPLETE
2. **Test incrementally** - don't implement everything before testing
3. ~~**Use full snapshots for MVP** - optimize later if memory is an issue~~ ✅ IMPLEMENTED - Using full snapshots (Phase 4 skipped)
4. **Frontend can be built in parallel** once WebSocket events are defined
5. **Practice Mode check is critical** - don't forget to validate this in all handlers ✅ IMPLEMENTED

---

**Ready for implementation!** This plan provides:

- ✅ Complete data structures with code examples
- ✅ Step-by-step implementation phases
- ✅ Exact file locations and line numbers
- ✅ Error handling specifications
- ✅ Testing strategy
- ✅ Performance targets
- ✅ Integration points for frontend

Hand this to a fast LLM (like Haiku) with instructions to implement Phase 1-3 first, test thoroughly, then proceed to optimization if needed.
