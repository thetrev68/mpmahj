**Reference**

This plan expands Phase 0 from `docs/implementation/13-backend-gap-analysis.md` into an implementation-ready WBS.

# Phase 0 Implementation Plan (Baseline Rules Parity)

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

## 0.2## 0.2 Scoring + Settlement (Core + Server)

**Goal:** Authoritative scoring and settlement for completed hands.

**Entry criteria:**

- Pattern validation returns a winning pattern id for valid hands.
- Win type (self-draw vs called) is available in win context.

**Implementation steps:**

1. **Core scoring model**
   - Extend `GameResult` with `ScoreBreakdown`, per-seat totals, and dealer rotation metadata.
   - Define modifiers for concealed vs exposed and self-draw vs called discard.
2. **Core scoring logic**
   - Implement score calculation in `apply_declare_mahjong`.
   - Add no-winner handling (wall exhausted) and dealer rotation rules.
3. **Server persistence**
   - Persist scores in game records and player stats.
   - Include scoring in replay snapshots and final state.
4. **Tests**
   - Verify scoring for self-draw vs called discard.
   - Verify dealer rotation on wins and draws.

**Exit criteria:**

- `GameResult` includes points/payouts and dealer rotation metadata.
- Server persists scores and player stats for completed games.
- Scoring and rotation tests pass.

## 0.3 Ruleset Metadata (Core + Server)

**Goal:** Persist the exact ruleset used for every game.

**Entry criteria:**

- Ruleset defaults exist (current card year + default house rules).
- Table creation accepts a ruleset configuration.

**Implementation steps:**

1. **Core ruleset expansion**
   - Extend `HouseRules` with card year and rule flags (joker limits, timer mode).
2. **State propagation**
   - Store ruleset in `Table` and include it in `GameStateSnapshot`.
3. **Server persistence**
   - Persist ruleset metadata with game records and snapshots.
4. **Tests**
   - Replay reconstruction includes ruleset metadata.

**Exit criteria:**

- Ruleset metadata is present in snapshots and replay records.
- Reconnect snapshot contains full ruleset.
- Ruleset tests pass.

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

**Goal:** Align timers with ruleset and enforce or display them correctly.

**Entry criteria:**

- `HouseRules` has timer durations for call window and Charleston.
- Server has a tick or scheduling mechanism available.

**Implementation steps:**

1. **Core timer usage**
   - Use `HouseRules` durations for call window and Charleston.
   - Add `TimerMode` (Passive/Enforced) to ruleset.
2. **Server policy**
   - Enforced: auto-pass or auto-tile selection on timeout.
   - Passive: emit “timer expired” event with no auto-advance.
3. **Tests**
   - Passive mode never advances without command.
   - Enforced mode triggers correct auto action.

**Exit criteria:**

- Timer behavior matches ruleset (passive vs enforced).
- Call window and Charleston use configured durations.
- Timer tests pass.

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
