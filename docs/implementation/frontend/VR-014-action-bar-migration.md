# VR-014 — ActionBar Migration to PlayerZone Right Column

**Phase:** 4 — Lower Priority, Medium Effort
**Source:** Visual-Redesign-20220222.md §C.1, §D item 14

## Summary

Finalize the `ActionBar` integration into `PlayerZone`. The `ActionBar` outer div positioning is already changed to `relative` in VR-008. This story restructures `ActionBar`'s internal layout for the right-column context and ensures all buttons adapt to the vertical layout without the `fixed` width constraint.

> Note: VR-008 removes the `fixed` positioning. This story addresses any follow-up layout issues (min-width, button sizing, spacing) that arise from the context change.

## Acceptance Criteria

- **AC-1**: `ActionBar` renders correctly in `PlayerZone`'s right column at its natural height.
- **AC-2**: All buttons fill the available width of the right column (`w-full` on each `<Button>` — already the case).
- **AC-3**: The `min-w-[180px]` constraint on the outer div is preserved so the right column has a consistent minimum.
- **AC-4**: The Leave/Forfeit buttons remain at the bottom of the action bar (flex column with `justify-end` or gap).
- **AC-5**: In Charleston phase: `Pass Tiles` button appears at the top of the action list. The staging strip (`StagingStrip`) has migrated the pass button; `ActionBar` no longer renders a separate pass button in Charleston (this was started in VR-006).
- **AC-6**: Undo controls still render and are accessible.
- **AC-7**: `data-testid="action-bar"` is unchanged.
- **AC-8**: All button `data-testid` values are unchanged.
- **AC-9**: No layout overflow or clipping occurs on typical 1080p/1440p screens.
- **AC-10**: The `bg-black/85 rounded-lg shadow-lg px-4 py-3` visual treatment on the outer div is preserved.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/ActionBar.tsx` | Outer `<div>` | Confirm `relative` (set in VR-008), keep `min-w-[180px]` |
| `apps/client/src/components/game/ActionBar.tsx` | Inner flex column | Ensure `flex flex-col gap-2.5 h-full` so Leave/Forfeit stick to bottom if needed |
| `apps/client/src/components/game/PlayerZone.tsx` | Right column | `flex flex-col justify-start` with `py-2 pr-2` padding |

### Layout change detail (if needed)

The ActionBar inner `<div className="flex flex-col gap-2.5">` may need to become `flex flex-col gap-2.5 flex-1` or similar if items need to be distributed. Only change if layout issues are observed.

## Test Requirements

**File:** `apps/client/src/components/game/ActionBar.test.tsx` (existing — add/verify)

- **T-1**: Render `ActionBar` with `phase={{ Playing: { Discarding: { player: 'South' } } }}` and `mySeat="South"`. Assert `data-testid="discard-button"` is present.
- **T-2**: Assert `data-testid="leave-game-button"` is present.
- **T-3**: Assert `data-testid="forfeit-game-button"` is present.
- **T-4**: Assert `data-testid="action-bar"` is present.
- **T-5**: Snapshot test: render ActionBar in Charleston phase (`{ Charleston: 'FirstRight' }`). Assert no `pass-tiles-button` is rendered inside ActionBar itself (migration from VR-006 complete).

### Integration Tests

- `apps/client/src/features/game/Playing.integration.test.tsx` — pass after migration.
- `apps/client/src/features/game/Charleston.integration.test.tsx` — pass after migration.

## Out of Scope

- ActionBar content/button additions or removals.
- Leave/forfeit dialog changes.

## Dependencies

- **VR-008** (PlayerZone wrapper) must be completed first — ActionBar positioning change happens there.
- **VR-006** (StagingStrip) must be completed first — Charleston pass button migration happens there.
