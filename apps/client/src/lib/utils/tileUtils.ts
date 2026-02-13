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
 */

import type { Tile } from '@/types/bindings';

// Tile index constants (matches Tile.ts bindings, auto-generated from backend tile.rs)
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
 * Sort tiles by suit and rank (standard hand sorting)
 * Order: Bam → Crack → Dot → Winds → Dragons → Flowers → Jokers
 */
export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a - b);
}
