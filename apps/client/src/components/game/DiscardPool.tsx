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

/** Deterministic ±5° rotation based on tile position — avoids randomness on re-render. */
function tileRotation(seed: number): number {
  // Simple hash: spread seeds across -5..+5 range
  return ((seed * 7 + 3) % 11) - 5;
}

export const DiscardPool: FC<DiscardPoolProps> = ({
  discards,
  mostRecentTile,
  callableTile,
}) => {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%]
        bg-black/15 rounded-lg p-4 flex flex-wrap gap-1.5 content-start overflow-auto"
      data-testid="discard-pool"
      aria-label={`Discard pool: ${discards.length} tiles`}
    >
      {discards.map((discard, index) => {
        const isRecent = mostRecentTile !== undefined && discard.tile === mostRecentTile;
        const isCallable = callableTile !== undefined && discard.tile === callableTile;
        const rotation = tileRotation(discard.turn * 100 + index);

        return (
          <div
            key={`discard-${discard.turn}-${index}`}
            data-testid={`discard-pool-tile-${index}`}
            className={`transition-transform ${isCallable || isRecent ? 'ring-2 ring-yellow-400 rounded-sm' : ''}`}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <Tile tile={discard.tile} state="default" size="small" />
          </div>
        );
      })}
    </div>
  );
};

DiscardPool.displayName = 'DiscardPool';
