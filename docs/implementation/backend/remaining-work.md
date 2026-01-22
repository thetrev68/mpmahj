# Remaining Backend Work

**Last Updated:** 2026-01-21

**Overall Status:** Major features implemented; only optional optimizations and future enhancements remain

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

✅ **COMPLETED** (2026-01-18)

- [x] Add admin API endpoints for:
  - Force-forfeit any player
  - Force-pause/resume game
  - View room health metrics
- [x] Implement RBAC checks for admin actions
- [x] Location: `crates/mahjong_server/src/network/admin.rs`

**Implementation Notes:**

- Authorization module with role-based access control ([authorization.rs](../../crates/mahjong_server/src/authorization.rs))
  - Role hierarchy: User < Moderator < Admin < SuperAdmin
  - JWT token validation with role extraction from claims
  - `require_admin_role()` helper for endpoint authorization
- Three new admin GameEvent variants ([event.rs:343-378](../../crates/mahjong_core/src/event.rs#L343-L378)):
  - `AdminForfeitOverride` - Admin forced forfeit with audit trail
  - `AdminPauseOverride` - Admin paused game with reason
  - `AdminResumeOverride` - Admin resumed game
  - All events are public (broadcast to all players for transparency)
- Five admin HTTP endpoints ([admin.rs](../../crates/mahjong_server/src/network/admin.rs)):
  - `POST /api/admin/rooms/:room_id/forfeit` - Force player forfeit (Moderator+)
  - `POST /api/admin/rooms/:room_id/pause` - Force pause (Moderator+)
  - `POST /api/admin/rooms/:room_id/resume` - Force resume (Moderator+)
  - `GET /api/admin/rooms/:room_id/health` - Room health metrics (Moderator+)
  - `GET /api/admin/rooms` - List all rooms (Admin+ only)
- Permissions:
  - Moderator: Force-forfeit, force-pause/resume, view health metrics
  - Admin: All moderator actions + list all rooms
  - SuperAdmin: Reserved for future elevated privileges
- Admins can resume ANY paused game (host-paused or admin-paused)
- Admin actions emit public GameEvents for audit trails (no separate audit table)
- TypeScript bindings auto-generated for all admin events
- All workspace tests passing (55/55)
- Detailed implementation plan: [admin-overrides-plan.md](admin-overrides-plan.md)

### 1.4 Replay Integration

✅ **COMPLETED** (2026-01-18)

- [x] Ensure pause/resume/forfeit events are persisted via `broadcast_event()` → `append_event()`
- [x] Update `ReplayService` to include these events in admin replays
- [x] Add tests verifying replay reconstruction includes pause/forfeit events

**Implementation Notes:**

- History recording added for all pause/resume/forfeit events ([events.rs:324-393](../../crates/mahjong_server/src/network/events.rs#L324-L393))
  - `GamePaused`, `GameResumed`, `PlayerForfeited` - regular player actions
  - `AdminPauseOverride`, `AdminResumeOverride`, `AdminForfeitOverride` - admin override actions
  - All events create MoveHistoryEntry with appropriate descriptions
- New MoveAction variants added ([history.rs:115-122](../../crates/mahjong_core/src/history.rs#L115-L122))
  - `PauseGame` - records pause actions
  - `ResumeGame` - records resume actions
  - `Forfeit` - records forfeit actions
  - TypeScript bindings auto-generated
- Replay apply_event handlers added ([replay.rs:127-134](../../crates/mahjong_core/src/table/replay.rs#L127-L134))
  - Pause/resume/forfeit events are meta-events (don't modify table state)
  - Events are persisted and appear in replays without errors
  - Replay reconstruction handles these events gracefully
- Comprehensive integration test added ([replay_reconstruction.rs:425-784](../../crates/mahjong_server/tests/replay_reconstruction.rs#L425-L784))
  - Tests all 6 event types (pause, resume, forfeit, + 3 admin overrides)
  - Verifies events appear in both player and admin replays
  - Confirms replay reconstruction works without errors
  - All workspace tests passing (55/55)

**Acceptance Criteria:**

- ✅ Host can pause/resume games
- ✅ Players can forfeit with proper finalization
- ✅ Admin can override stuck games
- ✅ All stall-control events appear in replays

---

## 2. Bot Configuration API

**Status:** ✅ COMPLETED (2026-01-21)

**Context:** The server has full bot difficulty support (`Room.bot_difficulty` field and `configure_bot_difficulty()` method). The client-facing API (`CreateRoomPayload`) now exposes bot configuration fields. Handlers and auto-fill logic are wired up.

**Implementation Required:**

### 2.1 Extend CreateRoomPayload

✅ **COMPLETED** (2026-01-18)

- [x] Add optional `bot_difficulty` field to `CreateRoomPayload` in `crates/mahjong_server/src/network/messages.rs`:
  - Field type: `Option<Difficulty>` (defaults to `Easy`)
  - Updated rustdoc with comprehensive examples
  - Added `#[serde(default = "default_bot_difficulty")]` attribute
- [x] Add `fill_with_bots` boolean field to `CreateRoomPayload`:
  - Defaults to `false` via `#[serde(default)]`
  - Server will auto-fill empty seats when `true`
- [x] Added `Serialize`/`Deserialize`/`TS` derives to `Difficulty` enum
- [x] Generated TypeScript bindings:
  - `Difficulty.ts`: Union type `"Easy" | "Medium" | "Hard" | "Expert"`
  - `CreateRoomPayload.ts`: Includes `bot_difficulty` and `fill_with_bots` fields
- [x] Fixed ts-rs export paths (relative to crate root)
- [x] Location: [messages.rs:181-207](../../crates/mahjong_server/src/network/messages.rs#L181-L207)

**Implementation Notes:**

- Commit: `4bc0822` - feat: expose bot difficulty configuration in CreateRoomPayload API
- Detailed implementation plan: [bot-config-api-plan.md](bot-config-api-plan.md)

### 2.2 Wire Up Room Creation Handler

✅ **COMPLETED** (2026-01-21)

- [x] Update `handle_create_room()` in `crates/mahjong_server/src/network/websocket/room_actions.rs`:
  - Read `bot_difficulty` from payload
  - Call `room.configure_bot_difficulty(difficulty)` if provided
  - If `fill_with_bots` is true, call logic to add bots to empty seats
  - Check `should_start_game` and spawn bot runner if room is full
- [x] Validate difficulty enum on server side (reject invalid values) - handled by serde deserialization
- [x] Location: `crates/mahjong_server/src/network/websocket/room_actions.rs`

### 2.3 Auto-Fill Bots Logic

✅ **COMPLETED** (2026-01-21)

- [x] Implement `Room::fill_empty_seats_with_bots()` method:
  - Iterate over `Seat::all()` and add bots to unoccupied seats
  - Mark seats as bot-controlled in `room.bot_seats`
- [x] Update `Room::start_game()` to populate bot players from `bot_seats`
- [x] Update `Room::is_full()` and `all_seats_filled()` to account for `bot_seats`
- [x] Location: `crates/mahjong_server/src/network/room.rs`

### 2.4 Update Frontend Integration

✅ **COMPLETED** (2026-01-21)

- [x] Frontend: Update `App.tsx` (ConnectionPanel equivalent) to wire up bot difficulty dropdown
- [x] Frontend: Wire up "Fill with Bots" checkbox to `CreateRoomPayload.fill_with_bots`
- [x] Frontend: Update `useGameSocket` to handle `createRoom` with payload
- [x] Location: `apps/client/src/App.tsx`, `apps/client/src/hooks/useGameSocket.ts`

### 2.5 Testing

✅ **COMPLETED** (2026-01-21)

- [x] Add unit tests for `CreateRoomPayload` deserialization with bot config
- [x] Add integration test: Create room with Hard difficulty, verify bots use Hard AI
- [x] Add integration test: Create room with `fill_with_bots=true`, verify 3 bots spawn and game starts
- [x] Location: `crates/mahjong_server/tests/bot_config_tests.rs`

**Acceptance Criteria:**

- ✅ Clients can specify bot difficulty on room creation
- ✅ Bots use the configured difficulty level
- ✅ `fill_with_bots` flag works correctly
- ✅ TypeScript bindings include new fields
- ✅ Tests verify all scenarios

**Related Documentation:**

- Frontend spec: [minimal-browser-ui.md:84-94](docs/implementation/frontend/minimal-browser-ui.md#L84-L94)

---

## 3. Smart Undo Decision-Point System

**Status:** ✅ COMPLETED (2026-01-21)

**Context:** History/time-travel primitives are implemented (`RequestHistory`, `JumpToMove`, `ResumeFromHistory`). Smart Undo requires decision-point tagging and a UX-friendly command layer.

**Implementation Required:**

### 3.1 Decision-Point Tagging

✅ **COMPLETED** (2026-01-21)

- [x] Add `is_decision_point: bool` field to `MoveHistoryEntry` in `crates/mahjong_core/src/history.rs`
- [x] Update `record_history_entry()` in `crates/mahjong_server/src/network/history.rs` to tag:
  - End of Charleston phases
  - After player discard choices
  - After call-window resolution
  - Before critical decisions (e.g., which meld to expose)
- [x] Add helper: `Room::find_last_decision_point() -> Option<u32>`

### 3.2 SmartUndo Command

✅ **COMPLETED** (2026-01-21)

- [x] Add `GameCommand::SmartUndo` to `crates/mahjong_core/src/command.rs`
- [x] Add `GameCommand::VoteUndo` to `crates/mahjong_core/src/command.rs`
- [x] Implement handler in `crates/mahjong_server/src/network/commands.rs`:
  - Find last decision point via `find_last_decision_point()`
  - Logic for Solo vs Multiplayer (immediate vs consensus)
  - `UndoRequest` state management
- [x] Add command validation in `crates/mahjong_core/src/table/mod.rs` (No-op/Valid)

### 3.3 Bounded History & Truncation

✅ **COMPLETED** (2026-01-21)

- [x] Implemented truncation in `ResumeFromHistory` logic (reused by Smart Undo).
- [x] History cap logic tracked separately (see Section 7.1 notes, effectively boundless for now).

### 3.4 Divergent Branch Handling

✅ **DECIDED & IMPLEMENTED** (2026-01-21)

- **Decision:** Discard diverged future (truncate history). See ADR 0024.
- [x] Document chosen policy in an ADR
- [x] Implement branch handling in undo handler (via `ResumeFromHistory`)

### 3.5 Testing

✅ **COMPLETED** (2026-01-21)

- [x] Unit tests: `SmartUndo` command validation
- [x] Unit tests: `find_last_decision_point` logic
- [x] Integration tests: Multiplayer Undo scenarios (simulated)

**Acceptance Criteria:**

- ✅ `SmartUndo` command exists and validates
- ✅ Undo restores to last decision point
- ✅ History truncation is deterministic
- ✅ Multiplayer requires consensus (unanimous vote)

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

**Status:** ✅ COMPLETED (2026-01-21)

**Context:** Always-On Analyst runs after every state change (4 players × 500+ patterns). Performance measurement and testing is complete.

**Completed:**

### 6.1 Performance Measurement

✅ **COMPLETED** (2026-01-21)

- [x] Added metrics collection in `crates/mahjong_server/src/analysis/worker.rs`:
  - Analysis latency (avg, p50, p90, p99)
  - Patterns evaluated per analysis
  - Queue depth tracking
  - Automatic reporting every 100 samples
- [x] Added performance benchmarks with production-scale data (1000+ hands)
- [x] Performance budget targets met: **avg <50ms, p90 <100ms** ✅

**Implementation Details:**

- `AnalysisMetrics` struct buffers latency measurements and emits percentiles
- Integrated into worker loop at line 447: `metrics.record(elapsed_total.as_millis(), total_patterns_evaluated, coalesced_count + 1)`
- Two criterion benchmarks created in `crates/mahjong_ai/benches/analysis_performance.rs`:
  - `benchmark_1000_hands_analysis`: 1000 hands × 500 patterns → **428-442ms total (~0.5ms/hand)**
  - `benchmark_single_hand_scaling`: Single hand with [50, 100, 200, 500] patterns → **linear scaling verified**
- Structured logging via tracing crate with percentile aggregation
- Location: [analysis_integration.rs](../../crates/mahjong_server/tests/analysis_integration.rs), [analysis_performance.rs](../../crates/mahjong_ai/benches/analysis_performance.rs), [worker.rs#L41-80](../../crates/mahjong_server/src/analysis/worker.rs#L41-L80)

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

✅ **COMPLETED** (2026-01-21)

- [x] Add contract tests in `crates/mahjong_server/tests/analysis_integration.rs`: ✅ **DONE**
  - `test_analysis_timing_contract`: Verify `AnalysisUpdate` emitted within 150ms after DrawTile (result: 31.9ms avg) ✅
  - `test_privacy_filtering`: Verify no private information leaks; each seat gets separate update ✅
  - `test_reconnection_analysis_cache`: Verify cache persists after reconnect ✅
  - `test_analysis_mode_behavior`: Verify ActivePlayerOnly vs AlwaysOn modes work correctly ✅
- [x] Add corner case tests in `crates/mahjong_ai/src/`: ✅ **DONE** (25+ tests passing)
  - Variable suit patterns with exhausted tiles: 3 tests in `probability.rs`
  - Joker edge cases (all jokers used, mixed exposed/concealed): 3 tests in `probability.rs`
  - Nearly-exhausted tile pools: 2 tests in `probability.rs`
  - Tile exhaustion and viability checks: 8 tests in `evaluation.rs`
  - Tile utility and strategic evaluation: 9 additional tests in `evaluation.rs`

**Implementation Details:**

- All 4 integration tests verified passing with WebSocket server spawning and game simulation
- Tests use simplified flow: create room → join players → start game → wait for AnalysisUpdate
- Corner case tests cover probability calculations, tile exhaustion, viability checking, and joker edge cases
- Memory stress test created for 100 concurrent rooms with 200-move history (marked with #[ignore])
- Location: [analysis_integration.rs](../../crates/mahjong_server/tests/analysis_integration.rs), [probability.rs](../../crates/mahjong_ai/src/probability.rs), [evaluation.rs](../../crates/mahjong_ai/src/evaluation.rs)

### 7.3 Performance Tests

✅ **COMPLETED** (2026-01-21)

- [x] Add benchmarks in `crates/mahjong_ai/benches/analysis_performance.rs`: ✅ **DONE**
  - 1000 hands × 500 patterns: **428-442ms total (meets <50ms avg target per hand)** ✅
  - Single hand scaling: **Linear scaling verified across [50, 100, 200, 500] patterns** ✅
  - Memory stress test created for 100 concurrent rooms with 200-move history ✅

**Acceptance Criteria:**

- ✅ All edge cases covered with tests (25+ corner case tests + 4 integration tests + memory stress)
- ✅ Performance benchmarks exist and pass targets (analysis <50ms avg, <100ms p90)
- ✅ No flaky tests in CI (all tests passing with consistent timing)

---

## 8. Admin Export API

**Status:** ⚠️ PARTIALLY IMPLEMENTED

**Context:** Room health metrics endpoint exists. Game export/download features still needed.

**Completed:**

- ✅ View room health metrics (`GET /api/admin/rooms/:room_id/health`)
- ✅ List all active rooms (`GET /api/admin/rooms`)

**Implementation Required:**

- [ ] Add export game history endpoint in `crates/mahjong_server/src/network/admin.rs`:
  - `GET /api/admin/rooms/:room_id/export` - Export full game history as JSON
  - Include all move history entries and snapshots
  - Format for replay/debugging tools
- [ ] Add download replay data endpoint:
  - `GET /api/admin/rooms/:room_id/replay/download` - Download replay file
  - Consider format (JSON, binary, custom)
- [ ] Add TODO comments in admin.rs for these features

**Location:** `crates/mahjong_server/src/network/admin.rs`

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

**Status:** ✅ DECIDED (ADR 0024)

- **Undo scope:** Bounded stack (game start).
- **Divergent branches:** Discard diverged future (truncate).
- **Confirmation UX:** Unanimous consensus for multiplayer, instant for solo/practice.

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
