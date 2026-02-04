/**
 * Utility functions for working with tiles
 */

import type { Tile } from '@/types/bindings';

/**
 * Convert tile index (0-36) to human-readable name
 *
 * Tile index mapping:
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34:    Flower
 * - 35:    Joker
 * - 36:    Blank
 */
export function getTileName(index: Tile): string {
  // Bams (0-8)
  if (index >= 0 && index <= 8) {
    return `${index + 1} Bam`;
  }

  // Cracks (9-17)
  if (index >= 9 && index <= 17) {
    return `${index - 8} Crack`;
  }

  // Dots (18-26)
  if (index >= 18 && index <= 26) {
    return `${index - 17} Dot`;
  }

  // Winds (27-30)
  const winds = ['East', 'South', 'West', 'North'];
  if (index >= 27 && index <= 30) {
    return `${winds[index - 27]} Wind`;
  }

  // Dragons (31-33)
  const dragons = ['Green Dragon', 'Red Dragon', 'White Dragon'];
  if (index >= 31 && index <= 33) {
    return dragons[index - 31];
  }

  // Special tiles
  if (index === 34) return 'Flower';
  if (index === 35) return 'Joker';
  if (index === 36) return 'Blank';

  // Invalid tile index
  return `Unknown Tile (${index})`;
}

/**
 * Check if a tile index is valid (0-36)
 */
export function isValidTile(index: Tile): boolean {
  return index >= 0 && index <= 36;
}
