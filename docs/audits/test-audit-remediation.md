# Test Audit Remediation Plan

**Created:** 2026-03-26
**Last Updated:** 2026-03-26
**Status:** In Progress

## Summary

Audit of ~128 test files found the suite heavily weighted toward happy-path and trivial rendering
tests (~40% low-value), with significant gaps in edge-case, error-handling, and cross-feature
interaction coverage. This plan tracks remediation work.

## Metrics (Pre-Remediation Baseline)

| Category             | % of tests | Value                                              |
| -------------------- | ---------- | -------------------------------------------------- |
| Happy-path / trivial | ~40%       | Low — "renders correctly", CSS class, prop display |
| Duplicative          | ~15%       | Zero — same behavior tested multiple ways          |
| Real logic / states  | ~30%       | High — keepers                                     |
| Edge / error         | ~15%       | High — but needs to be much larger                 |

---

## P0 — Critical (High likelihood of real bugs)

### P0-1: Expand `useMahjongDeclaration` test suite

- **File:** `apps/client/src/hooks/useMahjongDeclaration.test.ts`
- **Problem:** Only 2 tests for a critical game flow hook with 8 handler functions.
- **Tests added (16 total, up from 2):**
  - [x] Cancel flow: `handleMahjongCancel` resets dialog + loading state
  - [x] Cancel after confirm clears loading state
  - [x] Validation submit: `handleMahjongValidationSubmit` sends command + sets loading
  - [x] SET_MAHJONG_DECLARED action: sets declared message for announcing player
  - [x] SET_AWAITING_MAHJONG_VALIDATION action: stores called tile + discardedBy
  - [x] SET_MAHJONG_VALIDATED (valid=true): clears all loading/dialog/message state
  - [x] SET_MAHJONG_VALIDATED (valid=false): clears dialog, sets dead hand notice, resets processing
  - [x] SET_PLAYER_SKIPPED action: sets skip notice message
  - [x] Dead hand overlay: local player gets overlay, remote player does not
  - [x] Dead hand persistence: multiple dead hand declarations accumulate in Set
  - [x] Duplicate dead hand for same player does not grow the Set
  - [x] Overlay visibility control (dismiss preserves data)
  - [x] Unhandled action type: `handleUiAction` returns false
  - [x] Initial dead players: hook reads `players[].status === 'Dead'` from snapshot
- **Status:** ✅ Complete

### P0-2: Reconnect during pending intent

- **File:** `apps/client/src/features/game/DisconnectReconnect.integration.test.tsx`
- **Problem:** No test for socket dropping while a call intent or discard command is in-flight.
- **Tests added (2 new):**
  - [x] Reconnect during discard staging: clears staged tile, restores interactivity
  - [x] Reconnect during call window: clears call window state, transitions to correct phase
- **Bug fix:** Added `CLOSE_CALL_WINDOW` + `RESET_PLAYING_STATE` dispatch in
  `useGameEvents.handleStateSnapshotEnvelope` — transient playing-phase UI state was persisting
  across reconnection because the Zustand store was never cleared on snapshot arrival.
- **Status:** ✅ Complete

### P0-3: Call window + discard staging collision

- **File:** `apps/client/src/features/game/CallWindow.integration.test.tsx`
- **Problem:** No test for call window opening while player has a tile staged for discard.
- **Tests added (2 new):**
  - [x] Call window opening clears discard selection and transitions to call mode
  - [x] Proceed after call window sends meld intent (not DiscardTile) when claim staged
- **Finding:** Existing code handles this correctly — `PlayingPhase` has a `useEffect` that
  calls `clearSelection()` when `isCallWindowActive` changes. Tests validate this behavior
  and prevent regression.
- **Status:** ✅ Complete

---

## P1 — Important (Moderate likelihood)

### P1-1: Auto-draw gating during call window

- **File:** `apps/client/src/features/game/DrawTile.integration.test.tsx`
- **Problem:** DrawTile tests assume no call window is active.
- **Status:** 🔴 Not Started

### P1-2: Multi-phase Charleston sequence

- **File:** New or extend `Charleston.integration.test.tsx`
- **Problem:** Each phase tested in isolation; state leakage between phases untested.
- **Status:** 🔴 Not Started

### P1-3: Blind pass `forward_incoming_count` validation

- **File:** `CharlestonFirstRight.integration.test.tsx` or new
- **Problem:** `forward_incoming_count` field completely untested in integration.
- **Status:** 🔴 Not Started

### P1-4: Rapid reconnect cascade (3+ cycles)

- **File:** `DisconnectReconnect.integration.test.tsx`
- **Problem:** Only 1 reconnect cycle tested. Flaky networks cause rapid cycles.
- **Status:** 🔴 Not Started

---

## P2 — Hardening

### P2-1: Invalid/malformed event payloads

- **Problem:** Decoder gap (known) means bad payloads pass through unchecked.
- **Status:** 🔴 Not Started

### P2-2: Score formatting edge cases

- **Problem:** ScoringScreen has no tests for negative scores, large numbers, mixed payments.
- **Status:** 🔴 Not Started

---

## Cleanup — Low-Value Test Reduction

### CL-1: Consolidate CharlestonFirstAcross into FirstRight (parameterized)

- **Status:** 🔴 Not Started

### CL-2: Merge turn-discard.integration into Playing.integration

- **Status:** 🔴 Not Started

### CL-3: Trim gameUIStore trivial SET_X tests

- **Status:** 🔴 Not Started

### CL-4: Trim Tile.test.tsx trivial class/default tests

- **Status:** 🔴 Not Started

### CL-5: Trim ScoringScreen.test.tsx prop-forwarding tests

- **Status:** 🔴 Not Started

---

## Progress Log

| Date       | Item | Action                                        | Notes                                  |
| ---------- | ---- | --------------------------------------------- | -------------------------------------- |
| 2026-03-26 | —    | Audit completed, plan created                 | —                                      |
| 2026-03-26 | P0-1 | Expanded useMahjongDeclaration: 2 → 16 tests  | All handler paths + edge cases         |
| 2026-03-26 | P0-2 | Added reconnect-during-intent tests + bug fix | Store not clearing on snapshot — fixed |
| 2026-03-26 | P0-3 | Added call window + discard collision tests   | Existing behavior correct, now guarded |
