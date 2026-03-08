# US-036: Square Board Layout + Right Rail Reservation

## Status

- State: Not Started
- Priority: High
- Batch: B

## Problem

Current board framing is rectangular, with bottom dark gradient consuming space needed for board-first layout.

## Scope

- Make the primary board play area square.
- Remove fade-to-black background around local player zone so table remains full green.
- Reserve right-side rail for future messaging/hints/log panels.

## Acceptance Criteria

- AC-1: Core table area renders as square in desktop layout.
- AC-2: Bottom fade/black gradient is removed from local-player zone.
- AC-3: Right-side panel area is available and not overlapping table.

## Edge Cases

- EC-1: Mobile/small viewport keeps controls usable without clipping.
- EC-2: Overlay layers still align to table center after shape change.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/index.css`

## Test Plan

- Update `GameBoard.test.tsx` layout assertions.
- Add viewport coverage test for desktop and mobile breakpoints.
