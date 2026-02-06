/**
 * TileImage Component
 *
 * Renders the visual representation (SVG asset) for a single Mahjong tile
 * based on its tile index (0-36).
 *
 * Tile Index Mapping (Current Backend):
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34:    Flower (see flowerVariant prop for visual selection)
 * - 35:    Joker
 * - 36:    Blank
 *
 * BACKEND ENHANCEMENT NEEDED:
 * American Mahjong has 8 distinct flower tiles. The backend currently treats
 * all flowers as a single tile type (index 34). To properly support 8 flowers:
 * - Backend should expand to indices 34-41 for Flowers 1-8
 * - Joker would move to index 42, Blank to index 43
 * - This enables proper histogram validation for flower-specific patterns
 *
 * Until then, use the `flowerVariant` prop to specify which flower visual (1-8).
 */

import React, { useState } from 'react';
import type { Tile } from '@/types/bindings';
import { getTileName } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';

export interface TileImageProps {
  /** Tile index (0-36) from bindings */
  tile: Tile;

  /**
   * For flower tiles (index 34), specifies which flower variant to display (1-8).
   * If not provided, defaults to 1 for deterministic rendering.
   * This prop is ignored for non-flower tiles.
   */
  flowerVariant?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  /** Additional CSS classes */
  className?: string;

  /** Custom aria-label override */
  ariaLabel?: string;

  /** Test ID for testing */
  testId?: string;
}

/**
 * Maps tile index to asset file path
 *
 * @param tile - The tile index (0-36)
 * @param flowerVariant - For flower tiles, which variant to display (1-8). Defaults to 1.
 */
function getTileAssetPath(tile: Tile, flowerVariant: number = 1): string {
  // Bams (0-8)
  if (tile >= 0 && tile <= 8) {
    return `/assets/tiles/${tile + 1}B_clear.svg`;
  }

  // Cracks (9-17)
  if (tile >= 9 && tile <= 17) {
    return `/assets/tiles/${tile - 8}C_clear.svg`;
  }

  // Dots (18-26)
  if (tile >= 18 && tile <= 26) {
    return `/assets/tiles/${tile - 17}D_clear.svg`;
  }

  // Winds (27-30)
  const windMap: Record<number, string> = {
    27: 'E',
    28: 'S',
    29: 'W',
    30: 'N',
  };
  if (tile >= 27 && tile <= 30) {
    return `/assets/tiles/${windMap[tile]}_clear.svg`;
  }

  // Dragons (31-33)
  const dragonMap: Record<number, string> = {
    31: 'DG', // Green Dragon
    32: 'DR', // Red Dragon
    33: 'DW', // White Dragon (Soap)
  };
  if (tile >= 31 && tile <= 33) {
    return `/assets/tiles/${dragonMap[tile]}_clear.svg`;
  }

  // Flower (34) - use provided variant or default to 1
  if (tile === 34) {
    // Clamp to valid range 1-8
    const variant = Math.max(1, Math.min(8, flowerVariant));
    return `/assets/tiles/F${variant}_clear.svg`;
  }

  // Joker (35)
  if (tile === 35) {
    return `/assets/tiles/J_clear.svg`;
  }

  // Blank (36)
  if (tile === 36) {
    return `/assets/tiles/Blank.svg`;
  }

  // Invalid tile - return empty string (will trigger fallback)
  return '';
}

/**
 * Generates aria-label with tile name and index
 */
function getTileAriaLabel(tile: Tile): string {
  const tileName = getTileName(tile);
  return `${tileName} (${tile})`;
}

/**
 * TileImage component - renders SVG asset for a Mahjong tile
 */
export const TileImage = React.memo<TileImageProps>(
  ({ tile, flowerVariant = 1, className, ariaLabel, testId }) => {
    const [hasError, setHasError] = useState(false);

    const assetPath = getTileAssetPath(tile, flowerVariant);
    const label = ariaLabel || getTileAriaLabel(tile);

    // Handle image load error
    const handleError = () => {
      setHasError(true);
    };

    // Fallback for error or invalid tiles
    if (hasError || !assetPath) {
      const tileName = getTileName(tile);
      return (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded',
            className
          )}
          data-testid={testId || `tile-image-${tile}`}
          role="img"
          aria-label={label}
        >
          {tileName}
        </div>
      );
    }

    // Render image
    return (
      <div
        className={cn('w-full h-full', className)}
        data-testid={testId || `tile-image-${tile}`}
      >
        <img
          src={assetPath}
          alt={label}
          aria-label={label}
          className="w-full h-full object-contain"
          onError={handleError}
        />
      </div>
    );
  }
);

TileImage.displayName = 'TileImage';
