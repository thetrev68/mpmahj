/**
 * Tests for Call Intent Calculator
 *
 * Pure function tests for meld calculation logic
 * Extracted from GameBoard.tsx lines 1531-1574
 */

import { describe, test, expect } from 'vitest';
import { calculateCallIntent, TILE_INDICES } from './callIntentCalculator';

describe('calculateCallIntent', () => {
  describe('Pung (3 tiles)', () => {
    test('with 2 matching tiles - success', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([[5, 2]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([5, 5, 5]);
      expect(result.error).toBeUndefined();
    });

    test('with 1 matching + 1 joker - success', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([
          [5, 1],
          [TILE_INDICES.JOKER, 1],
        ]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([5, 5, TILE_INDICES.JOKER]);
    });

    test('with 0 matching + 2 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([[TILE_INDICES.JOKER, 2]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([5, TILE_INDICES.JOKER, TILE_INDICES.JOKER]);
    });

    test('with only 1 tile total - failure', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([[5, 1]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
      expect(result.meldTiles).toBeUndefined();
    });

    test('with no matching tiles or jokers - failure', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([[6, 3]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
    });
  });

  describe('Kong (4 tiles)', () => {
    test('with 3 matching tiles - success', () => {
      const result = calculateCallIntent({
        tile: 10,
        tileCounts: new Map([[10, 3]]),
        intent: 'Kong',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([10, 10, 10, 10]);
    });

    test('with 2 matching + 1 joker - success', () => {
      const result = calculateCallIntent({
        tile: 10,
        tileCounts: new Map([
          [10, 2],
          [TILE_INDICES.JOKER, 1],
        ]),
        intent: 'Kong',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([10, 10, 10, TILE_INDICES.JOKER]);
    });

    test('with 1 matching + 2 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 10,
        tileCounts: new Map([
          [10, 1],
          [TILE_INDICES.JOKER, 2],
        ]),
        intent: 'Kong',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([10, 10, TILE_INDICES.JOKER, TILE_INDICES.JOKER]);
    });

    test('with 0 matching + 3 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 10,
        tileCounts: new Map([[TILE_INDICES.JOKER, 3]]),
        intent: 'Kong',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([
        10,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
      ]);
    });

    test('with only 2 tiles total - failure', () => {
      const result = calculateCallIntent({
        tile: 10,
        tileCounts: new Map([
          [10, 1],
          [TILE_INDICES.JOKER, 1],
        ]),
        intent: 'Kong',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
    });
  });

  describe('Quint (5 tiles)', () => {
    test('with 4 matching tiles - success', () => {
      const result = calculateCallIntent({
        tile: 15,
        tileCounts: new Map([[15, 4]]),
        intent: 'Quint',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([15, 15, 15, 15, 15]);
    });

    test('with 2 matching + 2 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 15,
        tileCounts: new Map([
          [15, 2],
          [TILE_INDICES.JOKER, 2],
        ]),
        intent: 'Quint',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([15, 15, 15, TILE_INDICES.JOKER, TILE_INDICES.JOKER]);
    });

    test('with 0 matching + 4 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 15,
        tileCounts: new Map([[TILE_INDICES.JOKER, 4]]),
        intent: 'Quint',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([
        15,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
      ]);
    });

    test('with only 3 tiles total - failure', () => {
      const result = calculateCallIntent({
        tile: 15,
        tileCounts: new Map([
          [15, 2],
          [TILE_INDICES.JOKER, 1],
        ]),
        intent: 'Quint',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
    });
  });

  describe('Sextet (6 tiles)', () => {
    test('with 5 matching tiles - success', () => {
      const result = calculateCallIntent({
        tile: 20,
        tileCounts: new Map([[20, 5]]),
        intent: 'Sextet',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([20, 20, 20, 20, 20, 20]);
    });

    test('with 3 matching + 2 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 20,
        tileCounts: new Map([
          [20, 3],
          [TILE_INDICES.JOKER, 2],
        ]),
        intent: 'Sextet',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([20, 20, 20, 20, TILE_INDICES.JOKER, TILE_INDICES.JOKER]);
    });

    test('with 1 matching + 4 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 20,
        tileCounts: new Map([
          [20, 1],
          [TILE_INDICES.JOKER, 4],
        ]),
        intent: 'Sextet',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([
        20,
        20,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
      ]);
    });

    test('with 0 matching + 5 jokers - success', () => {
      const result = calculateCallIntent({
        tile: 20,
        tileCounts: new Map([[TILE_INDICES.JOKER, 5]]),
        intent: 'Sextet',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([
        20,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
        TILE_INDICES.JOKER,
      ]);
    });

    test('with only 4 tiles total - failure', () => {
      const result = calculateCallIntent({
        tile: 20,
        tileCounts: new Map([
          [20, 2],
          [TILE_INDICES.JOKER, 2],
        ]),
        intent: 'Sextet',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
    });
  });

  describe('Edge cases', () => {
    test('handles tile index 0 (Bam 1)', () => {
      const result = calculateCallIntent({
        tile: 0,
        tileCounts: new Map([[0, 2]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([0, 0, 0]);
    });

    test('handles high tile indices (Dragons)', () => {
      const result = calculateCallIntent({
        tile: 33, // Red Dragon
        tileCounts: new Map([[33, 2]]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      expect(result.meldTiles).toEqual([33, 33, 33]);
    });

    test('handles empty tileCounts map', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map(),
        intent: 'Pung',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not enough tiles');
    });

    test('prefers natural tiles over jokers', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([
          [5, 10], // More than needed
          [TILE_INDICES.JOKER, 10], // More than needed
        ]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      // Should use 2 natural tiles, not jokers
      expect(result.meldTiles).toEqual([5, 5, 5]);
      expect(result.meldTiles?.filter((t) => t === TILE_INDICES.JOKER).length).toBe(0);
    });

    test('uses jokers only when necessary', () => {
      const result = calculateCallIntent({
        tile: 5,
        tileCounts: new Map([
          [5, 1], // Only 1 natural
          [TILE_INDICES.JOKER, 5], // Many jokers
        ]),
        intent: 'Pung',
      });

      expect(result.success).toBe(true);
      // Should use 1 natural + 1 joker
      expect(result.meldTiles).toEqual([5, 5, TILE_INDICES.JOKER]);
      expect(result.meldTiles?.filter((t) => t === TILE_INDICES.JOKER).length).toBe(1);
    });
  });

  describe('Parameterized tests', () => {
    test.each([
      // [intent, meldSize, matching, jokers, shouldSucceed]
      ['Pung', 3, 2, 0, true],
      ['Pung', 3, 1, 1, true],
      ['Pung', 3, 0, 2, true],
      ['Pung', 3, 1, 0, false],
      ['Kong', 4, 3, 0, true],
      ['Kong', 4, 2, 1, true],
      ['Kong', 4, 1, 2, true],
      ['Kong', 4, 0, 3, true],
      ['Kong', 4, 2, 0, false],
      ['Quint', 5, 4, 0, true],
      ['Quint', 5, 2, 2, true],
      ['Quint', 5, 0, 4, true],
      ['Quint', 5, 3, 0, false],
      ['Sextet', 6, 5, 0, true],
      ['Sextet', 6, 3, 2, true],
      ['Sextet', 6, 1, 4, true],
      ['Sextet', 6, 0, 5, true],
      ['Sextet', 6, 4, 0, false],
    ] as const)(
      '%s with %d matching + %d jokers = %s',
      (intent, meldSize, matching, jokers, shouldSucceed) => {
        const result = calculateCallIntent({
          tile: 5,
          tileCounts: new Map([
            [5, matching],
            [TILE_INDICES.JOKER, jokers],
          ]),
          intent,
        });

        expect(result.success).toBe(shouldSucceed);

        if (shouldSucceed) {
          expect(result.meldTiles).toHaveLength(meldSize);
          expect(result.error).toBeUndefined();

          // First tile should always be the called tile
          expect(result.meldTiles?.[0]).toBe(5);

          // Count jokers in result
          const jokerCount = result.meldTiles?.filter((t) => t === TILE_INDICES.JOKER).length ?? 0;
          expect(jokerCount).toBe(Math.max(0, meldSize - 1 - matching));
        } else {
          expect(result.error).toBeDefined();
          expect(result.meldTiles).toBeUndefined();
        }
      }
    );
  });
});
