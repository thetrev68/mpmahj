# US-044: Staging Slot Order and Action Coherence

## Status

- State: Implemented
- Priority: High
- Batch: D

## Problem

Staging behavior is still inconsistent in live play: selected tiles can appear in the wrong outgoing slot order (reported shift to slot 4 instead of slot 1), and action affordances become contradictory during Charleston/discard transitions.

## Scope

- Make outgoing staging fill deterministic from slot 0 upward with no visual jumps.
- Align staging slot rendering with source selection order and removal semantics.
- Ensure action buttons and staging commit controls represent the same effective state.
- Remove parallel ordering or eligibility heuristics that can diverge across `StagingStrip`, phase components, and `ActionBar`.

## Acceptance Criteria

- AC-1: First selected outgoing tile always renders in outgoing slot 0.
- AC-2: Additional selected tiles fill contiguous slots in order with no gaps.
- AC-3: Deselection compacts remaining outgoing tiles leftward deterministically.
- AC-4: Commit button enable/disable state matches actual commit eligibility from selection/staging state.
- AC-5: The story leaves one authoritative owner for outgoing staged order.
- AC-6: The story leaves one authoritative owner for commit eligibility.

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
- Current known failure pattern:
  - isolated `StagingStrip` tests can pass while real Charleston or discard flows still drift because ordering is derived differently upstream
  - button state can appear "correct" in one component while another component computes eligibility differently
- Before editing, identify:
  - where the authoritative ordering array lives
  - where the authoritative commit eligibility boolean lives
  - which components should become dumb renderers of that state
- Proof type required for completion:
  - `unit` for contiguous-slot rendering
  - `integration` or `e2e` for select/deselect/phase-transition behavior
- Do not accept a fix that only changes `StagingStrip.tsx` if ordering or eligibility is still computed in multiple places.

## Test Plan

- Extend `StagingStrip.test.tsx` for contiguous-slot guarantees across select/deselect sequences.
- Add integration tests for Charleston pass staging order under rapid interaction.
- Add assertion that action panel and staging commit controls agree on eligibility.
- Add a phase-transition regression test:
  - Charleston -> Playing or Discarding -> CallWindow must not preserve stale slot allocations
- Add a rapid click regression test that uses real event sequencing rather than direct prop injection only.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/StagingStrip.test.tsx
npx vitest run apps/client/src/components/game/ActionBar*.test.tsx
npx vitest run apps/client/src/features/game/Charleston*.integration.test.tsx
npx playwright test
npx tsc --noEmit
npm run check:all
```

---

### GPT-5.4 Proposed Scope

Invariant to protect: outgoing staging order is exactly the current `selectedIds` sequence for the active phase, rendered contiguously from slot `0`, and every commit/enablement control reads the same authoritative eligibility boolean instead of recomputing its own rule.

State owners I found before edits:

- Hand contents: `gameState.your_hand` / `handTileInstances` at the phase container level.
- Charleston staged incoming: `useGameUIStore().stagedIncoming` in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx).
- Playing staged incoming: `playing.stagedIncomingTile` passed into [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx).
- Outgoing staged order: currently `selectedIds` from `useTileSelection`, mapped in each phase.
- Commit eligibility: currently split. Charleston has a local `canCommitPass` in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx), while [ActionBarPhaseActions.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.tsx) recomputes pass/discard eligibility via [ActionBarDerivations.ts](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarDerivations.ts). That is the coherence gap this story is targeting.

Scope checklist:

- In scope AC/EC:
  - AC-1, AC-2, AC-3 via contiguous outgoing slot rendering from `selectedIds` order and deterministic left-compaction on deselect.
  - AC-4 and AC-6 by making action controls and staging controls consume one commit-eligibility source per phase.
  - AC-5 by keeping outgoing staged order owned by phase-level `selectedIds`, with `StagingStrip` as a dumb renderer.
  - EC-1 with a rapid select/deselect integration regression test.
  - EC-2 with a phase-transition regression test that proves stale outgoing staging does not survive Charleston -> Playing.
  - EC-3 if touched by the same Charleston integration path; otherwise I’ll leave it deferred unless the failing repro lands there.
- Files I expect to change:
  - [StagingStrip.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.test.tsx)
  - [ActionBar.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBar.tsx)
  - [ActionBarPhaseActions.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.tsx)
  - [ActionBar.types.ts](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBar.types.ts)
  - [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
  - [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)
  - likely [ActionBar.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBar.test.tsx) and [ActionBarPhaseActions.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.test.tsx)
  - likely one or two integration files under `apps/client/src/features/game`, most likely [CharlestonSecondRight.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx) and [turn-discard.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/turn-discard.integration.test.tsx)
- Tests I will add or update first to reproduce the regression:
  - `StagingStrip` unit test covering select -> select -> deselect -> compaction order using real `outgoingTiles` sequences.
  - Charleston integration test proving staging commit control and action bar agree on pass eligibility during blind-forwarding.
  - Playing/discard integration test proving staging discard control and action bar agree on discard eligibility, including after phase transition clearing.
  - Rapid interaction regression test using user events, not prop injection only.
- Explicit deferred items:
  - Browser-level visual proof is not required by US-044 itself; this is a state/interaction story, so I’m planning integration proof rather than Playwright layout proof unless the reproduction turns out to be layout-visible only.
  - I am not planning a broad refactor of `useTileSelection`; only phase/action ownership cleanup unless the repro proves selection ordering itself is broken.

---

## GPT-5.4 Implementation Summary

Implemented the coherence fix for US-044.

### Invariant implemented

Outgoing staging order is the phase-owned `selectedIds` order, rendered contiguously from slot `0`, and commit eligibility is computed once in the phase container and passed to both `StagingStrip` and `ActionBar`. Pass/discard commands now go through one shared phase handler per phase instead of separate button-specific logic paths.

### State owner(s) after the change

Hand contents remain owned by snapshot-derived phase state:

- Charleston: `gameState.your_hand` plus `useGameUIStore().stagedIncoming` for incoming Charleston tiles.
- Playing: `gameState.your_hand` plus `playing.stagedIncomingTile` for the draw/call staging tile.

Outgoing staged order is owned by phase-level `selectedIds`:

- Charleston: `useTileSelection` inside [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
- Playing: `useTileSelection` feeding [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)

Commit eligibility is now owned by the phase container:

- Charleston pass: `canCommitPass` in [CharlestonPhase.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/CharlestonPhase.tsx)
- Playing discard: `canCommitDiscard` in [PlayingPhasePresentation.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx)

`StagingStrip` and `ActionBar` are now render/trigger surfaces for that state instead of parallel rule owners.

### Tests added/updated

Added or updated guardrails:

- [CharlestonSecondRight.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx): reproduces and guards pass-button coherence between staging and action bar.
- [turn-discard.integration.test.tsx](/c:/Repos/mpmahj/apps/client/src/features/game/turn-discard.integration.test.tsx): guards discard-button coherence between staging and action bar.
- [StagingStrip.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/StagingStrip.test.tsx): guards deterministic left-compaction after deselection.
- [ActionBar.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBar.test.tsx) and [ActionBarPhaseActions.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/ActionBarPhaseActions.test.tsx): guard explicit phase-owned eligibility overrides.
- [PlayingPhasePresentation.test.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx): updated to match the shared discard path.

### Verification commands run

Ran successfully:

- `npx vitest run apps/client/src/components/game/StagingStrip.test.tsx apps/client/src/components/game/ActionBar.test.tsx apps/client/src/components/game/ActionBarPhaseActions.test.tsx apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx apps/client/src/features/game/turn-discard.integration.test.tsx`
- `npx tsc --noEmit`
- `npx vitest run --silent`
- `npm run check:all`

### Residual risk or deferred proof

No deferred code proof for the story’s required unit/integration coverage. I did not run `npx playwright test`, so there is still no browser-level e2e proof for this story; given US-044 is state/interaction-focused rather than layout-focused, I treated that as non-blocking but still worth calling out explicitly.
