import type { Seat } from '@/types/bindings/generated/Seat';

export type OpponentPosition = 'top' | 'left' | 'right';

const SEAT_ORDER: Seat[] = ['East', 'South', 'West', 'North'];

/** Returns the position of an opponent relative to the local player's seat. */
export function getOpponentPosition(yourSeat: Seat, opponentSeat: Seat): OpponentPosition {
  const yourIdx = SEAT_ORDER.indexOf(yourSeat);
  const theirIdx = SEAT_ORDER.indexOf(opponentSeat);
  const diff = (theirIdx - yourIdx + 4) % 4;
  if (diff === 1) return 'right';
  if (diff === 2) return 'top';
  return 'left';
}
