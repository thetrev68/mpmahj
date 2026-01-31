# WallCounter Component Specification

## 1. Overview

The `<WallCounter>` component displays the number of tiles remaining in the wall during gameplay. It provides at-a-glance information about game progression and helps players judge risk/reward decisions. The counter updates in real-time as tiles are drawn and shows different visual states based on wall status (full, active, low, closed).

**Component Type**: Presentational  
**Complexity**: Low  
**Related Components**: `<Wall>`, `<WallClosureIndicator>`, `<GameBoard>`

## 2. TypeScript Interface

```typescript
export interface WallCounterProps {
  /** Number of tiles remaining in the wall (0-144) */
  remaining: number;

  /** Total tiles in wall at start (usually 144) */
  total?: number;

  /** Whether to show as a percentage instead of count */
  showPercentage?: boolean;

  /** Visual size variant */
  size?: 'small' | 'medium' | 'large';

  /** Display orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Whether to highlight when wall is low (< 20 tiles) */
  highlightLow?: boolean;

  /** Whether wall is closed (no more draws allowed) */
  closed?: boolean;

  /** Tooltip text override */
  tooltipText?: string;

  /** Callback when counter is clicked (e.g., to show wall details) */
  onClick?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for component testing */
  testId?: string;
}
```

## 3. Component Behavior

### 3.1 Display Modes

#### Count Mode (Default)

- Shows absolute number: "72 tiles"
- Updates immediately when tiles drawn
- Large, readable font
- Icon: Stack of tiles or wall icon

#### Percentage Mode

- Shows percentage remaining: "50%"
- Calculated as `(remaining / total) * 100`
- Useful for quick visual reference
- Includes small count in parentheses: "50% (72 tiles)"

### 3.2 Wall States

| State  | Remaining | Color | Icon       | Behavior                      |
| ------ | --------- | ----- | ---------- | ----------------------------- |
| Full   | 144       | Gray  | Full stack | Initial game state            |
| Active | 21-143    | Blue  | Stack      | Normal gameplay               |
| Low    | 1-20      | Amber | Few tiles  | Warning: wall depleting       |
| Closed | N/A       | Red   | Lock icon  | No more draws (14 tiles left) |
| Empty  | 0         | Red   | Empty icon | Wall exhausted, draw game     |

### 3.3 Visual Feedback

#### Update Animation

When count decreases (tile drawn):

1. Brief scale pulse (1.0 → 1.1 → 1.0, 300ms)
2. Number transitions with fade (old fades out, new fades in)
3. Optional: Decrement counter animation (number scrolls down)

#### Low Wall Warning

When `remaining < 20` and `highlightLow` is true:

- Amber/orange color
- Pulsing glow effect (subtle, 2s interval)
- Tooltip: "Wall is running low! X tiles remaining"

#### Closed Wall

When `closed` is true:

- Red color
- Lock icon
- Tooltip: "Wall is closed - no more draws"
- Strikethrough on count (optional)

### 3.4 Responsive Behavior

| Size     | Font Size | Icon Size | Padding | Min Width |
| -------- | --------- | --------- | ------- | --------- |
| `small`  | 14px      | 16px      | 8px     | 80px      |
| `medium` | 18px      | 24px      | 12px    | 100px     |
| `large`  | 24px      | 32px      | 16px    | 120px     |

### 3.5 Orientation

#### Horizontal (Default)

```text
[Icon] 72 tiles
```

#### Vertical

```text
[Icon]
 72
tiles
```

## 4. Accessibility

### ARIA Attributes

```html
<div role="status" aria-live="polite" aria-label="72 tiles remaining in wall" aria-atomic="true">
  <span class="icon" aria-hidden="true">🀫</span>
  <span class="count">72 tiles</span>
</div>
```

### Screen Reader Announcements

- Announce only on significant changes (every 10 tiles, or when < 20)
- Low wall: "Warning: only 15 tiles remaining"
- Closed wall: "Wall is closed, no more draws"
- Empty wall: "Wall exhausted, game is a draw"

### Keyboard Navigation

- If clickable (`onClick` provided), make focusable with `tabindex="0"`
- **Space/Enter**: Trigger onClick (e.g., show wall details modal)
- **Tab**: Navigate to next interactive element

### Focus State

- Blue outline when focused
- Tooltip appears on focus (keyboard accessibility)

## 5. Usage Examples

### Example 1: Basic Wall Counter

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';

function GameBoard() {
  const wallTilesRemaining = 72;

  return (
    <div className="game-board">
      <WallCounter remaining={wallTilesRemaining} total={144} size="medium" />
    </div>
  );
}
```

### Example 2: Low Wall Warning

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';

function GameStatus() {
  const wallTilesRemaining = 18;

  return (
    <WallCounter
      remaining={wallTilesRemaining}
      total={144}
      size="medium"
      highlightLow={true}
      tooltipText="Wall is running low! Only 18 tiles left."
    />
  );
}
```

### Example 3: Closed Wall

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';

function ClosedWallDisplay() {
  const wallTilesRemaining = 14;

  return (
    <WallCounter
      remaining={wallTilesRemaining}
      total={144}
      closed={true}
      size="large"
      tooltipText="Wall is closed - 14 tiles reserved for Charleston"
    />
  );
}
```

### Example 4: Percentage Mode

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';

function CompactWallCounter() {
  const wallTilesRemaining = 72;

  return (
    <WallCounter remaining={wallTilesRemaining} total={144} showPercentage={true} size="small" />
  );
}
```

### Example 5: Clickable Counter with Details

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';
import { useState } from 'react';

function InteractiveWallCounter() {
  const [showDetails, setShowDetails] = useState(false);
  const wallTilesRemaining = 72;

  return (
    <>
      <WallCounter
        remaining={wallTilesRemaining}
        total={144}
        size="medium"
        onClick={() => setShowDetails(true)}
        tooltipText="Click to see wall details"
      />
      {showDetails && (
        <WallDetailsModal remaining={wallTilesRemaining} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}
```

### Example 6: Vertical Orientation

```tsx
import { WallCounter } from '@/components/presentational/WallCounter';

function SidebarWallCounter() {
  const wallTilesRemaining = 72;

  return (
    <div className="sidebar">
      <WallCounter remaining={wallTilesRemaining} total={144} orientation="vertical" size="large" />
    </div>
  );
}
```

## 6. Visual Design

### Color Scheme

```css
/* Wall states */
--wall-full: hsl(210, 10%, 60%); /* Gray */
--wall-active: hsl(210, 70%, 50%); /* Blue */
--wall-low: hsl(40, 100%, 50%); /* Amber */
--wall-closed: hsl(0, 70%, 50%); /* Red */
--wall-empty: hsl(0, 70%, 40%); /* Dark red */

/* Text colors */
--counter-text: hsl(0, 0%, 20%);
--counter-text-light: hsl(0, 0%, 40%);

/* Background */
--counter-bg: hsl(0, 0%, 98%);
--counter-border: hsl(0, 0%, 85%);
```

### Typography

```css
--counter-font: 'Roboto Mono', monospace;
--counter-font-weight: 700;
--counter-font-size-small: 14px;
--counter-font-size-medium: 18px;
--counter-font-size-large: 24px;

--counter-label-font: 'Roboto', sans-serif;
--counter-label-size-small: 10px;
--counter-label-size-medium: 12px;
--counter-label-size-large: 14px;
```

### Layout

#### Horizontal

```text
┌────────────────────────┐
│  [Icon]  72 tiles      │
└────────────────────────┘
```

#### Vertical

```text
┌────────┐
│ [Icon] │
│   72   │
│ tiles  │
└────────┘
```

#### With Percentage

```text
┌────────────────────────┐
│  [Icon]  50%           │
│         (72 tiles)     │
└────────────────────────┘
```

## 7. Responsive Design

### Breakpoints

| Breakpoint | Default Size | Position            | Behavior             |
| ---------- | ------------ | ------------------- | -------------------- |
| Desktop    | medium       | Top-center or right | Full label "X tiles" |
| Tablet     | medium       | Top-right           | Full label           |
| Mobile     | small        | Top-right, compact  | Icon + number only   |

### Mobile Optimizations

- Show only icon + count (omit "tiles" label)
- Reduce padding and margins
- Increase tap target size if clickable (min 44×44px)
- Consider fixed positioning for always-visible status

## 8. Performance Considerations

### Rendering Optimization

- Use `React.memo` to prevent re-renders unless `remaining` changes
- Debounce rapid updates (e.g., during multiple quick draws)
- Use CSS transitions instead of JavaScript animations

### Update Strategy

```tsx
// Batch updates if multiple tiles drawn quickly
const debouncedRemaining = useDebounce(remaining, 200);
```

### Animation Performance

- Use `transform` and `opacity` for GPU acceleration
- Avoid layout thrashing
- Disable animations if `prefers-reduced-motion: reduce`

## 9. Testing Requirements

### Unit Tests

```typescript
describe('WallCounter Component', () => {
  test('renders with correct tile count', () => {
    render(<WallCounter remaining={72} total={144} />);
    expect(screen.getByText(/72 tiles/i)).toBeInTheDocument();
  });

  test('displays percentage when showPercentage is true', () => {
    render(<WallCounter remaining={72} total={144} showPercentage={true} />);
    expect(screen.getByText(/50%/i)).toBeInTheDocument();
    expect(screen.getByText(/72 tiles/i)).toBeInTheDocument();
  });

  test('applies low wall styling when remaining < 20', () => {
    const { container } = render(<WallCounter remaining={15} total={144} highlightLow={true} />);
    expect(container.querySelector('.wall-low')).toBeInTheDocument();
  });

  test('shows closed state when closed prop is true', () => {
    render(<WallCounter remaining={14} total={144} closed={true} />);
    expect(screen.getByLabelText(/wall is closed/i)).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<WallCounter remaining={72} total={144} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  test('is keyboard accessible when onClick provided', () => {
    const handleClick = jest.fn();
    render(<WallCounter remaining={72} total={144} onClick={handleClick} />);
    const counter = screen.getByRole('button');
    fireEvent.keyDown(counter, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalled();
  });

  test('announces to screen readers on update', () => {
    const { rerender } = render(<WallCounter remaining={72} total={144} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    rerender(<WallCounter remaining={71} total={144} />);
    expect(screen.getByLabelText(/71 tiles remaining/i)).toBeInTheDocument();
  });

  test('shows tooltip on hover when provided', async () => {
    render(<WallCounter remaining={72} total={144} tooltipText="Wall details" />);
    fireEvent.mouseEnter(screen.getByRole('status'));
    await waitFor(() => expect(screen.getByText('Wall details')).toBeInTheDocument());
  });

  test('renders vertical orientation correctly', () => {
    const { container } = render(
      <WallCounter remaining={72} total={144} orientation="vertical" />
    );
    expect(container.querySelector('.counter-vertical')).toBeInTheDocument();
  });

  test('applies correct size classes', () => {
    const { container } = render(<WallCounter remaining={72} total={144} size="large" />);
    expect(container.querySelector('.counter-large')).toBeInTheDocument();
  });

  test('shows warning for low wall (< 20 tiles)', () => {
    render(<WallCounter remaining={15} total={144} highlightLow={true} />);
    expect(screen.getByLabelText(/warning.*15 tiles/i)).toBeInTheDocument();
  });

  test('animates count change', () => {
    const { container, rerender } = render(<WallCounter remaining={72} total={144} />);
    const counter = container.querySelector('.count');
    expect(counter).toHaveTextContent('72');

    rerender(<WallCounter remaining={71} total={144} />);
    expect(counter).toHaveClass('count-updating');
  });

  test('respects reduced motion preference', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(<WallCounter remaining={72} total={144} />);
    expect(container.querySelector('.counter')).toHaveClass('reduced-motion');
  });
});
```

### Integration Tests

```typescript
describe('WallCounter Integration', () => {
  test('updates when tiles are drawn from wall', async () => {
    render(<GameBoard initialWallCount={144} />);
    expect(screen.getByText(/144 tiles/i)).toBeInTheDocument();

    // Simulate drawing a tile
    fireEvent.click(screen.getByRole('button', { name: /draw tile/i }));

    await waitFor(() => expect(screen.getByText(/143 tiles/i)).toBeInTheDocument());
  });

  test('shows low wall warning when approaching closure', () => {
    render(<GameBoard initialWallCount={18} />);
    expect(screen.getByLabelText(/warning.*18 tiles/i)).toBeInTheDocument();
  });

  test('transitions to closed state at correct threshold', () => {
    const { rerender } = render(<GameBoard initialWallCount={15} />);
    expect(screen.getByText(/15 tiles/i)).toBeInTheDocument();

    // Draw one more tile to reach closure threshold (14)
    rerender(<GameBoard initialWallCount={14} />);
    expect(screen.getByLabelText(/wall is closed/i)).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

```typescript
export default {
  title: 'Components/WallCounter',
  component: WallCounter,
};

export const AllStates = () => (
  <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
    <WallCounter remaining={144} total={144} size="medium" />
    <WallCounter remaining={72} total={144} size="medium" />
    <WallCounter remaining={18} total={144} size="medium" highlightLow={true} />
    <WallCounter remaining={14} total={144} size="medium" closed={true} />
    <WallCounter remaining={0} total={144} size="medium" />
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
    <WallCounter remaining={72} total={144} size="small" />
    <WallCounter remaining={72} total={144} size="medium" />
    <WallCounter remaining={72} total={144} size="large" />
  </div>
);

export const Orientations = () => (
  <div style={{ display: 'flex', gap: '32px' }}>
    <WallCounter remaining={72} total={144} orientation="horizontal" />
    <WallCounter remaining={72} total={144} orientation="vertical" />
  </div>
);

export const WithPercentage = () => (
  <WallCounter remaining={72} total={144} showPercentage={true} size="medium" />
);
```

## 10. Implementation Notes

### Component Structure

```tsx
import React, { useMemo } from 'react';
import classNames from 'classnames';
import { Tooltip } from '@/components/presentational/Tooltip';
import styles from './WallCounter.module.css';

export function WallCounter({
  remaining,
  total = 144,
  showPercentage = false,
  size = 'medium',
  orientation = 'horizontal',
  highlightLow = true,
  closed = false,
  tooltipText,
  onClick,
  className,
  testId,
}: WallCounterProps) {
  // Calculate percentage
  const percentage = useMemo(() => {
    return Math.round((remaining / total) * 100);
  }, [remaining, total]);

  // Determine wall state
  const wallState = useMemo(() => {
    if (closed) return 'closed';
    if (remaining === 0) return 'empty';
    if (remaining < 20 && highlightLow) return 'low';
    if (remaining === total) return 'full';
    return 'active';
  }, [remaining, total, closed, highlightLow]);

  // Generate ARIA label
  const ariaLabel = useMemo(() => {
    if (closed) return `Wall is closed - ${remaining} tiles remaining`;
    if (remaining === 0) return 'Wall exhausted - game is a draw';
    if (wallState === 'low') return `Warning: only ${remaining} tiles remaining in wall`;
    return `${remaining} tiles remaining in wall`;
  }, [remaining, closed, wallState]);

  // Auto-generate tooltip if not provided
  const autoTooltip = useMemo(() => {
    if (tooltipText) return tooltipText;
    if (closed) return 'Wall is closed - no more draws';
    if (wallState === 'low') return `Wall is running low! ${remaining} tiles left.`;
    return `${remaining} of ${total} tiles remaining`;
  }, [tooltipText, closed, wallState, remaining, total]);

  // Icon selection
  const icon = wallState === 'closed' ? '🔒' : wallState === 'empty' ? '📭' : '🀫';

  // Click handler
  const handleClick = () => {
    if (onClick) onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      handleClick();
    }
  };

  const counterClasses = classNames(
    styles.counter,
    styles[`counter-${size}`],
    styles[`counter-${orientation}`],
    styles[`counter-${wallState}`],
    {
      [styles['counter-clickable']]: !!onClick,
    },
    className
  );

  const content = (
    <div
      role={onClick ? 'button' : 'status'}
      aria-live="polite"
      aria-label={ariaLabel}
      aria-atomic="true"
      tabIndex={onClick ? 0 : undefined}
      className={counterClasses}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      data-testid={testId}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.content}>
        {showPercentage ? (
          <>
            <span className={styles.percentage}>{percentage}%</span>
            <span className={styles.label}>({remaining} tiles)</span>
          </>
        ) : (
          <>
            <span className={styles.count}>{remaining}</span>
            <span className={styles.label}>tiles</span>
          </>
        )}
      </div>
    </div>
  );

  return <Tooltip text={autoTooltip}>{content}</Tooltip>;
}
```

### Performance Optimization

```tsx
export const WallCounter = React.memo(WallCounterComponent, (prevProps, nextProps) => {
  return prevProps.remaining === nextProps.remaining && prevProps.closed === nextProps.closed;
});
```

## 11. CSS Module (WallCounter.module.css)

```css
.counter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--counter-bg);
  border: 1px solid var(--counter-border);
  border-radius: var(--radius-md);
  font-family: var(--counter-font);
  font-weight: var(--counter-font-weight);
  color: var(--counter-text);
  transition:
    background-color 200ms ease,
    border-color 200ms ease,
    transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  user-select: none;
}

/* Clickable */
.counter-clickable {
  cursor: pointer;
}

.counter-clickable:hover {
  background: hsl(0, 0%, 95%);
  border-color: var(--wall-active);
}

.counter-clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Size variants */
.counter-small {
  font-size: var(--counter-font-size-small);
  padding: var(--space-1);
}

.counter-small .icon {
  font-size: 16px;
}

.counter-medium {
  font-size: var(--counter-font-size-medium);
  padding: var(--space-2);
}

.counter-medium .icon {
  font-size: 24px;
}

.counter-large {
  font-size: var(--counter-font-size-large);
  padding: var(--space-3);
}

.counter-large .icon {
  font-size: 32px;
}

/* Orientation */
.counter-horizontal {
  flex-direction: row;
}

.counter-horizontal .content {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.counter-vertical {
  flex-direction: column;
  text-align: center;
}

.counter-vertical .content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Wall states */
.counter-full {
  border-color: var(--wall-full);
  color: var(--wall-full);
}

.counter-active {
  border-color: var(--wall-active);
  color: var(--wall-active);
}

.counter-low {
  border-color: var(--wall-low);
  color: var(--wall-low);
  animation: pulse-glow 2s ease-in-out infinite;
}

.counter-closed {
  border-color: var(--wall-closed);
  color: var(--wall-closed);
  background: hsl(0, 70%, 97%);
}

.counter-empty {
  border-color: var(--wall-empty);
  color: var(--wall-empty);
  background: hsl(0, 70%, 95%);
}

/* Content elements */
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.count,
.percentage {
  font-weight: 700;
  line-height: 1;
}

.label {
  font-family: var(--counter-label-font);
  font-size: var(--counter-label-size-medium);
  font-weight: 400;
  color: var(--counter-text-light);
}

.counter-small .label {
  font-size: var(--counter-label-size-small);
}

.counter-large .label {
  font-size: var(--counter-label-size-large);
}

/* Update animation */
.count-updating {
  animation: count-change 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes count-change {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

/* Pulse glow for low wall */
@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 rgba(245, 158, 11, 0);
  }
  50% {
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .counter,
  .counter-low,
  .count-updating {
    animation: none;
    transition: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .counter {
    min-width: unset;
  }

  .counter-clickable {
    /* Larger tap target */
    min-width: 44px;
    min-height: 44px;
  }

  /* Hide label on small screens */
  .counter-small .label {
    display: none;
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

### Related Components

- `<Tooltip>`: For displaying hover/focus tooltips
- `<WallClosureIndicator>`: Separate component for explicit closure notice
- `<Wall>`: Parent component managing wall state

---

**Status**: Draft  
**Last Updated**: 2026-01-31  
**Related Specs**: `Wall.md`, `WallClosureIndicator.md`, `GameBoard.md`
