# Wall

## Purpose

Displays the four Mahjong walls (North, South, East, West) with remaining tile stacks, break indicator, and draw position. Each wall shows stacks of tiles as white rectangles with visual styling to indicate two-tile stacks.

## User Stories

- US-001: Wall setup and break
- US-009: Turn flow visibility - tiles remaining

## Props

```typescript
interface WallProps {
  /** Position of this wall */
  position: 'north' | 'south' | 'east' | 'west';

  /** Number of stacks remaining in this wall */
  stackCount: number; // 0-19 per wall (or 0-20 with blanks)

  /** Break index position (where wall was broken) */
  breakIndex?: number;

  /** Current draw position */
  drawIndex?: number;

  /** Total initial stacks per wall */
  initialStacks: number; // typically 19 (or 20 with blanks)
}
```

## Behavior

### Wall Display

- Renders stacks as white gradient rectangles
- Shows visual break marker at `breakIndex`
- Highlights current draw position with marker
- Updates as stacks are drawn

### Stack Orientation

- **Horizontal walls (N/S)**: Stacks arranged horizontally with vertical orientation
- **Vertical walls (E/W)**: Stacks arranged vertically with horizontal orientation

## Visual Requirements (from UI-LAYOUT-SPEC)

### Wall Positions

- **North Wall**: top 15% of table, horizontally centered, horizontal layout
- **South Wall**: bottom 22% of table, horizontally centered, horizontal layout
- **East Wall**: right 12% of table, vertically centered, vertical layout
- **West Wall**: left 12% of table, vertically centered, vertical layout

### Wall Stack Appearance

**Horizontal walls (North/South)**:

- **Size**: 30px wide × 44px tall per stack
- **Orientation**: Vertical stacks in horizontal row

**Vertical walls (East/West)**:

- **Size**: 44px wide × 30px tall per stack
- **Orientation**: Horizontal stacks in vertical column

**Style** (all stacks):

- **Background**: White gradient (`#ffffff` to `#f0f0f0`)
- **Border**: 1px solid gray
- **Border radius**: 2px
- **Visual detail**: Horizontal line at 50% height (simulates two-tile stack)
- **Spacing**: 2px gap between stacks

### Stack Count

- **Initial**: 19 stacks per wall (76 total)
- **With blanks**: 20 stacks per wall (80 total)
- **Typical play**: Decreases from 19 → 0 over game

### Break Marker

- Visual gap or highlighted marker at break position
- Shows where dealer broke the wall after dice roll

### Draw Marker

- Small triangle or badge indicating current draw position
- Moves as tiles are drawn

## Related Components

- **Used by**: `<GameBoard>` (4 instances, one per wall)
- **Uses**: shadcn/ui `<Badge>` for draw marker
- **Coordinates with**: `<WallCounter>` (shows total remaining)

## Implementation Notes

### Position Styling

```typescript
const wallPositionStyles = {
  north: {
    position: 'absolute',
    top: '15%',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row',
    gap: '2px',
  },
  south: {
    position: 'absolute',
    bottom: '22%',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row',
    gap: '2px',
  },
  east: {
    position: 'absolute',
    right: '12%',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  west: {
    position: 'absolute',
    left: '12%',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
};
```

### Stack Rendering

```typescript
function WallStack({ orientation }: { orientation: 'horizontal' | 'vertical' }) {
  const size = orientation === 'horizontal'
    ? { width: '30px', height: '44px' }
    : { width: '44px', height: '30px' };

  return (
    <div
      style={{
        ...size,
        background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
        border: '1px solid #ccc',
        borderRadius: '2px',
        position: 'relative',
      }}
    >
      {/* Horizontal line to simulate two-tile stack */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '1px',
          background: 'rgba(0,0,0,0.1)',
        }}
      />
    </div>
  );
}
```

### Break and Draw Markers

```typescript
// Break marker: visual gap or highlighted stack
{breakIndex !== undefined && index === breakIndex && (
  <div className="break-marker" style={{
    width: '4px',
    height: '44px',
    background: '#ffd700'
  }} />
)}

// Draw marker: small triangle below/beside stack
{drawIndex !== undefined && index === drawIndex && (
  <Badge className="draw-marker">▼</Badge>
)}
```

### Responsive Behavior

- Walls scale with table size (maintain 16:9 aspect ratio)
- Stack count decreases as game progresses
- Empty spaces appear where stacks have been drawn

## Accessibility

**ARIA**:

- Container: `role="region"` `aria-label="{position} wall, {stackCount} stacks remaining"`
- Each stack: Decorative, no interactive elements

**Visual**:

- High contrast between stacks and background
- Clear visual distinction for break and draw markers

## Example Usage

```tsx
// North wall
<Wall
  position="north"
  stackCount={15}
  initialStacks={19}
  breakIndex={5}
  drawIndex={7}
/>

// East wall (vertical)
<Wall
  position="east"
  stackCount={18}
  initialStacks={19}
/>
```

## Edge Cases

1. **Empty wall**: `stackCount === 0`, show placeholder or nothing
2. **Wall with blanks**: `initialStacks === 20` instead of 19
3. **Break at edge**: Break marker at position 0 or 18/19
4. **Draw position out of bounds**: Handle gracefully

## Testing Considerations

- Verify correct positioning for all 4 walls
- Test horizontal vs vertical stack orientation
- Validate stack count decrements correctly
- Test break and draw marker placement
- Verify visual appearance (gradient, border, midline)

---

**Estimated Complexity**: Medium (~80-100 lines implementation)
**Dependencies**: shadcn/ui `<Badge>`, CSS positioning
**Phase**: Phase 1 - MVP Core (Important for game state visibility)
