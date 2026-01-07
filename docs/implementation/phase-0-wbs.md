# Phase 0 Implementation Plan (Baseline Rules Parity)

This plan expands Phase 0 from `docs/implementation/13-backend-gap-analysis.md` into an implementation-ready WBS.

This file is the implementation plan itself. It is intentionally detailed enough to hand off directly.

**Carryover:** Update `crates/mahjong_server/src/db_simple.rs` to embed ruleset metadata in `final_state` and align the `finish_game()` signature with `crates/mahjong_server/src/db.rs`. (Carryover from Phase 0.3 implementation parity.)

## 0.1 Call Priority + Adjudication (Core + Server) ✅ COMPLETE

**Status:** Implemented and tested (2026-01-05)

**Goal:** Deterministic adjudication when multiple players can call the same discard.

**Implementation Summary:**

- Added CallIntent, CallIntentKind, and CallResolution types in call_resolution.rs
- Implemented resolve_calls() function with priority rules (Mahjong > Meld, seat order tie-breaks)
- Added DeclareCallIntent command to replace direct CallTile during call windows
- Extended TurnStage::CallWindow with pending_intents vector
- Added CallResolved event for broadcasting resolution results
- Implemented resolve_call_window() in Table to process buffered intents
- Added comprehensive unit tests (7 tests) and integration tests (4 tests)
- Generated TypeScript bindings for frontend

**Exit criteria:**

- ✅ Multiple call intents in the same window resolve deterministically
- ✅ Call resolution emits a single winner event and closes the window
- ✅ Tests for priority and tie-breaks pass (116 total tests passing)

## 0.2 Scoring + Settlement (Core + Server) ✅ COMPLETE

**Status:** Implemented and tested (2026-01-05)

**Goal:** Authoritative scoring and settlement for completed hands.

**Implementation Summary:**

- Extended `GameResult` with `ScoreBreakdown`, `ScoreModifiers`, per-seat `final_scores`, `next_dealer`, and `GameEndCondition`
- Added new `scoring.rs` module with score calculation functions (base score, concealed bonus, dealer bonus, self-draw payment rules)
- Implemented dealer rotation logic: dealer retains on win, rotates clockwise otherwise
- Added `WallExhausted` event and proper state transitions for draw conditions
- Updated `apply_declare_mahjong` and `apply_draw_tile` to calculate scores on win/draw
- Extended `PlayerStats` in server to track `total_score`, `highest_score`, `lowest_score`
- Generated TypeScript bindings for all new types
- Added 7 integration tests covering self-draw, called discard, dealer rotation, and wall exhaustion

**Exit criteria:**

- ✅ `GameResult` includes points/payouts and dealer rotation metadata
- ✅ Server persists scores and player stats for completed games
- ✅ Scoring and rotation tests pass (134 total tests passing)

## 0.3 Ruleset Metadata (Core + Server) ✅ COMPLETE

**Status:** Implemented and tested (2026-01-06)

**Goal:** Persist the exact ruleset used for every game.

**Implementation Summary:**

- Added `TimerMode` enum (Visible/Hidden) and `Ruleset` struct with card year, timer mode, and game rule configuration
- Refactored `HouseRules` to contain `Ruleset` (breaking change from flat structure)
- Added `HouseRules::with_card_year()` and `HouseRules::with_ruleset()` convenience constructors
- Updated `Table::new_with_rules()` to accept custom `HouseRules`
- Added `GameStateSnapshot::card_year()` and `timer_mode()` accessor methods
- Implemented `load_validator(card_year)` for multi-year card support (2017-2020, 2025)
- Extended `Room` struct with `house_rules` field for configurable ruleset per room
- Updated `Room::start_game()` to load validator based on configured card year
- Modified `Database::finish_game()` to persist ruleset metadata (card_year, timer_mode) in final_state JSON
- Added `RoomStore::create_room_with_rules()` and `create_room_with_db_and_rules()` methods
- Generated TypeScript bindings for all new types
- Added 9 unit tests for ruleset functionality and 6 integration tests

**Exit criteria:**

- ✅ `HouseRules` contains complete `Ruleset` with card year and timer mode
- ✅ `Table` creation accepts custom ruleset configuration
- ✅ `GameStateSnapshot` includes full ruleset with accessor methods
- ✅ Server loads validators by card year (multi-year infrastructure complete)
- ✅ Server persists ruleset metadata with game records
- ✅ Room creation supports custom ruleset via `RoomStore` methods
- ✅ All tests pass (152 total tests passing)

## 0.4 Joker Restrictions (Core + Data + Validator) ✅ COMPLETE

**Status:** Implemented and tested (2026-01-06)

**Goal:** Enforce NMJL joker restrictions in validation.

**Implementation Summary:**

- Added `ineligible_histogram` to unified card variations and analysis entries
- Updated strict joker deficiency logic in `Hand::calculate_deficiency()`
- Generated strict histograms from the CSV with a flower override
- Added strict joker tests, including a flower substitution case
- Moved card tooling and CSV to `scripts/card_tools/`

**Status:** PLANNED (discussion in progress; histogram-only enforcement backed out)

**Entry criteria:**

- Unified card data is the source of truth for pattern metadata.
- Validator already supports histogram-based validation.

**Implementation steps:**

1. **Card data schema**
   - Add joker limit metadata to `UnifiedCard` pattern/variation entries.
2. **Validator enforcement**
   - Enforce no-joker pairs unless explicitly allowed.
   - Reject patterns exceeding the per-variation joker limit.
3. **Tests**
   - Excess jokers rejected, allowed joker pairs accepted only where allowed.

**Exit criteria:**

- ✅ Jokers are blocked for singles, pairs, and flowers.
- ✅ Jokers are allowed only for 3+ identical groups.
- ✅ Joker restriction tests pass.

## 0.5 Courtesy Pass Negotiation (Core + Server)

**Goal:** Implement full courtesy pass negotiation.

**Entry criteria:**

- Charleston stage reaches CourtesyAcross and accepts commands.
- Player seats are paired across (E/W, N/S).

**Implementation steps:**

1. **Core command flow**
   - Implement `ProposeCourtesyPass` and `AcceptCourtesyPass` handshake.
   - Resolve disagreements by selecting the smaller proposal.
2. **Core events**
   - Emit per-pair negotiation events (E/W and N/S separately).
3. **Server orchestration**
   - Send negotiation events only to the two seats involved.
4. **Tests**
   - Mixed proposals resolve to smallest.
   - Parallel negotiations do not leak across pairs.

**Exit criteria:**

- Courtesy pass negotiation completes for both pairs independently.
- Result uses smallest proposed count when mismatched.
- Courtesy pass tests pass.

## 0.6 Timer Behavior (Core + Server)

**Goal:** Align timers with ruleset and display them correctly.

**Entry criteria:**

- `HouseRules` has timer durations for call window and Charleston.
- Server has a tick or scheduling mechanism available.

**Implementation steps:**

1. **Core timer usage**
   - Use `HouseRules` durations for call window and Charleston.
   - Add `TimerMode` (Visible/Hidden) to ruleset.
2. **Server display**
   - Visible: Timer shown to players but never auto-advances (visual indicator only).
   - Hidden: No timer shown at all (no time pressure).
3. **Tests**
   - Visible mode displays timer but never auto-advances.
   - Hidden mode shows no timer UI.

**Exit criteria:**

- Timer visibility matches ruleset (visible vs hidden).
- Call window and Charleston use configured durations.
- Timer tests pass.
- **Note:** Auto-advance functionality is not implemented - timers are for display/pacing only.

## 0.7 Deterministic Replay Inputs (Core + Server + Replay)

**Status:** PLANNED

**Goal:** Ensure replay and undo/time-travel are deterministic by persisting wall state, RNG seeds, and replacement draws.

**Detailed Plan:** See [phase-0-7-deterministic-replay-plan.md](phase-0-7-deterministic-replay-plan.md)

**Entry criteria:**

- Replay service can reconstruct state from event logs.
- Event recording infrastructure exists.
- Wall shuffle is deterministic with seeds.

**Implementation steps:**

1. **Core wall state** ([§0.7.1-0.7.3](phase-0-7-deterministic-replay-plan.md#071-core---add-wall-state-fields))
   - Add `seed`, `break_point` to `Wall` struct
   - Add `ReplacementDrawn` event and `ReplacementReason` enum
   - Emit replacement draw events in `apply_call_tile()` and blank exchange
2. **Snapshot infrastructure** ([§0.7.4-0.7.6](phase-0-7-deterministic-replay-plan.md#074-core---add-wall-state-to-snapshot))
   - Extend `GameStateSnapshot` with wall state fields
   - Implement `Table::from_snapshot()` for state restoration
   - Add periodic snapshot recording at phase boundaries
3. **Database persistence** ([§0.7.5-0.7.6](phase-0-7-deterministic-replay-plan.md#075-server---store-wall-state-in-database))
   - Create `snapshots` table with migrations
   - Add `wall_seed` and `wall_break_point` columns to `games` table
   - Implement `record_snapshot()`, `get_snapshot_at()`, `get_events_range()`
4. **Replay reconstruction** ([§0.7.7](phase-0-7-deterministic-replay-plan.md#077-server---replay-reconstruction-with-wall-state))
   - Update `ReplayService::reconstruct_state_at()` to use snapshots
   - Implement `Table::apply_event()` for event-based reconstruction
   - Add replay integrity verification
5. **Tests** ([§0.7.8-0.7.10](phase-0-7-deterministic-replay-plan.md#078-tests---wall-state-persistence))
   - Wall state persistence tests (6 tests)
   - Replacement draw event tests (2 tests)
   - Replay reconstruction integration test (requires database)

**Exit criteria:**

- ✅ Wall order reproducible from seed
- ✅ Break point and draw index persisted in snapshots
- ✅ Replacement draws logged as separate events (`ReplacementDrawn`)
- ✅ Snapshots recorded at phase boundaries (Charleston → Playing → Scoring)
- ✅ `Table::from_snapshot()` restores wall state correctly
- ✅ Replay reconstruction produces identical state
- ✅ Wall state and draw order preserved in snapshots
- ✅ Determinism tests pass (target: 150+ total tests passing)
