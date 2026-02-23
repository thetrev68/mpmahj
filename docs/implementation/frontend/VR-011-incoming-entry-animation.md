# VR-011 — Incoming Slot Entry Animation in StagingStrip

**Phase:** 3 — Medium Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §A.4, §D item 11

## Summary

When received tiles arrive in the `StagingStrip`'s incoming slots, they animate in using the existing `tile-enter-from-{seat}` CSS animation classes already defined in the codebase. No new animations are needed — this wires up the `incomingFromSeat` prop.

## Acceptance Criteria

- **AC-1**: When `incomingTiles` is populated and `incomingFromSeat` is set, each incoming tile renders with the CSS class `tile-enter-from-{seat}` (lowercased seat name) applied to the tile wrapper.
- **AC-2**: The animation classes follow the same pattern as `PlayerRack.tsx` lines 68–73 (`seatEntryClass` record).
- **AC-3**: The animation only applies on the initial arrival of tiles (i.e., when the slot transitions from empty to filled). Once the tile is stable, no persistent animation class is applied.
- **AC-4**: If `incomingFromSeat` is null/undefined, no animation class is applied to incoming tiles.
- **AC-5**: `incomingSlotCount` correctly shows 3 placeholder slots while `incomingTiles` is empty, then fills slots as tiles arrive.
- **AC-6**: Slot fill order: leftmost slot fills first, then second, then third.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/StagingStrip.tsx` | Incoming tile rendering | Apply `seatEntryClass[incomingFromSeat]` to tile wrapper |
| `apps/client/src/index.css` or `apps/client/src/components/game/PlayerRack.tsx` | CSS class definitions | `tile-enter-from-east/south/west/north` already defined — no change needed |

### Seat entry class pattern (from PlayerRack.tsx lines 68–73)

```tsx
const seatEntryClass: Record<Seat, string> = {
  East: 'tile-enter-from-east',
  South: 'tile-enter-from-south',
  West: 'tile-enter-from-west',
  North: 'tile-enter-from-north',
};
```

Same record can be defined locally in `StagingStrip.tsx` or extracted to a shared utility.

### CharlestonPhase wiring

`CharlestonPhase.tsx` already tracks `incomingFromSeat` state (set on `TilesReceived` event). Pass it through to `StagingStrip`:

```tsx
<StagingStrip
  ...
  incomingFromSeat={incomingFromSeat}   // already in CharlestonPhase state
/>
```

## Test Requirements

**File:** `apps/client/src/components/game/StagingStrip.test.tsx` (existing from VR-006 — add cases)

- **T-1**: Render with `incomingTiles=[mockTile]` and `incomingFromSeat='East'`. Assert the incoming tile wrapper has class `tile-enter-from-east`.
- **T-2**: Render with `incomingTiles=[mockTile]` and `incomingFromSeat=null`. Assert no `tile-enter-from-*` class is present.
- **T-3**: Render with `incomingTiles=[]` and `incomingSlotCount=3`. Assert three placeholder slots with `↓` arrow text are present.

### Integration Tests

**File:** `apps/client/src/features/game/Charleston.integration.test.tsx`

- **T-4**: After a `TilesReceived` WS event, assert incoming tile slots transition from placeholder to filled tiles.

## Out of Scope

- New CSS keyframe animations (existing ones are reused).
- `PassAnimationLayer` changes (VR-013).

## Dependencies

Requires VR-006 (StagingStrip) to be implemented first.
