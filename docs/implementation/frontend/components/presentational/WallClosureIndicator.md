# WallClosureIndicator Component Specification

## 1. Overview

The `<WallClosureIndicator>` component displays a prominent "WALL CLOSED" badge when the wall reaches the closure threshold (14 tiles remaining, reserved for Charleston). This is a critical game state indicator that prevents players from drawing tiles after the wall is depleted beyond recovery, ensuring game rules are enforced visually.

**Component Type**: Presentational  
**Complexity**: Low  
**Related Components**: `<WallCounter>`, `<Wall>`, `<Badge>`

## 2. TypeScript Interface

```typescript
export interface WallClosureIndicatorProps {
  /** Whether the wall is closed */
  closed: boolean;

  /** Number of tiles that triggered closure (usually 14) */
  closureThreshold?: number;

  /** Visual size variant */
  size?: 'small' | 'medium' | 'large';

  /** Display variant (badge vs banner) */
  variant?: 'badge' | 'banner' | 'overlay';

  /** Whether to show explanation text */
  showExplanation?: boolean;

  /** Custom explanation text */
  explanationText?: string;

  /** Whether to animate entrance */
  animated?: boolean;

  /** Callback when indicator is clicked (optional) */
  onClick?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID for component testing */
  testId?: string;
}
```

## 3. Component Behavior

### 3.1 Display Variants

#### Badge (Default)

- Compact rectangular badge
- Red background with white text
- Lock icon + "WALL CLOSED"
- Positioned near wall or center table
- Use: Persistent indicator during gameplay

#### Banner

- Full-width bar across top of game area
- Red/amber gradient background
- Larger text and icon
- Explanation text below main message
- Use: Clear notification when closure first occurs

#### Overlay

- Semi-transparent overlay on wall tiles
- Diagonal red stripe pattern or lock icon
- Prevents interaction with wall
- Use: Visual blocking of closed wall area

### 3.2 Animation States

#### Entrance Animation

When `animated` is true and `closed` transitions from false to true:

1. **Fade + Slide In** (400ms)
   - Badge: Slides in from top, fades in
   - Banner: Drops down from above
   - Overlay: Fades in with scale pulse
2. **Attention Pulse** (600ms)
   - Scale pulse (1.0 → 1.05 → 1.0)
   - Brief glow effect
3. **Settle** (200ms)
   - Returns to normal state
   - Remains visible until game ends

#### Persistent State

After entrance:

- Static display (no continuous animation)
- Subtle shadow/glow to maintain visibility
- No distracting motion

### 3.3 Explanation Text

Default explanation (if `showExplanation` is true):

- "14 tiles reserved for possible Charleston"
- "No more draws from the wall"
- "Game will end in X turns or when someone declares Mahjong"

Custom explanation via `explanationText` prop overrides default.

### 3.4 Accessibility Features

- High contrast (red background, white text)
- Large, bold text
- Icon reinforces text message
- Screen reader announcement when appears
- Focusable if clickable

## 4. Accessibility

### ARIA Attributes

```html
<div
  role="status"
  aria-live="assertive"
  aria-label="Wall closed. No more draws from wall."
  class="wall-closure-indicator"
>
  <span class="icon" aria-hidden="true">🔒</span>
  <span class="text">WALL CLOSED</span>
</div>
```

### Screen Reader Support

Announce immediately when wall closes:

- "Wall closed. No more draws from the wall."
- "14 tiles remaining, reserved for Charleston"

Use `aria-live="assertive"` to interrupt current announcements (critical game state).

### Keyboard Navigation

If clickable (shows more details):

- **Tab**: Focus indicator
- **Space/Enter**: Open wall closure explanation modal
- **Escape**: Dismiss explanation (if modal)

### Focus State

- Blue outline when focused (keyboard navigation)
- Visible focus ring for accessibility

## 5. Usage Examples

### Example 1: Basic Badge

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';

function GameBoard() {
  const wallClosed = true;

  return (
    <div className="game-board">
      <WallClosureIndicator closed={wallClosed} variant="badge" size="medium" />
    </div>
  );
}
```

### Example 2: Banner with Explanation

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';

function WallClosureNotification() {
  const wallClosed = true;

  return (
    <WallClosureIndicator
      closed={wallClosed}
      variant="banner"
      size="large"
      showExplanation={true}
      animated={true}
    />
  );
}
```

### Example 3: Overlay on Wall

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';

function WallDisplay() {
  const wallClosed = true;

  return (
    <div className="wall-container">
      <div className="wall-tiles">{/* Wall tile components */}</div>
      {wallClosed && <WallClosureIndicator closed={wallClosed} variant="overlay" />}
    </div>
  );
}
```

### Example 4: Clickable for Details

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';
import { useState } from 'react';

function InteractiveWallClosure() {
  const [showDetails, setShowDetails] = useState(false);
  const wallClosed = true;

  return (
    <>
      <WallClosureIndicator
        closed={wallClosed}
        variant="badge"
        onClick={() => setShowDetails(true)}
        explanationText="Click for wall closure details"
      />
      {showDetails && <WallClosureModal onClose={() => setShowDetails(false)} />}
    </>
  );
}
```

### Example 5: Custom Explanation

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';

function CustomWallClosure() {
  const wallClosed = true;
  const customText = 'Wall is closed at 14 tiles. Only Mahjong declarations allowed.';

  return (
    <WallClosureIndicator
      closed={wallClosed}
      variant="banner"
      showExplanation={true}
      explanationText={customText}
      closureThreshold={14}
    />
  );
}
```

### Example 6: Animated Entrance

```tsx
import { WallClosureIndicator } from '@/components/presentational/WallClosureIndicator';
import { useState, useEffect } from 'react';

function AnimatedClosure() {
  const [wallClosed, setWallClosed] = useState(false);

  useEffect(() => {
    // Simulate wall closure after 3 seconds
    const timer = setTimeout(() => setWallClosed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <WallClosureIndicator
      closed={wallClosed}
      variant="banner"
      animated={true}
      showExplanation={true}
    />
  );
}
```

## 6. Visual Design

### Color Scheme

```css
/* Closure indicator colors */
--closure-bg: hsl(0, 70%, 50%); /* Red */
--closure-bg-dark: hsl(0, 70%, 40%); /* Darker red */
--closure-text: hsl(0, 0%, 100%); /* White */
--closure-border: hsl(0, 70%, 60%);
--closure-shadow: rgba(220, 38, 38, 0.4);

/* Banner gradient */
--closure-banner-gradient: linear-gradient(135deg, hsl(0, 70%, 50%), hsl(40, 100%, 50%));

/* Overlay pattern */
--closure-overlay-bg: rgba(220, 38, 38, 0.15);
--closure-overlay-stripe: repeating-linear-gradient(
  45deg,
  transparent,
  transparent 10px,
  rgba(220, 38, 38, 0.3) 10px,
  rgba(220, 38, 38, 0.3) 20px
);
```

### Typography

```css
--closure-font: 'Roboto', sans-serif;
--closure-font-weight: 700; /* Bold */
--closure-font-size-small: 12px;
--closure-font-size-medium: 16px;
--closure-font-size-large: 24px;

--closure-explanation-font-size: 12px;
--closure-explanation-font-weight: 400;
```

### Layout

#### Badge

```text
┌────────────────────────┐
│ 🔒 WALL CLOSED         │
└────────────────────────┘
```

#### Banner

```text
┌───────────────────────────────────────────┐
│          🔒 WALL CLOSED                   │
│ 14 tiles reserved for Charleston          │
└───────────────────────────────────────────┘
```

#### Overlay

```text
┌───────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░ 🔒 WALL CLOSED ░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└───────────────────────────────────────────┘
```

## 7. Responsive Design

### Breakpoints

| Breakpoint | Variant | Size   | Position        | Explanation |
| ---------- | ------- | ------ | --------------- | ----------- |
| Desktop    | Badge   | medium | Top-right       | Optional    |
| Tablet     | Badge   | medium | Top-center      | Optional    |
| Mobile     | Banner  | small  | Top, full-width | Hidden      |

### Mobile Optimizations

- Use banner variant for better visibility on small screens
- Reduce font size for compact display
- Hide explanation text (show only on tap)
- Increase tap target size if clickable (min 44×44px)

## 8. Performance Considerations

### Rendering Optimization

- Use `React.memo` to prevent re-renders unless `closed` changes
- Lazy render: Only mount component when `closed` is true
- Remove from DOM when not needed

### Animation Performance

- Use CSS `transform` and `opacity` for GPU acceleration
- Disable animations if `prefers-reduced-motion: reduce`
- Limit animation to entrance only (no continuous animations)

### Conditional Rendering

```tsx
{closed && <WallClosureIndicator ... />}
```

Only render when wall is actually closed to save resources.

## 9. Testing Requirements

### Unit Tests

```typescript
describe('WallClosureIndicator Component', () => {
  test('renders when closed is true', () => {
    render(<WallClosureIndicator closed={true} />);
    expect(screen.getByText(/wall closed/i)).toBeInTheDocument();
  });

  test('does not render when closed is false', () => {
    render(<WallClosureIndicator closed={false} />);
    expect(screen.queryByText(/wall closed/i)).not.toBeInTheDocument();
  });

  test('displays badge variant by default', () => {
    const { container } = render(<WallClosureIndicator closed={true} />);
    expect(container.querySelector('.closure-badge')).toBeInTheDocument();
  });

  test('displays banner variant when specified', () => {
    const { container } = render(<WallClosureIndicator closed={true} variant="banner" />);
    expect(container.querySelector('.closure-banner')).toBeInTheDocument();
  });

  test('displays overlay variant when specified', () => {
    const { container } = render(<WallClosureIndicator closed={true} variant="overlay" />);
    expect(container.querySelector('.closure-overlay')).toBeInTheDocument();
  });

  test('shows explanation text when showExplanation is true', () => {
    render(<WallClosureIndicator closed={true} showExplanation={true} />);
    expect(screen.getByText(/14 tiles reserved/i)).toBeInTheDocument();
  });

  test('uses custom explanation text when provided', () => {
    render(
      <WallClosureIndicator
        closed={true}
        showExplanation={true}
        explanationText="Custom closure message"
      />
    );
    expect(screen.getByText(/custom closure message/i)).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<WallClosureIndicator closed={true} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  test('is keyboard accessible when onClick provided', () => {
    const handleClick = jest.fn();
    render(<WallClosureIndicator closed={true} onClick={handleClick} />);
    const indicator = screen.getByRole('button');
    fireEvent.keyDown(indicator, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalled();
  });

  test('announces to screen readers when appears', () => {
    render(<WallClosureIndicator closed={true} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'assertive');
    expect(status).toHaveAttribute('aria-label', expect.stringContaining('Wall closed'));
  });

  test('applies correct size classes', () => {
    const { container } = render(<WallClosureIndicator closed={true} size="large" />);
    expect(container.querySelector('.closure-large')).toBeInTheDocument();
  });

  test('animates entrance when animated prop is true', () => {
    const { container } = render(<WallClosureIndicator closed={true} animated={true} />);
    expect(container.querySelector('.closure-animated')).toBeInTheDocument();
  });

  test('respects reduced motion preference', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { container } = render(<WallClosureIndicator closed={true} animated={true} />);
    expect(container.querySelector('.closure-no-animation')).toBeInTheDocument();
  });

  test('displays lock icon', () => {
    render(<WallClosureIndicator closed={true} />);
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('WallClosureIndicator Integration', () => {
  test('appears when wall reaches closure threshold', async () => {
    render(<GameBoard initialWallCount={15} />);
    expect(screen.queryByText(/wall closed/i)).not.toBeInTheDocument();

    // Draw a tile to reach closure threshold (14)
    fireEvent.click(screen.getByRole('button', { name: /draw tile/i }));

    await waitFor(() => expect(screen.getByText(/wall closed/i)).toBeInTheDocument());
  });

  test('prevents further draws when wall is closed', () => {
    render(<GameBoard wallClosed={true} />);
    expect(screen.getByText(/wall closed/i)).toBeInTheDocument();

    const drawButton = screen.queryByRole('button', { name: /draw tile/i });
    expect(drawButton).toBeDisabled();
  });

  test('shows correct closure threshold in explanation', () => {
    render(<WallClosureIndicator closed={true} showExplanation={true} closureThreshold={14} />);
    expect(screen.getByText(/14 tiles reserved/i)).toBeInTheDocument();
  });
});
```

### Visual Regression Tests

```typescript
export default {
  title: 'Components/WallClosureIndicator',
  component: WallClosureIndicator,
};

export const AllVariants = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <WallClosureIndicator closed={true} variant="badge" size="medium" />
    <WallClosureIndicator
      closed={true}
      variant="banner"
      size="large"
      showExplanation={true}
    />
    <div style={{ position: 'relative', width: '400px', height: '200px', background: '#f0f0f0' }}>
      <WallClosureIndicator closed={true} variant="overlay" />
    </div>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
    <WallClosureIndicator closed={true} size="small" />
    <WallClosureIndicator closed={true} size="medium" />
    <WallClosureIndicator closed={true} size="large" />
  </div>
);

export const WithExplanation = () => (
  <WallClosureIndicator
    closed={true}
    variant="banner"
    showExplanation={true}
    explanationText="14 tiles reserved for possible Charleston. No more draws from the wall."
  />
);
```

## 10. Implementation Notes

### Component Structure

```tsx
import React from 'react';
import classNames from 'classnames';
import styles from './WallClosureIndicator.module.css';

export function WallClosureIndicator({
  closed,
  closureThreshold = 14,
  size = 'medium',
  variant = 'badge',
  showExplanation = false,
  explanationText,
  animated = true,
  onClick,
  className,
  testId,
}: WallClosureIndicatorProps) {
  // Don't render if wall not closed
  if (!closed) return null;

  const ariaLabel = `Wall closed. No more draws from wall. ${closureThreshold} tiles remaining.`;

  const defaultExplanation = `${closureThreshold} tiles reserved for possible Charleston. No more draws from the wall.`;

  const explanation = explanationText || defaultExplanation;

  const handleClick = () => {
    if (onClick) onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      handleClick();
    }
  };

  const indicatorClasses = classNames(
    styles.indicator,
    styles[`indicator-${variant}`],
    styles[`indicator-${size}`],
    {
      [styles['indicator-animated']]: animated,
      [styles['indicator-clickable']]: !!onClick,
    },
    className
  );

  return (
    <div
      role={onClick ? 'button' : 'status'}
      aria-live="assertive"
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      className={indicatorClasses}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      data-testid={testId}
    >
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          🔒
        </span>
        <span className={styles.text}>WALL CLOSED</span>
      </div>
      {showExplanation && <div className={styles.explanation}>{explanation}</div>}
    </div>
  );
}
```

### Conditional Rendering

```tsx
// Only render when closed
export function WallClosureIndicator({ closed, ...props }: WallClosureIndicatorProps) {
  if (!closed) return null;
  return <WallClosureIndicatorContent {...props} />;
}
```

## 11. CSS Module (WallClosureIndicator.module.css)

```css
/* Base indicator styles */
.indicator {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--closure-font);
  font-weight: var(--closure-font-weight);
  color: var(--closure-text);
  user-select: none;
}

/* Variant: Badge */
.indicator-badge {
  padding: 8px 16px;
  background: var(--closure-bg);
  border: 2px solid var(--closure-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 8px var(--closure-shadow);
}

.indicator-badge .content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Variant: Banner */
.indicator-banner {
  width: 100%;
  padding: 16px 24px;
  background: var(--closure-banner-gradient);
  box-shadow: 0 2px 8px var(--closure-shadow);
}

.indicator-banner .content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.indicator-banner .explanation {
  margin-top: 8px;
  font-size: var(--closure-explanation-font-size);
  font-weight: var(--closure-explanation-font-weight);
  text-align: center;
  opacity: 0.9;
}

/* Variant: Overlay */
.indicator-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--closure-overlay-bg);
  background-image: var(--closure-overlay-stripe);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.indicator-overlay .content {
  background: var(--closure-bg);
  padding: 16px 32px;
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Size variants */
.indicator-small {
  font-size: var(--closure-font-size-small);
}

.indicator-small .icon {
  font-size: 16px;
}

.indicator-medium {
  font-size: var(--closure-font-size-medium);
}

.indicator-medium .icon {
  font-size: 20px;
}

.indicator-large {
  font-size: var(--closure-font-size-large);
}

.indicator-large .icon {
  font-size: 28px;
}

/* Clickable */
.indicator-clickable {
  cursor: pointer;
  transition: transform 200ms ease;
}

.indicator-clickable:hover {
  transform: scale(1.02);
}

.indicator-clickable:focus-visible {
  outline: 2px solid var(--color-white);
  outline-offset: 2px;
}

/* Animated entrance */
.indicator-animated {
  animation:
    slide-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
    pulse 600ms 400ms ease-out;
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

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

/* Banner specific animation */
.indicator-banner.indicator-animated {
  animation: banner-drop 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes banner-drop {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Overlay specific animation */
.indicator-overlay.indicator-animated {
  animation: overlay-fade 400ms ease-out;
}

@keyframes overlay-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Content elements */
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.text {
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .indicator-animated {
    animation: none;
  }

  .indicator-clickable {
    transition: none;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .indicator-banner {
    padding: 12px 16px;
    font-size: var(--closure-font-size-small);
  }

  .indicator-banner .explanation {
    display: none; /* Hide explanation on small screens */
  }

  .indicator-clickable {
    /* Larger tap target */
    min-height: 44px;
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

- `<WallCounter>`: Shows remaining tile count
- `<Badge>`: Generic badge component (similar visual pattern)
- `<Wall>`: Parent component managing wall state

---

**Status**: Draft  
**Last Updated**: 2026-01-31  
**Related Specs**: `WallCounter.md`, `Wall.md`, `Badge.md`
