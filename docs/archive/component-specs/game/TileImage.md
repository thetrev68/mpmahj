# TileImage

## Purpose

Renders the visual representation (SVG or image asset) for a single Mahjong tile based on its suit and rank. Handles all 37 tile types (0-36 indices, including Joker and Blank) with responsive sizing.

## User Stories

- All stories - tiles must be visually identifiable
- US-002: Clear tile display during Charleston selection
- US-009: Tile clarity during gameplay

## Props

```typescript
interface TileImageProps {
  // Tile identification
  suit: TileSuit; // 'Bam' | 'Crak' | 'Dot' | 'Wind' | 'Dragon' | 'Flower' | 'Joker' | 'Blank'
  rank: number; // 1-9 for suits, 1-4 for winds, 1-3 for dragons, 1-8 for flowers

  // Display options
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; // Default: 'md'
  className?: string; // Additional Tailwind classes

  // Accessibility
  ariaLabel?: string; // Auto-generated if not provided
}
```

## Behavior

### Tile Identification

- Maps `suit` + `rank` to correct asset file or SVG component
- Examples:
  - `{suit: 'Bam', rank: 5}` → "5 Bam (4)" tile
  - `{suit: 'Dragon', rank: 1}` → "Red Dragon (32)"
  - `{suit: 'Joker', rank: 1}` → "Joker (35)" (all jokers look the same)

### Size System

Sizes based on UI-LAYOUT-SPEC (7:10 aspect ratio):

- `xs`: 24×34px (tiny hand view)
- `sm`: 32×46px (discarded tiles in center)
- `md`: 63×90px (player tiles, standard, default)
- `lg`: 80×114px (selected/emphasized)
- `xl`: 96×137px (celebration/winner display)

### Asset Loading

- **Recommended Assets**: Transparent SVG files (preferred for flexibility)
  - Located in `apps/client/src/assets/tiles/*_clear.svg`
  - Transparent background allows CSS styling for backgrounds, borders, hover effects
  - Example: `1B_clear.svg`, `2C_clear.svg`, `DR_clear.svg`, `J_clear.svg`
- **Alternative Assets**: Opaque white-backed versions
  - Located in `apps/client/public/assets/tiles/`
  - Use for static displays only
- Lazy loading for performance
- Fallback to text if asset fails to load

### Accessibility

- Auto-generate aria-label: `"5 Bam (4) tile"`, `"Red Dragon (32)"`, `"Joker (35)"`
- Descriptive alt text for images
- Semantic HTML (use `<img>` or `<svg>` appropriately)

## Visual Requirements

### Layout

- Aspect ratio: 7:10 (from SVG viewBox: 139.764 × 200)
- Maintains aspect ratio across all sizes
- No stretching or distortion

### States

- Default: Full opacity, clear rendering
- Loading: Skeleton/placeholder
- Error: Fallback text representation

### Placeholder Design (Phase 1)

Simple SVG with:

- Background color by suit (Bam=green, Crak=red, Dot=blue, etc.)
- Large rank number or symbol
- Tile border

## Related Components

- **Used by**: `<Tile>` (renders this inside tile wrapper)
- **Used by**: `<PatternDisplay>` (shows winning patterns)

## Implementation Notes

### Asset Strategy

**Recommended: Transparent SVG Assets** - `apps/client/src/assets/tiles/`:

- Bams: `1B_clear.svg` to `9B_clear.svg`
- Craks: `1C_clear.svg` to `9C_clear.svg`
- Dots: `1D_clear.svg` to `9D_clear.svg`
- Winds: `E_clear.svg`, `S_clear.svg`, `W_clear.svg`, `N_clear.svg`
- Dragons: `DR_clear.svg` (Red), `DG_clear.svg` (Green), `DW_clear.svg` (White)
- Flowers: `F1_clear.svg` ... `F8_clear.svg`
- Joker: `J_clear.svg`
- Blank: `Blank_clear.svg`

**Alternative: Opaque SVG Assets** - `apps/client/public/assets/tiles/`:

- Same naming without `_clear` suffix (e.g., `1B.svg`, `2C.svg`)
- Use for static displays or non-interactive elements

**Implementation Approach**:

- **Prefer transparent versions** from `apps/client/src/assets/tiles/`
- Apply white gradient background via CSS wrapper divs for default tile appearance
- Create mapping function: `getTileAssetPath(suit: TileSuit, rank: number): string`
- Pre-load common tiles (1-9 of each suit), lazy-load rare tiles (flowers)
- Transparent SVGs enable custom styling: borders, shadows, hover effects, selection states

### Performance

- Pure presentational component (no state, no effects)
- Should be memoized if parent re-renders frequently
- Consider sprite sheet for production (single HTTP request)

### Tile Index Mapping

Backend uses tile indices 0-36. Frontend converts to suit/rank:

- See `apps/client/src/utils/tileMapping.ts` (to be created)
- Example: index `5` → `{suit: 'Bam', rank: 6}`

### ARIA Labels

Generate descriptive labels:

```typescript
function getTileLabel(suit: TileSuit, rank: number): string {
  const index = suitRankToIndex(suit, rank); // 0-36
  if (suit === 'Joker') return `Joker (${index})`;
  if (suit === 'Blank') return `Blank (${index})`;
  if (suit === 'Flower') return `Flower (${index})`;
  if (suit === 'Wind') return `${['East', 'South', 'West', 'North'][rank - 1]} Wind (${index})`;
  if (suit === 'Dragon') return `${['Red', 'Green', 'White'][rank - 1]} Dragon (${index})`;
  return `${rank} ${suit} (${index})`;
}
```

## Testing Considerations

- Verify all 37 tile types render correctly
- Test all 5 size variants
- Verify fallback on asset load failure
- Validate ARIA labels for accessibility
- Check aspect ratio preservation

## Example Usage

```tsx
// Simple tile
<TileImage suit="Bam" rank={5} />

// Large selected tile
<TileImage suit="Dragon" rank={1} size="lg" />

// Custom styling
<TileImage
  suit="Joker"
  rank={1}
  size="md"
  className="shadow-lg ring-2 ring-blue-500"
/>
```

---

**Estimated Complexity**: Simple (~50-80 lines implementation)
**Dependencies**: None (pure presentational)
**Phase**: Phase 1 - MVP Core
