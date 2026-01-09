# Backend Implementation Plan: Gap Analysis & Refinements

This document outlines the backend changes required to support the "Mahjong 4 Friends" parity features, integrated deeply into the core system rather than as add-ons.

## Document Status

**Status:** DRAFT - In active iteration
**Last Updated:** 2026-01-09
**Last Audit:** 2026-01-09 - Implementation status verified against codebase
**Purpose:** High-level feature planning before detailed implementation specs

## Quick Status Overview (2026-01-09)

**Phase 0 - Baseline Rules Parity:** ⚠️ **NEARLY COMPLETE** (6/7 done)

- ✅ Call Priority (6.2), Scoring (6.4), Ruleset (6.1), Courtesy Pass, Timers (3), Deterministic Replay (6.5)
- ⚠️ Joker Restrictions (6.3) - Commands exist, pattern limits missing

**Gap Features:**

- ❌ Section 1: History Viewer - NOT STARTED
- ⚠️ Section 2: Always-On Analyst - PARTIAL (backend logic exists, server integration missing)
- ✅ Section 3: Passive Timers - DONE
- ⚠️ Section 4: Pattern Viability - PARTIAL (calculation exists, client integration missing)
- ⚠️ Section 5: Enhanced Logging - MIXED (5.1 replay done, 5.2 AI comparison not started)
- ❌ Section 7: Additional Features - NOT STARTED

**Key Recommendation:** Complete joker restrictions (6.3), then prioritize Always-On Analyst server integration (2.1-2.3) as foundation for hints (2.5) and pattern viability UI (4.4).

## Open Questions

1. **Scope Boundaries**: Which features are MVP vs. Phase 2/3? (See checklist at bottom)
2. **Performance Budgets**: What are acceptable latency limits for analysis? (Proposed: <50ms avg)
3. **Multiplayer vs. Practice Mode**: Which features work in live multiplayer vs. solo practice only?
4. **Frontend Priority**: Should we spec out UI changes before backend implementation?

---

## 1. Feature: History Viewer & Time Travel (Jump to Any Point)

> **IMPLEMENTATION STATUS (2026-01-09): ❌ NOT IMPLEMENTED**
>
> - No `MoveHistoryEntry` structure exists
> - No history commands (`RequestHistory`, `JumpToMove`, `ResumeFromHistory`)
> - No history-related events in `GameEvent` enum
> - No snapshot stack in `Room` struct
> - **Location verified**: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`

**Goal:** Allow players (in Practice Mode) to view a complete history of all game moves and jump to any point in time. Inspired by Mahjong 4 Friends' history feature, this is not a simple "undo last move" but a full time-travel interface.

### 1.1 Architecture

> **STATUS: ❌ Not implemented** - No `MoveHistoryEntry` or history tracking in `Room`

- **State Management:** The `Room` struct maintains a comprehensive move history:

  ```rust
  struct MoveHistoryEntry {
      move_number: u32,
      timestamp: DateTime<Utc>,
      seat: Seat,
      action: MoveAction, // DrawTile, DiscardTile, CallTile, PassTiles, etc.
      description: String, // "Bot 2 placed a kong of white dragons", "You drew a 2 dot"
      snapshot: Table, // Full game state at this point
  }
  history: Vec<MoveHistoryEntry>
  ```

- **Snapshot Triggers:** Every significant player action creates a history entry:
  - Tile drawn (including which player and which tile for human player)
  - Tile discarded
  - Meld declared (Pung/Kong/Quint)
  - Charleston pass completed
  - Call window opened/closed
  - Mahjong declared

### 1.2 Logic Flow

> **STATUS: ❌ Not implemented** - No history commands or events exist

1. **Client Request:**
   - Opens History UI: `GameCommand::RequestHistory` → receives full history list
   - Jumps to move: `GameCommand::JumpToMove { move_number: u32 }`
2. **Server Logic:**
   - For `RequestHistory`: Return list of all `MoveHistoryEntry` with descriptions (but snapshots stay server-side)
   - For `JumpToMove`:
     - Look up the snapshot at `move_number`
     - Restore game state to that snapshot
     - Invalidate all AI analysis/hints after that point
     - Mark game as "in history mode" (cannot make new moves until returning to current state)
3. **State Restoration:** Broadcast restored state to client with clear indication of current position in history.

### 1.3 Implementation Details

> **STATUS: ❌ Not implemented** - Specification only

**History Scope:**

- **Full game history:** Every move from Charleston start to current state
- **No limit on jumps:** Player can jump to any move, not just recent ones
- **Two modes:**
  - **View mode:** Browsing history (read-only, game paused)
  - **Resume mode:** Jump to a point and resume playing from there (invalidates future moves)
- **Multiplayer:** History viewer is **Practice Mode only** (not available in live multiplayer games)

**Move Descriptions:**

The history UI should show human-readable descriptions:

- "Move 12 - You drew 3 Bam"
- "Move 15 - Bot 2 discarded Green Dragon"
- "Move 23 - Bot 3 called Pung of 5 Dots"
- "Move 48 - You passed 3 tiles right (Charleston First Right)"
- "Move 92 - Bot 1 declared Mahjong with 'Consecutive 2468' for 50 points"

**State Management:**

- **History Size:** Full game history (typically 150-300 moves per game)
  - Each entry ≈ 2.5KB (2KB snapshot + 500B metadata)
  - Worst case: 300 moves × 2.5KB = 750KB per room (acceptable for practice mode)
- **Memory Optimization:**
  - Store full snapshots for every Nth move (e.g., every 10th)
  - For intermediate moves, store deltas or reconstruct from events
  - Consider: Keep full snapshots at phase boundaries (Charleston → Playing, etc.)
- **Cleanup:** History cleared when game ends or player starts new game

**Error Handling:**

- Invalid move number → Return error "Move 999 does not exist (game has 142 moves)"
- Jump while in multiplayer → Return error "History is only available in Practice Mode"
- Resume from history point → Confirm dialog: "This will discard all moves after Move 50. Continue?"

**Network Protocol:**

- **Commands:**
  - `GameCommand::RequestHistory` → Get list of all moves
  - `GameCommand::JumpToMove { move_number: u32 }` → Jump to specific point
  - `GameCommand::ResumeFromHistory { move_number: u32 }` → Resume playing from this point (discard future)
  - `GameCommand::ReturnToPresent` → Exit history view mode, return to current state
- **Events:**
  - `GameEvent::HistoryList { entries: Vec<MoveHistoryEntry> }` → Full history sent to client
  - `GameEvent::StateRestored { move_number: u32, description: String }` → Jumped to move
  - `GameEvent::HistoryTruncated { from_move: u32 }` → Future moves deleted when resuming
- **Responses:**
  - Each history entry includes: move number, timestamp, player, action type, description

### 1.4 Frontend Impact

> **STATUS: ❌ Not implemented** - Backend prerequisite missing

**UI Components Needed:**

- **History Panel/Drawer:**
  - Scrollable list of all moves (chronological)
  - Each entry shows: move number, player icon/name, action description, timestamp
  - Click any move to jump to that point
  - Current position highlighted
  - "Return to Present" button (always visible when in history mode)
- **Playback Controls:**
  - Step backward (go to previous move)
  - Step forward (go to next move)
  - Play/Pause (auto-advance through moves)
  - Speed control (1x, 2x, 4x playback)
- **Mode Indicators:**
  - Banner: "Viewing history - Move 45 of 142" (when browsing)
  - Banner: "Game paused - Click 'Return to Present' or 'Resume from Here'" (when jumped)
- **Confirmation Dialogs:**
  - When resuming from history: "Resume from Move 45? This will discard 97 future moves."
  - Option to save diverged game as separate replay (future feature)

**State Synchronization:**

- Client maintains two states:
  - `currentState`: The actual game state at "present time"
  - `viewingState`: The state being viewed when in history mode
- When jumping: Update `viewingState`, keep `currentState` unchanged
- When resuming: Update `currentState` to match `viewingState`, clear future history
- Animations: Smooth transition between states (tiles flying, etc.)

**Keyboard Shortcuts:**

- `H` - Open history panel
- `←` - Previous move
- `→` - Next move
- `Esc` - Return to present
- `Space` - Play/Pause (when in playback mode)

**Performance Considerations:**

- Lazy loading: Only fetch move descriptions initially (not full snapshots)
- Fetch snapshot on-demand when jumping
- Cache recently viewed snapshots client-side
- Virtual scrolling for long history lists (300+ moves)

---

## 2. Feature: The "Always-On" Analyst

> **IMPLEMENTATION STATUS (2026-01-09): ⚠️ PARTIALLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `StrategicEvaluation` struct in `mahjong_ai/src/evaluation.rs` with:
>   - `viable: bool` field for pattern viability
>   - `difficulty`, `probability`, `expected_value` calculations
>   - `check_viability()` function validates tile availability
> - ✅ `VisibleTiles` context tracking in `mahjong_ai/src/context.rs`
> - ✅ Dead pattern filtering via `filter_dead_patterns()` function
>
> **Missing:**
>
> - ❌ `StrategicEvaluation` still in `mahjong_ai` (not moved to `mahjong_core`)
> - ❌ No `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` in `Room`
> - ❌ No automatic analysis trigger after state changes
> - ❌ Not sent to clients in game events or snapshots
> - ❌ **Hint system NOT implemented** (Section 2.5)
>
> **Locations verified**: `crates/mahjong_ai/src/evaluation.rs`, `crates/mahjong_server/src/network/room.rs`

**Goal:** Integrate AI analysis as a core part of the game loop, not an on-demand utility. This powers Bots, Hints, and Pattern Viability tracking simultaneously.

### 2.1 Architecture

> **STATUS: ⚠️ Partially implemented** - `StrategicEvaluation` exists but not integrated into server loop

- **Core Integration:** The `HandValidator` or a new `GameAnalyst` struct is embedded in the `Table` (or `Room`).
- **Trigger:** Analysis runs automatically:
  - After `TilesDealt`.
  - After every `DiscardTile` (to analyze call opportunities).
  - After every `DrawTile`.

### 2.2 Data Structure

> **STATUS: ❌ Not implemented** - `StrategicEvaluation` still in `mahjong_ai`, no `analysis` field in `Room`

- Move `StrategicEvaluation` from `mahjong_ai` to `mahjong_core/src/analysis.rs`.
- Add `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` to the `Room` (kept server-side).

### 2.3 Logic Flow

> **STATUS: ❌ Not implemented** - No automatic analysis on state changes

1. **Event:** A move occurs (e.g., Tile Discarded).
2. **Analysis:** Server calculates `evaluate_hand` for all 4 seats.
   - **For Bots:** The result determines their next move immediately.
   - **For Humans:** The result is cached.
3. **Distribution:**
   - When sending `GameStateSnapshot` or events to a client, the server includes a summary of _their_ specific analysis (e.g., "Top 3 viable patterns", "List of impossible patterns").
   - **Optimization:** Only send this heavy data if it changed significantly or upon request/turn start.

### 2.4 Performance Considerations

> **STATUS: ⚠️ Needs measurement** - Core analysis logic exists, server integration pending

**Analysis Frequency:**

- **Challenge:** Running full analysis after every state change (4 players × 500 patterns) could be expensive
- **Proposed Optimization Strategies:**
  1. **Lazy Evaluation:** Only analyze on a player's turn (not after every discard)
  2. **Incremental Analysis:** Cache previous results, only recalculate deltas
  3. **Parallel Processing:** Use multi-threading to analyze all 4 hands simultaneously
  4. **Smart Triggers:** Only re-analyze when hand composition changes (not on every event)

**Performance Budget:**

- **Target:** Analysis must complete in <50ms on average (90th percentile <100ms)
- **Profiling Required:** Measure actual performance with production data before optimization
- **Question:** Should we use a background worker thread for analysis to avoid blocking game loop?

**Bandwidth Optimization:**

- **Delta Compression:** Only send changed patterns, not full analysis every time
- **Client-Side Caching:** Client remembers last analysis, server sends diff
- **Concrete Thresholds:**
  - Send full analysis: On turn start, or when >30% of patterns change viability
  - Send delta update: When 1-30% of patterns change
  - Send nothing: When <1% change (cosmetic differences)
- **Question:** Should analysis updates be sent automatically, or only on client request?

### 2.5 Hint System Integration

> **STATUS: ❌ NOT IMPLEMENTED** - No hint data structure or generation logic exists

**Goal:** Use Always-On Analyst to power intelligent hints for human players.

**Hint Types:**

1. **Discard Suggestions:**
   - "Discard 7D to keep maximum pattern options open"
   - Based on expected value calculation from StrategicEvaluation
2. **Pattern Recommendations:**
   - "Focus on '2468 Consecutive' - you're 2 tiles away"
   - Highlight top 3 most probable patterns
3. **Call Opportunities:**
   - "Calling this Pung closes off 4 other patterns - consider passing"
   - Defensive analysis: "This discard is safe (opponent unlikely to call)"
4. **Win Alerts:**
   - "You're 1 tile away from Mahjong! Waiting for: 3B, 6D"
   - Flash notification when hand becomes "hot"

**Skill Level Tuning:**

- **Beginner Mode:** Show explicit hints ("Discard this tile →")
- **Intermediate Mode:** Show pattern probabilities, let player decide
- **Expert Mode:** No hints, just pattern viability (dead/alive)
- **Question:** Should hints be toggle-able mid-game, or locked at game start?

**Data Structure:**

```rust
struct HintData {
    recommended_discard: Option<Tile>,
    best_patterns: Vec<(String, f64)>, // (pattern_name, probability)
    tiles_needed_for_win: Vec<Tile>,
    distance_to_win: u8, // Minimum tiles needed
}
```

### 2.6 Frontend Impact

> **STATUS: ❌ Not applicable** - Backend prerequisite missing (Section 2.1-2.5 must be completed first)

**UI Components Needed:**

- **Card Viewer Integration:**
  - Gray out impossible patterns (viable == false)
  - Highlight "close" patterns (distance <= 3 tiles)
  - Sort patterns by probability/score
- **Hint Panel (Optional, toggleable):**
  - "Recommended discard: 7D"
  - "Best pattern: Consecutive 2468 (75% chance with 2 more tiles)"
- **Win Proximity Indicator:**
  - Badge showing "2 tiles away" or "1 tile away!"
  - Color-coded: Red (far), Yellow (close), Green (1 away)
- **Performance:**
  - Analysis updates should not cause UI lag
  - Consider throttling updates (max 1 update per second)

---

## 3. Feature: Passive Timers (No Auto-Play)

> **IMPLEMENTATION STATUS (2026-01-09): ✅ FULLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `TimerMode` enum in `crates/mahjong_core/src/table/types.rs`:
>   - `Visible` - Timer shown but doesn't enforce actions
>   - `Hidden` - No timer shown
> - ✅ `Ruleset` struct includes:
>   - `timer_mode: TimerMode`
>   - `call_window_seconds: u32`
>   - `charleston_timer_seconds: u32`
> - ✅ No timer-based force-skip logic in state machine
> - ✅ Timer values sent with `CharlestonTimerStarted` and `CallWindowOpened` events
> - ✅ State machine waits indefinitely for player actions (timers are UI-only)
>
> **Locations verified**: `crates/mahjong_core/src/table/types.rs`, `crates/mahjong_core/src/event.rs`

**Goal:** Respect the player's pace. Timers are for urgency/UI feedback, not server-side enforcement.

### 3.1 Architecture

> **STATUS: ✅ Implemented** - `TimerMode` enum exists, passive by default

- **Removal:** Remove `timer` expiration logic from `mahjong_server` loop.
- **Metadata:** Keep `timer` fields in `TurnStage::CallWindow` and `CharlestonState`, but strictly for Client UI display ("Time remaining: 10s").

### 3.2 Logic Updates

> **STATUS: ✅ Implemented** - Server waits indefinitely, no auto-advance

- **Call Window:**
  - The server enters `CallWindow`.
  - It waits indefinitely for `GameCommand::Pass` or `GameCommand::Call` from all eligible players.
  - It **never** auto-advances.
  - **Visuals:** The client can flash/beep when the metadata timer reaches 0, but the player is never skipped.
- **Charleston:**
  - Similarly, waits for all players to select tiles. No random auto-selection.

### 3.3 Edge Cases & Questions

> **STATUS: ✅ Implemented** - Bot takeover exists; timer enforcement configurable

**Multiplayer Considerations:**

- **Question:** In live multiplayer, do we still want passive timers? Or only in Practice Mode?
- **Proposed:** Passive timers for Practice Mode only; multiplayer can have optional enforcement
- **AFK Detection:**
  - If a player is inactive for >5 minutes, should the server:
    - Pause the game and notify other players?
    - Let an AI bot take over temporarily?
    - Kick the player and forfeit?
  - **Recommendation:** Bot takeover after 3 minutes of inactivity (existing feature)

**UI/UX Concerns:**

- **Timer Display:** Show timer even if it's passive ("suggested time remaining")
- **Visual Urgency:** Flash/pulse UI when timer expires, but don't block actions
- **Question:** Should timer speed up audio cues as it approaches zero? (Like a countdown beep)

**Settings Integration:**

- **Per-Game Setting:** "Enable timer enforcement" toggle
  - Default OFF for Practice Mode
  - Default ON for Ranked/Competitive Mode (future)
- **Timer Duration:** Customizable (30s, 60s, 90s, unlimited)

### 3.4 Frontend Impact

> **STATUS: ⚠️ Partially applicable** - Backend done, frontend UI updates needed

**UI Changes:**

- Remove "auto-play countdown" indicators
- Change timer color scheme: Green → Yellow → Red (but no blocking)
- Add setting: "Timer enforcement" checkbox in game settings
- Toast notification: "Timer expired (you can still move)"

---

## 4. Feature: Dead Hand / Pattern Viability

> **IMPLEMENTATION STATUS (2026-01-09): ⚠️ PARTIALLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `viable: bool` field in `StrategicEvaluation` (`mahjong_ai/src/evaluation.rs:36`)
> - ✅ `check_viability()` function validates tile availability (`evaluation.rs:138-149`)
> - ✅ `VisibleTiles` context tracking in `mahjong_ai/src/context.rs`
> - ✅ Difficulty calculation logic (scarcity weighting)
> - ✅ Dead pattern filtering: `filter_dead_patterns()` function
>
> **Missing:**
>
> - ❌ No difficulty classification enum (Easy/Medium/Hard/Impossible)
> - ❌ Viability/difficulty not sent to client in game state or events
> - ❌ No Card Viewer integration (graying out impossible patterns)
> - ❌ No pattern filtering/sorting UI
>
> **Locations verified**: `crates/mahjong_ai/src/evaluation.rs`, `crates/mahjong_ai/src/context.rs`

**Goal:** Visualize which patterns are statistically impossible based on the _global_ board state (Standard Mahjong "Card Tracking").

### 4.1 Logic

> **STATUS: ⚠️ Partially implemented** - Backend calculation exists, client integration missing

- This is a derived view of the **Always-On Analyst**.
- The `StrategicEvaluation` struct already contains `viable: bool` (calculated by checking if required tiles are dead).
- **Frontend Integration:**
  - The Client receives the list of `StrategicEvaluation` for the user's hand.
  - The Client UI (Card Viewer) iterates through this list.
  - If `viable == false`, the pattern is grayed out or marked "Impossible".
  - If `viable == true` but `difficulty` is high, it might be marked "Hard".

### 4.2 Tile Tracking & Viability Calculation

> **STATUS: ✅ Implemented** - Algorithm confirmed in `mahjong_ai/src/evaluation.rs:138-149`

**What Makes a Pattern "Dead":**

- **Required tiles exhausted:** If a pattern needs 4× of a specific tile, but all 4 are visible (discarded or in exposed melds), the pattern is impossible.
- **Joker limitations:** Some patterns have joker restrictions (e.g., "No jokers allowed" or "Max 1 joker").
- **Suit consistency:** For variable suit patterns (VSUIT1, VSUIT2), if all tiles of a required suit are dead, the pattern is impossible.

**Data Requirements:**

- Server must track:
  - All discarded tiles (already tracked in discard pile)
  - All exposed melds (already tracked per player)
  - Tiles remaining in wall (implicit: 152 - dealt - discarded)
- **Privacy:** Server only sends viability data for the requesting player's hand (doesn't reveal other players' concealed tiles)

**Algorithm:**

```rust
fn is_pattern_viable(hand: &Hand, pattern: &Pattern, visible_tiles: &TileSet) -> bool {
    let required_histogram = pattern.histogram;
    for (tile_idx, count_needed) in required_histogram.iter().enumerate() {
        let visible_count = visible_tiles.count(tile_idx);
        let in_hand = hand.histogram[tile_idx];
        let remaining = 4 - visible_count - in_hand; // Tiles still in wall/other hands

        if count_needed > (in_hand + remaining) {
            return false; // Not enough tiles available
        }
    }
    true
}
```

### 4.3 Pattern Difficulty Classification

> **STATUS: ⚠️ Partially implemented** - Calculation logic exists, no enum classification sent to client

**Beyond Viable/Impossible, classify patterns by difficulty:**

- **Easy (Green):** 0-1 tiles needed, high probability tiles available
- **Medium (Yellow):** 2-3 tiles needed, moderate probability
- **Hard (Orange):** 4+ tiles needed, or low probability tiles (many already discarded)
- **Impossible (Gray):** Mathematically impossible (required tiles exhausted)

**Question:** Should difficulty be calculated server-side or client-side?

- **Recommendation:** Server-side (part of StrategicEvaluation), so Hints can use it too

### 4.4 Frontend Impact

> **STATUS: ❌ Not implemented** - Backend prerequisite (Section 2 integration) missing

**Card Viewer Enhancements:**

- **Color Coding:**
  - Gray out impossible patterns with strikethrough
  - Color-code viable patterns by difficulty (green/yellow/orange)
- **Filtering:**
  - Toggle: "Show only viable patterns"
  - Toggle: "Hide impossible patterns"
- **Sorting:**
  - Sort by: Probability, Score, Difficulty, Name
  - Default: Sort by Probability (most likely first)
- **Tooltips:**
  - Hover over impossible pattern: "This pattern needs 4× 5D, but all are discarded"
  - Hover over viable pattern: "2 tiles needed: 3C, 6C"

**Performance:**

- Card Viewer should update in real-time as patterns become dead
- Debounce updates to avoid flickering (max 1 update per 500ms)

---

## 5. Feature: Enhanced Logging & Comparative Analysis

> **IMPLEMENTATION STATUS (2026-01-09): ⚠️ MIXED (5.1 done, 5.2 not started)**
>
> **Section 5.1 - Game Activity Log: ✅ FULLY IMPLEMENTED**
>
> - ✅ `ReplayService` in `crates/mahjong_server/src/replay.rs` (200+ lines)
> - ✅ Events stored in database with sequence numbers
> - ✅ `PlayerReplay` - filtered view for specific player (privacy-respecting)
> - ✅ `AdminReplay` - full event log (no filtering)
> - ✅ Event metadata: seq, visibility, target_player, timestamp
> - ✅ State reconstruction from event log via `apply_event()` in `crates/mahjong_core/src/table/replay.rs`
> - ✅ Snapshot-based replay optimization (snapshots every 50 events)
> - ✅ Wall state persistence (seed + draw_index)
>
> **Section 5.2 - AI Comparison Log: ❌ NOT IMPLEMENTED**
>
> - ❌ No `AnalysisLogEntry` structure
> - ❌ No multi-strategy analysis (Greedy vs MCTS vs Basic comparison)
> - ❌ No debug mode for alternate engine logging
> - ❌ No "Director's Cut" log with what-if analysis
>
> **Locations verified**: `crates/mahjong_server/src/replay.rs`, `crates/mahjong_core/src/table/replay.rs`, test files

**Goal:** Maintain a persistent record of game events and a side-channel log of AI decision-making for debugging and strategy comparison.

### 5.1 Game Activity Log

> **STATUS: ✅ FULLY IMPLEMENTED** - Replay system complete with player filtering and snapshots

- **Structure:** `game_log: Vec<GameEvent>` stored in `Room`.
- **Function:** Appends every broadcasted event.
- **Usage:**
  - Sent to client on reconnect/refresh (History View).
  - Used for "Replay" feature (Roadmap).

### 5.2 AI Comparison Log ("Director's Cut")

> **STATUS: ❌ NOT IMPLEMENTED** - No multi-engine analysis logging exists

- **Structure:**

  ```rust
  struct AnalysisLogEntry {
      turn_number: u32,
      seat: Seat,
      hand_snapshot: Hand,
      recommendations: HashMap<String, Recommendation>, // Key = "Greedy", "MCTS", "Basic"
  }
  ```

- **Logic:**
  - If `debug_mode` is enabled, the Analysis step runs _multiple_ AI strategies on the current hand.
  - It records what each engine _would_ have recommended.
- **Access:** Exposed via a debug endpoint/websocket channel. Not sent to standard clients to save bandwidth.

### 5.3 Replay System Integration

> **STATUS: ✅ FULLY IMPLEMENTED** - Database replay storage with player filtering and snapshots

**Goal:** Use Game Activity Log to enable post-game replay and analysis.

**Replay Features:**

- **Basic Replay:**
  - Play back the entire game from start to finish
  - Step forward/backward through moves
  - Jump to specific turns
- **Filtered Replay:**
  - View from a specific player's perspective
  - Show only that player's visible information (no cheating by seeing other hands)
- **"What-If" Analysis (Future):**
  - Branch from any point in history
  - Try different moves and see outcomes
  - Compare actual vs. hypothetical results

**Data Structure:**

```rust
struct GameReplay {
    game_id: String,
    players: Vec<String>, // Player names/IDs
    card_year: u16,
    events: Vec<GameEvent>, // Full event log
    analysis_log: Option<Vec<AnalysisLogEntry>>, // Only if debug mode
}
```

**Storage:**

- **Question:** Store replays in database or as JSON files?
  - **Recommendation:** Database for active games, export to JSON for archival
- **Retention:** Keep replays for 30 days, or indefinitely for "saved" games
- **Privacy:** Players can choose to make replays public/private

### 5.4 Statistical Tracking

> **STATUS: ❌ NOT IMPLEMENTED** - No player statistics tracking system exists

**Goal:** Track long-term patterns for player improvement and game balancing.

**Metrics to Track:**

1. **Pattern Usage:**
   - Which patterns are won most often?
   - Which patterns are attempted but not completed?
   - Pattern win rate by skill level
2. **Discard Safety:**
   - Which tiles are called most often?
   - "Dangerous discard" statistics per tile type
3. **AI Performance:**
   - Win rate by AI difficulty
   - Average game length by AI level
   - Which AI strategies perform best?
4. **Player Statistics:**
   - Overall win rate
   - Favorite patterns
   - Average time per move
   - Charleston efficiency (tiles passed vs. tiles kept)

**Storage:**

```rust
struct PlayerStats {
    player_id: String,
    games_played: u32,
    games_won: u32,
    patterns_won: HashMap<String, u32>, // Pattern name → count
    average_turns_to_win: f64,
    favorite_patterns: Vec<String>,
}
```

**Question:** Should stats be calculated real-time or batch-processed overnight?

- **Recommendation:** Real-time for basic stats (win/loss), batch for complex analysis

### 5.5 Frontend Impact

> **STATUS: ❌ NOT IMPLEMENTED** - UI components not built (backend replay service ready)

**Replay Viewer:**

- **UI Components:**
  - Timeline scrubber (drag to any point in game)
  - Play/Pause/Step Forward/Step Backward buttons
  - Speed control (1x, 2x, 4x)
  - Player perspective selector
- **Visualization:**
  - Animate tile movements as they happened
  - Show analysis overlay (if available)
  - Highlight winning hand at end

**Statistics Dashboard:**

- **UI Components:**
  - Win rate chart (overall and by pattern)
  - Pattern popularity graph
  - Personal best scores
  - Recent game history list
- **Filters:**
  - Date range, AI difficulty, card year

---

## 6. Core Rules & Deterministic State (Backend-Critical)

> **IMPLEMENTATION STATUS (2026-01-09): ✅ MOSTLY IMPLEMENTED (Phase 0 nearly complete)**
>
> **Summary:**
>
> - ✅ 6.1 Ruleset Configuration - **DONE**
> - ✅ 6.2 Call Priority - **DONE**
> - ⚠️ 6.3 Joker Rules - **PARTIAL** (commands exist, pattern limits missing)
> - ✅ 6.4 Scoring & Settlement - **DONE**
> - ✅ 6.5 Deterministic State Capture - **DONE**
> - ⚠️ 6.6 Multiplayer Stalling Controls - **PARTIAL** (bot takeover exists, no explicit pause/forfeit)
>
> **See subsections below for detailed status**

These items are foundational for rules parity and data integrity; they are not optional UX polish.

### 6.1 Ruleset Configuration & Metadata

> **STATUS: ✅ FULLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `Ruleset` struct in `crates/mahjong_core/src/table/types.rs` with:
>   - `card_year: u16`
>   - `timer_mode: TimerMode`
>   - `blank_exchange_enabled: bool`
> - ✅ Stored in `HouseRules` and persisted in `Room`
> - ✅ Included in `GameStateSnapshot` for replay integrity
> - ✅ Used in validation against per-game ruleset
>
> **Location**: `crates/mahjong_core/src/table/types.rs`

**Goal:** Make all rule-variant settings explicit and persisted with the game so analysis, replay, and scoring are consistent.

- **Ruleset Fields:** NMJL card year, house rules, optional Charleston variants, timer enforcement, blank tiles, joker policy.
- **Persistence:** Store ruleset snapshot in `Room` and replay log (per-game, immutable once started).
- **Validation:** Server validates every move against the ruleset, not client assumptions.

### 6.2 Call Priority & Illegal-Move Enforcement

> **STATUS: ✅ FULLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `CallResolution` enum: `Mahjong(Seat)`, `Meld{seat, meld}`, `NoCall`
> - ✅ `resolve_calls()` function implements priority logic
> - ✅ Mahjong > Meld priority with seat-order tie-breaks
> - ✅ Counterclockwise order: Right > Across > Left from discarder
> - ✅ `DeclareCallIntent` command supports buffering
> - ✅ `CallIntentKind`: `Mahjong` vs `Meld(meld)`
> - ✅ `CallResolved` event emitted after all players respond
> - ✅ Test coverage in `crates/mahjong_core/tests/call_priority.rs`
>
> **Location**: `crates/mahjong_core/src/call_resolution.rs`

**Goal:** Adjudicate call windows deterministically and reject invalid claims.

- **Priority:** Mahjong > Pung/Kong/Quint, with seat-order tie-breaks.
- **Call Window Rules:** Who can call what, and when (including simultaneous call resolution).
- **Illegal Actions:** Server rejects out-of-rule calls/discards and emits clear error events.

### 6.3 Joker Rules & Replacement Draws

> **STATUS: ⚠️ PARTIALLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `ExchangeJoker` command: swap joker from exposed meld with real tile
> - ✅ Joker assignment tracking in `Meld` struct via `joker_assignments: HashMap`
> - ✅ Replacement draw events: `ReplacementDrawn { reason: Kong | Quint | BlankExchange }`
> - ✅ `ExchangeBlank` command for blank tile exchanges
>
> **Missing:**
>
> - ❌ **Pattern-specific joker limits** (max 1 joker, no joker pairs, etc.)
> - ❌ Joker restrictions not encoded in `UnifiedCard` pattern metadata
> - ❌ `ineligible_histogram` field exists in schema but not used for validation
>
> **Locations**: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`, `crates/mahjong_core/src/rules/card.rs`

**Goal:** Encode common American Mahjong joker rules server-side.

- **Joker Restrictions:** No jokers in singles/pairs (except joker pairs if allowed), pattern-specific limits.
- **Joker Swap:** Allow exchanging a joker from an exposed meld when you can replace it with the natural tile.
- **Replacement Draw:** When a player declares a Kong/Quint (as allowed), handle replacement draws per ruleset.

### 6.4 Scoring, Settlement, and Dealer Rotation

> **STATUS: ✅ FULLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `calculate_score()` function: base score + concealed bonus + dealer bonus
> - ✅ `BASE_SCORE = 25` points (standard NMJL)
> - ✅ Concealed bonus: +50%, Dealer bonus: +50%
> - ✅ Self-draw: all losers pay double
> - ✅ `calculate_next_dealer()`: Winner retains if dealer, else rotates clockwise
> - ✅ Handles wall exhaustion (no winner case)
> - ✅ `GameResult` structure with winner, winning_pattern, score_breakdown, final_scores, next_dealer
> - ✅ Test coverage in `crates/mahjong_core/tests/scoring_integration.rs`
>
> **Location**: `crates/mahjong_core/src/scoring.rs`

**Goal:** Provide authoritative end-of-hand resolution.

- **Hand Validation:** Determine the exact winning pattern and score (exposed vs. concealed, self-draw vs. call).
- **Payouts/Accounting:** Apply scoring to all players (points or chip-style settlement).
- **Round Flow:** Dealer rotation, wall exhaustion handling (no-winner), and rematch setup.

### 6.5 Deterministic State Capture (Undo + Replay)

> **STATUS: ✅ FULLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ `wall_seed: u64` - RNG seed for deck shuffling
> - ✅ `wall_draw_index: usize` - current position in wall
> - ✅ `wall_break_point: u8` - break point from dice roll
> - ✅ `wall_tiles_remaining: usize` - tiles left in wall
> - ✅ `GameStateSnapshot` includes all wall state fields (from `crates/mahjong_core/src/snapshot.rs:60-64`)
> - ✅ `Wall::from_seed(seed)` reproduces exact tile order deterministically
> - ✅ `Table::from_snapshot()` restores complete game state
> - ✅ Snapshots stored in database every 50 events (SNAPSHOT_INTERVAL)
> - ✅ Test coverage in `crates/mahjong_core/tests/wall_state_persistence.rs` confirms determinism
>
> **Locations**: `crates/mahjong_core/src/snapshot.rs`, `crates/mahjong_core/src/deck.rs`, test files

**Goal:** Make undo and replay deterministic and debuggable.

- **State Snapshot Completeness:** Include wall order, RNG seed, replacement draws, and any random tie-breaks.
- **Replay Integrity:** Log enough to reconstruct the exact game (not just event list).

### 6.6 Multiplayer Stalling Controls

> **STATUS: ⚠️ PARTIALLY IMPLEMENTED**
>
> **Implemented:**
>
> - ✅ Bot takeover after 3 minutes of inactivity
> - ✅ `bot_seats` tracking in `Room` for takeover
> - ✅ Reconnection handling exists
>
> **Missing:**
>
> - ❌ No explicit pause/resume commands for host
> - ❌ No explicit forfeit command with reason
>
> **Location**: `crates/mahjong_server/src/network/room.rs`

**Goal:** Avoid indefinite stalls when timers are passive.

- **Host Controls:** Pause/resume, forfeit, or bot-takeover actions.
- **Reconnect Policy:** Timeouts, grace periods, and rejoin rules.

### 6.7 Completion Split: "Should Already Be Done" vs. "Gap Features"

> **STATUS SUMMARY (2026-01-09):**
>
> **Baseline Rules Parity - MOSTLY COMPLETE:**
>
> - ✅ Call Priority + Adjudication - **DONE** (see 6.2)
> - ✅ Scoring + Settlement - **DONE** (see 6.4)
> - ✅ Ruleset Metadata - **DONE** (see 6.1)
> - ⚠️ Joker Restrictions - **PARTIAL** (commands exist, pattern limits missing - see 6.3)
> - ✅ Courtesy Pass Negotiation - **DONE** (verified in `handlers/charleston.rs`)
> - ✅ Timer Behavior - **DONE** (see 6.1, Section 3)
> - ✅ Deterministic Replay Inputs - **DONE** (see 6.5)
>
> **Gap Features - IN PROGRESS:**
>
> - ❌ Smart Undo (Practice Mode) - NOT STARTED (see Section 1)
> - ⚠️ Always-On Analyst - PARTIAL (see Section 2)
> - ❌ Hint System - NOT STARTED (see Section 2.5)
> - ⚠️ Pattern Viability / Dead Hand visualization - PARTIAL (see Section 4)
> - ⚠️ Enhanced Logging - MIXED (replay done, AI comparison not started - see Section 5)
> - ❌ Defensive Play Analysis - NOT STARTED (see Section 7.1)
> - ❌ Practice Auto-Play - NOT STARTED (see Section 7.2)
> - ❌ Pattern Filters - NOT STARTED (see Section 7.3)

**Goal:** Separate baseline rules parity work (already discussed, should exist) from new parity gap features.

**Should Already Be Done (Baseline Rules Parity):**

- **Call Priority + Adjudication:** Resolve simultaneous calls; Mahjong > Pung/Kong/Quint; seat-order tie-breaks.
- **Scoring + Settlement:** Pattern scoring, win type modifiers, dealer rotation, no-winner resolution.
- **Ruleset Metadata:** Card year, joker restrictions, house-rule flags stored in `Room` and replay logs.
- **Joker Restrictions:** Pattern-specific joker limits; no jokers in pairs unless allowed.
- **Courtesy Pass Negotiation:** Full negotiation flow for 0-3 tiles.
- **Timer Behavior:** Use `HouseRules` for timer configuration; passive vs enforced options.
- **Deterministic Replay Inputs:** Persist wall order/seed, break point, and replacement draws.

**Gap Features (Parity Additions):**

- Smart Undo (Practice Mode)
- Always-On Analyst + Hint System
- Pattern Viability / Dead Hand visualization
- Enhanced Logging + Replay UX features
- Defensive Play Analysis, Practice Auto-Play, Pattern Filters

---

## 7. Additional Features to Consider

> **IMPLEMENTATION STATUS (2026-01-09): ❌ NOT IMPLEMENTED**
>
> All features in this section (7.1, 7.2, 7.3) are future enhancements and have not been started.

### 7.1 Defensive Play Analysis

> **STATUS: ❌ NOT IMPLEMENTED** - Specification only

**Goal:** Help players identify when their discards might be dangerous (could complete an opponent's hand).

**How It Works:**

- Always-On Analyst tracks not just the current player's hand, but also:
  - What patterns opponents _might_ be pursuing (based on their discards and exposed melds)
  - Which tiles are "hot" (likely to be called by opponents)
- When a player is about to discard, show a risk indicator:
  - **Safe (Green):** Low probability of being called
  - **Risky (Yellow):** Moderate probability (opponent might need this)
  - **Dangerous (Red):** High probability (opponent is 1 tile away and this could win for them)

**Privacy Concerns:**

- This doesn't reveal opponents' concealed hands, only statistical likelihood based on public information
- Similar to experienced players' mental tracking

**Frontend Impact:**

- Tile highlight in hand: Color border based on discard safety
- Confirmation dialog: "This tile is dangerous - are you sure?"

### 7.2 Practice Mode Auto-Play

> **STATUS: ❌ NOT IMPLEMENTED** - Specification only

**Goal:** Let AI temporarily "take over" for a player during practice, then hand control back.

**Use Cases:**

- "Show me what you would do" - Watch AI play a few turns, then resume
- "I'm stuck, help me" - AI plays until hand improves, then player resumes
- "Fast-forward through Charleston" - AI handles passes, player takes over for main game

**Implementation:**

- New command: `GameCommand::EnableAIAssist { duration: Option<u32> }` // # of turns, or until player resumes
- Server switches player to "AI-controlled" mode temporarily
- UI shows "AI is playing..." overlay with "Resume Control" button

### 7.3 Pattern Recommendation Filters

> **STATUS: ❌ NOT IMPLEMENTED** - Specification only

**Goal:** Allow players to focus on specific types of patterns based on their strategy.

**Filter Options:**

- **By Section:** 2025, Consecutive, Quints, etc.
- **By Concealment:** Only concealed patterns, only exposed patterns, or both
- **By Score:** Only high-value patterns (50+ points)
- **By Joker Restrictions:** Only patterns that allow jokers, or no-joker patterns

**Frontend Impact:**

- Card Viewer: Add filter dropdown/checkboxes
- Analysis updates respect filters (only analyze filtered subset)
- Performance benefit: Fewer patterns to check = faster analysis

---

## 8. Revised Implementation Checklist

### Phase 0: Baseline Rules Parity (Must Be Complete Before Gap Features)

> **PHASE STATUS (2026-01-09): ⚠️ NEARLY COMPLETE (6/7 done, 1 partial)**

**Priority:** CRITICAL - Already discussed, required before UI integration

- [x] **Call Priority + Adjudication**: Enforce Mahjong > Pung/Kong/Quint with seat-order tie-breaks ✅ **DONE** (see 6.2)
- [x] **Scoring + Settlement**: Calculate points, apply payouts, handle no-winner resolution, rotate dealer ✅ **DONE** (see 6.4)
- [x] **Ruleset Metadata**: Persist card year + house-rule flags in `Room` and replay logs ✅ **DONE** (see 6.1)
- [ ] **Joker Restrictions**: Add pattern-specific limits and pair restrictions to validation ⚠️ **PARTIAL** (commands exist, pattern limits missing - see 6.3)
- [x] **Courtesy Pass Negotiation**: Implement the full 0-3 negotiation flow ✅ **DONE** (verified in `handlers/charleston.rs`)
- [x] **Timer Behavior**: Use `HouseRules` for call window + Charleston timing; allow passive/enforced modes ✅ **DONE** (see 6.1, Section 3)
- [x] **Deterministic Replay Inputs**: Persist wall order/seed, break point, and replacement draws ✅ **DONE** (see 6.5)

**Phase 0 Implementation Plan (by crate):**

**`crates/mahjong_core`**

- **Call Priority + Adjudication**
  - Add a call-resolution policy to `TurnStage::CallWindow` (priority + seat-order tie-breaks).
  - Buffer multiple call intents and resolve deterministically instead of first-come-first-served.
- **Scoring + Settlement**
  - Extend `GameResult` with points/payouts and dealer-rotation metadata.
  - Add scoring logic in `apply_declare_mahjong` and a no-winner resolution path.
- **Ruleset Metadata**
  - Extend `HouseRules` to include card year, joker limits, optional rule flags.
  - Store the active ruleset in `Table` and include in `GameStateSnapshot`.
- **Joker Restrictions**
  - Add joker-limit metadata to `UnifiedCard` (pattern/variation level).
  - Update `HandValidator` to enforce joker limits and pair restrictions.
- **Courtesy Pass Negotiation**
  - Implement `GameCommand::ProposeCourtesyPass` and explicit accept/confirm flow.
- **Timer Behavior**
  - Use `HouseRules.call_window_seconds` and `HouseRules.charleston_timer_seconds` in `TurnStage`.
  - Add a ruleset flag for passive vs enforced timers.
- **Deterministic Replay Inputs**
  - Persist wall order/seed + break point in state snapshots.
  - Track replacement draws for Kongs/Quints in state.

**`crates/mahjong_server`**

- **Ruleset Persistence**
  - Store ruleset metadata (card year + house rules) with game records and snapshots.
- **Replay Determinism**
  - Persist wall order/seed + break point + replacement draws in replay events or snapshots.
  - Update replay reconstruction to use wall state instead of seed=0.
- **Call Adjudication**
  - Ensure server accepts buffered call intents and waits for resolution event.

**`crates/mahjong_ai`**

- **Ruleset Awareness**
  - Consume joker restrictions from core (avoid proposing invalid calls).
  - Respect passive/enforced timers in bot decision loops.

### Tests (core + server)

- Call priority resolution and tie-break cases.
- Joker restriction enforcement (per-pattern limits + no-joker pairs).
- Courtesy pass negotiation paths (0-3 tiles, mismatched proposals).
- Deterministic replay reconstruction (wall order + replacement draws).

### Phase 1: Core Refactoring (MVP Foundation)

**Priority:** HIGH - Required for all other features

- [ ] **Move `StrategicEvaluation`**: Move from `mahjong_ai` to `mahjong_core/src/analysis.rs` to prevent circular deps
  - Ensure no heavy AI logic comes with it (keep core pure)
  - Update imports in `mahjong_ai` and `mahjong_server`
- [ ] **Always-On Analysis Loop**: Modify `mahjong_server` to run analysis after state changes
  - Add `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` to `Room`
  - Trigger analysis after: TilesDealt, DrawTile, DiscardTile events
  - Profile performance (target: <50ms avg)
- [ ] **Passive Timers**: Strip timer-based force-move logic from `mahjong_server`
  - Keep timer metadata for UI display only
  - Update state machine to wait indefinitely for player actions
  - Add AFK detection (bot takeover after 3 min inactivity)
- [ ] **Game Activity Log**: Add `game_log: Vec<GameEvent>` to `Room`
  - Append every broadcasted event
  - Expose via reconnect/refresh API
- [ ] **Ruleset Snapshot & Validation**: Persist ruleset config in `Room`
  - Validate all moves against per-game ruleset
  - Store ruleset metadata in replay log
- [ ] **Call Priority & Illegal-Move Handling**: Resolve simultaneous calls server-side
  - Mahjong > Pung/Kong/Quint, seat-order tie-breaks
  - Reject invalid claims/discards with explicit errors
- [ ] **Joker Rules & Replacement Draws**: Encode joker restrictions and swap logic
  - Pattern-specific joker limits, joker swaps from exposed melds
  - Replacement draws for Kongs/Quints as per ruleset
- [ ] **Scoring & Settlement**: Implement authoritative end-of-hand resolution
  - Pattern validation, scoring, payouts, dealer rotation
- [ ] **Deterministic State Capture**: Log wall order + RNG for undo/replay
  - Ensure undo and replay can reproduce exact state

**Estimated Effort:** 2-3 weeks

### Phase 2: Smart Undo & Pattern Viability (Practice Mode Enhancements)

**Priority:** MEDIUM-HIGH - Key UX improvements for solo play

- [ ] **History Stack**: Implement `history: Vec<(GamePhase, Table)>` in `Room`
  - Snapshot at: TurnStage::Drawing, CallWindow, CharlestonStage transitions
  - Bounded history (last 20 states)
  - Clear history on phase transitions
- [ ] **Undo Logic**: Implement "rewind to last decision point" algorithm
  - Add `GameCommand::Undo` and `GameEvent::StateRestored`
  - Practice Mode only (disable in multiplayer)
  - Handle edge cases (empty stack, AI log invalidation)
- [ ] **Pattern Viability Calculation**: Enhance `StrategicEvaluation` with tile tracking
  - Implement `is_pattern_viable()` (check if required tiles are exhausted)
  - Add difficulty classification (Easy/Medium/Hard/Impossible)
  - Include viability data in analysis updates to client
- [ ] **Frontend: Undo Button**: Add UI for undo in Practice Mode
  - Keyboard shortcut: Ctrl+Z / Cmd+Z
  - Visual feedback on state restoration
- [ ] **Frontend: Card Viewer Enhancements**: Visualize pattern viability
  - Gray out impossible patterns
  - Color-code by difficulty (green/yellow/orange)
  - Add filters and sorting options

**Estimated Effort:** 3-4 weeks

### Phase 3: Hint System & Analysis Optimization (Player Assistance)

**Priority:** MEDIUM - Improves accessibility and learning curve

- [ ] **Hint Data Structure**: Define `HintData` struct with recommended actions
  - Recommended discard
  - Best patterns to pursue
  - Tiles needed for win
  - Distance to win
- [ ] **Hint Generation**: Use Always-On Analyst to generate hints
  - Skill level tuning (Beginner/Intermediate/Expert modes)
  - Progressive disclosure based on settings
- [ ] **Bandwidth Optimization**: Implement delta compression for analysis updates
  - Client-side caching of last analysis
  - Send full analysis on turn start or >30% change
  - Send delta updates for 1-30% change
  - Concrete thresholds and throttling
- [ ] **Performance Optimization**: Optimize analysis frequency
  - Consider lazy evaluation (only on player's turn)
  - Incremental analysis (cache and update deltas)
  - Parallel processing (multi-threading for 4 hands)
- [ ] **Frontend: Hint Panel**: Add toggleable hint UI
  - "Recommended discard" indicator
  - "Best pattern" suggestions
  - Win proximity badge (color-coded by distance)

**Estimated Effort:** 2-3 weeks

### Phase 4: Logging & Replay (Advanced Features)

**Priority:** LOW-MEDIUM - Nice-to-have for debugging and post-game analysis

- [ ] **AI Comparison Log**: Implement multi-engine analysis logging
  - `AnalysisLogEntry` structure
  - Debug mode: Run multiple AI strategies per turn
  - Expose via debug endpoint (not broadcast to clients)
- [ ] **Replay Storage**: Store complete game replays
  - `GameReplay` struct with full event log
  - Database persistence (30-day retention)
  - Privacy controls (public/private replays)
- [ ] **Statistical Tracking**: Collect long-term player statistics
  - `PlayerStats` struct (win rate, pattern usage, etc.)
  - Real-time for basic stats, batch for complex analysis
- [ ] **Frontend: Replay Viewer**: Build post-game replay UI
  - Timeline scrubber, play/pause controls
  - Player perspective filtering
  - Analysis overlay (if available)
- [ ] **Frontend: Statistics Dashboard**: Display player stats
  - Win rate charts, pattern popularity graphs
  - Recent game history, personal bests

**Estimated Effort:** 4-5 weeks

### Phase 5: Advanced Assistance (Optional Enhancements)

**Priority:** LOW - Future considerations, not MVP

- [ ] **Defensive Play Analysis**: Show discard safety indicators
  - Risk assessment (Safe/Risky/Dangerous)
  - Confirmation for dangerous discards
- [ ] **Practice Mode Auto-Play**: AI takeover feature
  - "Show me what you would do" mode
  - Temporary AI control with resume button
- [ ] **Pattern Filters**: Let players focus on pattern subsets
  - Filter by section, concealment, score, joker usage
  - Reduce analysis overhead by checking fewer patterns

**Estimated Effort:** 2-3 weeks

---

## 9. Success Metrics & Testing Strategy

### Success Metrics

#### Feature 1: Smart Undo

- [ ] Undo successfully rewinds to player's last decision point (100% accuracy in tests)
- [ ] Undo only available in Practice Mode (multiplayer games reject undo commands)
- [ ] History stack stays within memory budget (<50KB per room)
- [ ] User feedback: "Undo made practice mode much more enjoyable" (qualitative)

#### Feature 2: Always-On Analyst

- [ ] Analysis completes in <50ms average (90th percentile <100ms)
- [ ] Bots use pre-calculated analysis (no redundant computation)
- [ ] Analysis updates sent efficiently (bandwidth <5KB per update)
- [ ] Pattern viability calculation 100% accurate (no false positives/negatives)

#### Feature 3: Passive Timers

- [ ] Timers never force-skip player actions in Practice Mode
- [ ] AFK detection triggers bot takeover after 3 minutes
- [ ] UI shows timer expiration without blocking actions
- [ ] User feedback: "Timers feel less stressful" (qualitative)

#### Feature 4: Pattern Viability

- [ ] "Dead" patterns correctly identified based on visible tiles
- [ ] Card Viewer updates in real-time as patterns become impossible
- [ ] Difficulty classification correlates with actual win probability
- [ ] User feedback: "Card tracking helped me avoid dead ends" (qualitative)

#### Feature 5: Replay & Logging

- [ ] Full game replay available within 1 second of game end
- [ ] Replays playable from any turn (forward/backward navigation works)
- [ ] Player perspective filtering preserves privacy (no concealed hand leaks)
- [ ] Statistics dashboard loads in <2 seconds

### Testing Strategy

**Unit Tests:**

- `is_pattern_viable()` function (test all edge cases: joker limits, suit exhaustion)
- Undo logic (test empty stack, invalid requests, state corruption)
- Hint generation (test all skill levels produce different hints)
- Delta compression (test bandwidth savings vs. full updates)

**Integration Tests:**

- Full game with Always-On Analyst enabled (verify analysis updates at every state change)
- Undo in Charleston phase vs. main game (different snapshot logic)
- Replay reconstruction from event log (verify deterministic playback)
- Multi-engine AI comparison (verify all strategies run correctly)
- Call priority resolution (simultaneous calls, seat-order tie-breaks)
- Joker swap/replacement draw flows
- Scoring/settlement correctness for common win types

**Performance Tests:**

- Analysis benchmark: 1000 hands × 500 patterns (target: <50ms avg)
- Memory stress test: 100 concurrent rooms with full history (target: <5MB per room)
- Bandwidth test: Measure delta vs. full updates over 100-turn game

**User Acceptance Tests:**

- Practice Mode playthrough with undo (qualitative: "Does undo feel natural?")
- Pattern viability visual feedback (qualitative: "Is the Card Viewer helpful?")
- Hint system usability (quantitative: "Do beginners win more often with hints?")

---

## 10. Open Questions Summary

Consolidating all questions from above for easy reference:

1. **Smart Undo:**
   - How many undo steps? (Recommendation: Single undo for MVP, bounded later)
   - Allow undo during Charleston? (Recommendation: Yes, common pain point)
   - Confirmation dialog for undo? (Question: Free undo vs. confirm destructive actions?)

2. **Always-On Analyst:**
   - Background worker thread for analysis? (Question: Avoid blocking game loop?)
   - Analysis updates automatic or on-request? (Question: Push vs. pull model?)
   - Hints toggle-able mid-game? (Question: Lock at game start vs. runtime toggle?)

3. **Passive Timers:**
   - Passive timers in multiplayer too? (Recommendation: Practice Mode only; multiplayer optional)
   - Audio countdown as timer expires? (Question: Beep/pulse vs. silent?)

4. **Pattern Viability:**
   - Difficulty calculation server-side or client-side? (Recommendation: Server-side for Hint reuse)

5. **Replay & Logging:**
   - Store replays in database or JSON files? (Recommendation: DB for active, JSON for archival)
   - Stats real-time or batch? (Recommendation: Real-time basic, batch complex)

6. **Core Rules & Determinism:**
   - Which ruleset strictness? (Strict NMJL vs. relaxed/house rules)
   - Deterministic replay requirement? (Do we need exact wall order/RNG capture?)
   - Call priority tie-breaks? (Seat order vs. other resolution rules)
   - Scoring model and settlement? (Points vs. chips; dealer rotation rules)

7. **Performance:**
   - Acceptable latency for analysis? (Proposed: <50ms avg, <100ms p90)
   - Delta compression thresholds? (Proposed: >30% = full, 1-30% = delta, <1% = skip)

**Next Steps:** Review these questions, make decisions, and update this document before implementation begins.
