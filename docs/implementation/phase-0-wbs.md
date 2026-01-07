# Phase 0 Implementation Plan (Baseline Rules Parity)

This plan expands Phase 0 from `docs/implementation/13-backend-gap-analysis.md` into an implementation-ready WBS.

This file is the implementation plan itself. It is intentionally detailed enough to hand off directly.

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

## 0.4 Joker Restrictions (Core + Data + Validator)

**Goal:** Enforce NMJL joker restrictions in validation.

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

- Joker limits are enforced per pattern/variation.
- Joker pair rules are enforced with explicit allowlists.
- Joker restriction tests pass.

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

**Goal:** Ensure replay and undo are deterministic.

**Entry criteria:**

- Replay service can reconstruct state from event logs.
- Snapshots are already stored periodically.

**Implementation steps:**

1. **Core wall state**
   - Persist wall order, break point, and RNG seed in `Table`.
   - Record replacement draws for Kongs/Quints.
2. **Server persistence**
   - Snapshot full wall state and draw index.
   - Replay reconstruction uses wall state rather than `seed=0`.
3. **Tests**
   - Replay integrity checks pass for long games.
   - Replacement draw order reproduced.

**Exit criteria:**

- Replay reconstruction produces identical final state.
- Wall state and draw order are preserved in snapshots.
- Determinism tests pass.
