/**
 * Tile key generation utilities
 *
 * Since there can be duplicate tiles in a hand (up to 4 of each suited tile,
 * 8 jokers, etc.), we need stable unique keys for React rendering.
 *
 * Strategy: Use tile value + index in the array
 */

import type { Tile } from '@/types/bindings';

/**
 * Generate a stable key for a tile at a specific index
 * @param tile - The tile value (0-36)
 * @param index - Position in the array
 * @returns A unique key string like "tile-5-0" for first occurrence of tile 5
 */
export function tileKey(tile: Tile, index: number): string {
  return `tile-${tile}-${index}`;
}

/**
 * Generate keys for an array of tiles
 * @param tiles - Array of tile values
 * @returns Array of {tile, key} objects
 */
export function tilesWithKeys(tiles: Tile[]): Array<{ tile: Tile; key: string }> {
  return tiles.map((tile, index) => ({
    tile,
    key: tileKey(tile, index),
  }));
}

/**
 * Parse a tile key back into its components
 * @param key - A key like "tile-5-0"
 * @returns {tile, index} or null if invalid
 */
export function parseTileKey(key: string): { tile: Tile; index: number } | null {
  const match = key.match(/^tile-(\d+)-(\d+)$/);
  if (!match) return null;

  return {
    tile: parseInt(match[1], 10),
    index: parseInt(match[2], 10),
  };
}

/**
 * Get the tile value from a key without parsing the full object
 * @param key - A key like "tile-5-0"
 * @returns The tile value or null if invalid
 */
export function tileFromKey(key: string): Tile | null {
  const parsed = parseTileKey(key);
  return parsed ? parsed.tile : null;
}
