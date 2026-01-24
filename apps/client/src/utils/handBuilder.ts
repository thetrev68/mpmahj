import type { Hand } from '@/types/bindings/generated/Hand';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * Build a Hand payload from concealed tiles and exposed melds.
 */
export function buildHand(concealed: Tile[], exposed: Meld[]): Hand {
  const counts = Array.from({ length: 37 }, () => 0);
  concealed.forEach((tile) => {
    counts[tile] += 1;
  });

  return {
    concealed,
    counts,
    exposed,
    joker_assignments: null,
  };
}
