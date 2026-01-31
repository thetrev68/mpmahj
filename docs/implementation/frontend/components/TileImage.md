# TileImage Component Specification

## Component Type

Presentational Component

## Purpose

Renders a single mahjong tile image with appropriate visual styling based on tile state (concealed, exposed, selected, etc.). This is the atomic building block for all tile visualizations in the game.

## Related User Stories

- US-003: View Own Hand (concealed tiles)
- US-004: Tile Selection (interactive selection state)
- US-005: View Exposed Melds (exposed tile styling)
- US-024: Observe Opponents (back-of-tile view)
- US-026: Replay Controls (static tile display)

## TypeScript Interface

````typescript
export interface TileImageProps {
  /** Tile index (0-41) or null for empty slot */
  tile: number | null;

  /** Display state affecting visual presentation */
  state?: 'concealed' | 'exposed' | 'selected' | 'highlighted' | 'disabled' | 'facedown';

  /** Size variant for different contexts */
  size?: 'small' | 'medium' | 'large';

  /** Whether the tile is interactive (clickable) */
  interactive?: boolean;

  /** Click handler for interactive tiles */
  onClick?: (tile: number) => void;

  /** Hover handler for showing tooltips/previews */
  onHover?: (tile: number | null) => void;

  /** Additional CSS classes for custom styling */
  className?: string;

  /** ARIA label for accessibility (auto-generated if not provided) */
  ariaLabel?: string;

  /** Whether to show tile number overlay (for learning mode) */
  showNumber?: boolean;

  /** Animation state for tile transitions */
  animationState?: 'entering' | 'leaving' | 'idle';
}
```text

## State Management

**Stateless** - All state is managed by parent components.

## Visual Design

### Size Variants

- **small**: 32x44px (for opponent hands, history view)
- **medium**: 48x66px (default, player hand)
- **large**: 64x88px (for selected tile preview, discard display)

### Display States

1. **concealed**: Full color, face-up, default appearance
2. **exposed**: Slightly rotated (horizontal orientation), full color
3. **selected**: Elevated with shadow, border highlight
4. **highlighted**: Subtle glow/border for valid selections
5. **disabled**: Reduced opacity (0.5), grayscale filter
6. **facedown**: Shows tile back pattern (for opponents in competitive mode)

### Visual Effects

- Hover: Slight elevation (2px translateY) with transition (150ms ease-out)
- Click: Scale animation (0.95 → 1.0) over 100ms
- Selection: 300ms ease-in-out transition to elevated state
- Loading: Pulse animation while tile images are loading

## Asset Requirements

- Tile images in `/public/tiles/` directory
- Naming convention: `{suit}{rank}.png` (e.g., `b1.png`, `c5.png`, `d9.png`)
- Special tiles: `joker.png`, `flower.png`, `white.png`, `green.png`, `red.png`
- Tile back: `back.png` for facedown state
- Transparent PNGs with consistent dimensions
- 2x resolution for Retina displays (`@2x` suffix)

## Accessibility

### ARIA Attributes

- `role="button"` when interactive
- `aria-label`: Auto-generated as "{Rank} of {Suit}" (e.g., "5 of Bams")
  - Joker: "Joker"
  - Dragon: "Red Dragon", "Green Dragon", "White Dragon"
  - Flower: "Flower"
- `aria-pressed={state === 'selected'}` for selected state
- `aria-disabled={state === 'disabled'}` when disabled
- `tabIndex={interactive ? 0 : -1}` for keyboard navigation

### Keyboard Support (when interactive)

- `Enter` or `Space`: Trigger onClick
- `Escape`: Clear selection (communicated via onHover(null))
- Focus visible indicator matching selected state styling

### Screen Reader Announcements

- On selection: "Selected {tile name}"
- On deselection: "Deselected {tile name}"
- When disabled: "{tile name}, unavailable"

## Dependencies

### External

- React (hooks: `useMemo`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/utils/tileFormatter` - `tileToString()` for ARIA labels
- `@/hooks/useImagePreload` - Preload tile images on mount
- `@/styles/tiles.module.css` - Component-specific styles

### Generated Types

- `@/types/bindings/generated/Tile.ts` (Rust type binding)

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Wrap component with `React.memo()` for tile index comparison
2. **Image Preloading**: Use `useImagePreload` hook to load all tile images on app start
3. **CSS Transform**: Use `transform` for animations (GPU-accelerated)
4. **Lazy Loading**: Consider intersection observer for tiles outside viewport (in large history views)

### Error Handling

- Invalid tile index (< 0 or > 41): Render placeholder with warning in dev mode
- Missing image asset: Show fallback tile with text label
- Null tile: Render empty slot (transparent placeholder maintaining layout)

### Responsive Behavior

- Touch devices: Increase hit target to 44x44px minimum (iOS/Android guidelines)
- Hover effects: Disabled on touch devices (use `:hover` with `@media (hover: hover)`)
- Size adjusts based on container width in mobile layouts

## Test Scenarios

### Unit Tests

```typescript
describe('TileImage', () => {
  it('renders tile with correct image source', () => {
    // tile=0 (1 Bam) should render b1.png
  });

  it('applies correct ARIA label for suited tiles', () => {
    // tile=0 should have aria-label="1 of Bams"
  });

  it('applies correct ARIA label for special tiles', () => {
    // tile=41 (Joker) should have aria-label="Joker"
  });

  it('calls onClick when interactive tile is clicked', () => {
    // interactive=true, onClick should fire with tile index
  });

  it('does not call onClick when disabled', () => {
    // state='disabled', onClick should not fire
  });

  it('renders facedown state for concealed opponent tiles', () => {
    // state='facedown' should show back.png
  });

  it('applies size class correctly', () => {
    // size='large' should apply correct CSS class
  });

  it('handles null tile gracefully', () => {
    // tile=null should render empty slot
  });

  it('applies custom className', () => {
    // className prop should be merged with base classes
  });

  it('shows tile number overlay when enabled', () => {
    // showNumber=true should render tile index overlay
  });
});
```text

### Integration Tests

```typescript
describe('TileImage Integration', () => {
  it('preloads all tile images on mount', () => {
    // useImagePreload should be called with all tile paths
  });

  it('supports keyboard navigation when interactive', () => {
    // Tab focus, Enter/Space triggers onClick
  });

  it('announces selection to screen readers', () => {
    // aria-live region updates on selection change
  });

  it('adapts to theme changes', () => {
    // CSS variables update based on theme context
  });
});
```text

### Visual Regression Tests

- Screenshot comparison for all tile types in each state
- Different size variants rendering correctly
- Hover and selection animations

## Usage Examples

### Basic Usage

```tsx
import { TileImage } from '@/components/tiles/TileImage';

// Simple tile display
<TileImage tile={0} /> {/* 1 of Bams */}

// Interactive tile with selection
<TileImage
  tile={15}
  state={selectedTile === 15 ? 'selected' : 'concealed'}
  interactive
  onClick={handleTileClick}
/>

// Disabled tile in opponent's exposed meld
<TileImage
  tile={27}
  state="exposed"
  size="small"
/>

// Facedown tile (opponent's concealed hand)
<TileImage
  tile={null}
  state="facedown"
  size="small"
/>
```text

### In Hand Display

```tsx
{
  hand.map((tile, index) => (
    <TileImage
      key={index}
      tile={tile}
      state={selectedIndices.includes(index) ? 'selected' : 'concealed'}
      interactive={canSelectTiles}
      onClick={() => handleTileSelect(index)}
      size="medium"
    />
  ));
}
```text

### In Meld Display

```tsx
<div className="meld-container">
  {meld.tiles.map((tile, index) => (
    <TileImage
      key={index}
      tile={tile}
      state="exposed"
      size="medium"
      className={meld.isKong && index > 2 ? 'stacked' : ''}
    />
  ))}
</div>
```text

## Style Guidelines

### CSS Module Structure

```css
.tile {
  /* Base styles */
  position: relative;
  display: inline-block;
  transition: all 0.3s ease-in-out;
  cursor: default;
}

.tile--interactive {
  cursor: pointer;
}

.tile--small {
  width: 32px;
  height: 44px;
}
.tile--medium {
  width: 48px;
  height: 66px;
}
.tile--large {
  width: 64px;
  height: 88px;
}

.tile--selected {
  transform: translateY(-8px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.tile--disabled {
  opacity: 0.5;
  filter: grayscale(1);
  cursor: not-allowed;
}

/* State-specific styles... */
```text

## Future Enhancements

- [ ] Support for custom tile skins/themes
- [ ] Animated tile flipping for reveal effects
- [ ] 3D rotation effects (CSS transform perspective)
- [ ] Tile glow effects for special patterns
- [ ] Haptic feedback on mobile devices
- [ ] WebGL renderer for advanced effects

## Notes

- Tile indices 0-41 map to Rust backend tile system (see `data/cards/README_RUNTIME.md`)
- Joker (index 41) has special rendering considerations
- Component should be pure and highly reusable across all game phases
- Consider creating a `TileImageSkeleton` component for loading states
````
