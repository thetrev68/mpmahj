# US-048: Layout Support and Rack-Local Utilities

## Status

- State: Proposed
- Priority: High
- Batch: Proceed Flow

## Problem

The proceed-driven interaction model depends on a wider, clearer staging surface and a less cluttered action area. The current layout polish notes already identify several geometry and control-placement issues that overlap directly with this work.

## Scope

- Fold the relevant layout work from `layout-polish-plan.md` into the proceed-flow implementation path.
- Left-anchor the board layout and remove the centering container constraints.
- Ensure the staging area is wide enough to support both Charleston and gameplay claim staging cleanly.
- Keep side opponent racks flush with the board edges to maximize center width.
- Remove the AnimationSettings button and panel from `CharlestonPhase` (clutter removal).
- Remove `HouseRulesPanel` from `GameBoard`; repurpose the gear icon as a sound settings placeholder.
- Remove `Sort` from the action pane and place it at the bottom-left edge of the local rack instead.
- Capture a TODO for a future `Auto-sort hand` setting in the settings surface.

## Acceptance Criteria

- AC-1: The local staging area can display six staged tiles on one row without wrapping in desktop layout.
- AC-2: Side opponent racks are positioned flush with the board container edges (`left-0` / `right-0`), not inset.
- AC-3: The board layout container is left-anchored (`lg:justify-start`, no `mx-auto`, no `max-w-[1680px]`); the `right-rail` reservation remains in place.
- AC-4: The `charleston-settings-button` toggle and its `AnimationSettings` panel are absent from `CharlestonPhase`. The `useAnimationSettings` hook itself is retained — `isEnabled()` is still used for animation gating.
- AC-5: The gear icon in `GameBoard` toggles a "Sound settings coming soon" placeholder panel instead of `HouseRulesPanel`. `HouseRulesPanel` is no longer imported or rendered.
- AC-6: `Sort` is rendered as a rack-local utility near the bottom-left of the local rack, not in the bottom action pane.
- AC-7: The action pane no longer carries layout-cluttering utility controls that belong with the rack.
- AC-8: The implementation records a visible TODO or backlog note for future `Auto-sort hand` settings support.

## Edge Cases

- EC-1: Mobile and narrow layouts may still stack or compress controls, but must remain usable without clipped staging tiles.
- EC-2: Moving `Sort` must not interfere with rack hit targets, meld click targets, or accessibility focus order.
- EC-3: Existing history / hint / undo placements should remain stable unless explicitly changed by a related story.

## Primary Files (Expected)

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/components/game/PlayerZone.tsx`
- `apps/client/src/components/game/StagingStrip.tsx`
- `apps/client/src/components/game/PlayerRack.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `docs/implementation/frontend/layout-polish-plan.md`
- related component tests

## Notes for Implementer

- This story is the explicit bridge between the proceed-flow design and the existing layout polish plan.
- The most important overlap item is staging width. The new gameplay call flow depends on staging feeling like a stable workspace, not a cramped transient strip.
- For AC-3 (board left-anchor): remove `mx-auto`, `max-w-[1680px]`, and change `lg:justify-center` → `lg:justify-start` on the `game-board-layout` div. Do **not** remove `data-testid="right-rail"` or the rail reservation classes.
- For AC-4 (AnimationSettings removal): also remove the `showSettings` local state and the `import { AnimationSettings }` line. Keep `useAnimationSettings()` — its `isEnabled()` return is still used for animation gating throughout the component.
- For AC-5 (HouseRulesPanel replacement): rename `showBoardSettings` → `showSoundSettings`, default it to `false`, update the aria-label, and render a simple placeholder panel. Remove the `HouseRulesPanel` import.
- `Sort` should feel attached to the player's rack, not attached to global game actions. Note: US-046 also removes `Sort` from `ActionBar` as AC-4 of that story. US-048 owns the rack-placement half. Both halves must land for the migration to be complete — coordinate so the ActionBar removal and the rack placement ship together.
- The `Auto-sort hand` item is not implementation scope here; just record it so it does not get lost.

## Test Plan

- Update layout/component tests to assert:
  - staging row does not wrap on desktop (`flex-nowrap`)
  - `PlayerZone` inner wrapper uses `max-w-full`, not `max-w-[920px]`
  - sort button is not rendered by `ActionBar`
  - sort button appears in the rack-local area
  - opponent rack positioning classes use `left-0` / `right-0` in both `CharlestonPhase` and `PlayingPhasePresentation`
  - board layout container uses `lg:justify-start` (not `lg:justify-center`) and does not have `mx-auto` or `max-w-[1680px]`
  - `right-rail` element is still present (`data-testid="right-rail"`)
  - `charleston-settings-button` is absent from `CharlestonPhase`
  - gear button in `GameBoard` toggles the sound-settings placeholder, not `HouseRulesPanel`
- Manual verification:
  - Charleston feels spacious with 6 staged tiles
  - claim staging during gameplay does not feel cramped
  - rack-local sort remains reachable and visually subordinate to `Proceed`
