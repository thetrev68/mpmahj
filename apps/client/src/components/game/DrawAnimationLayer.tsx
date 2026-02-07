/**
 * DrawAnimationLayer Component
 *
 * Displays a tile animation sliding from wall to hand when a tile is drawn.
 * For the active player, shows the actual tile. For other players, shows a face-down tile.
 *
 * Related: US-009 (Drawing a Tile)
 */

import React, { useEffect, useState } from 'react';
import { TileImage } from './TileImage';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface DrawAnimationLayerProps {
  /** Starting position (wall coordinates) */
  from: { x: number; y: number };
  /** Ending position (hand coordinates) */
  to: { x: number; y: number };
  /** Tile being drawn (null for other players - shows face-down) */
  tile: Tile | null;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Callback when animation completes */
  onComplete: () => void;
}

/**
 * DrawAnimationLayer animates a tile moving from wall to hand
 */
export const DrawAnimationLayer: React.FC<DrawAnimationLayerProps> = ({
  from,
  to,
  tile,
  duration = 400,
  onComplete,
}) => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isAnimating) {
    return null;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      data-testid="draw-animation-layer"
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="absolute transition-all ease-out"
        style={{
          left: `${from.x}px`,
          top: `${from.y}px`,
          transform: `translate(${dx}px, ${dy}px)`,
          transitionDuration: `${duration}ms`,
        }}
        data-testid="animated-tile"
      >
        {tile !== null ? (
          <TileImage tile={tile} className="w-[60px] h-[80px]" />
        ) : (
          <div
            className="w-[60px] h-[80px] bg-gradient-to-br from-gray-700 to-gray-800 border-2 border-gray-600 rounded-sm"
            data-testid="face-down-tile"
            aria-label="Face-down tile"
          />
        )}
      </div>
    </div>
  );
};

DrawAnimationLayer.displayName = 'DrawAnimationLayer';
