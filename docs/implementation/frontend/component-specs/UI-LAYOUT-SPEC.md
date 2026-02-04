# American Mahjong UI Layout Specification

This document describes the UI layout from the mockup, designed to be reproducible without visual reference.

## Overall Layout Structure

### Game Container

- **Viewport**: Full screen (100vw × 100vh)
- **Aspect Ratio**: Game table maintains 16:9 ratio
- **Centering**: Flexbox center (both horizontal and vertical)

### Game Table (Main Play Area)

- **Size**: `min(100vw, calc(100vh * 16/9))` wide × `min(100vh, calc(100vw * 9/16))` tall
- **Background**: Green felt gradient from `#1e5c3c` to `#2a7d52` (135deg diagonal)
- **Border**: 8px solid brown (`#4a3c28`)
- **Shadow**: `0 10px 40px rgba(0,0,0,0.5)`
- **Texture**: Subtle crosshatch pattern overlay (2px × 2px grid, rgba(0,0,0,0.03))

## Tile Assets

**Source Files**: `apps/client/src/assets/tiles/*.svg` (transparent background versions)

**Dimensions**: 139.764 × 200 viewBox (7:10 aspect ratio)

**Asset Types Available**:

- Transparent background (`*_clear.svg`) - **RECOMMENDED** for game UI
- White background (`public/assets/tiles/*.svg`) - Alternative for static displays

**Usage**: Transparent SVGs allow CSS styling for backgrounds, borders, hover effects, and selection states. Apply white gradient backgrounds via CSS wrapper divs for the default tile appearance.

**Scaling Reference**:

- Full-size player tiles: 63px × 90px
- Discarded tiles (center): 32px × 46px
- Opponent tiles (E/W): 8vh × 11.4vh (maintains 7:10 ratio)

## Core Game Elements

### 1. Walls (4 sides)

Each wall displays remaining tile stacks as white rectangles.

**Wall Positions**:

- **North Wall**: top 15%, horizontally centered, horizontal layout
- **South Wall**: bottom 22%, horizontally centered, horizontal layout
- **East Wall**: right 12%, vertically centered, vertical layout
- **West Wall**: left 12%, vertically centered, vertical layout

**Wall Stack Appearance**:

- **Horizontal walls** (N/S): 30px wide × 44px tall per stack
- **Vertical walls** (E/W): 44px wide × 30px tall per stack
- **Style**: White gradient (`#ffffff` to `#f0f0f0`), 1px gray border, 2px border-radius
- **Visual detail**: Horizontal line at 50% height (simulates two-tile stack)
- **Spacing**: 2px gap between stacks
- **Count**: 19 stacks per wall initially (20 if playing with blanks)

### 2. Discard Floor (Center Area)

The central discard area where players place discarded tiles.

**Position & Size**:

- **Location**: Absolute center (50% × 50%, transform: translate(-50%, -50%))
- **Dimensions**: 40% of table width × 40% of table height
- **Background**: `rgba(0,0,0,0.15)` (semi-transparent dark overlay)
- **Border radius**: 8px
- **Padding**: 15px

**Tile Layout**:

- **Display**: Flex wrap (wraps to multiple rows)
- **Gap**: 6px between tiles
- **Alignment**: Starts at top-left (align-content: flex-start)
- **Overflow**: Scrollable if too many tiles

**Discarded Tile Appearance**:

- **Size**: 32px wide × 46px tall (7:10 aspect ratio to match SVG)
- **Tile Assets**: Same transparent SVG files, scaled down
- **Style**: Light gradient background via CSS (`#f5f5f5` to `#e0e0e0`), subtle border
- **Rotation**: Random slight rotation (-5° to +5°) via CSS variable `--rotation`
- **Recent tile**: Gold border (2px) + gold glow shadow
- **Hover effect**: Lift 2px + shadow

### 3. Player Rack (South - User's Hand)

The user's tile rack at the bottom of the screen.

**Position & Size**:

- **Location**: Bottom 2%, horizontally centered
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

**Player Tile Appearance**:

- **Size**: 63px wide × 90px tall (7:10 aspect ratio, based on actual SVG dimensions)
- **Tile Assets**: Use transparent versions from `apps/client/src/assets/tiles/*.svg` (e.g., `1B_clear.svg`)
- **Background**: Applied via CSS - white gradient (`#ffffff` to `#f0f0f0`) or custom styling
- **Border**: Can be styled via CSS (SVG has clean edges)
- **Border radius**: 4px applied via CSS
- **Hover**: Lift 8px + shadow (CSS transform: translateY(-8px))
- **Selected**: Lift 12px + gold border + gold shadow
- **Newly drawn**: Pulsing gold glow animation (2s keyframe)

### 4. Opponent Racks (North, East, West)

Three opponent positions with concealed tiles (tile backs).

**North Opponent** (opposite player):

- **Location**: Top 2%, horizontally centered
- **Layout**: Vertical flex (hand above, exposure below)
- **Hand section**: 110px tall, horizontal row of tiles, rotated 180°
- **Exposure section**: 50px tall, horizontal row
- **Background**: Same as player (dark gradient for hand, transparent for exposure)

**East Opponent** (right side):

- **Location**: Right 1%, vertically centered
- **Height**: 85% of table height
- **Layout**: Horizontal flex-reverse (hand on right, exposure on left)
- **Hand section**: 10.5vh wide, vertical column of tiles
- **Exposure section**: 6vh wide, vertical column
- **Tile size**: 8vh wide × 11.4vh tall (7:10 ratio - tiles rotated 90° for vertical display)

**West Opponent** (left side):

- **Location**: Left 1%, vertically centered
- **Height**: 85% of table height
- **Layout**: Horizontal flex (hand on left, exposure on right)
- **Hand section**: 10.5vh wide, vertical column of tiles
- **Exposure section**: 6vh wide, vertical column
- **Tile size**: 8vh wide × 11.4vh tall (7:10 ratio - tiles rotated 90° for vertical display)

**Opponent Tile Backs**:

- **Appearance**: Same style as player tiles but with blank face
- **Border**: 2px solid `#999`
- **Background**: White gradient (concealed)

## UI/HUD Elements

### Action Bar (Right Side)

Primary action buttons for game interactions.

**Position & Size**:

- **Location**: Right 16%, vertically centered (50%)
- **Background**: `rgba(0,0,0,0.85)` (dark semi-transparent)
- **Padding**: 12px 16px
- **Border radius**: 8px
- **Shadow**: `0 4px 12px rgba(0,0,0,0.5)`
- **Layout**: Vertical flex, 10px gap

**Button Appearance**:

- **Size**: 10px top/bottom padding, 20px left/right, 140px min-width
- **Font**: 14px bold, uppercase
- **Border radius**: 6px
- **Hover**: Lift 2px + colored shadow

**Button Types**:

- **Primary** (green): `#4CAF50` to `#45a049` gradient - for "Mahjong!", "Pass Tiles"
- **Danger** (red): `#f44336` to `#da190b` gradient - for "Discard"
- **Warning** (orange): `#ff9800` to `#f57c00` gradient - for "Stop Charleston"
- **Secondary** (gray): `#607D8B` to `#546E7A` gradient - for "Pass"
- **Disabled**: 40% opacity, cursor not-allowed

### HUD Elements (Overlays)

**Game Menu** (top-left corner):

- **Position**: Top 15px, left 15px
- **Text**: "☰ Menu"
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 8px 12px
- **Font**: 14px
- **Hover**: Darker background

**Wall Counter** (below menu):

- **Position**: Top 60px, left 15px
- **Text**: "Tiles Remaining: [count]"
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 10px 20px
- **Font**: 14px bold
- **Color states**:
  - Safe (>40 tiles): `#4CAF50` (green)
  - Warning (20-40 tiles): `#ff9800` (orange)
  - Critical (<20 tiles): `#f44336` (red)

**Wind Indicator** (top-right corner):

- **Position**: Top 15px, right 15px
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 8px 12px
- **Layout**: Horizontal flex of wind positions, 6px gap

**Wind Position Badges**:

- **Size**: 4px padding, 4px border-radius
- **Background**: `rgba(255,255,255,0.1)` (default)
- **Dealer**: Red background (`#c41e3a`) + white text
- **Active turn**: Gold border (2px) + gold glow
- **Content**: Wind letter (12px bold) + player name (9px, max 60px wide)

**Charleston Tracker** (top-center):

- **Position**: Top 105px, horizontally centered
- **Display**: Hidden by default, shown during Charleston phase
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 12px 24px
- **Content**:
  - Step label (13px, e.g., "First Charleston - Right Pass")
  - Direction arrow (24px, e.g., "→")

**Hint Button** (left side, mid-low):

- **Position**: Left 1%, bottom 28%
- **Text**: "💡 Hints"
- **Background**: `rgba(255,153,0,0.9)` (orange)
- **Size**: 10px 16px padding, 120px min-width
- **Font**: 13px bold white, centered
- **Hover**: Full opacity + lift 2px

**Card Viewer Button** (left side, lower):

- **Position**: Left 1%, bottom 20%
- **Text**: "📋 View Card"
- **Background**: `rgba(96,125,139,0.9)` (blue-gray)
- **Size**: 10px 16px padding, 120px min-width
- **Font**: 13px bold white, centered
- **Hover**: Full opacity + lift 2px

**Event Log** (bottom-left corner):

- **Position**: Bottom 2%, left 1%
- **Size**: 160px wide, max 120px tall
- **Background**: `rgba(0,0,0,0.85)`
- **Padding**: 10px
- **Font**: 11px
- **Overflow**: Vertical scroll
- **Entry style**: 4px bottom margin, 80% opacity (100% + bold for latest)

## Tile Rendering Details

### Using Transparent Tile SVGs

**Recommended Structure**:

```html
<div class="tile-wrapper">
  <img src="assets/tiles/1B_clear.svg" alt="1 Bamboo" class="tile-image" />
</div>
```

**CSS Styling Pattern**:

```css
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

.tile-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

### Tile Colors by Suit

The SVG artwork already has suit-appropriate colors baked in:

- **Bamboo (Bam)**: Dark green (`#0a6e0a`) and red details
- **Character (Crak)**: Red (`#c41e3a`) primary color
- **Dot**: Blue (`#0066cc`) circles
- **Wind**: Dark gray/black (`#333`)
- **Dragon**: Dark red (`#8b0000`)
- **Joker**: May need custom CSS overlay for rainbow effect (`#ff6b6b`, `#ffd93d`, `#6bcf7f`, `#4d96ff`)

## Responsive Behavior

- **Aspect Ratio Lock**: Game table maintains 16:9 ratio at all viewport sizes
- **Tile Scaling**: Player tiles are fixed pixels; opponent tiles use viewport units (vh)
- **Scroll Handling**:
  - Player hand: horizontal scroll if tiles exceed width
  - Discard floor: vertical scroll if tiles exceed height
  - Event log: vertical scroll if entries exceed 120px

## Animations & Transitions

- **Tile hover**: 0.2s ease transition
- **Button hover**: 0.2s ease transition
- **Newly drawn tile**: 2s pulse animation (gold glow 0% → 100% → 0%)
- **Selected tile**: Instant lift with shadow

## Z-Index Layers (Bottom to Top)

1. Game table background
2. Walls (stacks)
3. Discard floor
4. Player/opponent racks
5. Tiles (in hand)
6. HUD elements (pointer-events: none on container, auto on children)
7. Action bar
8. Control panel (mockup only, z-index: 1000)

## Typical Element Counts

- **Wall stacks**: 76 total (19 per side) at game start
- **Player hand**: 13-14 tiles (14 after drawing)
- **Opponent hands**: 13 tile backs each
- **Discard floor**: 0-144 tiles over course of game
- **Action buttons**: 1-4 buttons depending on game phase

---

## Implementation Notes

1. **Coordinate System**: Absolute positioning relative to game-table container
2. **Centering Strategy**: CSS transforms (translate -50%) for all centered elements
3. **Flexbox Usage**: Extensive use of flex for tile layouts (wrapping, gaps, alignment)
4. **Gradient Syntax**: All gradients use 135deg or 180deg angles for consistency
5. **Shadow Layering**: Multiple shadow levels (inset for recessed, outset for raised)
6. **Interactive States**: Hover/active/disabled states for all clickable elements
7. **Accessibility**: All buttons have clear labels and disabled states
