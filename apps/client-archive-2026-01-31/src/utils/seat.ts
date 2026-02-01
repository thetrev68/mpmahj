/**
 * Seat rotation and positioning utilities
 *
 * Converts server-side absolute seat positions to client-side visual positions
 * relative to the current player's perspective.
 *
 * Visual mapping:
 * - 0 = Bottom (local player)
 * - 1 = Right
 * - 2 = Top (opposite)
 * - 3 = Left
 */

import type { Seat } from '@/types/bindings';

/**
 * Convert a Seat enum to its index (0-3)
 */
export function seatToIndex(seat: Seat): number {
  switch (seat) {
    case 'East':
      return 0;
    case 'South':
      return 1;
    case 'West':
      return 2;
    case 'North':
      return 3;
  }
}

/**
 * Convert an index (0-3) to a Seat enum
 */
export function indexToSeat(index: number): Seat {
  switch (index % 4) {
    case 0:
      return 'East';
    case 1:
      return 'South';
    case 2:
      return 'West';
    case 3:
      return 'North';
    default:
      throw new Error(`Invalid seat index: ${index}`);
  }
}

/**
 * Calculate visual position index for rendering
 *
 * Formula: (serverSeatIndex - mySeatIndex + 4) % 4
 *
 * @param seat - The seat to position
 * @param mySeat - The local player's seat
 * @returns Visual position index (0=bottom, 1=right, 2=top, 3=left)
 */
export function getVisualPosition(seat: Seat, mySeat: Seat): number {
  const seatIndex = seatToIndex(seat);
  const myIndex = seatToIndex(mySeat);
  return (seatIndex - myIndex + 4) % 4;
}

/**
 * Get the position name for display purposes
 */
export function getPositionName(visualIndex: number): string {
  switch (visualIndex) {
    case 0:
      return 'bottom';
    case 1:
      return 'right';
    case 2:
      return 'top';
    case 3:
      return 'left';
    default:
      return 'unknown';
  }
}

/**
 * Get CSS positioning classes for table layout
 */
export function getPositionClasses(visualIndex: number): string {
  switch (visualIndex) {
    case 0:
      return 'bottom-0 left-1/2 -translate-x-1/2';
    case 1:
      return 'right-0 top-1/2 -translate-y-1/2';
    case 2:
      return 'top-0 left-1/2 -translate-x-1/2';
    case 3:
      return 'left-0 top-1/2 -translate-y-1/2';
    default:
      return '';
  }
}

/**
 * Get the next seat in turn order (clockwise)
 */
export function nextSeat(seat: Seat): Seat {
  return indexToSeat(seatToIndex(seat) + 1);
}

/**
 * Get the previous seat in turn order (counter-clockwise)
 */
export function previousSeat(seat: Seat): Seat {
  return indexToSeat(seatToIndex(seat) + 3);
}

/**
 * Get the seat opposite to the given seat
 */
export function oppositeSeat(seat: Seat): Seat {
  return indexToSeat(seatToIndex(seat) + 2);
}

/**
 * Get all seats in turn order starting from East
 */
export function allSeats(): Seat[] {
  return ['East', 'South', 'West', 'North'];
}
