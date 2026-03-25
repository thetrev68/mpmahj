/**
 * WallCounter Component
 *
 * Displays remaining tiles in the wall and indicates end-of-wall thresholds.
 * Styled to match the tracker chrome family (green gradient) rather than
 * a standalone black floating widget.
 *
 * Related: US-001 (Roll Dice & Break Wall), US-009 (Turn flow visibility)
 */

import type { FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { cn } from '@/lib/utils';

interface WallCounterProps {
  /** Number of tiles remaining in the wall */
  remainingTiles: number;
  /** Total tiles at start */
  totalTiles: number;
  /** Whether drawing from dead wall */
  isDeadWall?: boolean;
}

// Threshold constants for color states
const WALL_THRESHOLD_CRITICAL = 20;
const WALL_THRESHOLD_WARNING = 40;

/**
 * Get color based on remaining tiles
 */
function getWallCounterColor(remaining: number): string {
  if (remaining < WALL_THRESHOLD_CRITICAL) {
    return 'text-red-400'; // Critical
  } else if (remaining < WALL_THRESHOLD_WARNING) {
    return 'text-orange-400'; // Warning
  }
  return 'text-emerald-300'; // Safe — matches chrome accent
}

/**
 * WallCounter displays the number of tiles remaining in the wall
 */
export const WallCounter: FC<WallCounterProps> = ({
  remainingTiles,
  totalTiles,
  isDeadWall = false,
}) => {
  const { isEnabled } = useAnimationSettings();
  const showMotion = isEnabled();
  const colorClass = getWallCounterColor(remainingTiles);
  const isLow = remainingTiles <= WALL_THRESHOLD_CRITICAL;
  const isExhausted = remainingTiles === 0;

  return (
    <div
      className="w-fit rounded-2xl border border-emerald-500/25 px-4 py-1.5 text-white shadow-md"
      style={{
        background: 'linear-gradient(to right, rgba(12,35,18,0.92), rgba(18,52,28,0.92))',
        borderColor: 'rgba(80,160,100,0.25)',
      }}
      data-testid="wall-counter"
      data-chrome-layer="z-20"
      role="status"
      aria-live="polite"
      aria-label={`${remainingTiles} tiles remaining out of ${totalTiles}${isDeadWall ? ', drawing from dead wall' : ''}${isLow ? ', wall is low' : ''}`}
    >
      <div className="flex flex-col gap-1">
        {/* Tiles Remaining */}
        <div className="text-sm font-bold">
          <span className="text-gray-300">Wall: </span>
          <span className={cn('font-bold', colorClass)} data-testid="wall-counter-value">
            {remainingTiles}
          </span>
          <span className="text-gray-400"> / {totalTiles}</span>
        </div>

        {/* Wall Low Warning (US-009 AC-7) */}
        {isLow && !isExhausted && (
          <Badge
            variant="destructive"
            className="text-xs w-fit bg-orange-600 border-orange-400"
            data-testid="wall-low-warning"
          >
            Warning: Wall Low - {remainingTiles} tiles remaining
          </Badge>
        )}

        {/* Wall Exhausted Warning (US-009 AC-8) */}
        {isExhausted && (
          <Badge
            variant="destructive"
            className={cn('text-xs w-fit bg-red-700 border-red-500', showMotion && 'animate-pulse')}
            data-testid="wall-exhausted-warning"
          >
            Wall Exhausted
          </Badge>
        )}

        {/* Dead Wall Badge */}
        {isDeadWall && (
          <Badge variant="destructive" className="text-xs w-fit" data-testid="dead-wall-badge">
            Dead Wall
          </Badge>
        )}
      </div>
    </div>
  );
};

WallCounter.displayName = 'WallCounter';
