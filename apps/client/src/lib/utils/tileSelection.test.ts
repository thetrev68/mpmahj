import { describe, expect, test } from 'vitest';
import { buildTileInstances, selectedIdsToTiles } from './tileSelection';
import type { Tile } from '@/types/bindings/generated/Tile';

describe('tileSelection utilities', () => {
  test('buildTileInstances creates stable tile-index ids', () => {
    const tiles = [0, 42, 0] as Tile[];
    expect(buildTileInstances(tiles)).toEqual([
      { id: '0-0', tile: 0 },
      { id: '42-1', tile: 42 },
      { id: '0-2', tile: 0 },
    ]);
  });

  test('selectedIdsToTiles extracts tile values from selection ids', () => {
    const ids = ['12-0', '42-3', 'invalid'];
    expect(selectedIdsToTiles(ids)).toEqual([12, 42]);
  });
});
