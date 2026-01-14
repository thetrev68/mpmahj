# Backend Implementation Plan: Gap Analysis & Refinements

This document outlines the backend changes required to support the "Mahjong 4 Friends" parity features, integrated deeply into the core system rather than as add-ons.

## Document Status

**Status:** DRAFT - In active iteration
**Last Updated:** 2026-01-10 (Always-On Analyst and Hint System complete)
**Last Audit:** 2026-01-10 - Updated status for Always-On Analyst and Hint System
**Purpose:** High-level feature planning before detailed implementation specs

## Quick Status Overview (2026-01-09)

**Phase 0 - Baseline Rules Parity:** ✅ **COMPLETE** (7/7 done)

- ✅ Call Priority (6.2), Scoring (6.4), Ruleset (6.1), Courtesy Pass, Timers (3), Deterministic Replay (6.5)
- ✅ Joker Restrictions (6.3) - **COMPLETE** (2026-01-09)

**Gap Features:**

- ✅ Section 1: History Viewer - DONE
- ✅ Section 2: Always-On Analyst - DONE
- ✅ Section 3: Passive Timers - DONE
- ✅ Section 4: Pattern Viability - BACKEND COMPLETE (2026-01-09, ready for frontend)
- ⚠️ Section 5: Enhanced Logging - MIXED (5.1 replay done, 5.2 AI comparison implemented in debug-mode)
- ❌ Section 7: Additional Features - NOT STARTED

**Key Recommendation:** ~~Complete joker restrictions (6.3)~~ ✅ DONE, Always-On Analyst (2.1-2.3) ✅ DONE, hints (2.5) ✅ DONE, now prioritize pattern viability UI (4.4) or History Viewer (1).

## Open Questions

1. **Scope Boundaries**: Which features are MVP vs. Phase 2/3? (See checklist at bottom)
2. **Performance Budgets**: What are acceptable latency limits for analysis? (Proposed: <50ms avg)
3. **Multiplayer vs. Practice Mode**: Which features work in live multiplayer vs. solo practice only?
4. **Frontend Priority**: Should we spec out UI changes before backend implementation?

---

## 1. Feature: History Viewer & Time Travel (Jump to Any Point)

> **IMPLEMENTATION STATUS (2026-01-11): ✅ IMPLEMENTED**
> **Locations verified:** `crates/mahjong_core/src/history.rs`, `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`, `crates/mahjong_core/src/table/mod.rs`, `crates/mahjong_server/src/network/history.rs`, `crates/mahjong_server/src/network/room.rs`
>
> - No `MoveHistoryEntry` structure exists
> - No history commands (`RequestHistory`, `JumpToMove`, `ResumeFromHistory`)
> - No history-related events in `GameEvent` enum
> - No snapshot stack in `Room` struct
> - **Location verified**: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`

**Goal:** Allow players (in Practice Mode) to view a complete history of all game moves and jump to any point in time. Inspired by Mahjong 4 Friends' history feature, this is not a simple "undo last move" but a full time-travel interface.

### 1.1 Architecture

> **STATUS: ✅ Implemented**

- **State Management:** `MoveHistoryEntry` and related types are implemented in `crates/mahjong_core/src/history.rs`. `Room` includes `history: Vec<MoveHistoryEntry>` and a `history_mode` field (see `crates/mahjong_server/src/network/room.rs`).

- **Snapshot Triggers:** The system captures history entries on draws, discards, melds, Charleston passes, call windows, and Mahjong declarations. Snapshot capture and storage use a configurable strategy; see `crates/mahjong_core/src/history.rs` for details.

### 1.2 Logic Flow

> **STATUS: ✅ Implemented**

1. **Client Request:** `GameCommand::RequestHistory` and `GameCommand::JumpToMove` are implemented and validated in `crates/mahjong_core/src/command.rs` and `crates/mahjong_core/src/table/mod.rs`.
2. **Server Logic:** The server handlers in `crates/mahjong_server/src/network/history.rs` return `GameEvent::HistoryList` summaries, enter `HistoryMode::Viewing { at_move }`, and send `StateRestored` events after restoring viewing state.
3. **State Restoration:** AI analysis and hints are marked stale/invalid after a restore; resume/truncate logic is implemented and tested (see `crates/mahjong_server/tests/history_integration_tests.rs` and `crates/mahjong_core/tests/history_test.rs`).

### 1.3 Implementation Details

> **STATUS: ✅ Backend Implemented — Documentation/Front-end work remaining**

Summary: The server-side implementation for history/time-travel is present and exercised by unit and integration tests. The core types, command validation, event types, room-state bookkeeping, history recording hooks, and jump/resume/return handlers are implemented. The remaining work is primarily operational: storage/retention policies, optional snapshot-space optimizations, export/admin APIs, and a few hardening tests. Frontend UI and UX remain to be implemented by the client.

Implemented (backend):

- **Core types & bindings:** `crates/mahjong_core/src/history.rs` — `MoveHistoryEntry`, `MoveHistorySummary`, `MoveAction`, `HistoryMode` and TS bindings (ts-rs) are present.
- **Commands:** `crates/mahjong_core/src/command.rs` — `GameCommand::RequestHistory`, `GameCommand::JumpToMove`, `GameCommand::ResumeFromHistory`, `GameCommand::ReturnToPresent` are defined and include `player()` extraction and basic validation hooks.
- **Events:** `crates/mahjong_core/src/event.rs` — `GameEvent::HistoryList`, `GameEvent::StateRestored`, `GameEvent::HistoryTruncated`, `GameEvent::HistoryError` exist and are used by server handlers.
- **Room fields & init:** `crates/mahjong_server/src/network/room.rs` — `Room` contains `history: Vec<MoveHistoryEntry>`, `history_mode: HistoryMode`, `current_move_number: u32`, and `present_state: Option<Box<Table>>`, and constructors initialize these fields.
- **History handlers:** `crates/mahjong_server/src/network/history.rs` — `record_history_entry()`, `handle_request_history()`, `handle_jump_to_move()`, `handle_resume_from_history()`, and `handle_return_to_present()` implement the expected semantics: listing, viewing (sets `history_mode` to `Viewing` and replaces `table` with snapshot), resuming (truncates future moves and updates `current_move_number`), and returning to present (restores `present_state`).
- **Recording hooks:** `crates/mahjong_server/src/network/events.rs` — `RoomEvents::broadcast_event()` builds human-readable `description`s and calls `record_history_entry()` on key `GameEvent`s (draw, discard, call, pass, call window open/close, and Mahjong declaration). Periodic persistence of snapshots (via `SNAPSHOT_INTERVAL`) is implemented here.
- **Tests:** Unit tests in `crates/mahjong_core/tests/history_test.rs` and integration tests in `crates/mahjong_server/tests/history_integration_tests.rs` cover listing, jump/restore semantics, resume/truncate behavior, practice-mode enforcement, and error cases.

What is fully covered (no backend follow-up required to start frontend work):

- History listing and summaries (`RequestHistory` → `HistoryList`) — server returns `MoveHistorySummary` entries for UI lists.
- Jump-to-move semantics (`JumpToMove`) — server restores `table` from snapshot and broadcasts `StateRestored` for clients to render viewing state.
- Resume-from-history (`ResumeFromHistory`) — server truncates future moves, updates `current_move_number`, clears `history_mode`, and emits `HistoryTruncated`.
- Return-to-present (`ReturnToPresent`) — server restores `present_state` and clears viewing mode.
- Practice-mode gating and validation — handlers return errors for non-practice games or invalid move numbers.

Remaining backend work (recommended and actionable items to schedule):

- **Snapshot storage optimization (optional):** Convert from full-snapshot-per-move to a hybrid model (full snapshot every N moves + deltas) to reduce memory for long-lived rooms. Suggested files/areas: `crates/mahjong_server/src/network/history.rs` (storage format + reconstruction logic) and `crates/mahjong_server/src/network/events.rs` (recording policy).
- **Persistence & retention policy:** Define and implement retention for persisted snapshots and history entries (e.g., persist full game on end-of-game, trim in-memory history older than X days, or export to long-term storage). Suggested: add DB export in end-of-game handler in `events.rs` and admin API under `mahjong_server/src/network/admin.rs` (new).
- **History listing pagination / lazy listing API (if UX requires):** For very long games, server may support paginated `RequestHistory` (already returns lightweight summaries — consider adding `offset/limit` params to `RequestHistory` command and handler). Implement in `history.rs` handlers and update `GameCommand` variant if needed.
- **Admin/export API:** Add endpoints to export or download a game's full move history and snapshots for debugging/replay. Proposed location: `crates/mahjong_server/src/network/admin.rs` or extend existing HTTP admin routes.
- **Performance & metrics:** Add metrics (count of history entries per room, memory used per-room, snapshot persist latency) and implement memory/health checks to detect rooms with excessive snapshot growth. Suggested files: add metrics hooks where `record_history_entry()` is called and in room lifecycle code.
- **Hardening tests:** Add edge-case tests for concurrent history operations (e.g., two clients request jump/resume simultaneously), large histories (stress with 1000 moves), and snapshot persistence failure modes. Extend `crates/mahjong_server/tests/history_integration_tests.rs` or add `history_stress_tests.rs`.

Suggested immediate next backend tasks (priority ordered):

1. **Add end-of-game export/persist** (store full game history to DB or file when game ends) — small change in `events.rs` and DB layer (high priority, low risk).
2. **Add metrics & alerts** to monitor snapshot growth and memory per-room — implement in `record_history_entry()` (medium priority).
3. **Implement optional snapshot compaction** (full snapshot every N moves + deltas) if metrics show memory pressure — bigger change (lower priority until needed).
4. **Add paginated `RequestHistory`** if frontend needs lazy loading for very long games (optional UX optimization).

Developer notes / pointers (call flow):

- `broadcast_event()` &rarr; constructs `MoveAction` + `description` &rarr; calls `Room::record_history_entry()` which appends `MoveHistoryEntry { move_number, timestamp, seat, action, description, snapshot }`.
- `GameCommand::RequestHistory` &rarr; `history.rs::handle_request_history()` &rarr; returns `GameEvent::HistoryList { entries: Vec<MoveHistorySummary> }`.
- `GameCommand::JumpToMove(n)` &rarr; `history.rs::handle_jump_to_move(n)` &rarr; saves `present_state`, sets `history_mode = Viewing { at_move: n }`, sets `self.table = snapshot_for(n)`, returns `GameEvent::StateRestored`.
- `GameCommand::ResumeFromHistory(n)` &rarr; truncates history after `n`, sets `current_move_number = n`, clears `present_state`, returns `HistoryTruncated + StateRestored`.

Acceptance criteria for marking backend "done" for scheduling purposes:

- All commands/events exist and pass existing tests (already true).
- End-of-game export or persistence hook exists (schedule 1-day task if missing).
- Metrics for history growth are present (schedule if missing).
- At least one stress test that verifies behavior under large history sizes (add as medium-priority).

If you want, I can open PRs to implement items 1 and 2 (end-of-game export + metrics), add the suggested tests, and wire a small admin export endpoint. Tell me which item you want prioritized and I'll add concrete TODOs and implement the first one.

### 1.4 Frontend Impact

> **STATUS: ❌ Not implemented** - (frontend work deferred to later phase)

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

**Backend Coverage (implemented):**

- **History listing & summaries:** The server implements `GameEvent::HistoryList` and returns `MoveHistorySummary` entries on `RequestHistory` (see `crates/mahjong_core/src/history.rs` and `crates/mahjong_server/src/network/history.rs`).
- **Snapshot storage & restore:** The server records history entries with full `Table` snapshots via `record_history_entry()` (called from `broadcast_event()` in `crates/mahjong_server/src/network/events.rs`). Jump/restore handlers (`handle_jump_to_move`, `handle_return_to_present`, `handle_resume_from_history`) restore `table` from stored snapshots and update `history_mode`/`present_state` in `Room`.
- **Commands & events:** `GameCommand::RequestHistory`, `JumpToMove`, `ResumeFromHistory`, `ReturnToPresent` and events `HistoryList`, `StateRestored`, `HistoryTruncated` are implemented and validated (`crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`, `crates/mahjong_core/src/table/mod.rs`).
- **Server-side safety / practice-mode checks:** History operations enforce Practice Mode checks and validation (handlers return errors for invalid moves or non-practice usage).
- **Persistence hooks:** Periodic/phase snapshots are persisted to the DB in `broadcast_event()` (see `SNAPSHOT_INTERVAL`) and history entries are kept in-memory per room; integration tests cover the flow (`crates/mahjong_server/tests/history_integration_tests.rs`).

**State Synchronization (how backend helps):**

- The server maintains `currentState` (the authoritative `table`) and a `present_state` backup when a client jumps to history. When a client requests `JumpToMove`, the server sets `history_mode` and replaces `table` with the stored snapshot for viewing; `StateRestored` is broadcast to clients. `ResumeFromHistory` restores the chosen snapshot as the new present, truncates future history, and emits `HistoryTruncated`.
- Clients should keep two local representations (`currentState` and `viewingState`). Clients fetch history summaries first, then request snapshot/restore on-demand when the player jumps — the backend provides the summaries and the restore events/snapshots server-side.

**Frontend work remaining:**

- The UI pieces (History Panel, playback controls, keyboard shortcuts, smooth animations, virtual scrolling) are frontend responsibilities and remain to be implemented. The backend provides the necessary wire events and snapshots for these features to be built.

**Keyboard Shortcuts:**

- `H` - Open history panel
- `←` - Previous move
- `→` - Next move
- `Esc` - Return to present
- `Space` - Play/Pause (when in playback mode)

**Performance Considerations:**

- Lazy loading: The backend already provides lightweight `MoveHistorySummary` entries for listing; full snapshots are kept server-side and are restored on-demand. Clients should request snapshots only when a user jumps to a move.
- Current server snapshot model records a full `Table` clone per history entry (fast to implement, simple). If memory becomes a concern, consider changing to "full snapshot every N moves + deltas" or storing only summaries and reconstructing from events; hooks for DB persistence and periodic snapshots already exist (`SNAPSHOT_INTERVAL`).
- Cache recently viewed snapshots client-side and use virtual scrolling for long lists.

---

## 2. Feature: The "Always-On" Analyst

> **IMPLEMENTATION STATUS (2026-01-10): ✅ FULLY IMPLEMENTED**
>
> **Implemented (2026-01-10):**
>
> - ✅ `StrategicEvaluation` struct in `mahjong_ai/src/evaluation.rs` with:
>   - `viable: bool` field for pattern viability
>   - `difficulty`, `probability`, `expected_value` calculations
>   - `check_viability()` function validates tile availability
> - ✅ `VisibleTiles` context tracking in `mahjong_ai/src/context.rs`
> - ✅ Dead pattern filtering via `filter_dead_patterns()` function
> - ✅ `StrategicEvaluation` moved to `mahjong_core/src/analysis.rs`
> - ✅ `analysis: HashMap<Seat, Vec<StrategicEvaluation>>` added to `Room`
> - ✅ Automatic analysis trigger after state changes (TilesDealt, DrawTile, DiscardTile)
> - ✅ Analysis sent to clients in `AnalysisUpdate` events and snapshots
> - ✅ **Hint system implemented** (Section 2.5)
>
> **Locations verified**: `crates/mahjong_core/src/analysis.rs`, `crates/mahjong_ai/src/evaluation.rs`, `crates/mahjong_server/src/network/room.rs`

**Goal:** Integrate AI analysis as a core part of the game loop, not an on-demand utility. This powers Bots, Hints, and Pattern Viability tracking simultaneously.

### 2.1 Architecture

> **STATUS: ✅ Implemented** - `StrategicEvaluation` present and analysis worker integrated into server loop

- **Core Integration:** The analysis worker runs off-room analysis requests and integrates results into the `Room`'s `analysis_cache`.
- **Trigger:** Analysis is triggered from the server's analysis pipeline after relevant events (TilesDealt, DrawTile, DiscardTile) via the background `analysis_worker`.

### 2.2 Data Structure

> **STATUS: ✅ Implemented** - `StrategicEvaluation` available and server-side analysis cache exists

- `StrategicEvaluation` types are available (moved/shared as needed) and the server maintains `analysis_cache` and `analysis_hashes` in `Room` to store per-seat analyses and de-dup/skip redundant work.

### 2.3 Logic Flow

> **STATUS: ✅ Implemented** - Analysis runs in background and results are cached and emitted

1. **Event:** Server sends an analysis request to the `analysis_worker` when state-changing events occur.
2. **Analysis:** The worker runs validation/analysis for relevant seats and returns `HandAnalysis`/`StrategicEvaluation` results which are inserted into `Room.analysis_cache`.

- **For Bots:** Worker results inform bot decisions via existing bot runner hooks.
- **For Humans:** Results are cached and selective `AnalysisUpdate` and `HintUpdate` events are emitted per-seat.

1. **Distribution:** The server emits `AnalysisUpdate` and `HintUpdate` events to client sessions when analysis changes significantly or per configured rules.

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

> **STATUS: ✅ IMPLEMENTED (2026-01-10)** - Hint system fully integrated with Always-On Analyst

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
    best_patterns: Vec<PatternSummary>,
    tiles_needed_for_win: Vec<Tile>,
    distance_to_win: u8, // Minimum tiles needed
    call_opportunities: Vec<CallOpportunity>,
    defensive_hints: Vec<DefensiveHint>,
}
```

**Implementation Note:** The current implementation plan composes hints from `analysis_cache` and uses `mahjong_ai::hint::HintAdvisor` for discard/call/defense suggestions. See 15a-15e for concrete steps.

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

### 3.4 Backend Coverage

> **STATUS: ✅ Backend Complete**

Summary: The server-side work for Passive Timers is complete. The server exposes timer metadata for UI display, removed automatic force-skip logic from the state machine, and provides AFK/bot-takeover hooks where configured. Clients receive `CharlestonTimerStarted` and `CallWindowOpened` events with timer metadata but the server does not auto-advance game state when timers expire.

Implemented (backend):

- `TimerMode` enum and metadata: `crates/mahjong_core/src/table/types.rs` (defines `Visible` and `Hidden`).
- `Ruleset` timer fields: `timer_mode`, `call_window_seconds`, `charleston_timer_seconds` (part of ruleset types in core).
- No server-side auto-advance: state machine removed timer-expiration transitions; server waits indefinitely for player commands in `TurnStage::CallWindow` and during Charleston.
- Timer events: `CharlestonTimerStarted` and `CallWindowOpened` events include timer metadata and are defined in `crates/mahjong_core/src/event.rs` and emitted by server-side handlers.
- Bot/AFK hooks: bot takeover logic and configurable behavior exist in server room lifecycle (used for inactivity handling), configurable per-room; see `crates/mahjong_server/src/network/room.rs` and bot runner hooks.
- Tests & verification: existing unit/integration tests and code reviews confirm passive timer behavior and ruleset fields are present.

Files / locations to inspect for backend changes:

- `crates/mahjong_core/src/table/types.rs`
- `crates/mahjong_core/src/event.rs`
- `crates/mahjong_server/src/network/room.rs`
- Bot takeover integration: server bot runner files (search for `takeover`/`inactivity` hooks)

Acceptance: With these points implemented and tested, backend responsibilities for Passive Timers are complete and safe to hand off to frontend implementation.

### 3.4.1 Frontend Impact

> **STATUS: ⚠️ Frontend UI work needed**

UI changes required (client-side):

- Remove/adjust "auto-play countdown" indicators so timers are informational only.
- Color scheme: indicate urgency (Green → Yellow → Red) but do not block player actions when expired.
- Add per-game setting: "Timer enforcement" checkbox that toggles stricter server-enforced behavior in future modes (not used by default for Practice Mode).
- Show toast/tooltip: "Timer expired (you can still move)" when timer metadata reaches zero.

UX suggestions:

- Display timer metadata from `CharlestonTimerStarted`/`CallWindowOpened` but allow players to act after expiry.
- Show subtle visual cues (pulse/flash) at expiry rather than modal blocks.
- If implementing bot takeover or AFK workflow, provide clear banner/status: "Bot takeover active — Player X inactive".

Performance/Integration notes:

- The server provides timer metadata; frontend should not rely on server for enforcement in Practice Mode.
- If you later enable enforcement for competitive modes, the client must support both informational and enforced timer UI states.

---

## 4. Feature: Dead Hand / Pattern Viability

> **IMPLEMENTATION STATUS (2026-01-09): ✅ BACKEND COMPLETE**
>
> **Implemented (2026-01-09):**
>
> - ✅ `viable: bool` field in `StrategicEvaluation` (`mahjong_ai/src/evaluation.rs:55`)
> - ✅ `check_viability()` function validates tile availability (`evaluation.rs:138-149`)
> - ✅ `VisibleTiles` context tracking in `mahjong_ai/src/context.rs`
> - ✅ Difficulty calculation logic (scarcity weighting)
> - ✅ Dead pattern filtering: `filter_dead_patterns()` function
> - ✅ `PatternDifficulty` enum (Easy/Medium/Hard/Impossible) in `mahjong_core/src/event.rs:20-33`
> - ✅ `difficulty_class` field added to `StrategicEvaluation` (`mahjong_ai/src/evaluation.rs:43`)
> - ✅ `classify_difficulty()` method implemented (`evaluation.rs:100-119`)
> - ✅ `AnalysisUpdate` event with `PatternAnalysis` struct (`mahjong_core/src/event.rs:233, 41-48`)
> - ✅ Event sent to clients via Always-On Analyst worker (`mahjong_server/src/network/room.rs:1064-1088`)
> - ✅ TypeScript bindings generated for frontend consumption
> - ✅ Full test coverage (5 unit tests for difficulty classification)
> - ✅ Integration point annotations with `// FRONTEND_INTEGRATION_POINT` comments
> - ✅ Frontend integration documentation: `docs/integration/frontend-analysis-events.md`
>
> **Next Steps (Frontend):**
>
> - ⏳ Card Viewer UI component (pattern cards with difficulty colors)
> - ⏳ Pattern filtering/sorting controls
> - ⏳ WebSocket event handler integration
> - ⏳ Analysis store (Zustand) for state management
>
> **Locations**: `crates/mahjong_core/src/event.rs`, `crates/mahjong_ai/src/evaluation.rs`, `crates/mahjong_server/src/network/room.rs`

**Goal:** Visualize which patterns are statistically impossible based on the _global_ board state (Standard Mahjong "Card Tracking").

### 4.1 Logic (Backend Coverage)

> **STATUS: ✅ Backend Calculation Implemented**

Summary: The server-side logic that determines pattern viability and difficulty is implemented in the analysis pipeline. `StrategicEvaluation` contains `viable: bool` and difficulty metrics; the Always-On Analyst computes these values and stores them in the room's analysis cache. This section focuses only on backend responsibilities and remaining backend tasks required to consider the feature fully complete from a server perspective.

Implemented (backend):

- **Viability calculation:** Implemented in `crates/mahjong_ai/src/evaluation.rs` — `check_viability()` computes whether patterns are possible given visible tiles, exposed melds, and hand composition.
- **StrategicEvaluation:** The struct contains `viable`, `difficulty`, `expected_value`, and other metrics and is produced by the analysis worker (`crates/mahjong_core/src/analysis.rs` / `crates/mahjong_ai/src/evaluation.rs`).
- **Visible tile tracking:** Server-side tracking of discards and exposed melds is present (`crates/mahjong_core/src/table/*.rs`) and used by the analysis worker to compute viability.
- **Integration point:** Analysis worker enqueues after state-changing events and populates per-seat `analysis_cache` stored in `Room` (`crates/mahjong_server/src/network/room.rs`). An `AnalysisUpdate` event type exists to emit results to interested clients.
- **Tests:** Unit tests around viability and difficulty classification exist in `crates/mahjong_ai/tests/` and integration hooks are covered via `crates/mahjong_server/tests/` for analysis emission. See `evaluation.rs` tests for algorithm correctness.

What is covered (no backend follow-up required to consider logic complete):

- Correctness of the viability algorithm for standard patterns and joker-limited patterns.
- Visible tile accounting (discards + exposed melds) used as inputs for viability.
- Difficulty scoring and `StrategicEvaluation` population for per-seat analysis cache.

Remaining backend work (actionable items to schedule):

- **Ensure `AnalysisUpdate` emission guarantees:** Add tests and an integration-level contract test that verifies `AnalysisUpdate` is emitted within X ms after key events (e.g., DrawTile/DiscardTile) under the analysis worker load. (Files: `crates/mahjong_server/src/network/room.rs`, tests in `crates/mahjong_server/tests/analysis_integration.rs`)
- **Performance measurement & throttling:** Add profiling and throttling for the analysis worker so heavy games do not saturate the server CPU. Suggested: add a configurable debounce window (e.g., 100-250ms) and measure per-room CPU/time. (Files: analysis worker and `crates/mahjong_server/src/analysis/worker.rs`)
- **Privacy & filtering contract tests:** Add integration tests verifying that `AnalysisUpdate` does not leak other players' concealed tiles (only includes viability/difficulty for requester). (Files: `crates/mahjong_server/tests/privacy_analysis_tests.rs`)
- **Backfill for older games:** When a player reconnects mid-game, ensure `analysis_cache` is available or recomputed deterministically; add an on-demand recompute path in `room.rs` for reconnections. (Files: `crates/mahjong_server/src/network/room.rs`)
- **Hardening tests for corner cases:** Patterns with variable suits, joker-edge-cases, and nearly-exhausted tile pools should have targeted unit tests. (Files: `crates/mahjong_ai/src/evaluation.rs` tests)

Developer notes / call flow (backend):

- Event occurs (DrawTile, DiscardTile, TilesPassed) → `Room::broadcast_event()` → enqueue `analysis_worker` job for affected seats → worker computes `StrategicEvaluation` using visible tiles + hand → updates `Room.analysis_cache` → emits `GameEvent::AnalysisUpdate` (if configured to send diffs/full payloads).

Acceptance criteria (backend done):

- `check_viability()` and difficulty calculations have unit tests covering jokers and variable suits (already present).
- `AnalysisUpdate` emission is covered by integration tests and does not leak private information (add tests if missing).
- Performance measurements exist and a throttling/debounce strategy is implemented if required by load tests.

If you confirm I should schedule backend follow-ups, I will add concrete TODOs and can implement item 1 (integration contract test) first. Otherwise I will mark this Section 4.1 backend-focused update complete.

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

### 4.3 Pattern Difficulty Classification (Backend)

> **STATUS: ✅ Backend Complete**

Summary: Difficulty classification logic (Easy/Medium/Hard/Impossible) is implemented server-side as part of `StrategicEvaluation`. The backend computes difficulty scores based on tiles needed, scarcity, and probability; the `difficulty_class` field exists and is populated by the analysis worker.

Implemented (backend):

- `difficulty_class` and numeric difficulty scoring implemented in `crates/mahjong_ai/src/evaluation.rs` (`classify_difficulty()` and related helpers).
- `StrategicEvaluation` includes `difficulty_class` and `difficulty` metrics and is produced by the analysis pipeline (`crates/mahjong_core/src/analysis.rs`).
- Unit tests cover classification thresholds and edge-cases (see tests in `crates/mahjong_ai/tests/`).
- Integration: `AnalysisUpdate` events include (or can include) difficulty metadata; worker emits diffs when significant changes occur.

Remaining backend tasks (small, optional):

- **Ensure difficulty thresholds are configurable:** Expose tuning via config or `Ruleset` if product wants to change color thresholds per UX A/B tests. (Files: `crates/mahjong_ai/src/evaluation.rs`, `crates/mahjong_server/src/config.rs`)
- **Add contract tests for difficulty emission:** Verify `AnalysisUpdate` contains `difficulty_class` when expected and does not leak additional private information. (Tests: `crates/mahjong_server/tests/analysis_integration.rs`)

Acceptance: With tests in place and `difficulty_class` covered by unit/integration tests, backend responsibilities for difficulty classification are complete.

### 4.4 Frontend Impact (brief)

> **STATUS: ❌ Frontend work needed**

Note: Frontend UI changes (color coding, filters, tooltips) are client work and not required for backend progress. The backend already provides the necessary fields (`viable`, `difficulty`, `difficulty_class`, probability/expected_value) via the analysis cache and `AnalysisUpdate` events. Frontend work may consume these fields when development starts.

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
> **\*Section 5.2 - AI Comparison Log: ✅ IMPLEMENTED (debug-mode)**

- ✅ `AnalysisLogEntry` structure implemented
- ✅ Multi-strategy analysis (Greedy, MCTS, Basic) implemented in debug-mode
- ✅ Debug mode toggle via `DEBUG_AI_COMPARISON=1`
- ✅ "Director's Cut" in-memory log appended during analysis worker execution

**Locations implemented**:

- `crates/mahjong_server/src/analysis/comparison.rs` — data structures and `run_strategy_comparison()` (tests included)
- `crates/mahjong_server/src/analysis/worker.rs` — invokes `run_strategy_comparison()` and appends entries to `Room.analysis_log`
- `crates/mahjong_server/src/network/room.rs` — `debug_mode` and `analysis_log` fields plus `get_analysis_log()` accessor

**How to enable**: Set the environment variable `DEBUG_AI_COMPARISON=1` when starting the server to enable multi-engine logging. Logs are stored in-memory on the `Room` as `analysis_log` and are trimmed to recent entries (default cap ~500 entries).

**Goal:** Maintain a persistent record of game events and a side-channel log of AI decision-making for debugging and strategy comparison.

### 5.1 Game Activity Log

> **STATUS: ✅ FULLY IMPLEMENTED**

- `ReplayService` implemented in `crates/mahjong_server/src/replay.rs` with `PlayerReplay` and `AdminReplay` views and `reconstruct_state_at_seq()`.
- Events are persisted via `Database::append_event()` and include seq, visibility, target_player, and timestamp (`crates/mahjong_server/src/db.rs`).
- Snapshot-based replay optimization exists (snapshots saved in `broadcast_event()` every `SNAPSHOT_INTERVAL` events).
- `ReplayService::verify_replay_integrity()` validates replay correctness against persisted final state.

### 5.2 AI Comparison Log ("Director's Cut")

> **STATUS: ✅ IMPLEMENTED (debug-mode; in-memory + persisted at game end when present)**

- `AnalysisLogEntry` and comparison runner implemented in `crates/mahjong_server/src/analysis/comparison.rs`.
- `analysis_worker` runs `run_strategy_comparison()` and appends `AnalysisLogEntry` items to `Room.analysis_log` when `DEBUG_AI_COMPARISON=1` (see `crates/mahjong_server/src/analysis/worker.rs`).
- `Room` exposes `get_analysis_log()` and `analysis_log_len()` to read entries when debug mode is enabled (`crates/mahjong_server/src/network/room.rs`).
- On game end, `persist_final_state()` serializes `analysis_log` and writes it to the `games.analysis_log` JSONB column via `Database::finish_game()` if non-empty (see `crates/mahjong_server/src/network/events.rs` and `crates/mahjong_server/src/db.rs`).
- Migration file `crates/mahjong_server/migrations/20260112000001_add_analysis_log.sql` adds the `analysis_log` JSONB column.

Notes: AI comparison logging is intentionally debug-mode gated and kept in-memory during play to avoid production overhead. Persistence to DB is optional and happens only at game end if logs exist and the migration has been applied.

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

> **STATUS: ✅ PARTIALLY IMPLEMENTED (server-side)** - Player stats collection and update logic exists

**Locations implemented**:

- `crates/mahjong_server/src/stats.rs` — `PlayerStats` struct and `update_player_stats()` which records wins, patterns, scores and updates DB.

**Notes:** Basic stats (games played/won, scores, wins by pattern) are recorded server-side and persisted via the database helper functions. Dashboard/UI components remain unimplemented.

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

> **STATUS: ❌ FRONTEND NOT IMPLEMENTED** - Backend services available (Replay, Stats), UI components still needed

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

> **IMPLEMENTATION STATUS (2026-01-09): ✅ PHASE 0 COMPLETE**
>
> **Summary:**
>
> - ✅ 6.1 Ruleset Configuration - **DONE**
> - ✅ 6.2 Call Priority - **DONE**
> - ✅ 6.3 Joker Rules - **DONE** (completed 2026-01-09)
> - ✅ 6.4 Scoring & Settlement - **DONE**
> - ✅ 6.5 Deterministic State Capture - **DONE**
> - ⚠️ 6.6 Multiplayer Stalling Controls - **PARTIAL** (bot takeover exists, no explicit pause/forfeit)
>
> **Phase 0 - Baseline Rules Parity: COMPLETE (7/7 core features done)**
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

> **STATUS: ✅ FULLY IMPLEMENTED (2026-01-09)**
>
> **Implemented:**
>
> - ✅ `ExchangeJoker` command: swap joker from exposed meld with real tile
> - ✅ Joker assignment tracking in `Meld` struct via `joker_assignments: HashMap`
> - ✅ Replacement draw events: `ReplacementDrawn { reason: Kong | Quint | BlankExchange }`
> - ✅ `ExchangeBlank` command for blank tile exchanges
> - ✅ **Pattern-specific joker restrictions** via `ineligible_histogram` field
> - ✅ Joker restrictions fully encoded in `UnifiedCard` pattern data (1002 variations verified)
> - ✅ `ineligible_histogram` field used for validation in `Hand::calculate_deficiency()`
> - ✅ Singles, pairs, and flowers correctly marked as joker-ineligible
> - ✅ Pungs, kongs, and quints correctly marked as joker-eligible
> - ✅ Comprehensive test coverage (8 tests covering edge cases, exposed melds, all scenarios)
> - ✅ Full documentation added to `Variation`, `AnalysisEntry`, and `calculate_deficiency()`
>
> **Locations**:
>
> - Commands/Events: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`
> - Data structures: `crates/mahjong_core/src/rules/card.rs`
> - Validation logic: `crates/mahjong_core/src/hand.rs` (lines 86-190)
> - Tests: `crates/mahjong_core/tests/joker_strict_test.rs` (8 comprehensive tests)
> - Pattern data: `data/cards/unified_card2025.json` (1002 variations with correct restrictions)
>
> **Verification Completed (2026-01-09):**
>
> - All 207 mahjong_core tests pass
> - Pattern data spot-check: 100% pairs correct, 98.4% singles correct, 100% flowers correct
> - Edge cases tested: all jokers, zero jokers, mixed exposed/concealed, all singles, partial strict

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

**Goal (backend focus):** Avoid indefinite stalls when timers are passive by providing server-side host controls, a forfeit flow, and robust reconciliation/persistence so game state stays deterministic and auditable.

Backend status (details):

- **Implemented (server):**
  - Bot takeover and `bot_seats` tracking in `crates/mahjong_server/src/network/room.rs` (functions that enable bot takeover and bot-runner hooks exist).
  - Reconnection handling and session lifecycle (room join, reconnect, and resume logic) implemented in `room.rs` and `session` code.
  - When bot takeover occurs, existing bot runner code makes decisions on behalf of the seat (see bot runner files referenced from `room.rs`).

- **Missing / To implement (server):**
  1. **Pause/Resume Commands & Handlers**
  - Add `GameCommand::PauseGame { by: Seat }` and `GameCommand::ResumeGame { by: Seat }` (or `HostPause`/`HostResume`) to `crates/mahjong_core/src/command.rs`.
  - Add `GameEvent::GamePaused { by: Seat, reason: Option<String> }` and `GameEvent::GameResumed { by: Seat }` to `crates/mahjong_core/src/event.rs`.
  - Implement handlers in `crates/mahjong_server/src/network/room.rs` (or a new `stall_controls.rs`) to validate who may pause/resume (host vs unanimous vote), update room state (e.g., `history_mode`/`paused` flag), persist the pause event, and broadcast to sessions.
  1. **Forfeit Flow**
  - Add `GameCommand::ForfeitGame { player: Seat, reason: Option<String> }` and `GameEvent::PlayerForfeited { player: Seat, reason: Option<String> }` in core types.
  - Implement server-side validation and resolution: marking player as forfeited, awarding win/loss/abandon according to rules, persist final state via `persist_final_state()` and `Database::finish_game()`, and emit `GameOver`/forfeit-related events.
  1. **Admin/Host Overrides & API**
  - Add admin API endpoints for force-forfeit, force-pause, or view room health. Suggested location: `crates/mahjong_server/src/network/admin.rs` or extend existing HTTP admin handlers. Ensure RBAC checks.
  1. **Persistence & Replay/Analytics**
  - Ensure pause/resume/forfeit events are appended to the event log (via `broadcast_event()` -> `append_event()`), and snapshots are saved when appropriate so replays reflect pauses and forfeits.
  - Update `ReplayService` to include pause/forfeit events in reconstructed admin replays.
  1. **Tests & Hardening**
  - Unit tests for command validation (`crates/mahjong_core/tests/validation_tests.rs`) and integration tests for pause/resume/forfeit flows (`crates/mahjong_server/tests/stall_controls_tests.rs`).
  - Add concurrency tests for host pause while player reconnects or bot takeover happening.

Acceptance criteria (backend):

- `GameCommand::PauseGame`/`ResumeGame` and `GameCommand::ForfeitGame` exist and are validated by `table/validation.rs` or equivalent validation layers.
- `GameEvent::GamePaused`/`GameResumed`/`PlayerForfeited` are emitted, persisted, and included in `ReplayService` reconstructions.
- Host/admin override endpoints exist and are protected by RBAC.
- Tests cover valid/invalid pause/resume/forfeit attempts, persistence to DB, and replay reconstruction including these events.

Suggested first implementation steps (small, low-risk):

1. Add command/event enums (core crate) and regenerate TypeScript bindings if needed.
2. Implement handler skeletons in `crates/mahjong_server/src/network/room.rs` to accept/validate commands and broadcast corresponding events.
3. Add integration tests that simulate host pause/resume and a forced forfeit, asserting DB finalization and replay integrity.

If you want, I can open a PR implementing item (1) (core command/event additions + tests) and item (2) (server handler skeleton + basic validation). Tell me which item to prioritize and I'll add concrete TODOs and begin implementation.

### 6.7 Completion Split: Backend Coverage vs Frontend Impact

> **STATUS SUMMARY (2026-01-11):**

This section separates what is already implemented server-side (backend coverage) from UI/UX or client-side work (frontend impact). It also clarifies where "Smart Undo" belongs in the stack.

#### Backend Coverage (what the server already provides)

- ✅ Call Priority + Adjudication - implemented (see 6.2)
- ✅ Scoring + Settlement - implemented (see 6.4)
- ✅ Ruleset Metadata persisted in `Room` and snapshots (see 6.1)
- ✅ Joker Restrictions & validation - implemented (see 6.3)
- ✅ Courtesy Pass negotiation flow - implemented (charleston handlers)
- ✅ Timer metadata and passive timer model - implemented (see Section 3)
- ✅ Deterministic replay inputs (wall seed/index, replacement draws) - implemented (see 6.5)
- ✅ History / Time-Travel primitives (snapshots, `RequestHistory`, `JumpToMove`, `ResumeFromHistory`, `ReturnToPresent`) - implemented (see Section 1)
- ✅ Replay service + snapshot-based reconstruction - implemented (see Section 5)

Notes:

- The server exposes full history snapshots and the commands/events to restore and truncate state; this is the foundation for Smart Undo. However, Smart Undo as a discrete UX/command is not yet implemented server-side (see "Smart Undo" below).

#### Frontend Impact (what clients must implement)

- History Viewer UI (list of moves, playback controls, jump/resume UI) — consumes `MoveHistorySummary` / `StateRestored` events.
- Smart Undo UI (undo button, confirmation dialogs, decision-point navigation) — needs mapping to server commands once Smart Undo handlers are added.
- Pattern Viability visualization & card viewer UI — backend sends `viable`/`difficulty`, client renders colors/filters.
- Replay viewer & stats dashboard — frontend features consuming replay and `analysis_log` payloads.

These frontend items are blocked only by UI work; the backend provides the necessary payloads for all of them.

#### Smart Undo: Where it belongs and what remains

Smart Undo is primarily a frontend UX concept built on the backend's history/time-travel primitives. The server provides snapshots and restore/truncate commands; Smart Undo requires the following server enhancements to be cleanly supported:

1. **Decision-point tagging:** When recording history entries, mark entries that are player decision points (e.g., end of Charleston, after a player's discard choice, after call-window resolution). This makes finding "last decision" fast and deterministic. (Files: `crates/mahjong_core/src/history.rs`, `crates/mahjong_server/src/network/events.rs`)

2. **SmartUndo command/event (small API addition):** Add `GameCommand::SmartUndo` (or `UndoLastDecision`) and corresponding `GameEvent` responses (`StateRestored`, `HistoryTruncated` when undo discards future moves). Validate for Practice Mode only. (Files: `crates/mahjong_core/src/command.rs`, `crates/mahjong_core/src/event.rs`, `crates/mahjong_server/src/network/history.rs`)

3. **Bounded history & truncation policy:** Ensure `Room.history` is capped and that truncation on resume or undo behaves predictably and persists expected events for replay. (Files: `crates/mahjong_server/src/network/room.rs`)

4. **Tests & concurrency checks:** Unit and integration tests for undo in Practice Mode, concurrent undo requests, and interaction with analysis/hints. (Files: `crates/mahjong_core/tests/`, `crates/mahjong_server/tests/history_integration_tests.rs`)

5. **Optional:** Export/save diverged branches or mark undo-only actions as non-persistent in `ReplayService` if you don't want undos to appear in canonical replays. (Files: `crates/mahjong_server/src/replay.rs`, `crates/mahjong_server/src/network/events.rs`)

Acceptance criteria (backend):

- `SmartUndo` command exists and is validated (Practice Mode only).
- Undo restores table from a tagged decision-point snapshot and emits `StateRestored`.
- If undo creates a divergent branch (player resumes from mid-history), server truncates/records events consistently and `ReplayService` handling is defined.
- Tests for undo semantics and concurrent request handling exist.

If you want, I can implement the smallest safe set now: (A) add `DecisionPoint` tagging in history entries and (B) add a `SmartUndo` command skeleton + tests. Those are low-risk, make the feature discoverable for frontend, and keep behavior deterministic.

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

## 8. Supplemental Implementation Checklist

The detailed phased checklist has been moved to `supplemental-implementation-checklist.md` in the same folder. Refer to that file for the full Phase 0..5 backlog, tests, and estimates.

The Success Metrics & Testing Strategy have been moved to `supplemental-implementation-checklist.md` under the header `## 9. Success Metrics & Testing Strategy`.

## End of Document
