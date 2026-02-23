# VR-002 — Tile Ivory/Bone Texture (All Tile Backs)

**Phase:** 1 — High Impact, Low Effort
**Source:** Visual-Redesign-20220222.md §C.2, §D item 2

## Summary

Re-skin all tile back surfaces — `WallStack` tiles, face-down tiles in opponent racks, player-held
concealed tiles, and any other `<Tile faceUp={false} />` instance — to an ivory/bone palette that
reads as real mahjong tile backs. Update border color and add a top-edge highlight shadow. All tile
backs must share the same color so the table looks visually consistent.

## Acceptance Criteria

- **AC-1**: `WallStack` background changes from `'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)'`
  to `'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)'`.
- **AC-2**: `WallStack` border color changes from `border-gray-400` to `border-[#9a8b7a]`.
- **AC-3**: A `boxShadow` of `'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)'` is
  applied to `WallStack`.
- **AC-4**: The existing horizontal divider line inside `WallStack` (simulating the two-tile stack) is
  unchanged.
- **AC-5**: `data-testid="wall-stack"` is preserved on the same element.
- **AC-6**: No layout, size, or `Wall` positioning changes in this story.
- **AC-7**: When `<Tile faceUp={false} />` renders, the back face uses the same ivory/bone gradient:
  `'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)'`.
- **AC-8**: The face-down `Tile` border uses `border-[#9a8b7a]`, replacing any prior grey/white border.
- **AC-9**: The face-down `Tile` box shadow matches WallStack:
  `'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)'`.
- **AC-10**: All existing `data-testid` attributes on `Tile` are unchanged.

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/Wall.tsx` | `WallStack` — `className` on root `<div>` | Change `border-gray-400` → `border-[#9a8b7a]` |
| `apps/client/src/components/game/Wall.tsx` | `WallStack` — `style` prop | Replace gradient and add `boxShadow` |
| `apps/client/src/components/game/Tile.tsx` | `faceUp={false}` branch — back face `<div>` | Replace background, border color, and box shadow with ivory/bone values |

```tsx
// Wall.tsx — WallStack before (lines 37–44)
<div
  className="relative rounded-sm border border-gray-400"
  style={{
    ...size,
    background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
  }}
  data-testid="wall-stack"
>

// after
<div
  className="relative rounded-sm border border-[#9a8b7a]"
  style={{
    ...size,
    background: 'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)',
  }}
  data-testid="wall-stack"
>
```

```tsx
// Tile.tsx — faceUp=false back face (locate the face-down rendering branch)
// before: plain white/grey background
// after:
<div
  className="... border border-[#9a8b7a]"
  style={{
    background: 'linear-gradient(135deg, #f5f0e8 0%, #e8ddd0 50%, #d9c9b5 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 4px rgba(0,0,0,0.35)',
  }}
>
```

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/Wall.test.tsx` (existing — add assertions)

- **T-1**: Render `<Wall position="north" stackCount={5} initialStacks={19} />`. Query
  `getAllByTestId('wall-stack')[0]`. Assert it does **not** contain class `border-gray-400` (regression).
- **T-2**: Assert the same element has class `border-[#9a8b7a]` or inline `borderColor` matching `#9a8b7a`.
- **T-3**: Assert `data-testid="wall-stack"` is still present.

**File:** `apps/client/src/components/game/Tile.test.tsx` (existing — add assertions)

- **T-4**: Render `<Tile tile={0} faceUp={false} />`. Assert the back face element does **not** have a
  plain white background (regression guard against old `#ffffff` value).
- **T-5**: Assert the face-down element's inline `background` contains `f5f0e8`.
- **T-6**: Assert the face-down border class is `border-[#9a8b7a]` (or matching computed style).

### Visual Regression (manual)

- All tile backs — walls, opponent racks, player-held concealed tiles — should read as warm ivory/bone,
  clearly distinct from pure white.
- Top edge of every tile back should show a subtle highlight glint.

## Out of Scope

- Tile front (faceUp=true) styling changes.
- Wall positioning or draw-marker changes.
- `Wall` or `Tile` props interface changes.

## Dependencies

None. Fully independent.
