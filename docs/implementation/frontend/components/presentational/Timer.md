# Timer Component Specification

## Component Type

Presentational Component

## Purpose

Displays countdown timer for game phases with visual urgency indicators. Manages time remaining for turns, Charleston phases, and call windows.

## Related User Stories

- US-036: Timer Configuration (visible, hidden, disabled modes)
- US-012: Call Window Timer (limited time to declare calls)
- US-016: Charleston Time Limits (phase time limits)
- All timed game actions

## TypeScript Interface

```typescript
export interface TimerProps {
  /** Seconds remaining */
  timeRemaining: number;

  /** Total duration in seconds (for progress calculation) */
  totalDuration: number;

  /** Timer mode */
  mode?: 'visible' | 'hidden' | 'disabled';

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Visual variant */
  variant?: 'default' | 'warning' | 'critical';

  /** Whether timer is actively counting */
  isActive?: boolean;

  /** Show progress ring */
  showProgress?: boolean;

  /** Callback when timer reaches zero */
  onExpire?: () => void;

  /** Label text */
  label?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}
```text

## Internal State

```typescript
interface TimerState {
  /** Last rendered time (for animation smoothness) */
  lastRenderedTime: number;

  /** Whether expiration has been triggered */
  hasExpired: boolean;
}
```text

## State Management

**Internal useState** for animation and expiration tracking. Time managed by parent component.

## Visual Design

### Size Variants

- **small**: 32px diameter, 0.75rem font - Compact displays
- **medium**: 48px diameter, 1rem font - Default
- **large**: 64px diameter, 1.25rem font - Emphasis

### Variant Styles

#### Default

- Text color: `var(--color-text-primary)`
- Progress ring: `var(--color-primary)` (#2563eb)
- Background ring: `var(--color-border)` (#d1d5db)
- Use for: Normal time remaining (>30% of duration)

#### Warning

- Text color: `var(--color-warning)` (#f59e0b)
- Progress ring: `var(--color-warning)`
- Background: Subtle yellow tint
- Use for: Low time (10-30% of duration)

#### Critical

- Text color: `var(--color-error)` (#ef4444)
- Progress ring: `var(--color-error)`
- Background: Subtle red tint, pulsing
- Use for: Very low time (<10% of duration)

### Mode Variants

#### Visible

- Full timer display with time and progress ring
- Updates every second

#### Hidden

- No visual display
- Still triggers onExpire callback
- Used for background timers

#### Disabled

- Shows "∞" or "--:--" (no time limit)
- No countdown
- Gray, non-pulsing display

### Display Format

- **>60s**: "1:23" (minutes:seconds)
- **<60s**: "42" (seconds only, larger font)
- **<10s**: "9" (pulsing, critical variant)
- **0s**: "0" (expired, callback triggered)

### Progress Ring

- **Circular SVG** surrounding time text
- **Stroke**: 4px (small), 6px (medium), 8px (large)
- **Fill**: Decreases clockwise from 12 o'clock
- **Animation**: Smooth 1s transition per second

### Visual Effects

- **Normal countdown**: Smooth progress ring decrease
- **Warning (<30%)**: Slight pulsing (1.5s cycle)
- **Critical (<10%)**: Strong pulsing (1s cycle), shake effect
- **Expired**: Red flash, then static "0"

## Accessibility

### ARIA Attributes

- `role="timer"` for timer container
- `aria-label`: "{label}, {time} remaining" (e.g., "Your turn, 45 seconds remaining")
- `aria-live="assertive"` when critical (<10s)
- `aria-live="polite"` for normal countdown
- `aria-atomic="true"` for complete updates

### Keyboard Support

None - timer is display-only, not interactive

### Screen Reader Announcements

- **Every 10 seconds**: "{time} seconds remaining" (polite)
- **<30 seconds**: Every 10 seconds (polite)
- **<10 seconds**: Every second (assertive)
- **Expired**: "Time expired" (assertive)

### Visual Accessibility

- Color not sole indicator (text changes, pulsing, progress ring)
- High contrast in critical state
- Works without animation (reduced motion)

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/utils/formatTime` - Time formatting (mm:ss)
- `@/styles/timer.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/TimerMode.ts` - TimerMode enum

## Implementation Notes

### Performance Optimizations

1. **RequestAnimationFrame**: Use RAF for smooth progress ring updates
2. **Throttled announcements**: Screen readers don't announce every second
3. **CSS animations**: Pulsing via CSS, not JavaScript
4. **Memoized calculations**: Cache progress percentage

### Automatic Variant Selection

```typescript
const getAutoVariant = (timeRemaining: number, totalDuration: number): TimerVariant => {
  const percentRemaining = (timeRemaining / totalDuration) * 100;

  if (percentRemaining < 10) return 'critical';
  if (percentRemaining < 30) return 'warning';
  return 'default';
};
```text

### Progress Ring SVG

```typescript
const circumference = 2 * Math.PI * radius;
const progress = (timeRemaining / totalDuration) * 100;
const strokeDashoffset = circumference - (progress / 100) * circumference;
```text

### Error Handling

- Negative timeRemaining: Clamp to 0, trigger onExpire
- Invalid totalDuration: Use timeRemaining as fallback
- Mode transitions: Gracefully handle visible ↔ hidden switches
- onExpire missing: Log warning, continue countdown

### Responsive Behavior

- Mobile: Default to 'small' size
- Tablet/Desktop: 'medium' or 'large' as specified
- Reduced motion: No pulsing, instant progress updates

## Test Scenarios

### Unit Tests

```typescript
describe('Timer', () => {
  it('renders time remaining correctly', () => {
    // timeRemaining=65 should show "1:05"
  });

  it('renders seconds only when under 60', () => {
    // timeRemaining=45 should show "45"
  });

  it('applies size class correctly', () => {
    // size='large' should apply large styles
  });

  it('selects variant based on percentage', () => {
    // <10% should use critical variant
  });

  it('shows progress ring when enabled', () => {
    // showProgress=true should render SVG ring
  });

  it('calls onExpire when reaching zero', () => {
    // timeRemaining=0 should trigger callback
  });

  it('hides when mode is hidden', () => {
    // mode='hidden' should not render
  });

  it('shows disabled state', () => {
    // mode='disabled' should show "∞"
  });

  it('updates aria-live when critical', () => {
    // <10s should use aria-live="assertive"
  });

  it('pulses in critical state', () => {
    // variant='critical' should add pulse animation
  });
});
```text

### Integration Tests

```typescript
describe('Timer Integration', () => {
  it('counts down smoothly', () => {
    // Progress ring should update every second
  });

  it('transitions between variants', () => {
    // Should smoothly transition warning → critical
  });

  it('respects reduced motion preference', () => {
    // Should disable pulsing and smoothing
  });

  it('announces to screen readers appropriately', () => {
    // Should throttle announcements correctly
  });
});
```text

### Visual Regression Tests

- All size variants
- All variant states (default, warning, critical)
- Progress ring at different percentages
- Pulsing animations
- Disabled mode display

## Usage Examples

### Turn Timer

```tsx
import { Timer } from '@/components/game/Timer';

function TurnTimer({ timeRemaining, onExpire }) {
  return (
    <Timer
      timeRemaining={timeRemaining}
      totalDuration={60}
      mode="visible"
      size="medium"
      showProgress
      onExpire={onExpire}
      label="Your turn"
    />
  );
}
```text

### Call Window Timer

```tsx
function CallWindowTimer({ timeRemaining, isActive }) {
  return (
    <Timer
      timeRemaining={timeRemaining}
      totalDuration={10}
      size="small"
      showProgress
      isActive={isActive}
      label="Call window"
    />
  );
}
```text

### Charleston Phase Timer

```tsx
function CharlestonTimer({ timeRemaining, mode }) {
  return (
    <Timer
      timeRemaining={timeRemaining}
      totalDuration={90}
      mode={mode} // visible, hidden, or disabled
      size="large"
      showProgress
      label="Charleston phase"
    />
  );
}
```text

### Compact Display

```tsx
function CompactTimer({ timeRemaining }) {
  return (
    <Timer timeRemaining={timeRemaining} totalDuration={30} size="small" showProgress={false} />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-family: var(--font-mono);
  font-weight: var(--font-bold);
}

/* Size variants */
.timer--small {
  width: 2rem;
  height: 2rem;
  font-size: var(--text-sm);
}

.timer--medium {
  width: 3rem;
  height: 3rem;
  font-size: var(--text-base);
}

.timer--large {
  width: 4rem;
  height: 4rem;
  font-size: var(--text-xl);
}

/* Variant colors */
.timer--default {
  color: var(--color-text-primary);
}

.timer--warning {
  color: var(--color-warning);
  animation: pulse-warning 1.5s ease-in-out infinite;
}

.timer--critical {
  color: var(--color-error);
  animation: pulse-critical 1s ease-in-out infinite;
}

/* Progress ring */
.timer__ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer__ring-background {
  fill: none;
  stroke: var(--color-border);
}

.timer__ring-progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer--warning .timer__ring-progress {
  stroke: var(--color-warning);
}

.timer--critical .timer__ring-progress {
  stroke: var(--color-error);
}

/* Time text */
.timer__text {
  position: relative;
  z-index: 1;
  line-height: 1;
}

/* Label */
.timer__label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  font-family: var(--font-sans);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

/* Animations */
@keyframes pulse-warning {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

@keyframes pulse-critical {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Disabled state */
.timer--disabled {
  color: var(--color-text-disabled);
  opacity: 0.6;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .timer__ring-progress {
    transition: none;
  }

  .timer--warning,
  .timer--critical {
    animation: none;
  }
}
```text

## Future Enhancements

- [ ] Pause/resume timer support
- [ ] Time adjustment controls (+/- buttons)
- [ ] Sound effect at expiration
- [ ] Haptic feedback on mobile
- [ ] Confetti animation on timer completion (for positive events)
- [ ] Custom color schemes per timer type
- [ ] Overtime indicator (negative time)
- [ ] Multiple timer segments (phase 1, phase 2, etc.)

## Notes

- Timer mode 'hidden' still functional (triggers callbacks) but not visible
- Auto-variant selection based on percentage remaining
- Progress ring animates smoothly between seconds
- Critical state uses assertive announcements for accessibility
- Monospace font ensures consistent width during countdown
- Pulsing disabled for users with motion sensitivity
- onExpire callback should be memoized by parent to avoid re-renders
- Screen reader announcements throttled to avoid overwhelming users
- Works in both light and dark themes via CSS custom properties
