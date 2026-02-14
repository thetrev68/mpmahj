# PlayerRack

## Purpose

Displays a single player's complete game area including their concealed hand, exposed melds, discard pile, player info (name, wind, score), and turn indicator. Handles both current player (interactive) and opponent (view-only) modes.

## User Stories

- All stories - players must see each other's areas
- US-009: Current player draws/discards
- US-013: Exposed melds displayed
- US-019: Score display after winning
- US-030: Player wind/seat indicator

## Props

```typescript
interface PlayerRackProps {
  // Player data
  player: PublicPlayerInfo;
  isCurrentPlayer: boolean;
  isActivePlayer: boolean; // Whose turn it is

  // Tile data
  concealedTiles?: Tile[]; // Only for current player
  tileCount?: number; // For opponents (just show count)
  exposedMelds: Meld[];
  discards: Tile[];

  // Game state
  score?: number;
  isDealer: boolean;

  // Interaction (only for current player)
  selectedIndices?: number[];
  onTileSelect?: (index: number) => void;
  mode?: 'charleston' | 'discard' | 'view-only';

  // Display
  orientation: 'bottom' | 'left' | 'top' | 'right'; // Position on board
  compact?: boolean; // Smaller layout for opponents
}
```

## Behavior

### Current Player (Bottom Position)

- Shows full hand with `<ConcealedHand>` (13-14 tiles)
- Interactive tile selection (Charleston or discard)
- Exposed melds displayed separately
- Discard pile below hand
- Player info bar (name, wind, score)

### Opponent Players (Top/Left/Right Positions)

- Show tile count only (no actual tiles visible)
- Display as face-down tile backs
- Exposed melds displayed (public info)
- Discard pile visible
- Compact layout to save space

### Turn Indicator

- Highlight active player's rack with border/glow
- Show "Your Turn" badge for current player
- Dim non-active players slightly

### Dealer Indicator

- Show "Dealer" or "East" badge
- Visual distinction (gold border or icon)

## Visual Requirements (from UI-LAYOUT-SPEC)

### South Player (User's Hand)

**Position & Size**:

- **Location**: Bottom 2% of table, horizontally centered
- **Height**: 18% of table height
- **Max width**: 95% of table width
- **Layout**: Vertical flex (two sections stacked)

**Section A: Exposure Area** (top 30%):

- **Purpose**: Display exposed/melded sets (Pungs, Kongs, etc.)
- **Background**: `rgba(0,0,0,0.15)`
- **Border radius**: 6px (top only)
- **Padding**: 0 12px
- **Layout**: Horizontal flex, 8px gap between melds
- **Meld sets**: Grouped in transparent containers with 4px padding

**Section B: Hand Area** (bottom 70%):

- **Purpose**: Concealed tiles in player's hand
- **Background**: Dark gradient (`#2a2a2a` to `#3a3a3a`, 180deg)
- **Border radius**: 8px (bottom only)
- **Shadow**: Inset `0 3px 6px rgba(0,0,0,0.4)` (recessed effect)
- **Padding**: 8px 12px
- **Layout**: Horizontal flex, 6px gap, centered, aligned to bottom
- **Overflow**: Horizontal scroll if needed

**Tile Appearance**:

- **Size**: 63px wide × 90px tall (7:10 aspect ratio)
- **Assets**: Transparent versions from `apps/client/src/assets/tiles/*.svg` (e.g., `1B_clear.svg`)
- **Background**: Applied via CSS - white gradient (`#ffffff` to `#f0f0f0`)
- **Border**: 2px solid #999 (via CSS)
- **Border radius**: 4px
- **Hover**: Lift 8px + shadow (CSS transform: translateY(-8px))
- **Selected**: Lift 12px + gold border + gold shadow
- **Newly drawn**: Pulsing gold glow animation (2s keyframe)

### North Opponent (Opposite Player)

- **Location**: Top 2%, horizontally centered
- **Layout**: Vertical flex (hand above, exposure below)
- **Hand section**: 110px tall, horizontal row of tiles, rotated 180°
- **Exposure section**: 50px tall, horizontal row
- **Background**: Same as player (dark gradient for hand, transparent for exposure)

### East Opponent (Right Side)

- **Location**: Right 1%, vertically centered
- **Height**: 85% of table height
- **Layout**: Horizontal flex-reverse (hand on right, exposure on left)
- **Hand section**: 10.5vh wide, vertical column of tiles
- **Exposure section**: 6vh wide, vertical column
- **Tile size**: 8vh wide × 11.4vh tall (7:10 ratio - tiles rotated 90° for vertical display)

### West Opponent (Left Side)

- **Location**: Left 1%, vertically centered
- **Height**: 85% of table height
- **Layout**: Horizontal flex (hand on left, exposure on right)
- **Hand section**: 10.5vh wide, vertical column of tiles
- **Exposure section**: 6vh wide, vertical column
- **Tile size**: 8vh wide × 11.4vh tall (7:10 ratio - tiles rotated 90° for vertical display)

### Opponent Tile Backs

- **Appearance**: Same style as player tiles but with blank face
- **Border**: 2px solid #999
- **Background**: White gradient (concealed)

### Turn Indicator Animation

- Active player: Pulsing blue border (1s cycle)
- Non-active: No animation
- Transition: Smooth fade when turn changes

### Dealer Badge

- Position: Top-right of player info bar
- Style: Gold/yellow background, "DEALER" text
- Icon: East wind symbol (東)

## Related Components

- **Uses**: `<ConcealedHand>` (current player's hand)
- **Uses**: `<ExposedMelds>` (public melds display)
- **Uses**: `<DiscardPile>` (discarded tiles grid)
- **Uses**: `<PlayerAvatar>` (player icon/photo)
- **Uses**: `<WindIndicator>` (wind direction badge)
- **Used by**: `<GameBoard>` (4 player racks in cross layout)

## Implementation Notes

### Orientation Transforms

Use CSS transforms to rotate opponent racks:

```css
.rack-top {
  transform: rotate(180deg);
}
.rack-left {
  transform: rotate(90deg);
}
.rack-right {
  transform: rotate(-90deg);
}
```

Rotate tiles back to upright within transformed containers.

### Concealed Tiles Display

```typescript
function renderConcealedTiles(props: PlayerRackProps) {
  if (props.isCurrentPlayer && props.concealedTiles) {
    // Show actual tiles with selection
    return <ConcealedHand tiles={props.concealedTiles} {...} />;
  } else {
    // Show face-down backs (tile count)
    return <TileBacksRow count={props.tileCount || 13} />;
  }
}
```

### Exposed Melds Layout

- Horizontal row of melds
- Each meld is 3-4 tiles grouped together
- Slight spacing between melds
- Show meld type label (optional, for clarity)

### Discard Pile Layout

- Grid layout (7 columns × N rows)
- Tiles in discard order (left-to-right, top-to-bottom)
- Latest discard highlighted (glow or border)
- Compact tile size (smaller than hand)

### Performance

- Virtualize discard pile if > 50 tiles (late game)
- Memoize entire component if props unchanged
- Use CSS transforms instead of re-rendering for turn indicator

### Accessibility

- ARIA label: "Player rack for {name}, {wind} wind"
- ARIA live region for turn changes: "{name}'s turn"
- Keyboard focus stays within current player's rack during interaction

## Testing Considerations

- Verify all 4 orientations render correctly
- Test current player vs opponent display modes
- Validate turn indicator animation timing
- Test dealer badge display
- Verify exposed melds display (Pung, Kong, Quint)
- Edge case: Player with 0 discards (empty pile)
- Edge case: Player with 0 exposed melds

## Example Usage

```tsx
// Current player (bottom, interactive)
<PlayerRack
  player={myPublicInfo}
  isCurrentPlayer={true}
  isActivePlayer={true}
  concealedTiles={myHand}
  exposedMelds={[]}
  discards={myDiscards}
  score={0}
  isDealer={true}
  selectedIndices={selectedIndices}
  onTileSelect={handleTileSelect}
  mode="discard"
  orientation="bottom"
/>

// Opponent (top, view-only)
<PlayerRack
  player={bobPublicInfo}
  isCurrentPlayer={false}
  isActivePlayer={false}
  tileCount={13}
  exposedMelds={bobMelds}
  discards={bobDiscards}
  score={0}
  isDealer={false}
  orientation="top"
  compact={true}
/>
```

## Edge Cases

1. **14 vs 13 tiles**: Active player has 14 (after draw), others have 13
2. **Empty discards**: First turn, no discards yet (show empty state)
3. **Many exposed melds**: Player with 3+ melds (layout adjustment)
4. **Long player names**: Truncate with ellipsis (...) if too long
5. **Reconnection**: Show "Reconnecting..." badge if player disconnected

---

**Estimated Complexity**: Medium (~100-120 lines implementation)
**Dependencies**: `<ConcealedHand>`, `<ExposedMelds>`, `<DiscardPile>`, `<PlayerAvatar>`, `<WindIndicator>`
**Phase**: Phase 1 - MVP Core

```text

```
