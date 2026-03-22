# US-077: Contextual Staging Capacity and Slot Visibility

## Status

- State: Completed
- Priority: Critical
- Batch: K
- Implementation Ready: Yes

## Problem

The current `StagingStrip` always presents 6 visible slots, which is misleading in startup
Charleston where the player is told to select 3 tiles. The same issue affects gameplay, where the
board should normally communicate a 1-tile discard/action staging expectation instead of a constant
6-slot tray.

## Scope

**In scope:**

- Change `StagingStrip` to display only the maximum quantity relevant to the current action state.
- Charleston default presentation: show 3 visible slots.
- Charleston blind-pass rounds: show 6 visible slots.
- Gameplay default presentation: show 1 visible slot.
- Gameplay call-action states: show 6 visible slots.
  This means staged multi-tile claim/call states in `PlayingPhasePresentation`, specifically the
  current `CallWindow` / claim flow that already routes through a 6-slot `StagingStrip`.
- Ensure the visible slot count and selection/capacity messaging remain coherent.

**Out of scope:**

- Hint-panel redesign.
- Rack-width reduction.
- Charleston instruction copy rewrite outside what is needed for slot-count coherence.

## Acceptance Criteria

- AC-1: Startup Charleston presents 3 visible staging slots, not 6.
- AC-2: Blind-pass Charleston states present 6 visible staging slots.
- AC-3: Normal gameplay discard staging presents 1 visible slot.
- AC-4: Gameplay call-action states present 6 visible slots.
- AC-5: Visible slot count aligns with the current action model and no longer suggests a larger
  staging capacity than the player actually has.
- AC-6: Existing staging interactions still work correctly when slot-count changes between states.

## Edge Cases

- EC-1: Transitioning into blind-pass states must expand slot count without losing staged-state
  correctness.
- EC-2: Transitioning from call-action states back to 1-slot gameplay staging must not leave stale
  layout assumptions behind.

## Primary Files (Expected)

- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/StagingStrip.test.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.test.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx`

## Notes for Implementer

The rule is: visible slots should match the maximum possible quantity for the current action model,
not the maximum ever needed by the component.

Do not solve this by hiding extra slots with near-invisible styling while preserving 6-slot
geometry; the point is to change the visible mental model.

## Test Plan

- Add slot-count assertions for Charleston default, blind-pass, gameplay discard, and gameplay call
  states.
- Verify staged tiles remain stable when slot count increases or decreases between states.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/StagingStrip.test.tsx apps/client/src/components/game/phases/CharlestonPhase.test.tsx apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx
npx tsc --noEmit
```
