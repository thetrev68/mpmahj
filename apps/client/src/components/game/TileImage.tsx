/**
 * TileImage Component
 *
 * Renders the visual representation (SVG asset) for a single Mahjong tile
 * based on its tile index (0-43).
 *
 * Tile Index Mapping (from Tile.ts bindings - source of truth):
 * - 0-8:   Bams (1-9)
 * - 9-17:  Cracks (1-9)
 * - 18-26: Dots (1-9)
 * - 27-30: Winds (East, South, West, North)
 * - 31-33: Dragons (Green, Red, White/Soap)
 * - 34-41: Flowers (8 distinct variants)
 * - 42:    Joker
 * - 43:    Blank (House Rule)
 */

import { memo, useState } from 'react';
import type { Tile } from '@/types/bindings';
import { getTileName } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';

interface TileImageProps {
  /** Tile index (0-43) from bindings */
  tile: Tile;

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
 * @param tile - The tile index (0-43)
 */
function getTileAssetPath(tile: Tile): string {
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

  // Flowers (34-41)
  if (tile >= 34 && tile <= 41) {
    const variant = tile - 34 + 1;
    return `/assets/tiles/F${variant}_clear.svg`;
  }

  // Joker (42)
  if (tile === 42) {
    return `/assets/tiles/J_clear.svg`;
  }

  // Blank (43)
  if (tile === 43) {
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
export const TileImage = memo<TileImageProps>(({ tile, className, ariaLabel, testId }) => {
  const [hasError, setHasError] = useState(false);

  const assetPath = getTileAssetPath(tile);
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

  return (
    <div
      className={cn('relative h-full w-full rounded-[3px] bg-[#f8f5ef] p-[1px]', className)}
      data-testid={testId || `tile-image-${tile}`}
    >
      <img
        src={assetPath}
        alt={label}
        aria-label={label}
        className="h-full w-full rounded-[2px]"
        style={{ objectFit: 'fill', display: 'block' }}
        onError={handleError}
      />
    </div>
  );
});

TileImage.displayName = 'TileImage';
