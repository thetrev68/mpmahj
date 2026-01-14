# Missing Test Coverage

This file tracks test files that need to be created. Once created, delete this file.

## Analysis Integration Tests

**File to create:** `analysis_integration.rs`

**Purpose:** Contract tests for Always-On Analyst

**Test coverage needed:**

- [ ] Verify `AnalysisUpdate` emitted within X ms after DrawTile/DiscardTile
- [ ] Verify no private information leaks (privacy filtering)
- [ ] Test reconnection analysis backfill
- [ ] Test analysis cache invalidation

**Reference:** See `docs/implementation/remaining-work.md` Section 6.2

## Stalling Controls Tests

**File to create:** `stall_controls_tests.rs`

**Purpose:** Integration tests for pause/resume/forfeit flows

**Test coverage needed:**

- [ ] Host pause/resume validation
- [ ] Forfeit with proper finalization
- [ ] Admin override endpoints
- [ ] Persistence to DB and replay reconstruction
- [ ] Concurrency: host pause while player reconnects

**Reference:** See `docs/implementation/remaining-work.md` Section 1

## Performance Benchmarks

**Directory:** `crates/mahjong_ai/benches/` or `crates/mahjong_server/benches/`

**Files to create:**

- `analysis_benchmark.rs` - Test 1000 hands × 500 patterns
- `memory_benchmark.rs` - Test 100 concurrent rooms with full history
- `bandwidth_benchmark.rs` - Measure delta vs full updates

**Reference:** See `docs/implementation/remaining-work.md` Section 6.3

---

**Note:** Once all these tests are created, delete this TODO file.
