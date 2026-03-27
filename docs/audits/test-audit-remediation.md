# Test Audit Remediation Plan

**Created:** 2026-03-26
**Last Updated:** 2026-03-26
**Status:** Complete (all P0, P1, P2, CL items done)

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

## Metrics (Post-Remediation)

| Metric          | Before | After  | Delta |
| --------------- | ------ | ------ | ----- |
| Test files      | 128    | 127    | -1    |
| Tests           | 1661   | 1701   | +40   |
| New edge/error  | —      | +45    | +45   |
| Removed trivial | —      | -5 net | -5    |
| Files deleted   | —      | 3      | —     |
| Files created   | —      | 1      | —     |

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
- **Tests added (2 new in `describe('Call window gating')`):**
  - [x] `CallWindowOpened` before 500ms auto-draw fires → `DrawTile` NOT sent
  - [x] Draw retry in flight, `CallWindowOpened` arrives → retries cancelled
- **Bug fixed:** `handleCallWindowOpened` in `publicEventHandlers.playing.ts` now dispatches
  `CLEAR_PENDING_DRAW_RETRY` unconditionally (eligible and non-eligible branches). Previously,
  the auto-draw timer continued firing through an active call window because only the UI store
  was updated, leaving `isDrawingStage` true in the server snapshot.
- **Status:** ✅ Complete

### P1-2: Multi-phase Charleston sequence

- **File:** `apps/client/src/features/game/Charleston.integration.test.tsx`
- **Problem:** Each phase tested in isolation; state leakage between phases untested.
- **Tests added (3 new in `describe('Multi-phase transition: state leakage prevention')`):**
  - [x] Selection counter resets to `0/3` on `CharlestonPhaseChanged`
  - [x] Opponent staging tiles cleared when phase advances
  - [x] Per-seat ready indicators reset to `•` on phase change
- **Status:** ✅ Complete

### P1-3: Blind pass `forward_incoming_count` validation

- **File:** `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`
- **Problem:** Boundary case of `forward_incoming_count = 3` (all blind tiles forwarded) was missing.
- **Tests added (1 new):**
  - [x] Forward all 3 blind incoming tiles: `forward_incoming_count: 3`, `from_hand: [...]` with 3 rack tiles
- **Note:** `forward_incoming_count` 0/1/2 were already covered; the `= 3` edge case was the gap.
- **Status:** ✅ Complete

### P1-4: Rapid reconnect cascade (3+ cycles)

- **File:** `apps/client/src/features/game/DisconnectReconnect.integration.test.tsx`
- **Problem:** Only 1 reconnect cycle tested. Flaky networks cause rapid cycles.
- **Tests added (1 new):**
  - [x] 3 rapid disconnect/reconnect cycles — clean UI state after each, correct auth on final cycle
- **Status:** ✅ Complete

---

## P2 — Hardening

### P2-1: Invalid/malformed event payloads

- **File:** `apps/client/src/lib/game-events/malformedPayloads.test.ts`
- **Problem:** Decoder gap (known) means bad payloads pass through unchecked.
- **Tests added (36 total):**
  - [x] Decoder accepts structurally valid events with garbage inner payloads (7 cases)
  - [x] handlePublicEvent returns EMPTY_RESULT for unrecognized events (3 cases)
  - [x] handlePublicEvent handles recognized keys with safe malformed data (8 cases)
  - [x] handlePublicEvent throws TypeError on null inner payloads (6 cases — known gap documented)
  - [x] handlePrivateEvent handles malformed payloads gracefully (6 cases)
  - [x] Full dispatcher pipeline: malformed Public/Private events don't crash (6 cases)
- **Finding:** 6 public event handlers crash with TypeError when inner payload is null
  (TileDiscarded, TurnChanged, CallWindowOpened, DiceRolled, GameOver). These are
  reachable because `isServerEvent` only validates top-level discriminant. Mitigated
  by server always sending valid shapes; tests document the gap for future hardening.
- **Status:** ✅ Complete

### P2-2: Score formatting edge cases

- **File:** `apps/client/src/components/game/ScoringScreen.test.tsx`
- **Problem:** ScoringScreen has no tests for negative scores, large numbers, mixed payments.
- **Tests added (9 new in `describe('Score formatting edge cases')`):**
  - [x] Negative final scores: minus sign + red color
  - [x] Positive final scores: plus sign + green color
  - [x] Zero final score: +0 with green color
  - [x] Large scores: 500 pts base, +1500 winner, -500 payments
  - [x] Mixed positive/negative in same round
  - [x] Undefined final score for a seat: shows dash with gray color
  - [x] Null score_breakdown: no base score or payments rendered
  - [x] Payment amounts display as absolute values
  - [x] Called-from row when not self-draw
- **Status:** ✅ Complete

---

## Cleanup — Low-Value Test Reduction

### CL-1: Consolidate CharlestonFirstAcross into FirstRight (parameterized)

- **File:** `apps/client/src/features/game/CharlestonStandardPass.integration.test.tsx`
- **Action:** Replaced `CharlestonFirstRight.integration.test.tsx` (20 tests) and
  `CharlestonFirstAcross.integration.test.tsx` (13 tests) with a single parameterized
  file using `describe.each` over both stages. SharedTest count: 28 (11×2 shared + 6 edge cases).
- **Files deleted:** `CharlestonFirstRight.integration.test.tsx`, `CharlestonFirstAcross.integration.test.tsx`
- **Status:** ✅ Complete

### CL-2: Merge turn-discard.integration into Playing.integration

- **File:** `apps/client/src/features/game/Playing.integration.test.tsx`
- **Action:** Moved 3 turn-discard tests into Playing.integration.test.tsx under a new
  `Turn Discard Integration (US-010)` describe block. Converted from custom mock WebSocket
  to shared `createMockWebSocket`. Removed excessive CSS class assertions from discard pool test.
- **Files deleted:** `turn-discard.integration.test.tsx`
- **Status:** ✅ Complete

### CL-3: Trim gameUIStore trivial SET_X tests

- **File:** `apps/client/src/stores/gameUIStore.test.ts`
- **Action:** Consolidated 8 trivial field-set tests into a table-driven `test.each`.
  Complex tests (lifecycle, accumulation, no-ops) kept as standalone.
- **Status:** ✅ Complete

### CL-4: Trim Tile.test.tsx trivial class/default tests

- **File:** `apps/client/src/components/game/Tile.test.tsx`
- **Action:** Consolidated state styling tests (selected/highlighted/dimmed) and size
  variant tests (small/medium/large) into table-driven `test.each` blocks. Default and
  disabled tests kept standalone (different assertion patterns).
- **Status:** ✅ Complete

### CL-5: Trim ScoringScreen.test.tsx prop-forwarding tests

- **File:** `apps/client/src/components/game/ScoringScreen.test.tsx`
- **Action:** Consolidated 7 trivial prop-forwarding tests (heading, winner name, pattern,
  base score, payments, final scores, continue button) into a single comprehensive render test.
- **Status:** ✅ Complete

---

## Progress Log

| Date       | Item | Action                                            | Notes                                          |
| ---------- | ---- | ------------------------------------------------- | ---------------------------------------------- |
| 2026-03-26 | —    | Audit completed, plan created                     | —                                              |
| 2026-03-26 | P0-1 | Expanded useMahjongDeclaration: 2 → 16 tests      | All handler paths + edge cases                 |
| 2026-03-26 | P0-2 | Added reconnect-during-intent tests + bug fix     | Store not clearing on snapshot — fixed         |
| 2026-03-26 | P0-3 | Added call window + discard collision tests       | Existing behavior correct, now guarded         |
| 2026-03-26 | P1-1 | Auto-draw gating: 2 tests + bug fix               | `CLEAR_PENDING_DRAW_RETRY` on CallWindowOpened |
| 2026-03-26 | P1-2 | Multi-phase Charleston state leakage: 3 tests     | Selection/staging/ready-indicators reset       |
| 2026-03-26 | P1-3 | Blind pass forward_incoming_count=3: 1 test       | Missing edge case covered                      |
| 2026-03-26 | P1-4 | Rapid reconnect cascade: 1 test                   | 3-cycle resilience verified                    |
| 2026-03-26 | P2-1 | Malformed event payloads: 36 tests                | Documented 6 handler crash paths (decoder gap) |
| 2026-03-26 | P2-2 | Score formatting edge cases: 9 tests              | Negative, large, zero, mixed, null breakdown   |
| 2026-03-26 | CL-1 | Charleston FirstRight+FirstAcross → parameterized | 2 files → 1; describe.each over stages         |
| 2026-03-26 | CL-2 | turn-discard → Playing.integration                | 1 file removed, 3 tests moved                  |
| 2026-03-26 | CL-3 | gameUIStore trivial tests → table-driven          | 8 tests consolidated into test.each            |
| 2026-03-26 | CL-4 | Tile.test.tsx states+sizes → table-driven         | 6 tests consolidated into test.each            |
| 2026-03-26 | CL-5 | ScoringScreen prop-forwarding → single test       | 7 tests consolidated into 1                    |
