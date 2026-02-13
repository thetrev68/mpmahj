/**
 * DiscardAnimationLayer Component
 *
 * Displays a tile animation sliding from the hand area to the discard pool.
 *
 * Related: US-010 (Discarding a Tile)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { TileImage } from './TileImage';
import type { Tile } from '@/types/bindings/generated/Tile';

interface DiscardAnimationLayerProps {
  /** Tile being discarded */
  tile: Tile;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Callback when animation completes */
  onComplete: () => void;
}

export const DiscardAnimationLayer: React.FC<DiscardAnimationLayerProps> = ({
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

  const { from, to } = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        from: { x: 400, y: 560 },
        to: { x: 400, y: 320 },
      };
    }

    const width = window.innerWidth || 800;
    const height = window.innerHeight || 600;

    return {
      from: { x: width / 2 - 30, y: height - 160 },
      to: { x: width / 2 - 30, y: height / 2 - 40 },
    };
  }, []);

  if (!isAnimating) {
    return null;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      data-testid="discard-animation-layer"
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
        data-testid="discard-animated-tile"
      >
        <TileImage tile={tile} className="w-[60px] h-[80px]" />
      </div>
    </div>
  );
};

DiscardAnimationLayer.displayName = 'DiscardAnimationLayer';
