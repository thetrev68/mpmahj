# VR-017 — WindCompass Size and Color Update

**Phase:** 4 — Lower Priority, Low Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §C.2, §D item 17

## Summary

Increase `WindCompass` from `w-28 h-28` (112px) to `w-32 h-32` (128px) and sharpen the background to `bg-green-950/90` to match the new darker table felt from VR-001.

## Acceptance Criteria

- **AC-1**: The outer fixed container changes from `w-28 h-28` to `w-32 h-32`.
- **AC-2**: The circular background `<div>` changes from `bg-gray-900/80` to `bg-green-950/90`.
- **AC-3**: `NODE_STYLE` fixed offsets are updated to preserve node inset proportion at 128px:
  - `North`: `top-1 left-1/2 -translate-x-1/2` -> `top-1.5 left-1/2 -translate-x-1/2`
  - `East`: `right-1 top-1/2 -translate-y-1/2` -> `right-1.5 top-1/2 -translate-y-1/2`
  - `South`: `bottom-1 left-1/2 -translate-x-1/2` -> `bottom-1.5 left-1/2 -translate-x-1/2`
  - `West`: `left-1 top-1/2 -translate-y-1/2` -> `left-1.5 top-1/2 -translate-y-1/2`
- **AC-4**: `data-testid="wind-compass"` is preserved.
- **AC-5**: All seat node test ids are preserved with lowercase suffixes:
  - `data-testid="compass-seat-east"`
  - `data-testid="compass-seat-south"`
  - `data-testid="compass-seat-west"`
  - `data-testid="compass-seat-north"`
- **AC-6**: The backdrop-blur and border on the background ring are unchanged.
- **AC-7**: Cross-line offsets are increased to preserve proportion at 128px:
  - Horizontal line: `left-6 right-6` -> `left-7 right-7`
  - Vertical line: `top-6 bottom-6` -> `top-7 bottom-7`
    Center dot styling remains unchanged.

## Connection Points

| File                                              | Location                      | Change                                                                          |
| ------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| `apps/client/src/components/game/WindCompass.tsx` | Line 73 — outer `<div>`       | `w-28 h-28` → `w-32 h-32`                                                       |
| `apps/client/src/components/game/WindCompass.tsx` | Line 79 — circular bg `<div>` | `bg-gray-900/80` → `bg-green-950/90`                                            |
| `apps/client/src/components/game/WindCompass.tsx` | Lines 32–36 — `NODE_STYLE`    | `top/right/bottom/left-1` → `top/right/bottom/left-1.5` (seat-specific classes) |
| `apps/client/src/components/game/WindCompass.tsx` | Lines 82–83 — cross lines     | `left-6 right-6` / `top-6 bottom-6` → `left-7 right-7` / `top-7 bottom-7`       |

```tsx
// WindCompass.tsx before (line 73)
<div className="fixed bottom-4 right-4 z-20 w-28 h-28" />;

// after
<div className="fixed bottom-4 right-4 z-20 w-32 h-32" />;

// before (line 79)
<div className="absolute inset-0 rounded-full bg-gray-900/80 border border-gray-600/60 backdrop-blur-sm" />;

// after
<div className="absolute inset-0 rounded-full bg-green-950/90 border border-gray-600/60 backdrop-blur-sm" />;

// NODE_STYLE before
const NODE_STYLE = {
  North: 'top-1 left-1/2 -translate-x-1/2',
  East: 'right-1 top-1/2 -translate-y-1/2',
  South: 'bottom-1 left-1/2 -translate-x-1/2',
  West: 'left-1 top-1/2 -translate-y-1/2',
};

// after
const NODE_STYLE = {
  North: 'top-1.5 left-1/2 -translate-x-1/2',
  East: 'right-1.5 top-1/2 -translate-y-1/2',
  South: 'bottom-1.5 left-1/2 -translate-x-1/2',
  West: 'left-1.5 top-1/2 -translate-y-1/2',
};

// cross lines before
<div className="absolute top-1/2 left-6 right-6 h-px bg-gray-600/40 -translate-y-1/2" />;
<div className="absolute left-1/2 top-6 bottom-6 w-px bg-gray-600/40 -translate-x-1/2" />;

// after
<div className="absolute top-1/2 left-7 right-7 h-px bg-gray-600/40 -translate-y-1/2" />;
<div className="absolute left-1/2 top-7 bottom-7 w-px bg-gray-600/40 -translate-x-1/2" />;
```

## Test Requirements

**File:** `apps/client/src/components/game/WindCompass.test.tsx` (existing — add/verify)

- **T-1**: Render `WindCompass`. Assert `getByTestId('wind-compass')` is present.
- **T-2**: Assert the compass does **not** have class `w-28` (regression guard against old size).
- **T-3**: Assert the compass has classes `w-32` and `h-32`.
- **T-4**: Assert all four `compass-seat-{seat}` testids are still present.
- **T-5**: Assert the background circle element has class `bg-green-950/90`.
- **T-6**: Assert seat node wrappers use `top/right/bottom/left-1.5` classes via `NODE_STYLE` mappings.
- **T-7**: Assert cross-line elements use `left-7 right-7` and `top-7 bottom-7`.

## Out of Scope

- Node color or state logic changes.
- Seat animation changes.
- Dead hand badge styling (already implemented in US-020).

## Dependencies

VR-001 (table felt gradient) should be done first so the color choice can be visually validated in context. Logically independent.
