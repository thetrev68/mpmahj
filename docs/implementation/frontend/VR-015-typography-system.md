# VR-015 — Typography HUD/Status/Action System

**Phase:** 4 — Lower Priority, Medium Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §C.4, §D item 15

## Summary

Standardize text styles across game UI components into three roles: **HUD label** (persistent info) and **status message** (transient, aria-live). Action label (buttons) is listed for reference only — no change required. This is a purely additive style regularization touching ~5 files.

## Text Role Definitions

| Role           | Tailwind classes                                               | Usage                                                             |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| HUD label      | `text-xs font-semibold tracking-wide text-slate-200 uppercase` | Opponent seat names, compass letters                              |
| Status message | `text-sm text-emerald-200 italic`                              | CharlestonTracker status, draw-error alerts, turn-change messages |
| Action label   | (existing shadcn Button classes — reference only)              | No change                                                         |

## Acceptance Criteria

### OpponentRack

- **AC-1**: The wrapper `<div>` at the identity label (currently `flex items-center gap-1 text-xs text-slate-300 font-medium`) retains layout classes; the `displayName` `<span>` gains its own explicit className: `text-xs font-semibold tracking-wide text-slate-200 uppercase`. The tile-count `<span>` inside the same wrapper already has its own explicit classes and must not be changed.
- **AC-2**: The tile-count badge text is already restyled in VR-005 — no additional change.

### WindCompass

- **AC-3**: Each seat letter (`E`, `S`, `W`, `N`) already uses `text-xs font-bold`. Add `tracking-wide` to the seat node `<span>` className.

### CharlestonTracker

- **AC-4**: `charleston-direction` span (currently `text-sm font-medium`) gains `tracking-wide`.
- **AC-5**: `statusMessage` div (currently `text-sm text-emerald-200`) gains `italic` to match the status message role: `text-sm text-emerald-200 italic`.
- **AC-6**: `waitingMessage` div (currently `text-sm text-gray-400 italic`) changes to the status message role: `text-sm text-emerald-200 italic`.

### WallCounter

- **AC-7**: No change. The count label uses a dynamic semantic color (`text-red-500` / `text-orange-500` / `text-green-500`) that communicates wall-low state. Overriding it with `text-slate-200` would destroy that signal. WallCounter is out of scope for HUD label regularization.

### ActionBar

- **AC-8**: All three `<div data-testid="playing-status">` elements (Drawing not-my-turn, Discarding my-turn, Discarding not-my-turn — all currently `text-gray-300 text-sm`) change to `text-sm text-emerald-200 italic`. Note: the "Your turn — Select a tile to discard" prompt uses the same testid; applying `italic` there is intentional for visual consistency with the role.

### No testid changes

- **AC-9**: Zero `data-testid` changes across all touched files.

## Connection Points

| File                                                    | Lines to touch                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/client/src/components/game/OpponentRack.tsx`      | Add className to displayName `<span>` (line 58); leave wrapper div intact     |
| `apps/client/src/components/game/WindCompass.tsx`       | Seat node `<span>` className — add `tracking-wide`                            |
| `apps/client/src/components/game/CharlestonTracker.tsx` | `charleston-direction` span; `statusMessage` div; `waitingMessage` div        |
| `apps/client/src/components/game/ActionBar.tsx`         | All three `<div data-testid="playing-status">` elements (lines 371, 386, 463) |

## Test Requirements

Since this is purely a style change, tests verify class presence rather than behavior.

**File:** Various existing test files — add targeted class assertions

- **T-1** (`OpponentRack.test.tsx`): Assert opponent name span (testid `opponent-seat-*`) has class `uppercase`.
- **T-2** (`CharlestonTracker.test.tsx`): Assert `charleston-status-message` has class `italic`.
- **T-3** (`ActionBar.test.tsx`): Assert `playing-status` element has class `italic` or `text-emerald-200`.
- **T-4** (`CharlestonTracker.test.tsx`): Assert the `waitingMessage` container has class `text-emerald-200` (covers AC-6 color change from gray to emerald).

> Implementation note: Keep the test assertions minimal. If exact class checking is fragile (Tailwind purge), test for the rendered text being present and correctly aria-labelled instead.

## Out of Scope

- Font family or weight changes beyond the three defined roles.
- Button text changes.
- New text strings or copy changes.
- WallCounter count label (dynamic semantic color must be preserved — see AC-7).

## Dependencies

VR-005 (opponent label bar) should be done first. Otherwise independent.
