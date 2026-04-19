# Charleston Startup UI Map

Purpose: give a stable vocabulary for discussing the startup Charleston board shown in the screenshot captured on March 21, 2026. This file maps visible UI regions to the component names used in code, plus the wrapper names and selectors that make it easier to say exactly what should change.

Scope of this pass:

- Startup Charleston board before the local player has clicked anything
- What is visibly on screen
- The component or wrapper name used in code
- The main selector or `data-testid` when one exists

Out of scope for this pass:

- Full CSS ownership breakdown
- All hidden states and interaction variants
- Playing-phase-only elements

## Screen Hierarchy

Top-level screen structure in this state:

1. `GameBoard`
1. `CharlestonPhase`
1. Board chrome and shell wrappers
1. Opponent racks
1. Local player zone
1. Right rail hint section

Useful top-level wrappers:

| Visual region                 | Code name                                                 | Selector                               | Defined in                                                                   |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| Whole page / game screen      | `GameBoard` root                                          | `data-testid="game-board"`             | `apps/client/src/components/game/GameBoard.tsx`                              |
| Felt table background         | `GameBoard` root background using `--table-felt-gradient` | same as above                          | `apps/client/src/components/game/GameBoard.tsx`, `apps/client/src/index.css` |
| Main board layout wrapper     | `game-board-layout`                                       | `data-testid="game-board-layout"`      | `apps/client/src/components/game/GameBoard.tsx`                              |
| Board + right rail shell      | `board-layout-shell`                                      | `data-testid="board-layout-shell"`     | `apps/client/src/components/game/GameBoard.tsx`                              |
| Square center play area       | `square-board-container`                                  | `data-testid="square-board-container"` | `apps/client/src/components/game/GameBoard.tsx`                              |
| Right rail outer shell        | `right-rail`                                              | `data-testid="right-rail"`             | `apps/client/src/components/game/GameBoard.tsx`                              |
| Right rail empty upper filler | `right-rail-top`                                          | `data-testid="right-rail-top"`         | `apps/client/src/components/game/GameBoard.tsx`                              |
| Right rail content well       | `right-rail-bottom`                                       | `data-testid="right-rail-bottom"`      | `apps/client/src/components/game/GameBoard.tsx`                              |

## Visible Element Inventory

### Top Chrome

| Screenshot label                       | Code name                                    | Selector                                                 | Description                                                                                        |
| -------------------------------------- | -------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Charleston header strip across the top | `CharlestonTracker`                          | `data-testid="charleston-tracker"`                       | The green fixed bar showing pass direction, pass number, ready count, ready indicators, and timer. |
| Pass label on left side of top strip   | `charleston-direction`                       | `data-testid="charleston-direction"`                     | Text such as `Pass Right`.                                                                         |
| Arrow next to pass label               | `charleston-arrow`                           | `data-testid="charleston-arrow"`                         | Direction symbol like `->`, `<-`, or `<>`.                                                         |
| Yellow pass-progress pill              | `charleston-progress`                        | `data-testid="charleston-progress"`                      | Text like `1st Charleston - Pass 1 of 3`.                                                          |
| Ready count text                       | ready count in `CharlestonTracker`           | `data-testid="ready-count"`                              | Aggregate readiness such as `3/4 ready`.                                                           |
| Seat readiness row                     | ready indicators in `CharlestonTracker`      | `data-testid="ready-indicators"` and `ready-indicator-*` | Per-seat readiness display such as `East •`, `South ✓`.                                            |
| Timer capsule                          | `CharlestonTimer` inside `CharlestonTracker` | no unique wrapper test id in this file                   | The `Timer 45s / 60s` pill in the top strip.                                                       |
| Leave / log out control group          | `board-controls-strip`                       | `data-testid="board-controls-strip"`                     | Top-right floating controls outside the square board.                                              |
| Leave button                           | leave game button                            | `data-testid="leave-game-button"`                        | Opens leave confirmation flow.                                                                     |
| Log out button                         | logout button                                | `data-testid="logout-button"`                            | Ends auth session and returns to lobby/login flow.                                                 |
| Wall counter card                      | `WallCounter`                                | `data-testid="wall-counter"`                             | Black card at upper-left showing `Tiles Remaining`.                                                |
| Wall counter number                    | WallCounter value                            | `data-testid="wall-counter-value"`                       | Colored remaining-tile number.                                                                     |

### Opponent Area

These are all rendered inside `charleston-board-regions`.

| Screenshot label           | Code name                                   | Selector                                                      | Description                                                                                   |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Absolute board-region grid | `charleston-board-regions`                  | `data-testid="charleston-board-regions"`                      | The invisible three-by-three placement grid for top, left, right, and player areas.           |
| Top opponent rack          | `OpponentRack` for West in this screenshot  | `data-testid="opponent-rack-west"` and `opponent-slot-west`   | Horizontal wood rack at the top with face-down concealed tiles and label `WEST (BOT)`.        |
| Left opponent rack         | `OpponentRack` for North in this screenshot | `data-testid="opponent-rack-north"` and `opponent-slot-north` | Vertical wood rack on the left side with label `NORTH (BOT)`.                                 |
| Right opponent rack        | `OpponentRack` for South in this screenshot | `data-testid="opponent-rack-south"` and `opponent-slot-south` | Vertical wood rack on the right side with label `SOUTH (BOT)`.                                |
| Opponent wood rack body    | `opponent-rack-shell-*`                     | `data-testid="opponent-rack-shell-west"` etc.                 | The brown rack body behind concealed tiles.                                                   |
| Opponent exposed-meld band | `opponent-meld-row-*`                       | `data-testid="opponent-meld-row-west"` etc.                   | The darker strip reserved for exposed melds; usually empty at startup Charleston.             |
| Opponent concealed tiles   | concealed row inside `OpponentRack`         | `data-testid="opponent-concealed-row-west"` etc.              | The face-down tile backs that make up the visible hand count.                                 |
| Opponent staged pass tiles | staging row inside `OpponentRack`           | `data-testid="opponent-staging-west"` etc.                    | The temporary face-down group of three tiles shown near an opponent rack when they are ready. |
| Opponent seat label        | seat label inside `OpponentRack`            | `data-testid="opponent-seat-west"` etc.                       | Black pill label such as `WEST (BOT)`.                                                        |

### Local Player Area

The entire local-player section is composed by `PlayerZone`.

| Screenshot label          | Code name                                   | Selector                                                | Description                                                               |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Local player region       | `PlayerZone`                                | `data-testid="player-zone"` or `player-zone-region`     | The full lower-center interaction area.                                   |
| Local player layout grid  | `player-zone-layout`                        | `data-testid="player-zone-layout"`                      | Splits the area into staging slot, action slot, and rack slot.            |
| Staging-slot wrapper      | `player-zone-staging-slot`                  | `data-testid="player-zone-staging-slot"`                | Left/center wrapper that contains the staging strip.                      |
| Action-slot wrapper       | `player-zone-actions-slot`                  | `data-testid="player-zone-actions-slot"`                | Right-side wrapper that contains the black action panel.                  |
| Rack-slot wrapper         | `player-zone-rack-slot`                     | `data-testid="player-zone-rack-slot"`                   | Full-width lower wrapper that contains the player rack.                   |
| Staging strip card        | `StagingStrip`                              | `data-testid="staging-strip"`                           | Green translucent tray with six dashed slots above the rack.              |
| Staging strip viewport    | `staging-slot-viewport`                     | `data-testid="staging-slot-viewport"`                   | Width-constrained inner viewport used to scale slot row.                  |
| Staging slot row          | `staging-slot-row`                          | `data-testid="staging-slot-row"`                        | The six-slot grid itself.                                                 |
| Empty staging slots       | staging slot placeholders                   | `data-testid="staging-slot-0"` through `staging-slot-5` | Empty dashed tile boxes at startup.                                       |
| Action panel              | `ActionBar`                                 | `data-testid="action-bar"`                              | Black translucent panel with instruction text and buttons.                |
| Action message text       | instruction text in `ActionBarPhaseActions` | `data-testid="action-instruction"`                      | Text like `Charleston. Select 3 tiles to pass right, then press Proceed.` |
| Proceed button            | proceed action button                       | `data-testid="proceed-button"`                          | Main green button for confirming pass or vote.                            |
| Mahjong button            | declare button                              | `data-testid="declare-mahjong-button"`                  | Yellow button below `Proceed`.                                            |
| Player rack wrapper       | `PlayerRack`                                | `data-testid="player-rack"`                             | The local bottom rack area.                                               |
| Selection counter         | selection counter in `PlayerRack`           | `data-testid="selection-counter"`                       | White text like `0/3 selected`.                                           |
| Player rack wood shell    | `player-rack-shell`                         | `data-testid="player-rack-shell"`                       | Brown rack body spanning the bottom of the board.                         |
| Player rack meld row      | `player-rack-meld-row`                      | `data-testid="player-rack-meld-row"`                    | Upper dark band reserved for exposed melds.                               |
| Player rack concealed row | `player-rack-concealed-row`                 | `data-testid="player-rack-concealed-row"`               | Lower row where the face-up hand tiles sit.                               |
| Local hand tiles          | `Tile` instances inside `PlayerRack`        | `data-testid="tile-<tile>-<id>"`                        | The clickable face-up tile components in the player hand.                 |

### Right Rail

| Screenshot label                  | Code name                             | Selector                                             | Description                                                                     |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Right rail hint section           | `RightRailHintSection`                | `data-testid="right-rail-hint-section"`              | The overall AI hint area placed into the right rail portal slot.                |
| Right rail portal slot            | `RIGHT_RAIL_HINT_SLOT_ID`             | `id="right-rail-hint-slot"`                          | DOM mount point where the hint section is portaled.                             |
| `AI HINT` heading                 | heading inside `RightRailHintSection` | no dedicated test id                                 | Small uppercase section title at top of rail.                                   |
| Hint panel card                   | `HintPanel`                           | `data-testid="hint-panel"`                           | White scrollable card containing the current recommendation and analysis lists. |
| Recommendation header             | heading inside `HintPanel`            | no dedicated test id                                 | `Current Recommendation`.                                                       |
| Charleston recommended pass block | Charleston recommendation section     | `data-testid="hint-charleston-pass-recommendations"` | The list of recommended pass tiles for Charleston.                              |
| Tile scores block                 | tile score section                    | `data-testid="hint-tile-scores"`                     | Ranked “strong after discard” scores.                                           |
| Patterns block                    | best patterns section                 | `data-testid="hint-best-patterns"`                   | Top pattern cards shown as likely goals.                                        |
| One pattern card                  | pattern summary card                  | `data-testid="hint-best-pattern-0"` etc.             | Individual pattern card with score, distance, and win chance.                   |
| Utility scores block              | utility score section                 | `data-testid="hint-utility-scores"`                  | Ranked “stronger to keep” tile scores.                                          |
| Get new hint button               | right rail hint refresh button        | `data-testid="get-new-hint-button"`                  | Outline button pinned below the hint panel content.                             |

## Naming Notes

Use these names when describing changes:

- Say `CharlestonTracker` for the top green status strip.
- Say `WallCounter` for the black `Tiles Remaining` card.
- Say `OpponentRack` plus seat, for example `OpponentRack (North)` or `opponent-rack-north`.
- Say `PlayerZone` for the full local-player area, then `StagingStrip`, `ActionBar`, or `PlayerRack` for its three major parts.
- Say `RightRailHintSection` for the whole right-rail hint area and `HintPanel` for the white inner card.
- Say `Tile` only for an individual tile component, not for the rack or strip that contains it.

## Important Mounted-But-Not-Meaningfully-Visible Element

`GameplayStatusBar` is also rendered during Charleston, but in this state it shares the same fixed top position as `CharlestonTracker`. The visible top strip in the screenshot is effectively `CharlestonTracker`; `GameplayStatusBar` is not the element you should reference when describing that visible green header.

## Next Pass

Part 2 should extend this file with a styling map:

- component wrapper versus content owner
- key Tailwind classes and inline style owners
- shared style tokens like `RACK_WOOD_STYLE` and `--table-felt-gradient`
- which file to edit for board chrome, rack geometry, tile visuals, and right-rail layout

## Styling Ownership Map

This section answers: if a visual change is requested, where should the change usually be made?

### Board-Level Layout and Chrome

| Visual concern                                     | Primary owner                                     | Secondary owner            | Notes                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Full-screen felt background                        | `GameBoard.tsx` root class plus `index.css` token | none                       | The board uses `bg-[image:var(--table-felt-gradient)]`; the gradient itself is defined in `--table-felt-gradient`.   |
| Board + right rail sizing                          | `GameBoard.tsx`                                   | none                       | The square-board width, right-rail width, padding, and responsive breakpoints live here.                             |
| Right rail shell, border, blur, and split sections | `GameBoard.tsx`                                   | `RightRailHintSection.tsx` | `GameBoard` owns the rail container; `RightRailHintSection` owns the content placed inside it.                       |
| Top fixed Charleston strip                         | `CharlestonTracker.tsx`                           | `CharlestonTimer.tsx`      | Tracker owns the green bar and its layout; timer owns only the timer sub-block.                                      |
| Wall counter card                                  | `WallCounter.tsx`                                 | `ui/card.tsx`              | `WallCounter` sets the fixed position and dark treatment; `Card` contributes the base rounded/border/shadow styling. |
| Leave / log out buttons                            | `GameBoard.tsx`                                   | `ui/button.tsx`            | `GameBoard` sets placement and overrides; `Button` supplies the base button system.                                  |

### Charleston Board Geometry

| Visual concern                                    | Primary owner         | Secondary owner                              | Notes                                                                                                                     |
| ------------------------------------------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Opponent and player placement around the board    | `CharlestonPhase.tsx` | `opponentRackUtils.ts`                       | `CharlestonPhase` owns the placement grid and slot assignment.                                                            |
| Local player three-part layout                    | `PlayerZone.tsx`      | none                                         | If staging/action/rack spacing feels wrong, start here.                                                                   |
| Staging strip width, slot count, scaling behavior | `StagingStrip.tsx`    | none                                         | Slot width, height, gap, strip padding, and responsive scale variables are all local here.                                |
| Action panel box styling                          | `ActionBar.tsx`       | `ActionBarPhaseActions.tsx`, `ui/button.tsx` | `ActionBar` owns the black panel shell; `ActionBarPhaseActions` owns the instruction text and the button stack inside it. |
| Opponent rack orientation and staging placement   | `OpponentRack.tsx`    | `rackStyles.ts`                              | `OpponentRack` owns left/right/top geometry; wood finish is shared through `RACK_WOOD_STYLE`.                             |
| Player rack shell and internal rows               | `PlayerRack.tsx`      | `rackStyles.ts`                              | `PlayerRack` owns row heights and shell padding; wood finish is shared.                                                   |

### Tile Visuals

| Visual concern                           | Primary owner                       | Secondary owner                                           | Notes                                                                                             |
| ---------------------------------------- | ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Tile outer box appearance                | `Tile.css`                          | `Tile.tsx`                                                | Background, border, shadow, radius, and state classes are in CSS; `Tile.tsx` applies the classes. |
| Tile dimensions                          | `Tile.css` and `Tile.tsx`           | none                                                      | Both files encode sizes; change both carefully if tile dimensions change.                         |
| Selected lift, hover lift, disabled look | `Tile.css`                          | `Tile.tsx`                                                | CSS defines the look; `Tile.tsx` decides which state is applied.                                  |
| Face-down tile back appearance           | `Tile.css`                          | `OpponentRack.tsx`, `StagingStrip.tsx`                    | Racks/strip choose `faceUp={false}`; CSS defines how the back looks.                              |
| Tile motion and entry/exit animations    | `Tile.css`                          | `seatAnimations.ts`, `PlayerRack.tsx`, `StagingStrip.tsx` | CSS owns keyframes; the other files decide when to attach animation classes.                      |
| Tile art image content                   | `TileImage.tsx` and tile SVG assets | none                                                      | This is separate from the tile frame styling in `Tile.css`.                                       |

### Right Rail and Hint Content

| Visual concern                      | Primary owner              | Secondary owner                 | Notes                                                                                                         |
| ----------------------------------- | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Right rail container look           | `GameBoard.tsx`            | `ui/card.tsx` tokens indirectly | Width, backdrop blur, border, and split background are owned by `GameBoard`.                                  |
| AI Hint section spacing and heading | `RightRailHintSection.tsx` | none                            | Use this for the section wrapper and heading row.                                                             |
| Hint card body                      | `HintPanel.tsx`            | `ui/card.tsx`                   | `HintPanel` sets the card’s scroll, padding, and section spacing; `Card` provides the base component styling. |
| Get Hint / Get New Hint buttons     | `RightRailHintSection.tsx` | `ui/button.tsx`                 | Placement and button overrides live in `RightRailHintSection`.                                                |

## Shared Style Building Blocks

These are the reusable building blocks already in the codebase.

### Global Tokens

| Token or utility                                                  | Defined in                  | Used by                                       | What it controls                                                  |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `--table-felt-gradient`                                           | `apps/client/src/index.css` | `GameBoard.tsx`                               | Overall table background image.                                   |
| Theme tokens like `--card`, `--background`, `--border`, `--muted` | `apps/client/src/index.css` | shadcn/ui components and many game components | Shared semantic colors.                                           |
| Reduced-motion global overrides                                   | `apps/client/src/index.css` | whole app                                     | Suppresses common animation utility classes under reduced motion. |

### Shared Rack Styling

| Token or utility  | Defined in                                      | Used by                              | What it controls                                 |
| ----------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `RACK_WOOD_STYLE` | `apps/client/src/components/game/rackStyles.ts` | `PlayerRack.tsx`, `OpponentRack.tsx` | Shared wood gradient and shadow for rack bodies. |

### Shared Tile Motion Wiring

| Token or utility             | Defined in                                          | Used by                              | What it controls                              |
| ---------------------------- | --------------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| `SEAT_ENTRY_CLASS`           | `apps/client/src/components/game/seatAnimations.ts` | `PlayerRack.tsx`, `StagingStrip.tsx` | Maps seat to tile entry animation class name. |
| `.tile-enter-from-*` classes | `apps/client/src/components/game/Tile.css`          | applied through `SEAT_ENTRY_CLASS`   | Directional receive animations.               |
| `.tile-leaving`              | `apps/client/src/components/game/Tile.css`          | `PlayerRack.tsx`                     | Outgoing pass animation.                      |

### Shared UI Primitives

| Primitive | Defined in                                 | Used by                                                                  | What it controls                                               |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `Button`  | `apps/client/src/components/ui/button.tsx` | `GameBoard.tsx`, `ActionBarPhaseActions.tsx`, `RightRailHintSection.tsx` | Base button shape, size variants, focus ring, disabled state.  |
| `Card`    | `apps/client/src/components/ui/card.tsx`   | `WallCounter.tsx`, `HintPanel.tsx`                                       | Base card border radius, border, background token, and shadow. |
| `Badge`   | `apps/client/src/components/ui/badge.tsx`  | `WallCounter.tsx`, `CharlestonTimer.tsx`, `StagingStrip.tsx`             | Small pill-style labels.                                       |

## Change Routing Guide

Use this section when writing requests for edits.

### If You Want to Change the Whole Board

- Change felt/background, outer spacing, square board size, or right rail width in `GameBoard.tsx`.
- Change the felt gradient token in `index.css`.

### If You Want to Change the Top Charleston Strip

- Change bar height, padding, green background, border, and item spacing in `CharlestonTracker.tsx`.
- Change only the timer pill styling in `CharlestonTimer.tsx`.

### If You Want to Change Opponent Racks

- Change position around the board or whether staging appears left/right/top in `CharlestonPhase.tsx` or `OpponentRack.tsx`.
- Change rack wood appearance in `rackStyles.ts`.
- Change face-down tile appearance in `Tile.css`.

### If You Want to Change the Local Player Area

- Change the relationship between staging strip, action panel, and rack in `PlayerZone.tsx`.
- Change staging slot size, slot count width, dashed slot look, or strip padding in `StagingStrip.tsx`.
- Change the black action panel shell in `ActionBar.tsx`.
- Change the instruction text/button stack behavior and button labeling in `ActionBarPhaseActions.tsx`.
- Change the wood rack shell, meld-row height, concealed-row positioning, or selection counter placement in `PlayerRack.tsx`.

### If You Want to Change Tile Appearance

- Change tile frame, border, paper tone, back-face color, selection glow, hover lift, disabled state, and animation keyframes in `Tile.css`.
- Change tile state logic, inline transform behavior, accessibility, or when classes are applied in `Tile.tsx`.
- Change tile art imagery in `TileImage.tsx` or the tile asset files under `public/assets/tiles/`.

### If You Want to Change the Right Rail

- Change rail width, rounded edge, border, blur, or top-versus-bottom split in `GameBoard.tsx`.
- Change the `AI Hint` section layout, heading spacing, request-button placement, or empty/loading/error states in `RightRailHintSection.tsx`.
- Change the white hint card layout, typography hierarchy, and internal section spacing in `HintPanel.tsx`.

## Suggested Language for Future Requests

Use requests in this form:

- “Adjust the `PlayerZone` layout so the `ActionBar` sits closer to the `StagingStrip`.”
- “Change the `OpponentRack (South)` staging placement, not the tile styling.”
- “Update `RACK_WOOD_STYLE` for both player and opponent racks.”
- “Keep `GameBoard` rail width, but restyle the `HintPanel` card.”
- “Change `Tile.css` selected-state lift and glow, not the rack layout.”

That wording should make the target edit location much less ambiguous.
