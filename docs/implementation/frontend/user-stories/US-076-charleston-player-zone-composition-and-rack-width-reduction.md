# US-076: Charleston Player Zone Composition and Rack Width Reduction

## Status

- State: Proposed
- Priority: Critical
- Batch: K
- Implementation Ready: Yes

## Problem

The Charleston startup screen does not establish `PlayerZone` as the clear interaction center.
`StagingStrip`, `ActionBar`, and `PlayerRack` feel too detached from each other, and both player
and opponent racks are still sized for the removed wall-position graphic. That legacy 19-tile rack
width now wastes space and weakens the board composition.

## Scope

**In scope:**

- Tighten `PlayerZone` composition so staging, actions, and rack read as one grouped surface.
- Reduce both `PlayerRack` and `OpponentRack` shell span along the tile axis from 19 tiles to 16
  tiles.
- Center actual tiles within the reduced rack shells instead of stretching the shells to legacy
  assumptions.
- Rebalance the right side so `OpponentRack (South)` does not feel crowded by the right rail after
  width changes.
- Reassess opponent seat-label placement/contrast after rack-width reduction.

**Out of scope:**

- Hint-panel content redesign.
- Charleston status-bar copy changes.
- Pass-direction animation enhancements.

## Acceptance Criteria

- AC-1: `PlayerZone` no longer presents `StagingStrip`, `ActionBar`, and `PlayerRack` as three
  visually detached islands; the spacing and alignment should make them read as one grouped local
  control surface.
- AC-2: `PlayerRack` shell span along the concealed-tile axis is reduced from the current 19-tile
  model to a 16-tile model.
- AC-3: `OpponentRack` shell span along the concealed-tile axis is reduced consistently to the same
  16-tile model, even when that axis renders as vertical height instead of horizontal width.
- AC-4: Concealed tiles remain centered within both rack shell types after the width reduction.
- AC-5: The right-side board composition no longer feels squeezed between `OpponentRack (South)`
  and the right rail at desktop Charleston layout widths.
- AC-6: Opponent seat labels remain readable after the rack-width change.

## Edge Cases

- EC-1: Reduced rack widths must still accommodate startup Charleston concealed tile counts without
  clipping.
- EC-2: The revised composition must not break playing-phase rack layout if shared rack sizing is
  reused there.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/OpponentRack.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/PlayerZone.test.tsx`
- `apps/client/src/components/game/PlayerRack.test.tsx`
- `apps/client/src/components/game/OpponentRack.test.tsx`

## Notes for Implementer

Treat the 16-tile rack width as a new baseline, not a cosmetic one-off for Charleston only, unless
testing proves the shared geometry causes playing-phase regressions.

The concrete rack-span constants currently live in the rack components:

- `PlayerRack.tsx`
- `OpponentRack.tsx`

For vertical opponent racks, do not think in terms of “width.” The requirement is the span along
the concealed-tile axis. For horizontal racks that is width; for vertical racks that is height.

Do not leave tiles visually left-biased inside narrower rack shells. The centered-tile requirement
is part of the story, not optional polish.

## Test Plan

- Update layout tests for `PlayerZone`.
- Add or update rack tests to assert the new width model and centering behavior.
- Run Charleston screen tests that cover player/opponent rack rendering.

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/PlayerZone.test.tsx apps/client/src/components/game/PlayerRack.test.tsx apps/client/src/components/game/OpponentRack.test.tsx apps/client/src/components/game/phases/CharlestonPhase.test.tsx
npx tsc --noEmit
```
