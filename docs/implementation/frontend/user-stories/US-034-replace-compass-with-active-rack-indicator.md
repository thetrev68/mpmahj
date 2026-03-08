# US-034: Replace Compass With Active Rack Indicator

## Status

- State: Not Started
- Priority: Medium
- Batch: B

## Problem

Compass orientation is misleading relative to actual seat placement.

## Scope

- Remove `WindCompass` from all render sites (`PlayingPhasePresentation.tsx` and `CharlestonPhase.tsx`).
- Add an active-turn highlight ring (CSS outline/ring class) to the active player's rack zone container in `OpponentRack.tsx` and `PlayerRack.tsx`.
- Delete `WindCompass.tsx` and its test file once no render sites remain.

## Acceptance Criteria

- AC-1: `WindCompass` is not rendered anywhere in gameplay or Charleston phase.
- AC-2: Exactly one rack zone (the active turn owner's) has a visible highlight ring at any given time.
- AC-3: Active ring updates as turn advances.

## Edge Cases

- EC-1: Dead-hand players do not receive the active ring unless it is genuinely their turn.
- EC-2: During Charleston phase (no per-turn active seat), no rack receives an active ring.

## Primary Files (Expected)

- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx` — remove `WindCompass` import and JSX; pass `activeSeat` to rack components as `isActive`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx` — remove `WindCompass` import and JSX
- `apps/client/src/components/game/OpponentRack.tsx` — add `isActive?: boolean` prop; apply highlight ring class when true
- `apps/client/src/components/game/PlayerRack.tsx` — add `isActive?: boolean` prop; apply highlight ring class when true
- `apps/client/src/components/game/WindCompass.tsx` — delete file
- `apps/client/src/components/game/WindCompass.test.tsx` — delete file

## Notes for Implementer

- **Current render sites**: `WindCompass` is imported and rendered in exactly two places:
  1. `PlayingPhasePresentation.tsx` — passes `yourSeat`, `activeSeat`, `stage`, `deadHandSeats`
  2. `CharlestonPhase.tsx` — passes `yourSeat` and `activeSeat={gameState.dealer}`
- **`TurnIndicator.tsx` already exists** and renders fixed-position turn badges. It is separate from the rack ring — leave it unchanged.
- **Active ring styling**: In the outermost container div of `OpponentRack` and `PlayerRack`, use `cn()` (already imported) to add `ring-2 ring-green-400` when `isActive` is true.
- **Passing `isActive`**: `PlayingPhasePresentation.tsx` already has `activeSeat` in scope. Pass `isActive={player.seat === activeSeat}` to each `OpponentRack` and `isActive={yourSeat === activeSeat}` to `PlayerRack`.
- **Test mocks**: `PlayingPhasePresentation.test.tsx` already mocks `WindCompass` with `vi.mock(...)`. Remove that mock after removing the import.
- **Integration test**: `DrawTile.integration.test.tsx` has a test `'shows WindCompass when in Playing phase'` — update it to assert the active rack ring (e.g. check for `ring-green-400` class on the active rack wrapper) or remove it.
- **Charleston phase**: Pass `isActive={false}` (or no prop) to all racks in `CharlestonPhase.tsx` — there is no per-seat turn there.

## Test Plan

- Delete `WindCompass.test.tsx`.
- Update `PlayingPhasePresentation.test.tsx`: remove the `WindCompass` mock and its render assertion; add an assertion that the active seat's rack has the ring class applied.
- Update `PlayingPhase.test.tsx`: remove the `'renders WindCompass with current turn and stage'` test.
- Update `DrawTile.integration.test.tsx`: remove or replace the WindCompass assertion.
- Update `OpponentRack.test.tsx`: add tests for `isActive=true` (ring present) and `isActive=false` (ring absent).
- Update `PlayerRack.test.tsx`: same pattern as `OpponentRack`.
