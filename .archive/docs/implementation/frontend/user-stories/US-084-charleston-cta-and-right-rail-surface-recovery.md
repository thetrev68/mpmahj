# US-084: Charleston CTA and Right Rail Surface Recovery

## Status

- State: Completed
- Priority: High
- Batch: M
- Implementation Ready: Yes

## Problem

The March 22 UI audit shows that several high-visibility Charleston issues remain unresolved even
though adjacent stories were previously marked completed.

The most visible failures are:

- the Charleston `Mahjong` button still reads like a primary flashing CTA during normal tile
  passing
- the right rail still wastes vertical space with an empty top region
- dark-mode rail and hint surfaces still allow green board felt to bleed through instead of
  reading as real dark UI surfaces
- supporting instruction text remains too weak in dark mode

These are implementation-ready corrections. They should be fixed as one bounded recovery batch
before deeper board-geometry refactors begin.

## Scope

**In scope:**

- Demote the Charleston `Mahjong` button to a stable secondary treatment during normal Charleston
  flow.
- Keep `Proceed` as the clear primary Charleston action.
- Preserve `Mahjong` visibility during Charleston without hiding or relocating it.
- Remove the empty right-rail top spacer when it is not serving real content.
- Correct dark-mode right-rail and hint-adjacent surfaces so they render as opaque dark surfaces
  rather than translucent green-tinted overlays.
- Improve Charleston action instruction contrast in dark mode while keeping it visually secondary
  to `Proceed`.
- Revalidate the relevant behavior previously associated with `US-078` and `US-080`.

**Out of scope:**

- Board-region geometry refactor for the staging area, action pane, and player rack.
- Side-rack perimeter alignment work.
- Selection-counter relocation.
- Charleston header / tracker restructuring.
- Hint-panel content redesign beyond the container and surface corrections needed here.

## Acceptance Criteria

- AC-1: During normal Charleston flow, the `Mahjong` button is visible but visually demoted
  relative to `Proceed`.
- AC-2: The Charleston `Mahjong` button does not pulse during the normal "select tiles and press
  Proceed" case.
- AC-3: The Charleston `Mahjong` button remains in a stable position beside the same action group;
  the fix must not hide it or move it elsewhere.
- AC-4: `Proceed` remains the clear primary CTA in Charleston.
- AC-5: On large-screen layouts with the rail visible, the right rail no longer reserves a large
  empty tinted region above the hint area when no content needs that space.
- AC-6: In dark mode, the right rail and its hint-adjacent surfaces read as opaque dark surfaces
  rather than semi-transparent overlays that inherit the board green.
- AC-7: The Charleston instruction text remains secondary to `Proceed` but has sufficient contrast
  to read clearly in dark mode.
- AC-8: Light-mode surfaces remain coherent after the dark-mode corrections.

## Edge Cases

- EC-1: Rare valid Charleston Mahjong states must still remain discoverable even when the default
  Charleston treatment is demoted.
- EC-2: Read-only / historical Charleston states must not accidentally inherit live primary CTA
  emphasis.
- EC-3: Right-rail empty, loading, error, and populated states must all remain coherent after the
  spacer removal and surface changes.
- EC-4: When the hint area genuinely needs extra vertical space, the rail may still distribute
  space intentionally rather than collapsing blindly.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/components/game/ActionBar.test.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.test.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.test.tsx`
- `apps/client/src/components/game/HintPanel.test.tsx`

## Notes for Implementer

Do not solve the Charleston CTA problem by hiding `Mahjong`. The button must stay present and must
stay layout-stable.

The default Charleston demotion should not depend on `!canDeclareMahjong`. The normal startup
Charleston case still produces a distracting promoted button under the current logic. The intended
baseline is:

- `Proceed`: primary CTA
- `Mahjong`: visible secondary action
- instruction text: supportive context

For the rail, prefer bounded opaque theme surfaces over translucent overlays. The target is not a
stronger green tint. The target is a cleaner dark surface stack that does not let the felt color
become the de facto rail theme.

This story is explicitly a recovery / revalidation batch. Treat previous story completion state as
non-authoritative if the screen still fails the audit.

## Test Plan

- Update Charleston CTA tests so they assert:
  - `Mahjong` remains rendered in Charleston
  - `Mahjong` uses the demoted treatment during the normal Charleston case
  - promoted/pulsing treatment is not used in that baseline case
  - `Proceed` remains the primary visible CTA
- Update rail/layout tests so they assert:
  - the large empty top rail spacer is no longer the default idle layout
  - dark-mode-compatible surface classes are applied to the rail and hint container
- Update light/dark theme assertions where practical for the instruction text and rail surfaces

## Visual Verification

Required before completion:

1. `charleston-dark-lg`
   - confirm demoted `Mahjong`
   - confirm `Proceed` remains primary
   - confirm no large empty tinted rail region
   - confirm rail surfaces read as dark surfaces
2. `charleston-dark-midwidth`
   - confirm CTA hierarchy still holds
   - confirm instruction text remains readable
3. `charleston-light-lg`
   - confirm light theme remains coherent after surface correction

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/ActionBar.test.tsx apps/client/src/components/game/ActionBarPhaseActions.test.tsx apps/client/src/components/game/GameBoard.test.tsx apps/client/src/components/game/RightRailHintSection.test.tsx apps/client/src/components/game/HintPanel.test.tsx
npx tsc --noEmit
```
