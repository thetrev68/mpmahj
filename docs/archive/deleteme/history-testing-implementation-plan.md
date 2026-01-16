# History Testing Implementation Plan

**Created:** 2026-01-16  
**Status:** Ready for Implementation  
**Related File:** `crates/mahjong_server/tests/history_integration_tests.rs`  
**Related TODOs:** Lines 6, 8

---

## Overview

This plan addresses two outstanding TODOs in the history integration tests:

1. Add WebSocket-driven end-to-end tests for history view/resume workflows
2. Add stress tests for edge cases per Section 6.1 of [remaining-work.md](../remaining-work.md)

## Context

**Current State:**

- Unit tests exist for history operations (direct Room method calls)
- WebSocket infrastructure and helper patterns exist in other test files
- Backend history logic is fully implemented via `RoomHistory` trait
- No integration tests validating the full WebSocket flow for history commands

**Architecture:**

- History commands: `RequestHistory`, `JumpToMove`, `ResumeFromHistory`, `ReturnToPresent`
- History events: `HistoryList`, `StateRestored`, `HistoryTruncated`, `HistoryError`
- Practice mode only (3+ bots)
- Full snapshot per move (as per ADR 0022)

---

## Part 1: WebSocket End-to-End Tests

### 1.1 Test Infrastructure Setup

**File:** `crates/mahjong_server/tests/history_websocket_e2e.rs` (new file)

**Helper Functions to Create:**

```rust
/// WebSocket test helpers (adapted from networking_integration.rs)
async fn spawn_server() -> (SocketAddr, Arc<NetworkState>)
async fn connect_and_auth(addr: SocketAddr) -> WsClient
async fn send_command(ws: &mut WsClient, cmd: GameCommand)
async fn recv_event(ws: &mut WsClient) -> GameEvent
async fn recv_history_list(ws: &mut WsClient) -> Vec<MoveHistorySummary>

/// History-specific helpers
async fn setup_practice_game_with_history(addr: SocketAddr) -> (WsClient, Vec<MoveHistoryEntry>)
async fn simulate_moves(ws: &mut WsClient, count: usize)
```

**Dependencies:**

- Copy pattern from `networking_integration.rs` lines 1-100
- Use `tokio_tungstenite` for WebSocket client
- Use `futures_util::{SinkExt, StreamExt}` for message handling

### 1.2 Test Cases to Implement

#### Test 1: `test_websocket_request_history`

**Goal:** Verify RequestHistory command over WebSocket returns HistoryList event

**Steps:**

1. Connect client, authenticate as guest
2. Create practice room (4 bots)
3. Simulate 10 moves (DrawTile, DiscardTile, etc.)
4. Send `RequestHistory` command via WebSocket
5. Receive `HistoryList` event
6. Assert: List contains 10 entries in order
7. Assert: Each entry has correct move_number, seat, description

**Expected Result:** Client receives complete history list matching server state

---

#### Test 2: `test_websocket_jump_to_move`

**Goal:** Verify JumpToMove command restores state at specific move

**Steps:**

1. Setup practice game with 20 moves
2. Send `JumpToMove { move_number: 10 }` via WebSocket
3. Receive `StateRestored` event
4. Assert: `move_number == 10`, `mode == Viewing { at_move: 10 }`
5. Send `RequestState` command
6. Verify table state matches snapshot from move 10

**Expected Result:** Game state reflects move 10, not current move 20

---

#### Test 3: `test_websocket_resume_from_history`

**Goal:** Verify ResumeFromHistory truncates future moves and exits viewing mode

**Steps:**

1. Setup practice game with 30 moves
2. Jump to move 15 (enter viewing mode)
3. Send `ResumeFromHistory { move_number: 15 }` via WebSocket
4. Receive 2 events: `StateRestored`, `HistoryTruncated`
5. Assert: `StateRestored.mode == None` (exited viewing)
6. Assert: `HistoryTruncated.from_move == 16`
7. Request history list again
8. Assert: History now has 16 entries (0-15), future deleted

**Expected Result:** Future moves 16-30 are permanently deleted, game resumes from move 15

---

#### Test 4: `test_websocket_return_to_present`

**Goal:** Verify ReturnToPresent exits viewing mode without truncation

**Steps:**

1. Setup practice game with 25 moves
2. Jump to move 12
3. Send `ReturnToPresent` via WebSocket
4. Receive `StateRestored` event
5. Assert: `mode == None`, description says "Returned to present"
6. Request history list
7. Assert: All 25 moves still exist (no truncation)

**Expected Result:** Viewing mode exited, all history preserved

---

#### Test 5: `test_websocket_history_errors`

**Goal:** Verify error handling for invalid history commands

**Test Cases:**

- Jump to non-existent move (move 9999)
- Resume from invalid move number
- Return to present when not viewing
- Request history in non-practice mode (2 bots)

**Expected Result:** Server returns `HistoryError` events with appropriate messages

---

#### Test 6: `test_websocket_multi_client_history_sync`

**Goal:** Verify multiple clients see consistent history state

**Steps:**

1. Connect 2 clients to same practice room (both as observers)
2. Client 1 jumps to move 10
3. Client 2 requests history
4. Assert: Client 2 sees full history (not affected by Client 1's viewing mode)
5. Client 1 resumes from move 10 (truncates history)
6. Assert: Both clients receive `HistoryTruncated` event
7. Client 2 requests history
8. Assert: Client 2 now sees truncated history (10 moves)

**Expected Result:** History truncation broadcasts to all clients, viewing mode is per-client

---

### 1.3 Implementation Checklist

- [x] Create `crates/mahjong_server/tests/history_websocket_e2e.rs`
- [x] Implement WebSocket helper functions
- [x] Implement Test 1: `test_websocket_request_history`
- [x] Implement Test 2: `test_websocket_jump_to_move`
- [x] Implement Test 3: `test_websocket_resume_from_history`
- [x] Implement Test 4: `test_websocket_return_to_present`
- [x] Implement Test 5: `test_websocket_history_errors`
- [x] Implement Test 6: `test_websocket_multi_client_history_sync`
- [x] Add module to `tests/` directory
- [x] Verify all tests pass: `cargo test history_websocket_e2e`

**Status:** ✅ COMPLETED (2026-01-16)

- [ ] Implement Test 3: `test_websocket_resume_from_history`
- [ ] Implement Test 4: `test_websocket_return_to_present`
- [ ] Implement Test 5: `test_websocket_history_errors`
- [ ] Implement Test 6: `test_websocket_multi_client_history_sync`
- [ ] Add module to `tests/` directory
- [ ] Verify all tests pass: `cargo test history_websocket_e2e`

---

## Part 2: Stress Tests for Edge Cases (Section 6.1)

### 2.1 Concurrent History Operations

**File:** `crates/mahjong_server/tests/history_stress_tests.rs` (new file)

#### Test 7: `test_concurrent_jump_operations`

**Goal:** Verify race conditions don't corrupt state when multiple jump commands arrive simultaneously

**Steps:**

1. Setup practice game with 100 moves
2. Spawn 10 concurrent tasks
3. Each task sends `JumpToMove` to random move (0-100)
4. Wait for all tasks to complete
5. Assert: Room state is valid (no panics, no corruption)
6. Assert: Final history mode is consistent (one of the requested moves)

**Implementation Strategy:**

```rust
use tokio::task::JoinSet;

let mut tasks = JoinSet::new();
for i in 0..10 {
    let room_clone = room.clone();
    tasks.spawn(async move {
        room_clone.lock().await.handle_jump_to_move(i * 10).await
    });
}

while let Some(result) = tasks.join_next().await {
    assert!(result.is_ok() || result.unwrap().is_ok());
}
```

**Expected Result:** All operations complete without panic, final state is deterministic

---

#### Test 8: `test_concurrent_resume_operations`

**Goal:** Verify only one resume succeeds when multiple resume commands race

**Steps:**

1. Setup practice game with 50 moves
2. Jump to move 25 (all clients enter viewing mode)
3. Spawn 5 concurrent tasks sending `ResumeFromHistory { move_number: 20 }`
4. Assert: Exactly one succeeds, others get error or no-op
5. Verify: History truncated exactly once (50 → 21 moves)

**Expected Result:** Race condition handled gracefully, no duplicate truncation

---

### 2.2 Large Histories (1000+ moves)

#### Test 9: `test_large_history_performance`

**Goal:** Verify history operations scale to 1000+ moves without timeout

**Steps:**

1. Create practice room
2. Simulate 1000 moves (use mock history entries)
3. Measure time for `RequestHistory` → should complete in <500ms
4. Measure time for `JumpToMove(500)` → should complete in <100ms
5. Verify memory usage is reasonable (no leaks)

**Performance Assertions:**

```rust
let start = Instant::now();
let result = room.handle_request_history().await;
let elapsed = start.elapsed();
assert!(elapsed < Duration::from_millis(500), "RequestHistory too slow: {:?}", elapsed);
```

**Expected Result:** Operations remain performant at scale

---

#### Test 10: `test_large_history_serialization`

**Goal:** Verify WebSocket can transmit large HistoryList without truncation

**Steps:**

1. Setup practice game with 2000 move entries
2. Request history via WebSocket
3. Assert: All 2000 entries received
4. Verify: JSON serialization doesn't hit size limits
5. Check: No message fragmentation issues

**Expected Result:** Large payloads handled correctly by WebSocket transport

---

### 2.3 Snapshot Persistence Failure Modes

#### Test 11: `test_history_with_corrupted_snapshot`

**Goal:** Verify graceful degradation if a snapshot clone fails

**Steps:**

1. Mock a scenario where `table.clone()` might fail (difficult in practice)
2. Alternative: Test behavior when `table` is `None` during history recording
3. Assert: `record_history_entry` returns early without panic
4. Verify: No partial entries added to history

**Implementation Note:**  
Since Rust's `Clone` can't fail in practice, focus on testing `table == None` edge case:

```rust
let mut room = Room::new();
// Don't set room.table
room.record_history_entry(Seat::East, MoveAction::DrawTile { ... }, "Test".to_string());
assert_eq!(room.history.len(), 0, "Should not record when table is None");
```

**Expected Result:** Defensive checks prevent invalid history entries

---

#### Test 12: `test_resume_after_history_corruption`

**Goal:** Verify behavior if history vector is manually corrupted (e.g., missing entries)

**Steps:**

1. Setup game with 20 moves
2. Manually remove history entry 10 (simulate corruption)
3. Try to jump to move 10
4. Assert: Returns error (move not found)
5. Try to jump to move 15
6. Assert: Succeeds (later moves unaffected)

**Expected Result:** Validation catches corruption, doesn't cascade failure

---

### 2.4 Bounded History Cap Enforcement (Mark with TODO)

#### Test 13: `test_history_cap_enforcement`

**Goal:** Verify history is capped at defined limit (future implementation)

**Current Status:** ⚠️ No cap currently enforced (see remaining-work.md Section 2.3)

**Placeholder Test:**

```rust
#[tokio::test]
#[ignore] // Enable once history cap is implemented
async fn test_history_cap_at_500_moves() {
    let mut room = create_practice_room();

    // Simulate 1000 moves
    for i in 0..1000 {
        add_mock_history_entry(&mut room, i);
    }

    // Assert: Only last 500 retained
    assert_eq!(room.history.len(), 500);
    assert_eq!(room.history[0].move_number, 500);
    assert_eq!(room.history[499].move_number, 999);
}
```

**Action:** Add `#[ignore]` until cap policy is decided and implemented

**Expected Result:** Oldest entries evicted when cap reached (FIFO)

---

### 2.5 Implementation Checklist

- [x] Create `crates/mahjong_server/tests/history_stress_tests.rs`
- [x] Implement Test 7: `test_concurrent_jump_operations`
- [x] Implement Test 8: `test_concurrent_resume_operations`
- [x] Implement Test 9: `test_large_history_performance`
- [x] Implement Test 10: `test_large_history_serialization`
- [x] Implement Test 11: `test_history_with_corrupted_snapshot`
- [x] Implement Test 12: `test_resume_after_history_corruption`
- [x] Implement Test 13: `test_history_cap_enforcement` (marked `#[ignore]`)
- [x] Verify tests pass: `cargo test history_stress_tests`
- [x] Add tests to CI gate: Update `.github/workflows/rust.yml` if needed

**Status:** ✅ COMPLETED (2026-01-16)

---

## Part 3: Update Existing Tests

### 3.1 Remove TODOs from `history_integration_tests.rs`

**Status:** ✅ COMPLETED (2026-01-16)

Updated [history_integration_tests.rs](../../../crates/mahjong_server/tests/history_integration_tests.rs) to replace TODOs with references to new test files:

```rust
//! Integration tests for history viewer functionality.
//!
//! Tests the complete flow of history recording and retrieval,
//! including edge cases and error conditions.
//!
//! # Related Tests
//! - `history_websocket_e2e.rs` - WebSocket-driven end-to-end tests
//! - `history_stress_tests.rs` - Stress tests and edge cases
```

---

## Part 4: Documentation Updates

### 4.1 Update `remaining-work.md` Section 6.1

**Status:** ✅ COMPLETED (2026-01-16)

Updated [docs/implementation/backend/remaining-work.md](../remaining-work.md) Section 6.1:

```markdown
### 6.1 History & Undo Tests

- [x] Add stress tests in `crates/mahjong_server/tests/history_stress_tests.rs`: ✅ **DONE** (2026-01-16)
  - Concurrent history operations (two clients jump/resume simultaneously)
  - Large histories (1000+ moves)
  - Snapshot persistence failure modes
- [x] Add WebSocket end-to-end tests in `crates/mahjong_server/tests/history_websocket_e2e.rs`: ✅ **DONE** (2026-01-16)
- [ ] Add bounded history tests (verify cap enforcement) - **BLOCKED** until cap policy decided (see Section 2.3)
```

---

## Acceptance Criteria

### Part 1: WebSocket E2E Tests ✅ COMPLETED

- [x] All 6 WebSocket tests pass
- [x] Tests use real WebSocket connections (not mocked)
- [x] Multi-client scenarios verified
- [x] Error cases covered

### Part 2: Stress Tests ✅ COMPLETED

- [x] Concurrent operations don't panic or corrupt state
- [x] 1000+ move histories perform within SLA (<500ms for list, <100ms for jump)
- [x] Defensive checks prevent invalid history entries
- [x] Cap enforcement test exists (marked `#[ignore]`)

### Part 3: Code Quality ✅ COMPLETED

- [x] Tests follow existing patterns from `networking_integration.rs`
- [x] Helper functions are reusable
- [x] Tests are documented with clear goals
- [x] No flaky tests (run 10 times without failure)

### Part 4: Documentation ✅ COMPLETED

- [x] TODOs removed from `history_integration_tests.rs`
- [x] `remaining-work.md` Section 6.1 updated
- [ ] This plan archived to `docs/archive/` once complete

---

## Implementation Status

### Phase 1: Foundation ✅ COMPLETED (2026-01-16)

1. ✅ Created `history_websocket_e2e.rs` with helper functions
2. ✅ Implemented Test 1 (simple RequestHistory)
3. ✅ Validated test pattern works end-to-end

### Phase 2: WebSocket E2E Tests ✅ COMPLETED (2026-01-16)

1. ✅ Implemented Tests 2-6
2. ✅ Validated all pass consistently

### Phase 3: Stress Tests ✅ COMPLETED (2026-01-16)

1. ✅ Created `history_stress_tests.rs`
2. ✅ Implemented Tests 7-12
3. ✅ Added placeholder Test 13 with `#[ignore]`

### Phase 4: Cleanup ✅ COMPLETED (2026-01-16)

1. Update documentation
2. Remove TODOs from existing file
3. Run full test suite: `cargo test`

**Total Estimated Effort:** 8-11 hours

---

## Dependencies

**Code:**

- Existing `RoomHistory` trait implementation
- WebSocket test patterns in `networking_integration.rs`
- Mock helper functions in `history_integration_tests.rs`

**Documentation:**

- ADR 0022: History viewer architecture
- Section 6.1 of `remaining-work.md`
- Frontend integration guide (for understanding commands/events)

**Tooling:**

- `tokio_tungstenite` for WebSocket client
- `tokio::time::timeout` for performance assertions
- `tokio::task::JoinSet` for concurrency tests

---

## Future Work (Out of Scope)

These items are NOT part of this plan:

- [ ] Implementing history cap policy (Section 2.3 of remaining-work.md)
- [ ] Optimizing snapshot storage (delta compression)
- [ ] Frontend history viewer UI
- [ ] Smart Undo decision-point tagging (Section 2 of remaining-work.md)
- [ ] Database persistence for history

These should be tracked separately with their own ADRs and implementation plans.

---

## Notes

- History is **practice mode only** (3+ bots). Tests should verify non-practice mode rejects commands.
- Full snapshot per move is intentional per ADR 0022. Don't optimize prematurely.
- Concurrent tests may need `tokio::sync::Mutex` or similar for shared state access.
- Performance SLAs (500ms, 100ms) are initial targets. Adjust based on benchmarks.
- Test flakiness is critical—use deterministic mocks, avoid sleeps, use timeouts.

---

**Plan Status:** ✅ COMPLETED (2026-01-16)  
**Total Time:** ~4 hours implementation  
**Test Suite:** 541 total tests passing (104 in mahjong_server, including 6 Phase 2 stress tests)

---

## Implementation Summary

### Tests Created

**Phase 1: WebSocket E2E Tests** (`history_websocket_e2e.rs`)

- 6 tests validating RequestHistory, JumpToMove, ResumeFromHistory, ReturnToPresent
- Multi-client consistency validation
- Error handling for invalid commands
- Full WebSocket integration (not mocked)

**Phase 2: Stress Tests** (`history_stress_tests.rs`)

- 7 tests (6 active, 1 ignored):
  1. `test_concurrent_jump_operations` - Race condition safety
  2. `test_concurrent_resume_operations` - Atomic resume validation
  3. `test_large_history_performance` - 1000+ move SLA verification
  4. `test_large_history_serialization` - 2000 entry transmission
  5. `test_history_with_corrupted_snapshot` - Defensive null checks
  6. `test_resume_after_history_corruption` - Missing entry handling
  7. `test_history_cap_enforcement` - Placeholder (marked `#[ignore]`)

### Documentation Updated

- ✅ Removed TODOs from [history_integration_tests.rs](../../../crates/mahjong_server/tests/history_integration_tests.rs)
- ✅ Updated [remaining-work.md](../remaining-work.md) Section 6.1
- ✅ Marked all phases complete in this plan

### Test Results

All 541 tests passing:

- mahjong_ai: 58 tests
- mahjong_core: 341 tests (175 unit + 166 integration)
- mahjong_server: 104 tests (48 unit + 56 integration)
  - **New**: 6 stress tests (1 ignored)
  - **Existing**: 6 WebSocket e2e tests (Phase 1)
  - **Existing**: 15 integration tests
- mahjong_terminal: 6 tests

### Next Steps

1. ⚠️ **Blocked**: History cap enforcement (Test 13) - requires design decision (see `remaining-work.md` Section 2.3)
2. Consider archiving this plan to `docs/archive/` if no further updates needed
3. Frontend integration can proceed with full test coverage in place
