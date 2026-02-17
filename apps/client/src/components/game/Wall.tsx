/**
 * Wall Component
 *
 * Displays one of the four Mahjong walls (North, South, East, West) with
 * remaining tile stacks, break indicator, and draw position.
 *
 * Related: US-001 (Roll Dice & Break Wall), US-009 (Turn flow visibility)
 */

import type { CSSProperties, FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WallProps {
  /** Position of this wall */
  position: 'north' | 'south' | 'east' | 'west';
  /** Number of stacks remaining in this wall (0-19 or 0-20 with blanks) */
  stackCount: number;
  /** Total initial stacks per wall */
  initialStacks: number;
  /** Break index position (where wall was broken) */
  breakIndex?: number;
  /** Current draw position */
  drawIndex?: number;
}

/**
 * Individual wall stack component
 */
const WallStack: FC<{ orientation: 'horizontal' | 'vertical' }> = ({ orientation }) => {
  const size =
    orientation === 'horizontal'
      ? { width: '30px', height: '44px' }
      : { width: '44px', height: '30px' };

  return (
    <div
      className="relative rounded-sm border border-gray-400"
      style={{
        ...size,
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
      }}
      data-testid="wall-stack"
    >
      {/* Horizontal line to simulate two-tile stack */}
      <div className="absolute left-0 right-0 h-px bg-black/10" style={{ top: '50%' }} />
    </div>
  );
};

/**
 * Wall displays one of the four walls with tile stacks
 */
export const Wall: FC<WallProps> = ({
  position,
  stackCount,
  initialStacks,
  breakIndex,
  drawIndex,
}) => {
  // Determine orientation based on position
  const isHorizontal = position === 'north' || position === 'south';
  const orientation = isHorizontal ? 'horizontal' : 'vertical';

  // Position styles for each wall
  const positionStyles: Record<typeof position, CSSProperties> = {
    north: {
      position: 'absolute',
      top: '15%',
      left: '50%',
      transform: 'translateX(-50%)',
    },
    south: {
      position: 'absolute',
      bottom: '22%',
      left: '50%',
      transform: 'translateX(-50%)',
    },
    east: {
      position: 'absolute',
      right: '12%',
      top: '50%',
      transform: 'translateY(-50%)',
    },
    west: {
      position: 'absolute',
      left: '12%',
      top: '50%',
      transform: 'translateY(-50%)',
    },
  };

  // Create array of stack indices
  const stacks = Array.from({ length: stackCount }, (_, i) => i);
  const breakAt = breakIndex !== undefined ? Math.min(Math.max(breakIndex, 0), stackCount) : null;
  const leftStacks = breakAt === null ? stacks : stacks.slice(0, breakAt);
  const rightStacks = breakAt === null ? [] : stacks.slice(breakAt);
  const shouldSplit = breakAt !== null && breakAt >= 0 && breakAt <= stackCount;
  const wallProgress = initialStacks > 0 ? Math.round((stackCount / initialStacks) * 100) : 0;
  const clampedProgress = Math.min(Math.max(wallProgress, 0), 100);

  return (
    <div
      className={cn('relative flex gap-0.5', isHorizontal ? 'flex-row' : 'flex-col')}
      style={positionStyles[position]}
      data-testid={`wall-${position}`}
      role="region"
      aria-label={`${position} wall, ${stackCount} stacks remaining, ${clampedProgress}% remaining`}
    >
      <Badge
        variant="outline"
        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white border-gray-500 text-[10px] px-1 py-0 leading-none"
        data-testid="wall-progress-indicator"
        aria-label={`Wall progress: ${clampedProgress}% remaining`}
      >
        {clampedProgress}%
      </Badge>

      <div className={cn('flex gap-0.5', isHorizontal ? 'flex-row' : 'flex-col')}>
        {leftStacks.map((index) => (
          <div key={index} className="relative flex flex-col items-center">
            {/* Stack */}
            <WallStack orientation={orientation} />

            {/* Draw marker */}
            {drawIndex !== undefined && index === drawIndex && (
              <Badge
                className="absolute -bottom-5 text-xs px-1 py-0"
                data-testid="wall-draw-marker"
                aria-label="Current draw position"
              >
                {'\u25bc'}
              </Badge>
            )}
          </div>
        ))}
      </div>

      {shouldSplit && (
        <div
          className={cn('relative flex items-center justify-center', isHorizontal ? 'w-4' : 'h-4')}
          data-testid="wall-break-gap"
          aria-label="Wall break position"
        >
          <div className="bg-yellow-400 rounded-full w-2 h-2" data-testid="wall-break-indicator" />
        </div>
      )}

      <div
        className={cn(
          'flex gap-0.5 transition-transform duration-300 ease-out',
          isHorizontal ? 'flex-row' : 'flex-col'
        )}
        style={
          shouldSplit
            ? {
                transform: 'rotate(12deg)',
                transformOrigin: isHorizontal ? 'left center' : 'center top',
              }
            : undefined
        }
      >
        {rightStacks.map((index) => (
          <div key={index} className="relative flex flex-col items-center">
            {/* Stack */}
            <WallStack orientation={orientation} />

            {/* Draw marker */}
            {drawIndex !== undefined && index === drawIndex && (
              <Badge
                className="absolute -bottom-5 text-xs px-1 py-0"
                data-testid="wall-draw-marker"
                aria-label="Current draw position"
              >
                {'\u25bc'}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

Wall.displayName = 'Wall';
