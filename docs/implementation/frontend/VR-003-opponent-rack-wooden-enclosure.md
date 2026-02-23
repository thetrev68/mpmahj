# VR-003 — Rack Layout & Wooden Enclosure

**Phase:** 1 — High Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §B.4, §D item 3

## Summary

Define the shared rack structure used by all players and apply a wooden gradient enclosure to it.
Every rack — player and opponent — has two rows: one for exposed tiles (melds) and one for concealed
tiles. The player rack is the reference size; opponent racks are proportionally smaller and rotated
90° from the player to form a square table arrangement.

### Rack Layout

Each rack has two rows of equal width:

- **Concealed row** — holds up to 19 tiles (the player's full 13 + 1 drawn tile + Charleston buffer).
  This row is always on the outer edge, closest to the player who owns the rack.
- **Exposed row (melds)** — same total width as the concealed row, positioned toward the table center.
  Melds render left-to-right within this row. Empty meld space is not shown (collapsed until needed).

Orientation by seat:

| Seat | Rotation | Concealed row edge | Meld row edge |
|------|----------|--------------------|---------------|
| South (main player) | 0° | bottom | top (toward center) |
| North | 180° | top | bottom (toward center) |
| East | 90° | right | left (toward center) |
| West | −90° | left | right (toward center) |

### Opponent Rack Sizing

Opponent racks use the same two-row structure as the player rack, rendered proportionally smaller
(exact scale factor TBD in implementation; target: opponent tiles are visually subordinate to the
main player's rack).

## Acceptance Criteria

- **AC-1**: The `PlayerRack` component renders two rows: a concealed tile row (bottom) and a meld row
  (top), each spanning the width of 19 tiles at the player tile size.
- **AC-2**: When the meld row is empty (no exposed tiles), it collapses to zero height — it does not
  reserve visible space.
- **AC-3**: Opponent racks render the same two-row structure. The meld row is always on the side
  toward the table center; the concealed tile row is on the outer edge.
- **AC-4**: Opponent tile size is proportionally smaller than the main player tile size (scale applied
  uniformly to both rows of the opponent rack).
- **AC-5**: The concealed tile-backs `<div>` for both `PlayerRack` and `OpponentRack` is wrapped in a
  new parent `<div>` with wooden gradient background and box shadow.
- **AC-6**: The wooden enclosure uses:
  - `background: 'linear-gradient(to bottom, #8B5E3C 0%, #6B4226 55%, #4A2D1A 100%)'`
  - `boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.5)'`
  - Tailwind classes: `rounded-md px-1.5 pt-1 pb-2`
- **AC-7**: A felt-groove accent `<div aria-hidden="true">` is rendered inside the enclosure at the
  bottom, matching `ConcealedHand`'s groove style (`absolute bottom-1.5 left-1.5 right-1.5 h-1
  rounded-sm`, `background: 'rgba(0,0,0,0.35)'`).
- **AC-8**: All existing `data-testid` attributes are preserved on their current elements:
  - `data-testid={opponent-rack-{seat}}` on the outer wrapper of each opponent rack
  - `data-testid={opponent-seat-{seat}}` on the name span
- **AC-9**: The enclosure's outer container position is `relative` to support the absolute groove child.
- **AC-10**: Tile rotation logic (`tileRotation`) for opponent racks is unchanged.
- **AC-11**: No new props are added to `OpponentRackProps` in this story (sizing and orientation are
  handled via CSS transforms / parent layout).

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/PlayerRack.tsx` | Root layout | Add two-row flex column: meld row (top) + concealed row (bottom), each 19-tile-width |
| `apps/client/src/components/game/PlayerRack.tsx` | Concealed tile section | Wrap in wooden enclosure `<div>` with inline style |
| `apps/client/src/components/game/OpponentRack.tsx` | Lines 69–81 — concealed tile-backs `<div>` | Wrap in wooden enclosure `<div>` |
| `apps/client/src/components/game/OpponentRack.tsx` | Lines 57–66 — identity label `<div>` | Style update (see VR-005; this story only adds the enclosure) |

```tsx
// OpponentRack.tsx — concealed section before (lines 68–81)
{/* Concealed tile backs */}
<div className={cn('flex gap-0.5', isVertical ? 'flex-col' : 'flex-row')} aria-hidden="true">
  ...tiles...
</div>

// after — wrap in wooden container
<div
  className="relative rounded-md px-1.5 pt-1 pb-2"
  style={{
    background: 'linear-gradient(to bottom, #8B5E3C 0%, #6B4226 55%, #4A2D1A 100%)',
    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.5)',
  }}
>
  {/* Felt groove */}
  <div
    className="absolute bottom-1.5 left-1.5 right-1.5 h-1 rounded-sm"
    style={{ background: 'rgba(0,0,0,0.35)' }}
    aria-hidden="true"
  />
  <div className={cn('relative flex gap-0.5', isVertical ? 'flex-col' : 'flex-row')} aria-hidden="true">
    {/* existing Tile map */}
  </div>
</div>
```

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — add assertions)

- **T-1**: Render `<OpponentRack player={mockPlayer} yourSeat="South" />`. Assert
  `getByTestId('opponent-rack-east')` is present (regression).
- **T-2**: Assert `getByTestId('opponent-seat-east')` is present (regression).
- **T-3**: Assert there is a descendant element with inline `background` style containing `8B5E3C`
  (wooden enclosure applied).
- **T-4**: For a vertically-oriented opponent (East/West), assert tile backs still render in `flex-col`.
- **T-5**: For a horizontal opponent (North), assert tile backs render in `flex-row`.

**File:** `apps/client/src/components/game/PlayerRack.test.tsx` (existing — add assertions)

- **T-6**: Render `<PlayerRack>` with no melds. Assert the meld row is not rendered (collapsed).
- **T-7**: Render with melds present. Assert both rows are visible.
- **T-8**: Assert the concealed tile section has a descendant with inline `background` containing `8B5E3C`.

## Out of Scope

- Label bar restyling (VR-005).
- Melds integration (VR-009).
- Staging tile backs (VR-007).
- Rotation logic changes beyond layout orientation.

## Dependencies

None. Fully independent (but VR-005 and VR-007 build on this).
