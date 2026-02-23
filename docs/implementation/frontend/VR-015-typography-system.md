# VR-015 — Typography HUD/Status/Action System

**Phase:** 4 — Lower Priority, Medium Effort
**Source:** Visual-Redesign-20220222.md §C.4, §D item 15

## Summary

Standardize text styles across game UI components into three roles: **HUD label** (persistent info), **status message** (transient, aria-live), and **action label** (buttons — unchanged). This is a purely additive style regularization touching ~10 files.

## Text Role Definitions

| Role | Tailwind classes | Usage |
|------|-----------------|-------|
| HUD label | `text-xs font-semibold tracking-wide text-slate-200 uppercase` | Opponent seat names, tile counts, compass letters, wall labels |
| Status message | `text-sm text-emerald-200 italic` | CharlestonTracker status, draw-error alerts, turn-change messages |
| Action label | (existing shadcn Button classes) | No change |

## Acceptance Criteria

### OpponentRack

- **AC-1**: Opponent `displayName` span changes to HUD label classes: `text-xs font-semibold tracking-wide text-slate-200 uppercase`.
- **AC-2**: The tile-count badge text is already restyled in VR-005 — no additional change.

### WindCompass

- **AC-3**: Each seat letter (`E`, `S`, `W`, `N`) uses `text-xs font-bold` — already present; add `tracking-wide` if not present.

### CharlestonTracker

- **AC-4**: `charleston-direction` span text class adds `tracking-wide`.
- **AC-5**: `statusMessage` div changes from `text-sm text-emerald-200` to `text-sm text-emerald-200 italic` (status message role).
- **AC-6**: `waitingMessage` div changes from `text-sm text-gray-400 italic` to the status message role: `text-sm text-emerald-200 italic`.

### WallCounter (if applicable)

- **AC-7**: Any wall stack count labels use HUD label classes.

### ActionBar

- **AC-8**: Playing status messages (`playing-status` testid, waiting messages) use status message classes: `text-sm text-emerald-200 italic`.

### No testid changes

- **AC-9**: Zero `data-testid` changes across all touched files.

## Connection Points

| File | Lines to touch |
|------|---------------|
| `apps/client/src/components/game/OpponentRack.tsx` | displayName span className |
| `apps/client/src/components/game/CharlestonTracker.tsx` | statusMessage and waitingMessage divs |
| `apps/client/src/components/game/ActionBar.tsx` | Playing status `<div>` (testid `playing-status`) |
| `apps/client/src/components/game/WallCounter.tsx` | Count text if present |

> Note: WindCompass node labels are already `text-xs font-bold`. Only add `tracking-wide` if it improves readability without breaking existing tests.

## Test Requirements

Since this is purely a style change, tests verify class presence rather than behavior.

**File:** Various existing test files — add targeted class assertions

- **T-1** (`OpponentRack.test.tsx`): Assert opponent name span has class `uppercase`.
- **T-2** (`CharlestonTracker.test.tsx`): Assert `charleston-status-message` has class `italic`.
- **T-3** (`ActionBar.test.tsx`): Assert `playing-status` element has class `italic` or `text-emerald-200`.

> Implementation note: Keep the test assertions minimal. If exact class checking is fragile (Tailwind purge), test for the rendered text being present and correctly aria-labelled instead.

## Out of Scope

- Font family or weight changes beyond the three defined roles.
- Button text changes.
- New text strings or copy changes.

## Dependencies

VR-005 (opponent label bar) should be done first. Otherwise independent.
