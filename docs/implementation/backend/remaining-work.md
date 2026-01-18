# Remaining Backend Work

**Last Updated:** 2026-01-17

This document tracks remaining backend work that's too complex for simple TODOs in code. Simple tasks and small enhancements should be tracked as TODOs in the relevant source files.

---

## 1. Multiplayer Stalling Controls

**Status:** ⚠️ PARTIALLY IMPLEMENTED (pause/resume ✅, forfeit missing)

**Context:** When timers are passive (Practice Mode), games need explicit host controls to prevent indefinite stalls. Bot takeover and pause/resume are complete. Forfeit flows are missing.

**Implementation Required:**

### 1.1 Pause/Resume Commands

✅ **COMPLETED** (2026-01-17)

- [x] Add `GameCommand::PauseGame { by: Seat }` and `GameCommand::ResumeGame { by: Seat }` to `crates/mahjong_core/src/command.rs`
- [x] Add `GameEvent::GamePaused { by: Seat, reason: Option<String> }` and `GameEvent::GameResumed { by: Seat }` to `crates/mahjong_core/src/event.rs`
- [x] Implement handlers in `crates/mahjong_server/src/network/commands.rs`:
  - Host-only validation (first player to join = host)
  - Update room state (`paused: bool`, `paused_by: Option<Seat>`, `host_seat: Option<Seat>`)
  - Persist pause/resume events via existing `broadcast_event()` infrastructure
  - Broadcast to all sessions
  - Block game actions when paused (allow analysis/hints/history/leave)
- [x] Add integration tests in `crates/mahjong_server/tests/stall_controls_tests.rs` (5 tests passing)
- [x] TypeScript bindings auto-generated

**Implementation Notes:**

- Host = room creator (first player to join, stored in `room.host_seat`)
- Pause allowed at any time (no phase restrictions)
- Pause/resume events use existing event persistence for replay compatibility
- Selective command blocking: game actions blocked when paused, but analysis/hints/history/leave still work

### 1.2 Forfeit Flow

✅ **COMPLETED** (2026-01-18)

- [x] Add `GameCommand::ForfeitGame { player: Seat, reason: Option<String> }` to commands
- [x] Add `GameEvent::PlayerForfeited { player: Seat, reason: Option<String> }` to events
- [x] Implement forfeit handler:
  - Mark player as forfeited
  - Award win/loss according to rules
  - Call `persist_final_state()` and `Database::finish_game()`
  - Emit `GameOver` event
- [x] Add validation tests for forfeit permissions

**Implementation Notes:**

- Forfeit is handled entirely in the server layer ([commands.rs:174-228](../../crates/mahjong_server/src/network/commands.rs#L174-L228))
- Any player can forfeit their own position (authorization validated by session)
- Game ends immediately with `GameEndCondition::Abandoned(AbandonReason::Forfeit)`
- Forfeiting player receives -100 score, others receive 0
- Forfeit works even when game is paused
- 6 tests passing in [forfeit_tests.rs](../../crates/mahjong_server/tests/forfeit_tests.rs)
- TypeScript bindings auto-generated

### 1.3 Admin Overrides

- [ ] Add admin API endpoints for:
  - Force-forfeit any player
  - Force-pause/resume game
  - View room health metrics
- [ ] Implement RBAC checks for admin actions
- [ ] Location: `crates/mahjong_server/src/network/admin.rs` or extend existing HTTP admin handlers

### 1.4 Replay Integration

- [ ] Ensure pause/resume/forfeit events are persisted via `broadcast_event()` → `append_event()`
- [ ] Update `ReplayService` to include these events in admin replays
- [ ] Add tests verifying replay reconstruction includes pause/forfeit events

**Acceptance Criteria:**

- Host can pause/resume games
- Players can forfeit with proper finalization
- Admin can override stuck games
- All stall-control events appear in replays

---

## 2. Bot Configuration API

**Status:** ⚠️ BACKEND EXISTS, API MISSING

**Context:** The server has full bot difficulty support (`Room.bot_difficulty` field and `configure_bot_difficulty()` method), but the client-facing API (`CreateRoomPayload`) doesn't expose it. Bot difficulty is hardcoded to `Difficulty::Easy` on room creation.

**Implementation Required:**

### 2.1 Extend CreateRoomPayload

- [ ] Add optional `bot_difficulty` field to `CreateRoomPayload` in `crates/mahjong_server/src/network/messages.rs`:
  - Field type: `Option<Difficulty>` (defaults to `Easy`)
  - Update rustdoc with example JSON
  - Add `#[serde(default)]` attribute
- [ ] Add optional `fill_with_bots` boolean field to `CreateRoomPayload`:
  - If true, server automatically fills empty seats with bots after room creation
  - If false, room remains unfilled until players join
- [ ] Regenerate TypeScript bindings via `cargo test export_bindings_createroompayload`
- [ ] Location: [messages.rs:149-161](crates/mahjong_server/src/network/messages.rs#L149-L161)

### 2.2 Wire Up Room Creation Handler

- [ ] Update `handle_create_room()` in `crates/mahjong_server/src/network/commands.rs`:
  - Read `bot_difficulty` from payload
  - Call `room.configure_bot_difficulty(difficulty)` if provided
  - If `fill_with_bots` is true, call logic to add bots to empty seats
- [ ] Validate difficulty enum on server side (reject invalid values)
- [ ] Location: `crates/mahjong_server/src/network/commands.rs`

### 2.3 Auto-Fill Bots Logic

- [ ] Implement `Room::fill_empty_seats_with_bots()` method:
  - Iterate over `Seat::all()` and add bots to unoccupied seats
  - Mark seats as bot-controlled in `room.bot_seats`
  - Spawn bot runner if not already active
- [ ] Location: `crates/mahjong_server/src/network/room.rs`

### 2.4 Update Frontend Integration

- [ ] Frontend: Update `ConnectionPanel.tsx` to wire up bot difficulty dropdown (currently UI-only)
- [ ] Frontend: Wire up "Fill with Bots" checkbox to `CreateRoomPayload.fill_with_bots`
- [ ] Location: `apps/client/src/components/ConnectionPanel.tsx`

### 2.5 Testing

- [ ] Add unit tests for `CreateRoomPayload` deserialization with bot config
- [ ] Add integration test: Create room with Hard difficulty, verify bots use Hard AI
- [ ] Add integration test: Create room with `fill_with_bots=true`, verify 3 bots spawn
- [ ] Location: `crates/mahjong_server/tests/`

**Acceptance Criteria:**

- Clients can specify bot difficulty on room creation
- Bots use the configured difficulty level
- `fill_with_bots` flag works correctly
- TypeScript bindings include new fields
- Tests verify all scenarios

**Related Documentation:**

- Frontend spec: [minimal-browser-ui.md:84-94](docs/implementation/frontend/minimal-browser-ui.md#L84-L94)

---

## 3. Smart Undo Decision-Point System

**Status:** ⚠️ INFRASTRUCTURE EXISTS, UX LAYER MISSING

**Context:** History/time-travel primitives are implemented (`RequestHistory`, `JumpToMove`, `ResumeFromHistory`). Smart Undo requires decision-point tagging and a UX-friendly command layer.

**Implementation Required:**

### 2.1 Decision-Point Tagging

- [ ] Add `is_decision_point: bool` field to `MoveHistoryEntry` in `crates/mahjong_core/src/history.rs`
- [ ] Update `record_history_entry()` in `crates/mahjong_server/src/network/events.rs` to tag:
  - End of Charleston phases
  - After player discard choices
  - After call-window resolution
  - Before critical decisions (e.g., which meld to expose)
- [ ] Add helper: `Room::find_last_decision_point() -> Option<u32>`

### 2.2 SmartUndo Command

- [ ] Add `GameCommand::SmartUndo` (alias for `UndoLastDecision`) to `crates/mahjong_core/src/command.rs`
- [ ] Implement handler in `crates/mahjong_server/src/network/history.rs`:
  - Find last decision point via `find_last_decision_point()`
  - Validate Practice Mode only
  - Call existing `handle_jump_to_move()` logic
  - Emit `StateRestored` + `HistoryTruncated` events
- [ ] Add command validation in `crates/mahjong_core/src/table/mod.rs`

### 2.3 Bounded History & Truncation

- [ ] Define history cap policy (e.g., max 500 entries per room)
- [ ] Implement history trimming in `Room::record_history_entry()`
- [ ] Ensure truncation on undo behaves predictably
- [ ] Document truncation policy in `crates/mahjong_server/src/network/room.rs`

### 2.4 Divergent Branch Handling

**Decision Required:** Should undos create saved branches or discard diverged futures?

Options:

1. **Discard diverged future** (simpler): Undo truncates history, future moves lost
2. **Save branches** (complex): Store diverged timelines for comparison

Recommendation: Start with option 1, add option 2 later if users request it.

- [ ] Document chosen policy in an ADR
- [ ] Implement branch handling in undo handler
- [ ] Update `ReplayService` to mark undo-only actions if needed

### 3.5 Testing

- [ ] Unit tests: `SmartUndo` command validation
- [ ] Integration tests: Undo in Practice Mode
- [ ] Concurrency tests: Multiple undo requests
- [ ] Test interaction with analysis/hints after undo

**Acceptance Criteria:**

- `SmartUndo` command exists and validates (Practice Mode only)
- Undo restores to last decision point
- History truncation is deterministic
- Tests cover edge cases and concurrency

---

## 4. Future Features (Not Started)

These features are specified but not implemented. They may require ADRs for design decisions before implementation begins.

### 4.1 Defensive Play Analysis

**Status:** ❌ NOT IMPLEMENTED - Specification only

**Goal:** Help players identify when discards might be dangerous (could complete opponent's hand).

**Considerations:**

- Privacy: Only use public information (discards, exposed melds)
- Performance: Must not slow down analysis pipeline
- UX: Risk indicators (Safe/Risky/Dangerous) on tiles

**Next Steps:**

1. Create ADR for opponent analysis privacy model
2. Design risk calculation algorithm
3. Implement in `mahjong_ai/src/defensive.rs`
4. Integrate with Always-On Analyst

### 4.2 Practice Mode Auto-Play

**Status:** ❌ NOT IMPLEMENTED - Specification only

**Goal:** Let AI temporarily "take over" for a player during practice, then hand control back.

**Use Cases:**

- "Show me what you would do" - Watch AI play a few turns
- "I'm stuck, help me" - AI plays until hand improves
- "Fast-forward through Charleston" - AI handles passes

**Considerations:**

- Control handoff semantics (when does player resume?)
- State synchronization (how does UI show "AI is playing"?)
- Command design: `GameCommand::EnableAIAssist { duration: Option<u32> }`

**Next Steps:**

1. Create ADR for AI control handoff model
2. Design command/event flow
3. Implement in bot runner
4. Add UI integration points

### 4.3 Pattern Recommendation Filters

**Status:** ❌ NOT IMPLEMENTED - Simple enough for TODOs

**Goal:** Filter patterns by section, concealment, score, joker restrictions.

**Implementation:**

- Add filter fields to `GameCommand::RequestAnalysis`
- Update analysis worker to respect filters
- Frontend integration for filter UI

**Next Steps:** Add TODOs in `crates/mahjong_ai/src/evaluation.rs` for filter logic.

---

## 5. Performance Optimizations (Optional)

These are low-priority optimizations that should be driven by metrics, not pre-optimization.

### 5.1 History Snapshot Optimization

**Current:** Full `Table` clone per history entry (simple, memory-heavy)

**Proposed:** Full snapshot every N moves + deltas (complex, memory-efficient)

**Decision:** Wait for metrics showing memory pressure before implementing.

**Location:** `crates/mahjong_server/src/network/history.rs`

### 5.2 Analysis Pipeline Throttling

**Current:** Analysis runs after every state-changing event

**Proposed:** Debounce window (100-250ms) to batch analysis requests

**Decision:** Add metrics first, optimize if analysis worker shows high CPU usage.

**Location:** `crates/mahjong_server/src/analysis/worker.rs`

### 5.3 Replay Pagination

**Current:** `RequestHistory` returns all move summaries

**Proposed:** Add `offset/limit` params for very long games (1000+ moves)

**Decision:** Wait for user complaints about slow history loading.

**Location:** `crates/mahjong_core/src/command.rs`, `crates/mahjong_server/src/network/history.rs`

---

## 6. Analysis Performance Optimization

**Status:** ⚠️ NEEDS MEASUREMENT

**Context:** Always-On Analyst runs after every state change (4 players × 500+ patterns). Need to measure performance and optimize if needed.

**Implementation Required:**

### 6.1 Performance Measurement

- [ ] Add metrics collection in `crates/mahjong_server/src/analysis/worker.rs`:
  - Analysis latency (avg, p50, p90, p99)
  - Patterns evaluated per analysis
  - CPU time per analysis
  - Analysis queue depth
- [ ] Add performance tests with production-scale data (1000+ hands)
- [ ] Set performance budget: Target <50ms avg, <100ms p90

### 6.2 Optimization Strategies (if metrics show issues)

**Only implement if measurements show performance problems:**

- [ ] **Lazy Evaluation:** Only analyze on player's turn (not after every discard)
  - Location: `crates/mahjong_server/src/analysis/worker.rs`
- [ ] **Incremental Analysis:** Cache previous results, only recalculate deltas
  - Add cache invalidation logic for hand composition changes
- [ ] **Parallel Processing:** Use multi-threading to analyze all 4 hands simultaneously
  - Consider using `rayon` for parallel pattern evaluation
- [ ] **Smart Triggers:** Only re-analyze when hand composition changes
  - Skip analysis for non-hand-affecting events

### 6.3 Bandwidth Optimization

**Decision Required:** Should analysis updates be sent automatically or on client request?

- [ ] Implement delta compression for `AnalysisUpdate` events:
  - Send full analysis: On turn start or when >30% of patterns change viability
  - Send delta update: When 1-30% of patterns change
  - Send nothing: When <1% change (cosmetic differences)
- [ ] Add client-side caching (frontend work, document interface here)
- [ ] Add throttling: Max 1 update per second per player

**Acceptance Criteria:**

- Analysis completes in <50ms average (90th percentile <100ms)
- Bandwidth <5KB per update
- No redundant computation for bots

---

## 7. Testing & Hardening

**Status:** ⚠️ INCOMPLETE

**Context:** Some integration tests and stress tests are missing for edge cases and performance validation.

**Implementation Required:**

### 7.1 History & Undo Tests

- [x] Add stress tests in `crates/mahjong_server/tests/history_stress_tests.rs`: ✅ **DONE** (2026-01-16)
  - Concurrent history operations (two clients jump/resume simultaneously)
  - Large histories (1000+ moves)
  - Snapshot persistence failure modes
- [x] Add WebSocket end-to-end tests in `crates/mahjong_server/tests/history_websocket_e2e.rs`: ✅ **DONE** (2026-01-16)
- [ ] Add bounded history tests (verify cap enforcement) - **BLOCKED** until cap policy decided (see Section 3.3)

### 7.2 Analysis Tests

- [ ] Add contract tests in `crates/mahjong_server/tests/analysis_integration.rs`:
  - Verify `AnalysisUpdate` emitted within X ms after DrawTile/DiscardTile
  - Verify no private information leaks (privacy filtering)
  - Test reconnection analysis backfill
- [ ] Add corner case tests in `crates/mahjong_ai/tests/`:
  - Variable suit patterns with exhausted tiles
  - Joker edge cases (all jokers used, mixed exposed/concealed)
  - Nearly-exhausted tile pools

### 7.3 Performance Tests

- [ ] Add benchmarks in `crates/mahjong_ai/benches/`:
  - 1000 hands × 500 patterns (target: <50ms avg)
  - Memory usage for 100 concurrent rooms with full history
  - Bandwidth measurement: delta vs full updates over 100-turn game

**Acceptance Criteria:**

- All edge cases covered with tests
- Performance benchmarks exist and pass targets
- No flaky tests in CI

---

## 8. Admin Export API (Pending File Creation)

**Status:** ⚠️ NO FILE TO ADD TODO YET

**Task:** Add endpoints to export or download a game's full move history and snapshots for debugging/replay.

**Action Required:**

- Create `crates/mahjong_server/src/network/admin.rs` module
- Add HTTP endpoints for:
  - Export game history as JSON
  - Download replay data
  - View room health metrics
- Once file exists, move this to a `// TODO:` comment in that file

**Location:** `crates/mahjong_server/src/network/admin.rs` (to be created)

---

## Notes

- Frontend work is tracked separately and not included here
- ADRs should be created for major design decisions before implementation
- This document should shrink over time as work is completed or moved to TODOs
- Review quarterly to remove completed items and add new complex work

---

## Design Decisions Needed

The following questions require design decisions. Once decided, document as ADRs:

### Smart Undo Decisions

- **Undo scope:** Single undo only, or bounded stack (last N decisions)?
- **Divergent branches:** Discard diverged future, or save branches for comparison?
- **Confirmation UX:** Free undo vs confirm destructive actions?

### Analysis Performance Decisions

- **Update model:** Push analysis automatically, or pull on client request?
- **Throttling strategy:** Time-based (max 1/sec) or change-based (delta threshold)?
- **Optimization trigger:** What metrics threshold triggers optimization work?

### Multiplayer Timer Decisions

- **Timer mode:** Passive for Practice only, or support enforced mode for competitive?
- **AFK handling:** Bot takeover, pause game, or kick player?
- **Customization:** Per-game timer duration config, or mode-specific presets?

### Hint System Decisions

- **Skill tuning:** Lock hint verbosity at game start, or toggle mid-game?
- **Disclosure level:** Progressive hints (show more over time), or fixed per skill level?

**Action:** Review these questions, make decisions, and create ADRs in `docs/adr/` before implementing related features.
