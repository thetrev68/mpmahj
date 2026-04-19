# US-052: Gameplay Action Pane + Controls Cleanup

## Status

- State: Completed
- Priority: High
- Batch: E

## Problem

Five related issues make the gameplay action pane and board controls noisy and inconsistent with the
Charleston two-button model established in `US-051`.

### G-2 — Action Pane: Match Charleston Model — Two Buttons Only

During the Playing phase the action pane renders up to four extra controls alongside Proceed and
Mahjong: **Get Hint** (`get-hint-button`), **Exchange Joker** (`exchange-joker-button`), and the
**Undo** section (via `ActionBarUndoControls`). These clutter the pane and will each be addressed
elsewhere (Get Hint → G-4 / US-055; Exchange Joker → G-5 / US-053; Undo → G-6 below).

The two-button model — Proceed + Mahjong, always visible, disabled when unavailable — already
applies to the Charleston phase after `US-051`. Gameplay must mirror it.

### G-3 — Status Bar: Extend Turn-Ownership Text to Top Bar + Remove Redundant Line

During Charleston, `CharlestonTracker` renders a full-width shaded bar at `fixed top-0 left-0
right-0 z-20` showing pass direction, progress, ready state, and timer. This bar disappears
entirely when gameplay begins.

During gameplay, `ActionBarPhaseActions.tsx` renders a `playing-status` div in the action pane
containing turn-ownership text such as _"Your turn - Select a tile to discard"_ or
_"West's turn - Discarding"_. That text belongs in the top status bar, not the action pane. The
action pane already has an `action-instruction` line for phase-specific guidance; duplicating
ownership state below it adds noise and pulls the eye away from the primary action.

The fix is to introduce a `GameplayStatusBar` component — styled and positioned identically to
`CharlestonTracker` — that renders during the Playing phase and displays turn-ownership status.
Once that bar exists, the `playing-status` div is removed from the action pane.

The `action-instruction` text (`getInstructionText`) remains in the action pane unchanged.

The board already carries `pt-16` top padding to accommodate the fixed bar; this padding must be
preserved during gameplay.

### G-6 — Undo: Remove Entirely

`ActionBarUndoControls` renders below the phase actions in `ActionBar.tsx` (lines 155–168). The
undo mechanism does not work reliably. The history panel covers the relevant use case. The component
and all its UI should be deleted.

### CC-1 — Remove Start Over Button

`GameBoard.tsx` renders a **Start Over** button (`start-over-button`, lines 280–291) in the
`board-controls-strip`. It duplicates the functionality of **Leave Game**, which `US-033` already
established as the sole exit path. The button and its `handleStartOver` handler (lines 129–135)
should be deleted.

### G-7 — Remove Sound Settings Placeholder Panel

`GameBoard.tsx` renders a `sound-settings-placeholder` panel (`absolute right-4 top-16 z-30 w-64`)
when `showSoundSettings` is true. The panel shows _"Sound settings coming soon"_ and a TODO comment
about Auto-sort hand. It is vestigial — audio settings will live in the settings modal (US-057).

The Auto-sort TODO must be migrated to `TODO.md` before the panel is deleted so the task is not
lost.

The `showSoundSettings` state, the `board-settings-button` toggle, and the `sound-settings-placeholder`
div are all removed together. The Settings icon button that toggles the panel is removed; if a
persistent settings entry point is needed it will be added in a later story.

## Scope

**In scope:**

- Remove `get-hint-button` and `exchange-joker-button` from `ActionBarPhaseActions.tsx`.
  Props `canRequestHint`, `onOpenHintRequest`, `isHintRequestPending`, `canExchangeJoker`, and
  `onExchangeJoker` are removed from `ActionBarPhaseActionsProps`, from `ActionBar.types.ts`
  (if present), and from all call sites.
- Remove `ActionBarUndoControls` render from `ActionBar.tsx` (lines 155–168) and all undo-related
  props from `ActionBarProps` that are no longer needed (`showSoloUndo`, `soloUndoRemaining`,
  `soloUndoLimit`, `undoRecentActions`, `undoPending`, `onUndo`, `showUndoVoteRequest`,
  `undoVoteRemaining`, `onRequestUndoVote`, `disableUndoControls`). Delete
  `ActionBarUndoControls.tsx` and `ActionBarUndoControls.test.tsx` if the component has no other
  render sites.
- Remove `UndoVotePanel` from `PlayingPhaseOverlays.tsx` and clean up any now-unused undo-vote
  overlay props or imports that only supported the removed gameplay undo UI.
- Remove `playing-status` divs from all Playing sub-stage branches in `ActionBarPhaseActions.tsx`.
- Add Mahjong button to Playing sub-stages that do not currently render it (Drawing, Discarding
  opponent). The button is always rendered in all sub-stages; it is disabled unless
  `canDeclareMahjong` is true.
- Rename `discard-button` → `proceed-button` in all Playing sub-stage branches of
  `ActionBarPhaseActions.tsx` (Drawing, Discarding-my-turn, Discarding-opponent, fallback).
- Rename `call-window-proceed-button` → `proceed-button` in the CallWindow branch.
- Create `GameplayStatusBar.tsx` — a new component styled to match `CharlestonTracker` (same
  fixed positioning, same background gradient, same border-bottom) that shows turn-ownership
  text during the Playing phase.
- Mount `GameplayStatusBar` in the Playing phase render tree (either `PlayingPhase.tsx` or the
  Playing branch of `GameBoard.tsx`) at the same location `CharlestonTracker` occupies during
  Charleston.
- Remove `start-over-button` and `handleStartOver` from `GameBoard.tsx`.
- Remove `sound-settings-placeholder`, `showSoundSettings` state, and `board-settings-button`
  from `GameBoard.tsx`.
- Add Auto-sort hand TODO to `TODO.md` before deleting the placeholder.
- Remove any `undo-notice` overlay in `PlayingPhaseOverlays.tsx` (~lines 357–366) that is
  associated with the undo feature.
- Update all tests that reference removed testids or deleted components.

**Out of scope:**

- Get Hint relocation to the right rail — covered by `US-055`.
- Exchange Joker click-to-exchange flow — covered by `US-053`.
- Undo mechanism fix or server-side undo protocol — superseded by history.
- Audio settings modal content — covered by `US-057`.
- Settings entry-point button (what replaces `board-settings-button`) — deferred.
- `CharlestonTracker` itself is not modified; `GameplayStatusBar` is a new sibling component.
- Timer display in `GameplayStatusBar` — deferred unless a per-turn timer already drives
  Playing-phase state; do not introduce a new timer model in this story.
- `action-instruction` text changes — the existing `getInstructionText` output remains
  unchanged for all Playing sub-stages.

## Acceptance Criteria

- AC-1: During all Playing sub-stages (`Drawing`, `Discarding` my turn, `Discarding` opponent,
  `CallWindow`), the action pane renders exactly two action buttons: **Proceed** and **Mahjong**.
  No other action buttons appear in the pane.
- AC-2: No element with `data-testid="get-hint-button"` exists in the DOM during any Playing
  sub-stage.
- AC-3: No element with `data-testid="exchange-joker-button"` exists in the DOM during any Playing
  sub-stage.
- AC-4: No undo-related button or panel (`undo-button`, `undo-vote-button`, `undo-notice`) exists
  in the DOM during any game phase.
- AC-5: The Proceed button uses `data-testid="proceed-button"` in all Playing sub-stages
  (the old `discard-button` and `call-window-proceed-button` testids no longer appear).
- AC-6: The Mahjong button uses `data-testid="declare-mahjong-button"` and is present in all
  Playing sub-stages. It is disabled when `canDeclareMahjong` is false and enabled when
  `canDeclareMahjong` is true (subject to per-stage gating in the matrix below).
- AC-7: A `GameplayStatusBar` element (`data-testid="gameplay-status-bar"`) is rendered in the
  DOM during the Playing phase, fixed at `top-0 left-0 right-0` with the same visual style as
  `CharlestonTracker`.
- AC-8: The `GameplayStatusBar` displays turn-ownership text matching the copy matrix in Notes for
  Implementer for each Playing sub-stage and seat combination.
- AC-9: No element with `data-testid="playing-status"` exists in the DOM during any Playing
  sub-stage.
- AC-10: No element with `data-testid="start-over-button"` exists in the DOM.
- AC-11: No element with `data-testid="sound-settings-placeholder"` exists in the DOM.
- AC-12: No element with `data-testid="board-settings-button"` exists in the DOM (the settings
  toggle that opened the placeholder is removed alongside it).
- AC-13: `TODO.md` contains an entry for Auto-sort hand settings surface.
- AC-14: Existing leave-game flow (`leave-game-button`) continues to work without regression.
- AC-15: The `pt-16` top padding on the board container is preserved during the Playing phase so
  board content is not obscured by the fixed status bar.

## Edge Cases

- EC-1: During `Drawing` (my turn), Proceed is disabled and Mahjong is disabled — the player
  cannot act until the tile is drawn and the stage advances to `Discarding`.
- EC-2: During `Discarding` (opponent), Proceed is disabled and Mahjong is disabled — the local
  player cannot act.
- EC-3: During `CallWindow` when `can_act` does not include `mySeat`, Proceed is disabled
  and Mahjong is disabled.
- EC-4: Read-only / historical view mode: both buttons are absent (the read-only banner renders
  instead), consistent with current behavior and the `US-051` pattern for Charleston. No change
  to `readOnly` rendering path. `GameplayStatusBar` is also hidden in read-only mode.
- EC-5: When `disabled` or `isBusy` is true, both Proceed and Mahjong are disabled.
- EC-6: Reconnect / remount during any Playing sub-stage must not cause removed testids
  (`playing-status`, `get-hint-button`, `exchange-joker-button`, `undo-notice`) to flash into
  the DOM before settling.
- EC-7: `GameplayStatusBar` must not render during the Setup or Charleston phase — only during
  Playing. During Setup and Charleston, `CharlestonTracker` (or its Setup equivalent) already
  occupies the top bar slot.

## Primary Files (Expected)

- `apps/client/src/components/game/ActionBarPhaseActions.tsx` — remove `get-hint-button`,
  `exchange-joker-button`, and `playing-status` divs; rename `discard-button` and
  `call-window-proceed-button` to `proceed-button`; add Mahjong button to Drawing and
  Discarding-opponent branches; remove unused props from the interface
- `apps/client/src/components/game/ActionBar.tsx` — remove `ActionBarUndoControls` render
  (lines 155–168); remove undo props from component interface
- `apps/client/src/components/game/ActionBar.types.ts` — remove undo-related and hint-related
  prop declarations that are no longer forwarded
- `apps/client/src/components/game/ActionBarUndoControls.tsx` — delete (if no other render site)
- `apps/client/src/components/game/ActionBarUndoControls.test.tsx` — delete
- `apps/client/src/components/game/GameplayStatusBar.tsx` — create; new component
- `apps/client/src/components/game/GameplayStatusBar.test.tsx` — create; new test file
- `apps/client/src/components/game/phases/PlayingPhase.tsx` or
  `apps/client/src/components/game/GameBoard.tsx` — mount `GameplayStatusBar`; identify actual
  render site before implementing
- `apps/client/src/components/game/GameBoard.tsx` — remove `start-over-button`,
  `handleStartOver`, `sound-settings-placeholder`, `showSoundSettings` state,
  `board-settings-button`, and `RotateCcw` / `Settings` imports if no longer used
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — remove
  `undo-notice` overlay (~lines 357–366) and `UndoVotePanel` render if present
- `TODO.md` — add Auto-sort hand entry
- Test files referencing removed testids — update as needed (see Test Plan)

## Notes for Implementer

### Button-state matrix — Playing sub-stages

Both buttons are always rendered. The matrix says when each is enabled.

| Sub-stage                 | Proceed enabled when                         | Mahjong enabled when          |
| ------------------------- | -------------------------------------------- | ----------------------------- |
| `Drawing` (my turn)       | never (auto-draw; player cannot act yet)     | `canDeclareMahjong`           |
| `Drawing` (opponent)      | never                                        | `canDeclareMahjong`           |
| `Discarding` (my turn)    | `canCommitDiscard && !suppressDiscardAction` | `canDeclareMahjong`           |
| `Discarding` (opponent)   | never                                        | `canDeclareMahjong`           |
| `CallWindow` (can act)    | `canAct && canProceedCallWindow`             | `canAct && canDeclareMahjong` |
| `CallWindow` (cannot act) | never                                        | never                         |

In all cases: if `disabled` or `isBusy` is true both buttons are disabled.

Note: The CallWindow Mahjong condition gates on `canAct` as it does in the current code. Do not
relax that gate — a player who cannot act in the call window cannot declare Mahjong either.

Mahjong is a legal action in both Charleston and Gameplay when the server exposes
`canDeclareMahjong = true`. This story does not narrow that product rule. For the current
Gameplay implementation, the existing phase container only sets `canDeclareMahjong` true in legal
Gameplay states, so the Drawing rows above remain effectively disabled unless the server/client
eligibility contract changes in a later story.

### GameplayStatusBar copy matrix

The top bar text during each sub-stage and seat combination:

| Sub-stage    | Is my turn? | Display text                                             |
| ------------ | ----------- | -------------------------------------------------------- |
| `Drawing`    | Yes         | `Your turn — Drawing`                                    |
| `Drawing`    | No          | `{seat}'s turn — Drawing`                                |
| `Discarding` | Yes         | `Your turn — Select a tile to discard`                   |
| `Discarding` | No          | `Waiting for {seat} to discard`                          |
| `CallWindow` | Can act     | `Call window open — Select claim tiles or press Proceed` |
| `CallWindow` | Cannot act  | `Call window open — Waiting for call resolution`         |

`{seat}` is the active player's seat string (e.g., `West`). The bar uses `data-testid="gameplay-status-bar"` and the same visual treatment as `CharlestonTracker` (`fixed top-0 left-0 right-0 z-20`, same background gradient and border-bottom).

### Testid consolidation scope

All Playing-phase Proceed buttons become `proceed-button`:

- `discard-button` → `proceed-button` (Drawing, Discarding-my-turn, Discarding-opponent, fallback)
- `call-window-proceed-button` → `proceed-button` (CallWindow)

The `declare-mahjong-button` testid is unchanged (it already matches the Charleston pattern).

### ActionBarUndoControls removal check

Before deleting `ActionBarUndoControls.tsx`, confirm it has no render site other than `ActionBar.tsx`.
Run `grep -r "ActionBarUndoControls" apps/client/src` to verify. If another render site exists,
flag it rather than silently deleting the file.

### Props cleanup propagation

Removing hint and undo props from `ActionBarPhaseActionsProps` and `ActionBarProps` will cause
TypeScript errors at all call sites that pass those props. Fix all call sites — do not leave
silently-ignored props in place. The most common call site is `GameBoard.tsx` or a phase
container that assembles `ActionBar` props.

### Dependency on US-039 and US-051

`US-039` established persistent action controls. `US-051` applied the two-button model to
Charleston. This story completes the model by applying it to gameplay. Do not remove
`action-instruction` (`data-testid="action-instruction"`) — it remains above the button row.

### Start Over vs Leave Game

`handleStartOver` currently calls `setShowLeaveDialog(true)` and `setLeaveButtonLocked(true)`.
After removal, the Leave Game button (`leave-game-button`) is the sole exit path. Verify that
`setLeaveButtonLocked` is not left dangling after `handleStartOver` is removed; if it is only
called from `handleStartOver`, the state variable may be cleaned up too.

### Sound settings removal

`showSoundSettings` state and the `board-settings-button` click handler exist solely to toggle
the placeholder panel. All three (state, toggle button, placeholder div) are removed together.
The `Settings` icon import from `lucide-react` and the `RotateCcw` import should be removed
if they are no longer used elsewhere in `GameBoard.tsx`.

## Test Plan

- `GameplayStatusBar.test.tsx` (new):
  - Assert `gameplay-status-bar` is present in the DOM with correct text for each sub-stage and
    seat combination from the copy matrix (Drawing/my turn, Drawing/opponent, Discarding/my turn,
    Discarding/opponent, CallWindow/can act, CallWindow/cannot act).
  - Assert `gameplay-status-bar` is absent when `readOnly` is true.
- Update `ActionBarPhaseActions.test.tsx` (or equivalent):
  - Assert `get-hint-button` is absent in all Playing sub-stages.
  - Assert `exchange-joker-button` is absent in all Playing sub-stages.
  - Assert `playing-status` is absent in all Playing sub-stages.
  - Assert `proceed-button` is present in all Playing sub-stages.
  - Assert `declare-mahjong-button` is present in all Playing sub-stages.
  - Assert `proceed-button` disabled state matches the matrix for each sub-stage.
  - Assert `declare-mahjong-button` disabled state matches the matrix for each sub-stage.
- Update `ActionBar.test.tsx` (or equivalent):
  - Assert no undo-related element is rendered (`undo-button`, `undo-vote-button`, etc.).
- Update `PlayingPhaseOverlays.test.tsx` and any undo-focused integration tests:
  - Assert `undo-notice` is absent.
  - Assert `UndoVotePanel` is absent.
  - Remove or rewrite tests that depend on gameplay undo UI being present.
- Update any integration test that uses `discard-button` → change to `proceed-button`.
- Update any integration test that uses `call-window-proceed-button` → change to `proceed-button`.
- Update any integration test that uses `playing-status` → remove assertion or reroute to
  `gameplay-status-bar`.
- Update any integration test that references `get-hint-button` or `exchange-joker-button` in a
  Playing-phase context → remove those assertions.
- Assert `start-over-button` is absent from the DOM in any test that renders `GameBoard`.
- Assert `sound-settings-placeholder` is absent from the DOM in any test that renders `GameBoard`.
- Confirm `ActionBarUndoControls` and `UndoVotePanel` are not imported or referenced in any
  remaining gameplay UI test file.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/GameplayStatusBar.test.tsx
npx vitest run apps/client/src/components/game/ActionBarPhaseActions.test.tsx
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/ActionBarPhaseActions.tsx \
  apps/client/src/components/game/ActionBar.tsx \
  apps/client/src/components/game/GameBoard.tsx \
  apps/client/src/components/game/GameplayStatusBar.tsx \
  TODO.md \
  docs/implementation/frontend/user-stories/US-052-gameplay-action-pane-and-controls-cleanup.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```

## Codex Implementation Summary

Implemented US-052 and committed it as `feat(us-052): implement gameplay action pane and controls cleanup (f14b463)`.

Playing now uses a strict two-button action pane in all sub-stages: `proceed-button` and `declare-mahjong-button`, with the story’s enable/disable matrix applied exactly. `get-hint-button`, `exchange-joker-button`, `playing-status`, the `ActionBarUndoControls` render path, `UndoVotePanel`, `undo-notice`, `start-over-button`, `board-settings-button`, and `sound-settings-placeholder` are removed. I added `GameplayStatusBar.tsx`, mounted it only in Playing and hidden in read-only mode, preserved `pt-16`, updated TODO tracking for Auto-sort, and refreshed the recovery screenshots for the intentional board chrome change.

Test coverage was updated across the component and gameplay integration surface, including [GameplayStatusBar.test.tsx], [ActionBarPhaseActions.test.tsx], [ActionBar.test.tsx], [PlayingPhaseOverlays.test.tsx], [GameBoard.test.tsx], [PlayingPhase.test.tsx], and the affected gameplay integrations. Obsolete undo/hint/joker action-pane integration tests were deleted because the UI they exercised no longer exists.

Verification run: the story vitest targets, `npx vitest run apps/client/src/features/game/`, `npx tsc --noEmit`, the requested Prettier runs, and the full [AGENTS.md] validation pipeline all passed, including `npm run check:all` after updating the Playwright baselines. Deferred items remain the ones called out in the story: hint relocation, exchange-joker replacement flow, undo mechanism/protocol work, settings modal work, and any replacement settings entry point.

Unstaged unrelated changes remain in [US-051-charleston-action-pane-courtesy-pass-and-two-button-model.md] and [USER-TESTING-BACKLOG.md].

30 files changed +367 -2187

TODO.md
apps/client/src/components/game/ActionBar.test.tsx
apps/client/src/components/game/ActionBar.tsx
apps/client/src/components/game/ActionBar.types.ts
apps/client/src/components/game/ActionBarPhaseActions.test.tsx
apps/client/src/components/game/ActionBarPhaseActions.tsx
apps/client/src/components/game/ActionBarUndoControls.tsx
apps/client/src/components/game/GameBoard.test.tsx
apps/client/src/components/game/GameBoard.tsx
apps/client/src/components/game/GameplayStatusBar.test.tsx
apps/client/src/components/game/GameplayStatusBar.tsx
apps/client/src/components/game/phases/PlayingPhase.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx
apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx
apps/client/src/components/game/phases/playing-phase/usePlayingPhaseViewState.ts
apps/client/src/features/game/CallPriorityResolution.integration.test.tsx
apps/client/src/features/game/CallWindow.integration.test.tsx
apps/client/src/features/game/DrawTile.integration.test.tsx
apps/client/src/features/game/HintFlow.integration.test.tsx
apps/client/src/features/game/JokerExchangeMultiple.integration.test.tsx
apps/client/src/features/game/JokerExchangeSingle.integration.test.tsx
apps/client/src/features/game/LeaveGame.integration.test.tsx
apps/client/src/features/game/MahjongSelfDraw.integration.test.tsx
apps/client/src/features/game/Playing.integration.test.tsx
apps/client/src/features/game/UndoSolo.integration.test.tsx
apps/client/src/features/game/UndoVoting.integration.test.tsx
apps/client/src/features/game/calling-pung-kong-quint.integration.test.tsx
apps/client/src/features/game/turn-discard.integration.test.tsx

## Claude Review

The implementation is complete and correct. All 15 acceptance criteria pass.

### Summary by AC

| AC    | Status | Notes                                                                                             |
| ----- | ------ | ------------------------------------------------------------------------------------------------- |
| AC-1  | ✅     | All Playing sub-stages render exactly `proceed-button` + `declare-mahjong-button`                 |
| AC-2  | ✅     | `get-hint-button` absent from action pane (hint UI is in the right rail overlay, not action pane) |
| AC-3  | ✅     | `exchange-joker-button` absent from action pane                                                   |
| AC-4  | ✅     | [ActionBarUndoControls.tsx] deleted; `undo-notice` and `UndoVotePanel` removed from overlays      |
| AC-5  | ✅     | All branches use `data-testid="proceed-button"` via shared `renderProceedButton()` helper         |
| AC-6  | ✅     | `declare-mahjong-button` present in all sub-stages; disabled state matches the story matrix       |
| AC-7  | ✅     | `GameplayStatusBar` renders with `fixed top-0 left-0 right-0 z-20`                                |
| AC-8  | ✅     | All 6 copy-matrix variants implemented in `getStatusText()` and tested                            |
| AC-9  | ✅     | `playing-status` div removed; tests assert its absence                                            |
| AC-10 | ✅     | `start-over-button` and `handleStartOver` deleted from [GameBoard.tsx]                            |
| AC-11 | ✅     | `sound-settings-placeholder` removed                                                              |
| AC-12 | ✅     | `board-settings-button` removed                                                                   |
| AC-13 | ✅     | [TODO.md] has Auto-sort hand entry                                                                |
| AC-14 | ✅     | `leave-game-button` preserved; [LeaveGame.integration.test.tsx] passes                            |
| AC-15 | ✅     | `pt-16` on `game-board-layout` preserved; validated by [GameBoard.test.tsx]                       |

No issues found. The story can be marked closed.

Read C:\Users\thetr\AppData\Local\Temp\claude\c--Repos-mpmahj\ee93039a-7e7a-48ff-8081-8a0901614522\tasks\bydu436tj.output
All 118 test files, 1387 tests passing. Clean run with no failures.
