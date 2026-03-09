# US-043: Charleston Tile-Count Conservation and Hand Integrity

## Status

- State: Proposed
- Priority: Critical
- Batch: D

## Problem

During Charleston progression (reported at first Charleston pass 3 of 3), local rack tile count can become invalid (example observed: 17 tiles), indicating a broken hand/staging conservation path.

## Scope

- Enforce tile-count conservation across Charleston selection, incoming staging, absorb, and commit flows.
- Eliminate duplicate tile materialization between staged-incoming state, absorbed-incoming state, and displayed hand.
- Define phase-legal rack count invariants and assert them in runtime-safe guards/tests.

## Acceptance Criteria

- AC-1: Local rack tile count after each Charleston transition matches server-authoritative legal counts.
- AC-2: No duplicate tile instance IDs or duplicated tile values are introduced by absorb/forward operations.
- AC-3: Entering and exiting each Charleston stage preserves conservation: tiles out + tiles in + hand equals expected total.
- AC-4: On state reconciliation from server events, optimistic local state is corrected without rendering illegal counts.

## Edge Cases

- EC-1: Blind pass stages with hidden incoming tiles preserve counts before and after reveal.
- EC-2: Courtesy pass negotiation and zero-tile agreements do not corrupt hand totals.
- EC-3: Reconnect/replay snapshots during Charleston restore valid local visual state.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/hooks/useTileSelection.ts`
- `apps/client/src/stores/gameUIStore.ts`
- `apps/client/src/components/game/StagingStrip.tsx`

## Notes for Implementer

- Audit interactions between:
  - `displayHand`
  - `stagedIncomingTiles`
  - `absorbedIncomingTiles`
  - `selectedIds`
- Ensure local optimistic transforms do not double-apply once server state arrives.
- Prefer invariant helpers with targeted tests over ad-hoc inline conditionals.

## Test Plan

- Add Charleston conservation tests that step through all pass stages and assert exact counts.
- Add regression test for reported failure case: first Charleston pass 3 of 3 cannot show 17 local rack tiles.
- Add reconciliation test where delayed server event arrives after local absorb interaction.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/phases
npx vitest run apps/client/src/features/game/Charleston*.integration.test.tsx
npx tsc --noEmit
npm run check:all
```
