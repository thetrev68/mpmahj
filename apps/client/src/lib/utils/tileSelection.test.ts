import { describe, expect, test } from 'vitest';
import { buildTileInstances, selectedIdsToTiles } from './tileSelection';
import type { Tile } from '@/types/bindings/generated/Tile';

describe('tileSelection utilities', () => {
  test('buildTileInstances creates per-tile occurrence ids', () => {
    const tiles = [0, 42, 0] as Tile[];
    expect(buildTileInstances(tiles)).toEqual([
      { id: '0-0', tile: 0 },
      { id: '42-0', tile: 42 },
      { id: '0-1', tile: 0 },
    ]);
  });

  test('buildTileInstances keeps existing ids stable when lower tiles are inserted', () => {
    const before = buildTileInstances([2, 5, 5, 8] as Tile[]);
    const after = buildTileInstances([1, 2, 5, 5, 8] as Tile[]);

    expect(before.map((tile) => tile.id)).toEqual(['2-0', '5-0', '5-1', '8-0']);
    expect(after.slice(1).map((tile) => tile.id)).toEqual(['2-0', '5-0', '5-1', '8-0']);
  });

  test('selectedIdsToTiles extracts tile values from selection ids', () => {
    const ids = ['12-0', '42-3', 'invalid'];
    expect(selectedIdsToTiles(ids)).toEqual([12, 42]);
  });
});
