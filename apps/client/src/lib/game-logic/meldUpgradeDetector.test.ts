/**
 * Tests for meld upgrade detection utility (US-016)
 */

import { describe, test, expect } from 'vitest';
import { findUpgradeableMelds } from './meldUpgradeDetector';
import type { Meld } from '@/types/bindings/generated/Meld';

describe('findUpgradeableMelds', () => {
  const dot5 = 22; // Dot 5 tile index
  const bam3 = 2; // Bam 3 tile index
  const joker = 42;

  const makeMeld = (meld_type: Meld['meld_type'], tile: number): Meld => ({
    meld_type,
    tiles: Array(meld_type === 'Pung' ? 3 : meld_type === 'Kong' ? 4 : 5).fill(tile),
    called_tile: tile,
    joker_assignments: {},
  });

  test('detects upgradeable Pung when hand contains matching tile', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5)];
    const hand = [dot5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      meldIndex: 0,
      upgrade: 'Kong',
      tile: dot5,
    });
  });

  test('detects upgradeable Kong when hand contains matching tile', () => {
    const melds: Meld[] = [makeMeld('Kong', dot5)];
    const hand = [dot5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      meldIndex: 0,
      upgrade: 'Quint',
      tile: dot5,
    });
  });

  test('detects upgradeable Quint when hand contains matching tile', () => {
    const melds: Meld[] = [makeMeld('Quint', dot5)];
    const hand = [dot5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      meldIndex: 0,
      upgrade: 'Sextet',
      tile: dot5,
    });
  });

  test('Sextet cannot be upgraded further', () => {
    const sextetMeld: Meld = {
      meld_type: 'Sextet',
      tiles: [dot5, dot5, dot5, dot5, dot5, dot5],
      called_tile: dot5,
      joker_assignments: {},
    };
    const hand = [dot5, 1, 2, 3, 4, 5, 6, 7, 8];

    const result = findUpgradeableMelds([sextetMeld], hand);

    expect(result).toHaveLength(0);
  });

  test('returns empty when hand does not contain matching tile or Joker', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5)];
    const hand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // no dot5 or joker

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(0);
  });

  test('uses Joker to upgrade meld (EC-1)', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5)];
    const hand = [joker, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      meldIndex: 0,
      upgrade: 'Kong',
      tile: joker, // Joker is the tile to add
    });
  });

  test('prefers matching tile over Joker when both available', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5)];
    const hand = [dot5, joker, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const result = findUpgradeableMelds(melds, hand);

    expect(result[0].tile).toBe(dot5); // prefers matching tile
  });

  test('detects multiple upgradeable melds', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5), makeMeld('Kong', bam3)];
    const hand = [dot5, bam3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const result = findUpgradeableMelds(melds, hand);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ meldIndex: 0, upgrade: 'Kong', tile: dot5 });
    expect(result[1]).toMatchObject({ meldIndex: 1, upgrade: 'Quint', tile: bam3 });
  });

  test('returns empty for empty meld list', () => {
    const result = findUpgradeableMelds([], [dot5, bam3]);
    expect(result).toHaveLength(0);
  });

  test('returns empty for empty hand', () => {
    const melds: Meld[] = [makeMeld('Pung', dot5)];
    const result = findUpgradeableMelds(melds, []);
    expect(result).toHaveLength(0);
  });

  test('meld with null called_tile and matching tile in hand', () => {
    // Meld created with a Joker as the base (called_tile might be null in edge cases)
    const meldWithNullBase: Meld = {
      meld_type: 'Pung',
      tiles: [joker, joker, joker],
      called_tile: null,
      joker_assignments: {},
    };
    // Has Joker in hand, but no called_tile to match
    const hand = [joker, 1, 2, 3];

    // With null called_tile, use first tile in meld as base
    const result = findUpgradeableMelds([meldWithNullBase], hand);

    // Joker meld is upgradeable if hand has Joker
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ meldIndex: 0, upgrade: 'Kong' });
  });
});
