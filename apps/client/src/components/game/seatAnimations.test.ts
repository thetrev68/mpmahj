import { describe, expect, test } from 'vitest';
import { SEAT_ENTRY_CLASS } from './seatAnimations';
import type { Seat } from '@/types/bindings/generated/Seat';

const ALL_SEATS: Seat[] = ['East', 'South', 'West', 'North'];

describe('SEAT_ENTRY_CLASS', () => {
  test('covers all four seats', () => {
    for (const seat of ALL_SEATS) {
      expect(SEAT_ENTRY_CLASS[seat]).toBeDefined();
    }
  });

  test.each(ALL_SEATS)('%s maps to tile-enter-from-%s', (seat) => {
    expect(SEAT_ENTRY_CLASS[seat]).toBe(`tile-enter-from-${seat.toLowerCase()}`);
  });
});
