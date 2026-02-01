# Game Design Document - Section 1: Visual Layout

## Table of Contents

- [Overview](#overview)
- [1.1 Viewport & Camera](#11-viewport--camera)
- [1.2 The Wall (Game Start Configuration)](#12-the-wall-game-start-configuration)
- [1.3 The Floor (Discard Zone)](#13-the-floor-discard-zone)
- [1.4 Player Zone (User / South)](#14-player-zone-user--south)
- [1.5 Opponent Zones (East, North, West)](#15-opponent-zones-east-north-west)
- [1.6 UI Overlays & HUD](#16-ui-overlays--hud)
- [1.7 Tile Representation & Assets](#17-tile-representation--assets)
- [1.8 Accessibility & Responsiveness](#18-accessibility--responsiveness)
- [1.9 Component Hierarchy (Technical Map for TDD)](#19-component-hierarchy-technical-map-for-tdd)
- [Summary](#summary)
- [Preparation for Test-Driven Development](#preparation-for-test-driven-development)

---

## Overview

This document defines the **visual layout and presentation layer** for the American Mahjong game interface. It establishes the spatial organization, component hierarchy, and visual feedback systems that will guide frontend implementation and test-driven development.

**Principles:**

- **Physical Authenticity:** Mimic real table experience (green felt, rack placement, tile handling)
- **Clarity Over Realism:** Prioritize legibility and usability (clear discard visibility, obvious turn indicators)
- **Responsive Scaling:** All elements scale proportionally without scrolling (fixed aspect ratio)
- **Server-Authoritative Display:** UI reflects server state; animations show state transitions, not predictions

---

## 1.1 Viewport & Camera

- **Perspective:** Top-down 2D view (bird's-eye).
- **Aspect Ratio:** Fixed landscape (16:9 optimized for desktop, adjustable constraints for tablet/mobile).
- **Background:** Texture resembling green felt or baize to mimic a physical table surface.
- **Zoom/Pan:** Not required for initial implementation (future: pinch-to-zoom for mobile accessibility).

---

## 1.2 The Wall (Game Start Configuration)

The wall is a physical entity that dictates the game flow and must be accurately rendered to support the "breaking" mechanic.

### Structure

- **Formation:** Four distinct walls arranged in a square, one per player position (East, South, West, North).
- **Tile Count:** Each wall consists of **19 stacks** of 2 tiles.
  - _Note:_ In American Mahjong, only 152 tiles are used. Use Blanks house rule adds 8 blanks - 2 per wall (20x2 vs 19x2)
- **Height:** Each stack is **double-tiered** (2 tiles high, back-facing during setup).

### State Changes

- **Intact (Pre-Break):**
  - At game start after dealing, walls form a perfect square perimeter.
  - All tiles face down (backs visible).

- **Broken (Post-Dice Roll):**
  - East rolls two dice (sum: 2-12).
  - Count from the right on East's wall to determine breaking position.
  - Break point = dice sum tiles from the right end of that wall.
  - Visual: Gap appears at break point; tiles to the right become the tail end of the wall. Tiles to the left are angled out toward the center of the play area.

- **Depleting (During Play):**
  - Tiles drawn from the live end of the wall (left of break point, proceeding counterclockwise).
  - Wall visually shrinks as stacks disappear.
  - As each edge is depleted, the next bank of tiles is angled out to the center.
  - **Wall Counter** updates (e.g., "72 tiles remaining").
  - **Wall Game Condition:** If wall depletes to zero without a winner, game ends in draw ("wall game").

---

## 1.3 The Floor (Discard Zone)

Located in the center of the table, inside the perimeter of the walls.

### Layout

- **Arrangement:** Discards are placed face-up. Unlike Japanese Mahjong (ordered rows by player), American Mahjong discards are traditionally organized in chronological rows without strict player separation.
  - **Implementation Option A (Unsorted):** Tiles appear in a flowing grid, left-to-right, wrapping to new rows, in the order they were discarded.
  - **Implementation Option B (Sorted):** Tiles appear in a flowing grid, left-to-right, wrapping to new rows, sorted by suit.

- **Legibility:** Discarded tiles must be clearly distinguishable from the wall.
  - Use border/shadow effects to separate discard zone visually.

### Call Window Interaction

- **Call Window:** When a discard is made, other players have a brief window to call the tile (Pung/Kong/Quint/Mahjong).
- **Call** the tile (Pung/Kong/Quint/Mahjong).
- **Pass** (explicitly or timeout).
- **Clickable Discards:** Only the **most recent discard** is interactive during the call window.
- **Audio Cue:** Tile name announced on discard (e.g., "Three Bam" via text-to-speech or pre-recorded audio).
- **Visual Timer:** Countdown overlay shows remaining time to call (e.g., shrinking circle around the tile).

---

## 1.4 Player Zone (User / South)

The primary interactive area at the bottom of the screen.

### The Rack (Container)

- **Sloped Ledge (Private):**
  - Holds the **concealed hand** (13 tiles normally, 14 when it's your turn after drawing).
  - Tiles are **face-up to the user** but hidden from opponents.
  - **Sorting:** Auto-sorted by suit/rank (Bams, Craks, Dots, Winds, Dragons, Flowers, Jokers) or manual rearrangement allowed.
  - **Selection Mechanic:**
    - Click/tap to select tiles (e.g., during Charleston passing or discarding).
    - Selected tiles visually raised/highlighted.

- **Flat Top (Public):** The "Exposure Area." When a user calls a Pung/Kong/Quint, the tiles move from the sloped ledge to this flat area. These tiles are locked and visible to all players.

### Action Bar

- **Dynamic UI Layer:** Floats above or adjacent to the rack.
- **Context-Sensitive Buttons:** Enabled/disabled based on game phase and turn state.
  - **Charleston Phase:** "Pass Tiles" (disabled until exactly 3 selected), "Stop Charleston" (voting button).
  - **Draw Phase:** "Discard" (after drawing), "Mahjong" (if winning hand detected).
  - **Call Window:** "Call Pung/Kong/Quint", "Mahjong" (on opponent discard), "Pass" (decline call).
  - **Special Actions:** "Exchange Joker" (when clicking opponent's exposed joker), "Undo" (if enabled in house rules).

- **Visual Feedback:**
  - Buttons glow/pulse when action available.
  - Hover tooltips explain button function (e.g., "Call Pung: Claim this tile to complete a set of 3").
  - Loading state while waiting for server response (button disabled, spinner).

---

## 1.5 Opponent Zones (East, North, West)

Located at the Right, Top, and Left of the screen relative to user's South position.

### The Rack

- **Concealed Area (Private):**
  - Displays the **backs** of the tiles only (user cannot see faces).
  - **Tile Count Visible:** Shows number of tiles (e.g., "13 tiles" text overlay or visual stack representation).
  - **Purpose:** Allows user to verify opponents aren't in "dead hand" state (incorrect tile count = rule violation).
  - **Visual Distinction:** Opponent racks slightly smaller/farther than user's rack for perspective.

- **Exposure Area (Public):**
  - Displays the **faces** of any melded sets (Pungs/Kongs/Quints) on the flat top of their rack.
  - **Layout:** Sets arranged in chronological order, clearly separated.

### Info Panel

- **Location:** Small overlay adjacent to or above opponent's rack.
- **Contents:**
  - **Player Name/Avatar:** Display name or bot indicator (e.g., "Bot - Intermediate").
  - **Wind Direction:** Prominent indicator (E/N/W/S badge).
  - **Turn Indicator:** Highlighted border or icon when it's their turn.
  - **Score/Money:** Optional (if betting enabled in house rules).
  - **Connection Status:** Indicator if player disconnected/reconnecting (multiplayer).

### Activity Indicators

- **Tile Draw Animation:** When opponent draws, show tile moving from wall to their concealed area (back-facing).
- **Discard Animation:** Tile slides from their rack to discard floor with rotation effect.
- **Thinking Timer:** Optional countdown showing remaining time for their action (configurable in settings).

---

## 1.6 UI Overlays & HUD

### Dice Overlay

- **Timing:** Appears after all players seated and East initiates setup.
- **Visual:** Two 3D dice (or stylized 2D) roll animation, landing on random values (1-6 each).
- **Sum Display:** Shows total (e.g., "East rolled 7") with brief pause before wall break animation.
- **Auto-Dismiss:** Fades after 2-3 seconds, or user clicks "Continue" button.

### Wind Indicator

- **Persistent HUD Element:** Displays current dealer and wind rotation.
- **Design Options:**
  - **Compass Rose:** Center of table showing E/S/W/N positions with "East" highlighted.
  - **Player Labels:** Each opponent info panel shows their wind assignment.
- **Dealer Indicator:** "East" position marked with special icon (e.g., dealer button chip, crown icon).
- **Round Progression:** Updates when dealer rotates after each hand.

### Charleston Tracker

- **Visibility:** Only during Charleston phase (hides when gameplay starts).
- **Components:**
  - **Progress Bar/Stepper:** Shows current step (e.g., "First Right" → "First Across" → "First Left" → "Vote Stop/Continue" → optional Second Charleston).
  - **Direction Arrows:** Animated arrows indicating pass direction (Right: →, Across: ↔, Left: ←).

### Wall Counter

- **Location:** Top-center or adjacent to wall graphic.
- **Display:** "Tiles Remaining: 72" (updates live as tiles drawn).
- **Color Coding:**
  - **Green:** >40 tiles (safe).
  - **Yellow:** 20-40 tiles (mid-game).
  - **Red:** <20 tiles (wall game imminent).
- **Critical Alert:** When wall reaches 0 without winner, display "Wall Game - No Winner" overlay.

### Additional HUD Elements

- **Game Menu Button:** Hamburger menu (top-right) for:
  - View NMJL Card (full-screen overlay).
  - Settings (audio, timer preferences).
  - Leave Game/Forfeit.
  - Game History (event log).

- **Card Viewer Toggle:** Quick-access button to show/hide NMJL card patterns overlay.

- **Event Log (Collapsible):** Side panel or bottom ticker showing recent actions:
  - "East drew a tile"
  - "South discarded 5 Crak"
  - "West called Pung (3 Green Dragons)"

- **Hint Panel (Optional AI Assist):** If AI assistance enabled:
  - Shows "1 away from [Pattern Name]" messages.
  - Suggests optimal discard (toggle on/off in settings).
  - Verbosity levels: Beginner / Intermediate / Expert

---

## 1.7 Tile Representation & Assets

### Tile Design

- **Size:** Tiles scale proportionally to viewport (approximately 50-70px width in 1920×1080).
- **Face Design:**
  - Traditional Chinese characters for numbers (一二三 for 1-2-3) or simplified Arabic numerals (user preference).
  - Clear suit iconography: Bamboo sticks (Bam), Chinese coins (Crak), Dots/circles (Dot).
  - High-contrast colors for accessibility (especially for color-blind modes).

- **Back Design:** Consistent pattern (e.g., dragon motif, geometric design) to indicate face-down tiles.

- **Joker Design:** Distinctive rainbow/multicolor pattern. No specific suit/rank iconography.

- **Special Tiles:**
  - **Flowers:** Floral artwork (typically 4 unique designs in physical sets, but game treats all as identical).
  - **White Dragon (Soap):** Blank face or subtle frame (represents '0' in year patterns like "2025").

### Tile States & Visual Feedback

| State                           | Visual Treatment                                                     |
| ------------------------------- | -------------------------------------------------------------------- |
| **Normal**                      | Standard rendering, slight 3D bevel effect                           |
| **Selected**                    | Raised 10px, bright border (yellow/cyan)                             |
| **Locked (Exposed)**            | Grayed border, no hover effect                                       |
| **Hovered**                     | Subtle glow, cursor changes to pointer                               |
| **Disabled (Joker can't pass)** | Red tint/diagonal strike-through during Charleston                   |
| **Newly Drawn**                 | Pulsing highlight for 2-3 seconds, positioned slightly right of hand |
| **Discarded**                   | Slight rotation (random 5-15°) for realism                           |
| **Called Tile**                 | Bright highlight on discard floor during call window                 |

### Animation Transitions

- **Draw:** Tile slides from wall to player rack (0.3-0.5s ease-out).
- **Discard:** Tile flips and slides to discard floor (0.4s with rotation).
- **Pass (Charleston):** Tiles "shuffle" between players with directional arrows (0.6s).
- **Call (Exposure):** Tiles slide from player's concealed area + discard floor to exposure area simultaneously (0.5s).
- **Joker Exchange:** Joker swaps position with replacement tile (0.4s crossfade).

---

## 1.8 Accessibility & Responsiveness

### Responsive Breakpoints

- **Desktop (1920×1080+):** Full layout as described, all elements visible.
- **Laptop (1366×768):** Slightly condensed rack sizes, smaller HUD elements.
- **Tablet (1024×768):** Simplified opponent info panels, collapsible event log.
- **Mobile (not primary target):** Portrait mode discouraged; landscape-only with minimal HUD, tap-optimized controls.

### Accessibility Features

- **Color-Blind Modes:**
  - Pattern/texture overlays on tiles (not just color).
  - High-contrast mode option.

- **Screen Reader Support:**
  - ARIA labels for all interactive elements.
  - Announce tile names on selection/discard.

- **Keyboard Navigation:**
  - Arrow keys to navigate hand.
  - Number keys (1-9) to quick-select tiles by index.
  - Spacebar to confirm action, Escape to cancel.

- **Adjustable Font Sizes:** UI scales for HUD text (player names, scores, timers).

- **Reduced Motion:** Option to disable/simplify animations for users sensitive to motion.

---

## 1.9 Component Hierarchy (Technical Map for TDD)

This hierarchy maps visual elements to React components (or equivalent framework):

````text
<GameTable>
  ├── <Background />                    // Felt texture, fixed aspect ratio container
  ├── <Wall>
  │   ├── <WallSection position="east" />
  │   ├── <WallSection position="north" />
  │   ├── <WallSection position="west" />
  │   └── <WallSection position="south" />
  ├── <DiscardFloor>
  │   └── <DiscardedTile>[]
  ├── <PlayerRack position="south" isUser={true}>
  │   ├── <ConcealedHand>
  │   │   └── <Tile>[]
  │   ├── <ExposureArea>
  │   │   └── <MeldedSet>[]
  │   └── <ActionBar>
  │       ├── <PassTilesButton />
  │       ├── <DiscardButton />
  │       ├── <CallButton />
  │       └── <MahjongButton />
  ├── <OpponentRack position="east|north|west">
  │   ├── <ConcealedArea tileCount={13} />
  │   ├── <ExposureArea>
  │   └── <InfoPanel>
  ├── <HUD>
  │   ├── <DiceOverlay />
  │   ├── <WindIndicator />
  │   ├── <CharlestonTracker />
  │   ├── <WallCounter />
  │   ├── <GameMenu />
  │   ├── <CardViewer />
  │   └── <EventLog />
  └── <Overlays>
      ├── <JokerExchangeDialog />
      ├── <WinnerAnnouncement />
      └── <CourtesyPassNegotiation />
```text

**Testing Strategy (Preview for Later Sections):**

- **Unit Tests:** Individual components (e.g., `<Tile>` rendering, `<ActionBar>` button enable/disable logic).
- **Integration Tests:** Component interactions (e.g., selecting tiles updates `<ActionBar>` state).
- **Visual Regression Tests:** Snapshot testing for layout consistency across breakpoints.
- **E2E Tests:** Full game flows (Charleston → Draw → Discard → Call → Win).

---

## Summary

This visual layout establishes the **spatial foundation** for the game. Key design decisions:

1. **Physical Metaphor:** Top-down table view with authentic rack/wall/discard placement.
2. **Clarity First:** Prioritize functional visibility over photorealism (clear call windows, highlighted discards).
3. **Component Modularity:** Each visual element maps to a testable component (rack, tile, action bar).
4. **Animation as Feedback:** Tile movements communicate game state changes (draw, discard, pass, call).

**Next Section:** Section 2 will define **User Stories & Interaction Flows** (the deal, Charleston mechanics, gameplay loop, calling tiles, joker exchange, win conditions)—the behavioral layer that brings this layout to life.

---

## Preparation for Test-Driven Development

Before writing tests, ensure:

1. **Backend API Contract Defined:** Know exact WebSocket message formats (commands/events from `mahjong_core`).
2. **Type Bindings Generated:** Run `cargo test export_bindings` to sync Rust types to TypeScript.
3. **Component Specs Written:** For each component in hierarchy, define props, state, and expected behaviors.
4. **Mock Data Prepared:** Sample game states (hands, wall states, discard piles) for testing without backend.

```text

```text
````
