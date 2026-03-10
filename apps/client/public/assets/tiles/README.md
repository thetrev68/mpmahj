# Mahjong Tile Assets

This directory contains a set of SVG tile graphics. The graphics are set on a transparent background.

## Tile Naming Convention

The tiles use simple naming with mahjong terminology:

### Numbered Tiles

- **Dots (Pins)**: `1D.svg` through `9D.svg`
- **Bams (Sous)**: `1B.svg` through `9B.svg`
- **Craks (Mans)**: `1C.svg` through `9C.svg`

### Honor Tiles

- **Winds**: `E.svg`, `S.svg`, `W.svg`, `N.svg`
- **Dragons**:
  - Red Dragon: `DR.svg`
  - Green Dragon: `DG.svg`
  - White Dragon (Soap): `DW.svg`

### Special

- **Joker**: `J.svg`

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

Original tiles sourced from Wikimedia Commons Mahjong tile collection (Category:SVG Planar illustrations of Mahjong tiles).
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
