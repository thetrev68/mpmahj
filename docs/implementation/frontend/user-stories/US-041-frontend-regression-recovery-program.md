# US-041: Frontend Regression Recovery Program (Post-User-Testing)

## Status

- State: Proposed
- Priority: Critical
- Batch: D

## Problem

Recent user-testing backlog deliveries (US-035 through US-040) are reporting severe gameplay regressions in live play (layout collisions, staging behavior drift, and Charleston hand integrity issues).

## Scope

- Define and track a dedicated recovery effort across layout, Charleston state integrity, and staging interaction behavior.
- Sequence remediation so gameplay correctness is fixed before visual polish.
- Block new frontend UX stories until recovery ACs are met.

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
