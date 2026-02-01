# ConcealedHand

## Purpose

Displays the current player's concealed tiles in a horizontal rack with selection, sorting, and interaction capabilities. Handles both Charleston (select 3 tiles) and gameplay (select 1 to discard) modes.

## User Stories

- US-002: Charleston tile selection (3 tiles)
- US-004: Blind pass selection (1-2 tiles)
- US-009: Draw and discard during gameplay
- US-010: Discard selection
- US-016: Organize hand by suits

## Props

````typescript
interface ConcealedHandProps {
  // Tile data
  tiles: Tile[]; // Player's current hand (13 or 14 tiles)

  // Interaction mode
  mode: 'charleston' | 'discard' | 'view-only';

  // Selection state
  selectedIndices: number[]; // Indices of selected tiles (position in hand array)
  onTileSelect: (index: number) => void;
  maxSelection?: number; // Default: 3 for charleston, 1 for discard

  // Display options
  sortBy?: 'suit' | 'value' | 'manual'; // Default: 'suit'
  highlightNewTile?: number; // Index of freshly drawn tile
  disabled?: boolean;

  // Accessibility
  ariaLabel?: string;
}

// Tile is a numeric index (0-36) from bindings: Tile
```text

## Behavior

### Selection Logic

- **Charleston mode**: Select up to 3 tiles
  - Click to select/deselect
  - Jokers cannot be selected (per American Mahjong rules)
  - Selected tiles show visual indicator (raised, highlighted)

- **Discard mode**: Select exactly 1 tile
  - Click to select (auto-deselects previous)
  - Cannot select the just-drawn tile initially (edge case: see rules)
  - Selected tile highlights differently than Charleston

- **View-only mode**: No selection (opponent hands, replay viewer)

### Tile Sorting

- **By suit** (default): Group by Bam → Crak → Dot → Wind → Dragon → Flower → Joker → Blank
  - Within each suit, sort by rank (1-9)

- **By value**: Numerical order (ignoring suits)

- **Manual**: User can drag tiles to reorder (future enhancement)

### Visual Feedback

- **New tile**: Briefly highlight the just-drawn tile (500ms)
- **Hoverable**: Show subtle elevation on hover
- **Selected**: Raise tile 8px + add border/shadow
- **Disabled**: Reduce opacity, prevent interaction

### Keyboard Navigation

- Arrow keys: Move focus between tiles
- Space/Enter: Select/deselect focused tile
- 1-9 keys: Jump to tile rank (accessibility shortcut)

## Visual Requirements

### Layout

- Horizontal rack layout (tiles in a row)
- Responsive spacing:
  - Desktop: 4px gap, tiles overlap by 12px for compact view
  - Mobile: Smaller tiles, stack if needed
- Center-aligned within container

### Tile States

1. **Default**: Normal size, full opacity
2. **Hovered**: Slight elevation (translateY: -4px)
3. **Selected**: Raised (translateY: -8px), blue border, shadow
4. **New**: Yellow glow border (500ms duration)
5. **Disabled**: 50% opacity, cursor: not-allowed

### Animations

- Tile selection: Smooth 200ms ease-out transition
- New tile highlight: Fade-in glow, fade-out over 500ms
- Tile reordering: Smooth position transitions (future)

### Joker Indicator

- Jokers show "JOKER" text or special icon
- Jokers are visually distinct (different color/pattern)
- Jokers cannot be selected during Charleston (grayed out)

## Related Components

- **Uses**: `<Tile>` (renders each tile)
- **Uses**: `useTileSelection()` (selection logic hook)
- **Used by**: `<PlayerRack>` (embeds hand display)
- **Used by**: `<GameBoard>` (for current player's hand)

## Implementation Notes

### Selection State Management

```typescript
// Managed by useTileSelection() hook
const { selectedIndices, toggleTile, clearSelection, canSelectMore } = useTileSelection({
  maxSelection: mode === 'charleston' ? 3 : 1,
  tiles,
  mode,
});
```text

### Tile Sorting Algorithm

```typescript
function sortTiles(tiles: Tile[], sortBy: SortMode): Tile[] {
  if (sortBy === 'manual') return tiles;

  const suitOrder = { Bam: 0, Crak: 1, Dot: 2, Wind: 3, Dragon: 4, Flower: 5, Joker: 6, Blank: 7 };

  return [...tiles].sort((a, b) => {
    const aMeta = toTileMeta(a);
    const bMeta = toTileMeta(b);
    if (sortBy === 'suit') {
      const suitDiff = suitOrder[aMeta.suit] - suitOrder[bMeta.suit];
      if (suitDiff !== 0) return suitDiff;
    }
    return aMeta.rank - bMeta.rank;
  });
}
```text

### Joker Blocking (Charleston)

```typescript
function isTileSelectable(tile: Tile, mode: string): boolean {
  if (mode === 'charleston' && tile === 35) return false; // Joker index
  return true;
}
```text

### Performance Considerations

- Memoize sorted tile array to prevent re-sorting on every render
- Use `key={index}` for rendering because duplicates exist; selection is index-based
- Lazy load tile images if using large graphics

### Accessibility

- Each tile is a focusable button (`<button>` or `role="button"`)
- ARIA labels: "5 Bamboo, selected" or "Joker, cannot be selected"
- ARIA live region announces selection count: "2 of 3 tiles selected"

## Testing Considerations

- Verify selection limits (3 for Charleston, 1 for discard)
- Test Joker blocking during Charleston
- Validate sorting algorithms (suit, value)
- Test keyboard navigation
- Verify new tile highlight timing
- Edge case: Empty hand (should render empty state)

## Example Usage

```tsx
// Charleston mode - select 3 tiles
<ConcealedHand
  tiles={playerHand}
  mode="charleston"
  selectedIndices={selectedIndices}
  onTileSelect={handleTileSelect}
  maxSelection={3}
  sortBy="suit"
/>

// Discard mode - select 1 tile
<ConcealedHand
  tiles={playerHand}
  mode="discard"
  selectedIndices={[discardIndex]}
  onTileSelect={handleDiscard}
  maxSelection={1}
  highlightNewTile={13}  // Just drew tile at index 13
/>

// View-only (opponent's hand count shown via TileBacksRow in PlayerRack)
<ConcealedHand
  tiles={[]}
  mode="view-only"
  disabled={true}
/>
```text

## Edge Cases

1. **14 vs 13 tiles**: Current player has 14 after drawing, others have 13
2. **Joker pass restriction**: Must visually disable Jokers during Charleston
3. **Invalid selection**: Prevent selecting beyond max (disable remaining tiles)
4. **Empty hand**: Shouldn't happen in real game, but show placeholder
5. **Newly drawn tile**: Some rulesets prevent immediate discard of drawn tile (house rule)

---

**Estimated Complexity**: Medium (~150-180 lines implementation)
**Dependencies**: `<Tile>`, `useTileSelection()`
**Phase**: Phase 1 - MVP Core
````
