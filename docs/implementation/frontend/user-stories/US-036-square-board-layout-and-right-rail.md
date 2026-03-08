# US-036: Square Board Layout + Right Rail Reservation

## Status

- State: Not Started
- Priority: High
- Batch: B

## Problem

Current board framing is rectangular, with bottom dark gradient consuming space needed for board-first layout.

## Scope

- Constrain the primary board play area to a square (equal width and height) using CSS.
- Remove any fade-to-black or dark gradient behind the local player zone so the full table surface is visible.
- Add a right-side rail container (empty, reserved) that sits beside the square board without overlapping it.

## Acceptance Criteria

- AC-1: Core table area has equal computed width and height (square) in desktop layout (≥1280px).
- AC-2: No dark gradient or fade overlay is applied to the bottom/local-player zone of the table.
- AC-3: A right-rail container exists beside the board and does not overlap table content.

## Edge Cases

- EC-1: At smaller viewports (< 768px), the board may no longer be square — controls must remain usable without clipping.
- EC-2: Fixed-position overlay layers (`WindCompass`, `TurnIndicator`, dialogs) still align to the board center after the shape change.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx` — wrap board in a square-constrained container; add right-rail div
- `apps/client/src/components/game/PlayerZone.tsx` — remove dark gradient background class/style
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — adjust outer container if it owns the table background
- `apps/client/src/index.css` — add or adjust CSS for `.game-board`, `.right-rail`, or similar utility classes if Tailwind is insufficient

## Notes for Implementer

- **Square constraint approach**: Use `aspect-square` (Tailwind) on the board container, or set `max-height: min(100vh, 100vw)` and `aspect-ratio: 1/1` in CSS. The container that currently fills the viewport should become square.
- **Right-rail**: Add a `<div className="right-rail w-64 flex-shrink-0" />` (or similar) alongside the square board in a flex row layout. It should be empty for this story — just reserved space. Future stories will fill it.
- **Finding the gradient**: Search for `from-black`, `bg-gradient`, or `backdrop` in `PlayerZone.tsx` and `GameBoard.tsx` to locate the gradient. It may be a Tailwind gradient utility class or inline style.
- **Fixed overlays**: Overlays using `fixed` positioning (`TurnIndicator`, `WindCompass`, dialogs) use viewport-relative coordinates and will not automatically re-center. If the board center shifts, update the percentage positions in those components accordingly (e.g. `TurnIndicator` uses `right-[8%]`, `bottom-[18%]`, etc.).
- **`apps/client/src/index.css` path**: The global CSS file lives at `apps/client/src/index.css`. Only add CSS here if Tailwind utilities are insufficient for the aspect-ratio or grid layout.

## Test Plan

- Update `GameBoard.test.tsx`: assert the board container has `aspect-square` class (or equivalent); assert no gradient class on local player zone.
- Assert right-rail container is present with appropriate testid (e.g. `data-testid="right-rail"`).
- Manual check at 1280px and 1440px width that board is visually square and right rail is visible beside it.
