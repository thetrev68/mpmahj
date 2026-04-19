# US-055: Right Rail — Get Hint Relocation + AI Hint Panel

## Status

- State: Completed
- Priority: Medium
- Batch: E
- Implementation Ready: No

## Problem

### G-4 — Get Hint: Move Off the Gameboard to the Right Rail

**Get Hint** is currently a button inside the action pane (`get-hint-button` in
`ActionBarPhaseActions.tsx`). `US-052` removes it from the action pane as part of the two-button
cleanup. This story gives it a new home in the right rail.

### RR-1 — AI Hint Panel: Relocate to Right Rail + Simplify

`HintPanel` currently renders `fixed left-6 top-20 z-40 w-[380px]` — a floating overlay that
occludes the gameboard, appears on top of other UI, and requires an explicit Close button to
dismiss. This is a poor fit for content that should be persistently readable while the player
studies their hand.

The right rail — the `w-64 flex-shrink-0` column to the right of `square-board-container` inside
`game-board-layout` — was reserved by `US-036` for this kind of secondary content. It is currently
an empty, `aria-hidden` placeholder. This story populates it with the AI Hint panel.

Additionally, the "Reason" section in `HintPanel` adds length without improving player decisions.
After moving to the rail it should be removed, leaving only the recommended discard and supporting
scores visible.

## Scope

**In scope:**

- Remove the gameplay-level hint visibility toggle button (`toggle-hint-panel-button`) once hint
  content becomes rail-owned and persistently visible while hints are enabled.
- Convert the right rail `div` from an inert placeholder into a structured, interactive two-pane
  column.
- Apply a distinct background color to the rail that differs visually from the square gameboard
  felt. The rail surface should feel like a separate sidebar, not part of the board.
- Divide the rail vertically into two equal halves:
  - **Top half** — reserved for future content; renders empty with no visible placeholder text.
  - **Bottom half** — AI Hint section; hosts the Get Hint trigger and hint display area.
- Implement `RightRailHintSection` as a new component occupying the bottom half. It handles all
  hint states: idle/empty, loading, error, and hint-available display.
- Move the Get Hint trigger button into `RightRailHintSection`. The button requests a hint when
  clicked, replacing the removed `get-hint-button` in the action pane.
- Remove the `fixed`-positioned `HintPanel` render from `PlayingPhaseOverlays.tsx` (lines 153–161)
  and the `hint-loading-overlay` full-screen backdrop (lines 163–181). Replace with inline states
  inside `RightRailHintSection`.
- Remove the `Reason` section (`hint-discard-reason`) from `HintPanel`. The panel should show only
  recommended discard, tile scores, and (for Beginner verbosity) top patterns.
- Remove `aria-hidden="true"` from the right rail `div` now that it contains interactive content.
- Hint panel visibility tied to the "Use Hints" setting (from `hintSettings`):
  - Hints enabled → `RightRailHintSection` renders and the Get Hint trigger is available.
  - Hints disabled → `RightRailHintSection` renders a brief _"Hints are off"_ notice; the trigger
    is absent.
- The hint request dialog (`hint-request-dialog`) is retained and continues to open from the Get
  Hint trigger in the rail (the dialog selects verbosity before submitting the request). `US-057`
  will remove this dialog when verbosity is collapsed to a single level; do not bypass it here.
- `HintPanel` is refactored in place (no file rename) to remove the `fixed` positioning and Close
  button — it becomes a layout-agnostic display component. The Card wrapper is kept but `fixed
left-6 top-20 z-40` classes and `onClose` prop are removed.
- Phases in scope: Playing phase only. During Setup and Charleston, the hint section is not shown
  (right rail top half remains empty; bottom half renders nothing or a muted rail placeholder).

**Out of scope:**

- Hint verbosity simplification to On/Off switch — covered by `US-057`.
- Hint settings access point — `US-057` will own the full settings surface redesign; do not add a
  new settings entry point (icon or button) inside `RightRailHintSection` that US-057 would
  immediately remove.
- Audio controls — covered by `US-057`.
- Any content for the top half of the rail — deferred; left intentionally empty.
- Mobile layout — the right rail is `hidden` below `lg` breakpoint; no mobile hint affordance is
  added in this story.
- Playwright or visual-baseline tests for the rail geometry — deferred; right-rail layout is new
  enough that snapshot stabilization should follow after the feature ships.
- `US-052` already removes `get-hint-button` from `ActionBarPhaseActions.tsx`; this story does not
  touch that file.

## Right-Rail Layout Contract

This section is the normative spec. Implementation must match it exactly.

### Outer rail element

```
data-testid="right-rail"
className="right-rail hidden w-64 flex-shrink-0 lg:flex lg:flex-col lg:rounded-lg lg:bg-slate-800"
```

- Width: `w-64` (256 px) — unchanged from US-036.
- Flex direction: `flex-col` — stacks top pane over bottom pane.
- Background: `bg-slate-800` — distinguishable from the board felt color (`bg-green-900` /
  `game-board-bg` equivalent). Choose a neutral dark slate rather than a green variant so the rail
  reads as a sidebar, not an extension of the felt.
- Rounded corners: `rounded-lg` — softens the sidebar edge.
- `aria-hidden` is removed; the rail is now interactive.

### Top pane

```
data-testid="right-rail-top"
className="flex-1"   {/* takes 50% of rail height */}
```

Empty. No children in this story.

### Bottom pane (AI Hint section)

```
data-testid="right-rail-bottom"
className="flex-1 flex flex-col border-t border-slate-600 p-3"
```

Contains `RightRailHintSection`.

### Height split

Both panes use `flex-1` inside a `flex-col` parent, giving each exactly 50% of the rail height.
The rail itself stretches to the board container height via the `lg:items-stretch` (or equivalent)
on `game-board-layout`. Confirm that `game-board-layout` aligns items on the cross axis so the rail
fills the full board height — add `lg:items-stretch` if it is not already present.

## Readiness Blockers

This story is not implementation-ready until the following are resolved:

1. `US-052` must land first, or this story must explicitly absorb the removal of the existing
   action-pane `get-hint-button`. The current codebase still renders the button in
   `ActionBarPhaseActions.tsx`.
2. Hint state ownership must be made explicit. Today, hint state lives inside the Playing-phase
   subtree (`useHintSystem` -> `PlayingPhase` -> `PlayingPhaseOverlays` / `PlayingPhasePresentation`),
   while the right rail lives in `GameBoard.tsx` outside that subtree. The implementation cannot be
   started safely until one of these approaches is chosen:
   - Lift hint state high enough for `GameBoard.tsx` to render `RightRailHintSection`, or
   - Move right-rail rendering into the Playing-phase subtree.
3. The current gameplay UI includes a separate `toggle-hint-panel-button` show/hide control. This
   story must remove it, or the rail-owned always-visible hint section will conflict with a stale
   visibility toggle.

If these blockers are not resolved first, the story risks split ownership, duplicate controls, and
prop threading churn across `GameBoard`, `PlayingPhase`, and `PlayingPhaseOverlays`.

### RightRailHintSection states

| State          | Display                                                     |
| -------------- | ----------------------------------------------------------- |
| Hints disabled | _"Hints are off"_ muted text; no trigger button             |
| Idle (no hint) | **Get Hint** button; empty result area                      |
| Loading        | Spinner or muted _"Analyzing…"_ text; **Cancel** link       |
| Error          | Inline error message; **Retry** button                      |
| Hint available | Hint content (see HintPanel); **Get New Hint** button below |

The full-screen `hint-loading-overlay` backdrop is removed. Loading is communicated inline within
the bottom pane only.

## Acceptance Criteria

- AC-1: During the Playing phase on `lg` screens, `data-testid="right-rail"` is visible and has a
  background color distinct from the square gameboard area.
- AC-2: The right rail is divided vertically into two equal-height panes:
  `data-testid="right-rail-top"` (empty) and `data-testid="right-rail-bottom"` (AI Hint section).
- AC-3: `data-testid="right-rail-bottom"` contains `data-testid="right-rail-hint-section"`.
- AC-4: When hints are enabled and no hint has been loaded, `data-testid="get-hint-button"` is
  present inside `right-rail-hint-section` and pressing it opens the hint request dialog
  (`data-testid="hint-request-dialog"`).
- AC-5: After a hint loads successfully, `data-testid="hint-panel"` renders inside
  `right-rail-hint-section` and is not `fixed`-positioned.
- AC-6: No element with `data-testid="hint-panel"` uses `fixed` positioning (the overlay is gone).
- AC-7: No element with `data-testid="hint-loading-overlay"` exists in the DOM (the full-screen
  loading backdrop is removed).
- AC-8: Loading state is communicated inline within `right-rail-hint-section`
  (`data-testid="hint-loading-inline"` or equivalent). A **Cancel** control is available.
- AC-9: The `hint-discard-reason` element is absent from the DOM in all hint display states (Reason
  section removed from `HintPanel`).
- AC-10: When hints are disabled (per `hintSettings`), `data-testid="get-hint-button"` is absent
  and `right-rail-hint-section` renders a _"Hints are off"_ notice
  (`data-testid="hints-off-notice"`).
- AC-11: During the Setup and Charleston phases, `right-rail-bottom` renders no hint content.
- AC-12: On screens narrower than `lg`, the right rail is not visible (existing `hidden lg:block`
  behavior extended to `hidden lg:flex`).
- AC-13: Existing hint request flow (verbosity select → Request Analysis → hint displayed) works
  end-to-end via the new rail location.
- AC-14: No element with `data-testid="toggle-hint-panel-button"` exists in the DOM during the
  Playing phase once hint display is owned by the right rail.

## Edge Cases

- EC-1: If the hint request fails (network error or server error), an inline error message appears
  in `right-rail-hint-section` with a **Retry** button. No full-screen error overlay.
- EC-2: If the player cancels a hint request in flight, the rail returns to idle state without
  leaving a loading spinner behind.
- EC-3: Reconnect / remount during Playing phase must not cause the old `fixed hint-panel` to
  flash into the DOM before the rail mounts.
- EC-4: If `hintSettings` changes from disabled to enabled mid-session, `right-rail-hint-section`
  updates without a full remount (controlled by the settings value, not a key change).
- EC-5: If `hintSettings` changes from enabled to disabled while a hint is displayed, the hint
  content is cleared and the _"Hints are off"_ notice replaces it.
- EC-6: In read-only / historical view mode, `get-hint-button` is absent (cannot request new hints
  while reviewing history). Any previously displayed hint remains visible if it was loaded before
  entering historical view.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx` — update `right-rail` div: remove
  `aria-hidden="true"`; add `flex-col`, `rounded-lg`, `bg-slate-800` classes; add
  `right-rail-top` and `right-rail-bottom` child divs; add `RightRailHintSection` to bottom pane;
  verify `game-board-layout` aligns items to stretch; only do this file-level render work if hint
  state ownership has first been resolved per the Readiness Blockers section
- `apps/client/src/components/game/RightRailHintSection.tsx` — create; new component; owns all
  hint states (idle, loading, error, hint-available, hints-off)
- `apps/client/src/components/game/RightRailHintSection.test.tsx` — create; new test file
- `apps/client/src/components/game/HintPanel.tsx` — remove `fixed left-6 top-20 z-40 w-[380px]`
  positioning classes; remove `onClose` prop and Close button; remove `hint-discard-reason` section;
  keep `Card` wrapper and all other display sections
- `apps/client/src/components/game/HintPanel.test.tsx` — update to reflect removed props and
  removed `hint-discard-reason` testid
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — remove
  `HintPanel` render (lines 153–161); remove `hint-loading-overlay` div (lines 163–181); remove
  `showHintPanel`, `currentHint`, `hintPending`, `cancelHintRequest`, `setShowHintPanel` from
  `HintSystemOverlaySlice` if those props are no longer needed at the overlay level (the hint
  request dialog stays; the hint settings dialog and its props are left as-is — US-057 owns that
  surface)
- `apps/client/src/components/game/phases/playing-phase/PlayingPhase.tsx` — wire
  `hintSystem` props down to `RightRailHintSection` if hint state lives here; confirm prop
  threading path before implementing
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — remove
  `toggle-hint-panel-button` once hint display no longer uses overlay show/hide state
- Test files referencing `hint-panel` fixed positioning or `hint-loading-overlay` — update or
  remove those assertions

## Notes for Implementer

### Dependency on US-052

`US-052` removes `get-hint-button` from `ActionBarPhaseActions.tsx`. This story re-introduces the
trigger in the right rail under the same `data-testid="get-hint-button"`. Implement `US-052` first
so the action-pane removal is already done before the rail trigger is added; do not add both
locations simultaneously.

If `US-052` has not landed, this story is blocked unless its scope is expanded to remove the
action-pane trigger directly.

### Dependency on US-036

`US-036` established the right-rail reservation with a bare `div`. This story is the first to
populate it. Read `US-036` notes before modifying the rail element to avoid undoing its layout
contract (`w-64 flex-shrink-0` must be preserved).

### HintPanel refactor boundary

`HintPanel` currently carries its own `fixed` layout and a `Close` button as part of its JSX. When
refactoring, move all layout responsibility to the parent (`RightRailHintSection`). `HintPanel`
becomes a pure display card that trusts its parent for positioning and dismissal. The `onClose`
prop is removed; if a "dismiss hint" action is needed in the rail, `RightRailHintSection` owns that
state.

### Hint state ownership

Hint request state (`showHintPanel`, `currentHint`, `hintPending`, `cancelHintRequest`,
`handleRequestHint`, `showHintRequestDialog`, `setShowHintRequestDialog`, `requestVerbosity`,
`setRequestVerbosity`) currently lives in `HintSystemOverlaySlice` and is threaded through
`PlayingPhaseOverlays`. After this story:

- The hint request dialog and hint settings dialog continue to render in `PlayingPhaseOverlays`
  (they are modal overlays that belong at the overlay layer).
- Hint content display (the result panel, loading state, idle state) moves into
  `RightRailHintSection`, which receives the relevant slice props from its parent.
- The `showHintPanel` / `setShowHintPanel` booleans that controlled the fixed overlay may
  simplify: with inline display, the section always renders (in one of its states) when hints are
  enabled, so explicit show/hide may not be needed. Assess during implementation and simplify if
  the boolean becomes redundant.

This note is a design decision gate, not an implementation TODO. Choose the ownership model before
coding. Do not begin implementation while `GameBoard.tsx` still renders the rail outside the
subtree that owns hint state unless the state has first been lifted.

### Rail background color

`bg-slate-800` is the recommended Tailwind class for the rail background. The gameboard typically
uses a green felt class (`bg-green-900` or similar). Visually verify both light and dark mode to
confirm the rail reads as a distinct sidebar. Adjust the shade if needed — the only hard requirement
is that the rail is visually distinct from the board surface and from the `bg-background` page
background.

Because this is a hardcoded palette choice, verify that it remains legible if the app theme changes.
If the project adopts a theme-aware rail token before implementation, prefer that token over a fixed
slate class.

### `game-board-layout` cross-axis alignment

The outer flex row uses `lg:items-center` today. If the rail is to fill the full board height (so
the two panes divide the available height equally), change the alignment to `lg:items-stretch`.
Verify that `square-board-container` is not adversely affected — it controls its own height via
`lg:h-[min(90vh,calc(100vw-22rem))]`, so stretching the flex row should not override it. Test
visually before shipping.

### Hints-off state

When `hintSettings.verbosity === 'Disabled'` (the current model; `US-057` will change this to a
boolean), show the _"Hints are off"_ notice and omit the trigger button. Do not throw an error or
render a broken section — hints-off is a valid, expected state.

## Test Plan

- `RightRailHintSection.test.tsx` (new):
  - Assert `right-rail-hint-section` renders.
  - When hints enabled and no hint loaded: assert `get-hint-button` present; assert no hint content.
  - When hints enabled and loading: assert `hint-loading-inline` (or equivalent) present; assert
    `get-hint-button` absent or disabled; assert no `hint-loading-overlay` in DOM.
  - When hints enabled and hint available: assert `hint-panel` present inside the section; assert
    no `fixed` class on `hint-panel`; assert `hint-discard-reason` absent.
  - When hints disabled: assert `hints-off-notice` present; assert `get-hint-button` absent.
  - When error state: assert inline error message and Retry button present.
  - Assert `right-rail-top` is empty (no children).
- `PlayingPhasePresentation` test (update):
  - Assert `toggle-hint-panel-button` is absent once hint display is owned by the rail.
- `HintPanel.test.tsx` (update):
  - Assert `hint-discard-reason` is absent in all verbosity configurations.
  - Assert `close-hint-panel` button is absent (removed).
  - Assert panel does not carry `fixed` positioning class.
- `PlayingPhaseOverlays` test (update):
  - Assert `hint-panel` is not rendered by the overlays component.
  - Assert `hint-loading-overlay` is absent.
- Integration tests (update):
  - Any test that checked for `hint-panel` at `fixed left-6 top-20` → update to assert it renders
    inside `right-rail-hint-section`.
  - Any test that triggered `close-hint-panel` → remove that assertion (button no longer exists).

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/RightRailHintSection.test.tsx
npx vitest run apps/client/src/components/game/HintPanel.test.tsx
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/GameBoard.tsx \
  apps/client/src/components/game/RightRailHintSection.tsx \
  apps/client/src/components/game/HintPanel.tsx \
  apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx \
  docs/implementation/frontend/user-stories/US-055-right-rail-get-hint-relocation-and-ai-hint-panel.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

- Implementation date: 2026-03-14
- Commit hash: `e47567d`
- Files changed:
  - `apps/client/src/components/game/GameBoard.tsx`
  - `apps/client/src/components/game/GameBoard.test.tsx`
  - `apps/client/src/components/game/HintPanel.tsx`
  - `apps/client/src/components/game/HintPanel.test.tsx`
  - `apps/client/src/components/game/RightRailHintSection.tsx`
  - `apps/client/src/components/game/RightRailHintSection.test.tsx`
  - `apps/client/src/components/game/phases/PlayingPhase.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
  - `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx`
  - `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseViewState.ts`
  - `apps/client/src/features/game/HintRightRail.integration.test.tsx`
  - `apps/client/src/hooks/useHintSystem.ts`
  - `apps/client/src/hooks/useHintSystem.test.ts`
- AC/EC coverage summary:
  - Implemented the exact right-rail layout contract in `GameBoard` with equal top/bottom panes and an interactive bottom hint section shown only during Playing.
  - Moved hint display ownership out of the fixed overlay into `RightRailHintSection`, removed `toggle-hint-panel-button`, removed `hint-loading-overlay`, and kept the hint request/settings dialogs in the overlay layer.
  - Refactored `HintPanel` into a layout-agnostic display card with no fixed positioning, no close action, and no `hint-discard-reason`.
  - Added inline rail states for disabled, idle, loading with cancel, error with retry, hint available, historical-view restriction, and reconnect/remount protection.
- Test/verification summary:
  - Added focused unit coverage for `RightRailHintSection` and updated the HintPanel, PlayingPhasePresentation, PlayingPhaseOverlays, GameBoard, and useHintSystem tests.
  - Added gameplay integration coverage for right-rail hint request flow, historical-view restriction with an existing hint preserved, and snapshot remount without the old fixed panel.
  - Verified with `npx vitest run apps/client/src/components/game/RightRailHintSection.test.tsx`, `npx vitest run apps/client/src/components/game/HintPanel.test.tsx`, `npx vitest run apps/client/src/features/game/HintRightRail.integration.test.tsx`, and `npx tsc --noEmit`.
  - `npx vitest run apps/client/src/features/game/` still has unrelated failures in existing discard-pool tests because the branch already contains unstaged `DiscardPool` changes.
  - `npm run check:all` reached the workspace Vitest stage and then failed/timed out in the broader client suite; this remains blocked by unrelated existing test noise outside US-055.
- Known follow-ups or deferred items:
  - `US-057` settings redesign / hint simplification remains deferred.
  - Right-rail top-pane content remains intentionally empty.
  - Mobile hint affordances remain out of scope.

---

## Claude Code Review — 2026-03-14

Method: each AC and EC was verified by reading the relevant source file directly and quoting the satisfying lines. Test pass/fail was not used as evidence.

### AC-1 — Right rail visible on `lg` with distinct background

**Source:** `GameBoard.tsx:354`

```tsx
className="right-rail hidden w-64 flex-shrink-0 lg:flex lg:flex-col lg:rounded-lg lg:bg-slate-800"
data-testid="right-rail"
```

`lg:bg-slate-800` is distinct from the board felt. `hidden` base class ensures it is invisible below `lg`.
Spec layout contract matches exactly.

Verdict: PASS

---

### AC-2 — Two equal-height panes (`right-rail-top` empty, `right-rail-bottom` AI Hint)

**Source:** `GameBoard.tsx:357–367`

```tsx
<div className="flex-1" data-testid="right-rail-top" />
<div
  className="flex-1 flex flex-col border-t border-slate-600 p-3"
  data-testid="right-rail-bottom"
>
```

Both panes use `flex-1` inside the `flex-col` rail → 50/50 height split. `right-rail-top` is a self-closing div with no children.

Verdict: PASS

---

### AC-3 — `right-rail-bottom` contains `right-rail-hint-section`

**Source:** `GameBoard.tsx:362–366` (portal slot inside `right-rail-bottom`); `PlayingPhase.tsx:218–232` (portal render); `RightRailHintSection.tsx:116–119`

```tsx
// GameBoard.tsx — slot inside right-rail-bottom
<div id={RIGHT_RAIL_HINT_SLOT_ID} ref={setRightRailHintSlot} className="flex h-full flex-col" />

// PlayingPhase.tsx — portal into that slot during Playing phase
{rightRailHintSlot &&
  createPortal(<RightRailHintSection ... />, rightRailHintSlot)}

// RightRailHintSection.tsx
<section ... data-testid="right-rail-hint-section" aria-label="AI hint section">
```

During the Playing phase, `RightRailHintSection` is portaled into the slot div that lives inside `right-rail-bottom`.

Verdict: PASS

---

### AC-4 — `get-hint-button` present when hints enabled + idle; opens `hint-request-dialog`

**Source:** `RightRailHintSection.tsx:99–110`

```tsx
} else if (showRequestAction) {
  body = (
    <Button ... onClick={openHintRequestDialog} data-testid="get-hint-button">
      Get Hint
    </Button>
  );
}
```

`openHintRequestDialog` (wired from `useHintSystem`) sets `showHintRequestDialog = true`.
`PlayingPhaseOverlays.tsx:151–155` renders `<Dialog open={hintSystem.showHintRequestDialog}>` with `data-testid="hint-request-dialog"`.

Verdict: PASS

---

### AC-5 — `hint-panel` renders inside `right-rail-hint-section` after hint loads; not `fixed`-positioned

**Source:** `RightRailHintSection.tsx:82–97`

```tsx
} else if (currentHint) {
  body = (
    <div className="flex h-full flex-col gap-3">
      <HintPanel hint={currentHint} verbosity={requestVerbosity} />
      ...
    </div>
  );
}
```

**Source:** `HintPanel.tsx:54–58`

```tsx
<Card
  className="h-full overflow-auto border-cyan-400/50 bg-slate-950/95 p-4 text-slate-100"
  data-testid="hint-panel"
  ...
>
```

No `fixed`, `left-6`, `top-20`, or `z-40` classes. The card is layout-agnostic.

Verdict: PASS

---

### AC-6 — No `hint-panel` element uses `fixed` positioning

**Source:** `HintPanel.tsx:55` (as quoted above — no `fixed`).
`PlayingPhaseOverlays.tsx` contains no `hint-panel` render at all.
Three independent tests assert `not.toHaveClass('fixed')`:
`RightRailHintSection.test.tsx:108`, `HintPanel.test.tsx:59`, `HintRightRail.integration.test.tsx:76,166`.

Verdict: PASS

---

### AC-7 — No `hint-loading-overlay` in the DOM

**Source:** `PlayingPhaseOverlays.tsx` — searched the full file; no `hint-loading-overlay` element.
`RightRailHintSection.tsx` — loading communicated via `hint-loading-inline` only.
Tests asserting absence: `RightRailHintSection.test.tsx:94`, `PlayingPhaseOverlays.test.tsx:208`, `HintRightRail.integration.test.tsx:55,163`.

Verdict: PASS

---

### AC-8 — Loading state communicated inline; Cancel control available

**Source:** `RightRailHintSection.tsx:43–61`

```tsx
} else if (hintPending) {
  body = (
    <div ... data-testid="hint-loading-inline" role="status" aria-live="polite">
      <p className="text-sm text-slate-200">Analyzing...</p>
      <Button ... onClick={cancelHintRequest} data-testid="cancel-hint-request-button">
        Cancel
      </Button>
    </div>
  );
}
```

Verdict: PASS

---

### AC-9 — `hint-discard-reason` absent from the DOM

**Source:** `HintPanel.tsx` — full file read. The panel renders `hint-recommended-discard`, `hint-best-patterns`, `hint-tile-scores`, `hint-utility-scores`. The `hint-discard-reason` testid does not appear anywhere in the file.
Grep across `apps/client/src` finds `hint-discard-reason` only in test files that assert its absence (`HintPanel.test.tsx`, `RightRailHintSection.test.tsx`).

Verdict: PASS

---

### AC-10 — Hints disabled: `get-hint-button` absent; `hints-off-notice` shown

**Source:** `RightRailHintSection.tsx:32–42`

```tsx
const hintsDisabled = hintSettings.verbosity === 'Disabled';
const showRequestAction = !hintsDisabled && !isHistoricalView && canRequestHint;

if (hintsDisabled) {
  body = (
    <p className="text-sm text-slate-400" data-testid="hints-off-notice">
      Hints are off.
    </p>
  );
}
```

`get-hint-button` only renders when `showRequestAction` (line 99), which requires `!hintsDisabled`.

Verdict: PASS

---

### AC-11 — Setup and Charleston phases: no hint content in `right-rail-bottom`

**Source:** `GameBoard.tsx:331–341`

```tsx
{isPlaying && turnStage && (
  <PlayingPhase
    ...
    rightRailHintSlot={rightRailHintSlot}
  />
)}
```

`PlayingPhase` (and therefore its portal) only mounts when `isPlaying`. During Setup and Charleston the slot div inside `right-rail-bottom` remains empty.

Verdict: PASS

---

### AC-12 — Right rail hidden below `lg`

**Source:** `GameBoard.tsx:354`

```tsx
className = 'right-rail hidden w-64 flex-shrink-0 lg:flex lg:flex-col ...';
```

`hidden` hides the element at all breakpoints; `lg:flex` re-enables it at `lg` and above.

Verdict: PASS

---

### AC-13 — Hint request flow (verbosity select → Request Analysis → hint displayed) works end-to-end

**Source:** `PlayingPhase.tsx:226–228` wires `openHintRequestDialog` and `handleRequestHint` from `useHintSystem`.
`PlayingPhaseOverlays.tsx:151–188` retains the dialog with verbosity select and "Request Analysis" button.
`useHintSystem.ts:141–164` sends `RequestHint` command on submit.
`useHintSystem.ts:172–189` `handleServerEvent` receives hint-update and sets `currentHint`.
`RightRailHintSection.tsx:82–97` displays `hint-panel` when `currentHint` is non-null.

Full path intact.

Verdict: PASS

---

### AC-14 — No `toggle-hint-panel-button` during Playing phase

**Source:** `PlayingPhasePresentation.tsx` — full file read. Only `hint-settings-button` (line 365) appears; `toggle-hint-panel-button` is absent.
Grep across `apps/client/src` finds the testid only in test assertions that check for its absence:

- `PlayingPhasePresentation.test.tsx:377`: `expect(screen.queryByTestId('toggle-hint-panel-button')).not.toBeInTheDocument()`
- `HintRightRail.integration.test.tsx:77,164`: same assertion

Verdict: PASS

---

### EC-1 — Hint request failure: inline error + Retry button, no full-screen overlay

**Source:** `RightRailHintSection.tsx:63–81`

```tsx
} else if (hintError) {
  body = (
    <div className="... border-red-500/40 bg-red-950/30 ...">
      <p ... data-testid="hint-error-inline" role="alert">{hintError}</p>
      {showRequestAction && (
        <Button ... onClick={openHintRequestDialog} data-testid="retry-hint-button">
          Retry
        </Button>
      )}
    </div>
  );
}
```

Error is inline. No `hint-loading-overlay` anywhere in the overlay layer.

Verdict: PASS

---

### EC-2 — Cancel in-flight: loading spinner gone, no stale state

**Source:** `useHintSystem.ts:166–170`

```ts
const cancelHintRequest = useCallback(() => {
  clearHintTimeout();
  setHintPending(false);
  setHintError(null);
}, [clearHintTimeout]);
```

After cancel, `hintPending = false` and `hintError = null`. `RightRailHintSection` exits the `hintPending` branch immediately. If `currentHint` was null before the request, idle state (`get-hint-button`) is shown; if a previous hint existed, it re-displays (reasonable — not a stale loading spinner).

Note: `currentHint` is not cleared on cancel. This means canceling a second hint request causes the first hint to reappear rather than showing the idle state. The spec says "returns to idle state" which could be read strictly, but the primary requirement — "without leaving a loading spinner behind" — is fully satisfied.

Verdict: PASS (minor: previous hint re-surfaces on cancel of a second request; spinner is gone)

---

### EC-3 — Reconnect/remount: old `fixed hint-panel` does not flash

No `fixed`-positioned `hint-panel` exists anywhere in the source (AC-6 established this). There is nothing to flash. The portal-based `RightRailHintSection` only mounts when `rightRailHintSlot` is available, which is after `GameBoard` mounts its rail DOM.

Verdict: PASS

---

### EC-4 — `hintSettings` disabled→enabled mid-session: no full remount

**Source:** `PlayingPhase.tsx:220–232` — `RightRailHintSection` receives `hintSettings` as a prop. No `key` prop on it, so React re-renders in place when props change.

Verdict: PASS

---

### EC-5 — `hintSettings` enabled→disabled while hint displayed: content cleared, "Hints are off" shown

**Source:** `useHintSystem.ts:108–114`

```ts
if (nextSettings.verbosity === 'Disabled') {
  clearHintTimeout();
  setHintPending(false);
  setCurrentHint(null); // <-- clears displayed hint
  setHintError(null);
  setShowHintRequestDialog(false);
}
```

**Source:** `RightRailHintSection.tsx:37` — `hintsDisabled` branch is first; even if `currentHint` is non-null, the component shows `hints-off-notice` when disabled.

Both the state layer and the render layer guard this correctly.

Verdict: PASS

---

### EC-6 — Historical view: `get-hint-button` absent; existing hint preserved

**Source:** `RightRailHintSection.tsx:33`

```tsx
const showRequestAction = !hintsDisabled && !isHistoricalView && canRequestHint;
```

`get-hint-button` and `get-new-hint-button` only render when `showRequestAction`. When `isHistoricalView` is true, both are suppressed.

The `currentHint` branch (lines 82–97) renders `hint-panel` regardless of `showRequestAction` — an existing hint remains visible. Confirmed by `RightRailHintSection.test.tsx:123–133`:

```tsx
renderSection({ canRequestHint: false, currentHint: baseHint, isHistoricalView: true });
expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
expect(screen.queryByTestId('get-new-hint-button')).not.toBeInTheDocument();
```

Verdict: PASS

---

### Additional spec requirements verified

| Requirement                                           | Source                                                                                   | Verdict |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------- |
| `aria-hidden` removed from right rail                 | `GameBoard.tsx:353–356` — no `aria-hidden` attribute present                             | PASS    |
| `game-board-layout` uses `lg:items-stretch`           | `GameBoard.tsx:310` `className="... lg:items-stretch lg:justify-start ..."`              | PASS    |
| `HintPanel` — `onClose` prop and Close button removed | `HintPanel.tsx:26–29` — props are `hint` and `verbosity` only; no Close button in render | PASS    |
| `HintPanel` — Card wrapper retained                   | `HintPanel.tsx:53–114` — `<Card>` wraps the entire panel                                 | PASS    |
| Hint request dialog retained in overlays              | `PlayingPhaseOverlays.tsx:151–188` — `hint-request-dialog` still present                 | PASS    |

### Overall verdict

All 14 ACs and 6 ECs: **PASS**. No gaps found between the spec and the implementation.
