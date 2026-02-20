/**
 * Call Intent Calculator
 *
 * Pure function for calculating meld tiles based on player intent.
 * Extracted from GameBoard.tsx lines 1531-1574.
 *
 * Determines if a player can call a discarded tile for a meld
 * (Pung, Kong, Quint, or Sextet) based on tiles in their hand.
 *
 * Benefits:
 * - Pure function (testable in isolation)
 * - Reusable (can be used in AI logic, validation, etc.)
 * - Type-safe (explicit input/output types)
 * - Clear error handling (success flag + error message)
 */

import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * Tile indices for special tiles
 */
export const TILE_INDICES = {
  JOKER: 42 as Tile,
  BLANK: 43 as Tile,
} as const;

/**
 * Meld type (same as server bindings)
 */
type MeldType = 'Pung' | 'Kong' | 'Quint' | 'Sextet';

/**
 * Input for call intent calculation
 */
interface CallIntentInput {
  /** The tile being called (from discard pool) */
  tile: Tile;
  /** Count of tiles in player's hand (map of tile -> count) */
  tileCounts: Map<Tile, number>;
  /** Type of meld the player wants to call */
  intent: MeldType;
}

/**
 * Result of call intent calculation
 */
interface CallIntentResult {
  /** Whether the call is valid */
  success: boolean;
  /** Tiles for the meld (including called tile), if successful */
  meldTiles?: Tile[];
  /** Error message, if unsuccessful */
  error?: string;
}

/**
 * Meld sizes for each meld type
 */
const MELD_SIZES: Record<MeldType, number> = {
  Pung: 3,
  Kong: 4,
  Quint: 5,
  Sextet: 6,
} as const;

/**
 * Calculate call intent for a meld
 *
 * Determines if the player has enough tiles (matching + jokers)
 * to form the requested meld. Prefers using natural tiles over jokers.
 *
 * Algorithm:
 * 1. Determine meld size (3, 4, 5, or 6)
 * 2. Calculate required tiles from hand (meld size - 1, since called tile is from discard)
 * 3. Count matching tiles and jokers in hand
 * 4. Check if total available tiles >= required
 * 5. Prefer natural tiles over jokers when constructing meld
 *
 * @param input - Call intent parameters
 * @returns Result with success flag, meld tiles (if successful), or error message
 *
 * @example
 * ```typescript
 * // Player has 2 of tile 5 and 1 joker, wants to call tile 5 for Pung
 * const result = calculateCallIntent({
 *   tile: 5,
 *   tileCounts: new Map([[5, 2], [TILE_INDICES.JOKER, 1]]),
 *   intent: 'Pung',
 * });
 * // result.success === true
 * // result.meldTiles === [5, 5, 5]
 * ```
 */
export function calculateCallIntent(input: CallIntentInput): CallIntentResult {
  const { tile, tileCounts, intent } = input;

  // Determine meld size and required tiles from hand
  const meldSize = MELD_SIZES[intent];
  const requiredFromHand = meldSize - 1; // -1 because called tile comes from discard

  // Count matching tiles and jokers in hand
  const matchingInHand = tileCounts.get(tile) ?? 0;
  const jokersInHand = tileCounts.get(TILE_INDICES.JOKER) ?? 0;

  // Check if player has enough tiles
  const available = matchingInHand + jokersInHand;
  if (available < requiredFromHand) {
    return {
      success: false,
      error: `Not enough tiles to call ${intent}. Need ${requiredFromHand} more tiles (have ${available}).`,
    };
  }

  // Construct meld tiles, preferring natural tiles over jokers
  const useNatural = Math.min(matchingInHand, requiredFromHand);
  const useJokers = requiredFromHand - useNatural;

  const meldTiles: Tile[] = [
    tile, // Called tile (from discard)
    ...Array(useNatural).fill(tile), // Natural tiles from hand
    ...Array(useJokers).fill(TILE_INDICES.JOKER), // Jokers from hand
  ];

  return {
    success: true,
    meldTiles,
  };
}
