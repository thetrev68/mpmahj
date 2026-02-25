# VR-012 — Single Drawn-Tile Zone (Playing Phase)

**Phase:** 3 — Medium Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §A.6, §D item 12

## Summary

During the playing phase, when a tile is drawn it currently highlights via the `newlyDrawn` prop in `PlayerRack`. This story adds a distinct visual slot to the right of the tile row for the newly-drawn tile, making it spatially separate from the hand.

## Acceptance Criteria

- **AC-1**: When `newlyDrawnTileId` is set, the newly-drawn tile renders in a visually distinct container to the right of the main tile row, inside the wooden rack.
- **AC-2**: The drawn tile slot has a subtle highlighted background: `bg-emerald-900/30 border border-emerald-600/40 rounded-md` (or equivalent inline style).
- **AC-3**: The tile itself still uses the `tile-newly-drawn` CSS class (already defined) for its pulse animation.
- **AC-4**: A small text label above the drawn tile slot reads `"Drawn"` in `text-[10px] text-emerald-300/70 text-center`.
- **AC-5**: When the player discards the drawn tile or any tile, the drawn tile slot disappears (i.e., when `newlyDrawnTileId` is null/undefined).
- **AC-6**: The drawn tile is still selectable and discardable from this zone.
- **AC-7**: `data-testid="player-rack"` is unchanged.
- **AC-8**: A new `data-testid="drawn-tile-slot"` is present on the drawn tile zone when it is showing.
- **AC-9**: The main tile row to the left of the drawn tile slot does not include the drawn tile (it is in the separate slot).
- **AC-10**: If `newlyDrawnTileId` is undefined/null, the drawn tile slot does not render (no placeholder).

### PlayerRack prop

Add `newlyDrawnTileId?: string` to `PlayerRackProps`. The playing phase passes this from `combinedHighlightedIds` or a dedicated `drawnTileId` from `usePlayingPhaseState`.

> Note: The current `highlightedTileIds` in `PlayerRack` already marks the newly-drawn tile for the pulse animation. `newlyDrawnTileId` extracts it to a separate render zone. The tile should be removed from `sortedTiles` and rendered only in the slot.

## Connection Points

| File                                                                                | Location                   | Change                                                                                  |
| ----------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | `PlayerRackProps`          | Add `newlyDrawnTileId?: string`                                                         |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | `sortedTiles` filtering    | Exclude tile with id === `newlyDrawnTileId` from main row                               |
| `apps/client/src/components/game/PlayerRack.tsx`                                    | Inside wooden rack `<div>` | Add drawn tile slot alongside the tile row                                              |
| `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | `<PlayerRack>` call        | Pass `newlyDrawnTileId` (derive from `combinedHighlightedIds[0]` when in discard stage) |

### Tile rendering change in PlayerRack

```tsx
// After filtering
const mainTiles = sortedTiles.filter(t => t.id !== newlyDrawnTileId);
const drawnTileInstance = newlyDrawnTileId
  ? sortedTiles.find(t => t.id === newlyDrawnTileId)
  : null;

// Inside wooden rack div:
<div className="flex gap-0.5 items-end">
  {/* Main tile row */}
  <div className="relative flex gap-0.5">
    {mainTiles.map(...)}
  </div>

  {/* Drawn tile zone */}
  {drawnTileInstance && (
    <div
      className="flex flex-col items-center gap-0.5 ml-1"
      data-testid="drawn-tile-slot"
    >
      <span className="text-[10px] text-emerald-300/70">Drawn</span>
      <div className="bg-emerald-900/30 border border-emerald-600/40 rounded-md p-0.5">
        <Tile tile={drawnTileInstance.tile} ... className="tile-newly-drawn" />
      </div>
    </div>
  )}
</div>
```

## Test Requirements

**File:** `apps/client/src/components/game/PlayerRack.test.tsx` (existing — add cases)

- **T-1**: Render with `newlyDrawnTileId={someTileId}`. Assert `getByTestId('drawn-tile-slot')` is present.
- **T-2**: Assert the drawn tile does not appear in the main tile row (only in the slot).
- **T-3**: Assert the "Drawn" label is visible inside the slot.
- **T-4**: Render without `newlyDrawnTileId`. Assert `queryByTestId('drawn-tile-slot')` is null.
- **T-5**: Click the drawn tile in the slot. Assert `onTileSelect` is called with the tile id (tile is still selectable/discardable).

### Integration Tests

**File:** `apps/client/src/features/game/Playing.integration.test.tsx`

- **T-6**: After a `TileDrawn` event, assert `drawn-tile-slot` appears in the concealed hand.
- **T-7**: After a `TileDiscarded` event, assert `drawn-tile-slot` disappears.

## Out of Scope

- Drag-and-drop tile reordering.
- Ghost placeholder during Charleston (VR-016).

## Dependencies

Independent of other VR stories but benefits from VR-008 (PlayerZone positioning) for layout.
