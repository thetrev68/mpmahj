# Phase 17: Replace Text Tiles with SVG Assets

**Status**: ✅ COMPLETED (2026-01-25)

## Overview

Replace text-based tile display in [HandDisplay.tsx:103-130](../../../apps/client/src/components/HandDisplay.tsx#L103-L130) with SVG assets from `apps/client/public/assets/tiles/`.

## Current State

- **Text rendering**: Uses `tileToCode()` to display codes like "3B", "RD", "E"
- **Tile dimensions**: 60px × 80px buttons with text code + index
- **Special states**: Selected (blue), recommended-discard (orange), tile-needed (green)
- **Available SVGs**: All tiles except Blank (tile 36) have matching SVG assets

## Tile Code → SVG Mapping

| Code | SVG File | Tile Type |
|------|----------|-----------|
| 1B-9B | Mahjong_1s.svg - Mahjong_9s.svg | Bams (sous) |
| 1C-9C | Mahjong_1m.svg - Mahjong_9m.svg | Cracks (mans) |
| 1D-9D | Mahjong_1p.svg - Mahjong_9p.svg | Dots (pins) |
| E, S, W, N | Mahjong_E/S/W/N.svg | Winds |
| GD, RD, WD | Mahjong_H/R/T.svg | Dragons |
| F | Mahjong_F_Winter.svg | Flower |
| J | U+1F02A_MJjoker.svg | Joker |
| BL | *No SVG* | Blank (fallback to text) |

## Implementation Steps

### 1. Add Tile-to-SVG Mapping Function

**File**: [tileFormatter.ts](../../../apps/client/src/utils/tileFormatter.ts)

Add new export function `tileToSvgPath(tile: Tile): string | null` after `tileToCode()` (around line 131):

```typescript
/**
 * Convert Tile index to SVG asset path.
 *
 * @param tile - Tile index (0-36)
 * @returns Path to SVG asset from /assets/tiles/, or null if no SVG exists
 *
 * @example
 * tileToSvgPath(2)  // "/assets/tiles/Mahjong_3s.svg"
 * tileToSvgPath(27) // "/assets/tiles/Mahjong_E.svg"
 * tileToSvgPath(36) // null (Blank tile has no SVG)
 */
export function tileToSvgPath(tile: Tile): string | null {
  const basePath = '/assets/tiles/';

  // Bams: 0-8 → Mahjong_1s to 9s (s = sous)
  if (tile >= 0 && tile <= 8) {
    return `${basePath}Mahjong_${tile + 1}s.svg`;
  }

  // Cracks: 9-17 → Mahjong_1m to 9m (m = mans)
  if (tile >= 9 && tile <= 17) {
    return `${basePath}Mahjong_${tile - 9 + 1}m.svg`;
  }

  // Dots: 18-26 → Mahjong_1p to 9p (p = pins)
  if (tile >= 18 && tile <= 26) {
    return `${basePath}Mahjong_${tile - 18 + 1}p.svg`;
  }

  // Winds: 27-30 → E, S, W, N
  switch (tile) {
    case 27:
      return `${basePath}Mahjong_E.svg`;
    case 28:
      return `${basePath}Mahjong_S.svg`;
    case 29:
      return `${basePath}Mahjong_W.svg`;
    case 30:
      return `${basePath}Mahjong_N.svg`;
  }

  // Dragons: 31-33 → H (Green/Hatsu), R (Red), T (White/Soap)
  switch (tile) {
    case 31:
      return `${basePath}Mahjong_H.svg`; // Green Dragon
    case 32:
      return `${basePath}Mahjong_R.svg`; // Red Dragon
    case 33:
      return `${basePath}Mahjong_T.svg`; // White Dragon (Soap)
  }

  // Special tiles: 34-36
  switch (tile) {
    case 34:
      return `${basePath}Mahjong_F_Winter.svg`; // Flower
    case 35:
      return `${basePath}U+1F02A_MJjoker.svg`; // Joker
    case 36:
      return null; // Blank - no SVG available
  }

  return null; // Unknown tile
}
```

### 2. Update HandDisplay Component

**File**: [HandDisplay.tsx](../../../apps/client/src/components/HandDisplay.tsx)

**a) Import the new function** (line 5):

```typescript
import {
  tileToCode,
  tileToString,
  tileToSvgPath, // ADD THIS
  compareBySuit,
  compareByRank,
  formatMeld,
} from '@/utils/tileFormatter';
```

**b) Replace tile rendering** (lines 104-130):

```typescript
{sortedTiles.map(({ tile, index, key }) => {
  const selected = isSelected(key);
  const isRecommendedDiscard = recommendedDiscard === tile;
  const isTileNeeded = tilesNeeded.includes(tile);
  const svgPath = tileToSvgPath(tile);
  const tileName = tileToString(tile);

  const classNames = [
    'tile-button',
    selected && 'selected',
    isRecommendedDiscard && 'recommended-discard',
    isTileNeeded && 'tile-needed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      key={key}
      className={classNames}
      onClick={() => handleTileClick(key)}
      title={tileName}
    >
      {svgPath ? (
        <img src={svgPath} alt={tileName} className="tile-image" />
      ) : (
        <span className="tile-code">{tileToCode(tile)}</span>
      )}
      <span className="tile-index">{index}</span>
    </button>
  );
})}
```

**Key changes**:

- Call `tileToSvgPath(tile)` to get SVG path
- Conditional: render `<img>` if SVG exists, fallback to text for Blank tile
- Alt text for accessibility
- Keep tile index below image

### 3. Update CSS Styles

**File**: [HandDisplay.css](../../../apps/client/src/components/HandDisplay.css)

**a) Update `.tile-button`** (lines 67-81) - reduce padding:

```css
.tile-button {
  /* ... existing styles ... */
  padding: 0.25rem; /* CHANGED: was 0.5rem */
  overflow: hidden; /* ADD: prevent image overflow */
}
```

**b) Add `.tile-image` styles** (after `.tile-button:hover`, ~line 87):

```css
/* Tile SVG Image */
.tile-image {
  width: 100%;
  height: auto;
  max-height: 56px; /* Leave room for index below */
  object-fit: contain;
  pointer-events: none; /* Prevent image from blocking clicks */
  user-select: none;
  flex-shrink: 0;
}
```

**c) Update `.tile-index`** (lines 117-120):

```css
.tile-index {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.15rem; /* ADD: spacing above */
  flex-shrink: 0; /* ADD: prevent hiding */
}
```

**d) Keep `.tile-code` styles** (lines 110-115) - unchanged for Blank tile fallback

## Edge Cases Handled

1. **Blank tile (36)**: No SVG available → fallback to text code
2. **Missing SVGs**: Function returns `null` → fallback to text
3. **Image loading**: Small SVGs (5-25KB) load quickly, browser caches
4. **Click handling**: `pointer-events: none` on image ensures button clicks work
5. **Special states**: Existing border/shadow CSS works unchanged with images

## Testing Checklist

- [x] All tile types render correctly (Bams, Cracks, Dots, Winds, Dragons, Flower, Joker)
- [x] Blank tile shows text fallback
- [x] Tile indices display below images
- [x] Selected tiles show blue border
- [x] Recommended discard shows orange border
- [x] Tiles needed show green border
- [x] Hover effects work (transform, border color change)
- [x] Clicking tiles toggles selection
- [x] Sorting maintains SVG rendering
- [x] Tooltips show full tile names
- [x] Images fit within 60×80px buttons without distortion

## Critical Files

1. [apps/client/src/utils/tileFormatter.ts](../../../apps/client/src/utils/tileFormatter.ts) - Add `tileToSvgPath()` function
2. [apps/client/src/components/HandDisplay.tsx](../../../apps/client/src/components/HandDisplay.tsx) - Update tile rendering
3. [apps/client/src/components/HandDisplay.css](../../../apps/client/src/components/HandDisplay.css) - Add image styles

## Out of Scope

- **Exposed melds**: Different layout, handle in future PR
- **Discard pile**: Has separate TODO, handle separately
- **SVG file renaming**: Not needed, mapping function handles it
- **Custom Blank SVG**: Not needed, text fallback works fine

## Design Rationale

- **No file renaming**: Mapping function abstracts naming differences cleanly
- **Fallback to text**: Graceful degradation for missing SVGs
- **Minimal CSS changes**: Leverage existing button structure and special states
- **Reusable pattern**: `tileToSvgPath()` can be used for melds and discard pile later
- **Accessibility preserved**: Alt text, tooltips, keyboard navigation maintained

## Technical Details

### SVG Asset Information

From `apps/client/public/assets/tiles/README.md`:

- **Background**: Cream/off-white (#f5f0eb) for contrast
- **Corner numbers**: Red (#dc2626) in American Mahjong style
- **Position**: Top-left corner
- **Size**: SVG files range from 5-25KB each
- **Source**: Wikimedia Commons with programmatic number additions

### Tile Index Mapping (Reference)

```typescript
// From tileFormatter.ts
// Bams: 0-8
// Cracks: 9-17
// Dots: 18-26
// Winds: 27 (E), 28 (S), 29 (W), 30 (N)
// Dragons: 31 (Green), 32 (Red), 33 (White)
// Special: 34 (Flower), 35 (Joker), 36 (Blank)
```

### Japanese Mahjong Terminology (in SVG filenames)

- **s** (sous) = Bams/Bamboo
- **m** (mans) = Cracks/Characters
- **p** (pins) = Dots/Circles
- **H** (Hatsu/發) = Green Dragon
- **R** = Red Dragon
- **T** (Soap/白) = White Dragon

## Implementation Order

1. First: Add `tileToSvgPath()` to tileFormatter.ts
2. Second: Update HandDisplay.tsx imports and rendering
3. Third: Update HandDisplay.css styles
4. Fourth: Test all tile types and special states
5. Fifth: Verify accessibility and edge cases

## Potential Issues & Solutions

### Issue 1: SVG Aspect Ratio

- **Problem**: SVGs might not fit perfectly in 60×80px buttons
- **Solution**: `max-height: 56px` with `object-fit: contain` ensures proper scaling
- **Fallback**: Adjust button dimensions if needed (55×85px)

### Issue 2: Text Index Overlap

- **Problem**: Reduced padding might cause image/index overlap
- **Solution**: `flex-shrink: 0` on both elements prevents compression
- **Fallback**: Increase button height or reduce image max-height

### Issue 3: Click Target

- **Problem**: Image might intercept clicks
- **Solution**: `pointer-events: none` ensures clicks hit button
- **Testing**: Verify in all browsers

### Issue 4: Dark Mode Contrast

- **Problem**: Light SVG backgrounds in dark theme
- **Solution**: Existing border/shadow CSS provides visual separation
- **Status**: Intentional design, no action needed

## Future Enhancements (Phase 18+)

1. **ExposedMeldItem SVGs**: Apply same pattern to meld display
2. **DiscardPile SVGs**: Address TODO in DiscardPile.tsx:50
3. **Custom Blank SVG**: Create matching SVG for Blank tile
4. **Responsive sizing**: Add media queries for mobile
5. **Hover animations**: Enlarge tiles on hover
6. **Loading states**: Add skeleton loaders for SVGs
