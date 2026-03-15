/**
 * DiscardPool Component
 *
 * Displays discarded tiles in the center of the table.
 * Shows tiles in a grid layout with the most recent discard highlighted.
 *
 * Related: US-010 - Discarding a Tile
 */

import type { FC } from 'react';
import { Tile } from './Tile';
import type { Tile as TileType } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';

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
}

export const DiscardPool: FC<DiscardPoolProps> = ({ discards, mostRecentTile, callableTile }) => {
  return (
    <div
      className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[678px]
        grid grid-cols-[repeat(10,32px)] lg:grid-cols-[repeat(20,32px)] gap-0.5 bg-black/15 rounded-lg p-2"
      data-testid="discard-pool"
      aria-label={`Discard pool: ${discards.length} tiles`}
    >
      {discards.map((discard, index) => {
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
