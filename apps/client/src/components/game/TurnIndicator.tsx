/**
 * TurnIndicator Component
 *
 * Displays visual indicator for whose turn it is and what stage they're in.
 * Shows a highlighted badge at each player's position indicating active turn.
 * Also shows a red DEAD HAND badge for players with invalid Mahjong claims.
 *
 * Related: US-009 (Drawing a Tile), US-010 (Discarding a Tile), US-020 (Dead Hand)
 */

import type { FC } from 'react';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

interface TurnIndicatorProps {
  /** Which seat is active */
  currentSeat: Seat;
  /** Current turn stage */
  stage: TurnStage | null;
  /** Is this the current user's turn */
  isMyTurn?: boolean;
  /** Seats whose hands have been declared dead (US-020) */
  deadHandSeats?: Seat[];
}

/**
 * Get stage name for display
 */
function getStageName(stage: TurnStage | null): string {
  if (!stage || typeof stage !== 'object') return '';

  if ('Drawing' in stage) return 'Drawing';
  if ('Discarding' in stage) return 'Discarding';
  if ('CallWindow' in stage) return 'Call Window';
  if ('AwaitingMahjong' in stage) return 'Awaiting Mahjong';
  return '';
}

/**
 * TurnIndicator shows whose turn it is with a visual badge.
 * Dead hand seats show a red DEAD HAND badge at their position.
 */
export const TurnIndicator: FC<TurnIndicatorProps> = ({
  currentSeat,
  stage,
  isMyTurn = false,
  deadHandSeats = [],
}) => {
  const stageName = getStageName(stage);
  const { isEnabled } = useAnimationSettings();
  const showMotion = isEnabled();

  // Position badges around the board
  const positions: Record<Seat, { className: string; anchor: string; deadHandOffset?: string }> = {
    East: {
      className: 'right-3 top-1/2 -translate-y-1/2',
      anchor: 'east-edge',
      deadHandOffset: 'mt-10',
    },
    South: {
      className: 'bottom-28 left-1/2 -translate-x-1/2',
      anchor: 'south-player-zone',
      deadHandOffset: '-mt-10',
    },
    West: {
      className: 'left-3 top-1/2 -translate-y-1/2',
      anchor: 'west-edge',
      deadHandOffset: 'mt-10',
    },
    North: {
      className: 'top-4 left-1/2 -translate-x-1/2',
      anchor: 'north-edge',
      deadHandOffset: 'mt-10',
    },
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      data-testid="turn-indicator-layer"
      data-positioning="board-relative"
    >
      {/* Turn indicator for active seat */}
      {(['East', 'South', 'West', 'North'] as Seat[]).map((seat) => {
        const isActive = seat === currentSeat;
        if (!isActive) return null;

        return (
          <div
            key={seat}
            className={cn('absolute', positions[seat].className)}
            data-testid={`turn-indicator-${seat.toLowerCase()}`}
            data-anchor={positions[seat].anchor}
            role="status"
            aria-live="polite"
            aria-label={`${seat}'s turn${stageName ? ` - ${stageName}` : ''}`}
          >
            <Badge
              variant={isMyTurn ? 'default' : 'secondary'}
              className={cn(
                'text-sm font-bold px-3 py-1.5 shadow-lg border-2 transition-all',
                isMyTurn
                  ? 'bg-green-600 border-green-400 text-white'
                  : 'bg-yellow-500 border-yellow-300 text-gray-900',
                isMyTurn && showMotion && 'animate-pulse'
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn('w-2 h-2 rounded-full bg-current', showMotion && 'animate-pulse')}
                />
                <span>
                  {seat}
                  {stageName && <span className="ml-1 text-xs opacity-90">({stageName})</span>}
                </span>
              </span>
            </Badge>
          </div>
        );
      })}

      {/* Dead hand badges for all dead-hand players (US-020, AC-5) */}
      {deadHandSeats.map((seat) => (
        <div
          key={`dead-${seat}`}
          className={cn('absolute', positions[seat].className, positions[seat].deadHandOffset)}
          data-testid={`dead-hand-badge-${seat.toLowerCase()}`}
          data-anchor={positions[seat].anchor}
          role="status"
          aria-label={`${seat} has a dead hand`}
        >
          <span className="bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded-full tracking-widest shadow-lg">
            DEAD HAND
          </span>
        </div>
      ))}
    </div>
  );
};

TurnIndicator.displayName = 'TurnIndicator';
