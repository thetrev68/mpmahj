# US-054: Discard Pile — Repositioning and Full Visibility

## Status

- State: Proposed
- Priority: High
- Batch: E

## Problem

### G-8 — Discard Pile: Move Higher + Widen + No Scroll for 99 Tiles

The discard pile zone is currently centered on the board square (`absolute top-1/2 left-1/2
-translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%]`). At late-game tile counts this position
causes visual conflict with the staging strip at the bottom of the board. The zone is also too
narrow and relies on `overflow-auto`, meaning late-game tile counts scroll rather than display
in full.

Three concrete failures:

1. **Overlap / interference** — the centered position intersects the staging strip and action
   pane area when the discard count is high, pushing tiles out of sight or creating a scrollable
   subregion inside the board felt.
2. **Insufficient width** — at 40% of the board square (≈ 480px on a 1200px board), the zone
   does not accommodate 99 small tiles without scrolling when arranged via `flex-wrap`.
3. **Arbitrary rotation** — each tile is rotated ±5° by `tileRotation()`. This creates visual
   noise that makes it hard to scan for a specific tile in a large pile.

The fix is to replace the centered flex-wrap layout with a fixed-column CSS grid anchored to
the upper-center of the board square, remove per-tile rotation, and eliminate all scroll
affordance.

## Scope

**In scope:**

- Replace the `flex flex-wrap gap-1.5 content-start overflow-auto` layout inside `DiscardPool`
  with a 20-column CSS grid (`gap-0.5`; see grid contract in Notes for Implementer for the
  exact Tailwind expression).
- Remove the `tileRotation` helper function and all `style={{ transform }}` applications on
  individual discard tiles.
- Remove `overflow-auto` from the pool container; use no overflow constraint (grid grows
  downward as tiles are added; no scroll affordance at any tile count up to 99).
- Reposition the pool from the center of the board square to the upper-center: replace
  `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` with
  `top-1/4 left-1/2 -translate-x-1/2`.
- Use a responsive board-relative width contract:
  `w-full max-w-[678px]` centered within the board square. On desktop widths, the pool may use
  the full 20-column intrinsic width; on tablet widths, it must remain fully visible inside the
  board square without horizontal clipping.
- Remove the explicit `h-[40%]` height constraint; pool height is determined by content.
- Preserve the `bg-black/15 rounded-lg` background and `p-2` padding (reduce from current
  `p-4` to `p-2` to keep the container zone compact).
- Preserve `data-testid="discard-pool"` and `data-testid="discard-pool-tile-{index}"` testids.
- Preserve highlight ring on `mostRecentTile` and `callableTile`
  (`ring-2 ring-yellow-400 rounded-sm`) using the existing value-based highlight behavior in
  `DiscardPool.tsx`.
- Update `DiscardPool.test.tsx` (or create it if absent) for the new layout contract.

**Out of scope:**

- Right-rail layout changes — covered by `US-055`.
- Staging strip width or slot-count changes — covered by `US-050`.
- Tile size variant changes (discard tiles remain `size="small"`).
- Adding click-to-discard or tap interaction to pile tiles.
- Per-tile player attribution labels or icons in the pile.
- Any change to discard-highlight identity semantics beyond the current value-based matching.
  If the pile contains duplicate tile values, all matching tiles may continue to receive the
  same highlight ring in this story.
- A "most recent discard" scroll-into-view animation — deferred.
- Full Playwright / visual-regression baseline for the board layout — may be captured in
  `US-045` follow-up.
- Mobile phone viewport adaptation — out of scope. Phone layouts may remain unsupported.

## Acceptance Criteria

- AC-1: The discard pool is positioned in the upper quarter of the board square; `top-1/2`
  no longer appears in the pool container class list.
- AC-2: At 99 tiles, no scrollbar or scroll affordance appears inside or around the discard
  pool container. All tiles are visible without scrolling.
- AC-3: In desktop board layouts, the pool container may expand up to the 20-column intrinsic
  width (≈ 678px at standard tile sizes), centered within the board square, with no horizontal
  overflow.
- AC-4: Tiles are arranged in a responsive fixed-column grid that fills rows left-to-right,
  top-to-bottom with no rotation. On desktop board widths, the grid uses 20 columns. On tablet
  board widths, the grid may use fewer columns, but all tiles must remain visible within the
  board square with no horizontal clipping or internal scrolling.
- AC-5: No tile in the pool has a `style` attribute containing `rotate` (the `tileRotation`
  function is removed).
- AC-6: The most-recent-discard highlight (`ring-2 ring-yellow-400`) and the callable-tile
  highlight continue to apply correctly regardless of grid position, using the existing
  value-based matching semantics from `DiscardPool`.
- AC-7: At 0 tiles (game start), the pool container is present in the DOM with
  `data-testid="discard-pool"` but renders no child tile elements and has minimal visual
  footprint (background zone visible but nearly empty).
- AC-8: At 20 tiles in desktop board layouts, the pool renders a single row of 20 tiles with no
  empty trailing cells visible.
- AC-9: At 21 tiles in desktop board layouts, the pool renders two rows: a complete row of 20
  and a second row containing 1 tile.
- AC-10: At 99 tiles in desktop board layouts, the pool renders 5 rows (rows 1–4: 20 tiles each;
  row 5: 19 tiles). No placeholder element is rendered for trailing empty grid space. On tablet
  board layouts, row count may increase if the responsive column count is reduced.
- AC-11: In the desktop Playing-phase board layout (`square-board-container` at `lg`), the pool
  container does not visually overlap the staging strip at a board square size of 900px × 900px.
  Verify manually at the maximum board size (1200px) as well.
- AC-12: `data-testid="discard-pool-tile-{index}"` values are sequential from `0` and continue
  to match the index of each entry in the `discards` array.
- AC-13: In tablet board layouts, the discard pool remains fully visible within the board square:
  no horizontal clipping, no internal scrollbar, and no overlap with the staging strip.

## Edge Cases

- EC-1: Empty pile at game start — the pool container renders with the background zone but no
  tile children. The container height is small (padding only) and does not crowd the board.
- EC-2: Single tile — renders at grid position `[0, 0]` (top-left of the grid), no rotation.
- EC-3: Exactly 20 tiles — in desktop board layouts, renders as one complete row; grid height is
  one tile tall (46px). On tablet board layouts, row count may be greater if the responsive
  column count is reduced.
- EC-4: Exactly 99 tiles — in desktop board layouts, renders as 5 rows (4 full + 1 partial).
  No overflow, no scroll. Total grid height ≈ 238px. On tablet board layouts, row count may
  increase, but the pool must remain fully visible and clear of the staging strip.
- EC-5: `mostRecentTile` in a position other than the last grid cell (e.g., if a called tile
  updates which discard is highlighted) — highlight ring still applies to the correct matching
  tile value(s) under the existing value-based highlight behavior.
- EC-6: `callableTile` is set simultaneously with `mostRecentTile` for the same tile — both
  highlight conditions apply to the same tile element without conflict (the ring is already
  applied as a single class on the wrapper div).
- EC-7: Historical / read-only view — the pool renders identically to the live view with the
  same layout contract; no interactivity is added in this story.
- EC-8: Reconnect / remount — the pool re-renders from the current server snapshot with the
  same layout; no flash of the old scroll or rotation behavior.

## Primary Files (Expected)

- `apps/client/src/components/game/DiscardPool.tsx` — primary change: replace layout classes,
  remove `tileRotation` function, remove `style` prop from tile wrapper divs, update container
  positioning and width
- `apps/client/src/components/game/DiscardPool.test.tsx` — create (if absent) or update; see
  Test Plan
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — mount
  site for `DiscardPool` (line ~246); no interface changes expected, but verify the surrounding
  absolute-positioned layout still clears the pool

## Notes for Implementer

### Grid contract (locked)

This section is the component spec for `DiscardPool`. All implementation decisions must match
these values exactly. Do not deviate without updating this story first.

| Property              | Value                                                  |
| --------------------- | ------------------------------------------------------ |
| Layout                | Responsive CSS Grid, desktop target 20 columns of 32px |
| Gap                   | `gap-0.5` (2px)                                        |
| Tile size             | `small` (32px × 46px)                                  |
| Container width       | `w-full max-w-[678px]`                                 |
| Container height      | auto — grows with row count; no fixed height           |
| Max rows for 99 tiles | desktop target: 5 rows; tablet may use more rows       |
| Per-tile rotation     | **None** — `tileRotation` function is removed entirely |
| Overflow              | None — `overflow-auto` is removed; grid grows in-place |
| Background            | `bg-black/15 rounded-lg p-2`                           |

#### Column count rationale

20 columns × 32px tile + 19 × 2px gap = 678px — approximately the same width as the top
opponent rack, which also spans the full center width of the board in small tile increments.
At desktop board sizes, this produces only 5 rows, making the pool approximately 678px wide ×
238px tall. On tablet-sized boards, the pool may use fewer columns and more rows to stay within
the board square without clipping.

#### Responsive grid contract

Desktop target:

```
grid grid-cols-[repeat(20,32px)] gap-0.5
```

Tablet behavior:

- the grid may use fewer fixed 32px columns when the board square is narrower
- column count must be derived from available board width, not viewport width
- the resulting layout must keep all discard tiles visible within the board square with no
  internal scrolling and no horizontal clipping

Implementation options are acceptable as long as they preserve the desktop 20-column target and
the tablet visibility contract. Examples include breakpoint-specific `grid-cols-[repeat(...)]`
classes or a board-width-aware responsive class strategy.

Tailwind's built-in `grid-cols-*` utilities only go up to 12. Use arbitrary value syntax or a
`tailwind.config.ts` extension for any column counts above that.

#### Positioning contract

Replace the current centered positioning:

```
absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%]
```

with:

```
absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[678px]
```

`top-1/4` positions the pool top edge at 25% of the board square height from the top. At a
900px board that is 225px from the top — below the top opponent rack area (~90–100px) and,
even at 99 tiles (238px tall), the pool bottom sits at ≈ 463px from the board top. The staging
strip occupies the bottom ~120px of the board square (≈ 780px+ from the top on a 900px board),
leaving over 300px of clearance. At the maximum 1200px board the clearance is even greater.

On tablet board sizes, the same `top-1/4` anchor may be kept if the responsive column reduction
preserves clearance. If the pool grows too tall and clips into the top rack or staging strip,
adjust the positioning and update this story with the finalized tablet-safe contract.

#### Tile ordering

Tiles are rendered in `discards` array order (index 0 first, index 98 last). Row-major order
in a 20-column grid produces: tile 0 at top-left, tile 19 at top-right, tile 20 at second-row
left, and so on.

#### Highlight behavior (locked for this story)

This story does not change the current `DiscardPool` highlight contract. `mostRecentTile` and
`callableTile` are matched by tile value, not by discard-instance identity. That means:

- if only one discard in the pile matches the highlighted value, only that tile gets the ring
- if multiple discards in the pile share that tile value, all matching tiles may receive the ring

Do not introduce a new discard-instance API in this story. A future story may switch highlights
to index- or turn-based targeting if product requirements demand single-instance precision.

#### Empty grid cells

CSS Grid does not render empty cells when tile count is not a multiple of the active column
count. The trailing partial row is simply shorter. Do not add placeholder `<div>` elements to
fill empty cells.

### Removing `tileRotation`

The `tileRotation` helper at `DiscardPool.tsx:33–36` and all usages at line ~49 and ~57 are
deleted in this story. The `style` prop on the tile wrapper div is also removed. No other
component uses `tileRotation`.

### `overflow-auto` removal

The current container uses `overflow-auto` to scroll excess tiles. After this change there is
no overflow restriction. Because the pool is absolutely positioned and grows downward, and
because 5 rows at 238px fits well within the upper board area, no clipping or scroll affordance
is needed.

### Board layout context

`DiscardPool` is mounted at `PlayingPhasePresentation.tsx` line ~246 inside the board square
container. The container is a relatively-positioned square div. The pool uses `absolute`
positioning relative to that container — no changes to the mount site are expected beyond
verifying visual clearance.

The overlap check in this story is a manual desktop verification, not a unit-test contract.
Use the current `square-board-container` sizing in `GameBoard.tsx` at `lg` breakpoints when
verifying the 900px and 1200px board sizes.

## Test Plan

- `DiscardPool.test.tsx` (create if absent, otherwise update):
  - Assert `discard-pool` is present in the DOM with 0 tiles (empty state, no tile children).
  - Assert 20 tile children at 20 tiles (`discard-pool-tile-0` through `discard-pool-tile-19`).
  - Assert 21 tile children at 21 tiles.
  - Assert 99 tile children at 99 tiles, testids `discard-pool-tile-0` through
    `discard-pool-tile-98` all present.
  - Assert no tile child has a `style` attribute containing `rotate` (rotation removed).
  - Assert the container element does not have `overflow-auto` in its class list.
  - Assert the container uses a responsive width contract (`w-full` plus `max-w-[678px]` or the
    finalized equivalent from implementation).
  - Assert the desktop grid contract uses 20 columns.
  - Assert `ring-2 ring-yellow-400` is applied to the wrapper of each tile matching
    `mostRecentTile` when provided under the current value-based behavior.
  - Assert `ring-2 ring-yellow-400` is applied to the wrapper of each tile matching
    `callableTile` when provided under the current value-based behavior.
  - Assert no highlight ring is applied when neither `mostRecentTile` nor `callableTile`
    matches any discard.
- Manual verification required:
  - At desktop `lg` layout with `square-board-container` sized to 900px: confirm no visual
    overlap between the pool (at 99 tiles) and the staging strip. Note exact positioning class
    used and update the Notes for Implementer if it differs from `top-1/4`.
  - At desktop `lg` layout with `square-board-container` sized to 1200px: confirm the pool
    remains horizontally centered and does not extend beyond the board square edges
    (678px pool width vs. 1200px board — should be fine).
  - At tablet layout: confirm the pool remains fully visible within the board square, uses the
    responsive column reduction as designed, and does not overlap the staging strip.
  - Confirm no scrollbar appears at any tile count from 0–99.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/DiscardPool.test.tsx
npx vitest run apps/client/src/features/game/
npx tsc --noEmit
npx prettier --write \
  apps/client/src/components/game/DiscardPool.tsx \
  apps/client/src/components/game/DiscardPool.test.tsx \
  docs/implementation/frontend/user-stories/US-054-discard-pile-repositioning-and-full-hand-display.md \
  docs/implementation/frontend/user-stories/USER-TESTING-BACKLOG.md
```
