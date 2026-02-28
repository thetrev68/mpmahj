# VR-014 — ActionBar Migration to PlayerZone Right Column

**Phase:** 4 — Lower Priority, Medium Effort
**Status:** Implemented (Sonnet)
**Source:** Visual-Redesign-20220222.md §C.1, §D item 14

## Summary

Finalize the `ActionBar` integration into `PlayerZone`.

This story is dependency-gated by VR-008 and VR-006:

- After VR-008, `ActionBar` root positioning is `relative` in the right column (not independently fixed).
- After VR-006, Charleston pass commit control is owned by `StagingStrip`.

VR-014 then finalizes `ActionBar` internal layout for the right-column context (width, spacing, bottom controls, overflow resilience).

> Note: If VR-008/VR-006 are not yet merged when this story starts, treat those outcomes as prerequisites and sequence work accordingly.

## Acceptance Criteria

- **AC-1**: `ActionBar` renders correctly in `PlayerZone`'s right column at its natural height.
- **AC-2**: All buttons fill the available width of the right column (`w-full` on each `<Button>` — already the case).
- **AC-3**: The `min-w-[180px]` constraint on the outer div is preserved so the right column has a consistent minimum.
- **AC-4**: The Leave/Forfeit controls remain bottom-anchored within the action bar (for example, a bottom control group pushed with `mt-auto`, or equivalent deterministic layout).
- **AC-5**: In Charleston phase, pass commit is rendered by `StagingStrip`; `ActionBar` does not render a separate `pass-tiles-button`.
- **AC-6**: Undo controls still render and are accessible.
- **AC-7**: `data-testid="action-bar"` is unchanged.
- **AC-8**: All button `data-testid` values are unchanged.
- **AC-9**: No layout overflow or clipping occurs on typical 1080p/1440p screens.
- **AC-10**: The `bg-black/85 rounded-lg shadow-lg px-4 py-3` visual treatment on the outer div is preserved.

## Connection Points

| File                                             | Location          | Change                                                                             |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------- |
| `apps/client/src/components/game/ActionBar.tsx`  | Outer `<div>`     | Confirm post-VR-008 `relative` placement in zone context; keep `min-w-[180px]`     |
| `apps/client/src/components/game/ActionBar.tsx`  | Inner flex column | Ensure bottom controls are deterministically anchored (see AC-4)                   |
| `apps/client/src/components/game/PlayerZone.tsx` | Right column      | Post-VR-008 column layout (`flex flex-col justify-start` with `py-2 pr-2` padding) |

### Layout change detail (if needed)

The ActionBar inner `<div className="flex flex-col gap-2.5">` may need to become `flex flex-col gap-2.5 h-full`/`flex-1`, with a dedicated bottom control group using `mt-auto` (or equivalent), if items must be distributed vertically. Only change if layout issues are observed.

## Test Requirements

**File:** `apps/client/src/components/game/ActionBar.test.tsx` (existing — add/verify)

- **T-1**: Render `ActionBar` with `phase={{ Playing: { Discarding: { player: 'South' } } }}` and `mySeat="South"`. Assert `data-testid="discard-button"` is present.
- **T-2**: Assert `data-testid="leave-game-button"` is present.
- **T-3**: Assert `data-testid="forfeit-game-button"` is present.
- **T-4**: Assert `data-testid="action-bar"` is present.
- **T-5**: Render ActionBar in Charleston phase (`{ Charleston: 'FirstRight' }`). Assert no `pass-tiles-button` is rendered inside ActionBar itself (migration from VR-006 complete).

### Integration Tests

- `apps/client/src/features/game/turn-discard.integration.test.tsx` — pass after migration.
- `apps/client/src/features/game/CharlestonFirstRight.integration.test.tsx` and `apps/client/src/features/game/CharlestonSecondCharleston.integration.test.tsx` — pass after migration.

## Out of Scope

- ActionBar content/button additions or removals.
- Leave/forfeit dialog changes.

## Dependencies

- **VR-008** (PlayerZone wrapper) must be completed first — ActionBar positioning change happens there.
- **VR-006** (StagingStrip) must be completed first — Charleston pass button migration happens there.
