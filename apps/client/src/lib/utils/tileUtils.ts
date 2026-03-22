/**
 * Utility functions for working with tiles
 *
 * Tile Index Mapping (from Tile.ts bindings - source of truth):
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34-41: Flowers (8 distinct variants for rendering)
 * - 42:    Joker
 * - 43:    Blank (House Rule)
 *
 * Canonical client-facing sort order (US-082):
 *   Joker → Flowers F1..F8 → Bam 1..9 → Green Dragon
 *   → Crak 1..9 → Red Dragon → Dot 1..9 → White Dragon
 *   → Winds E/S/W/N → Blank
 */

import type { Tile } from '@/types/bindings';

/**
 * Tile index bounds and special tile indices.
 * Maps to the bindings generated from backend tile.rs.
 * Source of truth for all tile classification logic.
 */
export const TILE_INDICES = {
  BAM_START: 0,
  BAM_END: 8,
  CRAK_START: 9,
  CRAK_END: 17,
  DOT_START: 18,
  DOT_END: 26,
  WIND_START: 27,
  WIND_END: 30,
  DRAGON_START: 31,
  DRAGON_END: 33,
  FLOWER_START: 34,
  FLOWER_END: 41,
  JOKER: 42,
  BLANK: 43,
} as const;

/**
 * Convert tile index (0-43) to human-readable name
 *
 * @param index - Tile index from backend
 */
export function getTileName(index: Tile): string {
  // Bams (0-8)
  if (index >= TILE_INDICES.BAM_START && index <= TILE_INDICES.BAM_END) {
    return `${index + 1} Bam`;
  }

  // Cracks (9-17)
  if (index >= TILE_INDICES.CRAK_START && index <= TILE_INDICES.CRAK_END) {
    return `${index - 8} Crack`;
  }

  // Dots (18-26)
  if (index >= TILE_INDICES.DOT_START && index <= TILE_INDICES.DOT_END) {
    return `${index - 17} Dot`;
  }

  // Winds (27-30)
  const winds = ['East', 'South', 'West', 'North'];
  if (index >= TILE_INDICES.WIND_START && index <= TILE_INDICES.WIND_END) {
    return `${winds[index - TILE_INDICES.WIND_START]} Wind`;
  }

  // Dragons (31-33)
  const dragons = ['Green Dragon', 'Red Dragon', 'White Dragon'];
  if (index >= TILE_INDICES.DRAGON_START && index <= TILE_INDICES.DRAGON_END) {
    return dragons[index - TILE_INDICES.DRAGON_START];
  }

  // Flowers (34-41)
  if (index >= TILE_INDICES.FLOWER_START && index <= TILE_INDICES.FLOWER_END) {
    return `Flower ${index - TILE_INDICES.FLOWER_START + 1}`;
  }

  // Special tiles
  if (index === TILE_INDICES.JOKER) return 'Joker';
  if (index === TILE_INDICES.BLANK) return 'Blank';

  // Invalid tile index
  return `Unknown Tile (${index})`;
}

/**
 * Check if a tile index is valid (0-43)
 */
export function isValidTile(index: Tile): boolean {
  return index >= 0 && index <= TILE_INDICES.BLANK;
}

/**
 * Check if a tile is a Joker
 */
export function isJoker(index: Tile): boolean {
  return index === TILE_INDICES.JOKER;
}

/**
 * Canonical tile sort-sequence lookup.
 *
 * Order (from the tile-asset reference):
 *   Joker (42) → Flowers F1..F8 (34-41) → Bam 1..9 (0-8) → Green Dragon (31)
 *   → Crak 1..9 (9-17) → Red Dragon (32) → Dot 1..9 (18-26) → White Dragon (33)
 *   → Winds E/S/W/N (27-30) → Blank (43)
 *
 * The map value is the 1-based sort position used by the comparator.
 */
const CANONICAL_SORT_ORDER: ReadonlyMap<number, number> = (() => {
  const order: number[] = [
    TILE_INDICES.JOKER, // 42
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41, // Flowers F1..F8
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8, // Bam 1..9
    TILE_INDICES.DRAGON_START, // 31 Green Dragon
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17, // Crak 1..9
    TILE_INDICES.DRAGON_START + 1, // 32 Red Dragon
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26, // Dot 1..9
    TILE_INDICES.DRAGON_END, // 33 White Dragon
    27,
    28,
    29,
    30, // Winds E/S/W/N
    TILE_INDICES.BLANK, // 43
  ];
  const m = new Map<number, number>();
  order.forEach((tile, i) => m.set(tile, i + 1));
  return m;
})();

/**
 * Return the canonical sort position for a tile index.
 * Unknown tiles sort after Blank.
 */
export function canonicalSortKey(tile: Tile): number {
  return CANONICAL_SORT_ORDER.get(tile) ?? 999;
}

/**
 * Comparator implementing the canonical client-facing tile order.
 * Use this for all rack auto-sort operations.
 */
export function canonicalTileComparator(a: Tile, b: Tile): number {
  return canonicalSortKey(a) - canonicalSortKey(b);
}

/**
 * Canonical tile group identifiers for visual spacing.
 * Tiles within the same group sit flush; an extra gap appears at group boundaries.
 */
export type TileGroup = 'joker' | 'flower' | 'bam' | 'crak' | 'dot' | 'wind' | 'blank';

export function getTileGroup(tile: Tile): TileGroup {
  if (tile === TILE_INDICES.JOKER) return 'joker';
  if (tile >= TILE_INDICES.FLOWER_START && tile <= TILE_INDICES.FLOWER_END) return 'flower';
  if (
    (tile >= TILE_INDICES.BAM_START && tile <= TILE_INDICES.BAM_END) ||
    tile === TILE_INDICES.DRAGON_START // Green Dragon
  )
    return 'bam';
  if (
    (tile >= TILE_INDICES.CRAK_START && tile <= TILE_INDICES.CRAK_END) ||
    tile === TILE_INDICES.DRAGON_START + 1 // Red Dragon
  )
    return 'crak';
  if (
    (tile >= TILE_INDICES.DOT_START && tile <= TILE_INDICES.DOT_END) ||
    tile === TILE_INDICES.DRAGON_END // White Dragon
  )
    return 'dot';
  if (tile >= TILE_INDICES.WIND_START && tile <= TILE_INDICES.WIND_END) return 'wind';
  return 'blank';
}

/**
 * Sort tiles using canonical client-facing order.
 * Order: Joker → Flowers → Bam+Green → Crak+Red → Dot+White → Winds → Blank
 */
export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort(canonicalTileComparator);
}

/**
 * Add tiles to a hand and return the sorted result.
 * Keeps repeated "sortHand([...hand, ...tiles])" call sites consistent.
 */
export function addAndSortHand(hand: Tile[], tilesToAdd: Tile[]): Tile[] {
  return sortHand([...hand, ...tilesToAdd]);
}
