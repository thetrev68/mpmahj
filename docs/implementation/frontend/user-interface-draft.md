# Specifications for an American Mahjong Interface

Organized by game phase

## 1. Visual Layout Specifications (The "Table")

The interface should mimic a 2D top-down or slight perspective view of a square table.

- **The Viewport:** Fixed aspect ratio (landscape). Background texture resembles green felt or baize.
- **Player Zone (South/User):** The largest, interactive area at the bottom.
- **Rack:** Holds 13-14 tiles on a sloped ledge (faces user).
- **Exposure Area:** Flat area in front of the rack for melded sets (Pungs, Kongs, Quints).

- **Opponent Zones (East, North, West):**
- **Rack:** Visible back of tiles (count only).
- **Exposure Area:** Visible faces of melded sets (crucial for defensive play).

- **The "Wall":** Central area where tiles are drawn from (can be abstracted or literal).
- **The "Floor" (Discards):** Center-most area where discarded tiles are placed randomly or in disorganized rows (American style usually has messier discards than Japanese/Riichi).

---

## 2. High-Level User Stories

### Phase A: The Setup & Charleston

_Unique to American Mahjong, this requires complex tile selection mechanics._

- **Story 1: The Deal**
- **As a** player,
- **I want** to see my starting 13 tiles sorted loosely by suit/rank,
- **So that** I can assess my hand against the NMJL card.

- **Story 2: Passing Tiles (The Charleston)**
- **As a** player during the Charleston phase,
- **I want** to select exactly 3 tiles and click a "Pass" button,
- **So that** I can exchange tiles with my neighbors.
- _Constraint:_ The "Pass" button must be disabled unless exactly 3 tiles are selected.
- _Constraint:_ I must receive visual feedback on which direction the pass is going (Right, Over, Left).

- **Story 3: Courtesy Pass**
- **As a** player at the end of the Charleston,
- **I want** to agree with the opposite player to pass 0-3 tiles,
- **So that** I can finalize my hand before play starts.

### Phase B: The Gameplay Loop

- **Story 4: Drawing a Tile**
- **As a** player on my turn,
- **I want** a new tile to appear visually distinct (gap or raised) from my hand,
- **So that** I know which tile is the "new" draw.

- **Story 5: Discarding**
- **As a** player,
- **I want** to drag a tile to the center or double-click it,
- **So that** I can end my turn.
- _Audio/Visual:_ The tile name should be announced (text or audio) upon discard (e.g., "3 Bam").

- **Story 6: Calling a Tile**
- **As a** player when an opponent discards a tile I need,
- **I want** a prominent "Call" button (with options for Pung/Kong/Quint) to appear for a limited time,
- **So that** I can claim the tile.

### Phase C: Joker Mechanics

- **Story 7: Joker Exchange**
- **As a** player,
- **I want** to click an exposed Joker in an opponent's rack and replace it with the actual matching tile from my hand,
- **So that** I can claim the Joker for my own use.

---

## 3. Component Breakdown (For TDD)

Based on the stories above, here are the key components you will need to build and test:

| Component          | Responsibility                                                                       | Key Props/State                                      |
| ------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **`HandRack`**     | Displays user's concealed tiles. Handles selection logic (click to select/deselect). | `tiles[]`, `selectedTileIds[]`, `maxSelection`       |
| **`OpponentRack`** | Displays opponent back-of-tiles and name.                                            | `tileCount`, `position` (N/E/W), `isActive`          |
| **`ExposureZone`** | Displays specific sets (e.g., 3 Dragons) face up.                                    | `sets[]` (e.g., `{ tiles: [], type: 'Pung' }`)       |
| **`ActionPanel`**  | Context-aware buttons (Pass, Ignore, Mahjong).                                       | `phase` ('Charleston', 'Draw', 'Discard'), `canCall` |
| **`DiscardFloor`** | Renders all discarded tiles in the center.                                           | `discards[]`, `lastDiscardId` (highlighted)          |
| **`Tile`**         | Visual representation of a single unit.                                              | `suit`, `value`, `isJoker`, `isHovered`              |

---

## 4. Technical "plain language" requirements

1. **Responsiveness:** The game board must scale to fit the browser window without scrolling.
2. **Animations:** Tiles must "slide" from hand to discard pile (CSS transitions), not instantly teleport, to help players track game flow.
3. **State Sync:** The UI must block interactions (loading state) while waiting for the Rust backend to confirm a move.
