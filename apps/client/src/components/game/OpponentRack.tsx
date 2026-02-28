/**
 * @module OpponentRack
 *
 * Displays a condensed view of an opponent's concealed hand:
 * - Player identity (seat name, bot indicator)
 * - Face-down tile backs for each concealed tile
 *
 * Positioned relative to the local player's seat using CSS layout classes
 * passed in from the parent (PlayingPhase).
 *
 * @see `src/components/game/phases/PlayingPhase.tsx`
 */

import type { FC } from 'react';
import { ExposedMeldsArea } from './ExposedMeldsArea';
import { Tile } from './Tile';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import { cn } from '@/lib/utils';
import { getOpponentPosition } from './opponentRackUtils';
import { RACK_WOOD_STYLE } from './rackStyles';

/** Returns how many concealed tiles this player holds. */
function concealedCount(
  player: PublicPlayerInfo,
  melds: Array<Meld & { called_from?: Seat }>
): number {
  const exposed = melds.reduce((sum, meld) => sum + meld.tiles.length, 0);
  return Math.max(0, player.tile_count - exposed);
}

interface OpponentRackProps {
  player: PublicPlayerInfo;
  yourSeat: Seat;
  melds?: Array<Meld & { called_from?: Seat }>;
  charlestonReadyCount?: number;
  /** Additional className for positioning (provided by parent). */
  className?: string;
}

const OPPONENT_TILE_WIDTH_PX = 32;
const TILE_GAP_PX = 2;
const OPPONENT_RACK_SPAN_PX = OPPONENT_TILE_WIDTH_PX * 19 + TILE_GAP_PX * 18;

/** Maps opponent position to the tile rotation that faces tiles toward the table center. */
const POSITION_TO_ROTATION: Record<'top' | 'left' | 'right', 'up' | 'left' | 'right' | undefined> =
  {
    top: 'up',
    right: 'right',
    left: 'left',
  };

export const OpponentRack: FC<OpponentRackProps> = ({
  player,
  yourSeat,
  melds,
  charlestonReadyCount,
  className,
}) => {
  const rackMelds = melds ?? player.exposed_melds;
  const position = getOpponentPosition(yourSeat, player.seat);
  const concealed = concealedCount(player, rackMelds);
  const isVertical = position === 'left' || position === 'right';
  const tileRotation = POSITION_TO_ROTATION[position];
  const displayName = player.is_bot ? `${player.seat} (Bot)` : player.seat;
  const seatKey = player.seat.toLowerCase();
  const stagingCount =
    charlestonReadyCount === undefined ? 0 : Math.min(3, Math.max(0, charlestonReadyCount));
  const shouldRenderStaging = stagingCount > 0;
  const rackShellClass =
    position === 'top'
      ? 'flex flex-col-reverse gap-1'
      : position === 'right'
        ? 'flex flex-row items-stretch gap-1'
        : 'flex flex-row-reverse items-stretch gap-1';
  const rackShellStyle = {
    ...RACK_WOOD_STYLE,
    ...(isVertical
      ? { height: `${OPPONENT_RACK_SPAN_PX}px` }
      : { width: `${OPPONENT_RACK_SPAN_PX}px` }),
  };
  const concealedRowClass = cn('flex gap-0.5', isVertical ? 'h-full flex-col' : 'w-full flex-row');
  const stagingRowClass = cn(
    'flex gap-0.5',
    isVertical ? 'h-full flex-col justify-center' : 'w-full flex-row justify-center'
  );
  const meldRowClass = cn(
    'rounded-sm',
    isVertical ? 'h-full min-w-[46px]' : 'w-full',
    !isVertical && 'min-h-[46px]'
  );
  const meldRowStyle = isVertical
    ? { minHeight: `${OPPONENT_RACK_SPAN_PX}px`, background: 'rgba(0,0,0,0.12)' }
    : { minHeight: '46px', background: 'rgba(0,0,0,0.12)' };
  const stagingRow = shouldRenderStaging ? (
    <div className={stagingRowClass} data-testid={`opponent-staging-${seatKey}`} aria-hidden="true">
      {Array.from({ length: stagingCount }).map((_, i) => (
        <Tile
          key={`staging-${i}`}
          tile={0}
          faceUp={false}
          size="small"
          state="default"
          rotation={tileRotation}
          ariaLabel="Face-down tile"
          testId={`staging-tile-${seatKey}-${i}`}
        />
      ))}
    </div>
  ) : null;

  return (
    <div
      className={cn('flex flex-col items-center gap-2', className)}
      data-testid={`opponent-rack-${seatKey}`}
      aria-label={`${displayName}'s hand: ${concealed} concealed tiles`}
    >
      <div
        className={cn('rounded-md px-1.5 pt-1 pb-2', rackShellClass)}
        style={rackShellStyle}
        data-testid={`opponent-rack-shell-${seatKey}`}
      >
        {isVertical ? stagingRow : null}

        <div
          className={meldRowClass}
          data-testid={`opponent-meld-row-${seatKey}`}
          style={meldRowStyle}
        >
          {rackMelds.length > 0 ? (
            <ExposedMeldsArea melds={rackMelds} compact={true} ownerSeat={player.seat} />
          ) : null}
        </div>

        {/* Concealed tile backs — rotated to face the table center */}
        <div
          className={concealedRowClass}
          data-testid={`opponent-concealed-row-${seatKey}`}
          aria-hidden="true"
        >
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

      {!isVertical ? stagingRow : null}

      {/* Identity label */}
      <div className="bg-black/60 rounded-b-md px-2 py-1 text-xs text-slate-200 font-medium flex items-center">
        <span data-testid={`opponent-seat-${seatKey}`}>{displayName}</span>
      </div>
    </div>
  );
};

OpponentRack.displayName = 'OpponentRack';
