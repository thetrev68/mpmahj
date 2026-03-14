/**
 * MeldDisplay Component
 *
 * Displays a single exposed meld (Pung, Kong, Quint, or Sextet) with
 * visual indicator for which tile was called.
 *
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import type { FC } from 'react';
import { Tile } from './Tile';
import { getTileName } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';

interface MeldDisplayProps {
  /** The meld to display */
  meld: Meld & { called_from?: Seat };
  /** Display tiles smaller for opponents */
  compact?: boolean;
  /** Seat that owns this meld (used for call rotation direction) */
  ownerSeat?: Seat;
  /** Joker positions in this meld that can be exchanged */
  exchangeableTilePositions?: number[];
  /** Called when an exchangeable Joker tile is clicked */
  onJokerTileClick?: (tilePosition: number) => void;
}

type RotationDirection = 'left' | 'up' | 'right' | null;

const SEAT_ORDER: Seat[] = ['East', 'South', 'West', 'North'];

const getRotationDirection = (ownerSeat: Seat, calledFrom: Seat): RotationDirection => {
  const ownerIndex = SEAT_ORDER.indexOf(ownerSeat);
  const callerIndex = SEAT_ORDER.indexOf(calledFrom);
  if (ownerIndex < 0 || callerIndex < 0) return null;

  const offset = (callerIndex - ownerIndex + SEAT_ORDER.length) % SEAT_ORDER.length;
  if (offset === 1) return 'right';
  if (offset === 2) return 'up';
  if (offset === 3) return 'left';
  return null;
};

export const MeldDisplay: FC<MeldDisplayProps> = ({
  meld,
  compact = false,
  ownerSeat,
  exchangeableTilePositions = [],
  onJokerTileClick,
}) => {
  const { meld_type, tiles, called_tile, called_from } = meld;

  // Determine which tile in the array is the called tile
  // We'll rotate the first occurrence of the called tile
  const calledTileIndex = called_tile !== null ? tiles.indexOf(called_tile) : -1;

  const tileSize = compact ? 'small' : 'medium';
  const rotationDirection =
    called_from && ownerSeat ? getRotationDirection(ownerSeat, called_from) : null;

  // Get tile name for the meld (using first real tile, not joker)
  const realTile = tiles.find((t) => t !== 42); // 42 is Joker index
  const tileName = realTile !== undefined ? getTileName(realTile) : 'tiles';

  const meldLabel = `${meld_type} of ${tileName}`;

  return (
    <div
      className={cn('flex flex-col items-center gap-1', compact && 'scale-90')}
      data-testid="meld-display"
      data-compact={compact}
      role="group"
      aria-label={meldLabel}
    >
      {/* Meld type label */}
      <div
        className="text-xs font-medium text-white/80 uppercase tracking-wide"
        data-testid="meld-type-label"
      >
        {meld_type}
      </div>

      {/* Tiles */}
      <div className="flex gap-0.5">
        {tiles.map((tile, index) => {
          const isCalledTile = index === calledTileIndex;
          const isExchangeableJoker = exchangeableTilePositions.includes(index);
          const representedTile = meld.joker_assignments?.[index];
          const tileElement = (
            <Tile
              tile={tile}
              size={tileSize}
              rotated={isCalledTile}
              rotation={isCalledTile ? rotationDirection || undefined : undefined}
              state="default"
              testId={`tile-${tile}-${index}`}
            />
          );

          return (
            <div
              key={`meld-tile-${index}`}
              data-testid={isCalledTile ? `meld-called-tile-${index}` : undefined}
              data-rotated={isCalledTile || undefined}
              data-rotation={isCalledTile ? rotationDirection || undefined : undefined}
              aria-label={
                isCalledTile ? `${getTileName(tile)}, called from discard` : getTileName(tile)
              }
            >
              {isExchangeableJoker && representedTile !== undefined ? (
                <button
                  type="button"
                  className="rounded ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent cursor-pointer"
                  data-testid="joker-tile-exchangeable"
                  aria-label={`Exchange Joker for ${getTileName(representedTile)} - click to exchange`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onJokerTileClick?.(index);
                  }}
                >
                  {tileElement}
                </button>
              ) : (
                tileElement
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

MeldDisplay.displayName = 'MeldDisplay';
