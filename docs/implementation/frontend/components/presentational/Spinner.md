# Spinner Component Specification

## Component Type

Presentational Component

## Purpose

Displays animated loading indicators for async operations, data fetching, and processing states.

## Related User Stories

- US-002: Automatic Game Start (initial loading)
- US-020: Join Game Room (loading room data)
- US-028: Hand Analysis Display (calculating analysis)
- US-030: Game History Replay (loading history)
- All async operations requiring visual feedback

## TypeScript Interface

```typescript
export interface SpinnerProps {
  /** Size variant */
  size?: 'small' | 'medium' | 'large' | 'xlarge';

  /** Color variant */
  variant?: 'primary' | 'secondary' | 'white' | 'current';

  /** Loading message text */
  label?: string;

  /** Whether to center spinner in container */
  centered?: boolean;

  /** Whether to show full-page overlay */
  fullPage?: boolean;

  /** Animation speed */
  speed?: 'slow' | 'normal' | 'fast';

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}
```

## State Management

**Stateless** - Pure CSS animation, no internal state.

## Visual Design

### Size Variants

- **small**: 16px diameter - Inline loading, button spinners
- **medium**: 24px diameter - Default, cards, panels
- **large**: 40px diameter - Page sections
- **xlarge**: 64px diameter - Full-page loading

### Color Variants

- **primary**: `var(--color-primary)` (#2563eb) - Default
- **secondary**: `var(--color-secondary)` (#7c3aed) - Alternative
- **white**: #ffffff - Dark backgrounds, buttons
- **current**: currentColor - Inherits text color

### Animation Styles

#### Spinner Type: Circular Border

- Border: 3px solid (size small), 4px (medium/large), 6px (xlarge)
- Border color: Variant color at 20% opacity
- Border-top color: Variant color at 100% (spinning segment)
- Border-radius: 50% (perfect circle)
- Animation: 360° rotation

#### Speed Variants

- **slow**: 1.5s per rotation - Subtle, background loading
- **normal**: 0.8s per rotation - Default, balanced
- **fast**: 0.5s per rotation - Quick operations

### Label Styling

- Position: Below spinner
- Font size: `var(--text-sm)` (14px)
- Color: `var(--color-text-secondary)`
- Margin-top: `var(--space-2)` (8px)
- Text align: Center

### Centered Layout

- Display: Flex column, centered
- Padding: `var(--space-8)` (32px)
- Min-height: 200px (or container height)

### Full-Page Overlay

- Position: Fixed, full viewport
- Background: `rgba(255, 255, 255, 0.9)` with backdrop blur
- Z-index: 9999 (above all content)
- Spinner: Centered vertically and horizontally
- Dims background content

## Accessibility

### ARIA Attributes

- `role="status"` for loading indicator
- `aria-label={label || "Loading"}` for screen readers
- `aria-live="polite"` for dynamic updates
- `aria-busy="true"` on parent container

### Screen Reader Announcements

- On appearance: "Loading" or custom label
- On completion: Parent component announces result
- No continuous announcements (aria-live="polite")

### Visual Accessibility

- Minimum 3:1 contrast ratio with background
- Works without animation (respects `prefers-reduced-motion`)
- Focus not trapped by spinner (background still accessible)

## Dependencies

### External

- React
- `clsx` for conditional class names

### Internal

- `@/styles/spinner.module.css` - Component styles

### Generated Types

None - uses primitive React types

## Implementation Notes

### Performance Optimizations

1. **CSS animations**: Use GPU-accelerated `transform: rotate()`
2. **Will-change**: Apply `will-change: transform` for smooth rotation
3. **No JavaScript**: Pure CSS animation, no RAF
4. **Minimal DOM**: Single div with pseudo-element for spinner

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    /* Show pulsing opacity instead */
    animation: pulse 2s ease-in-out infinite;
  }
}
```

### Error Handling

- Invalid size: Fall back to 'medium'
- Invalid variant: Fall back to 'primary'
- Missing label: Use default aria-label "Loading"

### Responsive Behavior

- Mobile: Reduce xlarge to large on small screens
- Touch devices: No special handling (spinner is visual only)
- High DPI: Spinner scales automatically (CSS-based)

## Test Scenarios

### Unit Tests

```typescript
describe('Spinner', () => {
  it('renders with default props', () => {
    // Should render medium primary spinner
  });

  it('applies size class correctly', () => {
    // size='large' should apply large diameter
  });

  it('applies variant color correctly', () => {
    // variant='white' should use white color
  });

  it('renders label text', () => {
    // label="Loading data" should display text
  });

  it('centers spinner when centered=true', () => {
    // Should apply centering styles
  });

  it('renders full-page overlay', () => {
    // fullPage=true should render fixed overlay
  });

  it('applies speed class', () => {
    // speed='fast' should use 0.5s animation
  });

  it('sets correct aria-label', () => {
    // label or default should set aria-label
  });

  it('sets role="status"', () => {
    // Should have status role
  });
});
```

### Integration Tests

```typescript
describe('Spinner Integration', () => {
  it('respects prefers-reduced-motion', () => {
    // Should show alternative animation
  });

  it('works in button loading state', () => {
    // Small spinner in button
  });

  it('overlays content when full-page', () => {
    // Background should be dimmed
  });
});
```

### Visual Regression Tests

- All size variants
- All color variants
- With and without label
- Centered and inline layouts
- Full-page overlay
- Animation frames (start, mid, end)

## Usage Examples

### Inline Loading

```tsx
import { Spinner } from '@/components/ui/Spinner';

function LoadingText() {
  return (
    <div className="flex items-center gap-2">
      <Spinner size="small" variant="current" />
      <span>Loading...</span>
    </div>
  );
}
```

### Button Loading State

```tsx
<Button isLoading disabled>
  <Spinner size="small" variant="white" />
  <span>Submitting...</span>
</Button>
```

### Card Loading

```tsx
function LoadingCard() {
  return (
    <Card>
      <Spinner size="medium" label="Loading game data..." centered />
    </Card>
  );
}
```

### Full-Page Loading

```tsx
function AppLoader({ isLoading }) {
  if (!isLoading) return null;

  return <Spinner size="xlarge" label="Loading application..." fullPage />;
}
```

### Section Loading

```tsx
function HandAnalysis({ analysis, isLoading }) {
  if (isLoading) {
    return <Spinner size="large" label="Analyzing hand..." centered />;
  }

  return <div>{/* Analysis content */}</div>;
}
```

### Custom Color

```tsx
<Spinner size="medium" variant="secondary" label="Processing..." />
```

## Style Guidelines

### CSS Module Structure

```css
.spinner-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.spinner-container--centered {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: var(--space-8);
}

.spinner-container--full-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.spinner {
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
  animation: spin 0.8s linear infinite;
  will-change: transform;
}

/* Size variants */
.spinner--small {
  width: 1rem;
  height: 1rem;
  border-width: 3px;
}

.spinner--medium {
  width: 1.5rem;
  height: 1.5rem;
  border-width: 4px;
}

.spinner--large {
  width: 2.5rem;
  height: 2.5rem;
  border-width: 4px;
}

.spinner--xlarge {
  width: 4rem;
  height: 4rem;
  border-width: 6px;
}

/* Color variants */
.spinner--primary {
  border-color: rgba(37, 99, 235, 0.2);
  border-top-color: var(--color-primary);
}

.spinner--secondary {
  border-color: rgba(124, 58, 237, 0.2);
  border-top-color: var(--color-secondary);
}

.spinner--white {
  border-color: rgba(255, 255, 255, 0.2);
  border-top-color: #ffffff;
}

.spinner--current {
  border-color: rgba(currentColor, 0.2);
  border-top-color: currentColor;
}

/* Speed variants */
.spinner--slow {
  animation-duration: 1.5s;
}

.spinner--normal {
  animation-duration: 0.8s;
}

.spinner--fast {
  animation-duration: 0.5s;
}

/* Rotation animation */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Label */
.spinner__label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: center;
  margin-top: var(--space-2);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
}
```

## Future Enhancements

- [ ] Dots animation variant (three bouncing dots)
- [ ] Bar/skeleton loader variant
- [ ] Progress ring with percentage
- [ ] Custom SVG spinner shapes
- [ ] Determinate progress (0-100%)
- [ ] Color gradient animation
- [ ] Particle effect spinner
- [ ] Theme-aware variants

## Notes

- Spinner is purely presentational - parent manages loading state
- Use aria-busy on parent container, not spinner itself
- Full-page spinner should be used sparingly (major transitions only)
- For long operations, consider showing progress percentage
- White variant essential for loading buttons with colored backgrounds
- Reduced motion users see pulsing opacity instead of rotation
- Current color variant inherits from parent for flexibility
- Label improves accessibility and user understanding of what's loading

```text

```
