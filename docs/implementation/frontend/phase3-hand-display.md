# Phase 3: Hand Display - Implementation Guide

## Overview

Build the **HandDisplay** component to display and interact with the player's hand:

- Display your 14 tiles (concealed hand)
- Tile selection for discarding and Charleston passes
- Sort controls (By Suit / By Rank)
- Exposed melds display (Pungs, Kongs, Quints)
- Visual indicators for selected tiles

This component provides the core tile interaction needed for gameplay.

---

## Quick Reference

### Type Definitions

```typescript
// From generated bindings
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { MeldType } from '@/types/bindings/generated/MeldType';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';

// Tile: number (0-36)
// Mapping:
// - 0-8:   Bams (1-9)
// - 9-17:  Cracks (1-9)
// - 18-26: Dots (1-9)
// - 27-30: Winds (East, South, West, North)
// - 31-33: Dragons (Green, Red, White/Soap)
// - 34:    Flower
// - 35:    Joker
// - 36:    Blank (House Rule)

// MeldType: "Pung" | "Kong" | "Quint" | "Sextet"

// Meld structure
interface Meld {
  meld_type: MeldType;
  tiles: Tile[];
  called_tile: Tile | null;
  joker_assignments: Record<number, Tile>;  // position -> actual tile
}
```

### Store Structures

#### gameStore (read-only for this component)

```typescript
// From apps/client/src/store/gameStore.ts
interface GameState {
  yourHand: Tile[];              // Your concealed tiles (0-14 tiles)
  yourSeat: Seat | null;         // Your assigned seat
  players: Record<Seat, PublicPlayerInfo>;  // All players including your exposed melds
  // ... other game state
}

// Access methods
const yourHand = useGameStore((state) => state.yourHand);
const yourSeat = useGameStore((state) => state.yourSeat);
const players = useGameStore((state) => state.players);
```

#### uiStore (for tile selection and sorting)

```typescript
// From apps/client/src/store/uiStore.ts
interface UIState {
  selectedTiles: Set<string>;    // Set of tile keys ("tile-5-0", "tile-12-1")
  sortingMode: 'suit' | 'rank';  // Current sorting preference

  toggleTileSelection: (key: string) => void;
  clearSelection: () => void;
  selectTiles: (keys: string[]) => void;
  isSelected: (key: string) => boolean;
  setSortingMode: (mode: 'suit' | 'rank') => void;
}

// Usage
const selectedTiles = useUIStore((state) => state.selectedTiles);
const sortingMode = useUIStore((state) => state.sortingMode);
const toggleTileSelection = useUIStore((state) => state.toggleTileSelection);
const isSelected = useUIStore((state) => state.isSelected);
const setSortingMode = useUIStore((state) => state.setSortingMode);
```

### Tile Key Format

Tiles need unique keys for selection tracking:

```typescript
// Format: "tile-{tileValue}-{handIndex}"
// tileValue: tile index (0-36)
// handIndex: position in hand (0-13)

// Example: First tile in hand is a 3 Bam (index 2)
const tileKey = `tile-2-0`;

// Example: Third tile in hand is a Joker (index 35)
const tileKey = `tile-35-2`;
```

Use the existing helpers in `apps/client/src/utils/tileKey.ts`:

```typescript
import { tileKey, parseTileKey } from '@/utils/tileKey';
```

This format ensures:

- Uniqueness even with duplicate tiles
- Easy extraction of both position and tile value
- Stable keys across sorting

---

## Component Specification

### File Location

`apps/client/src/components/HandDisplay.tsx`

### Component Interface

```typescript
interface HandDisplayProps {
  // No props needed - reads from stores directly
}

export function HandDisplay(): JSX.Element;
```

### Visual Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ YOUR HAND                                    [Suit] [Rank]  │
│                                                              │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│ │ 1B │ │ 2B │ │ 3B │ │ 1C │ │ 2C │ │ 5D │ │ E  │ │ RD │   │
│ │ 0  │ │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │ │ 7  │   │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘   │
│                                                              │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                 │
│ │ WD │ │ F  │ │ J  │ │ J  │ │ 3C │ │ 7B │                 │
│ │ 8  │ │ 9  │ │ 10 │ │ 11 │ │ 12 │ │ 13 │                 │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                 │
│                                                              │
│ Selected: 3B (2), 1C (3), 2C (4)             [Clear]        │
│                                                              │
│ EXPOSED MELDS                                                │
│ Pung: [3D 3D 3D] (called from East)                         │
│ Kong: [J→5B 5B 5B 5B] (called from South)                   │
└─────────────────────────────────────────────────────────────┘

Legend:
- Blue border = Selected tile
- Index label = Position in hand (0-13)
- Short codes: 1B = 1 Bam, RD = Red Dragon, E = East Wind, etc.
```

---

## Implementation Details

### Tile Formatting Utility

Create the tile formatter before building the component.

**File**: `apps/client/src/utils/tileFormatter.ts`

**Full Implementation**:

```typescript
import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * Convert Tile index (0-36) to human-readable full name.
 *
 * Ported from mahjong_core/src/tile.rs:display_name()
 *
 * @param tile - Tile index (0-36)
 * @returns Full tile name (e.g., "3 Bam", "Red Dragon", "Joker")
 *
 * @example
 * tileToString(2)  // "3 Bam"
 * tileToString(27) // "East Wind"
 * tileToString(32) // "Red Dragon"
 * tileToString(35) // "Joker"
 */
export function tileToString(tile: Tile): string {
  // Bams: 0-8
  if (tile >= 0 && tile <= 8) {
    return `${tile + 1} Bam`;
  }

  // Cracks: 9-17
  if (tile >= 9 && tile <= 17) {
    return `${tile - 9 + 1} Crack`;
  }

  // Dots: 18-26
  if (tile >= 18 && tile <= 26) {
    return `${tile - 18 + 1} Dot`;
  }

  // Winds: 27-30
  switch (tile) {
    case 27:
      return 'East Wind';
    case 28:
      return 'South Wind';
    case 29:
      return 'West Wind';
    case 30:
      return 'North Wind';
  }

  // Dragons: 31-33
  switch (tile) {
    case 31:
      return 'Green Dragon';
    case 32:
      return 'Red Dragon';
    case 33:
      return 'White Dragon (Soap)';
  }

  // Special tiles: 34-36
  switch (tile) {
    case 34:
      return 'Flower';
    case 35:
      return 'Joker';
    case 36:
      return 'Blank';
  }

  return 'Unknown Tile';
}

/**
 * Convert Tile to short display code for compact UI.
 *
 * @param tile - Tile index (0-36)
 * @returns Short code (e.g., "3B", "RD", "E", "J")
 *
 * @example
 * tileToCode(2)  // "3B"
 * tileToCode(27) // "E"
 * tileToCode(32) // "RD"
 * tileToCode(35) // "J"
 */
export function tileToCode(tile: Tile): string {
  // Bams: 0-8 → "1B" - "9B"
  if (tile >= 0 && tile <= 8) {
    return `${tile + 1}B`;
  }

  // Cracks: 9-17 → "1C" - "9C"
  if (tile >= 9 && tile <= 17) {
    return `${tile - 9 + 1}C`;
  }

  // Dots: 18-26 → "1D" - "9D"
  if (tile >= 18 && tile <= 26) {
    return `${tile - 18 + 1}D`;
  }

  // Winds: 27-30 → "E", "S", "W", "N"
  switch (tile) {
    case 27:
      return 'E';
    case 28:
      return 'S';
    case 29:
      return 'W';
    case 30:
      return 'N';
  }

  // Dragons: 31-33 → "GD", "RD", "WD"
  switch (tile) {
    case 31:
      return 'GD';
    case 32:
      return 'RD';
    case 33:
      return 'WD';
  }

  // Special: 34-36 → "F", "J", "BL"
  switch (tile) {
    case 34:
      return 'F';
    case 35:
      return 'J';
    case 36:
      return 'BL';
  }

  return '?';
}

/**
 * Sort tiles by suit order.
 *
 * Order: Flowers → Bams → Cracks → Dots → Dragons → Winds → Jokers → Blanks
 *
 * @param tiles - Array of tile indices
 * @returns Sorted array (does not mutate original)
 */
export function sortBySuit(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareBySuit);
}

/**
 * Sort tiles by rank order.
 *
 * Order: 1s → 2s → 3s → ... → 9s → Flowers → Dragons → Winds → Jokers → Blanks
 *
 * @param tiles - Array of tile indices
 * @returns Sorted array (does not mutate original)
 */
export function sortByRank(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareByRank);
}

/**
 * Compare two tiles by suit order.
 */
export function compareBySuit(a: Tile, b: Tile): number {
  const orderA = getSuitOrder(a);
  const orderB = getSuitOrder(b);

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a - b;
}

/**
 * Compare two tiles by rank order.
 */
export function compareByRank(a: Tile, b: Tile): number {
  const rankA = getRankOrder(a);
  const rankB = getRankOrder(b);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  // Same rank: sort by suit (Bam < Crack < Dot)
  return getSuitOrder(a) - getSuitOrder(b);
}

/**
 * Get suit order for sorting (lower = earlier).
 *
 * Order: Flowers(0) → Bams(1) → Cracks(2) → Dots(3) → Dragons(4) → Winds(5) → Jokers(6) → Blanks(7)
 */
function getSuitOrder(tile: Tile): number {
  if (tile === 34) return 0; // Flower
  if (tile >= 0 && tile <= 8) return 1; // Bams
  if (tile >= 9 && tile <= 17) return 2; // Cracks
  if (tile >= 18 && tile <= 26) return 3; // Dots
  if (tile >= 31 && tile <= 33) return 4; // Dragons
  if (tile >= 27 && tile <= 30) return 5; // Winds
  if (tile === 35) return 6; // Joker
  if (tile === 36) return 7; // Blank
  return 999; // Unknown
}

/**
 * Get rank order for sorting (lower = earlier).
 *
 * Suited tiles: rank 1-9
 * Flowers: 10
 * Dragons: 11
 * Winds: 12
 * Jokers: 13
 * Blanks: 14
 */
function getRankOrder(tile: Tile): number {
  // Suited tiles: use rank (1-9)
  if (tile >= 0 && tile <= 26) {
    return (tile % 9) + 1;
  }

  // Non-suited tiles
  if (tile === 34) return 10; // Flower
  if (tile >= 31 && tile <= 33) return 11; // Dragons
  if (tile >= 27 && tile <= 30) return 12; // Winds
  if (tile === 35) return 13; // Joker
  if (tile === 36) return 14; // Blank

  return 999; // Unknown
}
```

---

### Concealed Hand Display

**Requirements:**

- Display all tiles in `yourHand` array (0-14 tiles)
- Show as clickable buttons with tile code and index
- Apply selected styling (blue border) when clicked
- Generate stable tile keys for selection tracking
- Apply current sorting mode

**Example Component Section:**

```typescript
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { tileToCode, compareBySuit, compareByRank } from '@/utils/tileFormatter';
import { tileKey } from '@/utils/tileKey';

function ConcealedHand() {
  const yourHand = useGameStore((state) => state.yourHand);
  const sortingMode = useUIStore((state) => state.sortingMode);
  const toggleTileSelection = useUIStore((state) => state.toggleTileSelection);
  const isSelected = useUIStore((state) => state.isSelected);

  const tilesWithKeys = yourHand.map((tile, index) => ({
    tile,
    index,
    key: tileKey(tile, index),
  }));

  const sortedTiles = [...tilesWithKeys].sort((a, b) =>
    sortingMode === 'suit' ? compareBySuit(a.tile, b.tile) : compareByRank(a.tile, b.tile)
  );

  const handleTileClick = (key: string) => {
    toggleTileSelection(key);
  };

  return (
    <div className="concealed-hand">
      <div className="tiles-grid">
        {sortedTiles.map(({ tile, index, key }) => {
          const selected = isSelected(key);
          const displayCode = tileToCode(tile);

          return (
            <button
              key={key}
              className={`tile-button ${selected ? 'selected' : ''}`}
              onClick={() => handleTileClick(key)}
            >
              <span className="tile-code">{displayCode}</span>
              <span className="tile-index">{index}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

---

### Sort Controls

**Requirements:**

- Two buttons: "By Suit" and "By Rank"
- Active button highlighted
- Changes sorting mode in uiStore
- Re-renders hand with new sort order

**Example:**

```typescript
function SortControls() {
  const sortingMode = useUIStore((state) => state.sortingMode);
  const setSortingMode = useUIStore((state) => state.setSortingMode);

  return (
    <div className="sort-controls">
      <span className="sort-label">Sort:</span>
      <button
        className={`sort-button ${sortingMode === 'suit' ? 'active' : ''}`}
        onClick={() => setSortingMode('suit')}
      >
        By Suit
      </button>
      <button
        className={`sort-button ${sortingMode === 'rank' ? 'active' : ''}`}
        onClick={() => setSortingMode('rank')}
      >
        By Rank
      </button>
    </div>
  );
}
```

---

### Selection Display

**Requirements:**

- Show list of currently selected tiles
- Display tile name and hand index
- "Clear Selection" button
- Hidden when no tiles selected

**Example:**

```typescript
import { tileToString } from '@/utils/tileFormatter';
import { parseTileKey } from '@/utils/tileKey';

function SelectionDisplay() {
  const yourHand = useGameStore((state) => state.yourHand);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);

  if (selectedTiles.size === 0) return null;

  // Parse selected tile keys to get tile info
  const selectedInfo = Array.from(selectedTiles)
    .map((key) => {
      const parsed = parseTileKey(key);
      if (!parsed) return null;
      return { index: parsed.index, tile: parsed.tile, name: tileToString(parsed.tile) };
    })
    .filter((entry): entry is { index: number; tile: number; name: string } => entry !== null);

  // Sort by index
  selectedInfo.sort((a, b) => a.index - b.index);

  return (
    <div className="selection-display">
      <span className="selection-label">Selected:</span>
      <span className="selection-list">
        {selectedInfo.map(({ index, name }) => `${name} (${index})`).join(', ')}
      </span>
      <button className="clear-button" onClick={clearSelection}>
        Clear
      </button>
    </div>
  );
}
```

---

### Exposed Melds Display

**Requirements:**

- Show your exposed melds (from `players[yourSeat].exposed_melds`)
- Display meld type (Pung, Kong, Quint, Sextet)
- Show all tiles in meld with codes
- Indicate jokers with "J→{actualTile}" format
- Show which tile was called (if any)
- Display who you called from (discarded_by)

**Meld Formatting Helper:**

```typescript
import type { Meld } from '@/types/bindings/generated/Meld';
import { tileToCode } from '@/utils/tileFormatter';

/**
 * Format a meld for display.
 *
 * @param meld - The meld to format
 * @returns Formatted string like "Pung: [3B 3B 3B]" or "Kong: [J→5D 5D 5D 5D]"
 */
export function formatMeld(meld: Meld): string {
  const tileStrings = meld.tiles.map((tile, index) => {
    // Check if this position has a joker assignment
    const actualTile = meld.joker_assignments[index];
    if (actualTile !== undefined) {
      // This is a joker representing actualTile
      return `J→${tileToCode(actualTile)}`;
    }
    return tileToCode(tile);
  });

  const tilesDisplay = tileStrings.join(' ');
  return `${meld.meld_type}: [${tilesDisplay}]`;
}
```

**Component Section:**

```typescript
import { formatMeld } from '@/utils/tileFormatter';

function ExposedMelds() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const players = useGameStore((state) => state.players);

  if (!yourSeat) return null;

  const yourInfo = players[yourSeat];
  if (!yourInfo || yourInfo.exposed_melds.length === 0) {
    return null;
  }

  return (
    <div className="exposed-melds">
      <h3>Exposed Melds</h3>
      <div className="melds-list">
        {yourInfo.exposed_melds.map((meld, index) => {
          const meldDisplay = formatMeld(meld);
          const calledInfo = meld.called_tile
            ? ' (called)'
            : '';

          return (
            <div key={index} className="meld-item">
              {meldDisplay}{calledInfo}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Complete Component Example

**File**: `apps/client/src/components/HandDisplay.tsx`

```typescript
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { tileToCode, tileToString, compareBySuit, compareByRank, formatMeld } from '@/utils/tileFormatter';
import { tileKey, parseTileKey } from '@/utils/tileKey';
import type { Tile } from '@/types/bindings/generated/Tile';
import './HandDisplay.css';

export function HandDisplay() {
  // Game state
  const yourHand = useGameStore((state) => state.yourHand);
  const yourSeat = useGameStore((state) => state.yourSeat);
  const players = useGameStore((state) => state.players);

  // UI state
  const sortingMode = useUIStore((state) => state.sortingMode);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const toggleTileSelection = useUIStore((state) => state.toggleTileSelection);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const isSelected = useUIStore((state) => state.isSelected);
  const setSortingMode = useUIStore((state) => state.setSortingMode);

  // No hand to display
  if (yourHand.length === 0) {
    return (
      <div className="hand-display">
        <div className="hand-header">
          <h2>Your Hand</h2>
        </div>
        <div className="hand-empty">
          <p>Waiting for tiles to be dealt...</p>
        </div>
      </div>
    );
  }

  const tilesWithKeys = yourHand.map((tile, index) => ({
    tile,
    index,
    key: tileKey(tile, index),
  }));

  const sortedTiles = [...tilesWithKeys].sort((a, b) =>
    sortingMode === 'suit' ? compareBySuit(a.tile, b.tile) : compareByRank(a.tile, b.tile)
  );

  // Handle tile click
  const handleTileClick = (key: string) => {
    toggleTileSelection(key);
  };

  // Get exposed melds
  const yourInfo = yourSeat ? players[yourSeat] : null;
  const exposedMelds = yourInfo?.exposed_melds || [];

  // Parse selected tiles for display
  const selectedInfo = Array.from(selectedTiles)
    .map((key) => {
      const parsed = parseTileKey(key);
      if (!parsed) return null;
      return { index: parsed.index, tile: parsed.tile, name: tileToString(parsed.tile) };
    })
    .filter((entry): entry is { index: number; tile: number; name: string } => entry !== null)
    .sort((a, b) => a.index - b.index);

  return (
    <div className="hand-display">
      {/* Header with sort controls */}
      <div className="hand-header">
        <h2>Your Hand</h2>
        <div className="sort-controls">
          <span className="sort-label">Sort:</span>
          <button
            className={`sort-button ${sortingMode === 'suit' ? 'active' : ''}`}
            onClick={() => setSortingMode('suit')}
          >
            By Suit
          </button>
          <button
            className={`sort-button ${sortingMode === 'rank' ? 'active' : ''}`}
            onClick={() => setSortingMode('rank')}
          >
            By Rank
          </button>
        </div>
      </div>

      {/* Concealed tiles */}
      <div className="concealed-hand">
        <div className="tiles-grid">
          {sortedTiles.map(({ tile, index, key }) => {
            const selected = isSelected(key);
            const displayCode = tileToCode(tile);

            return (
              <button
                key={key}
                className={`tile-button ${selected ? 'selected' : ''}`}
                onClick={() => handleTileClick(key)}
                title={tileToString(tile)}
              >
                <span className="tile-code">{displayCode}</span>
                <span className="tile-index">{index}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection display */}
      {selectedInfo.length > 0 && (
        <div className="selection-display">
          <span className="selection-label">Selected:</span>
          <span className="selection-list">
            {selectedInfo.map(({ index, name }) => `${name} (${index})`).join(', ')}
          </span>
          <button className="clear-button" onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}

      {/* Exposed melds */}
      {exposedMelds.length > 0 && (
        <div className="exposed-melds">
          <h3>Exposed Melds</h3>
          <div className="melds-list">
            {exposedMelds.map((meld, index) => {
              const meldDisplay = formatMeld(meld);
              const calledInfo = meld.called_tile ? ' (called)' : '';

              return (
                <div key={index} className="meld-item">
                  {meldDisplay}{calledInfo}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Styling Guidelines

**File**: `apps/client/src/components/HandDisplay.css`

```css
.hand-display {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
}

/* Header */
.hand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.hand-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

/* Sort Controls */
.sort-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.sort-label {
  font-weight: 600;
  color: #555;
}

.sort-button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #ccc;
  background-color: white;
  color: #333;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.sort-button:hover {
  background-color: #f0f0f0;
}

.sort-button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

/* Concealed Hand */
.concealed-hand {
  margin-bottom: 1rem;
}

.tiles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Tile Button */
.tile-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 80px;
  padding: 0.5rem;
  border: 2px solid #999;
  background-color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: monospace;
}

.tile-button:hover {
  background-color: #f5f5f5;
  border-color: #666;
  transform: translateY(-2px);
}

.tile-button.selected {
  border-color: #007bff;
  border-width: 3px;
  background-color: #e7f3ff;
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.4);
}

.tile-code {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.25rem;
}

.tile-index {
  font-size: 0.75rem;
  color: #666;
}

/* Empty State */
.hand-empty {
  padding: 2rem;
  text-align: center;
  color: #999;
  font-style: italic;
}

/* Selection Display */
.selection-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  background-color: #e7f3ff;
  border: 1px solid #007bff;
  border-radius: 4px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.selection-label {
  font-weight: 600;
  color: #0056b3;
}

.selection-list {
  flex: 1;
  color: #333;
  font-family: monospace;
}

.clear-button {
  padding: 0.4rem 0.8rem;
  border: 1px solid #dc3545;
  background-color: #dc3545;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.clear-button:hover {
  background-color: #c82333;
}

/* Exposed Melds */
.exposed-melds {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #ddd;
}

.exposed-melds h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.2rem;
  color: #333;
}

.melds-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meld-item {
  padding: 0.5rem;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 1rem;
  color: #333;
}
```

---

## Testing Checklist

### Tile Display

- [ ] All 37 tile types display correctly (0-36)
- [ ] Tile codes match expected format (1B-9B, 1C-9C, 1D-9D, E/S/W/N, GD/RD/WD, F, J, BL)
- [ ] Full names show in tooltip on hover
- [ ] Empty hand shows "Waiting for tiles..." message
- [ ] Hand displays 13 or 14 tiles after deal (seat-dependent)
- [ ] Hand displays 14 tiles after drawing

### Tile Selection

- [ ] Clicking tile toggles selection (blue border appears/disappears)
- [ ] Multiple tiles can be selected simultaneously
- [ ] Selected tiles list shows correct tile names and indices
- [ ] "Clear" button clears all selections
- [ ] Selection persists when sorting changes
- [ ] Tile keys are stable (no re-selection on re-render)

### Sorting

- [ ] "By Suit" button activates suit sorting
- [ ] "By Rank" button activates rank sorting
- [ ] Suit order: Flowers → Bams → Cracks → Dots → Dragons → Winds → Jokers → Blanks
- [ ] Rank order: 1s → 2s → ... → 9s → Flowers → Dragons → Winds → Jokers → Blanks
- [ ] Within same rank, suits ordered: Bam → Crack → Dot
- [ ] Sort mode persists across renders
- [ ] Active sort button is highlighted

### Exposed Melds

- [ ] Exposed melds section hidden when no melds
- [ ] Exposed melds section appears after calling
- [ ] Meld type displays correctly (Pung, Kong, Quint, Sextet)
- [ ] All tiles in meld display with correct codes
- [ ] Joker assignments show as "J→{tile}" format
- [ ] Called melds show "(called)" indicator
- [ ] Multiple melds stack vertically

### Edge Cases

- [ ] Duplicate tiles display with different keys (e.g., two 3 Bams)
- [ ] 14th tile (drawn tile) displays correctly
- [ ] Jokers (35) display as "J"
- [ ] Flowers (34) display as "F"
- [ ] Blank tiles (36) display as "BL" (if house rules enabled)
- [ ] Hand updates immediately when tiles received via events
- [ ] Hand updates immediately when tiles removed (discard, charleston)

### Integration

- [ ] Hand updates when `TilesDealt` event received
- [ ] Hand updates when `TileDrawnPrivate` event received
- [ ] Hand updates when `TileDiscarded` event sent
- [ ] Hand updates when `TileCalled` event received
- [ ] Hand updates when `TilesPassed` event received (Charleston)
- [ ] Hand updates when `TilesReceived` event received (Charleston)
- [ ] Exposed melds update when `TileCalled` event received
- [ ] Joker exchange updates meld display correctly

---

## Integration with App.tsx

Update `apps/client/src/App.tsx` to include HandDisplay:

```typescript
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { GameStatus } from '@/components/GameStatus';
import { HandDisplay } from '@/components/HandDisplay';
import { useGameStore } from '@/store/gameStore';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);

  return (
    <div className="app-container">
      <header>
        <h1>Mahjong Client</h1>
      </header>

      <main>
        {/* Always show ConnectionPanel */}
        <ConnectionPanel />

        {/* Show GameStatus when in a room */}
        {yourSeat && <GameStatus />}

        {/* Show HandDisplay when you have tiles */}
        {yourHand.length > 0 && <HandDisplay />}

        {/* Future: TurnActions, EventLog, DiscardPile */}
      </main>
    </div>
  );
}

export default App;
```

---

## Success Criteria

Phase 3 is complete when:

1. ✅ HandDisplay component renders without errors
2. ✅ All tiles display with correct codes and names
3. ✅ Tile selection works (click to toggle, blue border)
4. ✅ Multiple tiles can be selected
5. ✅ Selection display shows selected tiles with indices
6. ✅ "Clear" button clears all selections
7. ✅ Sort by suit orders tiles correctly
8. ✅ Sort by rank orders tiles correctly
9. ✅ Exposed melds display with correct format
10. ✅ Joker assignments show as "J→{tile}"
11. ✅ Hand updates in real-time from game events
12. ✅ TypeScript compiles without errors
13. ✅ No console errors or warnings

---

## Next Steps

After Phase 3 is complete, proceed to:

- **Phase 4: Turn Actions** - Discard, call, pass, charleston, mahjong buttons
- **Phase 5: Event Log** - Display recent game events
- **Phase 6: Discard Pile** - Show 4-player discard piles

---
