# VR-002 - Remove Walls and Unify Tile Ivory/Bone Palette

**Phase:** 1 - High Impact, Low Effort  
**Source:** Visual-Redesign-20220222.md (updated direction)

## Summary

Remove all four wall visuals from gameplay UI, including wall-specific animation behavior and responsive
wall breakpoint logic. Re-theme remaining tiles to a shared ivory/bone palette so the tile face surface
(face-up background) and tile back surface (face-down background) use the same base color family.

This story is a simplification story, not a replacement-wall story.

## Acceptance Criteria

- **AC-1**: No wall segment is rendered for north/east/south/west in active game views.
- **AC-2**: `Wall`, `WallStack`, and wall-only decorative markup are removed from render paths used by gameplay.
- **AC-3**: Wall-related animation classes/state/transitions are removed (or dead code eliminated) so no
  wall animation triggers during phase changes, passes, draws, or turn updates.
- **AC-4**: Wall-related responsive breakpoint logic is removed. Layout no longer reserves space for walls
  at any viewport size.
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

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/Wall.tsx` | Entire file/component usage | Remove from gameplay render flow (and delete if no longer referenced) |
| `apps/client/src/components/game/phases/**` | Any wall mount points | Remove wall rendering and wall layout spacing |
| `apps/client/src/components/game/Tile.tsx` | `faceUp` and `faceUp={false}` surface styles | Apply shared ivory/bone background, border, and shadow |
| `apps/client/src/components/game/**` | Wall animation/breakpoint helpers | Remove wall-only animation and responsive logic |

## Test Requirements

### Unit / Component Tests

**Files:** game phase/presentation tests that previously asserted wall presence

- **T-1**: Assert no wall containers/stacks are rendered in active board views.
- **T-2**: Assert layouts do not include wall placeholder spacing classes/containers after removal.

**File:** `apps/client/src/components/game/Tile.test.tsx` (existing - add/update assertions)

- **T-3**: Render a face-up tile and assert ivory/bone surface background is applied.
- **T-4**: Render `<Tile faceUp={false} />` and assert the same ivory/bone base surface is applied.
- **T-5**: Assert tile border color and surface shadow match the shared palette spec.

### Regression / Behavior Checks

- **T-6**: Selection, newly-drawn highlighting, discard flow, and call-related interactions continue working
  without wall components mounted.
- **T-7**: No runtime warnings/errors from removed wall animation or breakpoint code paths.

### Visual Verification (manual)

- Board shows no four-wall enclosure at desktop or mobile breakpoints.
- Face-up and face-down tiles read as the same material family (ivory/bone), with clear symbol readability.

## Out of Scope

- Introducing a new wall replacement object or alternate perimeter decoration.
- Reworking gameplay rules/state for wall draw logic on the backend.
- Changing tile dimensions, rack behavior, or interaction model beyond this visual simplification.

## Dependencies

None. Can be implemented independently, but touches multiple game presentation files.
