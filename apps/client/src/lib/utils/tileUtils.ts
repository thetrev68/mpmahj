/**
 * Utility functions for working with tiles
 *
 * Tile Index Mapping (Current Backend):
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34:    Flower (single type - see BACKEND ENHANCEMENT note)
 * - 35:    Joker
 * - 36:    Blank
 *
 * BACKEND ENHANCEMENT NEEDED:
 * American Mahjong has 8 distinct flower tiles. When backend is updated:
 * - Indices 34-41 will be Flowers 1-8
 * - Index 42 will be Joker
 * - Index 43 will be Blank
 */

import type { Tile } from '@/types/bindings';

// Tile index constants (matches backend tile.rs)
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
  FLOWER: 34,
  JOKER: 35,
  BLANK: 36,
} as const;

/**
 * Convert tile index (0-36) to human-readable name
 *
 * @param index - Tile index from backend
 * @param flowerVariant - Optional flower variant (1-8) for display purposes
 */
export function getTileName(index: Tile, flowerVariant?: number): string {
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

  // Special tiles
  if (index === TILE_INDICES.FLOWER) {
    return flowerVariant ? `Flower ${flowerVariant}` : 'Flower';
  }
  if (index === TILE_INDICES.JOKER) return 'Joker';
  if (index === TILE_INDICES.BLANK) return 'Blank';

  // Invalid tile index
  return `Unknown Tile (${index})`;
}

/**
 * Check if a tile index is valid (0-36)
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
 * Check if a tile is a Flower
 */
export function isFlower(index: Tile): boolean {
  return index === TILE_INDICES.FLOWER;
}

/**
 * Check if a tile can be passed during Charleston
 * (All tiles except Jokers can be passed)
 */
export function canPassInCharleston(index: Tile): boolean {
  return isValidTile(index) && !isJoker(index);
}
