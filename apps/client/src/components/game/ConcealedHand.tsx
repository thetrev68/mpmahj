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
import { isJoker } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TileInstance } from './types';

export interface ConcealedHandProps {
  /** Player's current hand tiles */
  tiles: TileInstance[];
  /** Interaction mode */
  mode: 'charleston' | 'discard' | 'view-only';
  /** Currently selected tile values */
  selectedTileIds?: string[];
  /** Called when a tile is clicked */
  onTileSelect: (tileId: string) => void;
  /** Maximum tiles that can be selected (default: 3 for charleston, 1 for discard) */
  maxSelection?: number;
  /** Disable all interaction */
  disabled?: boolean;
  /** Tile ids that are disabled (e.g., Jokers in Charleston) */
  disabledTileIds?: string[];
  /** Optional selection error to display as tooltip */
  selectionError?: { tileId: string; message: string } | null;
  /** Tile ids to highlight (e.g., newly received tiles) */
  highlightedTileIds?: string[];
  /** Tile ids currently leaving the hand (pass animation) */
  leavingTileIds?: string[];
}

export const ConcealedHand: React.FC<ConcealedHandProps> = ({
  tiles,
  mode,
  selectedTileIds = [],
  onTileSelect,
  maxSelection = mode === 'charleston' ? 3 : 1,
  disabled = false,
  disabledTileIds = [],
  selectionError = null,
  highlightedTileIds = [],
  leavingTileIds = [],
}) => {
  const sortedTiles = [...tiles].sort((a, b) => a.tile - b.tile);
  const isInteractive = mode !== 'view-only' && !disabled;

  const getTileState = (
    tile: TileInstance
  ): 'default' | 'selected' | 'disabled' | 'highlighted' => {
    if (selectedTileIds.includes(tile.id)) return 'selected';
    if (highlightedTileIds.includes(tile.id)) return 'highlighted';
    if (disabledTileIds.includes(tile.id)) return 'disabled';
    if (mode === 'charleston' && isJoker(tile.tile)) return 'disabled';
    return 'default';
  };

  const handleTileClick = (tileId: string) => {
    if (!isInteractive) return;
    onTileSelect(tileId);
  };

  return (
    <div
      className={cn('flex flex-col items-center gap-2', 'fixed bottom-4 left-1/2 -translate-x-1/2')}
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
          {selectedTileIds.length}/{maxSelection} selected
        </div>
      )}

      {/* Tile rack */}
      <div className="flex gap-0.5">
        {sortedTiles.map((tile, index) => {
          const state = getTileState(tile);
          const isJokerDisabled = mode === 'charleston' && isJoker(tile.tile);
          const isLeaving = leavingTileIds.includes(tile.id);
          const errorMessage = selectionError?.tileId === tile.id ? selectionError.message : null;
          return (
            <TooltipProvider key={`${tile.id}-${index}`} delayDuration={150}>
              <Tooltip open={!!errorMessage}>
                <TooltipTrigger asChild>
                  <div>
                    <Tile
                      tile={tile.tile}
                      state={state}
                      size="medium"
                      onClick={isInteractive ? () => handleTileClick(tile.id) : undefined}
                      allowDisabledClick={isInteractive && isJokerDisabled}
                      testId={`tile-${tile.tile}-${tile.id}`}
                      newlyDrawn={highlightedTileIds.includes(tile.id)}
                      className={cn(
                        isJokerDisabled && 'tile-joker-disabled',
                        isLeaving && 'tile-leaving'
                      )}
                    />
                  </div>
                </TooltipTrigger>
                {errorMessage && (
                  <TooltipContent side="top" align="center">
                    {errorMessage}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};

ConcealedHand.displayName = 'ConcealedHand';
