/**
 * @module OpponentRack
 *
 * Displays a condensed view of an opponent's concealed hand:
 * - Player identity (seat name, bot indicator)
 * - Tile count badge
 * - Face-down tile backs for each concealed tile
 *
 * Positioned relative to the local player's seat using CSS layout classes
 * passed in from the parent (PlayingPhase).
 *
 * @see {@link src/components/game/phases/PlayingPhase.tsx}
 */

import type { FC } from 'react';
import { Tile } from './Tile';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import { cn } from '@/lib/utils';
import { getOpponentPosition } from './opponentRackUtils';

/** Returns how many concealed tiles this player holds. */
function concealedCount(player: PublicPlayerInfo): number {
  const exposed = player.exposed_melds.reduce((sum, meld) => sum + meld.tiles.length, 0);
  return Math.max(0, player.tile_count - exposed);
}

interface OpponentRackProps {
  player: PublicPlayerInfo;
  yourSeat: Seat;
  /** Additional className for positioning (provided by parent). */
  className?: string;
}

/** Maps opponent position to the tile rotation that faces tiles toward the table center. */
const POSITION_TO_ROTATION: Record<'top' | 'left' | 'right', 'up' | 'left' | 'right' | undefined> =
  {
    top: 'up',
    right: 'right',
    left: 'left',
  };

export const OpponentRack: FC<OpponentRackProps> = ({ player, yourSeat, className }) => {
  const position = getOpponentPosition(yourSeat, player.seat);
  const concealed = concealedCount(player);
  const isVertical = position === 'left' || position === 'right';
  const tileRotation = POSITION_TO_ROTATION[position];
  const displayName = player.is_bot ? `${player.seat} (Bot)` : player.seat;

  return (
    <div
      className={cn('flex items-center gap-2', isVertical ? 'flex-col' : 'flex-col', className)}
      data-testid={`opponent-rack-${player.seat.toLowerCase()}`}
      aria-label={`${displayName}'s hand: ${concealed} concealed tiles`}
    >
      {/* Identity label */}
      <div className="flex items-center gap-1 text-xs text-slate-300 font-medium">
        <span data-testid={`opponent-seat-${player.seat.toLowerCase()}`}>{displayName}</span>
        <span
          className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-400"
          data-testid={`opponent-tile-count-${player.seat.toLowerCase()}`}
          aria-label={`${concealed} tiles`}
        >
          {concealed}
        </span>
      </div>

      {/* Concealed tile backs — rotated to face the table center */}
      <div className={cn('flex gap-0.5', isVertical ? 'flex-col' : 'flex-row')} aria-hidden="true">
        {Array.from({ length: concealed }).map((_, i) => (
          <Tile
            key={i}
            tile={0}
            faceUp={false}
            size="small"
            state="default"
            rotation={tileRotation}
            ariaLabel="Face-down tile"
          />
        ))}
      </div>
    </div>
  );
};

OpponentRack.displayName = 'OpponentRack';
