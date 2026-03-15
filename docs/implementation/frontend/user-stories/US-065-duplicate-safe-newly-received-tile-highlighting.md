# US-065: Duplicate-Safe Newly Received Tile Highlighting

## Status

- State: Proposed
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
