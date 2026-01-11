# AI Comparison Plan - Refactor Impact Analysis

**Date:** 2026-01-10
**Status:** ✅ Plan validated and updated
**Git Commit:** 36bcf39 (Refactor room.rs into modular components)

## Summary

The room.rs refactoring (commit 36bcf39) successfully modularized the codebase without breaking the AI comparison implementation plan. All planned integration points remain valid with **minor path updates required**.

## Refactoring Changes

### File Structure Changes

**Before (Monolithic):**

```text
crates/mahjong_server/src/
├── analysis.rs                    (557 lines - all analysis code)
└── network/
    └── room.rs                    (1300+ lines - everything)
```

**After (Modular):**

```text
crates/mahjong_server/src/
├── analysis/
│   ├── mod.rs                     (previous analysis.rs content)
│   └── worker.rs                  (NEW - extracted analysis_worker, 278 lines)
└── network/
    ├── room.rs                    (408 lines - core Room struct only)
    ├── room_store.rs              (NEW - RoomStore management)
    ├── analysis.rs                (NEW - RoomAnalysis trait, 138 lines)
    ├── commands.rs                (NEW - RoomCommands trait, 242 lines)
    └── events.rs                  (NEW - RoomEvents trait, 187 lines)
```

### Key Extractions

1. **analysis_worker** → `crates/mahjong_server/src/analysis/worker.rs`
   - Lines 21-266: Main worker loop
   - Lines 268-278: Helper function `send_event_to_session`

2. **Room analysis methods** → `crates/mahjong_server/src/network/analysis.rs` (RoomAnalysis trait)
   - `run_analysis_for_seat()` (lines 18-74)
   - `should_trigger_analysis()` (lines 82-110)
   - `enqueue_analysis()` (lines 113-138)

3. **Room command handling** → `crates/mahjong_server/src/network/commands.rs` (RoomCommands trait)

4. **Room event broadcasting** → `crates/mahjong_server/src/network/events.rs` (RoomEvents trait)

5. **RoomStore** → `crates/mahjong_server/src/network/room_store.rs`
   - Spawns `analysis_worker` for each room (lines 34, 49, 64, 83)

## Impact on AI Comparison Plan

### ✅ No Breaking Changes

The AI comparison plan remains **100% valid** because:

1. **Room struct unchanged**: All fields referenced in the plan are still present
2. **Worker location clear**: `analysis_worker` moved to a dedicated file (easier to find)
3. **Integration points preserved**: The worker's Step 3 (Update Phase) is still the correct insertion point
4. **Module hierarchy intact**: `analysis/comparison.rs` can still be added as planned

### 📝 Required Updates (Path References Only)

#### Step 1: Create Data Structures

- ✅ **No change needed**
- File: `crates/mahjong_server/src/analysis/comparison.rs` (same as planned)

#### Step 2: Update Module Hierarchy

- **OLD PATH:** `crates/mahjong_server/src/analysis.rs` (add at end, line 557)
- **NEW PATH:** `crates/mahjong_server/src/analysis/mod.rs` (add at end)

**Updated instruction:**

```rust
// File: crates/mahjong_server/src/analysis/mod.rs
// Add after line 556 (after existing pub mod worker; declaration)

pub mod comparison;  // ← Add this line
```

#### Step 3: Update Room Struct

- **OLD PATH:** `crates/mahjong_server/src/network/room.rs` (lines 41-77)
- **NEW PATH:** `crates/mahjong_server/src/network/room.rs` (lines 36-72)

**Updated location:** Lines 36-72 (Room struct definition)

Add fields after `pattern_lookup` (line 71):

```rust
    /// Pattern ID → display name (from UnifiedCard).
    /// Used for HintData.best_patterns.
    pub pattern_lookup: HashMap<String, String>,

    // ========== NEW FIELDS FOR AI COMPARISON ==========
    /// Debug mode: enables AI comparison logging
    /// Set from DEBUG_AI_COMPARISON environment variable at room creation
    pub(crate) debug_mode: bool,

    /// AI comparison log (only populated when debug_mode == true)
    /// Stored in memory, not persisted to database by default
    /// Each entry is ~5-10KB (hand snapshot + 3 recommendations)
    pub(crate) analysis_log: Vec<crate::analysis::comparison::AnalysisLogEntry>,
}
```

#### Step 4: Update Room Constructors

- **OLD PATH:** `crates/mahjong_server/src/network/room.rs` (lines 83-176)
- **NEW PATH:** `crates/mahjong_server/src/network/room.rs` (lines 75-169)

**Constructors to update:**

1. `new()` - line 76 (no change needed, delegates to `new_with_rules`)
2. `new_with_db()` - line 81 (no change needed, delegates to `new_with_db_and_rules`)
3. `new_with_rules()` - lines 86-111
4. `new_with_db_and_rules()` - lines 114-142
5. `with_id()` - lines 145-169

Add to each constructor (after `pattern_lookup: HashMap::new(),`):

```rust
                pattern_lookup: HashMap::new(),
                debug_mode: std::env::var("DEBUG_AI_COMPARISON")
                    .ok()
                    .as_deref() == Some("1"),
                analysis_log: Vec::new(),
```

#### Step 5: Integrate with Analysis Worker

- **OLD PATH:** `crates/mahjong_server/src/network/room.rs` (around line 1112)
- **NEW PATH:** `crates/mahjong_server/src/analysis/worker.rs` (after line 171)

**Insertion point:** After the per-seat analysis loop completes, before Step 3 begins.

**Exact location:** Between line 171 (closing `}` of for loop) and line 172 (`// --- Step 3: Update Phase`)

Insert AI comparison logging code:

```rust
        }  // ← Line 171: end of for seat in seats_to_analyze loop

        // ========== AI COMPARISON LOGGING ==========
        // Only run if debug mode is enabled via environment variable
        // This does NOT require accessing Room (which is locked), we work with the snapshot

        let debug_enabled = std::env::var("DEBUG_AI_COMPARISON")
            .ok()
            .as_deref() == Some("1");

        let mut comparison_logs = Vec::new();

        if debug_enabled && !results.is_empty() {
            use crate::analysis::comparison::{run_strategy_comparison, AnalysisLogEntry};
            use mahjong_ai::r#trait::{create_ai, MahjongAI};
            use mahjong_ai::Difficulty;

            // Run comparison for each seat that was analyzed
            for (seat, _analysis) in &results {
                if let Some(player) = snapshot.players.get(seat) {
                    // Create fresh AI instances for each comparison
                    let mut strategies: Vec<Box<dyn MahjongAI>> = vec![
                        create_ai(Difficulty::Hard, 0),   // Greedy
                        create_ai(Difficulty::Expert, 0), // MCTS
                        create_ai(Difficulty::Easy, 0),   // BasicBot
                    ];
                    let strategy_names = vec!["Greedy", "MCTS", "BasicBot"];

                    // Run comparison
                    let recommendations = run_strategy_comparison(
                        &player.hand,
                        &visible,
                        validator,
                        &mut strategies,
                        &strategy_names,
                    );

                    let log_entry = AnalysisLogEntry {
                        turn_number: snapshot.discard_pile.len() as u32,
                        seat: *seat,
                        hand_snapshot: player.hand.clone(),
                        recommendations,
                    };

                    comparison_logs.push(log_entry);

                    tracing::debug!(
                        seat = ?seat,
                        turn = snapshot.discard_pile.len(),
                        "AI comparison logged for seat"
                    );
                }
            }
        }

        // --- Step 3: Update Phase (Lock Room) ---  ← Line 172
```

**Then, inside Step 3 (Lock Room), after line 181:**

```rust
            room.analysis_hashes.hand_hashes = new_hand_hashes;  // ← Line 181

            // ========== APPEND AI COMPARISON LOGS ==========
            if !comparison_logs.is_empty() {
                room.analysis_log.extend(comparison_logs);

                // Optional: Limit log size to prevent unbounded growth
                const MAX_LOG_ENTRIES: usize = 500;
                if room.analysis_log.len() > MAX_LOG_ENTRIES {
                    let excess = room.analysis_log.len() - MAX_LOG_ENTRIES;
                    room.analysis_log.drain(0..excess);
                    tracing::debug!(
                        removed = excess,
                        remaining = room.analysis_log.len(),
                        "Trimmed old AI comparison log entries"
                    );
                }
            }

            // Update cache and stage events for sending  ← Line 183
```

#### Step 6: Add Helper Method to Access Log

- **OLD PATH:** `crates/mahjong_server/src/network/room.rs` (after line 200)
- **NEW PATH:** `crates/mahjong_server/src/network/room.rs` (after line 192)

Add after `pattern_name()` method (line 192):

```rust
    pub fn pattern_name(&self, pattern_id: &str) -> Option<&str> {
        self.pattern_lookup.get(pattern_id).map(|s| s.as_str())
    }

    /// Get the AI comparison log (debug mode only).
    ///
    /// Returns the full log if debug_mode is enabled, otherwise empty.
    pub fn get_analysis_log(&self) -> &[crate::analysis::comparison::AnalysisLogEntry] {
        if self.debug_mode {
            &self.analysis_log
        } else {
            &[]
        }
    }

    /// Get the number of entries in the analysis log.
    pub fn analysis_log_len(&self) -> usize {
        self.analysis_log.len()
    }

    /// Check if the room is full (4 players).  ← Line 194
```

#### Step 7: Optional - Replay Integration

- ✅ **No change needed**
- File: `crates/mahjong_server/src/replay.rs` (unchanged by refactor)

## Updated File Summary

### Files to Create (1 new file)

1. `crates/mahjong_server/src/analysis/comparison.rs` - AI comparison types and logic

### Files to Modify (3 existing files)

1. `crates/mahjong_server/src/analysis/mod.rs` - Add `pub mod comparison;`
2. `crates/mahjong_server/src/network/room.rs` - Add 2 fields, update 3 constructors, add 2 methods
3. `crates/mahjong_server/src/analysis/worker.rs` - Insert AI comparison logging (2 locations)

### Optional Files (not required for MVP)

1. `crates/mahjong_server/src/replay.rs` - Add analysis_log to AdminReplay (future enhancement)
2. `crates/mahjong_server/tests/ai_comparison_test.rs` - Integration tests (new file)

## Validation Checklist

- ✅ Room struct still exists at same conceptual location
- ✅ All Room fields referenced in plan are present
- ✅ analysis_worker still runs in background (spawned by RoomStore)
- ✅ Step 3 (Update Phase) lock pattern is unchanged
- ✅ analysis/comparison.rs module path is valid
- ✅ No conflicts with new trait-based architecture (RoomAnalysis, RoomCommands, RoomEvents)
- ✅ Import paths are correct (`use crate::analysis::comparison::*`)

## Benefits of Refactoring for AI Comparison

1. **Clearer insertion point**: `analysis/worker.rs` is now a dedicated file, easier to locate Step 3
2. **Smaller files**: Room.rs reduced from 1300+ to 408 lines, easier to navigate
3. **Better organization**: `analysis/comparison.rs` fits naturally alongside `analysis/worker.rs`
4. **No trait conflicts**: AI comparison doesn't need to implement any of the new traits
5. **Testing isolation**: Can test comparison logic independently from room/commands/events

## Conclusion

**The AI comparison plan is still 100% valid after the refactor.**

Only minor updates needed:

- Update 3 file paths in documentation (analysis.rs → analysis/mod.rs, room.rs line numbers)
- Update 2 line number references in worker.rs (171 and 181)

The refactoring actually **improves** the plan by making the codebase more modular and the insertion points clearer. No architectural changes required.

---

**Next Steps:**

1. Update ai-comparison-log-plan-CORRECTED.md with new paths
2. Proceed with implementation following the updated plan
3. All 7 implementation steps remain valid
