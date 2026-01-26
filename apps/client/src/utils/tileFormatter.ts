import type { Tile } from '@/types/bindings/generated/Tile';
import type { Meld } from '@/types/bindings/generated/Meld';

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

  return '??';
}

/**
 * Convert Tile index to SVG asset path.
 *
 * @param tile - Tile index (0-36)
 * @returns Path to SVG asset from /assets/tiles/, or null if no SVG exists
 *
 * @example
 * tileToSvgPath(2)  // "/assets/tiles/Mahjong_3s.svg"
 * tileToSvgPath(27) // "/assets/tiles/Mahjong_E.svg"
 * tileToSvgPath(36) // null (Blank tile has no SVG)
 */
export function tileToSvgPath(tile: Tile): string | null {
  const basePath = '/assets/tiles/';

  // Bams: 0-8 → Mahjong_1s to 9s (s = sous)
  if (tile >= 0 && tile <= 8) {
    return `${basePath}Mahjong_${tile + 1}s.svg`;
  }

  // Cracks: 9-17 → Mahjong_1m to 9m (m = mans)
  if (tile >= 9 && tile <= 17) {
    return `${basePath}Mahjong_${tile - 9 + 1}m.svg`;
  }

  // Dots: 18-26 → Mahjong_1p to 9p (p = pins)
  if (tile >= 18 && tile <= 26) {
    return `${basePath}Mahjong_${tile - 18 + 1}p.svg`;
  }

  // Winds: 27-30 → E, S, W, N
  switch (tile) {
    case 27:
      return `${basePath}Mahjong_E.svg`;
    case 28:
      return `${basePath}Mahjong_S.svg`;
    case 29:
      return `${basePath}Mahjong_W.svg`;
    case 30:
      return `${basePath}Mahjong_N.svg`;
  }

  // Dragons: 31-33 → Note: H=White(blank), R=Green, T=Red in this tile set
  switch (tile) {
    case 31:
      return `${basePath}Mahjong_R.svg`; // Green Dragon
    case 32:
      return `${basePath}Mahjong_T.svg`; // Red Dragon
    case 33:
      return `${basePath}Mahjong_H.svg`; // White Dragon (Soap/blank)
  }

  // Special tiles: 34-36
  switch (tile) {
    case 34:
      return `${basePath}Mahjong_F_Winter.svg`; // Flower
    case 35:
      return `${basePath}U+1F02A_MJjoker.svg`; // Joker
    case 36:
      return null; // Blank - no SVG available
  }

  return null; // Unknown tile
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

/**
 * Convert a histogram (tile counts array) to a readable tile list.
 *
 * @param histogram - Array of tile counts (indices 0-41)
 * @returns Formatted string showing tiles with their counts
 *
 * @example
 * histogramToString([2, 0, 3, 0, 4, ...]) // "1B 1B 3B 3B 3B 5B 5B 5B 5B"
 */
export function histogramToString(histogram: number[]): string {
  const tiles: string[] = [];

  for (let i = 0; i < histogram.length && i < 42; i++) {
    const count = histogram[i];
    for (let j = 0; j < count; j++) {
      tiles.push(tileToCode(i as Tile));
    }
  }

  return tiles.join(' ');
}
