/**
 * TurnIndicator Component
 *
 * Displays visual indicator for whose turn it is and what stage they're in.
 * Shows a highlighted badge at each player's position indicating active turn.
 *
 * Related: US-009 (Drawing a Tile), US-010 (Discarding a Tile)
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

export interface TurnIndicatorProps {
  /** Which seat is active */
  currentSeat: Seat;
  /** Current turn stage */
  stage: TurnStage | null;
  /** Is this the current user's turn */
  isMyTurn?: boolean;
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
 * TurnIndicator shows whose turn it is with a visual badge
 */
export const TurnIndicator: React.FC<TurnIndicatorProps> = ({
  currentSeat,
  stage,
  isMyTurn = false,
}) => {
  const stageName = getStageName(stage);

  // Position badges around the board
  const positions: Record<Seat, string> = {
    East: 'right-[8%] top-1/2 -translate-y-1/2',
    South: 'bottom-[18%] left-1/2 -translate-x-1/2',
    West: 'left-[8%] top-1/2 -translate-y-1/2',
    North: 'top-[12%] left-1/2 -translate-x-1/2',
  };

  return (
    <>
      {(['East', 'South', 'West', 'North'] as Seat[]).map((seat) => {
        const isActive = seat === currentSeat;
        if (!isActive) return null;

        return (
          <div
            key={seat}
            className={cn('fixed', positions[seat], 'z-10')}
            data-testid={`turn-indicator-${seat.toLowerCase()}`}
            role="status"
            aria-live="polite"
            aria-label={`${seat}'s turn${stageName ? ` - ${stageName}` : ''}`}
          >
            <Badge
              variant={isMyTurn ? 'default' : 'secondary'}
              className={cn(
                'text-sm font-bold px-3 py-1.5 shadow-lg border-2 transition-all',
                isMyTurn
                  ? 'bg-green-600 border-green-400 text-white animate-pulse'
                  : 'bg-yellow-500 border-yellow-300 text-gray-900'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>
                  {seat}
                  {stageName && <span className="ml-1 text-xs opacity-90">({stageName})</span>}
                </span>
              </span>
            </Badge>
          </div>
        );
      })}
    </>
  );
};

TurnIndicator.displayName = 'TurnIndicator';
