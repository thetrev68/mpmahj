# US-072: Tile Selection Keyboard Accessibility

## Status

- State: Complete
- Priority: High
- Batch: H
- Implementation Ready: Yes

## Problem

`PlayerRack.tsx` renders tiles as `<div>` wrappers around a `<Tile>` component. Tile selection
is wired exclusively through `onClick` handlers. There are no `onKeyDown` handlers, no
`role="button"` attributes, no `tabIndex` values, and no focus management. Users who navigate
by keyboard (Tab, Enter, Space) cannot select tiles at all.

This is a WCAG 2.1 Level A violation (Success Criterion 2.1.1 — Keyboard). The game board is
the primary interactive surface and tiles are the primary interactive elements.

`Tile.css` defines `.tile-focus:focus-visible` (line 137) with an outline style, indicating
focus styling was intended but never wired. The `Tile.tsx` component itself has no `tabIndex`
or keyboard handler props.

Other interactive areas (`ActionBar` buttons, dialog controls, `ExposedMeldsArea` upgradeable
melds) use Shadcn/ui `Button` components which include keyboard support. The gap is specific
to the tile rack.

## Scope

**In scope:**

- Add `tabIndex={0}` and `role="button"` to interactive tiles in `PlayerRack`.
- Add `onKeyDown` handler that triggers tile selection on Enter or Space.
- Ensure `.tile-focus:focus-visible` outline style activates when tiles receive keyboard focus.
- Add `aria-pressed` or `aria-selected` to reflect selection state.
- Add `aria-label` to each tile describing its value (e.g., "3 Bam", "Red Dragon").
- Add keyboard tests to `PlayerRack.test.tsx`.
- Ensure disabled/view-only tiles are not focusable (`tabIndex={-1}` or omit).

**Out of scope:**

- Arrow key navigation within the rack (left/right to move between tiles). Tab-based
  navigation is sufficient for this story.
- Screen reader announcements for game events (turn changes, tile draws).
- Opponent rack keyboard interaction (opponent tiles are not interactive).
- Keyboard shortcuts for non-tile actions (already handled by ActionBar buttons).

## Acceptance Criteria

- AC-1: Each interactive tile in `PlayerRack` has `tabIndex={0}` and `role="button"`.
- AC-2: Pressing Enter or Space on a focused tile triggers the same selection behavior as
  clicking it.
- AC-3: A `focus-visible` outline is visible when a tile receives keyboard focus.
- AC-4: Selected tiles have `aria-pressed="true"` (or `aria-selected="true"`); unselected
  tiles have `aria-pressed="false"`.
- AC-5: Disabled tiles and tiles in `view-only` mode have `tabIndex={-1}` and
  `aria-disabled="true"`.
- AC-6: Each tile has an `aria-label` that describes its face value (e.g., "5 Dots",
  "West Wind", "Joker").
- AC-7: `PlayerRack.test.tsx` includes a test: focus a tile via Tab, press Enter → tile
  becomes selected.
- AC-8: `PlayerRack.test.tsx` includes a test: focus a disabled tile → tile is not focusable
  (tabIndex -1).

## Edge Cases

- EC-1: During Charleston blind pass, hidden (face-down) tiles in the staging area should not
  receive keyboard focus or selection unless the user has already committed their hand tiles.
- EC-2: When max selection is reached, pressing Enter on an unselected tile should have no
  effect (same as click behavior) — no error thrown.
- EC-3: Tile sort (`onSort` callback) should not break focus management — the previously
  focused tile should remain focusable after re-sort.

## Primary Files (Expected)

- `apps/client/src/components/game/Tile.tsx` — add `tabIndex`, `role`, `onKeyDown`,
  `aria-pressed`, `aria-label` props
- `apps/client/src/components/game/PlayerRack.tsx` — pass keyboard props to `Tile`
- `apps/client/src/components/game/PlayerRack.test.tsx` — add keyboard interaction tests
- `apps/client/src/lib/utils/tileUtils.ts` — may need a `tileLabel(tile: Tile): string`
  helper for aria-labels

## Notes for Implementer

### Tile component changes

Add optional props to `Tile.tsx`:

```tsx
interface TileProps {
  // existing...
  tabIndex?: number;
  role?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  ariaPressed?: boolean;
  ariaLabel?: string;
  ariaDisabled?: boolean;
}
```

Apply to the root element of the tile.

### Keyboard handler in PlayerRack

```tsx
const handleTileKeyDown = (tileId: string) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleTileClick(tileId);
  }
};
```

### Tile label helper

Use the existing tile index mapping (Bams 0-8, Cracks 9-17, Dots 18-26, Winds 27-30,
Dragons 31-33, Flowers 34-41, Joker 42, Blank 43) to generate human-readable labels:

```ts
export function tileLabel(tile: Tile): string {
  if (tile <= 8) return `${tile + 1} Bam`;
  if (tile <= 17) return `${tile - 8} Crack`;
  if (tile <= 26) return `${tile - 17} Dot`;
  // ... winds, dragons, flowers, joker, blank
}
```

## Test Plan

- `PlayerRack.test.tsx`:
  - Tab to first tile → focus-visible outline appears.
  - Enter on focused tile → `onTileSelect` called with tile id.
  - Space on focused tile → same result.
  - Disabled tile has tabIndex -1.
  - Selected tile has aria-pressed true.
- `Tile.test.tsx` (if separate):
  - Renders with tabIndex, role, aria-label when provided.
  - onKeyDown fires when key pressed.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/PlayerRack.test.tsx
npx vitest run apps/client/src/components/game/Tile.test.tsx
npx tsc --noEmit
```

## Implementation Summary

- **State**: Complete
- **Date**: 2026-03-20

### Finding: Already Implemented

All keyboard accessibility features described in this story were already present in the codebase
prior to this story being filed:

| AC  | Feature                                    | Location                             |
| --- | ------------------------------------------ | ------------------------------------ |
| 1   | `tabIndex={0}`, `role="button"`            | `Tile.tsx:210-214`                   |
| 2   | Enter/Space `onKeyDown` handler            | `Tile.tsx:98-109`                    |
| 3   | `focus-visible` outline                    | `Tile.css:137-140`                   |
| 4   | `aria-pressed` on selection                | `Tile.tsx:212`                       |
| 5   | Disabled: `tabIndex={-1}`, `aria-disabled` | `Tile.tsx:213-214`                   |
| 6   | `aria-label` via `getTileName()`           | `Tile.tsx:211`, `tileUtils.ts:44-83` |

`Tile.test.tsx` already contained comprehensive keyboard tests (Enter, Space, focus ring, tabIndex,
disabled non-focusable, other-key rejection).

### What Was Added

The missing piece was **PlayerRack-level keyboard integration tests** (AC-7, AC-8) to verify that
the Tile keyboard behavior works correctly when tiles are rendered inside the rack with real
selection handlers:

- **AC-7**: Tab to first tile → press Enter → `onTileSelect` called (+ Space variant)
- **AC-8**: Joker in charleston mode has `tabIndex={-1}` and `aria-disabled="true"`
- **AC-8**: Explicitly disabled tile has `tabIndex={-1}` and `aria-disabled="true"`
- **AC-4**: Selected tile `aria-pressed="true"`, unselected `aria-pressed="false"`
- **AC-6**: Interactive tiles have descriptive `aria-label` ("1 Bam", "East Wind", "Joker")

### Files Modified

- `apps/client/src/components/game/PlayerRack.test.tsx` — added 6 keyboard/ARIA tests

### Test Summary

- `PlayerRack.test.tsx`: 47 tests (6 new), all passing
- `Tile.test.tsx`: 60 tests, all passing
- `tsc --noEmit`: clean
