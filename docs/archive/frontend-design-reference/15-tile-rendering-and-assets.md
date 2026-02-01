# 15. Tile Rendering and Asset Mapping

This document describes how the frontend converts `Tile` (u8) values to visible assets and labels.

## 15.1 Tile ID Mapping

Tile is a numeric id:

- 0-8: Bams (1-9)
- 9-17: Craks (1-9)
- 18-26: Dots (1-9)
- 27-30: Winds (East, South, West, North)
- 31-33: Dragons (Green, Red, White)
- 34: Flower
- 35: Joker
- 36: Blank (house rule)

## 15.2 Asset Naming

Expected filename format (SVG):

- Suits:
  - Bams: `Mahjong_1s.svg` .. `Mahjong_9s.svg`
  - Craks: `Mahjong_1m.svg` .. `Mahjong_9m.svg`
  - Dots: `Mahjong_1p.svg` .. `Mahjong_9p.svg`
- Winds: `Mahjong_E.svg`, `Mahjong_S.svg`, `Mahjong_W.svg`, `Mahjong_N.svg`
- Dragons: `Mahjong_H.svg` (Green), `Mahjong_R.svg` (Red), `Mahjong_T.svg` (White)
- Joker: `U+1F02A_MJjoker.svg`
- Flower: `Mahjong_Flower.svg`
- Blank: `Mahjong_Blank.svg`

If any assets are missing, fall back to a placeholder tile back image.

## 15.3 Tile Helpers (TS)

Reference implementation:

```ts
import type { Tile } from '@/types/bindings';

export function tileAssetPath(tile: Tile): string {
  if (tile <= 8) return `/assets/tiles/Mahjong_${tile + 1}s.svg`;
  if (tile <= 17) return `/assets/tiles/Mahjong_${tile - 8}m.svg`;
  if (tile <= 26) return `/assets/tiles/Mahjong_${tile - 17}p.svg`;
  if (tile <= 30) return `/assets/tiles/Mahjong_${['E', 'S', 'W', 'N'][tile - 27]}.svg`;
  if (tile <= 33) return `/assets/tiles/Mahjong_${['H', 'R', 'T'][tile - 31]}.svg`;
  if (tile === 34) return `/assets/tiles/Mahjong_Flower.svg`;
  if (tile === 35) return `/assets/tiles/U+1F02A_MJjoker.svg`;
  return `/assets/tiles/Mahjong_Blank.svg`;
}
```text

## 15.4 Accessibility

- Provide `aria-label` text from the tile label (e.g., "5 Dot", "East Wind").
- For hidden tiles, use `aria-label="Hidden tile"`.

## 15.5 Rendering Guidelines

- Tiles should be rendered via `img` for SVGs to keep memory usage low.
- Use CSS to enforce consistent tile aspect ratio across sizes.
- For concealed opponent tiles, render a single stack component instead of 14 individual tiles.
