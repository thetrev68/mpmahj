# Badge Component Specification

## Component Type

Presentational Component

## Purpose

Displays small status indicators, counts, or labels with semantic color coding. Used for notifications, player counts, tile counts, and status markers.

## Related User Stories

- US-020: Join Game Room (player count badges)
- US-021: Room Configuration (room status badges)
- US-025: Player Status Indicators (status labels)
- US-030: Game History Replay (move number badges)
- US-036: Timer Configuration (timer mode badges)

## TypeScript Interface

```typescript
export interface BadgeProps {
  /** Badge content (text, number, or icon) */
  children: React.ReactNode;

  /** Semantic variant for color coding */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Badge shape */
  shape?: 'rounded' | 'pill' | 'circle';

  /** Display as notification dot (empty badge) */
  isDot?: boolean;

  /** Show pulsing animation for attention */
  isPulsing?: boolean;

  /** Icon before text */
  iconBefore?: React.ReactNode;

  /** Icon after text */
  iconAfter?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /** ARIA label for accessibility */
  ariaLabel?: string;

  /** Test ID */
  testId?: string;
}
```text

## State Management

**Stateless** - Pure presentational component with no internal state.

## Visual Design

### Size Variants

- **small**: 18px height, 0.75rem font, 0.25rem×0.5rem padding
- **medium**: 22px height, 0.875rem font, 0.375rem×0.75rem padding (default)
- **large**: 28px height, 1rem font, 0.5rem×1rem padding

### Variant Styles

#### Default

- Background: `var(--color-surface)` (#f3f4f6)
- Text: `var(--color-text-secondary)` (#6b7280)
- Border: 1px solid `var(--color-border)` (#d1d5db)
- Use for: Neutral information

#### Primary

- Background: `var(--color-primary-light)` (#dbeafe)
- Text: `var(--color-primary)` (#2563eb)
- Border: None
- Use for: Important information, categories

#### Success

- Background: Light green (#dcfce7)
- Text: `var(--color-success)` (#10b981)
- Border: None
- Use for: Completed, ready, active states

#### Warning

- Background: Light amber (#fef3c7)
- Text: `var(--color-warning)` (#f59e0b)
- Border: None
- Use for: Cautions, pending actions

#### Error

- Background: Light red (#fecaca)
- Text: `var(--color-error)` (#ef4444)
- Border: None
- Use for: Errors, disconnected, critical states

#### Info

- Background: Light blue (#dbeafe)
- Text: `var(--color-info)` (#3b82f6)
- Border: None
- Use for: Information, tips, guidelines

### Shape Variants

- **rounded**: `border-radius: var(--radius-md)` (6px) - Default
- **pill**: `border-radius: var(--radius-full)` (9999px) - Fully rounded
- **circle**: Equal width/height, fully rounded - For counts or icons

### Notification Dot

- When `isDot={true}`:
  - Size: 8px circle (small), 10px (medium), 12px (large)
  - No text content
  - Position: Can be absolutely positioned in parent
  - Use for: Unread indicators, status markers

### Pulsing Animation

- When `isPulsing={true}`:
  - Scale: 1.0 → 1.1 → 1.0
  - Opacity: 1.0 → 0.7 → 1.0
  - Duration: 2s ease-in-out infinite
  - Use for: Active turn, new notifications

### Visual Effects

- Hover: None (badges are non-interactive)
- Animation: Pulse if `isPulsing={true}`
- Icon spacing: 4px gap between icon and text
- No shadow unless explicitly styled externally

## Accessibility

### ARIA Attributes

- `role="status"` for dynamic content badges
- `aria-label`: Descriptive label when content is icon-only or abbreviated
  - Example: "3" → aria-label="3 players"
  - Example: Dot → aria-label="Unread notifications"
- `aria-live="polite"` for count badges that update
- `aria-hidden="true"` for purely decorative badges

### Keyboard Support

None - badges are non-interactive display elements

### Screen Reader Announcements

- Static badges: Read as part of parent element
- Dynamic badges (counts): Announce changes with aria-live
- Icon-only badges: Must have descriptive aria-label

### Focus Management

Not focusable - display-only component

## Dependencies

### External

- React
- `clsx` for conditional class names

### Internal

- `@/styles/badge.module.css` - Component styles

### Generated Types

None - uses primitive React types

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Wrap with `React.memo()` for count badges that rarely change
2. **CSS animations**: Use transform for pulse (GPU-accelerated)
3. **No JavaScript animations**: Pure CSS for all effects
4. **Static rendering**: No state, very lightweight

### Error Handling

- Empty children: Render empty badge (valid for dots)
- Invalid variant: Fall back to 'default'
- Invalid size: Fall back to 'medium'
- Icon rendering: Only render icon containers when icons provided

### Responsive Behavior

- Mobile: Reduce to 'small' size in compact layouts
- No breakpoint-specific behavior
- Always maintains minimum touch target if parent is interactive

## Test Scenarios

### Unit Tests

```typescript
describe('Badge', () => {
  it('renders children text correctly', () => {
    // children="New" should display "New"
  });

  it('renders numeric content', () => {
    // children={5} should display "5"
  });

  it('applies variant class correctly', () => {
    // variant='success' should apply green styling
  });

  it('applies size class correctly', () => {
    // size='large' should apply large styles
  });

  it('applies shape class correctly', () => {
    // shape='pill' should apply pill border-radius
  });

  it('renders as dot when isDot=true', () => {
    // isDot=true should render small circle
  });

  it('applies pulsing animation when isPulsing=true', () => {
    // isPulsing=true should add animation class
  });

  it('renders icon before text', () => {
    // iconBefore should render before children
  });

  it('renders icon after text', () => {
    // iconAfter should render after children
  });

  it('applies custom className', () => {
    // className should merge with base classes
  });

  it('sets aria-label correctly', () => {
    // ariaLabel should set attribute
  });

  it('renders circle shape with equal dimensions', () => {
    // shape='circle' should have equal width/height
  });
});
```text

### Integration Tests

```typescript
describe('Badge Integration', () => {
  it('works with icon components', () => {
    // Should render with icon libraries
  });

  it('updates aria-live when content changes', () => {
    // Dynamic content should announce to screen readers
  });

  it('inherits text color in high contrast mode', () => {
    // Should respect system preferences
  });
});
```text

### Visual Regression Tests

- All variant × size combinations
- All shape variants
- Icon positioning (before, after, both)
- Dot variant in all sizes
- Pulsing animation frames

## Usage Examples

### Player Count Badge

```tsx
import { Badge } from '@/components/ui/Badge';

<Badge variant="primary" shape="pill">
  {playerCount}/4
</Badge>;
```text

### Room Status Badge

```tsx
<Badge variant={room.status === 'open' ? 'success' : 'error'} shape="pill">
  {room.status}
</Badge>
```text

### Turn Indicator

```tsx
<Badge variant="success" isPulsing iconBefore={<ClockIcon />}>
  Your Turn
</Badge>
```text

### Notification Dot Example

```tsx
<div className="relative">
  <PlayerAvatar {...player} />
  <Badge isDot variant="error" className="absolute top-0 right-0" ariaLabel="New activity" />
</div>
```text

### Move Number

```tsx
<Badge variant="info" shape="circle" size="small">
  {moveNumber}
</Badge>
```text

### Timer Mode Indicator

```tsx
<Badge variant={timerMode === 'visible' ? 'primary' : 'default'} iconAfter={<TimerIcon />}>
  {timerMode}
</Badge>
```text

### Tile Count

```tsx
<Badge variant="default" shape="pill" size="small">
  {hand.length} tiles
</Badge>
```text

## Style Guidelines

### CSS Module Structure

```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-weight: var(--font-medium);
  white-space: nowrap;
  line-height: 1;
  vertical-align: middle;
}

/* Size variants */
.badge--small {
  height: 1.125rem;
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
}

.badge--medium {
  height: 1.375rem;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.badge--large {
  height: 1.75rem;
  padding: 0 var(--space-4);
  font-size: var(--text-base);
}

/* Shape variants */
.badge--rounded {
  border-radius: var(--radius-md);
}

.badge--pill {
  border-radius: var(--radius-full);
}

.badge--circle {
  border-radius: 50%;
  aspect-ratio: 1;
  padding: 0;
  width: auto;
}

/* Variant styles */
.badge--default {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.badge--primary {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.badge--success {
  background: #dcfce7;
  color: var(--color-success);
}

.badge--warning {
  background: #fef3c7;
  color: var(--color-warning);
}

.badge--error {
  background: #fecaca;
  color: var(--color-error);
}

.badge--info {
  background: #dbeafe;
  color: var(--color-info);
}

/* Dot variant */
.badge--dot {
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  min-width: 0.5rem;
  border-radius: 50%;
}

.badge--dot.badge--medium {
  width: 0.625rem;
  height: 0.625rem;
}

.badge--dot.badge--large {
  width: 0.75rem;
  height: 0.75rem;
}

/* Pulsing animation */
.badge--pulsing {
  animation: badge-pulse 2s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
}
```text

## Future Enhancements

- [ ] Dismiss button for removable badges
- [ ] Custom color support (via CSS variables)
- [ ] Gradient backgrounds for special badges
- [ ] Stacked badge groups
- [ ] Tooltip on hover for abbreviated content
- [ ] Number abbreviation (1000 → 1K)
- [ ] Icon-only variant optimization
- [ ] Theme variants (light/dark specific)

## Notes

- Badges are display-only, never interactive (use buttons for actions)
- Keep content brief (1-3 words or single number)
- Use semantic variants to convey meaning without color
- Dot badges useful for compact status indicators
- Pulsing should be used sparingly to avoid distraction
- Circle shape ideal for single-digit counts
- Consider aria-label for icon-only or abbreviated badges
