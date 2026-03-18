# US-061: Action Bar Message Hierarchy and Deduplication

## Status

- State: Ipmlemented
- Priority: High
- Batch: G
- Implementation Ready: Yes

## Problem

The board is currently speaking in multiple voices at once.

- `GameplayStatusBar` renders phase and turn-state copy.
- `ActionBarPhaseActions` renders another instructional line.
- Charleston and call-window branches also render local waiting text near the buttons.

This creates duplicate and triplicate messaging such as:

- top banner says whose turn or what phase is active
- action bar repeats the same instruction in slightly different words
- a second inline "waiting" line appears under the action buttons

The result is noisy, harder to scan, and makes the action area look broken even when the underlying
state is correct.

## Scope

**In scope:**

- Define a single message hierarchy for the top status bar, action bar, and transient phase copy.
- Remove duplicate instructional text from the action area.
- Keep action controls persistent while reducing copy to one primary instruction and, at most, one
  secondary contextual note.
- Normalize Charleston, playing, and call-window wording so the same state is not described in two
  places.
- Add tests that fail if duplicate waiting/instructional copy returns.

**Out of scope:**

- Reworking Charleston pass rules or action availability.
- New visual styling beyond what is required to support the copy hierarchy.
- Right-rail layout; that belongs to a separate recovery story.

## Acceptance Criteria

- AC-1: At any point in normal play, the board exposes exactly one primary action instruction in
  the action area.
- AC-2: `GameplayStatusBar` owns phase/turn/status context; it does not duplicate the action bar's
  imperative instruction verbatim.
- AC-3: `ActionBarPhaseActions` owns the next actionable instruction for the local player; it does
  not repeat phase labels or global status text already shown above.
- AC-4: Charleston waiting states render only one waiting message on screen for the local player.
- AC-5: Call-window states render only one explicit decision prompt on screen for the local player.
- AC-6: If no local action is available, the action bar shows either:
  - a concise waiting message, or
  - no instructional line at all
    but never both in separate stacked regions.
- AC-7: Charleston Proceed/Pass states do not render a second inline "waiting for other players"
  line beneath controls when a top-level waiting/status line is already present.
- AC-8: Duplicate semantically equivalent strings such as "waiting", "your turn", "choose tiles",
  or "select a tile" are not rendered in multiple adjacent regions for the same state.
- AC-9: Tests cover Charleston, discard turn, and call window states and fail if duplicate message
  regions reappear.

## Edge Cases

- EC-1: When the local player cannot act during a call window, the UI still communicates the state
  once without leaving an empty-looking action bar.
- EC-2: Historical/replay mode remains read-only and does not leak live-action copy into the action
  bar.
- EC-3: Mobile and desktop layouts use the same copy hierarchy; the fix is not desktop-only.
- EC-4: If button labels already imply the action, the instructional line stays short and does not
  restate each button's text.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/GameplayStatusBar.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.test.tsx`
- `apps/client/src/components/game/GameplayStatusBar.test.tsx`

## Notes for Implementer

### Ownership rule

Use a strict split:

1. Top status bar:
   - phase
   - turn ownership
   - global waiting / review / replay context
2. Action bar:
   - the one thing the local player should do next
3. Inline helper text:
   - only if it adds information not already represented above or by the buttons themselves

If a sentence can be deleted without losing information because another visible region already says
it, delete it.

### Test requirement

The repaired tests should assert message count and semantic uniqueness, not just string presence.
Avoid tests that pass because duplicate copy happens to contain the expected phrase somewhere.

## Test Plan

- Action-bar tests:
  - local Charleston action state
  - local Charleston waiting state
  - discard-turn action state
  - non-turn waiting state
- Board-level tests:
  - call-window prompt appears once
  - waiting message appears once
  - replay/historical mode does not render live-action prompts

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/ActionBarPhaseActions.test.tsx
npx vitest run src/components/game/GameplayStatusBar.test.tsx
npx vitest run src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```

---

## Codex Implementation Summary

Implemented US-061 by splitting message ownership cleanly between the top status bar and the action pane.

The main changes are in [ActionBarDerivations.ts](C:\Repos\mpmahj\apps\client\src\components\game\ActionBarDerivations.ts), [ActionBarPhaseActions.tsx](C:\Repos\mpmahj\apps\client\src\components\game\ActionBarPhaseActions.tsx), [ActionBar.tsx](C:\Repos\mpmahj\apps\client\src\components\game\ActionBar.tsx), [GameplayStatusBar.tsx](C:\Repos\mpmahj\apps\client\src\components\game\GameplayStatusBar.tsx), [CharlestonPhase.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\CharlestonPhase.tsx), and [PlayingPhasePresentation.tsx](C:\Repos\mpmahj\apps\client\src\components\game\phases\playing-phase\PlayingPhasePresentation.tsx). `GameplayStatusBar` now owns context/status copy, Charleston voting/pass status moved out of the action pane, duplicate Charleston waiting lines were removed, call-window claim feedback now lives in the instruction line instead of a separate card, and non-acting call windows render a blank action region.

AC/EC coverage: Charleston waiting/prompt deduplication, discard/action hierarchy, call-window single-prompt behavior, and read-only status-bar behavior are covered. Deferred items stayed deferred: no Charleston rule changes, no right-rail work, no broader visual redesign.

Tests updated in [ActionBarPhaseActions.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\ActionBarPhaseActions.test.tsx), [GameplayStatusBar.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\GameplayStatusBar.test.tsx), [ActionBar.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\ActionBar.test.tsx), and [GameBoard.test.tsx](C:\Repos\mpmahj\apps\client\src\components\game\GameBoard.test.tsx). Verification run: `npx vitest run src/components/game/ActionBarPhaseActions.test.tsx src/components/game/GameplayStatusBar.test.tsx src/components/game/GameBoard.test.tsx` and `npx tsc --noEmit`, all passing. I did not run the full repo-wide pre-commit pipeline.

---

## Claude Validation Summary

TBD
