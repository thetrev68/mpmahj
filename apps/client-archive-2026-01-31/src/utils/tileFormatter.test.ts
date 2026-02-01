import { describe, expect, it } from 'vitest';
import {
  compareByRank,
  compareBySuit,
  formatMeld,
  sortByRank,
  sortBySuit,
  tileToCode,
  tileToString,
} from './tileFormatter';

import type { Meld } from '@/types/bindings/generated/Meld';

// Helpers for clarity in expectations
const B1 = 0;
const B5 = 4;
const B9 = 8;
const C1 = 9;
const C5 = 13;
const C9 = 17;
const D1 = 18;
const D5 = 22;
const D9 = 26;
const EAST = 27;
const SOUTH = 28;
const WEST = 29;
const NORTH = 30;
const GREEN = 31;
const RED = 32;
const WHITE = 33;
const FLOWER = 34;
const JOKER = 35;
const BLANK = 36;

describe('tileFormatter', () => {
  describe('tileToString', () => {
    it('converts suited tiles', () => {
      expect(tileToString(B1)).toBe('1 Bam');
      expect(tileToString(B5)).toBe('5 Bam');
      expect(tileToString(B9)).toBe('9 Bam');
      expect(tileToString(C1)).toBe('1 Crack');
      expect(tileToString(C5)).toBe('5 Crack');
      expect(tileToString(C9)).toBe('9 Crack');
      expect(tileToString(D1)).toBe('1 Dot');
      expect(tileToString(D5)).toBe('5 Dot');
      expect(tileToString(D9)).toBe('9 Dot');
    });

    it('converts honors and specials', () => {
      expect(tileToString(EAST)).toBe('East Wind');
      expect(tileToString(SOUTH)).toBe('South Wind');
      expect(tileToString(WEST)).toBe('West Wind');
      expect(tileToString(NORTH)).toBe('North Wind');
      expect(tileToString(GREEN)).toBe('Green Dragon');
      expect(tileToString(RED)).toBe('Red Dragon');
      expect(tileToString(WHITE)).toBe('White Dragon (Soap)');
      expect(tileToString(FLOWER)).toBe('Flower');
      expect(tileToString(JOKER)).toBe('Joker');
      expect(tileToString(BLANK)).toBe('Blank');
    });

    it('handles invalid indices', () => {
      expect(tileToString(-1)).toBe('Unknown Tile');
      expect(tileToString(999)).toBe('Unknown Tile');
    });
  });

  describe('tileToCode', () => {
    it('converts suited tiles', () => {
      expect(tileToCode(B1)).toBe('1B');
      expect(tileToCode(B9)).toBe('9B');
      expect(tileToCode(C1)).toBe('1C');
      expect(tileToCode(C9)).toBe('9C');
      expect(tileToCode(D1)).toBe('1D');
      expect(tileToCode(D9)).toBe('9D');
    });

    it('converts honors and specials', () => {
      expect(tileToCode(EAST)).toBe('E');
      expect(tileToCode(SOUTH)).toBe('S');
      expect(tileToCode(WEST)).toBe('W');
      expect(tileToCode(NORTH)).toBe('N');
      expect(tileToCode(GREEN)).toBe('GD');
      expect(tileToCode(RED)).toBe('RD');
      expect(tileToCode(WHITE)).toBe('WD');
      expect(tileToCode(FLOWER)).toBe('F');
      expect(tileToCode(JOKER)).toBe('J');
      expect(tileToCode(BLANK)).toBe('BL');
    });

    it('handles invalid indices', () => {
      expect(tileToCode(-5)).toBe('??');
      expect(tileToCode(100)).toBe('??');
    });
  });

  describe('sortBySuit', () => {
    it('orders by suit then rank', () => {
      const input = [JOKER, B1, EAST, C1, FLOWER, D9, GREEN, SOUTH];
      const sorted = sortBySuit(input);
      expect(sorted).toEqual([FLOWER, B1, C1, D9, GREEN, EAST, SOUTH, JOKER]);
    });

    it('does not mutate the input array', () => {
      const input = [JOKER, B1];
      const copy = [...input];
      sortBySuit(input);
      expect(input).toEqual(copy);
    });
  });

  describe('sortByRank', () => {
    it('groups by rank then suit', () => {
      const input = [B9, C9, D9, B1, C1, D1];
      const sorted = sortByRank(input);
      expect(sorted).toEqual([B1, C1, D1, B9, C9, D9]);
    });

    it('orders non-suited tiles after ranks', () => {
      const input = [JOKER, FLOWER, GREEN, EAST];
      const sorted = sortByRank(input);
      expect(sorted).toEqual([FLOWER, GREEN, EAST, JOKER]);
    });

    it('does not mutate the input array', () => {
      const input = [B9, B1];
      const copy = [...input];
      sortByRank(input);
      expect(input).toEqual(copy);
    });
  });

  describe('comparators', () => {
    it('compareBySuit matches sortBySuit', () => {
      const input = [JOKER, B1, EAST, C1, FLOWER];
      const sorted = [...input].sort((a, b) => compareBySuit(a, b));
      expect(sorted).toEqual(sortBySuit(input));
    });

    it('compareByRank matches sortByRank', () => {
      const input = [B9, C1, FLOWER, EAST];
      const sorted = [...input].sort((a, b) => compareByRank(a, b));
      expect(sorted).toEqual(sortByRank(input));
    });
  });

  describe('formatMeld', () => {
    it('formats melds without jokers', () => {
      const meld: Meld = {
        meld_type: 'Pung',
        tiles: [D5, D5, D5],
        called_tile: D5,
        joker_assignments: {},
      };

      expect(formatMeld(meld)).toBe('Pung: [5D 5D 5D]');
    });

    it('formats melds with joker assignments', () => {
      const meld: Meld = {
        meld_type: 'Kong',
        tiles: [JOKER, D9, JOKER, D9],
        called_tile: null,
        joker_assignments: {
          0: D9,
          2: D9,
        },
      };

      expect(formatMeld(meld)).toBe('Kong: [J→9D 9D J→9D 9D]');
    });
  });
});
