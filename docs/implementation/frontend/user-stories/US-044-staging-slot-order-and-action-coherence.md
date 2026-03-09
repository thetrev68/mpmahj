# US-044: Staging Slot Order and Action Coherence

## Status

- State: Proposed
- Priority: High
- Batch: D

## Problem

Staging behavior is still inconsistent in live play: selected tiles can appear in the wrong outgoing slot order (reported shift to slot 4 instead of slot 1), and action affordances become contradictory during Charleston/discard transitions.

## Scope

- Make outgoing staging fill deterministic from slot 0 upward with no visual jumps.
- Align staging slot rendering with source selection order and removal semantics.
- Ensure action buttons and staging commit controls represent the same effective state.

## Acceptance Criteria

- AC-1: First selected outgoing tile always renders in outgoing slot 0.
- AC-2: Additional selected tiles fill contiguous slots in order with no gaps.
- AC-3: Deselection compacts remaining outgoing tiles leftward deterministically.
- AC-4: Commit button enable/disable state matches actual commit eligibility from selection/staging state.

## Edge Cases

- EC-1: Fast multi-click select/deselect does not produce non-contiguous slot fill.
- EC-2: Switching phases (Charleston -> Playing) clears/rebinds staging without stale slot allocations.
- EC-3: Blind incoming interactions (flip then absorb) do not perturb outgoing slot indexing.

## Primary Files (Expected)

- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`

## Notes for Implementer

- Keep a single source for outgoing staged tile ordering; avoid parallel derived arrays with different sort rules.
- Validate that tile IDs used by staging are stable across re-renders.
- Treat action panel and staging commit controls as one state machine, not separate heuristics.

## Test Plan

- Extend `StagingStrip.test.tsx` for contiguous-slot guarantees across select/deselect sequences.
- Add integration tests for Charleston pass staging order under rapid interaction.
- Add assertion that action panel and staging commit controls agree on eligibility.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/StagingStrip.test.tsx
npx vitest run apps/client/src/components/game/ActionBar*.test.tsx
npx vitest run apps/client/src/features/game/Charleston*.integration.test.tsx
npx tsc --noEmit
npm run check:all
```
