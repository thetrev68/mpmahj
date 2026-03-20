# US-065: Duplicate-Safe Newly Received Tile Highlighting

## Status

- State: Completed
- Priority: High
- Batch: G
- Implementation Ready: Yes

## Problem

The yellow "newly arrived" rack glow is currently tile-value based in practice rather than
instance-safe. When a player receives a tile that duplicates one already in hand, both matching
tiles can glow even though only one is new.

That makes the arrival highlight unreliable and actively misleading during sorting, receiving, and
Charleston transitions.

## Scope

**In scope:**

- Make new-arrival highlighting tile-instance-safe when duplicate values exist in the hand.
- Cover receive, draw, and Charleston-related hand updates that use the same highlight mechanism.
- Add tests that prove only the newly added duplicate instance glows.

**Out of scope:**

- Reworking the overall glow style or animation.
- Changing rack sorting policy beyond what is required to preserve correct tile identity.

## Acceptance Criteria

- AC-1: When a player receives a tile whose value already exists in hand, only the newly received
  instance is marked as new.
- AC-2: Pre-existing identical tiles do not gain the new-arrival highlight.
- AC-3: The highlight identity survives the hand-update path after sorting or regrouping.
- AC-4: The same duplicate-safe rule applies to:
  - `TilesReceived`
  - draw/private draw events that use the same new-tile mechanism
  - ordinary pre-blind Charleston receives after `US-058`
- AC-5: If multiple identical tiles are received at once, exactly the received count of instances
  glow, not every matching tile in the hand.
- AC-6: Tests fail if highlight calculation regresses to value-level matching instead of
  instance/count-aware matching.

## Edge Cases

- EC-1: Receiving two identical duplicates when one copy already exists highlights exactly two of
  the three total copies.
- EC-2: Remount during the highlight window may clear the glow timer, but it must not incorrectly
  reassign the glow to older duplicates.
- EC-3: If the hand auto-sorts after receipt, the glow follows the new instance identities rather
  than their pre-sort positions.

## Primary Files (Expected)

- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/stores/gameUIStore.ts`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/lib/game-events/privateEventHandlers.test.ts`
- `apps/client/src/components/game/PlayerRack.test.tsx`

## Notes for Implementer

### Identity rule

This logic must be count-aware or instance-aware, not simple set membership by tile label. The bug
exists because duplicate-value comparison is too coarse for a per-instance highlight effect.

### Charleston dependency

This story intentionally references the receive-first repair from `US-058`. Do not validate only the
old blind-pass staging path; cover the real hand-mutating receive path as well.

## Test Plan

- Event-handler tests:
  - single duplicate receive
  - multiple identical receives
  - receive followed by sort
- Rack rendering tests:
  - only one duplicate instance gets the glow class
  - remount does not move the glow to an older matching tile

## Verification Commands

```bash
cd apps/client
npx vitest run src/lib/game-events/privateEventHandlers.test.ts
npx vitest run src/components/game/PlayerRack.test.tsx
npx tsc --noEmit
```

---

## Codex Implementation Summary

The production handler path was already using count-aware instance IDs, so the implementation work
for this story was to harden that behavior with the missing duplicate-focused regression coverage
instead of rewriting the receive logic unnecessarily.

Implemented coverage:

- `privateEventHandlers.test.ts`
  - duplicate receive with one existing copy highlights only the newly added instance
  - multiple identical receives highlight exactly the received count
  - receive-plus-sort keeps the glow attached to the new duplicate instance IDs
  - duplicate private draw highlights only the newly drawn instance and keeps the staged draw tile
    aligned to that same ID
- `PlayerRack.test.tsx`
  - rack rendering highlights only the duplicate instance IDs passed from the event layer
  - remount keeps the glow pinned to the same duplicate instance instead of moving it to an older
    matching tile

Verification run:

```bash
cd apps/client
npx vitest run src/lib/game-events/privateEventHandlers.test.ts
npx vitest run src/components/game/PlayerRack.test.tsx
npx tsc --noEmit
```

Result:

- All targeted Vitest suites passed.
- `npx tsc --noEmit` passed.
- No broader UI/style changes were made; the story is satisfied by preserving the existing
  instance-safe behavior and adding the regression tests that would fail on a value-level
  implementation.

---

## Claude Code Review

**Verdict: APPROVED — implementation complete and correct.**

All ACs and ECs are satisfied. No bugs found. The tests would catch a regression to value-level matching.

---

### Algorithm Review (`buildNewTileIds`)

**Location:** `privateEventHandlers.ts:53–92`

The core algorithm is instance-safe and count-aware:

1. Builds a `targetCounts` map of how many of each tile value to mark (from `tilesToMark`).
2. Builds an `oldCounts` map of how many of each tile value existed in the old hand.
3. Iterates through `buildTileInstances(newHand)` — instances ordered as `${tile}-0`, `${tile}-1`, etc.
4. For each instance, it only marks `id` when `seen >= oldCount` — meaning the first N copies (matching the old count) are skipped, and only copies beyond that are new.

The key predicate `if (seen >= oldCount)` is what makes this instance-safe rather than value-safe. A value-based bug would mark all copies of a tile value instead of just the surplus ones.

**Minor observation:** The early-exit `if (ids.length === tilesToMark.length) break` (line 88) is a correct optimization — once all needed IDs are found, iteration stops. Safe because IDs are accumulated in sorted order.

---

### State Thread

The ID array flows correctly from handler → store → component:

- `handleTilesReceived` / `handleTileDrawnPrivate` → returns `SET_NEWLY_RECEIVED_TILES` action with instance IDs
- `gameUIStore` reducer sets `newlyReceivedTileIds: string[]`
- `PlayerRack` copies IDs into local state on prop change via `useEffect`, then clears after 10 s

**Timeout discrepancy:** The store side effect clears `highlightedTileIds` at 2000 ms, but PlayerRack's local 10-second timer governs `activeNewlyReceivedTileIds`. This is intentional — the shorter store timeout clears a separate `highlightedTileIds` field (used for draw staging), while the 10-second window is the "newly received" treatment. The two fields serve different purposes and the discrepancy is not a bug, but a comment in PlayerRack would make this clearer.

---

### Acceptance Criteria Walkthrough

| AC                                             | Implemented                                    | Tested                                                              | Notes                                                                   |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| AC-1 Single dup only new instance glows        | ✅ `seen >= oldCount` predicate                | ✅ `privateEventHandlers.test.ts` line ~347                         | Expects `['0-2']`, not `['0-0','0-1','0-2']`                            |
| AC-2 Pre-existing tiles do not glow            | ✅ Same predicate skips them                   | ✅ Same test asserts `'0-0'`/`'0-1'` absent                         |                                                                         |
| AC-3 Highlight survives sort                   | ✅ IDs are recomputed from the sorted new hand | ✅ `privateEventHandlers.test.ts` line ~397                         | Verifies `['1-0', '5-2']` after sort                                    |
| AC-4 Covers TilesReceived + draw               | ✅ Both handlers call `buildNewTileIds`        | ✅ Separate draw test line ~544                                     | Draw test also checks `SET_STAGED_INCOMING_DRAW_TILE` aligns to same ID |
| AC-5 Multiple identical receives — exact count | ✅ `targetCounts` decremented per marked ID    | ✅ `privateEventHandlers.test.ts` line ~372                         | Expects exactly 2 IDs for 2 received, not 3                             |
| AC-6 Tests fail on value-level regression      | ✅ Assertions check exact ID sets              | ✅ Verified — reverting to value matching would flip all assertions |                                                                         |

---

### Edge Case Walkthrough

| EC                                                              | Handled                                                                   | Notes                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| EC-1 Two identical duplicates + one existing → exactly two glow | ✅ `targetCounts` tracks needed count; `seen >= oldCount` gates correctly | Covered by AC-5 test scenario                                            |
| EC-2 Remount must not move glow to older duplicate              | ✅ `PlayerRack.test.tsx` line ~429                                        | Test unmounts and remounts; asserts `'0-2'` keeps glow, `'0-0'` does not |
| EC-3 Post-sort glow follows new instance IDs                    | ✅ IDs derived from sorted hand, not pre-sort positions                   | Covered by AC-3 test                                                     |

---

### Test Quality

The event-handler tests are the critical regression guard. If `buildNewTileIds` reverted to value-level matching:

- The single-dup test would receive `['0-0','0-1','0-2']` but expect `['0-2']` → **immediate failure**.
- The count test would receive 3 IDs but expect 2 → **immediate failure**.

The component tests add a second layer:

- `highlights only the duplicate instance ids provided` asserts `'0-0'` and `'0-1'` do **not** have the glow class alongside `'0-2'`.
- `remount keeps duplicate glow pinned` guards EC-2 by verifying local state is ID-driven, not position-driven.

Both layers are necessary: the handler tests guard the algorithm; the component tests guard the render path.

---

### Findings Summary

| Severity | Finding                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None     | No bugs found                                                                                                                                                                                        |
| Info     | The 2000 ms vs. 10 s timeout difference between `highlightedTileIds` and `newlyReceivedTileIds` is intentional but undocumented in `PlayerRack.tsx`. A short comment would prevent future confusion. |
| Info     | `buildNewTileIds` has no doc comment explaining the instance-safe invariant. Adding one would make the "why `seen >= oldCount`" obvious to the next reader.                                          |
