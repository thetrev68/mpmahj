# VR-017 — WindCompass Size and Color Update

**Phase:** 4 — Lower Priority, Low Effort
**Source:** Visual-Redesign-20220222.md §C.2, §D item 17

## Summary

Increase `WindCompass` from `w-28 h-28` (112px) to `w-32 h-32` (128px) and sharpen the background to `bg-green-950/90` to match the new darker table felt from VR-001.

## Acceptance Criteria

- **AC-1**: The outer fixed container changes from `w-28 h-28` to `w-32 h-32`.
- **AC-2**: The circular background `<div>` changes from `bg-gray-900/80` to `bg-green-950/90`.
- **AC-3**: The `NODE_STYLE` positions for seat nodes are adjusted proportionally for the new 128px container size. Current values use `left-1`, `right-1`, `top-1`, `bottom-1` with `left-1/2`, `right-1/2` etc. — these percentage-based values auto-scale; only pixel offsets need checking.
- **AC-4**: `data-testid="wind-compass"` is preserved.
- **AC-5**: All `data-testid={compass-seat-{seat}}` are preserved.
- **AC-6**: The backdrop-blur and border on the background ring are unchanged.
- **AC-7**: Cross lines and center dot proportions are visually consistent with the larger size (the current `left-6 right-6` for cross lines may need to scale from `left-6` to `left-7` at 128px — assess during implementation).

## Connection Points

| File | Location | Change |
|------|----------|--------|
| `apps/client/src/components/game/WindCompass.tsx` | Line 73 — outer `<div>` | `w-28 h-28` → `w-32 h-32` |
| `apps/client/src/components/game/WindCompass.tsx` | Line 79 — circular bg `<div>` | `bg-gray-900/80` → `bg-green-950/90` |
| `apps/client/src/components/game/WindCompass.tsx` | Lines 82–83 — cross lines | Adjust `left-6 right-6` / `top-6 bottom-6` to `left-7 right-7` / `top-7 bottom-7` if needed |

```tsx
// WindCompass.tsx before (line 73)
className="fixed bottom-4 right-4 z-20 w-28 h-28"

// after
className="fixed bottom-4 right-4 z-20 w-32 h-32"

// before (line 79)
className="absolute inset-0 rounded-full bg-gray-900/80 border border-gray-600/60 backdrop-blur-sm"

// after
className="absolute inset-0 rounded-full bg-green-950/90 border border-gray-600/60 backdrop-blur-sm"
```

## Test Requirements

**File:** `apps/client/src/components/game/WindCompass.test.tsx` (existing — add/verify)

- **T-1**: Render `WindCompass`. Assert `getByTestId('wind-compass')` is present.
- **T-2**: Assert the compass does **not** have class `w-28` (regression guard against old size).
- **T-3**: Assert the compass has class `w-32`.
- **T-4**: Assert all four `compass-seat-{seat}` testids are still present.
- **T-5**: Assert the background circle element has class `bg-green-950/90`.

## Out of Scope

- Node color or state logic changes.
- Seat animation changes.
- Dead hand badge styling (already implemented in US-020).

## Dependencies

VR-001 (table felt gradient) should be done first so the color choice can be visually validated in context. Logically independent.
