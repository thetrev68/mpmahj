/**
 * Format wall remaining count with draw percentage.
 *
 * Ported from former terminal UI: format_wall()
 */
export function formatWall(remainingTiles: number): string {
  const TOTAL_TILES = 152;
  const DEAD_WALL = 14;
  const DEALT_TILES = 52;
  const DRAWABLE_TILES = TOTAL_TILES - DEAD_WALL - DEALT_TILES; // 86

  // Calculate percentage drawn
  const drawn = DRAWABLE_TILES - remainingTiles;
  const percentDrawn = Math.floor((drawn / DRAWABLE_TILES) * 100);

  return `${remainingTiles} tiles remaining (${percentDrawn}% drawn)`;
}

/**
 * Get wall depletion as a fraction (0.0 to 1.0).
 */
export function getWallDepletion(remainingTiles: number): number {
  const DRAWABLE_TILES = 86;
  const drawn = DRAWABLE_TILES - remainingTiles;
  return drawn / DRAWABLE_TILES;
}
