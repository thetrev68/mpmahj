# PlayerSeatIndicator Component Specification

## 1. Component Overview

### Purpose

Display a player's identity with seat position (East/South/West/North), status badge, dealer marker, and optional scoring information.

### Category

Presentational Component - Core Game Elements

### User Stories

- US-001: Roll dice and break wall - Shows dealer position
- US-009: Drawing a tile - Shows active player
- US-010: Discarding a tile - Shows player turn
- US-020: Invalid mahjong (dead hand) - Shows dead hand status
- US-021: Wall game (draw) - Shows all player final states

### Design Principles

- **Clear Identity**: Prominent player name and seat position
- **Status Visibility**: Color-coded badges for active/waiting/dead states
- **Cultural Accuracy**: Correct wind names (East/South/West/North)
- **Flexible Layout**: Horizontal and vertical orientations for table positions
- **Visual Hierarchy**: Dealer marker and status are secondary to identity

---

## 2. Visual Design

### Layout Modes

#### Horizontal Layout (Default)

```
┌─────────────────────────────────────────┐
│ EAST ◆                        [ACTIVE] │
│ Alice Chen                              │
│ Score: 500                              │
└─────────────────────────────────────────┘
Width: 240px, Height: 80px
```

#### Vertical Layout

```
┌──────────────┐
│   EAST ◆     │
│──────────────│
│  Alice Chen  │
│──────────────│
│  Score: 500  │
│──────────────│
│   [ACTIVE]   │
└──────────────┘
Width: 160px, Height: 140px
```

#### Compact Layout

```
┌───────────────────────┐
│ EAST ◆ Alice [ACTIVE] │
└───────────────────────┘
Width: 200px, Height: 40px
```

### Wind Indicators

```
EAST   - 東 (Dealer starts here, rotates)
SOUTH  - 南
WEST   - 西
NORTH  - 北

Visual: Bold uppercase with optional Chinese character
Color: Text color matches seat position color
```

### Dealer Marker

```
◆ - Black diamond symbol (U+25C6)
Position: Immediately after wind indicator
Size: 16px (matches wind text size)
Color: Gold/amber (#F59E0B) for emphasis
Animation: Subtle pulse when dealer's turn (scale 1.0 → 1.1 → 1.0, 1.5s cycle)
```

### Status Badges

```
ACTIVE   - Green background (#10B981), white text
WAITING  - Gray background (#6B7280), white text
DEAD     - Red background (#EF4444), white text, strikethrough on name
WINNING  - Gold background (#F59E0B), white text, "★" prefix
FORFEIT  - Dark gray background (#374151), white text, "✕" prefix
```

### Color Scheme

#### Seat Colors (for wind indicator text)

```css
East:  #DC2626 (Red-600)
South: #16A34A (Green-600)
West:  #2563EB (Blue-600)
North: #CA8A04 (Yellow-600)
```

#### Background States

```css
Default:     #F3F4F6 (Gray-100)
Hover:       #E5E7EB (Gray-200)
Active:      #FEF3C7 (Amber-100)
Dead:        #FEE2E2 (Red-100)
```

### Typography

- **Wind**: 14px, bold, uppercase, seat color
- **Player Name**: 16px, medium weight, gray-900
- **Score**: 14px, regular, gray-600
- **Status Badge**: 12px, uppercase, bold, white text

---

## 3. Props Interface

```typescript
import { Seat, PlayerStatus } from '@/types/bindings/generated';

export interface PlayerSeatIndicatorProps {
  /** Player seat position */
  seat: Seat;

  /** Player display name */
  playerName: string;

  /** Current player status */
  status: PlayerStatus;

  /** Whether this player is the dealer */
  isDealer: boolean;

  /** Optional current score (points) */
  score?: number;

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical' | 'compact';

  /** Whether this indicator represents the current user */
  isCurrentUser?: boolean;

  /** Whether to show Chinese wind characters */
  showChineseWinds?: boolean;

  /** Whether to highlight as active (pulsing dealer marker) */
  isActivePlayer?: boolean;

  /** Optional additional CSS classes */
  className?: string;

  /** Optional click handler for player info */
  onClick?: () => void;
}

/** Wind names mapping */
const WIND_NAMES: Record<Seat, string> = {
  East: 'EAST',
  South: 'SOUTH',
  West: 'WEST',
  North: 'NORTH',
};

/** Chinese wind characters */
const WIND_CHINESE: Record<Seat, string> = {
  East: '東',
  South: '南',
  West: '西',
  North: '北',
};

/** Status badge labels */
const STATUS_LABELS: Record<PlayerStatus, string> = {
  Active: 'ACTIVE',
  Waiting: 'WAITING',
  Dead: 'DEAD',
  // Add other statuses as needed
};
```

---

## 4. Component Variants

### 1. Standard Player (Horizontal)

```tsx
<PlayerSeatIndicator
  seat="East"
  playerName="Alice Chen"
  status="Waiting"
  isDealer={true}
  score={500}
  orientation="horizontal"
/>
```

**Visual**: Full layout with all information, dealer marker visible

### 2. Active Player (Vertical)

```tsx
<PlayerSeatIndicator
  seat="South"
  playerName="Bob Smith"
  status="Active"
  isDealer={false}
  score={320}
  orientation="vertical"
  isActivePlayer={true}
/>
```

**Visual**: Vertical layout, "ACTIVE" badge, yellow border glow

### 3. Dead Hand (Compact)

```tsx
<PlayerSeatIndicator
  seat="West"
  playerName="Charlie Wu"
  status="Dead"
  isDealer={false}
  orientation="compact"
/>
```

**Visual**: Compact layout, red "DEAD" badge, strikethrough on name

### 4. Current User (Highlighted)

```tsx
<PlayerSeatIndicator
  seat="North"
  playerName="You"
  status="Waiting"
  isDealer={false}
  score={0}
  isCurrentUser={true}
  orientation="horizontal"
/>
```

**Visual**: Blue border (2px solid #2563EB), subtle blue background tint

### 5. Dealer Active Turn

```tsx
<PlayerSeatIndicator
  seat="East"
  playerName="Alice Chen"
  status="Active"
  isDealer={true}
  score={500}
  isActivePlayer={true}
  showChineseWinds={true}
/>
```

**Visual**: Gold pulsing dealer marker, ACTIVE badge, Chinese "東" character

---

## 5. Behavior & Interaction

### Visual States

#### Default State

- Gray background (#F3F4F6)
- All information displayed clearly
- No animations except dealer marker pulse (if active)

#### Hover State

- Background changes to #E5E7EB (Gray-200)
- Subtle elevation with box-shadow: 0 2px 4px rgba(0,0,0,0.1)
- Cursor: pointer (if onClick provided)
- Transition: 150ms ease

#### Active Player Highlight

- Yellow border (2px solid #F59E0B)
- Background: #FEF3C7 (Amber-100)
- Box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2) (glow effect)

#### Dead Hand State

- Red background tint (#FEE2E2)
- Player name with strikethrough text decoration
- Red border (1px solid #EF4444)
- Opacity: 0.7

#### Current User State

- Blue border (2px solid #2563EB)
- Background tint: #EFF6FF (Blue-50)
- No hover effects (always highlighted)

### Animations

#### Dealer Marker Pulse (Active Turn)

```css
@keyframes dealerPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.dealer-marker.active {
  animation: dealerPulse 1.5s ease-in-out infinite;
}
```

#### Status Badge Transition

```css
.status-badge {
  transition:
    background-color 300ms ease,
    transform 200ms ease;
}

.status-badge.entering {
  transform: scale(0.8);
  opacity: 0;
}

.status-badge.entered {
  transform: scale(1);
  opacity: 1;
}
```

### Interactions

#### Click Behavior

- If `onClick` provided: Trigger callback (e.g., show player details modal)
- Visual feedback: Brief scale down to 0.98, then back to 1.0 (100ms)
- No-op if player is a bot or onClick not provided

#### Score Updates

- Animate number change: Count up/down with easing (300ms duration)
- Flash green (+) or red (-) briefly on change
- Use `react-spring` or CSS transitions for smooth updates

---

## 6. Accessibility

### ARIA Attributes

```tsx
<div
  role="region"
  aria-label={`Player ${playerName}, ${WIND_NAMES[seat]} seat${isDealer ? ', dealer' : ''}`}
  aria-live={isActivePlayer ? 'polite' : 'off'}
  aria-current={isActivePlayer ? 'true' : undefined}
  className="player-seat-indicator"
>
  {/* Content */}
</div>
```

### Keyboard Navigation

- **Tab**: Focus indicator (if clickable)
- **Enter/Space**: Trigger onClick handler
- Focus ring: 2px solid #2563EB, offset 2px

### Screen Reader Announcements

#### Player Introduction

```
"Alice Chen, East seat, dealer, score 500 points, waiting"
```

#### Status Change

```
"Alice Chen is now active" (when status changes to Active)
"Bob Smith's hand is dead" (when status changes to Dead)
```

#### Turn Start

```
"Your turn to discard" (if isCurrentUser && isActivePlayer)
```

### Color Contrast

- Wind text on gray background: 7.2:1 (AAA)
- Player name on gray background: 16.5:1 (AAA)
- Status badges: White text on colored backgrounds, minimum 4.5:1 (AA)
- Dead hand strikethrough maintains readability with increased font weight

### Visual Indicators Beyond Color

- Dealer: ◆ symbol (not just color)
- Status: Badge with text label (not just background color)
- Dead hand: Strikethrough + badge (not just red tint)
- Active player: Border + glow (not just yellow background)

---

## 7. Responsive Design

### Breakpoints

#### Desktop (≥768px)

- Horizontal orientation by default
- Full layout with all information
- Width: 240px, Height: 80px
- Hover effects enabled

#### Tablet (640px - 767px)

- Compact orientation recommended
- Reduced padding: 8px instead of 12px
- Width: 200px, Height: 40px
- Hover effects enabled

#### Mobile (<640px)

- Compact orientation forced
- Simplified: Wind + Name + Status only
- Score hidden unless expanded
- Width: 100%, Height: 36px
- Tap interactions replace hover

### Layout Adaptations

#### Four-Player Table on Desktop

```
      [North - Vertical]
           ↑
[West - Vertical] ← → [East - Vertical]
           ↓
      [South - Vertical]
```

#### Four-Player Table on Mobile

```
[North - Compact]
[West  - Compact]
[South - Compact]
[East  - Compact]
```

### Touch Interactions

#### Mobile Tap Behavior

- Single tap: Trigger onClick (if provided)
- Long press: Show player stats tooltip (300ms delay)
- No hover states (use active states on tap)

### Font Scaling

- Respect user's font size preferences
- Use `rem` units for all text sizing
- Minimum touch target: 44×44px (WCAG 2.1 Level AAA)

---

## 8. Integration Points

### Parent Components

#### GameBoard

```tsx
<GameBoard>
  {seats.map((seatInfo) => (
    <PlayerSeatIndicator
      key={seatInfo.seat}
      seat={seatInfo.seat}
      playerName={seatInfo.playerName}
      status={seatInfo.status}
      isDealer={seatInfo.isDealer}
      score={seatInfo.score}
      orientation={getOrientationForSeat(seatInfo.seat)}
      isCurrentUser={seatInfo.seat === currentUserSeat}
      isActivePlayer={seatInfo.seat === activePlayerSeat}
    />
  ))}
</GameBoard>
```

#### ScoreBoard (End of Game)

```tsx
<ScoreBoard results={gameResults}>
  {results.map((player) => (
    <PlayerSeatIndicator
      seat={player.seat}
      playerName={player.name}
      status={player.finalStatus}
      isDealer={player.wasDealer}
      score={player.finalScore}
      orientation="horizontal"
    />
  ))}
</ScoreBoard>
```

### State Management

#### Zustand Store (gameStore)

```typescript
interface GameState {
  players: {
    [seat in Seat]: {
      name: string;
      status: PlayerStatus;
      score: number;
    };
  };
  dealer: Seat;
  activePlayer: Seat | null;
  currentUserSeat: Seat;
}

// Selector
const usePlayerInfo = (seat: Seat) => {
  const player = useGameStore((state) => state.players[seat]);
  const isDealer = useGameStore((state) => state.dealer === seat);
  const isActive = useGameStore((state) => state.activePlayer === seat);
  const isCurrentUser = useGameStore((state) => state.currentUserSeat === seat);

  return { ...player, isDealer, isActive, isCurrentUser };
};
```

### Event Handlers

#### Status Updates (from GameStateSnapshot)

```typescript
// Listen for status changes
useEffect(() => {
  const handleStatusChange = (event: PublicEvent) => {
    if (event.type === 'PlayerStatusChanged') {
      updatePlayerStatus(event.seat, event.newStatus);
    }
  };

  socket.on('event', handleStatusChange);
  return () => socket.off('event', handleStatusChange);
}, []);
```

#### Score Updates (from ScoreBreakdown)

```typescript
// Animate score changes
useEffect(() => {
  if (previousScore !== undefined && previousScore !== score) {
    animateScoreChange(previousScore, score);
  }
}, [score]);
```

### User Stories Integration

#### US-001: Roll Dice and Break Wall

- Show dealer marker on East seat initially
- Update dealer marker when dealer rotates

#### US-009: Drawing a Tile

- Highlight active player with isActivePlayer={true}
- Pulse dealer marker if dealer is drawing

#### US-020: Invalid Mahjong (Dead Hand)

- Change status to "Dead"
- Apply strikethrough to player name
- Red background tint

#### US-021: Wall Game (Draw)

- Show all final scores
- Display final status for each player
- No active player highlight

---

## 9. Error Handling

### Missing Data

#### No Player Name

```tsx
playerName={playerName || 'Unknown Player'}
```

Display: "Unknown Player" in italic gray text

#### Invalid Seat

```tsx
if (!['East', 'South', 'West', 'North'].includes(seat)) {
  console.error(`Invalid seat: ${seat}`);
  return null;
}
```

#### Invalid Status

```tsx
const statusLabel = STATUS_LABELS[status] || 'UNKNOWN';
const statusClass = `status-${status.toLowerCase()}`;
```

Fallback: Gray badge with "UNKNOWN" label

### Edge Cases

#### Score is Negative

```tsx
<span className={score < 0 ? 'score-negative' : 'score-positive'}>
  Score: {score < 0 ? `-${Math.abs(score)}` : score}
</span>
```

Display: Red text for negative scores

#### Very Long Player Names

```css
.player-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Tooltip: Show full name on hover

#### Player Name is Empty String

```tsx
playerName={playerName.trim() || 'Unnamed'}
```

### Warnings

#### Dealer Not in Correct Phase

```tsx
if (isDealer && gamePhase !== 'Playing' && !isSetupPhase) {
  console.warn('Dealer marker shown outside of playing phase');
}
```

#### Multiple Active Players

```tsx
if (process.env.NODE_ENV === 'development') {
  const activePlayers = players.filter((p) => p.status === 'Active');
  if (activePlayers.length > 1) {
    console.error(`Multiple active players detected: ${activePlayers.length}`);
  }
}
```

---

## 10. Testing Requirements

### Unit Tests

#### Rendering Tests

```typescript
describe('PlayerSeatIndicator', () => {
  it('renders player name and seat', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('EAST')).toBeInTheDocument();
  });

  it('shows dealer marker when isDealer is true', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={true}
      />
    );
    expect(screen.getByText('◆')).toBeInTheDocument();
  });

  it('applies correct status badge', () => {
    const { rerender } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Active"
        isDealer={false}
      />
    );
    expect(screen.getByText('ACTIVE')).toHaveClass('status-active');

    rerender(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Dead"
        isDealer={false}
      />
    );
    expect(screen.getByText('DEAD')).toHaveClass('status-dead');
  });

  it('shows score when provided', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        score={500}
      />
    );
    expect(screen.getByText(/Score: 500/)).toBeInTheDocument();
  });

  it('hides score when not provided', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
      />
    );
    expect(screen.queryByText(/Score:/)).not.toBeInTheDocument();
  });
});
```

#### Variant Tests

```typescript
describe('PlayerSeatIndicator - Orientations', () => {
  it('renders horizontal layout', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        orientation="horizontal"
      />
    );
    expect(container.firstChild).toHaveClass('orientation-horizontal');
  });

  it('renders vertical layout', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        orientation="vertical"
      />
    );
    expect(container.firstChild).toHaveClass('orientation-vertical');
  });

  it('renders compact layout', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        orientation="compact"
      />
    );
    expect(container.firstChild).toHaveClass('orientation-compact');
  });
});
```

#### Interaction Tests

```typescript
describe('PlayerSeatIndicator - Interactions', () => {
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        onClick={handleClick}
      />
    );
    fireEvent.click(screen.getByRole('region'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when not provided', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
      />
    );
    const indicator = container.firstChild as HTMLElement;
    expect(indicator.style.cursor).not.toBe('pointer');
  });

  it('is keyboard accessible', () => {
    const handleClick = vi.fn();
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
        onClick={handleClick}
      />
    );
    const indicator = screen.getByRole('region');
    fireEvent.keyDown(indicator, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(indicator, { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Tests

#### Game State Integration

```typescript
describe('PlayerSeatIndicator - Game Integration', () => {
  it('updates status from game events', async () => {
    const { rerender } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
      />
    );
    expect(screen.getByText('WAITING')).toBeInTheDocument();

    // Simulate status change event
    rerender(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Active"
        isDealer={false}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });
  });

  it('highlights active player', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Active"
        isDealer={false}
        isActivePlayer={true}
      />
    );
    expect(container.firstChild).toHaveClass('active-player');
  });

  it('shows pulsing dealer marker when dealer is active', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Active"
        isDealer={true}
        isActivePlayer={true}
      />
    );
    const dealerMarker = container.querySelector('.dealer-marker');
    expect(dealerMarker).toHaveClass('active');
  });
});
```

### Visual Regression Tests

#### Snapshot Tests

```typescript
describe('PlayerSeatIndicator - Visual Snapshots', () => {
  it('matches snapshot for standard player', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice Chen"
        status="Waiting"
        isDealer={true}
        score={500}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for active player', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="South"
        playerName="Bob Smith"
        status="Active"
        isDealer={false}
        score={320}
        isActivePlayer={true}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for dead hand', () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="West"
        playerName="Charlie Wu"
        status="Dead"
        isDealer={false}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
```

### Accessibility Tests

```typescript
describe('PlayerSeatIndicator - Accessibility', () => {
  it('has correct ARIA attributes', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={true}
      />
    );
    const indicator = screen.getByRole('region');
    expect(indicator).toHaveAttribute('aria-label', 'Player Alice, EAST seat, dealer');
  });

  it('announces active player with aria-live', () => {
    render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Active"
        isDealer={false}
        isActivePlayer={true}
      />
    );
    const indicator = screen.getByRole('region');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-current', 'true');
  });

  it('passes axe accessibility tests', async () => {
    const { container } = render(
      <PlayerSeatIndicator
        seat="East"
        playerName="Alice"
        status="Waiting"
        isDealer={false}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## 11. Performance Considerations

### Memoization

```typescript
export const PlayerSeatIndicator = React.memo<PlayerSeatIndicatorProps>(
  ({ seat, playerName, status, isDealer, score, ...props }) => {
    // Component logic
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.seat === nextProps.seat &&
      prevProps.playerName === nextProps.playerName &&
      prevProps.status === nextProps.status &&
      prevProps.isDealer === nextProps.isDealer &&
      prevProps.score === nextProps.score &&
      prevProps.isActivePlayer === nextProps.isActivePlayer &&
      prevProps.isCurrentUser === nextProps.isCurrentUser
    );
  }
);
```

### Animation Optimization

#### CSS Animations (GPU-Accelerated)

```css
/* Use transform and opacity for smooth animations */
.dealer-marker.active {
  animation: dealerPulse 1.5s ease-in-out infinite;
  will-change: transform, opacity;
}

/* Avoid animating layout properties */
/* ❌ Bad: animating width, height, margin */
/* ✅ Good: animating transform, opacity */
```

#### Conditional Animation

```typescript
// Only animate dealer marker when visible
const dealerMarkerStyle = useMemo(() => {
  if (isDealer && isActivePlayer) {
    return { animation: 'dealerPulse 1.5s ease-in-out infinite' };
  }
  return {};
}, [isDealer, isActivePlayer]);
```

### Rendering Optimization

#### Avoid Unnecessary Re-renders

```typescript
// Use stable references for callbacks
const handleClick = useCallback(() => {
  onClick?.();
}, [onClick]);

// Memoize computed values
const seatColor = useMemo(() => SEAT_COLORS[seat], [seat]);
const statusLabel = useMemo(() => STATUS_LABELS[status], [status]);
```

#### Lazy Load Chinese Characters

```typescript
// Only load Chinese characters when needed
const chineseWind = useMemo(() => {
  return showChineseWinds ? WIND_CHINESE[seat] : null;
}, [showChineseWinds, seat]);
```

### Bundle Size

#### Import Optimization

```typescript
// Import only what's needed from bindings
import type { Seat, PlayerStatus } from '@/types/bindings/generated';

// Use tree-shakable icon libraries
import { Diamond } from 'lucide-react'; // 1 icon, not entire library
```

#### CSS Modules

```typescript
// Use CSS Modules to avoid global styles
import styles from './PlayerSeatIndicator.module.css';

// Auto-scoped, tree-shakable styles
<div className={styles.indicator}>...</div>
```

### Memory Management

#### Cleanup Timers

```typescript
useEffect(() => {
  if (score !== previousScore) {
    const timer = setTimeout(() => {
      setAnimatingScore(false);
    }, 300);

    return () => clearTimeout(timer);
  }
}, [score, previousScore]);
```

#### Avoid Memory Leaks

```typescript
useEffect(() => {
  const handler = (event: CustomEvent) => {
    handleStatusChange(event.detail);
  };

  window.addEventListener('player-status-changed', handler);
  return () => {
    window.removeEventListener('player-status-changed', handler);
  };
}, []);
```

---

## 12. Implementation Notes

### File Structure

```
src/components/presentational/PlayerSeatIndicator/
├── PlayerSeatIndicator.tsx          # Main component
├── PlayerSeatIndicator.module.css   # Scoped styles
├── PlayerSeatIndicator.test.tsx     # Unit tests
├── constants.ts                     # Wind names, colors, status labels
└── index.ts                         # Re-export
```

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@axe-core/react": "^4.8.0",
    "vitest": "^1.0.0"
  }
}
```

### Constants File

```typescript
// constants.ts
import { Seat, PlayerStatus } from '@/types/bindings/generated';

export const WIND_NAMES: Record<Seat, string> = {
  East: 'EAST',
  South: 'SOUTH',
  West: 'WEST',
  North: 'NORTH',
};

export const WIND_CHINESE: Record<Seat, string> = {
  East: '東',
  South: '南',
  West: '西',
  North: '北',
};

export const SEAT_COLORS: Record<Seat, string> = {
  East: '#DC2626', // Red-600
  South: '#16A34A', // Green-600
  West: '#2563EB', // Blue-600
  North: '#CA8A04', // Yellow-600
};

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  Active: 'ACTIVE',
  Waiting: 'WAITING',
  Dead: 'DEAD',
  // Add other statuses as defined in bindings
};

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  Active: '#10B981', // Green-500
  Waiting: '#6B7280', // Gray-500
  Dead: '#EF4444', // Red-500
};

export const DEALER_MARKER = '◆';
```

### CSS Module Structure

```css
/* PlayerSeatIndicator.module.css */

.indicator {
  display: flex;
  border-radius: 8px;
  background-color: var(--gray-100);
  transition:
    background-color 150ms ease,
    box-shadow 150ms ease;
  position: relative;
}

.indicator.clickable {
  cursor: pointer;
}

.indicator.clickable:hover {
  background-color: var(--gray-200);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.indicator.activePlayer {
  border: 2px solid var(--amber-500);
  background-color: var(--amber-100);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.indicator.dead {
  background-color: var(--red-100);
  border: 1px solid var(--red-400);
  opacity: 0.7;
}

.indicator.currentUser {
  border: 2px solid var(--blue-600);
  background-color: var(--blue-50);
}

/* Orientations */
.indicator.horizontal {
  flex-direction: column;
  width: 240px;
  min-height: 80px;
  padding: 12px;
}

.indicator.vertical {
  flex-direction: column;
  align-items: center;
  width: 160px;
  min-height: 140px;
  padding: 12px;
  text-align: center;
}

.indicator.compact {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 200px;
  height: 40px;
  padding: 8px 12px;
}

/* Wind indicator */
.wind {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.wind.east {
  color: var(--red-600);
}
.wind.south {
  color: var(--green-600);
}
.wind.west {
  color: var(--blue-600);
}
.wind.north {
  color: var(--yellow-600);
}

/* Dealer marker */
.dealerMarker {
  color: var(--amber-500);
  font-size: 16px;
  display: inline-block;
}

.dealerMarker.active {
  animation: dealerPulse 1.5s ease-in-out infinite;
}

@keyframes dealerPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

/* Player name */
.playerName {
  font-size: 16px;
  font-weight: 500;
  color: var(--gray-900);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playerName.dead {
  text-decoration: line-through;
}

/* Score */
.score {
  font-size: 14px;
  color: var(--gray-600);
  margin-top: 4px;
}

.score.negative {
  color: var(--red-600);
}

/* Status badge */
.statusBadge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
  white-space: nowrap;
  align-self: flex-start;
}

.statusBadge.active {
  background-color: var(--green-500);
}

.statusBadge.waiting {
  background-color: var(--gray-500);
}

.statusBadge.dead {
  background-color: var(--red-500);
}

/* Responsive */
@media (max-width: 640px) {
  .indicator.horizontal,
  .indicator.vertical {
    /* Force compact on mobile */
    flex-direction: row;
    align-items: center;
    width: 100%;
    height: 36px;
    padding: 6px 10px;
  }

  .score {
    display: none;
  }
}
```

### Implementation Example

```typescript
// PlayerSeatIndicator.tsx
import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type { Seat, PlayerStatus } from '@/types/bindings/generated';
import {
  WIND_NAMES,
  WIND_CHINESE,
  SEAT_COLORS,
  STATUS_LABELS,
  DEALER_MARKER,
} from './constants';
import styles from './PlayerSeatIndicator.module.css';

export interface PlayerSeatIndicatorProps {
  seat: Seat;
  playerName: string;
  status: PlayerStatus;
  isDealer: boolean;
  score?: number;
  orientation?: 'horizontal' | 'vertical' | 'compact';
  isCurrentUser?: boolean;
  showChineseWinds?: boolean;
  isActivePlayer?: boolean;
  className?: string;
  onClick?: () => void;
}

export const PlayerSeatIndicator = React.memo<PlayerSeatIndicatorProps>(
  ({
    seat,
    playerName,
    status,
    isDealer,
    score,
    orientation = 'horizontal',
    isCurrentUser = false,
    showChineseWinds = false,
    isActivePlayer = false,
    className,
    onClick,
  }) => {
    const windName = WIND_NAMES[seat];
    const chineseWind = showChineseWinds ? WIND_CHINESE[seat] : null;
    const statusLabel = STATUS_LABELS[status] || 'UNKNOWN';
    const isDead = status === 'Dead';

    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      },
      [onClick]
    );

    const ariaLabel = useMemo(() => {
      let label = `Player ${playerName}, ${windName} seat`;
      if (isDealer) label += ', dealer';
      if (score !== undefined) label += `, score ${score} points`;
      label += `, ${statusLabel.toLowerCase()}`;
      return label;
    }, [playerName, windName, isDealer, score, statusLabel]);

    return (
      <div
        role="region"
        aria-label={ariaLabel}
        aria-live={isActivePlayer ? 'polite' : 'off'}
        aria-current={isActivePlayer ? 'true' : undefined}
        className={clsx(
          styles.indicator,
          styles[orientation],
          {
            [styles.clickable]: !!onClick,
            [styles.activePlayer]: isActivePlayer,
            [styles.dead]: isDead,
            [styles.currentUser]: isCurrentUser,
          },
          className
        )}
        onClick={onClick ? handleClick : undefined}
        onKeyDown={onClick ? handleKeyDown : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div
          className={clsx(styles.wind, styles[seat.toLowerCase()])}
          style={{ color: SEAT_COLORS[seat] }}
        >
          {windName}
          {chineseWind && <span> ({chineseWind})</span>}
          {isDealer && (
            <span
              className={clsx(styles.dealerMarker, {
                [styles.active]: isActivePlayer,
              })}
              aria-label="Dealer"
            >
              {DEALER_MARKER}
            </span>
          )}
        </div>

        <div className={clsx(styles.playerName, { [styles.dead]: isDead })}>
          {playerName || 'Unknown Player'}
        </div>

        {score !== undefined && orientation !== 'compact' && (
          <div className={clsx(styles.score, { [styles.negative]: score < 0 })}>
            Score: {score}
          </div>
        )}

        <div className={clsx(styles.statusBadge, styles[status.toLowerCase()])}>
          {statusLabel}
        </div>
      </div>
    );
  }
);

PlayerSeatIndicator.displayName = 'PlayerSeatIndicator';
```

### Testing Utilities

```typescript
// test-utils.tsx
import { render } from '@testing-library/react';
import type { Seat, PlayerStatus } from '@/types/bindings/generated';
import { PlayerSeatIndicator, PlayerSeatIndicatorProps } from './PlayerSeatIndicator';

export const renderPlayerSeatIndicator = (
  props: Partial<PlayerSeatIndicatorProps> = {}
) => {
  const defaultProps: PlayerSeatIndicatorProps = {
    seat: 'East' as Seat,
    playerName: 'Test Player',
    status: 'Waiting' as PlayerStatus,
    isDealer: false,
    ...props,
  };

  return render(<PlayerSeatIndicator {...defaultProps} />);
};
```

### Migration from Existing Code

If updating an existing PlayerInfo or PlayerStatus component:

1. **Audit current props**: Map existing props to new interface
2. **Update imports**: Change from old component to PlayerSeatIndicator
3. **Test thoroughly**: Run full test suite and visual regression tests
4. **Update documentation**: Reflect new component in design system docs

### Browser Support

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **CSS Features**: CSS Grid, Flexbox, CSS Animations, CSS Variables
- **JavaScript**: ES2020+ (Optional chaining, Nullish coalescing)
- **Fallbacks**: Provide static styles for browsers without animation support

### Accessibility Checklist

- [ ] ARIA attributes present and correct
- [ ] Keyboard navigation functional
- [ ] Focus indicators visible (2px ring)
- [ ] Color contrast ratios meet WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Screen reader announcements tested
- [ ] Touch targets minimum 44×44px on mobile
- [ ] Text respects user font scaling
- [ ] Component passes axe-core audit
