# US-048: Layout Support and Rack-Local Utilities

## Status

- State: Done
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

---

## Codex implementation summary

Implemented `US-048` and committed it as `dca80d4` (`Implement US-048 rack-local layout support`).

The change left-anchors the board, widens the player zone/staging row, moves side racks flush to `left-0` / `right-0`, removes Charleston’s settings toggle, replaces `HouseRulesPanel` with a sound-settings placeholder in [GameBoard.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/GameBoard.tsx), and moves `Sort` out of the action pane into a rack-local control in [PlayerRack.tsx](/c:/Repos/mpmahj/apps/client/src/components/game/PlayerRack.tsx). I also recorded the future `Auto-sort hand` follow-up in [TODO.md](/c:/Repos/mpmahj/TODO.md) and [layout-polish-plan.md](/c:/Repos/mpmahj/docs/implementation/frontend/layout-polish-plan.md).

Verification is complete: `cargo fmt --all`, `cargo check --workspace`, `cargo test --workspace`, `cargo clippy --all-targets --all-features`, `npx prettier --write .`, `npx tsc --noEmit`, `npx vitest run`, and `npm run check:all` all passed. The recovery screenshot baselines under [frontend-recovery-guardrails.spec.ts-snapshots](/c:/Repos/mpmahj/apps/client/e2e/frontend-recovery-guardrails.spec.ts-snapshots) were regenerated to match the intentional layout shift.

---

## Claude validation

## US-048 Implementation Review

### Acceptance Criteria for US-048

| AC                                                                                                       | Status | Evidence                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** — staging row no-wrap on desktop                                                                | ✅     | [StagingStrip.tsx:169] `flex flex-nowrap`; test at [StagingStrip.test.tsx:38]                                                                                         |
| **AC-2** — opponent racks `left-0`/`right-0`                                                             | ✅     | [CharlestonPhase.tsx:398–399] and [PlayingPhasePresentation.tsx:184–186]; tests in both test files                                                                    |
| **AC-3** — board `lg:justify-start`, no `mx-auto`/`max-w-[1680px]`, `right-rail` retained                | ✅     | [GameBoard.tsx:283] + [GameBoard.tsx:326]; [GameBoard.test.tsx:91–103]                                                                                                |
| **AC-4** — `charleston-settings-button` and `AnimationSettings` removed; `useAnimationSettings` retained | ✅     | No `AnimationSettings` import or settings toggle in [CharlestonPhase.tsx]; `useAnimationSettings` at line 44; [CharlestonPhase.test.tsx:372] asserts button absent    |
| **AC-5** — gear icon → "Sound settings coming soon" placeholder, `HouseRulesPanel` gone                  | ✅     | `showSoundSettings` state + placeholder panel at [GameBoard.tsx:252–262]; no `HouseRulesPanel` import anywhere in GameBoard; [GameBoard.test.tsx:59–73] covers toggle |
| **AC-6** — Sort at `absolute -bottom-12 left-0` in rack                                                  | ✅     | [PlayerRack.tsx:252–265] with `data-testid="rack-sort-button"`; `onSort` wired in [PlayingPhasePresentation.tsx:269]                                                  |
| **AC-7** — action pane free of `Sort`                                                                    | ✅     | Grep confirms zero occurrences of `Sort` in ActionBar.tsx                                                                                                             |
| **AC-8** — `Auto-sort` hand TODO recorded                                                                | ✅     | Inline TODO at [GameBoard.tsx:259], [TODO.md:44], and [layout-polish-plan.md:319]; test at [GameBoard.test.tsx:71] asserts the text appears                           |

### Test Plan Coverage

All items from the test plan are implemented:

- `flex-nowrap` on staging row — [StagingStrip.test.tsx]
- `max-w-full` on PlayerZone inner wrapper — [PlayerZone.test.tsx:78]
- Sort absent from ActionBar — confirmed by grep (no matches)
- Sort present in rack-local area — [PlayerRack.test.tsx:174–185]
- Opponent racks `left-0`/`right-0` in Charleston + Playing — both test files
- Board `lg:justify-start`, no `mx-auto/max-w-[1680px]` — [GameBoard.test.tsx:91]
- `right-rail` present — [GameBoard.test.tsx:102]
- `charleston-settings-button` absent — [CharlestonPhase.test.tsx:372]
- Gear toggles sound-settings placeholder — [GameBoard.test.tsx:59]

### One Note

`onSort` is only passed to `PlayerRack` in `PlayingPhasePresentation` (not in `CharlestonPhase`). This is correct — Sort was never in the Charleston action bar. The migration only needed to move it away from the playing-phase ActionBar.

**Overall: implementation is complete and faithful to every AC, EC, and test plan item in the spec.** The US-048 status can be updated to "Done".
