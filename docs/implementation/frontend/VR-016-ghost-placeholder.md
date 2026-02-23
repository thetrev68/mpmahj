# VR-016 — Ghost Placeholder in Rack for Staged Tiles

**Phase:** 4 — Lower Priority, Medium Effort
**Source:** Visual-Redesign-20220222.md §A.4, §D item 16

## Summary

When a tile is moved to the `StagingStrip` during Charleston, the tile's original position in the rack shows a ghost placeholder (low opacity outline) indicating where it came from. Clicking the ghost returns the tile to the hand.

## Acceptance Criteria

- **AC-1**: In `PlayerRack` during charleston mode, tiles in `selectedTileIds` render as ghost placeholders instead of disappearing from the rack.
- **AC-2**: A ghost placeholder is a `<Tile>` rendered at `opacity-25` with `pointer-events-none` replaced by a click handler that calls `onTileSelect(tile.id)` to deselect.
- **AC-3**: The ghost has `aria-hidden="true"` — it is decorative. The staged tile in `StagingStrip` is the actionable element.
- **AC-4**: Ghost tiles do not have the `selected` state (they use `state="disabled"` or a new `state="ghost"` if added to the Tile component).
- **AC-5**: The ghost preserves the tile's position in the sorted tile order (it does not shift other tiles).
- **AC-6**: Clicking a ghost calls `onTileSelect(tile.id)` which deselects it (removes it from `StagingStrip`) and returns the full tile to the rack.
- **AC-7**: When `mode !== 'charleston'`, ghost behavior does not apply — tiles are rendered normally regardless of `selectedTileIds`.
- **AC-8**: `data-testid="player-rack"` is unchanged.
- **AC-9**: Tiles in `StagingStrip`'s `onRemoveTile` callback also triggers the same deselection, returning the ghost to full tile state (this is the same `onTileSelect` / selection state flow).

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/PlayerRack.tsx` | `getTileState()` function and tile render loop | When `mode === 'charleston'` and tile is selected, render ghost instead of hiding |
| `apps/client/src/components/game/PlayerRack.tsx` | Tile `<Tile>` component call | Add ghost rendering branch for selected tiles in charleston |
| `apps/client/src/components/game/Tile.tsx` | (Optional) | May need `state="ghost"` if `disabled` state is visually insufficient; assess during implementation |

```tsx
// PlayerRack.tsx — ghost rendering inside tile map
const isGhost = mode === 'charleston' && selectedTileIds.includes(tile.id);

if (isGhost) {
  return (
    <div
      key={`${tile.id}-${index}`}
      className="relative opacity-25 cursor-pointer"
      aria-hidden="true"
      onClick={() => handleTileClick(tile.id)}  // deselect = return to rack
    >
      <Tile
        tile={tile.tile}
        state="disabled"
        size="medium"
        ariaLabel="Staged tile placeholder"
      />
    </div>
  );
}
// ...normal render for non-ghost tiles
```

## Test Requirements

**File:** `apps/client/src/components/game/PlayerRack.test.tsx` (existing — add cases)

- **T-1**: Render in `mode="charleston"` with `selectedTileIds={[tile.id]}`. Assert the tile still appears in the DOM (as a ghost, not removed).
- **T-2**: Assert the ghost tile element has `aria-hidden="true"`.
- **T-3**: Click the ghost tile. Assert `onTileSelect` is called with the tile id.
- **T-4**: Render in `mode="discard"` with `selectedTileIds={[tile.id]}`. Assert no ghost rendering — tile renders normally with `selected` state.
- **T-5**: Render in `mode="charleston"` with no selected tiles. Assert no ghost elements.

## Out of Scope

- Drag-and-drop reordering.
- Ghost in playing phase (no staging strip in playing phase).

## Dependencies

- **VR-006** (StagingStrip) must be implemented first — ghost tiles only make sense when staged tiles have a visual destination.
- **VR-008** (PlayerZone) should be done first for correct layout context.
