# Frontend Alignment Report: Mockup vs. Current Implementation

This report compares the current React frontend implementation against the design specified in `docs/implementation/frontend/component-specs/mahjong-ui-mockup.html`.

## 1. Visual Match (Aligned)

| Element | Status | Technical Detail |
| :--- | :--- | :--- |
| **Table Surface** | ✅ Matched | Gradient `from-green-800 to-green-900` matches mockup aesthetic. |
| **Wall Placement** | ✅ Matched | `Wall.tsx` uses exact percentages from mockup (e.g., East at `right: 12%`). |
| **Tile Assets** | ✅ Matched | `TileImage.tsx` correctly references the `_clear.svg` assets. |
| **Charleston Tracker** | ✅ Matched | Positioned at `top-[105px]` with the same translucent dark theme. |
| **Player Rack (South)** | ✅ Matched | Fixed at the bottom center. |

## 2. Gaps & Discrepancies (To be Addressed)

### A. Opponent Racks (East, West, North)

* **Mockup:** Shows a distinct area for each opponent containing player name, Wind (e.g., "Bot - Easy [E]"), remaining tile count, and **backside tiles** representing their concealed hand.
* **Current:** Only shows `ExposedMeldsArea` if they have melds. Their concealed hands and identity info are invisible.

### B. HUD & Navigation

* **Mockup:** Includes a permanent **Wind Compass** in the top-right and a **Menu/Wall Counter** in the top-left.
* **Current:** Uses a floating `TurnIndicator` badge that only appears for the active player. There is no persistent view of which seat belongs to which player/bot.

### C. Discard Floor Aesthetic

* **Mockup:** Features a "Discard Floor" (translucent background) with tiles that have slight random rotations (`-5deg` to `+5deg`) and a `flex-wrap` layout.
* **Current:** `DiscardPool.tsx` uses a rigid `grid-cols-6` layout with no background and no rotation.

### D. Tile Rotation

* **Mockup:** Opponent tiles are rotated to face the center of the table (East rotated 270°, West 90°, North 180°).
* **Current:** Tiles are always rendered upright (except for specific "called" tiles in a meld).

## 3. Architectural Observations

* **Refactoring in Progress:** `GameBoard.tsx` is currently using feature flags (`USE_CHARLESTON_PHASE_COMPONENT`, `USE_PLAYING_PHASE_COMPONENT`).
* **Tailwind Implementation:** The implementation successfully translates the mockup's raw CSS to Tailwind utility classes (`fixed`, `-translate-x-1/2`, etc.).

---

## Recommendations for Alignment

1. **New `OpponentRack` Component:** Create a wrapper that combines `ExposedMeldsArea` with a new `ConcealedHand` (backside mode) and a `PlayerInfo` badge.
2. **HUD Consolidation:** Add a `WindCompass` component to `GameBoard.tsx` that stays visible regardless of whose turn it is.
3. **Discard Refinement:** Update `DiscardPool.tsx` to include the `bg-black/15` floor and apply a small random `rotate` transform to discarded tiles.
4. **Layout Orchestration:** Update `PlayingPhase.tsx` to render all 4 racks (South as the interactive hand, others as info/backsides).
