# US-066: Play Surface Theme Root Ownership and Board Chrome Integrity

## Status

- State: Proposed
- Priority: Critical
- Batch: H
- Implementation Ready: Yes

## Problem

The play surface still cheats on theme handling.

`GameBoard` currently forces a local `dark` theme root on the board wrapper, which means the game
surface does not actually inherit the app's active light/dark theme. Even before fixing individual
controls, this breaks the basic contract that board chrome should respond to the current theme.

This also explains why previous "theme compliance" work felt incomplete in live testing:

- the board root is locked to dark styling
- rail chrome and board-adjacent controls are still authored against that assumption
- visible controls can look inconsistent with the rest of the app even when modal internals are fixed

## Scope

**In scope:**

- Remove forced `dark` theme ownership from the board root.
- Make the play surface inherit the active app theme normally.
- Repair board-level controls and wrappers that only looked acceptable because the board was
  artificially dark.
- Add tests that fail if the board root reintroduces a forced theme class.

**Out of scope:**

- Reworking the table-felt visual direction itself.
- Right-rail edge geometry, staging clipping, or alignment-grid work covered elsewhere.
- Modal internals already addressed by `US-056`.

## Acceptance Criteria

- AC-1: `GameBoard` does not apply a forced `dark` class to the play-surface root.
- AC-2: The play surface inherits the active app theme from the normal document/theme provider
  chain rather than creating a local theme island.
- AC-3: Board-level controls in the top strip remain legible and intentional in both light and dark
  mode after the forced-dark root is removed.
- AC-4: The right rail, its separators, and its immediate board-adjacent chrome remain legible in
  both light and dark mode after the forced-dark root is removed.
- AC-5: Light-mode screenshots/manual verification no longer show a dark-only board chrome layer
  over a light-themed app shell.
- AC-6: Tests explicitly assert the absence of a forced `dark` class on the `game-board` root.
- AC-7: If any board-level element still requires explicit light/dark styling after the root fix,
  it uses theme-aware tokens or explicit light/dark pairs rather than relying on a forced dark root.

## Edge Cases

- EC-1: The table felt background token remains visible and intentional in both themes.
- EC-2: Overlays that are intentionally color-coded remain distinguishable after the root theme fix.
- EC-3: The board does not become unreadable in light mode because downstream chrome was authored
  against hardcoded dark assumptions.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/RightRailHintSection.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`

## Notes for Implementer

### Root ownership rule

The board wrapper may own layout, felt background, and stacking context. It must not own theme mode.

If a component only looks correct because an ancestor forces `dark`, that component is still broken.

### Relationship to prior stories

This story is a prerequisite-quality repair for board-level theme work. `US-063` handles board
chrome token cleanup; this story removes the root-level theme lie that masks or distorts those
surfaces.

## Test Plan

- Root wrapper test:
  - assert `game-board` does not include `dark`
- Board chrome tests:
  - top controls remain present and theme-safe
  - right rail remains present and theme-safe
- Manual verification:
  - light mode
  - dark mode
  - modal open over board in both themes

## Verification Commands

```bash
cd apps/client
npx vitest run src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```
