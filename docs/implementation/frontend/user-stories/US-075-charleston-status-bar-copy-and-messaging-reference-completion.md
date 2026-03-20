# US-075: Charleston Status Bar Copy and Messaging Reference Completion

## Status

- State: Proposed
- Priority: Medium
- Batch: J
- Implementation Ready: Yes

## Problem

`docs/implementation/frontend/messaging-reference.md` is still incomplete for Charleston status
bar copy. It explicitly leaves "All other Charleston stages" as `(TBD)`, while the rest of the
document presents itself as a desired-state spec. That creates a gap between the action-pane
copy contract and the status-bar contract, especially for non-voting Charleston stages where the
UI should still communicate clear stage-specific progress.

This is no longer just a documentation issue. An incomplete messaging spec increases the chance
that future UI changes invent copy ad hoc or regress to duplicated/conflicting messages.

## Scope

**In scope:**

- Complete the Charleston status-bar copy matrix in
  `docs/implementation/frontend/messaging-reference.md`.
- Define intended status-bar text for:
  - FirstRight
  - FirstAcross
  - FirstLeft
  - SecondLeft
  - SecondAcross
  - SecondRight
  - CourtesyAcross
  - VotingToContinue
- Distinguish at minimum:
  - before submit
  - after submit / waiting
  - blind-pass receive-first situations where staged incoming tiles exist
- Audit current `GameplayStatusBar` / derivation code against the completed spec.
- Implement the missing derivation behavior if the current UI does not match the completed spec.
- Add tests for Charleston-specific status-bar messaging.

**Out of scope:**

- Rewriting action-pane copy outside Charleston.
- Introducing new gameplay mechanics or stage names.
- Broad layout or visual redesign of the status bar.

## Acceptance Criteria

- AC-1: `messaging-reference.md` no longer contains Charleston `(TBD)` placeholders.
- AC-2: Each Charleston stage has explicit status-bar copy for the normal active state.
- AC-3: Charleston waiting/submitted states have explicit status-bar copy where applicable.
- AC-4: Blind-pass states document how hidden incoming tiles are described without leaking hidden
  information.
- AC-5: If current implementation differs from the completed spec, derivation code is updated to
  match it.
- AC-6: Tests cover at least one standard pass stage, one blind pass stage, one voting state, and
  one courtesy-pass state.

## Edge Cases

- EC-1: Read-only / historical mode still renders the intended read-only message instead of live
  Charleston guidance.
- EC-2: Bot-originated vote/status messages remain compatible with the completed copy rules.

## Primary Files (Expected)

- `docs/implementation/frontend/messaging-reference.md`
- `apps/client/src/components/game/GameplayStatusBar.tsx`
- `apps/client/src/components/game/GameplayStatusBar.test.tsx`
- `apps/client/src/components/game/ActionBarDerivations.ts`
- `apps/client/src/components/game/ActionBarDerivations.test.ts`

## Notes for Implementer

Do the spec work first. The goal is not to improvise copy in the component and backfill docs
later. Complete the matrix, then align code and tests to it.

Prefer short, phase-accurate copy. The status bar should complement the action pane, not restate
the full instruction paragraph.

## Test Plan

- Add derivation tests for Charleston status-bar text by stage/condition.
- Add component-level tests only where the rendering contract is not already covered by derivation
  tests.
- Verify no `(TBD)` remains in the Charleston section of the messaging reference.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/GameplayStatusBar.test.tsx apps/client/src/components/game/ActionBarDerivations.test.ts apps/client/src/components/game/ActionBar.test.tsx
npx tsc --noEmit
```
