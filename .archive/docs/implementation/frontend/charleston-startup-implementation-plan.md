# Charleston Startup Implementation Plan

Purpose: convert the Charleston startup visual audit into implementation-ready work items.

Scope:

- Charleston startup screen before any tiles are clicked
- Visual hierarchy, layout, and UI presentation
- Frontend implementation routing

Out of scope:

- Backend AI engine corrections
- Playing-phase board redesign
- Final visual polish for rare edge cases beyond baseline presentation

## Planning Notes

Decisions already made:

- `HintPanel` should eventually use actual tile visuals for `Recommended Pass` and `Patterns to Play For`.
- `tile_scores` and `utility_scores` should not be frontend-facing UI right now.
- The right rail / hint panel can be wider than it is now.
- Hint-panel background should follow theme properly: darker in dark mode, lighter in light mode.
- `Mahjong` is valid during Charleston, but it is a rare edge case and should not be visually prominent by default.
- Racks no longer need to be 19 tiles wide; reduce them to 16 tiles wide and center the tiles within the rack shell.

## Three-Column Plan

| Confirmed problem                                                                                                                                 | Proposed fix direction                                                                                                                                                                                                                                                       | Component / file owner                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerZone` does not read as one composed interaction surface. `StagingStrip`, `ActionBar`, and `PlayerRack` feel detached from each other.      | Tighten spacing and composition so the local player area reads as one grouped module. Revisit vertical rhythm and the relationship between staging, actions, and rack.                                                                                                       | `apps/client/src/components/game/PlayerZone.tsx`, `apps/client/src/components/game/phases/CharlestonPhase.tsx`                                                                            |
| `ActionBar` instruction text feels disconnected, like a floating notification instead of contextual guidance.                                     | Anchor instruction text more clearly to the action system. Likely keep the instruction inside the `ActionBar` but improve placement, hierarchy, and relationship to the `Proceed` action.                                                                                    | `apps/client/src/components/game/ActionBar.tsx`, `apps/client/src/components/game/ActionBarPhaseActions.tsx`                                                                              |
| `Proceed` is the primary Charleston action, but it does not feel dominant enough.                                                                 | Increase the clarity and confidence of the primary CTA without making the panel itself louder than necessary.                                                                                                                                                                | `apps/client/src/components/game/ActionBarPhaseActions.tsx`, `apps/client/src/components/ui/button.tsx`                                                                                   |
| `Mahjong` is available during Charleston, but the current button treatment is too prominent for such a rare edge case.                            | Keep the button available, but demote its default visual prominence. Consider a calmer resting style and only increase emphasis when `canDeclareMahjong` becomes true. Future enhancement could animate the enablement transition.                                           | `apps/client/src/components/game/ActionBarPhaseActions.tsx`                                                                                                                               |
| `StagingStrip` shows 6 slots while the startup rule says “select 3,” which creates a mental-model mismatch.                                       | Preserve the underlying support for blind-pass complexity if needed, but make the startup Charleston presentation clearer. Options include visual grouping, slot-state distinction, or a first-right-specific presentation that makes the active 3-tile expectation obvious. | `apps/client/src/components/game/StagingStrip.tsx`, `apps/client/src/components/game/phases/CharlestonPhase.tsx`                                                                          |
| `CharlestonTracker` is too dense and somewhat redundant. `3/4 ready` and per-seat readiness compete in a tight strip.                             | Simplify hierarchy. Keep pass direction and stage as primary, timer as secondary, and compress or demote readiness details.                                                                                                                                                  | `apps/client/src/components/game/CharlestonTracker.tsx`, `apps/client/src/components/game/CharlestonTimer.tsx`                                                                            |
| Pass direction is currently understandable but not spatially expressed strongly enough.                                                           | Add a clearer pass-direction visual cue. This should support the Charleston action without turning into noise. A centered board-level directional cue is worth exploring after the layout is cleaned up.                                                                     | `apps/client/src/components/game/CharlestonTracker.tsx`, `apps/client/src/components/game/phases/CharlestonPhase.tsx`, possibly `apps/client/src/components/game/PassAnimationLayer.tsx`  |
| `WallCounter` feels detached from the rest of the board chrome.                                                                                   | Bring it into a more unified visual language with the top chrome, either by integration or by making its floating treatment feel intentionally related.                                                                                                                      | `apps/client/src/components/game/WallCounter.tsx`, `apps/client/src/components/game/GameBoard.tsx`                                                                                        |
| `RightRailHintSection` is too visually dominant during Charleston.                                                                                | Reduce the visual competition between hinting and the primary Charleston task. The rail should remain available but more clearly secondary.                                                                                                                                  | `apps/client/src/components/game/GameBoard.tsx`, `apps/client/src/components/game/RightRailHintSection.tsx`, `apps/client/src/components/game/HintPanel.tsx`                              |
| `HintPanel` content hierarchy is wrong for Charleston. Technical score blocks are crowding the player-facing recommendation.                      | Replace text-only recommendation presentation with actual tile visuals for `Recommended Pass`. Use tile visuals in `Patterns to Play For` as well. Remove `tile_scores` and `utility_scores` from frontend UI for now; if needed, leave them in console/debug output only.   | `apps/client/src/components/game/HintPanel.tsx`, `apps/client/src/components/game/Tile.tsx`, `apps/client/src/components/game/TileImage.tsx`                                              |
| `HintPanel` shows raw values like `10000.0`, which read like internal/debug data rather than finished UX.                                         | Remove these values from player-facing Charleston UI along with the score sections. Do not try to cosmetically relabel them in the UI if the plan is to remove them anyway.                                                                                                  | `apps/client/src/components/game/HintPanel.tsx`                                                                                                                                           |
| `HintPanel` is too narrow for the amount and type of content planned.                                                                             | Increase right-rail width and allow the hint content to breathe, especially once tile-based pattern presentations are added.                                                                                                                                                 | `apps/client/src/components/game/GameBoard.tsx`, `apps/client/src/components/game/RightRailHintSection.tsx`, `apps/client/src/components/game/HintPanel.tsx`                              |
| Hint surfaces are not respecting theme expectations strongly enough. In dark mode the panel should feel dark; in light mode it should feel light. | Audit right-rail and hint-panel backgrounds against theme tokens. Replace the current too-light dark-mode feel with proper dark-surface styling while preserving light-mode contrast.                                                                                        | `apps/client/src/components/game/GameBoard.tsx`, `apps/client/src/components/game/RightRailHintSection.tsx`, `apps/client/src/components/game/HintPanel.tsx`, `apps/client/src/index.css` |
| `OpponentRack (South)` and the right rail feel crowded together.                                                                                  | Rebalance the right side of the board as part of the rail-width and rack-width changes. Ensure the board still feels centered and opponents do not look squeezed by the rail.                                                                                                | `apps/client/src/components/game/GameBoard.tsx`, `apps/client/src/components/game/phases/CharlestonPhase.tsx`, `apps/client/src/components/game/OpponentRack.tsx`                         |
| Player and opponent racks are wider than needed now that the old wall-position graphic is gone.                                                   | Reduce rack shells from 19-tile width to 16-tile width. Center the actual tiles within the rack body rather than stretching the rack to previous assumptions. Apply consistently to `PlayerRack` and `OpponentRack`.                                                         | `apps/client/src/components/game/PlayerRack.tsx`, `apps/client/src/components/game/OpponentRack.tsx`, `apps/client/src/components/game/rackStyles.ts`                                     |
| Seat labels on opponent racks are slightly weak relative to rack size.                                                                            | Reassess seat-label size, contrast, and placement after the rack-width reduction.                                                                                                                                                                                            | `apps/client/src/components/game/OpponentRack.tsx`                                                                                                                                        |

## Suggested Delivery Order

### Phase 1: Layout and hierarchy

- Tighten `PlayerZone`
- Rework `ActionBar` instruction anchoring
- Demote default Charleston `Mahjong` presentation
- Simplify `CharlestonTracker`
- Reduce rack width from 19 to 16 tiles and recenter tiles
- Rebalance the right side of the board around the rail

### Phase 2: Hint panel correction

- Remove `tile_scores` and `utility_scores` from player-facing UI
- Increase rail/panel width
- Correct dark-mode and light-mode surface styling
- Improve hierarchy so Charleston recommendation dominates

### Phase 3: Richer hint presentation

- Replace text-only `Recommended Pass` with tile visuals
- Render `Patterns to Play For` using tile visuals
- Reassess spacing and card structure once tile-based content exists

### Phase 4: Optional enhancement pass

- Add stronger pass-direction visuals
- Revisit wall-counter integration with top chrome
- Reassess opponent label emphasis and final balance polish

## Open Questions To Resolve Before Coding

- For the 6-slot `StagingStrip`, do you want all 6 slots to remain visible in startup Charleston, or should first-right visually present as 3 active slots and reserve the rest for later states?
- For tile-based pattern display in `HintPanel`, should each pattern show a full tile sequence, a compact tile strip, or a mixed text-plus-tile representation?
- For the demoted Charleston `Mahjong` button, should the default state be subtle-visible, outline-only, or tucked under secondary affordance styling until enabled?

## Success Criteria

- A first-time viewer can immediately identify the main Charleston task.
- `PlayerZone` feels like the clear interaction center of the screen.
- The right rail supports play without overpowering it.
- The hint panel looks like product UI rather than debug output.
- Rack sizing no longer reflects the removed wall-position constraint.
