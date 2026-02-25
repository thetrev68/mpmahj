# VR-001 — Table Felt Radial Gradient

**Phase:** 1 — High Impact, Low Effort
**Status:** Ready for Development
**Source:** Visual-Redesign-20220222.md §C.2, §D item 1

## Summary

Replace the flat linear green gradient on the game board root with a richer radial gradient that mimics real felt — brighter in the center, darker toward the edges.

## Acceptance Criteria

- **AC-1**: The game board root wrapper uses a radial-gradient background instead of `bg-gradient-to-br from-green-800 to-green-900`.
- **AC-2**: The gradient is `radial-gradient(ellipse at 50% 40%, #1e7a42 0%, #0f4f28 55%, #072c16 100%)`.
- **AC-3**: The gradient covers the full viewport via the existing `h-screen` class.
- **AC-4**: The `dark` class and `relative w-full h-screen` classes remain on the same element.
- **AC-5**: Styling follows a Tailwind-first pattern:
  - Define a named felt token (`--table-felt-gradient`) in shared stylesheet scope.
  - Apply the token via Tailwind class on the root wrapper (for example `bg-[image:var(--table-felt-gradient)]`).
  - Do not use inline `style` for the gradient unless Tailwind/token wiring is blocked.
- **AC-6**: No other layout, z-index, or positioning is changed in this story.

## Connection Points

| File                                            | Location                                            | Current value                                                                   | Change                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/client/src/components/game/GameBoard.tsx` | Line 257 — outer `<div>` `className`                | `"dark relative w-full h-screen bg-gradient-to-br from-green-800 to-green-900"` | Replace linear gradient utilities with tokenized radial gradient class (`bg-[image:var(--table-felt-gradient)]`) |
| `apps/client/src/index.css`                     | Inside existing `@layer base { :root { … } }` block | no felt token                                                                   | Add `--table-felt-gradient` token with the required radial gradient value                                        |

```tsx
// GameBoard.tsx line 257 — before
className = 'dark relative w-full h-screen bg-gradient-to-br from-green-800 to-green-900';

// after
className = 'dark relative w-full h-screen bg-[image:var(--table-felt-gradient)]';
```

```css
/* index.css — insert inside the existing @layer base { :root { … } } block */
@layer base {
  :root {
    --table-felt-gradient: radial-gradient(
      ellipse at 50% 40%,
      #1e7a42 0%,
      #0f4f28 55%,
      #072c16 100%
    );
  }
}
```

## Test Requirements

### Unit / Component Tests

**File:** `apps/client/src/components/game/GameBoard.test.tsx` (new file — create with these test cases)

- **T-1**: Render `GameBoard` in a minimal setup; assert the root wrapper includes the class `bg-[image:var(--table-felt-gradient)]`.
- **T-2**: Assert no inline gradient style is set on the root wrapper (Tailwind/token path is used).

### Visual Regression (manual)

- Verify center of board is lighter green than the corners.
- Verify no visible hard edges between gradient and component overlays.

## Out of Scope

- Any other component's background.

## Dependencies

None. Fully independent.
