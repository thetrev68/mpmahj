# Mahjong Tile Assets

This directory contains a set of SVG tile graphics. The graphics are set on a transparent background.

## Tile Naming Convention

The tiles use simple naming with mahjong terminology:

### Numbered Tiles (aka Suits)

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

## Tile Sort Reference

Use this table when you need a stable display order for racks, previews, or UI sorting.
Treat Sort Sequence as the canonical client-facing order, and keep it aligned with any tile comparator logic used in the app.

| Tile Index | Sort Sequence | Tile   | Filename       | Description            |
| ---------- | ------------- | ------ | -------------- | ---------------------- |
| 42         | 1             | Joker  | `J_clear.svg`  | Joker                  |
| 34         | 2             | Flower | `F1_clear.svg` | Spring - Peony         |
| 35         | 3             | Flower | `F2_clear.svg` | Summer - Lotus         |
| 36         | 4             | Flower | `F3_clear.svg` | Autumn - Chrysanthemum |
| 37         | 5             | Flower | `F4_clear.svg` | Winter - Plum blossom  |
| 38         | 6             | Flower | `F5_clear.svg` | Plum blossom           |
| 39         | 7             | Flower | `F6_clear.svg` | Orchid                 |
| 40         | 8             | Flower | `F7_clear.svg` | Chrysanthemum          |
| 41         | 9             | Flower | `F8_clear.svg` | Bamboo                 |
| 0          | 10            | 1B     | `1B_clear.svg` | 1 Bam                  |
| 1          | 11            | 2B     | `2B_clear.svg` | 2 Bam                  |
| 2          | 12            | 3B     | `3B_clear.svg` | 3 Bam                  |
| 3          | 13            | 4B     | `4B_clear.svg` | 4 Bam                  |
| 4          | 14            | 5B     | `5B_clear.svg` | 5 Bam                  |
| 5          | 15            | 6B     | `6B_clear.svg` | 6 Bam                  |
| 6          | 16            | 7B     | `7B_clear.svg` | 7 Bam                  |
| 7          | 17            | 8B     | `8B_clear.svg` | 8 Bam                  |
| 8          | 18            | 9B     | `9B_clear.svg` | 9 Bam                  |
| 31         | 19            | DG     | `DG_clear.svg` | Green Dragon           |
| 9          | 20            | 1C     | `1C_clear.svg` | 1 Crak                 |
| 10         | 21            | 2C     | `2C_clear.svg` | 2 Crak                 |
| 11         | 22            | 3C     | `3C_clear.svg` | 3 Crak                 |
| 12         | 23            | 4C     | `4C_clear.svg` | 4 Crak                 |
| 13         | 24            | 5C     | `5C_clear.svg` | 5 Crak                 |
| 14         | 25            | 6C     | `6C_clear.svg` | 6 Crak                 |
| 15         | 26            | 7C     | `7C_clear.svg` | 7 Crak                 |
| 16         | 27            | 8C     | `8C_clear.svg` | 8 Crak                 |
| 17         | 28            | 9C     | `9C_clear.svg` | 9 Crak                 |
| 32         | 29            | DR     | `DR_clear.svg` | Red Dragon             |
| 18         | 30            | 1D     | `1D_clear.svg` | 1 Dot                  |
| 19         | 31            | 2D     | `2D_clear.svg` | 2 Dot                  |
| 20         | 32            | 3D     | `3D_clear.svg` | 3 Dot                  |
| 21         | 33            | 4D     | `4D_clear.svg` | 4 Dot                  |
| 22         | 34            | 5D     | `5D_clear.svg` | 5 Dot                  |
| 23         | 35            | 6D     | `6D_clear.svg` | 6 Dot                  |
| 24         | 36            | 7D     | `7D_clear.svg` | 7 Dot                  |
| 25         | 37            | 8D     | `8D_clear.svg` | 8 Dot                  |
| 26         | 38            | 9D     | `9D_clear.svg` | 9 Dot                  |
| 33         | 39            | DW     | `DW_clear.svg` | White Dragon           |
| 27         | 40            | E      | `E_clear.svg`  | East Wind              |
| 28         | 41            | S      | `S_clear.svg`  | South Wind             |
| 29         | 42            | W      | `W_clear.svg`  | West Wind              |
| 30         | 43            | N      | `N_clear.svg`  | North Wind             |
| 43         | 44            | B      | -              | Blank                  |

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
