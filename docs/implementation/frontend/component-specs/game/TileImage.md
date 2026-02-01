# TileImage

## Purpose

Renders the visual representation (SVG or image asset) for a single Mahjong tile based on its suit and rank. Handles all 43 tile types (suits 1-9, winds, dragons, flowers, jokers) with responsive sizing.

## User Stories

- All stories - tiles must be visually identifiable
- US-002: Clear tile display during Charleston selection
- US-009: Tile clarity during gameplay

## Props

````typescript
interface TileImageProps {
  // Tile identification
  suit: TileSuit; // From bindings: 'Bam' | 'Crak' | 'Dot' | 'Wind' | 'Dragon' | 'Flower' | 'Joker'
  rank: number; // 1-9 for suits, 1-4 for winds, 1-3 for dragons, 1-8 for flowers/jokers

  // Display options
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; // Default: 'md'
  className?: string; // Additional Tailwind classes

  // Accessibility
  ariaLabel?: string; // Auto-generated if not provided
}
```text

## Behavior

### Tile Identification

- Maps `suit` + `rank` to correct asset file or SVG component
- Examples:
  - `{suit: 'Bam', rank: 5}` → "5 Bamboo" tile
  - `{suit: 'Dragon', rank: 1}` → "Red Dragon"
  - `{suit: 'Joker', rank: 1}` → "Joker" (all jokers look the same)

### Size System

Responsive sizing using Tailwind:

- `xs`: 24×32px (tiny hand view)
- `sm`: 32×42px (compact)
- `md`: 48×64px (standard, default)
- `lg`: 64×85px (selected)
- `xl`: 96×128px (celebration)

### Asset Loading

- **Existing Assets**: SVG files already exist in the codebase
  - Located in `apps/client/src/assets/` (Chinese-named files)
  - Also in `apps/client/public/assets/tiles/` (Western-named files)
  - Both transparent-backed and opaque white-backed versions available
- Lazy loading for performance
- Fallback to text if asset fails to load

### Accessibility

- Auto-generate aria-label: `"5 Bamboo tile"`, `"Red Dragon"`, `"Joker"`
- Descriptive alt text for images
- Semantic HTML (use `<img>` or `<svg>` appropriately)

## Visual Requirements

### Layout

- Aspect ratio: 3:4 (standard Mahjong tile proportions)
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

**SVG Assets Available** - Two asset sets already in codebase:

1. **Chinese-named assets** (`apps/client/src/assets/`):
   - Characters/Man (萬): `0101一萬.svg` to `0109九萬.svg`
   - Dots/Pin (餅): `0201一餅.svg` to `0209九餅.svg`
   - Bamboo/Sou (條): `0301一條.svg` to `0309九條.svg`
   - Winds: `0401東風.svg`, `0402西風.svg`, `0403南風.svg`, `0404北風.svg`
   - Dragons: `0405中.svg` (Red), `0406發.svg` (Green), `0407白.svg` (White)
   - Flowers: `0501春.svg` through `0508竹.svg`

2. **Western-named assets** (`apps/client/public/assets/tiles/`):
   - Man: `Mahjong_1m.svg` to `Mahjong_9m.svg`
   - Pin: `Mahjong_1p.svg` to `Mahjong_9p.svg`
   - Sou: `Mahjong_1s.svg` to `Mahjong_9s.svg`
   - Winds: `Mahjong_E.svg`, `Mahjong_S.svg`, `Mahjong_W.svg`, `Mahjong_N.svg`
   - Flowers: `Mahjong_F_Winter.svg` (sample)
   - Joker: `U+1F02A_MJjoker.svg`

**Implementation Approach**:

- Use Western-named assets from `public/assets/tiles/` (easier to serve via Vite)
- Import via standard Vite asset import: `import tileSrc from '/assets/tiles/Mahjong_1m.svg'`
- Create mapping function: `getTileAssetPath(suit: TileSuit, rank: number): string`
- Pre-load common tiles (1-9 of each suit), lazy-load rare tiles (flowers)
- Both transparent and opaque white backgrounds available (use based on UI needs)

### Performance

- Pure presentational component (no state, no effects)
- Should be memoized if parent re-renders frequently
- Consider sprite sheet for production (single HTTP request)

### Tile Index Mapping

Backend uses tile indices 0-41. Frontend converts to suit/rank:

- See `apps/client/src/utils/tileMapping.ts` (to be created)
- Example: index `5` → `{suit: 'Bam', rank: 6}`

### ARIA Labels

Generate descriptive labels:

```typescript
function getTileLabel(suit: TileSuit, rank: number): string {
  if (suit === 'Joker') return 'Joker';
  if (suit === 'Flower') return 'Flower';
  if (suit === 'Wind') return ['East', 'South', 'West', 'North'][rank - 1] + ' Wind';
  if (suit === 'Dragon') return ['Red', 'Green', 'White'][rank - 1] + ' Dragon';
  return `${rank} ${suit}`; // "5 Bamboo", "7 Crack", etc.
}
```text

## Testing Considerations

- Verify all 43 tile types render correctly
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
```text

---

**Estimated Complexity**: Simple (~50-80 lines implementation)
**Dependencies**: None (pure presentational)
**Phase**: Phase 1 - MVP Core
````
