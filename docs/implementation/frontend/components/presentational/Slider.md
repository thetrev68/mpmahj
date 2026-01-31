# Slider Component Specification

## Component Type

Presentational Component

## Purpose

Provides range input control for selecting numeric values along a continuous or discrete scale. Used for settings that have a range of values (volume, speed, delay, etc.).

## Related User Stories

- US-035: Animation Settings (animation speed slider)
- US-036: Timer Configuration (turn timer duration slider)
- US-034: Configure House Rules (scoring multipliers, penalties)

## TypeScript Interface

```typescript
export interface SliderProps {
  /** Current value */
  value: number;

  /** Callback when value changes */
  onChange: (value: number) => void;

  /** Minimum value */
  min?: number;

  /** Maximum value */
  max?: number;

  /** Step increment */
  step?: number;

  /** Slider label */
  label?: string;

  /** Show value label */
  showValue?: boolean;

  /** Value formatter */
  valueFormatter?: (value: number) => string;

  /** Show tick marks */
  showTicks?: boolean;

  /** Tick marks configuration */
  ticks?: SliderTick[];

  /** Disabled state */
  disabled?: boolean;

  /** Slider size */
  size?: 'small' | 'medium' | 'large';

  /** Orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface SliderTick {
  value: number;
  label?: string;
}
```

## Internal State

```typescript
interface SliderState {
  /** Whether slider is being dragged */
  isDragging: boolean;

  /** Temporary display value during drag */
  displayValue: number;
}
```

## State Management

**Controlled component** - value and onChange from parent. Internal state for drag interaction.

## Visual Design

### Slider Anatomy

```text
Animation Speed: 1.5x
├─────●═════════┤
0.5x         2.0x
```

**Components:**

- **Track**: Full-width bar (background)
- **Fill**: Filled portion from min to current value
- **Thumb**: Draggable handle at current value
- **Ticks**: Optional markers at intervals
- **Value label**: Displays current value
- **Min/max labels**: Show range endpoints

### Size Variants

#### Small

- **Track height**: 4px
- **Thumb size**: 16px
- **Total height**: 24px
- **Use for**: Compact settings, inline controls

#### Medium (Default)

- **Track height**: 6px
- **Thumb size**: 20px
- **Total height**: 32px
- **Use for**: Standard settings panels

#### Large

- **Track height**: 8px
- **Thumb size**: 24px
- **Total height**: 40px
- **Use for**: Primary controls, accessibility

### Color Scheme

#### Track

- **Background**: `var(--color-border)` (unfilled)
- **Fill**: `var(--color-primary)` (filled portion)

#### Thumb

- **Background**: `var(--color-background)`
- **Border**: 2px solid `var(--color-primary)`
- **Shadow**: `var(--shadow-sm)`

#### States

- **Hover**: Thumb grows slightly (scale 1.1)
- **Focus**: Outline ring 2px `var(--color-primary)`
- **Active (dragging)**: Thumb scale 1.2, shadow larger
- **Disabled**: Gray colors, opacity 0.6

### Value Display

- **Position**: Above slider (horizontal) or beside (vertical)
- **Format**: Numeric or custom (e.g., "1.5x", "30 sec")
- **Update**: Real-time during drag

### Tick Marks

- **Small dots**: 4px diameter
- **Labeled ticks**: Text below (horizontal) or beside (vertical)
- **Colors**: `var(--color-border)` (inactive), `var(--color-primary)` (filled)

## Accessibility

### ARIA Attributes

- `role="slider"`
- `aria-label` or `aria-labelledby`
- `aria-valuemin`
- `aria-valuemax`
- `aria-valuenow`
- `aria-valuetext` (formatted value)
- `aria-orientation`
- `aria-disabled`

### Keyboard Support

- **Arrow Left/Down**: Decrease by step
- **Arrow Right/Up**: Increase by step
- **Page Down**: Decrease by 10% of range
- **Page Up**: Increase by 10% of range
- **Home**: Set to minimum value
- **End**: Set to maximum value

### Screen Reader Support

- Announce "slider, {label}, {value}, {min} to {max}"
- Announce value changes as user drags
- Announce final value on release

### Visual Accessibility

- High contrast track and thumb
- Focus visible (outline ring)
- Large touch target (44px minimum)
- Value not indicated by color alone

## Dependencies

### External

- React (hooks: `useState`, `useRef`, `useEffect`)
- `clsx` for conditional class names

### Internal

- `@/styles/slider.module.css` - Component styles

## Implementation Notes

### Value Calculation from Position

```typescript
const calculateValueFromPosition = (clientX: number, trackRect: DOMRect): number => {
  const { left, width } = trackRect;
  const percentage = Math.max(0, Math.min(1, (clientX - left) / width));
  const range = max - min;
  const rawValue = min + percentage * range;

  // Snap to step
  const steppedValue = Math.round(rawValue / step) * step;

  return Math.max(min, Math.min(max, steppedValue));
};
```

### Mouse/Touch Drag Handler

```typescript
const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
  if (disabled) return;

  setIsDragging(true);

  const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;

    const newValue = calculateValueFromPosition(clientX, trackRect);
    setDisplayValue(newValue);
    onChange(newValue);
  };

  const handleEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleEnd);
    document.removeEventListener('touchmove', handleMove);
    document.removeEventListener('touchend', handleEnd);
  };

  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', handleEnd);
  document.addEventListener('touchmove', handleMove);
  document.addEventListener('touchend', handleEnd);
};
```

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (disabled) return;

  const range = max - min;
  let newValue = value;

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      e.preventDefault();
      newValue = Math.min(max, value + step);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      e.preventDefault();
      newValue = Math.max(min, value - step);
      break;
    case 'PageUp':
      e.preventDefault();
      newValue = Math.min(max, value + range * 0.1);
      break;
    case 'PageDown':
      e.preventDefault();
      newValue = Math.max(min, value - range * 0.1);
      break;
    case 'Home':
      e.preventDefault();
      newValue = min;
      break;
    case 'End':
      e.preventDefault();
      newValue = max;
      break;
  }

  onChange(Math.round(newValue / step) * step);
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('Slider', () => {
  it('renders with initial value', () => {});
  it('calls onChange when dragged', () => {});
  it('snaps to step increments', () => {});
  it('respects min/max bounds', () => {});
  it('handles keyboard navigation', () => {});
  it('shows value label when showValue=true', () => {});
  it('formats value with custom formatter', () => {});
  it('shows tick marks when showTicks=true', () => {});
  it('applies size variants', () => {});
  it('applies disabled state', () => {});
  it('applies correct ARIA attributes', () => {});
  it('updates aria-valuenow on change', () => {});
});
```

### Integration Tests

```typescript
describe('Slider Integration', () => {
  it('updates when value prop changes', () => {});
  it('handles touch events', () => {});
  it('announces changes to screen readers', () => {});
});
```

### Visual Regression Tests

- All sizes (small, medium, large)
- All states (default, hover, focus, active, disabled)
- With and without value label
- With and without tick marks
- Vertical orientation
- Various value positions (min, max, middle)

## Usage Examples

### Basic Slider

```tsx
import { Slider } from '@/components/ui/Slider';

function AnimationSpeed() {
  const [speed, setSpeed] = useState(1.0);

  return (
    <Slider
      label="Animation Speed"
      value={speed}
      onChange={setSpeed}
      min={0.5}
      max={2.0}
      step={0.1}
      showValue
      valueFormatter={(v) => `${v.toFixed(1)}x`}
    />
  );
}
```

### With Tick Marks

```tsx
function TimerDuration() {
  const [duration, setDuration] = useState(30);

  return (
    <Slider
      label="Turn Timer"
      value={duration}
      onChange={setDuration}
      min={15}
      max={120}
      step={15}
      showTicks
      ticks={[
        { value: 15, label: '15s' },
        { value: 30, label: '30s' },
        { value: 60, label: '1m' },
        { value: 90, label: '1.5m' },
        { value: 120, label: '2m' },
      ]}
      showValue
      valueFormatter={(v) => `${v} seconds`}
    />
  );
}
```

### Large Interactive Slider

```tsx
function VolumeControl() {
  const [volume, setVolume] = useState(50);

  return (
    <Slider
      label="Volume"
      value={volume}
      onChange={setVolume}
      min={0}
      max={100}
      step={1}
      size="large"
      showValue
      valueFormatter={(v) => `${v}%`}
    />
  );
}
```

### Vertical Slider

```tsx
function VerticalControl() {
  const [value, setValue] = useState(50);

  return (
    <Slider
      label="Vertical Slider"
      value={value}
      onChange={setValue}
      min={0}
      max={100}
      orientation="vertical"
      showValue
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.slider {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.slider__label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.slider__value {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
}

.slider__track-container {
  position: relative;
  width: 100%;
  padding: var(--space-2) 0;
}

.slider__track {
  position: relative;
  width: 100%;
  border-radius: var(--radius-full);
  background: var(--color-border);
  cursor: pointer;
}

.slider__track--small {
  height: 4px;
}

.slider__track--medium {
  height: 6px;
}

.slider__track--large {
  height: 8px;
}

.slider__fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.1s ease;
}

.slider__thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-background);
  border: 2px solid var(--color-primary);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  cursor: grab;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.slider__thumb--small {
  width: 16px;
  height: 16px;
}

.slider__thumb--medium {
  width: 20px;
  height: 20px;
}

.slider__thumb--large {
  width: 24px;
  height: 24px;
}

.slider__thumb:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.slider__thumb:active,
.slider__thumb--dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: var(--shadow-md);
}

.slider__thumb:focus {
  outline: none;
}

.slider__thumb:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.slider--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.slider--disabled .slider__track {
  background: var(--color-border-disabled);
  cursor: not-allowed;
}

.slider--disabled .slider__fill {
  background: var(--color-text-disabled);
}

.slider--disabled .slider__thumb {
  border-color: var(--color-text-disabled);
  cursor: not-allowed;
}

/* Ticks */
.slider__ticks {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 0;
  pointer-events: none;
}

.slider__tick {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-border);
}

.slider__tick--filled {
  background: var(--color-primary);
}

.slider__tick-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* Range labels */
.slider__range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Vertical orientation */
.slider--vertical {
  flex-direction: row;
  align-items: center;
}

.slider--vertical .slider__track-container {
  width: auto;
  height: 200px;
  padding: 0 var(--space-2);
}

.slider--vertical .slider__track {
  width: 6px;
  height: 100%;
}

.slider--vertical .slider__fill {
  width: 100%;
  height: auto;
  bottom: 0;
  top: auto;
}

.slider--vertical .slider__thumb {
  left: 50%;
  top: auto;
  transform: translate(-50%, 50%);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .slider__fill,
  .slider__thumb {
    transition: none;
  }
}
```

## Future Enhancements

- [ ] Range slider (two thumbs for min/max)
- [ ] Color picker slider (gradient background)
- [ ] Logarithmic scale
- [ ] Custom thumb shapes/icons
- [ ] Snap points (specific values)
- [ ] Value tooltip on hover
- [ ] Animated value transitions
- [ ] Multi-value slider (multiple thumbs)
- [ ] Step labels (show all step values)
- [ ] Slider grouping (linked sliders)

## Notes

- Slider for continuous numeric ranges
- Number input for precise value entry
- Default to reasonable min/max/step values
- Show value label for user feedback
- Tick marks help visualize scale
- Large touch targets for mobile (44px minimum)
- Keyboard navigation essential
- Smooth dragging experience (no jumps)
- Visual feedback on hover/active
- Consider precision (decimal steps)
- Format values appropriately (%, x, sec, etc.)
- Announce value changes to screen readers
- Disabled state prevents interaction
- Vertical orientation for space-constrained layouts
- Consider logarithmic scale for large ranges (0.1-1000)
- Snap to step values on release
- Real-time updates during drag (not just on release)
- Consider debouncing onChange for performance

```

```
