/**
 * ConcealedHand Component
 *
 * Displays the current player's concealed tiles in a horizontal rack
 * with selection support for Charleston tile passing.
 *
 * Related: US-002 (Charleston), US-009 (Discard), US-010 (Discard selection)
 */

import React from 'react';
import { Tile } from './Tile';
import { isJoker, sortHand } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import type { Tile as TileType } from '@/types/bindings';

export interface ConcealedHandProps {
  /** Player's current hand tiles */
  tiles: TileType[];
  /** Interaction mode */
  mode: 'charleston' | 'discard' | 'view-only';
  /** Currently selected tile values */
  selectedTiles?: TileType[];
  /** Called when a tile is clicked */
  onTileSelect: (tile: TileType) => void;
  /** Maximum tiles that can be selected (default: 3 for charleston, 1 for discard) */
  maxSelection?: number;
  /** Disable all interaction */
  disabled?: boolean;
}

export const ConcealedHand: React.FC<ConcealedHandProps> = ({
  tiles,
  mode,
  selectedTiles = [],
  onTileSelect,
  maxSelection = mode === 'charleston' ? 3 : 1,
  disabled = false,
}) => {
  const sortedTiles = sortHand(tiles);
  const isInteractive = mode !== 'view-only' && !disabled;

  const getTileState = (tile: TileType): 'default' | 'selected' | 'disabled' => {
    if (selectedTiles.includes(tile)) return 'selected';
    if (mode === 'charleston' && isJoker(tile)) return 'disabled';
    return 'default';
  };

  const handleTileClick = (tile: TileType) => {
    if (!isInteractive) return;
    if (mode === 'charleston' && isJoker(tile)) return;
    onTileSelect(tile);
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2',
        'fixed bottom-4 left-1/2 -translate-x-1/2',
      )}
      data-testid="concealed-hand"
      aria-label={`Your hand: ${tiles.length} tiles`}
    >
      {/* Selection counter (only in interactive modes) */}
      {mode !== 'view-only' && (
        <div
          className="text-white text-sm font-medium"
          data-testid="selection-counter"
          aria-live="polite"
        >
          {selectedTiles.length}/{maxSelection} selected
        </div>
      )}

      {/* Tile rack */}
      <div className="flex gap-0.5">
        {sortedTiles.map((tile, index) => {
          const state = getTileState(tile);
          return (
            <Tile
              key={`${tile}-${index}`}
              tile={tile}
              state={state}
              size="medium"
              onClick={isInteractive && state !== 'disabled' ? handleTileClick : undefined}
              testId={`tile-${tile}`}
            />
          );
        })}
      </div>
    </div>
  );
};

ConcealedHand.displayName = 'ConcealedHand';
