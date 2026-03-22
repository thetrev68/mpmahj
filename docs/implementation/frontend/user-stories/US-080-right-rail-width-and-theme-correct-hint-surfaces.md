# US-080: Right Rail Width and Theme-Correct Hint Surfaces

## Status

- State: Proposed
- Priority: High
- Batch: L
- Implementation Ready: Yes

## Problem

The current right rail is too narrow for the hint content direction now planned, and the hint
surfaces do not feel strongly theme-correct. In dark mode, the hint area still feels too light;
in light mode, the surfaces should remain lighter and readable without reintroducing a hardcoded
single-theme look.

## Scope

**In scope:**

- Keep the game board square and left-aligned.
- Expand the right-side rail to use the available desktop / landscape-tablet space to the right of
  the square board instead of preserving a narrow fixed-width rail.
- Use responsive / variable width behavior based on available viewport size, with a minimum desktop
  target equivalent to the old proposed `24rem` and the ability to grow larger on wider screens.
- Update the square-board / right-rail width math together so the board remains square and
  left-aligned while the rail consumes the remaining horizontal real estate.
- Correct dark-mode hint surfaces so they feel like true dark surfaces.
- Preserve light-mode readability with lighter surfaces in light theme.
- Keep `RightRailHintSection` clearly secondary to the main Charleston interaction.

**Out of scope:**

- Tile-based hint pattern rendering itself.
- Removal of hint score blocks from UI.
- Board-wide theme changes outside the rail/hint surfaces needed here.

## Acceptance Criteria

- AC-1: The square game board remains square and left-aligned after the rail changes.
- AC-2: On desktop and landscape-tablet layouts, the right rail expands to use the available space
  to the right of the square board instead of remaining a narrow fixed 18rem column.
- AC-2: In dark theme, hint surfaces render as darker UI surfaces rather than pale/light cards.
- AC-3: In light theme, hint surfaces remain appropriately light and readable.
- AC-4: Rail widening does not cause the board composition to feel more cramped than before.
- AC-5: The right rail remains visually secondary to the primary Charleston task.
- AC-6: The square-board width calculation and right-rail width calculation are updated together so
  the layout does not retain stale `18rem` assumptions.

## Edge Cases

- EC-1: Rail width changes must not break desktop board layout assumptions.
- EC-2: Existing loading/error/empty rail states must still render coherently in both themes.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/HintPanel.tsx`
- `apps/client/src/index.css`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.test.tsx`
- `apps/client/src/components/game/HintPanel.test.tsx`

## Notes for Implementer

This story is about surface and width correction, not yet the deeper content restructure. Keep the
scope bounded so later hint-content stories can build on a stable container.

Current desktop layout has two linked `18rem` assumptions in `GameBoard.tsx`:

- right rail: `lg:w-[18rem]`
- square board width math: `calc(100vw-18rem-2rem)`

This story must update both together. Do not widen only the rail and leave the board-width math on
the old assumption.

## Test Plan

- Update rail-width and theme-surface tests.
- Verify idle, loading, error, and populated hint states in dark and light modes where practical.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/GameBoard.test.tsx apps/client/src/components/game/RightRailHintSection.test.tsx apps/client/src/components/game/HintPanel.test.tsx
npx tsc --noEmit
```
