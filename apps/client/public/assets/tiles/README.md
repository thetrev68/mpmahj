# Mahjong Tile Assets

This directory contains SVG tile graphics with red corner numbers added to match American Mahjong style.

## Tile Naming Convention

The tiles use Wikimedia-style naming with Japanese mahjong terminology:

### Numbered Tiles

- **Dots (Pins)**: `Mahjong_1p.svg` through `Mahjong_9p.svg`
- **Bams (Sous)**: `Mahjong_1s.svg` through `Mahjong_9s.svg`
- **Craks (Mans)**: `Mahjong_1m.svg` through `Mahjong_9m.svg`

### Honor Tiles

- **Winds**: `Mahjong_E.svg`, `Mahjong_S.svg`, `Mahjong_W.svg`, `Mahjong_N.svg`
- **Dragons**:
  - Red Dragon: `Mahjong_R.svg`
  - Green Dragon: `Mahjong_H.svg` (Hatsu/發)
  - White Dragon: `Mahjong_T.svg` (Soap/白)

### Special

- **Joker**: `U+1F02A_MJjoker.svg`

## Corner Numbers

All numbered tiles (1-9 for each suit) and winds (E/S/W/N) have red corner numbers in the top-left, matching traditional American Mahjong tile style.

### Regenerating Tiles with Numbers

If you need to regenerate the tiles with corner numbers:

```bash
npm run tiles:add-numbers
```

This script:
1. Reads tiles from `apps/client/public/assets/`
2. Adds red numbers to the top-left corner
3. Outputs to `apps/client/public/assets/tiles/`

## Source

Original tiles sourced from Wikimedia Commons Mahjong tile collection.
Corner numbers added programmatically via `scripts/add-tile-numbers.js`.

## Design Choices

- **Background**: Cream/off-white (`#f5f0eb`) for better contrast
- **Number Color**: Red (`#dc2626`) matching American Mahjong style
- **Number Position**: Top-left corner, 12% from left, 35% from top
- **Number Size**: 28% of tile width for optimal readability

## Dragon Color Associations

For UI highlighting/theming:

- Green Dragon → Green (`#10b981`) - matches Bam suit color
- Red Dragon → Red (`#ef4444`) - matches Crak suit color
- White Dragon → Blue (`#3b82f6`) - matches Dot suit color
