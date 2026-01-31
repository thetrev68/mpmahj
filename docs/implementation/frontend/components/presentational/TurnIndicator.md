# TurnIndicator Component Specification

## 1. Overview

The `<TurnIndicator>` component visually highlights which player's turn it is during gameplay. It provides clear visual feedback through color, animation, and positioning to ensure players always know who is currently active. The indicator updates in real-time as turns progress and can display different states (drawing, discarding, call window).

**Component Type**: Presentational  
**Complexity**: Low-Medium  
**Related Components**: `<PlayerSeatIndicator>`, `<GameBoard>`, `<Timer>`

## 2. TypeScript Interface

```typescript
import { Seat } from '@/types/bindings/generated/Seat';

export interface TurnIndicatorProps {
  /** Current active player's seat */
  activeSeat: Seat;

  /** Current turn stage (drawing, discarding, call window, etc.) */
  turnStage?: 'drawing' | 'discarding' | 'call-window' | 'awaiting-mahjong';

  /** Visual style variant */
  variant?: 'glow' | 'arrow' | 'border' | 'badge';

  /** Size of the indicator */
  size?: 'small' | 'medium' | 'large';

  /** Whether to animate the indicator */
  animated?: boolean;

  /** Animation speed multiplier */
  animationSpeed?: number;

  /** Whether to show turn stage text */
  showStage?: boolean;

  /** Custom label override (e.g., "Your Turn", "East's Turn") */
  customLabel?: string;

  /** Color theme (auto-selected by seat if not provided) */
  color?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for component testing */
  testId?: string;
}

/** Seat type from backend */
export type Seat = 'east' | 'south' | 'west' | 'north';
```

## 3. Component Behavior

### 3.1 Indicator Variants

#### Glow (Default)

- Glowing ring around active player's area
- Pulsing animation (subtle, 2s interval)
- Color-coded by seat (East: red, South: green, West: white, North: blue)
- Use: Primary indicator for current player

#### Arrow

- Animated arrow pointing to active player
- Rotates to point at correct seat
- Smooth rotation transition (300ms)
- Use: Clear directional indicator on circular/compass layout

#### Border

- Highlighted border around player's hand/area
- Thicker, colored border (3-4px)
- Optional glow effect
- Use: Subtle, non-intrusive indicator

#### Badge

- Floating badge with text ("YOUR TURN" or "EAST'S TURN")
- Positioned above/beside player area
- Icon + text
- Use: Explicit text-based indicator

### 3.2 Turn Stage Display

When `showStage` is true, display current turn stage:

| Stage              | Text          | Icon | Color  |
| ------------------ | ------------- | ---- | ------ |
| `drawing`          | "Drawing"     | 🎴   | Blue   |
| `discarding`       | "Discarding"  | ♻️   | Amber  |
| `call-window`      | "Call Window" | ⏱️   | Orange |
| `awaiting-mahjong` | "Mahjong!"    | 🎉   | Green  |

### 3.3 Seat Colors

Default color scheme (traditional):

| Seat  | Primary Color      | Accent Color     |
| ----- | ------------------ | ---------------- |
| East  | hsl(0, 70%, 50%)   | Red              |
| South | hsl(140, 60%, 45%) | Green            |
| West  | hsl(0, 0%, 95%)    | White/Light gray |
| North | hsl(210, 70%, 50%) | Blue             |

Colors can be customized via `color` prop.

### 3.4 Animation Behavior

#### Pulsing Glow (Default)

- Opacity: 0.8 → 1.0 → 0.8 (2s cycle)
- Scale: 1.0 → 1.02 → 1.0 (subtle)
- Continuous loop during player's turn

#### Rotate Arrow

- Smooth rotation transition when seat changes
- Duration: 300ms ease-out
- No continuous animation (settles in place)

#### Border Highlight

- Fade in when turn starts (200ms)
- Pulsing border glow (optional, 2s cycle)
- Fade out when turn ends (200ms)

#### Badge Entrance

- Slide in + fade (300ms)
- Scale pulse on appearance (400ms)
- Settle in place

### 3.5 Responsive Behavior

| Breakpoint | Variant | Size   | Animation | Stage Text |
| ---------- | ------- | ------ | --------- | ---------- |
| Desktop    | Glow    | medium | Full      | Shown      |
| Tablet     | Glow    | medium | Full      | Hidden     |
| Mobile     | Badge   | small  | Reduced   | Hidden     |

On mobile, prefer badge variant for clarity in limited space.

## 4. Accessibility

### ARIA Attributes

```html
<div role="status" aria-live="polite" aria-label="East's turn - Discarding" class="turn-indicator">
  <div class="indicator-glow" aria-hidden="true"></div>
  <span class="indicator-text">East's Turn</span>
</div>
```

### Screen Reader Support

Announce turn changes:

- "Your turn - Drawing phase"
- "East's turn - Discarding"
- "Call window open - You may declare intent"

Use `aria-live="polite"` to announce without interrupting.

### Keyboard Navigation

- Indicator is not interactive (visual only)
- No keyboard navigation required
- Focus remains on actionable elements (buttons, tiles)

### Visual Clarity

- High contrast colors for visibility
- Multiple indicators (color + animation + text)
- Works without color (motion + text fallback)

## 5. Usage Examples

### Example 1: Basic Glow Indicator

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function GameBoard() {
  const currentSeat = 'east';

  return (
    <div className="game-board">
      <TurnIndicator activeSeat={currentSeat} variant="glow" size="medium" />
    </div>
  );
}
```

### Example 2: With Turn Stage

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function TurnStatus() {
  const currentSeat = 'south';
  const currentStage = 'discarding';

  return (
    <TurnIndicator
      activeSeat={currentSeat}
      turnStage={currentStage}
      variant="glow"
      showStage={true}
    />
  );
}
```

### Example 3: Arrow Variant

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function CompassTurnIndicator() {
  const currentSeat = 'west';

  return (
    <div className="compass-layout">
      <TurnIndicator activeSeat={currentSeat} variant="arrow" size="large" animated={true} />
    </div>
  );
}
```

### Example 4: Badge with Custom Label

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function PersonalizedTurnIndicator() {
  const currentSeat = 'north';
  const isMyTurn = currentSeat === 'north';
  const label = isMyTurn ? 'YOUR TURN' : "North's Turn";

  return (
    <TurnIndicator
      activeSeat={currentSeat}
      variant="badge"
      customLabel={label}
      color={isMyTurn ? 'hsl(210, 70%, 50%)' : undefined}
    />
  );
}
```

### Example 5: Border Highlight

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function SubtleTurnIndicator() {
  const currentSeat = 'east';

  return (
    <div className="player-hand-container">
      <TurnIndicator activeSeat={currentSeat} variant="border" size="medium" />
      {/* Player hand components */}
    </div>
  );
}
```

### Example 6: Multiple Indicators Combined

```tsx
import { TurnIndicator } from '@/components/presentational/TurnIndicator';

function MultiIndicatorDisplay() {
  const currentSeat = 'south';
  const currentStage = 'call-window';

  return (
    <div className="game-board">
      {/* Glow around player area */}
      <TurnIndicator activeSeat={currentSeat} variant="glow" size="large" animated={true} />

      {/* Badge with stage info */}
      <TurnIndicator
        activeSeat={currentSeat}
        turnStage={currentStage}
        variant="badge"
        showStage={true}
      />
    </div>
  );
}
```

## 6. Visual Design

### Color Scheme

```css
/* Seat colors (traditional) */
--seat-east-color: hsl(0, 70%, 50%); /* Red */
--seat-south-color: hsl(140, 60%, 45%); /* Green */
--seat-west-color: hsl(0, 0%, 95%); /* White/Light gray */
--seat-north-color: hsl(210, 70%, 50%); /* Blue */

/* Glow variants */
--indicator-glow-opacity: 0.3;
--indicator-glow-size: 8px;

/* Border */
--indicator-border-width: 3px;
--indicator-border-radius: 8px;

/* Badge */
--badge-bg: rgba(0, 0, 0, 0.8);
--badge-text: hsl(0, 0%, 100%);
```

### Typography

```css
--indicator-font: 'Roboto', sans-serif;
--indicator-font-weight: 700;
--indicator-font-size-small: 12px;
--indicator-font-size-medium: 14px;
--indicator-font-size-large: 18px;
```

### Layout

#### Glow Variant

```text
     ┌─────────────┐
     │ (pulsing    │
     │  glow ring) │
     └─────────────┘
```

#### Arrow Variant

```text
        ↓
     [Player]
```

#### Border Variant

```text
╔═══════════════╗
║  Player Hand  ║  ← Highlighted border
╚═══════════════╝
```

#### Badge Variant

```text
┌──────────────────┐
│ 🎴 YOUR TURN     │
│   (Discarding)   │
└──────────────────┘
```

## 7. Responsive Design

### Breakpoints

| Breakpoint | Default Variant | Animation | Text Size |
| ---------- | --------------- | --------- | --------- |
| Desktop    | Glow            | Full      | Medium    |
| Tablet     | Glow            | Full      | Medium    |
| Mobile     | Badge           | Reduced   | Small     |

### Mobile Optimizations

- Use badge variant (more visible in limited space)
- Reduce animation complexity
- Hide turn stage text (icon only)
- Fixed positioning for always-visible status

## 8. Performance Considerations

### Rendering Optimization

- Use `React.memo` to prevent re-renders unless `activeSeat` changes
- CSS animations (GPU-accelerated) instead of JavaScript
- Lazy render: Only show when game is active

### Animation Performance

- Use `transform` and `opacity` for smooth animations
- Avoid layout thrashing
- Disable animations if `prefers-reduced-motion: reduce`

### Update Strategy

```tsx
// Only re-render when active seat actually changes
export const TurnIndicator = React.memo(
  TurnIndicatorComponent,
  (prevProps, nextProps) => prevProps.activeSeat === nextProps.activeSeat
);
```

## 9. Testing Requirements

### Unit Tests

```typescript
describe('TurnIndicator Component', () => {
  test('renders with correct seat', () => {
    render(<TurnIndicator activeSeat="east" />);
    expect(screen.getByLabelText(/east's turn/i)).toBeInTheDocument();
  });

  test('applies correct color for each seat', () => {
    const { container } = render(<TurnIndicator activeSeat="south" variant="glow" />);
    const glow = container.querySelector('.indicator-glow');
    expect(glow).toHaveStyle({ borderColor: 'hsl(140, 60%, 45%)' });
  });

  test('displays turn stage when showStage is true', () => {
    render(<TurnIndicator activeSeat="east" turnStage="discarding" showStage={true} />);
    expect(screen.getByText(/discarding/i)).toBeInTheDocument();
  });

  test('uses custom label when provided', () => {
    render(<TurnIndicator activeSeat="north" customLabel="YOUR TURN" variant="badge" />);
    expect(screen.getByText('YOUR TURN')).toBeInTheDocument();
  });

  test('applies glow variant by default', () => {
    const { container } = render(<TurnIndicator activeSeat="west" />);
    expect(container.querySelector('.indicator-glow')).toBeInTheDocument();
  });

  test('applies arrow variant when specified', () => {
    const { container } = render(<TurnIndicator activeSeat="east" variant="arrow" />);
    expect(container.querySelector('.indicator-arrow')).toBeInTheDocument();
  });

  test('applies border variant when specified', () => {
    const { container } = render(<TurnIndicator activeSeat="south" variant="border" />);
    expect(container.querySelector('.indicator-border')).toBeInTheDocument();
  });

  test('applies badge variant when specified', () => {
    const { container } = render(<TurnIndicator activeSeat="north" variant="badge" />);
    expect(container.querySelector('.indicator-badge')).toBeInTheDocument();
  });

  test('animates by default', () => {
    const { container } = render(<TurnIndicator activeSeat="east" />);
    expect(container.querySelector('.indicator-animated')).toBeInTheDocument();
  });

  test('disables animation when animated prop is false', () => {
    const { container } = render(<TurnIndicator activeSeat="east" animated={false} />);
    expect(container.querySelector('.indicator-animated')).not.toBeInTheDocument();
  });

  test('respects reduced motion preference', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(<TurnIndicator activeSeat="east" />);
    expect(container.querySelector('.indicator-no-animation')).toBeInTheDocument();
  });

  test('applies correct size class', () => {
    const { container } = render(<TurnIndicator activeSeat="east" size="large" />);
    expect(container.querySelector('.indicator-large')).toBeInTheDocument();
  });

  test('announces to screen readers', () => {
    render(<TurnIndicator activeSeat="south" turnStage="drawing" />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-label', expect.stringContaining("South's turn"));
  });

  test('uses custom color when provided', () => {
    const customColor = 'hsl(300, 70%, 50%)';
    const { container } = render(<TurnIndicator activeSeat="east" color={customColor} />);
    const glow = container.querySelector('.indicator-glow');
    expect(glow).toHaveStyle({ borderColor: customColor });
  });
});
```

### Integration Tests

```typescript
describe('TurnIndicator Integration', () => {
  test('updates when turn changes', async () => {
    const { rerender } = render(<GameBoard currentSeat="east" />);
    expect(screen.getByLabelText(/east's turn/i)).toBeInTheDocument();

    rerender(<GameBoard currentSeat="south" />);
    await waitFor(() => expect(screen.getByLabelText(/south's turn/i)).toBeInTheDocument());
  });

  test('highlights correct player during turn progression', () => {
    render(<GameBoard currentSeat="west" />);
    const westIndicator = screen.getByLabelText(/west's turn/i);
    expect(westIndicator).toBeInTheDocument();
  });

  test('shows turn stage transitions', async () => {
    const { rerender } = render(<TurnIndicator activeSeat="east" turnStage="drawing" showStage={true} />);
    expect(screen.getByText(/drawing/i)).toBeInTheDocument();

    rerender(<TurnIndicator activeSeat="east" turnStage="discarding" showStage={true} />);
    await waitFor(() => expect(screen.getByText(/discarding/i)).toBeInTheDocument());
  });
});
```

### Visual Regression Tests

```typescript
export default {
  title: 'Components/TurnIndicator',
  component: TurnIndicator,
};

export const AllVariants = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', padding: '32px' }}>
    <div>
      <h3>Glow</h3>
      <TurnIndicator activeSeat="east" variant="glow" size="medium" />
    </div>
    <div>
      <h3>Arrow</h3>
      <TurnIndicator activeSeat="south" variant="arrow" size="medium" />
    </div>
    <div>
      <h3>Border</h3>
      <TurnIndicator activeSeat="west" variant="border" size="medium" />
    </div>
    <div>
      <h3>Badge</h3>
      <TurnIndicator activeSeat="north" variant="badge" size="medium" showStage={true} turnStage="discarding" />
    </div>
  </div>
);

export const AllSeats = () => (
  <div style={{ display: 'flex', gap: '24px', padding: '32px' }}>
    <TurnIndicator activeSeat="east" variant="glow" />
    <TurnIndicator activeSeat="south" variant="glow" />
    <TurnIndicator activeSeat="west" variant="glow" />
    <TurnIndicator activeSeat="north" variant="glow" />
  </div>
);

export const WithTurnStages = () => (
  <div style={{ display: 'flex', gap: '24px', padding: '32px', flexDirection: 'column' }}>
    <TurnIndicator activeSeat="east" turnStage="drawing" showStage={true} variant="badge" />
    <TurnIndicator activeSeat="east" turnStage="discarding" showStage={true} variant="badge" />
    <TurnIndicator activeSeat="east" turnStage="call-window" showStage={true} variant="badge" />
    <TurnIndicator activeSeat="east" turnStage="awaiting-mahjong" showStage={true} variant="badge" />
  </div>
);
```

## 10. Implementation Notes

### Component Structure

```tsx
import React, { useMemo } from 'react';
import classNames from 'classnames';
import { Seat } from '@/types/bindings/generated/Seat';
import styles from './TurnIndicator.module.css';

const SEAT_COLORS = {
  east: 'hsl(0, 70%, 50%)',
  south: 'hsl(140, 60%, 45%)',
  west: 'hsl(0, 0%, 95%)',
  north: 'hsl(210, 70%, 50%)',
};

const STAGE_LABELS = {
  drawing: { text: 'Drawing', icon: '🎴' },
  discarding: { text: 'Discarding', icon: '♻️' },
  'call-window': { text: 'Call Window', icon: '⏱️' },
  'awaiting-mahjong': { text: 'Mahjong!', icon: '🎉' },
};

export function TurnIndicator({
  activeSeat,
  turnStage,
  variant = 'glow',
  size = 'medium',
  animated = true,
  animationSpeed = 1,
  showStage = false,
  customLabel,
  color,
  className,
  testId,
}: TurnIndicatorProps) {
  const seatColor = color || SEAT_COLORS[activeSeat];

  const ariaLabel = useMemo(() => {
    const seatName = activeSeat.charAt(0).toUpperCase() + activeSeat.slice(1);
    const stageText = turnStage && showStage ? ` - ${STAGE_LABELS[turnStage].text}` : '';
    return `${seatName}'s turn${stageText}`;
  }, [activeSeat, turnStage, showStage]);

  const displayLabel = customLabel || `${activeSeat.toUpperCase()}'S TURN`;

  const indicatorClasses = classNames(
    styles.indicator,
    styles[`indicator-${variant}`],
    styles[`indicator-${size}`],
    {
      [styles['indicator-animated']]: animated,
    },
    className
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={indicatorClasses}
      style={
        {
          '--indicator-color': seatColor,
          '--animation-speed': animationSpeed,
        } as React.CSSProperties
      }
      data-testid={testId}
    >
      {variant === 'glow' && <div className={styles['indicator-glow']} aria-hidden="true" />}
      {variant === 'arrow' && (
        <div className={styles['indicator-arrow']} aria-hidden="true">
          ↓
        </div>
      )}
      {variant === 'border' && <div className={styles['indicator-border']} aria-hidden="true" />}
      {variant === 'badge' && (
        <div className={styles['indicator-badge']}>
          {turnStage && showStage && (
            <span className={styles.icon}>{STAGE_LABELS[turnStage].icon}</span>
          )}
          <span className={styles.text}>{displayLabel}</span>
          {turnStage && showStage && (
            <span className={styles.stage}>{STAGE_LABELS[turnStage].text}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

## 11. CSS Module (TurnIndicator.module.css)

```css
.indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Glow variant */
.indicator-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border: var(--indicator-glow-size, 8px) solid var(--indicator-color);
  border-radius: 50%;
  opacity: var(--indicator-glow-opacity, 0.3);
  pointer-events: none;
}

.indicator-animated .indicator-glow {
  animation: pulse-glow calc(2s / var(--animation-speed, 1)) ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.02);
  }
}

/* Arrow variant */
.indicator-arrow {
  font-size: 48px;
  color: var(--indicator-color);
  transition: transform 300ms ease-out;
}

.indicator-animated .indicator-arrow {
  animation: bounce calc(1s / var(--animation-speed, 1)) ease-in-out infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* Border variant */
.indicator-border {
  position: absolute;
  width: 100%;
  height: 100%;
  border: var(--indicator-border-width, 3px) solid var(--indicator-color);
  border-radius: var(--indicator-border-radius, 8px);
  pointer-events: none;
  box-shadow: 0 0 12px var(--indicator-color);
}

.indicator-animated .indicator-border {
  animation: pulse-border calc(2s / var(--animation-speed, 1)) ease-in-out infinite;
}

@keyframes pulse-border {
  0%,
  100% {
    box-shadow: 0 0 8px var(--indicator-color);
  }
  50% {
    box-shadow: 0 0 16px var(--indicator-color);
  }
}

/* Badge variant */
.indicator-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--badge-bg);
  color: var(--badge-text);
  border: 2px solid var(--indicator-color);
  border-radius: var(--radius-md);
  font-family: var(--indicator-font);
  font-weight: var(--indicator-font-weight);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.indicator-animated .indicator-badge {
  animation: slide-in 300ms ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.indicator-badge .icon {
  font-size: 24px;
}

.indicator-badge .text {
  font-size: var(--indicator-font-size-medium);
  color: var(--indicator-color);
  letter-spacing: 0.05em;
}

.indicator-badge .stage {
  font-size: var(--indicator-font-size-small);
  font-weight: 400;
  opacity: 0.8;
}

/* Size variants */
.indicator-small {
  font-size: var(--indicator-font-size-small);
}

.indicator-small .indicator-glow {
  border-width: 6px;
}

.indicator-small .indicator-arrow {
  font-size: 32px;
}

.indicator-medium {
  font-size: var(--indicator-font-size-medium);
}

.indicator-large {
  font-size: var(--indicator-font-size-large);
}

.indicator-large .indicator-glow {
  border-width: 10px;
}

.indicator-large .indicator-arrow {
  font-size: 64px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .indicator-animated .indicator-glow,
  .indicator-animated .indicator-arrow,
  .indicator-animated .indicator-border,
  .indicator-animated .indicator-badge {
    animation: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .indicator-badge {
    padding: var(--space-1) var(--space-2);
    font-size: var(--indicator-font-size-small);
  }

  .indicator-badge .icon {
    font-size: 18px;
  }

  .indicator-badge .stage {
    display: none; /* Hide stage text on mobile */
  }
}
```

## 12. Dependencies

### Required Packages

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "classnames": "^2.3.2"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

### Type Imports

```typescript
import { Seat } from '@/types/bindings/generated/Seat';
```

### Related Components

- `<PlayerSeatIndicator>`: Shows player information
- `<Timer>`: Often displayed alongside turn indicator
- `<GameBoard>`: Parent component managing turn state

---

**Status**: Draft  
**Last Updated**: 2026-01-31  
**Related Specs**: `PlayerSeatIndicator.md`, `Timer.md`, `GameBoard.md`
