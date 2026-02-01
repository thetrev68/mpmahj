# Phase 8: Tile Formatting Utilities - Implementation Guide

## Status: ✅ COMPLETED

**Implementation Date**: 2026-01-24

**Files Implemented**:

- `apps/client/src/utils/tileFormatter.ts` - Core utility module with all formatting and sorting functions

**Integration Status**:

- ✅ Used in HandDisplay.tsx (tileToString, tileToCode, compareBySuit, compareByRank)
- ✅ Used in DiscardPile.tsx (tileToCode)
- ✅ Used in eventFormatter.ts (tileToCode)

**Additional Features Implemented**:

- `compareBySuit()` - Exported comparator for flexible sorting
- `compareByRank()` - Exported comparator for flexible sorting
- `formatMeld()` - Formats melds with joker assignment display

**Build Status**: ✅ TypeScript compiles successfully, no errors or warnings

---

## Overview

Build the **tileFormatter** utility module to provide:

- Tile-to-string conversion (human-readable display)
- Tile-to-code conversion (compact display)
- Tile sorting by suit order
- Tile sorting by rank order

This is a foundational utility module with **no dependencies** on React or state management. It's pure TypeScript that can be used across all components (HandDisplay, DiscardPile, EventLog, etc.).

---

## Quick Reference

### Type Definitions

```typescript
// From generated bindings
import type { Tile } from '@/types/bindings/generated/Tile';

// Tile is a number (0-36)
const tileId: number = tile;
```text

### Tile Index Mapping

From [crates/mahjong_core/src/tile.rs](../../../crates/mahjong_core/src/tile.rs):

```typescript
// Index Ranges (constants from Rust)
const BAM_START = 0; // 0-8: Bams (1B-9B)
const CRAK_START = 9; // 9-17: Cracks (1C-9C)
const DOT_START = 18; // 18-26: Dots (1D-9D)
const WIND_START = 27; // 27-30: Winds (E, S, W, N)
const DRAGON_START = 31; // 31-33: Dragons (Green, Red, White/Soap)
const FLOWER_INDEX = 34; // 34: Flower
const JOKER_INDEX = 35; // 35: Joker
const BLANK_INDEX = 36; // 36: Blank (House Rule)

// Tile-to-Name Mapping (from Rust display_name())
// 0-8:   "1 Bam" - "9 Bam"
// 9-17:  "1 Crack" - "9 Crack"
// 18-26: "1 Dot" - "9 Dot"
// 27:    "East Wind"
// 28:    "South Wind"
// 29:    "West Wind"
// 30:    "North Wind"
// 31:    "Green Dragon"
// 32:    "Red Dragon"
// 33:    "White Dragon (Soap)"
// 34:    "Flower"
// 35:    "Joker"
// 36:    "Blank"
```text

---

## Component Specification

### File Location

`apps/client/src/utils/tileFormatter.ts`

### Function Signatures

```typescript
/**
 * Convert Tile index (0-36) to human-readable string.
 *
 * @param tile - Tile index (0-36)
 * @returns Human-readable tile name
 *
 * @example
 * tileToString(0 )  // "1 Bam"
 * tileToString(27 ) // "East Wind"
 * tileToString(35 ) // "Joker"
 */
export function tileToString(tile: Tile): string;

/**
 * Convert Tile to short code for compact display.
 *
 * @param tile - Tile index (0-36)
 * @returns Short code (2-3 characters)
 *
 * @example
 * tileToCode(0 )  // "1B"
 * tileToCode(27 ) // "E"
 * tileToCode(31 ) // "GD"
 * tileToCode(35 ) // "J"
 */
export function tileToCode(tile: Tile): string;

/**
 * Sort tiles by suit order.
 *
 * Order: Flowers → Bams → Cracks → Dots → Dragons → Winds → Jokers → Blanks
 * Within each suit: sorted by rank (1-9)
 *
 * @param tiles - Array of tiles to sort
 * @returns New array sorted by suit
 *
 * @example
 * sortBySuit([35, 0, 27, 9])
 * // Returns: [0, 9, 27, 35]
 * // (1B, 1C, E, J)
 */
export function sortBySuit(tiles: Tile[]): Tile[];

/**
 * Sort tiles by rank order.
 *
 * Order: 1s → 2s → 3s → ... → 9s → Flowers → Dragons → Winds → Jokers → Blanks
 * Within each rank: Bams → Cracks → Dots
 *
 * @param tiles - Array of tiles to sort
 * @returns New array sorted by rank
 *
 * @example
 * sortByRank([8, 17, 26, 0])
 * // Returns: [0, 9, 18, 8, 17, 26]
 * // (All 1s first, then all 2s, etc.)
 */
export function sortByRank(tiles: Tile[]): Tile[];
```text

---

## Implementation Details

### Helper: Tile ID Accessor

`Tile` is a number in the generated bindings. This helper is optional, but keeps the rest of the code consistent.

```typescript
/**
 * Internal helper to return the tile ID.
 */
function getTileId(tile: Tile): number {
  return tile;
}

/**
 * Internal helper to validate tile ID is in range.
 */
function isValidTileId(id: number): boolean {
  return id >= 0 && id <= 36;
}
```text

---

### Function 1: tileToString

**Purpose**: Convert tile index to human-readable name (matches Rust `display_name()`)

**Implementation**:

```typescript
/**
 * Convert Tile index (0-36) to human-readable string.
 *
 * Ported from: crates/mahjong_core/src/tile.rs:display_name()
 */
export function tileToString(tile: Tile): string {
  const id = getTileId(tile);

  // Validate range
  if (!isValidTileId(id)) {
    return 'Unknown Tile';
  }

  // Constants for readability
  const BAM_START = 0;
  const CRAK_START = 9;
  const DOT_START = 18;
  const WIND_START = 27;
  const DRAGON_START = 31;
  const FLOWER_INDEX = 34;
  const JOKER_INDEX = 35;
  const BLANK_INDEX = 36;

  // Bams (0-8)
  if (id >= BAM_START && id < CRAK_START) {
    const rank = id - BAM_START + 1;
    return `${rank} Bam`;
  }

  // Cracks (9-17)
  if (id >= CRAK_START && id < DOT_START) {
    const rank = id - CRAK_START + 1;
    return `${rank} Crack`;
  }

  // Dots (18-26)
  if (id >= DOT_START && id < WIND_START) {
    const rank = id - DOT_START + 1;
    return `${rank} Dot`;
  }

  // Winds (27-30)
  switch (id) {
    case 27:
      return 'East Wind';
    case 28:
      return 'South Wind';
    case 29:
      return 'West Wind';
    case 30:
      return 'North Wind';
  }

  // Dragons (31-33)
  switch (id) {
    case 31:
      return 'Green Dragon';
    case 32:
      return 'Red Dragon';
    case 33:
      return 'White Dragon (Soap)';
  }

  // Special tiles (34-36)
  switch (id) {
    case FLOWER_INDEX:
      return 'Flower';
    case JOKER_INDEX:
      return 'Joker';
    case BLANK_INDEX:
      return 'Blank';
  }

  return 'Unknown Tile';
}
```text

---

### Function 2: tileToCode

**Purpose**: Convert tile to short 1-3 character code for compact display

**Implementation**:

```typescript
/**
 * Convert Tile to short code for compact display.
 *
 * Codes:
 * - Suited: "1B", "2C", "3D", etc.
 * - Winds: "E", "S", "W", "N"
 * - Dragons: "GD", "RD", "WD"
 * - Special: "F", "J", "BL"
 */
export function tileToCode(tile: Tile): string {
  const id = getTileId(tile);

  // Validate range
  if (!isValidTileId(id)) {
    return '??';
  }

  const BAM_START = 0;
  const CRAK_START = 9;
  const DOT_START = 18;
  const WIND_START = 27;
  const DRAGON_START = 31;
  const FLOWER_INDEX = 34;
  const JOKER_INDEX = 35;
  const BLANK_INDEX = 36;

  // Bams (0-8) → "1B" - "9B"
  if (id >= BAM_START && id < CRAK_START) {
    const rank = id - BAM_START + 1;
    return `${rank}B`;
  }

  // Cracks (9-17) → "1C" - "9C"
  if (id >= CRAK_START && id < DOT_START) {
    const rank = id - CRAK_START + 1;
    return `${rank}C`;
  }

  // Dots (18-26) → "1D" - "9D"
  if (id >= DOT_START && id < WIND_START) {
    const rank = id - DOT_START + 1;
    return `${rank}D`;
  }

  // Winds (27-30) → "E", "S", "W", "N"
  switch (id) {
    case 27:
      return 'E';
    case 28:
      return 'S';
    case 29:
      return 'W';
    case 30:
      return 'N';
  }

  // Dragons (31-33) → "GD", "RD", "WD"
  switch (id) {
    case 31:
      return 'GD';
    case 32:
      return 'RD';
    case 33:
      return 'WD';
  }

  // Special tiles (34-36) → "F", "J", "BL"
  switch (id) {
    case FLOWER_INDEX:
      return 'F';
    case JOKER_INDEX:
      return 'J';
    case BLANK_INDEX:
      return 'BL';
  }

  return '??';
}
```text

---

### Function 3: sortBySuit

**Purpose**: Sort tiles by suit, then rank within suit

**Sort Order**:

1. Flowers (34)
2. Bams (0-8)
3. Cracks (9-17)
4. Dots (18-26)
5. Dragons (31-33)
6. Winds (27-30)
7. Jokers (35)
8. Blanks (36)

**Implementation**:

```typescript
/**
 * Sort tiles by suit order.
 *
 * Order: Flowers → Bams → Cracks → Dots → Dragons → Winds → Jokers → Blanks
 */
export function sortBySuit(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const idA = getTileId(a);
    const idB = getTileId(b);

    const orderA = getSuitSortOrder(idA);
    const orderB = getSuitSortOrder(idB);

    return orderA - orderB;
  });
}

/**
 * Get sort order value for suit-based sorting.
 * Lower value = earlier in sort order.
 */
function getSuitSortOrder(id: number): number {
  // Flowers (34) → 0
  if (id === 34) return 0;

  // Bams (0-8) → 100-108
  if (id >= 0 && id <= 8) return 100 + id;

  // Cracks (9-17) → 200-208
  if (id >= 9 && id <= 17) return 200 + (id - 9);

  // Dots (18-26) → 300-308
  if (id >= 18 && id <= 26) return 300 + (id - 18);

  // Dragons (31-33) → 400-402
  if (id >= 31 && id <= 33) return 400 + (id - 31);

  // Winds (27-30) → 500-503
  if (id >= 27 && id <= 30) return 500 + (id - 27);

  // Jokers (35) → 600
  if (id === 35) return 600;

  // Blanks (36) → 700
  if (id === 36) return 700;

  // Unknown → 999
  return 999;
}
```text

---

### Function 4: sortByRank

**Purpose**: Sort tiles by rank (all 1s, all 2s, etc.), then suit within rank

**Sort Order**:

1. All 1s (Bam → Crack → Dot)
2. All 2s (Bam → Crack → Dot)
3. ... (3-9)
4. Flowers (34)
5. Dragons (31-33)
6. Winds (27-30)
7. Jokers (35)
8. Blanks (36)

**Implementation**:

```typescript
/**
 * Sort tiles by rank order.
 *
 * Order: 1s → 2s → ... → 9s → Flowers → Dragons → Winds → Jokers → Blanks
 */
export function sortByRank(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const idA = getTileId(a);
    const idB = getTileId(b);

    const orderA = getRankSortOrder(idA);
    const orderB = getRankSortOrder(idB);

    return orderA - orderB;
  });
}

/**
 * Get sort order value for rank-based sorting.
 * Lower value = earlier in sort order.
 */
function getRankSortOrder(id: number): number {
  // Suited tiles (0-26): Group by rank, then suit
  if (id >= 0 && id <= 26) {
    const rank = id % 9; // 0-8 (representing ranks 1-9)
    const suit = Math.floor(id / 9); // 0=Bam, 1=Crack, 2=Dot

    // Rank priority: 0-8 (1s first, 9s last)
    // Suit priority within rank: Bam → Crack → Dot
    return rank * 10 + suit;
  }

  // Flowers (34) → 100
  if (id === 34) return 100;

  // Dragons (31-33) → 200-202
  if (id >= 31 && id <= 33) return 200 + (id - 31);

  // Winds (27-30) → 300-303
  if (id >= 27 && id <= 30) return 300 + (id - 27);

  // Jokers (35) → 400
  if (id === 35) return 400;

  // Blanks (36) → 500
  if (id === 36) return 500;

  // Unknown → 999
  return 999;
}
```text

---

## Complete Implementation

**File**: `apps/client/src/utils/tileFormatter.ts`

````typescript
import type { Tile } from '@/types/bindings/generated/Tile';

// ============================================================================
// Constants (from mahjong_core/src/tile.rs)
// ============================================================================

const BAM_START = 0;
const CRAK_START = 9;
const DOT_START = 18;
const WIND_START = 27;
const DRAGON_START = 31;
const FLOWER_INDEX = 34;
const JOKER_INDEX = 35;
const BLANK_INDEX = 36;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Return tile ID (identity for numeric Tile).
 */
function getTileId(tile: Tile): number {
  return tile;
}

/**
 * Validate tile ID is in valid range (0-36).
 */
function isValidTileId(id: number): boolean {
  return id >= 0 && id <= 36;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Convert Tile index (0-36) to human-readable string.
 *
 * Ported from: crates/mahjong_core/src/tile.rs:display_name()
 *
 * @param tile - Tile index (0-36)
 * @returns Human-readable tile name
 *
 * @example
 * ```typescript
 * tileToString(0 )  // "1 Bam"
 * tileToString(27 ) // "East Wind"
 * tileToString(31 ) // "Green Dragon"
 * tileToString(35 ) // "Joker"
 * ```
 */
export function tileToString(tile: Tile): string {
  const id = getTileId(tile);

  if (!isValidTileId(id)) {
    return 'Unknown Tile';
  }

  // Bams (0-8)
  if (id >= BAM_START && id < CRAK_START) {
    const rank = id - BAM_START + 1;
    return `${rank} Bam`;
  }

  // Cracks (9-17)
  if (id >= CRAK_START && id < DOT_START) {
    const rank = id - CRAK_START + 1;
    return `${rank} Crack`;
  }

  // Dots (18-26)
  if (id >= DOT_START && id < WIND_START) {
    const rank = id - DOT_START + 1;
    return `${rank} Dot`;
  }

  // Winds (27-30)
  if (id === 27) return 'East Wind';
  if (id === 28) return 'South Wind';
  if (id === 29) return 'West Wind';
  if (id === 30) return 'North Wind';

  // Dragons (31-33)
  if (id === 31) return 'Green Dragon';
  if (id === 32) return 'Red Dragon';
  if (id === 33) return 'White Dragon (Soap)';

  // Special tiles (34-36)
  if (id === FLOWER_INDEX) return 'Flower';
  if (id === JOKER_INDEX) return 'Joker';
  if (id === BLANK_INDEX) return 'Blank';

  return 'Unknown Tile';
}

/**
 * Convert Tile to short code for compact display.
 *
 * @param tile - Tile index (0-36)
 * @returns Short code (1-3 characters)
 *
 * @example
 * ```typescript
 * tileToCode(0 )  // "1B"
 * tileToCode(9 )  // "1C"
 * tileToCode(27 ) // "E"
 * tileToCode(31 ) // "GD"
 * tileToCode(35 ) // "J"
 * ```
 */
export function tileToCode(tile: Tile): string {
  const id = getTileId(tile);

  if (!isValidTileId(id)) {
    return '??';
  }

  // Bams (0-8) → "1B" - "9B"
  if (id >= BAM_START && id < CRAK_START) {
    const rank = id - BAM_START + 1;
    return `${rank}B`;
  }

  // Cracks (9-17) → "1C" - "9C"
  if (id >= CRAK_START && id < DOT_START) {
    const rank = id - CRAK_START + 1;
    return `${rank}C`;
  }

  // Dots (18-26) → "1D" - "9D"
  if (id >= DOT_START && id < WIND_START) {
    const rank = id - DOT_START + 1;
    return `${rank}D`;
  }

  // Winds (27-30) → "E", "S", "W", "N"
  if (id === 27) return 'E';
  if (id === 28) return 'S';
  if (id === 29) return 'W';
  if (id === 30) return 'N';

  // Dragons (31-33) → "GD", "RD", "WD"
  if (id === 31) return 'GD';
  if (id === 32) return 'RD';
  if (id === 33) return 'WD';

  // Special tiles (34-36) → "F", "J", "BL"
  if (id === FLOWER_INDEX) return 'F';
  if (id === JOKER_INDEX) return 'J';
  if (id === BLANK_INDEX) return 'BL';

  return '??';
}

/**
 * Sort tiles by suit order.
 *
 * Order: Flowers → Bams → Cracks → Dots → Dragons → Winds → Jokers → Blanks
 *
 * @param tiles - Array of tiles to sort
 * @returns New array sorted by suit (does not mutate input)
 *
 * @example
 * ```typescript
 * const tiles = [35, 0, 27, 9];
 * const sorted = sortBySuit(tiles);
 * // Result: [0, 9, 27, 35]
 * // Display: "1B", "1C", "E", "J"
 * ```
 */
export function sortBySuit(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const idA = getTileId(a);
    const idB = getTileId(b);
    return getSuitSortOrder(idA) - getSuitSortOrder(idB);
  });
}

/**
 * Get sort order value for suit-based sorting.
 * Lower value = earlier in sort order.
 */
function getSuitSortOrder(id: number): number {
  if (id === 34) return 0; // Flowers
  if (id >= 0 && id <= 8) return 100 + id; // Bams (100-108)
  if (id >= 9 && id <= 17) return 200 + (id - 9); // Cracks (200-208)
  if (id >= 18 && id <= 26) return 300 + (id - 18); // Dots (300-308)
  if (id >= 31 && id <= 33) return 400 + (id - 31); // Dragons (400-402)
  if (id >= 27 && id <= 30) return 500 + (id - 27); // Winds (500-503)
  if (id === 35) return 600; // Jokers
  if (id === 36) return 700; // Blanks
  return 999; // Unknown
}

/**
 * Sort tiles by rank order.
 *
 * Order: 1s → 2s → ... → 9s → Flowers → Dragons → Winds → Jokers → Blanks
 * Within each rank: Bams → Cracks → Dots
 *
 * @param tiles - Array of tiles to sort
 * @returns New array sorted by rank (does not mutate input)
 *
 * @example
 * ```typescript
 * const tiles = [8, 17, 26, 0];
 * const sorted = sortByRank(tiles);
 * // Result: [0, 9, 18, 8, 17, 26]
 * // All 1s first, then all 9s
 * ```
 */
export function sortByRank(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const idA = getTileId(a);
    const idB = getTileId(b);
    return getRankSortOrder(idA) - getRankSortOrder(idB);
  });
}

/**
 * Get sort order value for rank-based sorting.
 * Lower value = earlier in sort order.
 */
function getRankSortOrder(id: number): number {
  // Suited tiles (0-26): Group by rank (0-8), then suit (Bam/Crack/Dot)
  if (id >= 0 && id <= 26) {
    const rank = id % 9; // 0-8 (representing ranks 1-9)
    const suit = Math.floor(id / 9); // 0=Bam, 1=Crack, 2=Dot
    return rank * 10 + suit; // 0, 1, 2, 10, 11, 12, ..., 80, 81, 82
  }

  if (id === 34) return 100; // Flowers
  if (id >= 31 && id <= 33) return 200 + (id - 31); // Dragons (200-202)
  if (id >= 27 && id <= 30) return 300 + (id - 27); // Winds (300-303)
  if (id === 35) return 400; // Jokers
  if (id === 36) return 500; // Blanks
  return 999; // Unknown
}
````

---

## Testing Checklist

### tileToString Tests

- [ ] Bams (0-8) return "1 Bam" through "9 Bam"
- [ ] Cracks (9-17) return "1 Crack" through "9 Crack"
- [ ] Dots (18-26) return "1 Dot" through "9 Dot"
- [ ] Winds return "East Wind", "South Wind", "West Wind", "North Wind"
- [ ] Dragons return "Green Dragon", "Red Dragon", "White Dragon (Soap)"
- [ ] Flower (34) returns "Flower"
- [ ] Joker (35) returns "Joker"
- [ ] Blank (36) returns "Blank"
- [ ] Invalid indices (< 0, > 36) return "Unknown Tile"
- [ ] Works with Tile numbers (0-36)

**Test Cases**:

```typescript
// Bams
expect(tileToString(0)).toBe('1 Bam');
expect(tileToString(4)).toBe('5 Bam');
expect(tileToString(8)).toBe('9 Bam');

// Cracks
expect(tileToString(9)).toBe('1 Crack');
expect(tileToString(13)).toBe('5 Crack');
expect(tileToString(17)).toBe('9 Crack');

// Dots
expect(tileToString(18)).toBe('1 Dot');
expect(tileToString(22)).toBe('5 Dot');
expect(tileToString(26)).toBe('9 Dot');

// Winds
expect(tileToString(27)).toBe('East Wind');
expect(tileToString(28)).toBe('South Wind');
expect(tileToString(29)).toBe('West Wind');
expect(tileToString(30)).toBe('North Wind');

// Dragons
expect(tileToString(31)).toBe('Green Dragon');
expect(tileToString(32)).toBe('Red Dragon');
expect(tileToString(33)).toBe('White Dragon (Soap)');

// Special
expect(tileToString(34)).toBe('Flower');
expect(tileToString(35)).toBe('Joker');
expect(tileToString(36)).toBe('Blank');

// Edge cases
expect(tileToString(-1)).toBe('Unknown Tile');
expect(tileToString(37)).toBe('Unknown Tile');
expect(tileToString(5)).toBe('6 Bam');
```text

---

### tileToCode Tests

- [ ] Bams (0-8) return "1B" through "9B"
- [ ] Cracks (9-17) return "1C" through "9C"
- [ ] Dots (18-26) return "1D" through "9D"
- [ ] Winds return "E", "S", "W", "N"
- [ ] Dragons return "GD", "RD", "WD"
- [ ] Flower (34) returns "F"
- [ ] Joker (35) returns "J"
- [ ] Blank (36) returns "BL"
- [ ] Invalid indices return "??"
- [ ] Works with Tile numbers (0-36)

**Test Cases**:

```typescript
// Bams
expect(tileToCode(0)).toBe('1B');
expect(tileToCode(8)).toBe('9B');

// Cracks
expect(tileToCode(9)).toBe('1C');
expect(tileToCode(17)).toBe('9C');

// Dots
expect(tileToCode(18)).toBe('1D');
expect(tileToCode(26)).toBe('9D');

// Winds
expect(tileToCode(27)).toBe('E');
expect(tileToCode(28)).toBe('S');
expect(tileToCode(29)).toBe('W');
expect(tileToCode(30)).toBe('N');

// Dragons
expect(tileToCode(31)).toBe('GD');
expect(tileToCode(32)).toBe('RD');
expect(tileToCode(33)).toBe('WD');

// Special
expect(tileToCode(34)).toBe('F');
expect(tileToCode(35)).toBe('J');
expect(tileToCode(36)).toBe('BL');

// Edge cases
expect(tileToCode(-1)).toBe('??');
expect(tileToCode(100)).toBe('??');
expect(tileToCode(27)).toBe('E');
```text

---

### sortBySuit Tests

- [ ] Flowers sort first
- [ ] Bams sort before Cracks
- [ ] Cracks sort before Dots
- [ ] Dots sort before Dragons
- [ ] Dragons sort before Winds
- [ ] Winds sort before Jokers
- [ ] Jokers sort before Blanks
- [ ] Within each suit, tiles are sorted by rank
- [ ] Does not mutate input array
- [ ] Works with empty array
- [ ] Works with single tile

**Test Cases**:

```typescript
// Basic suit order
const tiles1 = [
  35, // Joker
  0, // 1 Bam
  27, // East
  9, // 1 Crack
  34, // Flower
];
const sorted1 = sortBySuit(tiles1);
expect(sorted1.map((t) => t[0])).toEqual([34, 0, 9, 27, 35]);
// Flower, 1B, 1C, E, J

// Within-suit rank ordering
const tiles2 = [
  8, // 9 Bam
  0, // 1 Bam
  4, // 5 Bam
];
const sorted2 = sortBySuit(tiles2);
expect(sorted2.map((t) => t[0])).toEqual([0, 4, 8]);
// 1B, 5B, 9B

// Does not mutate input
const original = [35, 0];
const sorted3 = sortBySuit(original);
expect(original).toEqual([35, 0]); // Unchanged

// Edge cases
expect(sortBySuit([])).toEqual([]);
expect(sortBySuit([5])).toEqual([5]);
```text

---

### sortByRank Tests

- [ ] All 1s (Bam, Crack, Dot) sort first
- [ ] All 2s sort after all 1s
- [ ] ... (continuing through ranks)
- [ ] All 9s sort before Flowers
- [ ] Flowers sort before Dragons
- [ ] Dragons sort before Winds
- [ ] Winds sort before Jokers
- [ ] Jokers sort before Blanks
- [ ] Within each rank, Bams → Cracks → Dots
- [ ] Does not mutate input array
- [ ] Works with empty array
- [ ] Works with single tile

**Test Cases**:

```typescript
// Rank-based grouping
const tiles1 = [
  8, // 9 Bam (rank 9)
  17, // 9 Crack (rank 9)
  26, // 9 Dot (rank 9)
  0, // 1 Bam (rank 1)
  9, // 1 Crack (rank 1)
  18, // 1 Dot (rank 1)
];
const sorted1 = sortByRank(tiles1);
expect(sorted1.map((t) => t[0])).toEqual([0, 9, 18, 8, 17, 26]);
// All 1s, then all 9s

// Within-rank suit ordering (Bam → Crack → Dot)
const tiles2 = [
  18, // 1 Dot
  9, // 1 Crack
  0, // 1 Bam
];
const sorted2 = sortByRank(tiles2);
expect(sorted2.map((t) => t[0])).toEqual([0, 9, 18]);
// 1B, 1C, 1D

// Non-suited tiles
const tiles3 = [
  35, // Joker
  34, // Flower
  31, // Green Dragon
  27, // East
];
const sorted3 = sortByRank(tiles3);
expect(sorted3.map((t) => t[0])).toEqual([34, 31, 27, 35]);
// F, GD, E, J

// Does not mutate input
const original = [8, 0];
const sorted4 = sortByRank(original);
expect(original).toEqual([8, 0]); // Unchanged

// Edge cases
expect(sortByRank([])).toEqual([]);
expect(sortByRank([5])).toEqual([5]);
```text

---

## Usage Examples

### In HandDisplay Component

```typescript
import { tileToString, tileToCode, sortBySuit, sortByRank } from '@/utils/tileFormatter';
import { useGameStore } from '@/store/gameStore';
import { useState } from 'react';

export function HandDisplay() {
  const yourHand = useGameStore((state) => state.yourHand);
  const [sortMode, setSortMode] = useState<'suit' | 'rank'>('suit');

  // Sort tiles based on selected mode
  const sortedHand = sortMode === 'suit'
    ? sortBySuit(yourHand)
    : sortByRank(yourHand);

  return (
    <div className="hand-display">
      <div className="sort-controls">
        <button
          onClick={() => setSortMode('suit')}
          className={sortMode === 'suit' ? 'active' : ''}
        >
          Sort by Suit
        </button>
        <button
          onClick={() => setSortMode('rank')}
          className={sortMode === 'rank' ? 'active' : ''}
        >
          Sort by Rank
        </button>
      </div>

      <div className="tiles">
        {sortedHand.map((tile, index) => (
          <button key={index} className="tile-button">
            <span className="tile-code">{tileToCode(tile)}</span>
            <span className="tile-name">{tileToString(tile)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```text

---

### In DiscardPile Component

```typescript
import { tileToCode, tileToString } from '@/utils/tileFormatter';
import { useGameStore } from '@/store/gameStore';
import type { Seat } from '@/types/bindings/generated/Seat';

export function DiscardPile() {
  const discardPile = useGameStore((state) => state.discardPile);

  // Group discards by player
  const discardsBySeat: Record<Seat, typeof discardPile> = {
    East: [],
    South: [],
    West: [],
    North: [],
  };

  discardPile.forEach((discard) => {
    discardsBySeat[discard.discarded_by].push(discard);
  });

  return (
    <div className="discard-pile">
      {(['East', 'South', 'West', 'North'] as Seat[]).map((seat) => (
        <div key={seat} className="player-discards">
          <h4>{seat}:</h4>
          <div className="tiles">
            {discardsBySeat[seat].slice(-6).map((discard, index) => (
              <span
                key={index}
                className="discard-tile"
                title={tileToString(discard.tile)}
              >
                {tileToCode(discard.tile)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```text

---

### In EventLog Component

```typescript
import { tileToString } from '@/utils/tileFormatter';
import type { GameEvent } from '@/types/bindings/generated/GameEvent';

function formatEvent(event: GameEvent): string {
  switch (event.kind) {
    case 'TileDrawn':
      return `${event.player} drew a tile`;

    case 'TileDiscarded':
      return `${event.player} discarded ${tileToString(event.tile)}`;

    case 'TileCalled':
      return `${event.player} called ${event.meld.meld_type} on ${tileToString(event.meld.called_tile)}`;

    case 'Charleston':
      return `Charleston: ${event.stage}`;

    case 'Mahjong':
      return `${event.winner} won with ${tileToString(event.winning_tile)}!`;

    default:
      return JSON.stringify(event);
  }
}
```text

---

## Edge Case Handling

### Invalid Tile Indices

```typescript
// Handles out-of-range indices gracefully
tileToString(-1); // "Unknown Tile"
tileToString(100); // "Unknown Tile"
tileToCode(-5); // "??"
tileToCode(999); // "??"

// Sorting handles invalid tiles by placing them last
const mixed = [0, -1, 35];
sortBySuit(mixed); // [0, 35, -1]
```text

---

### Joker Variations

The game engine uses **index 35** for all Jokers. The **index 36+** note in requirements refers to future-proofing if multiple Joker types are added.

```typescript
// Current implementation (single Joker type)
tileToString(35); // "Joker"
tileToCode(35); // "J"

// For joker index >= 36, treat as Blank (house rule)
tileToString(36); // "Blank"
```text

---

### Empty Arrays

```typescript
// Sorting empty arrays is safe
sortBySuit([]); // []
sortByRank([]); // []
```text

---

### Input Types

```typescript
// Works with Tile numbers (0-36)
tileToString(27); // "East Wind"

// Sorting expects Tile numbers
const tiles = [35, 0, 27];
sortBySuit(tiles);
```text

---

## Performance Considerations

### Memory Allocation

```typescript
// ✅ GOOD: sortBySuit/sortByRank return new arrays
const sorted = sortBySuit(tiles); // No mutation, safe to use

// ❌ BAD: Don't sort on every render
function HandDisplay() {
  const tiles = useGameStore((state) => state.yourHand);
  const sorted = sortBySuit(tiles); // Runs on every render!
  // ...
}

// ✅ GOOD: Memoize sorting with useMemo
function HandDisplay() {
  const tiles = useGameStore((state) => state.yourHand);
  const sortMode = useUIStore((state) => state.sortMode);

  const sorted = useMemo(() => {
    return sortMode === 'suit' ? sortBySuit(tiles) : sortByRank(tiles);
  }, [tiles, sortMode]); // Only re-sort when tiles or mode changes

  // ...
}
```text

---

### String Allocation

```typescript
// tileToString allocates a new string on each call
// For large discard piles, consider memoization

// ✅ GOOD: Cache tile strings if displaying many times
const tileStringCache = new Map<number, string>();

function getCachedTileString(tile: Tile): string {
  const id = tile;
  if (!tileStringCache.has(id)) {
    tileStringCache.set(id, tileToString(tile));
  }
  return tileStringCache.get(id)!;
}
```text

---

### Sort Complexity

- **Time Complexity**: O(n log n) for both sort functions (JavaScript native sort)
- **Space Complexity**: O(n) (creates new array)
- **Typical Hand Size**: 14 tiles (negligible performance impact)
- **Discard Pile**: ~50-80 tiles max (still very fast)

**Recommendation**: Don't optimize prematurely. The sorting functions are fast enough for typical game state sizes.

---

## TypeScript Strict Mode

All functions are fully typed with strict mode enabled:

```typescript
// ✅ Type-safe inputs
tileToString(27); // OK
tileToString(27); // OK
tileToString('27'); // ❌ Type error

// ✅ Type-safe outputs
const name: string = tileToString(0); // OK
const code: string = tileToCode(0); // OK

// ✅ Type-safe sorting
const tiles: Tile[] = [0, 1];
const sorted: Tile[] = sortBySuit(tiles); // OK
```text

---

## Success Criteria

Phase 8 is complete when:

1. ✅ tileFormatter.ts file created with all 4 functions
2. ✅ tileToString() correctly converts all 37 tile indices
3. ✅ tileToCode() returns compact codes for all tiles
4. ✅ sortBySuit() sorts in correct suit order
5. ✅ sortByRank() sorts in correct rank order
6. ✅ Edge cases handled (invalid indices, empty arrays, etc.)
7. ✅ TypeScript compiles without errors (strict mode)
8. ✅ No runtime errors for valid inputs
9. ✅ Functions are pure (no side effects, no mutations)
10. ✅ Documentation is clear with examples

---

## Next Steps

Phase 8 implementation is complete and integrated:

- ✅ **Phase 3 (HandDisplay)** - Already using `tileToString()`, `tileToCode()`, `compareBySuit()`, and `compareByRank()`
- ✅ **Phase 5 (EventLog)** - Already using `tileToString()` via eventFormatter.ts for event formatting
- ✅ **Phase 6 (DiscardPile)** - Already using `tileToCode()` for compact discard display
- ✅ All components now have access to consistent tile formatting utilities

---

## Additional Notes

### Why Two Sort Functions?

Players have different preferences for organizing their hand:

- **Sort by Suit**: Traditional Mahjong style (group by suit, easier to spot runs)
- **Sort by Rank**: Alternative style (group by rank, easier to spot sets/pairs)

Provide both options and let the user toggle between them in the HandDisplay component.

### Tile Display Consistency

**Important**: Always use `tileToString()` and `tileToCode()` instead of hardcoding tile names. This ensures:

- Consistency across the UI
- Easy updates if tile names change
- Single source of truth (matches Rust display logic)

### Future Enhancements

Consider adding these functions in later phases:

```typescript
// Group tiles by suit (returns Map<string, Tile[]>)
export function groupBySuit(tiles: Tile[]): Map<string, Tile[]>;

// Get tile color for styling (green/red/blue suits, etc.)
export function getTileColor(tile: Tile): string;

// Convert tile code back to index ("1B" → 0)
export function codeToTile(code: string): Tile | null;
```text

### Testing Strategy

Create a test file `apps/client/src/utils/tileFormatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { tileToString, tileToCode, sortBySuit, sortByRank } from './tileFormatter';

describe('tileFormatter', () => {
  describe('tileToString', () => {
    it('converts Bams correctly', () => {
      expect(tileToString(0)).toBe('1 Bam');
      expect(tileToString(8)).toBe('9 Bam');
    });

    // ... more tests
  });

  // ... other test suites
});
```text

Run tests with: `npm test -- tileFormatter.test.ts`

---

## File Structure

```text
apps/client/src/
├── utils/
│   ├── tileFormatter.ts           # ✅ IMPLEMENTED - Core formatter utilities
│   ├── eventFormatter.ts          # ✅ EXISTING - Uses tileToCode()
│   ├── phaseFormatter.ts          # EXISTING - Phase 2
│   ├── turnFormatter.ts           # EXISTING - Phase 2
│   ├── wallFormatter.ts           # EXISTING - Phase 2
│   └── commands.ts                # EXISTING - Command validation
├── components/
│   ├── HandDisplay.tsx            # ✅ INTEGRATED - Uses tileToString, tileToCode, sorting
│   ├── DiscardPile.tsx            # ✅ INTEGRATED - Uses tileToCode
│   └── EventLog.tsx               # ✅ INTEGRATED - Uses tileToCode via eventFormatter
└── types/
    └── bindings/
        └── generated/
            └── Tile.ts            # EXISTING - Generated from Rust
```text

---

## Related Files

- [crates/mahjong_core/src/tile.rs](../../../crates/mahjong_core/src/tile.rs:1) - Source of tile constants and display logic
- [docs/implementation/frontend/phase1-connection-panel.md](phase1-connection-panel.md) - Example of phase guide format
- [docs/implementation/frontend/phase2-game-status.md](phase2-game-status.md) - Example with formatter utilities
- [docs/implementation/frontend/minimal-browser-ui.md](minimal-browser-ui.md) - Overall implementation plan

---

## Implementation Notes (2026-01-24)

### Actual Implementation

The tileFormatter utility was implemented with all required functions plus additional features:

**Core Functions (Per Specification)**:

- `tileToString(tile)` - Human-readable tile names
- `tileToCode(tile)` - Compact 1-3 character codes
- `sortBySuit(tiles)` - Suit-based sorting with proper order
- `sortByRank(tiles)` - Rank-based sorting with proper order

**Bonus Features Added**:

- `compareBySuit(a, b)` - Exported comparator function for flexible sorting
- `compareByRank(a, b)` - Exported comparator function for flexible sorting
- `formatMeld(meld)` - Formats melds with joker assignment display (e.g., "Pung: [J→5D 5D 5D]")

### Integration Summary

The utility is fully integrated into the application:

- **HandDisplay.tsx** - Uses all four core functions plus both comparators for tile display and sorting controls
- **DiscardPile.tsx** - Uses `tileToCode()` for compact tile display in discard pile
- **eventFormatter.ts** - Uses `tileToCode()` for all tile references in game event messages

### Design Decisions

1. **Export Comparators** - Exported `compareBySuit()` and `compareByRank()` as separate functions to allow flexible sorting without creating new arrays
2. **Meld Formatting** - Added `formatMeld()` to handle complex joker assignment display consistently
3. **No Mutation** - All sorting functions use spread operator `[...tiles]` to avoid mutating input arrays
4. **Error Handling** - Invalid tile indices return fallback values ("Unknown Tile", "??") rather than throwing errors

### Verification

✅ Build: TypeScript compilation successful (strict mode)
✅ Integration: Used in 3+ components
✅ Type Safety: Full type coverage with no `any` types
✅ Documentation: Complete JSDoc with examples
✅ Purity: No side effects or mutations
