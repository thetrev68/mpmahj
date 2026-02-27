# VR-002 - Remove Walls and Unify Tile Ivory/Bone Palette

**Phase:** 1 - High Impact, Low Effort
**Status:** Implemented (Codex) Validated (Copilot)
**Source:** Visual-Redesign-20220222.md (updated direction)

## Summary

Remove all four wall visuals from gameplay UI, including the wall break animation. Re-theme remaining
tiles to a shared ivory/bone palette so the tile face surface (face-up background) and tile back
surface (face-down background) use the same base color family.

`WallCounter` (the remaining-tile count badge) is intentionally retained — it is the functional
replacement for the tile-count information that was previously co-located with the wall visuals.
Removing the wall visuals is safe precisely because `WallCounter` already surfaces this information
independently.

This story is a simplification story, not a replacement-wall story.

## Acceptance Criteria

- **AC-1**: No wall segment is rendered for north/east/south/west in active game views.
- **AC-2**: `Wall` and its internal `WallStack` sub-component are removed from the `GameBoard` render
  path. `Wall.tsx` and `Wall.test.tsx` are deleted. `WallCounter` is explicitly retained.
- **AC-3**: The `transition-transform` animation on the wall break split is removed along with the
  wall markup that contained it. No wall animation triggers during phase changes, passes, draws, or
  turn updates.
- **AC-4**: `GameBoard` no longer mounts the four absolute-positioned wall containers. Layout does not
  reserve space for wall positions at any viewport size.
- **AC-5**: Face-up tile surface background uses the new ivory/bone base palette.
- **AC-6**: Face-down tile back uses the same ivory/bone base palette as face-up tiles.
- **AC-7**: Tile legibility remains intact (pip/character contrast still readable on ivory face-up tiles).
- **AC-8**: Existing tile `data-testid` attributes remain unchanged.
- **AC-9**: Existing board interaction behavior (selection, draw highlight, discard/call affordances) remains
  functionally unchanged aside from wall removal and color updates.

## Palette Specification

Use one shared ivory/bone base for tile surfaces:

- **Base gradient:** `linear-gradient(135deg, #f5f0e8 0%, #ece2d4 55%, #dfd1bf 100%)`
- **Tile border:** `#9a8b7a`
- **Subtle surface shadow:** `inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,0.25)`

Notes:

- Face-up and face-down surfaces must use the same base palette.
- Face-up tile content (glyphs, symbols, markings) should keep current semantics and contrast; only the
  underlying surface palette is being unified.

## Connection Points

| File                                              | Location                                            | Change                                                                       |
| ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/client/src/components/game/GameBoard.tsx`   | `Wall` import and four `<Wall ... />` mount points  | Remove `Wall` import and all four `<Wall />` instances; retain `WallCounter` |
| `apps/client/src/components/game/Wall.tsx`        | Entire file                                         | Delete                                                                       |
| `apps/client/src/components/game/Wall.test.tsx`   | Entire file                                         | Delete alongside `Wall.tsx`                                                  |
| `apps/client/src/components/game/WallCounter.tsx` | Entire file                                         | No change — retain as-is                                                     |
| `apps/client/src/components/game/Tile.css`        | `.tile` base rule and `.tile-face-down` rule        | Apply shared ivory/bone gradient, border, and shadow to both rules           |
| `apps/client/src/components/game/Tile.tsx`        | Any inline `faceUp`/`faceUp={false}` surface styles | Verify no inline background overrides conflict with updated `Tile.css`       |

## Notes for Implementers

- **Palette changes live in `Tile.css`**, not `Tile.tsx`. The current face-up background
  (`linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)`) and face-down background
  (`linear-gradient(135deg, #d0d0d0 0%, #b8b8b8 100%)`) are both in `Tile.css`. Update both
  rules to the new palette.
- **`WallStack` is file-internal** to `Wall.tsx` (a private FC). Deleting `Wall.tsx` removes it
  automatically; no separate search is needed.
- **JSDOM does not evaluate `.css` files** in Vitest. Tests T-3/T-4/T-5 must assert that the
  expected CSS class name is present on the element, not that a computed gradient value matches.
  Visual palette correctness is verified by manual inspection.
- **`WallCounter` stays** — do not remove it. It is the reason the wall visuals can safely go.

## Test Requirements

### Unit / Component Tests

**Files to delete:**

- `apps/client/src/components/game/Wall.test.tsx` — delete alongside `Wall.tsx`

**New assertions for `GameBoard` or integration tests:**

- **T-1**: Assert no wall containers (`data-testid="wall-north"`, `"wall-south"`, `"wall-east"`,
  `"wall-west"`) are rendered in active board views.
- **T-2**: Assert `WallCounter` (`data-testid="wall-counter"`) is still rendered after wall removal.

**File:** `apps/client/src/components/game/Tile.test.tsx` (existing — add/update assertions)

- **T-3**: Render a face-up tile and assert the base `tile` CSS class is present on the element.
- **T-4**: Render `<Tile faceUp={false} />` and assert the `tile-face-down` CSS class is present.
- **T-5**: Assert no `wall-stack` or wall-position class names appear anywhere in the rendered output.

### Regression / Behavior Checks

- **T-6**: Selection, newly-drawn highlighting, discard flow, and call-related interactions continue
  working without wall components mounted.
- **T-7**: No runtime warnings/errors from removed wall markup or animation code.

### Visual Verification (manual)

- Board shows no four-wall enclosure at desktop or mobile breakpoints.
- `WallCounter` remains visible and functional.
- Face-up and face-down tiles read as the same material family (ivory/bone), with clear symbol readability.

## Out of Scope

- Introducing a new wall replacement object or alternate perimeter decoration.
- Removing or modifying `WallCounter` (tile count display is explicitly retained).
- Reworking gameplay rules/state for wall draw logic on the backend.
- Changing tile dimensions, rack behavior, or interaction model beyond this visual simplification.

## Dependencies

None. Can be implemented independently, but touches multiple game presentation files.
