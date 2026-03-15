# US-050: Staging Strip — Uniform 6-Slot Width Across Both Phases

## Status

- State: Completed
- Priority: High
- Batch: E

## Problem

The staging strip has 6 slots. A slot holds a tile or is empty. The same slot can hold a tile that was
just received (arriving from another player) or a tile the player has selected to pass (leaving toward another
player) — the slot itself has no fixed direction. The direction belongs to the tile's state, not the slot.

Despite this, the strip behaves differently in Charleston and gameplay:

- **Charleston (C-2):** The strip correctly renders 6 slots but the container uses `w-fit` with no upper
  bound. Excess whitespace can appear beyond the 6th slot. The slot row uses `overflow-x-auto`, which
  allows horizontal scrolling instead of capping the visual width at exactly 6 tiles.
- **Gameplay (G-1):** The playing phase renders only 2 of the 6 slots under normal conditions, which is far
  narrower than the Charleston strip and produces an inconsistent layout footprint. A text area also
  appears to the right of the strip in this phase; it is redundant and should be removed.

From a player perspective the staging strip should look and feel identical in size and position during
Charleston and gameplay. Variable strip widths create spatial disorientation as the game transitions
between phases.

**Current component API encodes the wrong model.** `StagingStrip` currently accepts two separate
`incomingSlotCount` and `outgoingSlotCount` props, which implies the strip has two distinct zones. This
abstraction is incorrect — the strip has 6 slots total, and each tile placed in the strip carries its own
directional state. This story is the right time to collapse that prop split.

## Scope

- Cap the staging strip container to exactly 6 tile-slot widths at all times, in both Charleston and gameplay.
- Width cap must scale proportionally with the rendered tile size (`w-[63px]` slots), not be expressed as a fixed pixel constant.
- Replace `overflow-x-auto` with a hard cap so the container never scrolls or expands beyond 6 slots.
- Adjust the gameplay call site so the strip always shows all 6 slots, with empty placeholders for unfilled positions.
- Replace the `incomingSlotCount` + `outgoingSlotCount` prop pair with a single `slotCount={6}` (or equivalent) so the component model matches the physical model.
- Remove the redundant text area that currently appears to the right of the staging strip during gameplay.
- Move gameplay claim-candidate feedback out of `StagingStrip` and into the action pane as a dedicated action-bar status block fed by the existing `claimCandidate` view-state object.

## Out of Scope

- Blind-pass face-down rendering and receive-first flow covered by `US-049`.
- Action pane button model (Proceed/Mahjong) covered by `US-051` and `US-052`.
- Right-rail placement, discard pool, or board geometry changes covered by later stories.
- Any staging slot-order or interaction changes already resolved by `US-044`.

## Acceptance Criteria

- AC-1: During Charleston, the staging strip container is exactly 6 tile-slot widths wide regardless of how many tiles are currently staged.
- AC-2: During gameplay, the staging strip container is exactly 6 tile-slot widths wide regardless of how many tiles are currently staged or whether a call window is active.
- AC-3: The width cap scales proportionally with the rendered tile width (`w-[63px]` per slot, `gap-2` between slots) — no raw pixel constant is used in place of a computed tile-based width.
- AC-4: The staging strip does not scroll horizontally at any supported viewport width.
- AC-5: Empty slot placeholders fill all 6 positions when fewer than 6 tiles are staged, preserving the fixed visual footprint.
- AC-6: The `staging-claim-candidate` panel (`data-testid="staging-claim-candidate"`) is removed from `StagingStrip`. Claim candidate label and detail text are shown only in the action pane.
- AC-6a: During gameplay call-window states where `claimCandidate` is non-null, the action pane renders the same claim candidate label and detail copy that previously appeared in the strip, and no duplicate copy remains inside `StagingStrip`.
- AC-7: The strip occupies the same board position and vertical alignment during gameplay as it does during Charleston, measured by comparing the `staging-strip` bounding box in both phases with a tolerance of ±2px on left position and top position at the tested viewport.
- AC-8: The `StagingStrip` component no longer accepts separate `incomingSlotCount` and `outgoingSlotCount` props; callers pass a single total slot count.

## Edge Cases

- EC-1: During a call window in gameplay, more tiles may be staged simultaneously; the strip must still not exceed the 6-slot width cap.
- EC-2: At narrow viewports where 6 slots exceed the available width, the strip must not overflow its parent and must shrink proportionally without horizontal scroll.
- EC-3: Reconnect/remount mid-phase does not cause the strip to briefly flash at a different width before settling.
- EC-4: The width contract is the same in both light and dark themes.

## Primary Files (Expected)

- `apps/client/src/components/game/StagingStrip.tsx` — container classes (`w-fit`, `overflow-x-auto`); slot row; per-slot dimensions; `incomingSlotCount`/`outgoingSlotCount` props to collapse
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — gameplay call site (lines ~257–281); redundant text area render site (confirm exact location before removing)
- `apps/client/src/components/game/phases/CharlestonPhase.tsx` — Charleston call site (lines ~498–528)
- `apps/client/src/components/game/ActionBar.tsx` and/or `apps/client/src/components/game/ActionBarPhaseActions.tsx` — new gameplay claim-candidate status render site in the action pane
- `apps/client/src/components/game/StagingStrip.test.tsx` — component tests for width contract
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx` — move claim candidate assertions from strip to action pane
- `apps/client/e2e/` — Playwright geometry assertion (new or existing spec)

## Notes for Implementer

- **The correct mental model:** there are 6 slots. A tile placed in a slot carries its own state — it arrived
  from another player, or the player selected it to pass. The slots are not divided into an "incoming zone"
  and an "outgoing zone." Any slot can hold either kind of tile. The `incomingSlotCount` / `outgoingSlotCount`
  prop split encodes this wrong model and should be removed as part of this story.

- **Current slot dimensions:** each slot is `w-[63px] h-[90px]` with `gap-2` (8px) between slots.
  Six slots + five gaps = `6 × 63 + 5 × 8 = 418px` of tile content, plus `p-4` (16px) padding on each
  side → outer cap ≈ `calc(6 * 63px + 5 * 8px + 2 * 16px)`. Express this as a Tailwind utility or CSS
  variable rather than a magic pixel number so the cap stays in sync if tile or gap sizes change.

- **Why `w-fit` is wrong:** `w-fit` sizes the container to its content. When the action-button group or a
  long label is wider than 6 slots, the container silently expands. Replacing `w-fit` with a computed
  max-width (and `overflow-hidden` or `overflow-clip`) is the correct fix.

- **Playing phase (current):** the call site currently passes small slot counts that result in only 2 visible
  slots during normal play. After the prop collapse, it should pass `slotCount={6}` and always show all
  6 slots, with empty placeholders for positions not currently occupied by a tile.

- **Redundant text area (G-1):** the `claimCandidateState` block at `StagingStrip.tsx` lines 181–202
  (`data-testid="staging-claim-candidate"`) renders a label+detail panel inside the strip's bordered
  container when a call window is active. It is the element that pushes the container wider than 6 slots.
  It is redundant because the action pane already shows this same claim candidate information.
  Remove the entire block from `StagingStrip`, along with the three props that feed it:
  `claimCandidateState`, `claimCandidateLabel`, `claimCandidateDetail`. Update all call sites to stop
  passing those props.

- **Claim candidate destination:** gameplay already derives `claimCandidate` in `PlayingPhase.tsx` and passes
  it through `PlayingPhasePresentation`. This story must preserve that information by moving it into the
  action pane, not by deleting it. Preferred contract:
  - `PlayingPhasePresentation` passes the existing `claimCandidate` object into `ActionBar`
  - `ActionBar` (or `ActionBarPhaseActions`) renders a compact status block above the gameplay action buttons
  - the status block uses the existing label/detail copy from `claimCandidate`
  - the strip no longer renders any claim candidate label/detail/testids
  - gameplay tests asserting `staging-claim-candidate-*` should be updated to assert the new action-pane surface instead

- **`overflow-x-auto` on the slot row:** the inner flex row at
  `flex flex-nowrap justify-center gap-2 overflow-x-auto pb-1` also allows horizontal scrolling if
  content overflows. This should become `overflow-hidden` or `overflow-clip` once the width cap is
  enforced at the container level.

- **Narrow viewport behavior:** choose one behavior and test it. For this story the strip should shrink
  proportionally when 6 medium slots would exceed the available width. Do not allow horizontal scrollbars,
  and do not let the strip clip tiles off-screen while a proportional scale-down solution is available.

- **Geometry proof for AC-7:** the browser-level test should capture the `staging-strip` bounding box in one
  Charleston state and one gameplay state at the same viewport and assert:
  - width matches within ±2px
  - left position matches within ±2px
  - top position matches within ±2px
    This keeps “same position and alignment” objective instead of visual-only.

- **Build on `US-044`:** that story established slot-order and action coherence inside the strip. Do not
  re-introduce a different slot ordering as a side effect of the prop refactor or width cap.

## Test Plan

- Update `StagingStrip.test.tsx`:
  - Assert the container element is exactly 6 slots wide when all 6 slots are filled.
  - Assert the container element is exactly 6 slots wide when only 1 tile is staged (5 empty placeholders).
  - Assert the container element is exactly 6 slots wide when all 6 slots are occupied by tiles of mixed directional state.
  - Assert no horizontal scrollbar is present (check `scrollWidth ≤ clientWidth` or equivalent).
- Assert `staging-claim-candidate` is never present in the DOM in any phase after this change.
- Update gameplay presentation/action-bar tests so claim candidate label/detail render in the action pane during call-window states and no longer render inside `StagingStrip`.
- Add at least one Playwright or browser-geometry assertion that verifies the strip's rendered width, left position, and top position in Charleston and in gameplay match within ±2px at the same viewport.
- Add at least one browser-level narrow-viewport assertion proving the strip shrinks proportionally and does not introduce horizontal scrolling.
- Regression: confirm existing `US-044`-related staging slot-order tests still pass after the prop refactor and width change.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/StagingStrip.test.tsx
npx vitest run apps/client/src/features/game/Charleston.integration.test.tsx
npx vitest run apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx
npx vitest run apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx
npx tsc --noEmit
npx prettier --write docs/implementation/frontend/user-stories/US-050-staging-strip-uniform-6-slot-width.md docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

Implemented US-050 in commit `fb41d0e` (`feat(us-050): implement uniform 6-slot staging strip`).

The strip now uses a single `slotCount={6}` model in both Charleston and gameplay, keeps a fixed 6-slot footprint with empty placeholders, removes the strip-local claim-candidate panel, and renders claim-candidate feedback in the action pane through `ActionBar`. The width cap is derived from slot width/gap/padding math instead of a raw pixel constant, horizontal strip scrolling is removed, and narrow viewports now proportionally scale the slot row. I also adjusted the desktop `PlayerZone` layout so the action pane no longer shifts the strip upward in gameplay, which brought the Charleston/gameplay strip bounding boxes back into alignment.

Test coverage was updated in [StagingStrip.test.tsx], [PlayingPhasePresentation.test.tsx], [CallWindow.integration.test.tsx], [Playing.integration.test.tsx], and [frontend-recovery-guardrails.spec.ts], plus refreshed Playwright recovery snapshots. Story verification ran, and the full [AGENTS.md] validation pipeline also completed, including `cargo fmt --all`, `cargo check --workspace`, `cargo test --workspace`, `cargo clippy --all-targets --all-features`, `npx prettier --write .`, `npx tsc --noEmit`, and `npm run check:all`.

Deferred items: none beyond the story’s existing out-of-scope items. I staged only the US-050 implementation files for the commit. Three unrelated working-tree changes remain unstaged by design: [usePlayingPhaseActions.test.ts], [US-049-charleston-blind-pass-face-down-and-receive-first-flow.md], and [USER-TESTING-BACKLOG.md].

12 files changed +383 -275

apps/client/e2e/frontend-recovery-guardrails.spec.ts
apps/client/e2e/support/gamePlay.ts
apps/client/src/components/game/ActionBar.tsx
apps/client/src/components/game/ActionBar.types.ts
apps/client/src/components/game/PlayerZone.tsx
apps/client/src/components/game/StagingStrip.test.tsx
apps/client/src/components/game/StagingStrip.tsx
apps/client/src/components/game/phases/CharlestonPhase.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx
apps/client/src/features/game/CallWindow.integration.test.tsx
apps/client/src/features/game/Playing.integration.test.tsx
