# VR-006 — StagingStrip Component

**Phase:** 2 — High Impact, Medium Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §A.1–A.4, §A.7, §D item 6

## Summary

Create a new `StagingStrip` component that is **permanently visible throughout the entire game** —
not only during Charleston. It shows 6 uniform tile slots where the player stages selected tiles.
The ActionBar is rendered as an integrated part of the StagingStrip (immediately below the slots),
always showing PASS, CALL, and DISCARD buttons; each button is enabled or disabled based on the
current phase context. Tile sizes in the staging area match those in the player's rack.

There is no incoming/outgoing slot distinction. The 6 slots are uniform — a tile placed into a slot
is simply "staged" for the next action.

## Acceptance Criteria

- **AC-1**: A new file `apps/client/src/components/game/StagingStrip.tsx` is created.
- **AC-2**: A new file `apps/client/src/components/game/StagingStrip.test.tsx` is created.
- **AC-3**: `StagingStrip` accepts the props interface defined below.
- **AC-4**: 6 slots render by default. Empty slots use a dashed border style
  (`border-2 border-dashed border-white/25 bg-white/[0.04]`). Slot dimensions match the player rack
  tile size (not a hard-coded pixel value). Each slot has `data-testid="staging-slot-{i}"` (0-indexed).
- **AC-5**: Each filled slot shows the `TileInstance`'s tile at the same size as player rack tiles,
  with a gold border (`border-2 border-[#ffd700]`) and glow (`shadow-[0_0_8px_rgba(255,215,0,0.4)]`).
- **AC-6**: When `blindStaging` is true, filled slots show `<Tile faceUp={false} />` instead of the
  tile face, with an amber "BLIND" badge at `text-[10px]` in the slot corner.
- **AC-7**: The `StagingStrip` is rendered and visible regardless of game phase (Charleston, playing,
  setup). Action buttons are enabled/disabled per the `can*` props, not hidden.
- **AC-8**: The integrated action bar renders immediately below the slot row and contains exactly three
  buttons: **PASS**, **CALL**, and **DISCARD** (always present).
- **AC-9**: Each button is disabled when its corresponding `can*` prop is `false` or when
  `isProcessing` is `true`.
- **AC-10**: When `isProcessing` is `true`, the last-activated button shows a `Loader2` spinner
  (lucide-react, consistent with the shadcn/ui pattern used elsewhere). The component tracks which
  button was most recently clicked via internal state; no spinner renders if no button has been
  activated yet in the current processing cycle.
- **AC-11**: The outer container is `flex flex-col items-center gap-2 w-full`.
- **AC-12**: The strip panel uses `bg-black/55 border-b border-white/[0.08] rounded-t-lg px-4 py-3`.
- **AC-13**: `onRemoveTile` is called when a filled slot is clicked.
- **AC-14**: `onPassTiles`, `onCallTile`, and `onDiscardTile` are called when their respective buttons
  are clicked.
- **AC-15**: `data-testid="pass-tiles-button"`, `data-testid="call-tile-button"`, and
  `data-testid="discard-tile-button"` are present on the respective action buttons.

### Props Interface

```typescript
interface StagingStripProps {
  stagedTiles: TileInstance[];
  slotCount?: number;        // default 6
  blindStaging: boolean;
  onRemoveTile: (tileId: string) => void;
  onPassTiles: () => void;
  onCallTile: () => void;
  onDiscardTile: () => void;
  canPass: boolean;
  canCall: boolean;
  canDiscard: boolean;
  isProcessing: boolean;
}
```

## Connection Points

### New File

- `apps/client/src/components/game/StagingStrip.tsx` — create from scratch

### Modified Files

| File | Change |
|------|--------|
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | Import and render `<StagingStrip>` above `<PlayerRack>`. Derive `stagedTiles` as `handTileInstances.filter(t => selectedIds.includes(t.id))`. Wire `onPassTiles` to the existing `PassTiles` command handler. `canPass` when 3 tiles staged, `canCall=false`, `canDiscard=false` during Charleston. |
| `apps/client/src/components/game/phases/PlayingPhase.tsx` | Import and render `<StagingStrip>` above `<PlayerRack>`. Wire `onDiscardTile` and `onCallTile` to existing handlers. `canPass=false` during playing unless courtesy pass is active. |
| `apps/client/src/components/game/ActionBar.tsx` | Remove the `PassTiles` (Charleston) and `DiscardTile` (Playing/Discarding) buttons — these actions are now owned by `StagingStrip`. `ActionBar` continues to render in all phases; all remaining controls (Sort, Leave, Forfeit, Hint, Declare Mahjong, Undo) are unaffected. |

### Tile Component

`StagingStrip` uses `<Tile>` from `apps/client/src/components/game/Tile.tsx`. The tile size must
match the player rack tile size; pass the same size prop used by `PlayerRack`.

### PlayerRack

`apps/client/src/components/game/PlayerRack.tsx` is the rename of `ConcealedHand.tsx` (see
Dependencies). Tiles selected via `selectedTileIds` are reflected in `StagingStrip`'s `stagedTiles`
via the parent phase component. No direct changes to `PlayerRack` in this story.

## Test Requirements

### Unit Tests

**File:** `apps/client/src/components/game/StagingStrip.test.tsx` (new)

- **T-1**: Render with 0 tiles staged. Assert 6 empty slots (by `data-testid="staging-slot-{i}"`)
  each have `border-dashed`.
- **T-2**: Render with 2 `stagedTiles`. Assert 2 slots render `Tile` components face-up, 4 slots
  remain empty.
- **T-3**: Render with `blindStaging=true` and 3 tiles. Assert tiles render `faceUp={false}` and
  "BLIND" badge is visible.
- **T-4**: Render with `canPass=true`. Assert `getByTestId('pass-tiles-button')` is not disabled.
- **T-5**: Render with `canPass=false`. Assert pass button is disabled.
- **T-6**: Click a filled slot. Assert `onRemoveTile` called with the tile's id.
- **T-7**: Click pass button. Assert `onPassTiles` called.
- **T-8**: Click call button. Assert `onCallTile` called.
- **T-9**: Click discard button. Assert `onDiscardTile` called.
- **T-10**: Click the pass button, then re-render with `isProcessing=true`. Assert the pass button
  contains a `Loader2` spinner (detectable via `animate-spin` class) and all three buttons are
  disabled.
- **T-11**: Assert all three action buttons (`pass-tiles-button`, `call-tile-button`,
  `discard-tile-button`) are always rendered regardless of which `can*` values are set.

### Integration Tests

**File:** `apps/client/src/features/game/CharlestonFirstRight.integration.test.tsx` (existing)

- **T-12**: After selecting 3 tiles, assert `data-testid="pass-tiles-button"` is present and enabled.
- **T-13**: After clicking the pass button, assert it is disabled and contains a `Loader2` spinner
  (detectable via `animate-spin` class) while the command is in flight.

## Out of Scope

- Blind slot entry animation (VR-011).
- Ghost placeholder in rack (VR-016).
- Playing-phase drawn tile zone (VR-012).
- Direction label display (removed — no incoming/outgoing designation).

## Dependencies

Depends on VR-003 and VR-005 being in place (the strip visually attaches above the wooden rack).
Logically independent of them.

Requires `ConcealedHand.tsx` to be renamed to `PlayerRack.tsx` before or as part of this story.
If the rename has not yet landed, update all `PlayerRack` references in this spec to `ConcealedHand`
until it does.
