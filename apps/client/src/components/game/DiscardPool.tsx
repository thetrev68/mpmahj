/**
 * DiscardPool Component
 *
 * Displays discarded tiles in the center of the table.
 * Shows tiles in a grid layout with the most recent discard highlighted.
 *
 * Related: US-010 - Discarding a Tile
 */

import React from 'react';
import { Tile } from './Tile';
import type { Tile as TileType } from '@/types/bindings/generated/Tile';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface DiscardedTileInfo {
  tile: TileType;
  discardedBy: Seat;
  turn: number;
  safe?: boolean;
  called?: boolean;
}

export interface DiscardPoolProps {
  /** Array of discarded tiles */
  discards: DiscardedTileInfo[];
  /** The most recent discard (highlighted) */
  mostRecentTile?: TileType;
}

export const DiscardPool: React.FC<DiscardPoolProps> = ({ discards, mostRecentTile }) => {
  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[400px]"
      data-testid="discard-pool"
      aria-label={`Discard pool: ${discards.length} tiles`}
    >
      <div className="grid grid-cols-6 gap-1">
        {discards.map((discard, index) => {
          const isRecent = mostRecentTile !== undefined && discard.tile === mostRecentTile;

          return (
            <div
              key={`discard-${discard.turn}-${index}`}
              data-testid={`discard-pool-tile-${index}`}
              className={isRecent ? 'ring-2 ring-yellow-400' : ''}
            >
              <Tile tile={discard.tile} state="default" size="small" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

DiscardPool.displayName = 'DiscardPool';
