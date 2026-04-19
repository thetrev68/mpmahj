# US-086: Charleston Board Region Ownership and Chrome Stacking

## Status

- State: Completed
- Priority: Critical
- Batch: M
- Implementation Ready: Yes

## Problem

The Charleston board still lacks a stable ownership model for its core layout regions.

Even after earlier board-local layout work, the current screen still shows the same structural
failures called out in the March 22 audit:

- the staging area and action pane do not read as one fixed board-region unit
- side opponent racks are not aligned to a single outside board perimeter
- the player rack can still compete with neighboring layout regions instead of staying fully
  contained inside an owned board region
- the selection counter lives below the rack instead of inside the action system
- top-of-board chrome still behaves like separate stacked overlays without a shared vertical-flow
  contract
- z-index layering remains ad hoc

These are not isolated styling defects. They are symptoms of missing layout ownership. This story
implements the geometry contract defined in
[charleston-board-geometry-compact-spec-2026-03-24.md](C:/Repos/mpmahj/docs/implementation/frontend/charleston-board-geometry-compact-spec-2026-03-24.md).

## Scope

**In scope:**

- Establish the square board container as the authoritative Charleston board scene.
- Make side opponent racks align to the same outside perimeter as the player rack.
- Refactor `PlayerZone` into a named south interaction region with stable internal subregions:
  - `staging-region`
  - `action-region`
  - `rack-region`
- Keep staging slot origin stable across Charleston states.
- Keep `Proceed`, `Mahjong`, instruction text, and selection count inside one fixed `action-region`.
- Move selection-count ownership out of `PlayerRack` and into the action-region owner.
- Constrain the player rack to the board-local rack region so it does not bleed into the rail.
- Convert top chrome to a shared vertical-flow system that prevents `CharlestonTracker` and
  `WallCounter` collisions.
- Apply a documented z-index scale for Charleston board-local layers.
- Add regression coverage for the named regions, board-local ownership, and chrome stacking.

**Out of scope:**

- Batch A CTA emphasis and right-rail surface cleanup except where required to preserve the new
  region ownership.
- Batch B board-width math and viewport-position cleanup except where this story necessarily shares
  board-local wrappers.
- Hint-panel content redesign.
- Backend/game-rule changes.
- New settings or persistence behavior.

## Acceptance Criteria

- AC-1: The square board container in `GameBoard` is the authoritative Charleston board scene, and
  the player-zone family does not render past that square into the right rail.
- AC-2: West-side and east-side opponent racks align to the same outside square perimeter as the
  player rack rather than floating inset from it.
- AC-3: `PlayerZone` renders as one fixed south interaction region bounded by the side racks and
  the player rack rather than as adjacent fragments.
- AC-4: `PlayerZone` exposes stable `staging-region`, `action-region`, and `rack-region` wrappers
  across Charleston states.
- AC-5: The staging strip uses a stable origin point and does not recenter or jump horizontally as
  slot count or state changes.
- AC-6: Instruction text, `Proceed`, `Mahjong`, and selection count all live inside the fixed
  `action-region`.
- AC-7: The selection counter no longer renders below the player rack.
- AC-8: The player rack remains contained within `rack-region` and does not bleed into the right
  rail or beyond the intended board boundary.
- AC-9: Top chrome uses a shared vertical-flow ownership model so `CharlestonTracker` and
  `WallCounter` cannot collide when content height changes.
- AC-10: `TurnIndicator` and dead-hand badges use board-local named anchors rather than
  viewport-relative positioning.
- AC-11: Charleston board-local components use the documented z-index scale instead of arbitrary
  competing values.
- AC-12: The repaired region ownership remains stable in first pass, blind pass, voting, and
  courtesy-pass Charleston states.

## Edge Cases

- EC-1: Blind-pass Charleston must preserve stable staging/action placement even when the visible
  slot count expands.
- EC-2: Read-only/historical Charleston must reuse the same region ownership without live-state
  layout drift.
- EC-3: Mid-width desktop must preserve board containment without reintroducing page-level
  horizontal scroll.
- EC-4: Top chrome wrapping or status-message growth must not overlap the wall counter or the board
  controls strip.
- EC-5: The z-index cleanup must not break viewport-global overlays such as dialogs or the leave
  overlay.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/OpponentRack.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/ActionBar.tsx`
- `apps/client/src/components/game/ActionBarPhaseActions.tsx`
- `apps/client/src/components/game/TurnIndicator.tsx`
- `apps/client/src/components/game/CharlestonTracker.tsx`
- `apps/client/src/components/game/WallCounter.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/GameBoard.test.tsx`
- `apps/client/src/components/game/PlayerZone.test.tsx`
- `apps/client/src/components/game/PlayerRack.test.tsx`
- `apps/client/src/components/game/OpponentRack.test.tsx`
- `apps/client/src/components/game/StagingStrip.test.tsx`
- `apps/client/src/components/game/TurnIndicator.test.tsx`
- `apps/client/src/components/game/CharlestonTracker.test.tsx`
- `apps/client/src/components/game/WallCounter.test.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.test.tsx`

## Notes for Implementer

Implement this story from the compact spec. Do not patch local symptoms without establishing the
named region owners first.

Order of operations:

1. Establish top-chrome ownership in `GameBoard`.
2. Refactor `CharlestonPhase` to expose named board regions and side-rack perimeter alignment.
3. Refactor `PlayerZone` to own `staging-region`, `action-region`, and `rack-region`.
4. Move selection-count rendering out of `PlayerRack` and into the action-region owner.
5. Constrain rack containment and apply the z-index scale.
6. Revalidate all required Charleston states.

Do not preserve the current selection counter location for compatibility. Moving it into the action
system is part of the story, not optional polish.

Do not solve chrome collisions with more hardcoded `top` offsets. This story requires a shared
vertical-flow container for the board controls, tracker, and wall counter.

If implementation reveals new behavior decisions rather than layout decisions, stop and split those
into follow-up stories instead of stretching this one.

## Test Plan

- Update structure tests so they assert:
  - stable `staging-region`, `action-region`, and `rack-region` wrappers
  - selection counter is rendered inside `action-region`
  - player rack is wrapped by a board-local containment region
  - side-rack wrappers follow perimeter-alignment structure
- Update chrome tests so they assert:
  - shared top-chrome stack container exists
  - tracker and wall counter no longer depend on independent hardcoded vertical offsets
- Update turn-indicator tests so they assert:
  - board-local anchor model
  - dead-hand badges follow the same model
- Add or update Charleston state tests for:
  - first right
  - first left blind pass
  - voting
  - courtesy pass

## Visual Verification

Required before completion:

1. `charleston-dark-lg-first-right`
   - confirm side-rack perimeter alignment
   - confirm fixed south interaction region
   - confirm selection count inside action region
2. `charleston-dark-lg-first-left-blind`
   - confirm slot expansion does not move staging origin
3. `charleston-dark-lg-voting`
   - confirm action region remains fixed under state change
4. `charleston-dark-lg-courtesy`
   - confirm action/staging placement remains stable
5. `charleston-dark-midwidth-first-right`
   - confirm rack containment and no chrome collision
6. `charleston-light-lg-first-right`
   - confirm region ownership remains coherent in light theme

## Verification Commands

```bash
npx vitest run apps/client/src/components/game/GameBoard.test.tsx apps/client/src/components/game/PlayerZone.test.tsx apps/client/src/components/game/PlayerRack.test.tsx apps/client/src/components/game/OpponentRack.test.tsx apps/client/src/components/game/StagingStrip.test.tsx apps/client/src/components/game/TurnIndicator.test.tsx apps/client/src/components/game/CharlestonTracker.test.tsx apps/client/src/components/game/WallCounter.test.tsx apps/client/src/components/game/phases/CharlestonPhase.test.tsx
npx tsc --noEmit
```
