# VR-007 — Opponent Staging Tile Backs (Charleston)

**Phase:** 2 — High Impact, Low Effort
**Status:** Implemented (Codex) Validated (Sonnet)
**Source:** Visual-Redesign-20220222.md §A.5, §D item 7

## Summary

During Charleston, show face-down tile backs on the board-center-facing side of each opponent's rack
to indicate how many tiles they have committed to pass. 0/3 = nothing shown; 1–3 = that many tile backs.

## Acceptance Criteria

- **AC-1**: A new optional prop `charlestonReadyCount?: number` (0–3) is added to `OpponentRackProps`.
- **AC-2**: When `charlestonReadyCount` is 0 or undefined, no staging tile backs are rendered.
- **AC-3**: When `charlestonReadyCount` is 1–3, that many `<Tile faceUp={false} size="small" />`
  backs render in a tightly-spaced row on the board-center-facing side of the opponent's rack
  (furthest from the opponent's own screen edge, centered along the rack's primary axis):
  - `top` opponent: staging tiles appear **below** the enclosure on screen (between the rack and the
    board center). With `flex-col` layout this means rendering the staging row **after** the enclosure
    in the JSX tree.
  - `left`/`right` opponents: staging tiles appear on the inner edge (toward the board center).
    Arrange in a column (`flex-col`) to match the rack orientation.
    Staging tiles use the same `rotation` prop as the concealed tiles for that position
    (`POSITION_TO_ROTATION[position]`).
- **AC-4**: The staging row has `data-testid="opponent-staging-{seat}"` (e.g. `opponent-staging-west`)
  and `aria-hidden="true"`.
- **AC-5**: The staging tile backs row renders on the board-center-facing side of the wooden tile
  enclosure. For the `top` position this means after the enclosure in the JSX tree; for `left`/`right`
  positions the exact placement follows from the parent layout.
- **AC-6**: All existing `data-testid` attributes are unchanged.
- **AC-7**: The staging tile backs row is `aria-hidden="true"` (decorative — screen reader info comes
  from `CharlestonTracker`).

### Passing `charlestonReadyCount` from parent

`CharlestonPhase.tsx` maintains a per-seat staged count, updated from `PlayerStagedTile` events and
reset when a pass completes.

```tsx
// CharlestonPhase.tsx

// State — tracks tiles staged per seat for the current pass
const [stagedCounts, setStagedCounts] = useState<Partial<Record<Seat, number>>>({});

// In the event bus handler:
if ('PlayerStagedTile' in event) {
  const { player, count } = event.PlayerStagedTile;
  setStagedCounts((prev) => ({ ...prev, [player]: count }));
}
if ('TilesPassing' in event) {
  setStagedCounts({});  // reset when the pass animation begins
}

// When rendering OpponentRack:
<OpponentRack
  ...
  charlestonReadyCount={stagedCounts[player.seat] ?? 0}
/>
```

## Connection Points

| File                                                         | Location               | Change                                                                    |
| ------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------- |
| `apps/client/src/components/game/OpponentRack.tsx`           | `OpponentRackProps`    | Add `charlestonReadyCount?: number`                                       |
| `apps/client/src/components/game/OpponentRack.tsx`           | JSX body               | Conditionally render staging tile backs row                               |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | state                  | Add `stagedCounts: Partial<Record<Seat, number>>` state                   |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | event bus handler      | Handle `PlayerStagedTile` → update `stagedCounts`; `TilesPassing` → reset |
| `apps/client/src/components/game/phases/CharlestonPhase.tsx` | `<OpponentRack>` usage | Pass `charlestonReadyCount={stagedCounts[player.seat] ?? 0}`              |

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — add assertions)

- **T-1**: Render with `charlestonReadyCount={0}`. Assert no staging row is present
  (no element with `data-testid="opponent-staging-{seat}"`).
- **T-2**: Render with `charlestonReadyCount={3}`. Assert the element with
  `data-testid="opponent-staging-{seat}"` contains exactly 3 face-down tile backs.
- **T-3**: Render with `charlestonReadyCount={3}`. Assert the staging row has
  `aria-hidden="true"` and `data-testid="opponent-staging-{seat}"`.
- **T-4**: Render with `charlestonReadyCount={undefined}`. Assert no staging row renders (same as T-1).
- **T-5**: Assert `data-testid="opponent-rack-{seat}"` is still present (regression).

### Integration Tests

**Files:** `apps/client/src/features/game/CharlestonFirstRight.integration.test.tsx`, `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`, `apps/client/src/features/game/CharlestonSecondCharleston.integration.test.tsx` (existing)

- **T-6**: After a `PlayerStagedTile` event for `North` with `count: 3`, assert North's opponent
  rack shows staging tile backs (`data-testid="opponent-staging-north"` is present with 3 children).

## Out of Scope

- Staging tile backs during playing phase.

## Dependencies

Depends on VR-003 (wooden enclosure) being in place so the staging row has correct visual context.
Logically additive on top of VR-003.
