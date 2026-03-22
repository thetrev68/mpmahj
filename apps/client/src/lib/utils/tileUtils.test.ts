import { describe, expect, test } from 'vitest';
import { canonicalTileComparator, canonicalSortKey, getTileGroup, sortHand } from './tileUtils';
import type { Tile } from '@/types/bindings';

describe('canonicalTileComparator', () => {
  test('full canonical order across all tile groups', () => {
    const allTiles: Tile[] = [
      // Bams
      0, 1, 2, 3, 4, 5, 6, 7, 8,
      // Craks
      9, 10, 11, 12, 13, 14, 15, 16, 17,
      // Dots
      18, 19, 20, 21, 22, 23, 24, 25, 26,
      // Winds
      27, 28, 29, 30,
      // Dragons
      31, 32, 33,
      // Flowers
      34, 35, 36, 37, 38, 39, 40, 41,
      // Joker, Blank
      42, 43,
    ];

    const sorted = sortHand(allTiles);

    const expected: Tile[] = [
      42, // Joker
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41, // Flowers F1..F8
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8, // Bam 1..9
      31, // Green Dragon
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17, // Crak 1..9
      32, // Red Dragon
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26, // Dot 1..9
      33, // White Dragon
      27,
      28,
      29,
      30, // Winds
      43, // Blank
    ];

    expect(sorted).toEqual(expected);
  });

  test('dragon placement inside suit-color families', () => {
    const tiles: Tile[] = [31, 8, 0, 32, 17, 9, 33, 26, 18];
    const sorted = sortHand(tiles);
    // Bam 1, Bam 9, Green Dragon, Crak 1, Crak 9, Red Dragon, Dot 1, Dot 9, White Dragon
    expect(sorted).toEqual([0, 8, 31, 9, 17, 32, 18, 26, 33]);
  });

  test('flowers F1..F8 ordering preserved', () => {
    const tiles: Tile[] = [41, 38, 34, 37, 40, 36, 39, 35];
    const sorted = sortHand(tiles);
    expect(sorted).toEqual([34, 35, 36, 37, 38, 39, 40, 41]);
  });

  test('blank sorts last', () => {
    const tiles: Tile[] = [43, 42, 0, 27];
    const sorted = sortHand(tiles);
    expect(sorted[sorted.length - 1]).toBe(43);
    expect(sorted[0]).toBe(42);
  });

  test('joker sorts first', () => {
    const tiles: Tile[] = [0, 42, 34, 27, 9];
    const sorted = sortHand(tiles);
    expect(sorted[0]).toBe(42);
  });

  test('stable sort for identical tiles', () => {
    const tiles: Tile[] = [5, 5, 5, 5];
    const sorted = sortHand(tiles);
    expect(sorted).toEqual([5, 5, 5, 5]);
  });

  test('comparator returns negative when a sorts before b', () => {
    expect(canonicalTileComparator(42 as Tile, 0 as Tile)).toBeLessThan(0);
  });

  test('comparator returns positive when a sorts after b', () => {
    expect(canonicalTileComparator(43 as Tile, 42 as Tile)).toBeGreaterThan(0);
  });

  test('comparator returns 0 for same tile', () => {
    expect(canonicalTileComparator(5 as Tile, 5 as Tile)).toBe(0);
  });
});

describe('canonicalSortKey', () => {
  test('joker has lowest sort key', () => {
    expect(canonicalSortKey(42 as Tile)).toBe(1);
  });

  test('blank has highest sort key', () => {
    const blankKey = canonicalSortKey(43 as Tile);
    for (let i = 0; i <= 42; i++) {
      expect(blankKey).toBeGreaterThan(canonicalSortKey(i as Tile));
    }
  });
});

describe('getTileGroup', () => {
  test('joker group', () => {
    expect(getTileGroup(42 as Tile)).toBe('joker');
  });

  test('flower group', () => {
    for (let i = 34; i <= 41; i++) {
      expect(getTileGroup(i as Tile)).toBe('flower');
    }
  });

  test('bam group includes Bam 1-9 and Green Dragon', () => {
    for (let i = 0; i <= 8; i++) {
      expect(getTileGroup(i as Tile)).toBe('bam');
    }
    expect(getTileGroup(31 as Tile)).toBe('bam'); // Green Dragon
  });

  test('crak group includes Crak 1-9 and Red Dragon', () => {
    for (let i = 9; i <= 17; i++) {
      expect(getTileGroup(i as Tile)).toBe('crak');
    }
    expect(getTileGroup(32 as Tile)).toBe('crak'); // Red Dragon
  });

  test('dot group includes Dot 1-9 and White Dragon', () => {
    for (let i = 18; i <= 26; i++) {
      expect(getTileGroup(i as Tile)).toBe('dot');
    }
    expect(getTileGroup(33 as Tile)).toBe('dot'); // White Dragon
  });

  test('wind group', () => {
    for (let i = 27; i <= 30; i++) {
      expect(getTileGroup(i as Tile)).toBe('wind');
    }
  });

  test('blank group', () => {
    expect(getTileGroup(43 as Tile)).toBe('blank');
  });
});
