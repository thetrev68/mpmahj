/**
 * TileImage Component (Stub)
 *
 * This is a placeholder component that will be replaced with actual SVG tile images.
 * For now, it displays a simple text representation for testing purposes.
 */

import type { Tile } from '@/types/bindings';

interface TileImageProps {
  tile: Tile;
  testId?: string;
}

export const TileImage = ({ tile, testId }: TileImageProps) => {
  return (
    <div
      data-testid={testId || `tile-image-${tile}`}
      className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-700"
    >
      Tile {tile}
    </div>
  );
};
