/**
 * @module types
 *
 * Local type definitions for game components.
 *
 * @see {@link src/types/bindings/generated/Tile.ts} for Rust-generated tile types
 */

import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * Represents a single tile instance in the UI with a unique identifier.
 * Used for animations, selection tracking, and list rendering.
 *
 * @typedef {Object} TileInstance
 * @property {string} id - Unique identifier for this tile instance (e.g., UUID or "tile-East-1").
 *   Persists across animations and re-renders for proper key tracking.
 * @property {Tile} tile - The tile value (0-43). See {@link src/types/bindings/generated/Tile.ts}.
 *   0-8: Bams, 9-17: Cracks, 18-26: Dots, 27-30: Winds, 31-33: Dragons,
 *   34-41: Flowers (8 variants), 42: Joker, 43: Blank.
 */
export type TileInstance = {
  id: string;
  tile: Tile;
};
