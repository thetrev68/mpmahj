import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * Maps each Seat value to its CSS entry animation class defined in Tile.css.
 * Used by PlayerRack and StagingStrip to apply directional enter animations.
 */
export const SEAT_ENTRY_CLASS: Record<Seat, string> = {
  East: 'tile-enter-from-east',
  South: 'tile-enter-from-south',
  West: 'tile-enter-from-west',
  North: 'tile-enter-from-north',
};
