# Phase 6: Discard Pile - Implementation Guide

## Implementation Status

**✅ COMPLETED** - Implemented on 2026-01-24

**Files Created:**

- `apps/client/src/components/DiscardPile.tsx` - Main component
- `apps/client/src/components/DiscardPile.css` - Styling

**Files Updated:**

- `apps/client/src/App.tsx` - Integration

**Implementation Details:**

- Used vertical list layout (simpler for backend testing)
- Color-coded seat labels (East: red, South: green, West: yellow, North: cyan)
- Highlights most recent discard per seat with yellow background
- Shows last 6 discards per player as tile codes
- Displays during Playing phase only
- TypeScript compiles without errors
- Build successful

---

## Overview

Build **DiscardPile** component: display each player's recent discards to track gameplay and enable call decisions.

**Features**: 4 discard piles (one per seat), last 6 discards per player, most recent highlight, tile codes

---

## Quick Reference

### Type Definitions

```typescript
// From generated bindings
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

// DiscardInfo structure
interface DiscardInfo {
  tile: Tile; // Tile index (0-36)
  discarded_by: Seat; // "East" | "South" | "West" | "North"
}
```

### Store Access

```typescript
// gameStore
const discardPile = useGameStore((state) => state.discardPile);
const yourSeat = useGameStore((state) => state.yourSeat);

// discardPile: DiscardInfo[]
// - Chronological order (oldest first, newest last)
// - All discards from all players in one array
// - Need to filter by seat and take last 6 per player
```

### Utility Functions

```typescript
import { tileToCode } from '@/utils/tileFormatter';

// tileToCode(2)  → "3B"
// tileToCode(27) → "E"
// tileToCode(32) → "RD"
// tileToCode(35) → "J"
```

---

## Component Specification

### File Location

`apps/client/src/components/DiscardPile.tsx`

### Component Interface

```typescript
interface DiscardPileProps {
  // No props needed - reads from stores directly
}

export function DiscardPile(): JSX.Element;
```

### Visual Layout (2x2 Grid)

```text
┌──────────────────────────────────────────────────────┐
│ DISCARD PILES                                        │
│                                                      │
│ ┌────────────────────┐  ┌────────────────────┐     │
│ │ East               │  │ South              │     │
│ │ 3B 5D E RD 2C 1B   │  │ 7C 9D N GD 4B WD   │     │
│ │           ▲latest  │  │              ▲     │     │
│ └────────────────────┘  └────────────────────┘     │
│                                                      │
│ ┌────────────────────┐  ┌────────────────────┐     │
│ │ West               │  │ North              │     │
│ │ 2B 8C F J 3D 6B    │  │ 1C 5B RD E 9C 4D   │     │
│ │              ▲     │  │                 ▲  │     │
│ └────────────────────┘  └────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

### **Alternative: Vertical List Layout**

```text
┌──────────────────────────────────────────────────────┐
│ DISCARD PILES                                        │
│                                                      │
│ East:  3B 5D E RD 2C [1B] ← latest                   │
│ South: 7C 9D N GD 4B [WD]                            │
│ West:  2B 8C F J 3D [6B]                             │
│ North: 1C 5B RD E 9C [4D]                            │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Helper Function: Group Discards by Seat

**Requirements:**

- Filter `discardPile` array by `discarded_by` seat
- Take last 6 discards per seat
- Return map of Seat → Tile[]

**Implementation:**

```typescript
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

/**
 * Group discards by seat, keeping last N per player.
 */
function groupDiscardsBySeat(
  discardPile: DiscardInfo[],
  maxPerSeat: number = 6
): Record<Seat, Tile[]> {
  const seats: Seat[] = ['East', 'South', 'West', 'North'];
  const grouped = {} as Record<Seat, Tile[]>;

  seats.forEach((seat) => {
    const seatDiscards = discardPile
      .filter((info) => info.discarded_by === seat)
      .map((info) => info.tile);

    // Take last N discards (most recent)
    grouped[seat] = seatDiscards.slice(-maxPerSeat);
  });

  return grouped;
}
```

---

### Discard Pile Display (2x2 Grid Layout)

**Requirements:**

- Show 4 boxes (one per seat)
- Display last 6 discards as short codes (e.g., "3B", "RD")
- Highlight most recent discard with border/background
- Color-code by seat or use simple borders

**Component Structure:**

```typescript
import { useGameStore } from '@/store/gameStore';
import { tileToCode } from '@/utils/tileFormatter';
import type { Seat, Tile } from '@/types/bindings/generated';
import './DiscardPile.css';

export function DiscardPile() {
  const discardPile = useGameStore((state) => state.discardPile);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const grouped = groupDiscardsBySeat(discardPile, 6);

  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="discard-pile">
      <h2>Discard Piles</h2>
      <div className="discard-grid">
        {seats.map((seat) => (
          <SeatDiscardBox
            key={seat}
            seat={seat}
            discards={grouped[seat]}
            isYou={seat === yourSeat}
          />
        ))}
      </div>
    </div>
  );
}

function SeatDiscardBox({
  seat,
  discards,
  isYou,
}: {
  seat: Seat;
  discards: Tile[];
  isYou: boolean;
}) {
  return (
    <div className={`seat-discard-box seat-${seat.toLowerCase()} ${isYou ? 'you' : ''}`}>
      <h3 className="seat-name">
        {seat} {isYou && '(You)'}
      </h3>
      <div className="discard-tiles">
        {discards.length === 0 ? (
          <span className="no-discards">—</span>
        ) : (
          discards.map((tile, index) => {
            const isLatest = index === discards.length - 1;
            return (
              <span
                key={`${seat}-${index}-${tile}`}
                className={`discard-tile ${isLatest ? 'latest' : ''}`}
                title={isLatest ? 'Most recent discard' : ''}
              >
                {tileToCode(tile)}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

// Helper function (same as above)
function groupDiscardsBySeat(
  discardPile: DiscardInfo[],
  maxPerSeat: number = 6
): Record<Seat, Tile[]> {
  const seats: Seat[] = ['East', 'South', 'West', 'North'];
  const grouped = {} as Record<Seat, Tile[]>;

  seats.forEach((seat) => {
    const seatDiscards = discardPile
      .filter((info) => info.discarded_by === seat)
      .map((info) => info.tile);
    grouped[seat] = seatDiscards.slice(-maxPerSeat);
  });

  return grouped;
}
```

---

### Alternative: Vertical List Layout

**Simpler layout option**:

```typescript
export function DiscardPile() {
  const discardPile = useGameStore((state) => state.discardPile);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const grouped = groupDiscardsBySeat(discardPile, 6);
  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="discard-pile">
      <h2>Discard Piles</h2>
      <div className="discard-list">
        {seats.map((seat) => (
          <div key={seat} className="seat-discard-row">
            <span className={`seat-label seat-${seat.toLowerCase()}`}>
              {seat}:
              {seat === yourSeat && ' (You)'}
            </span>
            <div className="discard-tiles">
              {grouped[seat].length === 0 ? (
                <span className="no-discards">—</span>
              ) : (
                grouped[seat].map((tile, index) => {
                  const isLatest = index === grouped[seat].length - 1;
                  return (
                    <span
                      key={`${seat}-${index}-${tile}`}
                      className={`discard-tile ${isLatest ? 'latest' : ''}`}
                    >
                      {tileToCode(tile)}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Styling Guidelines

### 2x2 Grid Layout CSS

**File**: `apps/client/src/components/DiscardPile.css`

```css
.discard-pile {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
}

.discard-pile h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
}

.discard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.seat-discard-box {
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  background-color: white;
}

.seat-discard-box.you {
  border-color: #007bff;
  background-color: #e7f3ff;
}

/* Optional: Color-code seats */
.seat-discard-box.seat-east {
  border-left: 4px solid #dc3545; /* Red */
}

.seat-discard-box.seat-south {
  border-left: 4px solid #28a745; /* Green */
}

.seat-discard-box.seat-west {
  border-left: 4px solid #ffc107; /* Yellow */
}

.seat-discard-box.seat-north {
  border-left: 4px solid #17a2b8; /* Cyan */
}

.seat-name {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.discard-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 1.5rem;
}

.discard-tile {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
}

.discard-tile.latest {
  background-color: #fff3cd;
  border: 2px solid #ffc107;
  font-weight: 700;
}

.no-discards {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}
```

---

### Vertical List Layout CSS

**Alternative styling for vertical layout:**

```css
.discard-pile {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
  background-color: #f9f9f9;
}

.discard-pile h2 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: #333;
}

.discard-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.seat-discard-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem;
  border-radius: 4px;
  background-color: white;
  border: 1px solid #ddd;
}

.seat-label {
  flex-shrink: 0;
  min-width: 80px;
  font-weight: 600;
  font-size: 0.95rem;
  color: #333;
}

/* Optional: Color-code seat labels */
.seat-label.seat-east {
  color: #dc3545;
}
.seat-label.seat-south {
  color: #28a745;
}
.seat-label.seat-west {
  color: #ffc107;
}
.seat-label.seat-north {
  color: #17a2b8;
}

.discard-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  flex: 1;
}

.discard-tile {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
}

.discard-tile.latest {
  background-color: #fff3cd;
  border: 2px solid #ffc107;
  font-weight: 700;
}

.no-discards {
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}
```

---

## Integration with App.tsx

```typescript
import { DiscardPile } from '@/components/DiscardPile';

function App() {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const phase = useGameStore((state) => state.phase);

  // Show DiscardPile during Playing phase
  const showDiscardPile =
    yourSeat &&
    typeof phase === 'object' &&
    'Playing' in phase;

  return (
    <div className="app-container">
      <ConnectionPanel />
      {yourSeat && <GameStatus />}
      {yourHand.length > 0 && <HandDisplay />}
      {yourSeat && <TurnActions />}
      {showDiscardPile && <DiscardPile />}
      <EventLog />
    </div>
  );
}
```

---

## Testing Checklist

### Display

- [ ] Component renders without errors
- [ ] Shows 4 seat boxes (East, South, West, North) in 2x2 grid OR vertical list
- [ ] Each seat label displays correctly
- [ ] Your seat is highlighted with "(You)" label
- [ ] Empty discards show "—" placeholder

### Discard Logic

- [ ] Shows last 6 discards per seat (chronological order)
- [ ] Tiles displayed as short codes (3B, RD, E, J, etc.)
- [ ] Most recent discard per seat has highlighted border/background
- [ ] Older discards beyond 6 are not shown
- [ ] Discards update in real-time when new tile discarded

### Styling

- [ ] 2x2 grid layout is balanced (or vertical list is clean)
- [ ] Seat color-coding visible (optional left border or label color)
- [ ] Latest discard visually distinct (yellow background + bold border)
- [ ] No layout breaks with 0-6 discards per seat
- [ ] Responsive: handles narrow/wide screens

### Edge Cases

- [ ] All seats empty (game start): shows 4 empty boxes
- [ ] One seat has 6+ discards: only last 6 shown
- [ ] One seat has 0 discards, others have discards: mixed display works
- [ ] Rapid discards don't cause visual glitches
- [ ] Component hidden during non-Playing phases

---

## Success Criteria

1. ✅ DiscardPile component renders without errors
2. ✅ Shows 4 discard piles (one per seat)
3. ✅ Displays last 6 discards per player as tile codes
4. ✅ Most recent discard highlighted per seat
5. ✅ Grouped correctly by seat (East/South/West/North)
6. ✅ Updates in real-time when discards occur
7. ✅ TypeScript compiles without errors
8. ✅ No performance issues with 24+ total discards
9. ✅ Layout choice (2x2 grid or vertical list) is clean and readable
10. ✅ Your seat is visually identified

---

## Next Steps

After Phase 6 is complete, proceed to:

- **Phase 7: Polish** - Responsive layout, spacing adjustments, accessibility
- **Phase 8: Advanced Features** - Joker exchange UI, courtesy pass, scoring display

---

## Additional Notes

### Discard Pile Behavior

From the game logic:

- Discards accumulate in chronological order
- When a tile is called (Pung/Kong/Quint), it's removed from the discard pile
- The `discardPile` array in `gameStore` is the authoritative source
- No need to persist discard history beyond what's in the store

### Call Window Interaction

When a call window opens, the most recent discard is the tile being called. This component shows the context of recent discards to help players make call decisions.

### Performance Considerations

- With 4 players and 6 discards shown per player, max 24 tiles rendered
- No virtualization needed - simple map is sufficient
- Re-renders only when `discardPile` changes (Zustand subscription)

### Accessibility

Consider adding:

- `aria-label` for seat boxes
- `title` attributes on latest discard for tooltips
- High-contrast mode support (test border colors)

### Layout Choice Guidance

**2x2 Grid**: Better for wider screens, mirrors physical mahjong table layout

**Vertical List**: Simpler, more compact, better for narrow screens

Choose based on your app's overall layout constraints. Both are valid implementations.
