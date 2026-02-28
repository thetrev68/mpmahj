import type { Tile } from '@/types/bindings/generated/Tile';

export interface TileInstance {
  id: string;
  tile: Tile;
}

export function buildTileInstances(tiles: Tile[]): TileInstance[] {
  const seenCounts = new Map<Tile, number>();

  return tiles.map((tile) => {
    const seenCount = seenCounts.get(tile) ?? 0;
    seenCounts.set(tile, seenCount + 1);

    return {
      id: `${tile}-${seenCount}`,
      tile,
    };
  });
}

function parseTileSelectionId(id: string): Tile | null {
  const firstPart = id.split('-')[0] ?? '';
  const parsed = Number.parseInt(firstPart, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed as Tile;
}

export function selectedIdsToTiles(ids: string[]): Tile[] {
  return ids.map((id) => parseTileSelectionId(id)).filter((tile): tile is Tile => tile !== null);
}
