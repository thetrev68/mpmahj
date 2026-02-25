# VR-005 — Opponent Label Bar Styling

**Phase:** 1 — High Impact, Low Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §B.4, §D item 5

## Summary

Restyle the `OpponentRack` identity label bar. The label bar gets a dark bottom strip with the
player's display name, improving readability against the felt background. Tile counts are not
displayed — hand size is always 13 or 14 and provides no useful information.

## Acceptance Criteria

- **AC-1**: The identity label `<div>` gains a styled background bar:
  - Tailwind: `bg-black/60 rounded-b-md px-2 py-1 text-xs text-slate-200 font-medium flex items-center`
  - This replaces the current bare `flex items-center gap-1 text-xs text-slate-300 font-medium`.
- **AC-2**: The tile-count badge (`opponent-tile-count-{seat}`) is **removed** from the label bar. Do
  not add any count display.
- **AC-3**: `data-testid={opponent-seat-{seat}}` remains on the name span.
- **AC-4**: `data-testid={opponent-rack-{seat}}` on the outer wrapper is unchanged.
- **AC-5**: The label bar is placed below the wooden tile enclosure (not above) — i.e., the render
  order is: tile enclosure first, then label bar (nearest the outer edge / away from table center).
  This mirrors the spec's `rotate(180deg)` visual where the label is always on the outer edge.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/OpponentRack.tsx` | Lines 57–66 — identity label `<div>` | Replace className with styled bar classes; remove badge span |
| `apps/client/src/components/game/OpponentRack.tsx` | JSX order | Move identity label `<div>` to after the wooden tile enclosure |
| `apps/client/src/components/game/OpponentRack.tsx` | Module JSDoc (line 7) | Remove `"- Tile count badge"` bullet — badge no longer rendered |

```tsx
// before (lines 57–66) — label rendered first, with badge
<div className="flex items-center gap-1 text-xs text-slate-300 font-medium">
  <span data-testid={`opponent-seat-${player.seat.toLowerCase()}`}>{displayName}</span>
  <span
    className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-400"
    data-testid={`opponent-tile-count-${player.seat.toLowerCase()}`}
    aria-label={`${concealed} tiles`}
  >
    {concealed}
  </span>
</div>

// after — label rendered after tile enclosure (wooden rack first, label bar below); no badge
<div className="bg-black/60 rounded-b-md px-2 py-1 text-xs text-slate-200 font-medium flex items-center">
  <span data-testid={`opponent-seat-${player.seat.toLowerCase()}`}>{displayName}</span>
</div>
```

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/OpponentRack.test.tsx` (existing — remove two tests, add three assertions)

**Delete these existing tests** (both query `opponent-tile-count-*`, which no longer exists after AC-2):

- `shows tile count badge` — directly asserts the removed badge element.
- `deducts exposed meld tiles from concealed count` — also queries `opponent-tile-count-north`; the
  tile-back count assertion in that test is still valid, but the badge query must be removed. Simplest
  fix: delete the `getByTestId('opponent-tile-count-north')` line and keep the `faceDownTiles` check.

**Add these assertions:**

- **T-1**: Render opponent rack. Assert `getByTestId('opponent-seat-east')` text matches player name.
- **T-2**: Assert there is **no** `opponent-tile-count-east` element in the rendered output.

  ```tsx
  expect(screen.queryByTestId('opponent-tile-count-east')).not.toBeInTheDocument();
  ```

- **T-3**: Assert the label bar is the last child of the outer wrapper (i.e., it follows the tile-back
  section in DOM order).

  ```tsx
  const wrapper = screen.getByTestId('opponent-rack-east');
  const lastChild = wrapper.lastElementChild;
  // The tile section carries aria-hidden="true"; the label bar does not.
  expect(lastChild).not.toHaveAttribute('aria-hidden', 'true');
  expect(within(lastChild!).getByTestId('opponent-seat-east')).toBeInTheDocument();
  ```

## Out of Scope

- Label text content changes.
- Rotation angle changes.

## Dependencies

Depends on VR-003 being implemented first (wooden enclosure provides the context for the label bar's
`rounded-b-md` to look correct). Can be implemented in the same PR as VR-003.
