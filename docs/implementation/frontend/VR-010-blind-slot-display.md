# VR-010 — Blind Slot Face-Down Display in StagingStrip

**Phase:** 3 — Medium Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §A.3 (Blind state), §D item 10

## Summary

When the current Charleston stage uses a blind pass (FirstLeft, SecondRight), outgoing slots in `StagingStrip` show tiles face-down with an amber "BLIND" badge. This is a pure extension of the `blindOutgoing` prop already designed into `StagingStrip`.

> Note: `StagingStrip` was designed in VR-006 to accept `blindOutgoing: boolean`. This story covers the implementation of that visual state in detail and adds test coverage.

## Acceptance Criteria

- **AC-1**: When `blindOutgoing=true`, filled outgoing slots render `<Tile faceUp={false} size="medium" />` instead of the tile face.
- **AC-2**: Each blind-filled slot shows an amber badge with text `"BLIND"` at `text-[10px]` positioned at the top-right corner of the slot.
- **AC-3**: The badge has class or style consistent with `text-amber-400 bg-black/60 rounded px-0.5` positioned `absolute top-0.5 right-0.5`.
- **AC-4**: When `blindOutgoing=false`, tiles always render face-up regardless of stage.
- **AC-5**: Empty outgoing slots are unaffected by `blindOutgoing` (they stay as dashed placeholders).
- **AC-6**: The `data-testid="pass-tiles-button"` remains functional regardless of blind state.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/StagingStrip.tsx` | Outgoing slot rendering | Apply `faceUp={false}` and badge when `blindOutgoing=true` |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | `<StagingStrip>` usage | Pass `blindOutgoing={getStageInfo(stage).blindPass}` (the `blindPass` field is already computed in `CharlestonTracker`'s `getStageInfo`) |

### Stage-to-blindPass mapping (from CharlestonTracker.tsx)

```tsx
// Already defined in CharlestonTracker.tsx lines 37–54
// SecondRight → blindPass: true
// FirstLeft → blindPass: true
// All others → blindPass: false
```

`CharlestonPhase.tsx` already imports the stage and knows its direction via the same data. Either re-use `getStageInfo` (exported from `CharlestonTracker.tsx`) or inline the two-case check.

## Test Requirements

**File:** `apps/client/src/components/game/StagingStrip.test.tsx` (created in VR-006 — add cases)

- **T-1**: Render with `blindOutgoing=true` and 2 `outgoingTiles`. Assert tile components have `data-face-up="false"` or `faceUp={false}` (depends on how `Tile` exposes this — check `Tile.tsx` for existing testid/attribute patterns).
- **T-2**: Render with `blindOutgoing=true` and 1 tile. Assert a "BLIND" badge text is visible in the slot.
- **T-3**: Render with `blindOutgoing=false` and 2 tiles. Assert no "BLIND" badge is present.
- **T-4**: Render with `blindOutgoing=true` and 0 tiles. Assert no badge is visible (empty slots unchanged).

### Integration Tests

**File:** `apps/client/src/features/game/Charleston.integration.test.tsx`

- **T-5**: Navigate to a `SecondRight` or `FirstLeft` stage. Assert that when tiles are selected, staging slots show face-down tiles.

## Out of Scope

- Incoming slot blind display — incoming tiles are always revealed (they are new tiles you receive).
- CharlestonTracker blind display (already implemented).

## Dependencies

Requires VR-006 (StagingStrip) to be implemented first.
