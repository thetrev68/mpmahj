# Tile Component

## Purpose

Displays a single Mahjong tile with suit, rank, and visual state (selected, disabled, highlighted). The fundamental building block of the entire game UI.

## User Stories

- All gameplay stories (US-001 through US-036)
- Critical for: US-002 (Charleston), US-009 (Drawing), US-010 (Discarding), US-013 (Calling)

## Props

```typescript
interface TileProps {
  /** Tile index (0-36) from bindings */
  tile: Tile;

  /** Visual state */
  state?: 'default' | 'selected' | 'disabled' | 'highlighted' | 'dimmed';

  /** Whether tile shows face or back */
  faceUp?: boolean; // default: true

  /** Click handler */
  onClick?: (tile: Tile) => void;

  /** Hover handler for tooltips */
  onHover?: (tile: Tile) => void;

  /** Size variant */
  size?: 'small' | 'medium' | 'large'; // default: 'medium'

  /** Rotation for exposed melds */
  rotated?: boolean;

  /** Accessibility label override */
  ariaLabel?: string;

  /** Test ID */
  testId?: string;
}
```

## Behavior

**Selection**:

- Click triggers `onClick` handler
- Visual feedback on hover (subtle lift/glow)
- Disabled tiles don't respond to clicks

**States**:

- `default`: Normal tile appearance
- `selected`: Raised 8px, yellow border, shadow
- `disabled`: Grayed out, red tint, diagonal strike (for Jokers in Charleston)
- `highlighted`: Pulsing border (for hints, exchangeable Jokers)
- `dimmed`: Semi-transparent (for other players' tiles)

**Rotation**:

- `rotated={true}`: Rotates 90° clockwise (for called tiles in exposed melds)

## Visual Requirements

**Layout**:

- Aspect ratio: 7:10 (width:height, matching SVG viewBox 139.764 × 200)
- Default size (player tiles): 63px × 90px (medium)
- Small (discarded tiles): 32px × 46px
- Large (selected state): 60px × 80px (or larger)
- Opponent tiles (E/W): 8vh × 11.4vh (maintains 7:10 ratio)

**Face-up tile**:

- Background: Applied via CSS wrapper - white gradient (`#ffffff` to `#f0f0f0`, 135deg)
- Border: 2px solid #999 (via CSS)
- Border radius: 4px (via CSS)
- Tile image rendered via `<TileImage>` component (transparent SVG)
- Suit and rank clearly visible
- Box shadow: `0 2px 4px rgba(0,0,0,0.2)`

**Face-down tile**:

- Background: White gradient (concealed)
- Border: 2px solid #999
- No suit/rank visible

**Interactive states**:

- **Hover**: Lift 8px (translateY(-8px)), box-shadow: `0 6px 12px rgba(0,0,0,0.3)`
- **Selected**: Raised 12px (translateY(-12px)), border-color: #ffd700 (gold), shadow: `0 8px 16px rgba(255, 215, 0, 0.5)`
- **Disabled**: opacity: 0.5, filter: grayscale(50%), cursor: not-allowed
- **Highlighted**: animation: pulse 1.5s infinite (border glow)
- **Newly drawn**: Pulsing gold glow animation (2s keyframe)

## Accessibility

**ARIA**:

- `role="button"` (if clickable)
- `aria-label`: "3 Bam (2)" or "Joker (35)" or "Red Dragon (32)"
- `aria-pressed="true"` (if selected)
- `aria-disabled="true"` (if disabled)

**Keyboard**:

- Focusable: `tabindex="0"` (if clickable)
- Enter/Space: Trigger click
- Focus ring visible

**Screen Reader**:

- Announce tile name on focus
- Announce state change ("3 Bam (2) selected", "Joker (35) cannot be passed")

## Related Components

**Uses**:

- `<TileImage>` - Renders SVG/image asset

**Used by**:

- `<ConcealedHand>` - Player's hand
- `<DiscardPile>` - Discard grid
- `<ExposedMelds>` - Public melds
- `<Wall>` - Wall display
- `<TileGroup>` - Meld groups

## Implementation Notes

**Tile Identifier**:

- Accepts tile index (0-36)
- Convert to consistent format internally
- Use `tileToString()` utility for display names

**Performance**:

- Memoize with `React.memo()` - tiles re-render frequently
- Use CSS transforms for animations (not position changes)
- Lazy load tile images if needed

**Tile States**:

- Use CSS classes, not inline styles
- State changes should animate (150ms ease-out)

**Click Handling**:

- Debounce rapid clicks (prevent double-selection)
- Don't call onClick if disabled
- Provide haptic feedback on mobile (if available)

**Tile Rendering with Transparent SVGs**:

```tsx
// Recommended structure: CSS wrapper around transparent SVG
<div className="tile-wrapper">
  <TileImage tile={tile} />
</div>

// CSS styling:
.tile-wrapper {
  width: 63px;
  height: 90px;
  background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
  border: 2px solid #999;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.2s ease;
}

.tile-wrapper:hover {
  transform: translateY(-8px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.3);
}

.tile-wrapper.selected {
  transform: translateY(-12px);
  border-color: #ffd700;
  box-shadow: 0 8px 16px rgba(255, 215, 0, 0.5);
}
```

**Example Usage**:

```tsx
// Basic tile
<Tile tile={2} onClick={handleTileClick} />

// Selected tile
<Tile tile={5} state="selected" />

// Disabled Joker (Charleston)
<Tile tile={35} state="disabled" />

// Rotated tile in exposed meld
<Tile tile={15} rotated size="small" />
```

---

**Spec version**: 1.0
**Lines**: ~150
