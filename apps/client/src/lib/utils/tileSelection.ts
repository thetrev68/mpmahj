import type { Tile } from '@/types/bindings/generated/Tile';

interface TileInstance {
  id: string;
  tile: Tile;
}

export function buildTileInstances(tiles: Tile[]): TileInstance[] {
  return tiles.map((tile, idx) => ({
    id: `${tile}-${idx}`,
    tile,
  }));
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
