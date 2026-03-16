# US-041: Frontend Regression Recovery Program (Post-User-Testing)

## Status

- State: Completed
- Priority: Critical
- Batch: D

## Problem

Recent user-testing backlog deliveries (US-035 through US-040) are reporting severe gameplay regressions in live play (layout collisions, staging behavior drift, and Charleston hand integrity issues).

## Scope

- Define and track a dedicated recovery effort across layout, Charleston state integrity, and staging interaction behavior.
- Sequence remediation so gameplay correctness is fixed before visual polish.
- Block new frontend UX stories until recovery ACs are met.
- Convert the reported failures into explicit invariants, reproductions, and evidence requirements so implementation can be done safely in isolated chats.

## In Scope

- Recovery orchestration for US-042, US-043, US-044, and US-045.
- Shared definition of done and release gate for regression closure.
- Explicit rollback criteria if introduced fixes worsen state integrity.

## Out of Scope

- New feature work unrelated to current regressions.
- Visual redesign beyond required parity with intended board behavior.

## Acceptance Criteria

- AC-1: Recovery subtasks are explicitly tracked in linked stories (US-042..US-045) with no ambiguous ownership.
- AC-2: The known reported failures are represented as testable requirements:
  - local rack tile count does not exceed legal phase expectations after Charleston pass stages
  - outgoing staging fills from slot 0 left-to-right deterministically
  - board geometry remains coherent at desktop widths with no action/staging overlap
- AC-3: A hard release gate exists: no merge of new frontend story work until US-042..US-045 verification commands pass.
- AC-4: Each linked story states its required proof type (`unit`, `integration`, `e2e`, `visual`) and is not complete until that proof exists in code or CI.
- AC-5: Each linked story identifies the single authoritative owner for any gameplay state it changes; no story may introduce a second owner for the same concept.

## Edge Cases

- EC-1: Recovery fixes do not regress read-only/history mode behavior.
- EC-2: Recovery fixes do not regress reduced-motion behavior from US-040.

## Primary Linked Stories

- [US-042](./US-042-board-local-layout-anchoring.md)
- [US-043](./US-043-charleston-tile-count-conservation.md)
- [US-044](./US-044-staging-slot-order-and-action-coherence.md)
- [US-045](./US-045-frontend-regression-guardrails.md)

## Recovery Order

1. US-043 (state integrity first)
2. US-044 (staging/selection deterministic behavior)
3. US-042 (board-local layout anchoring)
4. US-045 (guardrails + visual baselines)

## Failure Lessons To Carry Forward

1. Do not accept proxy assertions for browser-visible failures.
   - Layout bugs require browser-level proof.
   - Multi-step Charleston bugs require state-transition tests, not isolated component tests.
2. Do not split ownership of the same gameplay concept across snapshot state, store state, and component-local state without an explicit reconciliation contract.
3. Do not mark stories complete when visual/manual validation is deferred for ACs that are inherently visual.
4. Do not treat `npm run check:all` as sufficient if it does not execute the failure class that actually hurt us.

## Required Story Contract For US-042..US-045

Every implementation chat for these stories must do all of the following:

1. Reproduce the reported regression first with a failing automated test or documented failing browser check.
2. State the invariant being protected before editing code.
3. Name the authoritative owner for any affected state.
4. Add or update the guardrail that would have caught the regression originally.
5. Report any deferred item explicitly; do not silently defer proof.

## Stop Conditions

Stop and report back instead of continuing if any of the following happen:

1. The fix requires introducing a second source of truth for hand, staging, or commit eligibility.
2. The intended invariant cannot be expressed as a test with the current architecture.
3. The browser-visible defect cannot be reproduced or observed in any automated or manual baseline.
4. The change would regress read-only/history mode or reduced-motion behavior and no guardrail is added.

## Verification Gate

Run before any story in later batches is marked started:

```bash
npx vitest run
npx tsc --noEmit
npm run check:all
```

## Notes

- Reported regression checkpoint date: Monday, March 9, 2026.
- This story is coordination-only and should not include production code edits.
- This story is the source of truth for recovery workflow. Linked stories should repeat the relevant constraints, not assume the implementer has read prior chats.
