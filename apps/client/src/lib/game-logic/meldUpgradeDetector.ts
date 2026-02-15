/**
 * Meld Upgrade Detection Utility (US-016)
 *
 * Detects which exposed melds are upgradeable during the Discarding stage,
 * given the player's current hand and exposed melds.
 *
 * Upgrade chain: Pung (3) → Kong (4) → Quint (5) → Sextet (6)
 * A meld is upgradeable if the player has a matching tile OR a Joker in hand.
 */

import type { Meld } from '@/types/bindings/generated/Meld';
import type { MeldType } from '@/types/bindings/generated/MeldType';
import type { Tile } from '@/types/bindings/generated/Tile';

const JOKER_TILE = 42;

/** The next meld type in the upgrade chain, or null if already at max. */
const UPGRADE_MAP: Partial<Record<MeldType, MeldType>> = {
  Pung: 'Kong',
  Kong: 'Quint',
  Quint: 'Sextet',
  // Sextet has no upgrade
};

/**
 * A single upgrade opportunity found for an exposed meld.
 */
export interface UpgradeOpportunity {
  /** Index of the meld in the player's exposed_melds array */
  meldIndex: number;
  /** The upgraded meld type if confirmed */
  upgrade: MeldType;
  /** The tile from the player's hand to add (matching base tile, or Joker) */
  tile: Tile;
}

/**
 * Find all exposed melds that can be upgraded using tiles in the player's hand.
 *
 * Prefers the base tile over a Joker when both are available.
 *
 * @param melds - Player's exposed melds
 * @param hand  - Player's concealed hand tiles
 * @returns Array of upgrade opportunities (empty if none found)
 */
export function findUpgradeableMelds(melds: Meld[], hand: Tile[]): UpgradeOpportunity[] {
  const result: UpgradeOpportunity[] = [];

  for (let i = 0; i < melds.length; i++) {
    const meld = melds[i];
    const upgrade = UPGRADE_MAP[meld.meld_type];
    if (!upgrade) continue; // Sextet or unknown type — cannot upgrade

    // Determine the base tile: prefer called_tile, fall back to first tile in meld
    const baseTile: Tile | null = meld.called_tile ?? meld.tiles[0] ?? null;

    if (baseTile === null) continue;

    const hasBaseTile = hand.includes(baseTile);
    const hasJoker = hand.includes(JOKER_TILE);

    if (hasBaseTile) {
      result.push({ meldIndex: i, upgrade, tile: baseTile });
    } else if (hasJoker) {
      result.push({ meldIndex: i, upgrade, tile: JOKER_TILE });
    }
  }

  return result;
}
