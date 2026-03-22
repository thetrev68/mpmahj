/**
 * DiscardPool Component
 *
 * Displays discarded tiles in the center of the table.
 * Shows tiles in a grid layout with the most recent discard highlighted.
 *
 * Related: US-010 - Discarding a Tile
 */

import { type FC, useMemo } from 'react';
import { Tile } from './Tile';
import type { Tile as TileType } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';
import { canonicalTileComparator } from '@/lib/utils/tileUtils';

interface DiscardedTileInfo {
  tile: TileType;
  discardedBy: Seat;
  turn: number;
  safe?: boolean;
  called?: boolean;
}

interface DiscardPoolProps {
  /** Array of discarded tiles */
  discards: DiscardedTileInfo[];
  /** The most recent discard (highlighted) */
  mostRecentTile?: TileType;
  /** Tile being called in the current call window (highlighted) */
  callableTile?: TileType;
  /** When true, display tiles in canonical sort order instead of chronological */
  sortDiscards?: boolean;
}

export const DiscardPool: FC<DiscardPoolProps> = ({
  discards,
  mostRecentTile,
  callableTile,
  sortDiscards = false,
}) => {
  const displayDiscards = useMemo(
    () =>
      sortDiscards
        ? [...discards].sort((a, b) => canonicalTileComparator(a.tile, b.tile))
        : discards,
    [discards, sortDiscards]
  );

  return (
    <div
      className="grid w-full max-w-[678px] grid-cols-[repeat(10,32px)] gap-0.5 self-center justify-self-center rounded-lg bg-black/15 p-2 lg:grid-cols-[repeat(20,32px)]"
      data-testid="discard-pool"
      aria-label={`Discard pool: ${discards.length} tiles`}
    >
      {displayDiscards.map((discard, index) => {
        const isRecent = mostRecentTile !== undefined && discard.tile === mostRecentTile;
        const isCallable = callableTile !== undefined && discard.tile === callableTile;

        return (
          <div
            key={`discard-${discard.turn}-${index}`}
            data-testid={`discard-pool-tile-${index}`}
            className={isCallable || isRecent ? 'ring-2 ring-yellow-400 rounded-sm' : undefined}
          >
            <Tile tile={discard.tile} state="default" size="small" />
          </div>
        );
      })}
    </div>
  );
};

DiscardPool.displayName = 'DiscardPool';
