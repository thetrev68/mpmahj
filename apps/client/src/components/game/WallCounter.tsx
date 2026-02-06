/**
 * WallCounter Component
 *
 * Displays remaining tiles in the wall and indicates end-of-wall thresholds.
 *
 * Related: US-001 (Roll Dice & Break Wall), US-009 (Turn flow visibility)
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface WallCounterProps {
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
    return 'text-red-500'; // Critical
  } else if (remaining < WALL_THRESHOLD_WARNING) {
    return 'text-orange-500'; // Warning
  }
  return 'text-green-500'; // Safe
}

/**
 * WallCounter displays the number of tiles remaining in the wall
 */
export const WallCounter: React.FC<WallCounterProps> = ({
  remainingTiles,
  totalTiles,
  isDeadWall = false,
}) => {
  const colorClass = getWallCounterColor(remainingTiles);

  return (
    <Card
      className="fixed top-[60px] left-4 bg-black/85 text-white px-5 py-2.5 shadow-lg"
      data-testid="wall-counter"
      role="status"
      aria-live="polite"
      aria-label={`${remainingTiles} tiles remaining out of ${totalTiles}${isDeadWall ? ', drawing from dead wall' : ''}`}
    >
      <div className="flex flex-col gap-1">
        {/* Tiles Remaining */}
        <div className="text-sm font-bold">
          <span className="text-gray-300">Tiles Remaining: </span>
          <span className={cn('font-bold', colorClass)} data-testid="wall-counter-value">
            {remainingTiles}
          </span>
          <span className="text-gray-400"> / {totalTiles}</span>
        </div>

        {/* Dead Wall Badge */}
        {isDeadWall && (
          <Badge variant="destructive" className="text-xs w-fit" data-testid="dead-wall-badge">
            Dead Wall
          </Badge>
        )}
      </div>
    </Card>
  );
};

WallCounter.displayName = 'WallCounter';
