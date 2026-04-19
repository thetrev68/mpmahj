# US-043: Charleston Tile-Count Conservation and Hand Integrity

## Status

- State: Implemented
- Priority: Critical
- Batch: D

## Problem

During Charleston progression (reported at first Charleston pass 3 of 3), local rack tile count can become invalid (example observed: 17 tiles), indicating a broken hand/staging conservation path.

## Scope

- Enforce tile-count conservation across Charleston selection, incoming staging, absorb, and commit flows.
- Eliminate duplicate tile materialization between staged-incoming state, absorbed-incoming state, and displayed hand.
- Define phase-legal rack count invariants and assert them in runtime-safe guards/tests.
- Collapse or explicitly reconcile any split ownership of Charleston hand/staging state.

## Acceptance Criteria

- AC-1: Local rack tile count after each Charleston transition matches server-authoritative legal counts.
- AC-2: No duplicate tile instance IDs or duplicated tile values are introduced by absorb/forward operations.
- AC-3: Entering and exiting each Charleston stage preserves conservation: tiles out + tiles in + hand equals expected total.
- AC-4: On state reconciliation from server events, optimistic local state is corrected without rendering illegal counts.
- AC-5: The story documents one authoritative owner for each of the following concepts:
  - current hand contents
  - staged incoming tiles
  - absorbed-but-not-yet-server-committed tiles, if such a concept still exists after the fix
  - outgoing selected tiles
- AC-6: The reported failure case is captured as an automated regression test:
  - first Charleston pass 3 of 3 must not render 17 local rack tiles

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
- Current known risk to resolve:
  - `CharlestonPhase.tsx` derives `displayHand` from `gameState.your_hand + absorbedIncomingTiles`
  - `IncomingTilesStaged` also lives separately in store state
  - stage transitions intentionally preserve some staging state
  - this combination can duplicate visual ownership during reconcile/remount flows
- Strong recommendation:
  - either reduce these concepts to one owner plus pure derivations
  - or write down the reconciliation contract in code comments and tests before proceeding
- Proof type required for completion:
  - `integration` for multi-step Charleston transitions
  - `e2e` if the bug is only reproducible in browser interaction timing
- Do not accept "counts look correct in isolated render" as evidence.

## Test Plan

- Add Charleston conservation tests that step through all pass stages and assert exact counts.
- Add regression test for reported failure case: first Charleston pass 3 of 3 cannot show 17 local rack tiles.
- Add reconciliation test where delayed server event arrives after local absorb interaction.
- Add at least one reconnect/remount test that proves no double-materialization after snapshot reconciliation.
- If runtime guards are added, test both the legal path and the guard-triggering path.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/phases
npx vitest run apps/client/src/features/game/Charleston*.integration.test.tsx
npx playwright test
npx tsc --noEmit
npm run check:all
```

---

## GPT-5.4 Proposed Scope

### Scope Checklist

Invariant to protect before editing: during Charleston, the local rack must never render more tiles than the legal server-authoritative total for that moment. Pre-commit incoming tiles can be visualized, but they must not be materialized twice across `gameState.your_hand`, staged incoming state, and any absorbed/local optimistic state.

In scope AC:

- `AC-1` keep local rack tile count aligned with server-authoritative legal counts after each Charleston transition.
- `AC-2` prevent duplicate tile materialization from absorb/forward flows.
- `AC-3` preserve tile conservation across hand + staged incoming + outgoing selection through multi-step transitions.
- `AC-4` reconcile delayed server updates without rendering illegal counts.
- `AC-5` make authoritative ownership explicit for hand contents, staged incoming, absorbed/pre-commit kept tiles if that concept remains, outgoing selection, and commit eligibility.
- `AC-6` add an automated regression covering the reported first Charleston pass 3-of-3 failure so 17 rendered rack tiles cannot occur.

In scope EC:

- `EC-1` blind pass stages keep counts correct before reveal and after absorb/forward interactions.
- `EC-3` reconnect/remount snapshot reconciliation does not double-materialize incoming tiles.
- `EC-2` courtesy pass negotiation only if the conservation path touches the same state owner logic while I fix Charleston count handling.

Expected files to change:

- [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
- [CharlestonFirstLeft.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx)
- [Charleston.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/Charleston.integration.test.tsx)
- [DisconnectReconnect.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/DisconnectReconnect.integration.test.tsx)
- Possibly [gameUIStore.ts](/c:/Repos/mpmahj/apps/client/src/stores/gameUIStore.ts) if the current store contract makes a single-owner conservation invariant impossible.

Tests to add or update:

- A failing Charleston integration test that reproduces the reported count inflation at first-left blind forwarding / pass-3-of-3 style flow.
- A reconciliation/remount regression test proving snapshot or reconnect does not render extra rack tiles after local absorb interaction.
- If I add an invariant helper, direct tests for legal and illegal conservation paths.

Planned state owners after the fix:

- Hand contents: server snapshot `gameState.your_hand`.
- Staged incoming tiles not yet committed: one owner only, either store-backed staging or a single local wrapper around it, but not both as independent truths.
- Outgoing staged order: `selectedIds` from the selection hook, derived against the current authoritative visual hand.
- Commit eligibility: pure derivation from authoritative hand/staging state, not stored separately.
- Absorbed-but-not-yet-committed tiles: either eliminated as a separate concept or reduced to one explicit owner with reconciliation rules.

Deferred items:

- Browser-level proof is not required for this story unless the bug only reproduces under browser timing; current evidence points to multi-step integration as the required proof type.
- No broad refactor unless the current Charleston state split makes conservation impossible to express safely.

---

## GPT-5.4 Implementation Summary

Implemented the Charleston conservation fix by making the rack server-owned again and moving blind incoming progress into the UI store. The key changes are in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx), [gameUIStore.ts](/c:/Repos/mpmahj/apps/client/src/stores/gameUIStore.ts), [privateEventHandlers.ts](/c:/Repos/mpmahj/apps/client/src/lib/game-events/privateEventHandlers.ts), and the new/updated integration guardrails in [CharlestonFirstLeft.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx) and [Charleston.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/Charleston.integration.test.tsx).

1. Invariant implemented  
   The local Charleston rack must always render exactly the server-authoritative concealed hand count from `gameState.your_hand`; blind incoming tiles may change staging/forwarding state, but they must not be materialized into the rack as a second source of truth.

2. State owner(s) after the change  
   Current hand contents: `gameState.your_hand` only.  
   Staged incoming tiles, including reveal/absorb progress: `useGameUIStore().stagedIncoming`.  
   Absorbed-but-not-yet-server-committed tiles: no separate visual hand owner; they are represented only as absorbed indexes inside `stagedIncoming`.  
   Outgoing staged order: `selectedIds` from `useTileSelection`, derived against the server hand.  
   Commit eligibility: pure derivation in `CharlestonPhase` from `selectedIds.length + remaining staged incoming count`.

3. Tests added/updated  
   Added a failing-then-passing integration guardrail that reproduces the regression class: absorbing blind incoming tiles must not inflate the rack count in [CharlestonFirstLeft.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx).  
   Added a snapshot/remount reconciliation test proving an absorbed blind tile stays absorbed and the rack count stays legal in [Charleston.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/Charleston.integration.test.tsx).  
   Updated store/event/phase tests to reflect the new staged-incoming owner and action contract in [gameUIStore.test.ts](/c:/Repos/mpmahj/apps/client/src/stores/gameUIStore.test.ts), [privateEventHandlers.test.ts](/c:/Repos/mpmahj/apps/client/src/lib/game-events/privateEventHandlers.test.ts), and [CharlestonPhase.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.test.tsx).

4. Verification commands run  
   `npx vitest run src/features/game/Charleston.integration.test.tsx`  
   `npx vitest run src/features/game/CharlestonFirstLeft.integration.test.tsx src/lib/game-events/privateEventHandlers.test.ts src/stores/gameUIStore.test.ts src/components/game/phases/CharlestonPhase.test.tsx`  
   `npx vitest run`  
   `npx tsc --noEmit`

5. Residual risk or deferred proof  
   No browser-only timing issue was needed to reproduce this regression, so I did not run Playwright for this story. The required proof type here is integration, and that proof now exists. There are unrelated existing worktree changes outside this fix that I did not touch.
