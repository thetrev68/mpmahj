# Button Component Specification

## Component Type

**Presentational Component**

## Purpose

Renders interactive buttons with consistent styling, states, and accessibility across the application.

## Related User Stories

- US-001: Roll Dice to Break Wall (roll button)
- US-002: Automatic Game Start (ready button)
- US-004: Tile Selection (confirm/cancel buttons)
- US-007: Declare Win Intent (mahjong button)
- US-020: Join Game Room (join/leave buttons)
- All user stories with interactive actions

## TypeScript Interface

```typescript
export interface ButtonProps {
  /** Button text or React node content */
  children: React.ReactNode;

  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Disabled state */
  disabled?: boolean;

  /** Loading state with spinner */
  isLoading?: boolean;

  /** Full width button */
  fullWidth?: boolean;

  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';

  /** Icon before text */
  iconBefore?: React.ReactNode;

  /** Icon after text */
  iconAfter?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /** ARIA label (auto-generated from children if not provided) */
  ariaLabel?: string;

  /** Test ID for automated testing */
  testId?: string;
}
```

## State Management

**Stateless** - All state managed by parent components. Internal focus/hover states handled by CSS.

## Visual Design

### Size Variants

- **small**: 32px height, 0.875rem font, 0.5rem×1rem padding (compact UI)
- **medium**: 40px height, 1rem font, 0.75rem×1.5rem padding (default)
- **large**: 48px height, 1.125rem font, 1rem×2rem padding (primary CTAs)

### Variant Styles

#### Primary

- Background: `var(--color-primary)` (#2563eb)
- Hover: `var(--color-primary-hover)` (#1d4ed8)
- Text: White (#ffffff)
- Shadow: `var(--shadow-sm)` on hover
- Use for: Main actions, CTAs, confirmations

#### Secondary

- Background: Transparent
- Border: 2px solid `var(--color-primary)`
- Text: `var(--color-primary)`
- Hover: Background `var(--color-primary-light)`
- Use for: Alternative actions, cancel

#### Danger

- Background: `var(--color-error)` (#ef4444)
- Hover: Darker red (#dc2626)
- Text: White
- Use for: Destructive actions, abandon game

#### Ghost

- Background: Transparent
- Border: None
- Text: `var(--color-text-secondary)`
- Hover: Background `var(--color-surface)`
- Use for: Tertiary actions, inline actions

#### Outline

- Background: Transparent
- Border: 1px solid `var(--color-border)`
- Text: `var(--color-text-primary)`
- Hover: Border `var(--color-primary)`, text `var(--color-primary)`
- Use for: Neutral actions, settings

### Display States

1. **Default**: Base styles as defined by variant
2. **Hover**:
   - Transform: `translateY(-1px)`
   - Shadow elevation increase
   - Background color darkens
   - Transition: 150ms ease-out
3. **Active/Pressed**:
   - Transform: `scale(0.98)`
   - No shadow
   - Transition: 100ms ease-out
4. **Focus**:
   - Outline: 2px solid `var(--color-primary)`
   - Outline offset: 2px
   - Visible on keyboard navigation only
5. **Disabled**:
   - Opacity: 0.5
   - Cursor: not-allowed
   - Pointer events: none
   - No hover effects
6. **Loading**:
   - Spinner icon before text
   - Pointer events: none
   - Cursor: wait
   - Text opacity: 0.7

### Visual Effects

- Hover: 150ms ease-out for all properties
- Active: 100ms ease-out scale animation
- Loading spinner: 600ms linear infinite rotation
- Icon transitions: 200ms ease-in-out

## Accessibility

### ARIA Attributes

- `role="button"` (implicit on `<button>` element)
- `aria-label`: Custom label or auto-generated from children
- `aria-disabled={disabled}` when disabled
- `aria-busy={isLoading}` during loading state
- `aria-pressed`: Not used (reserved for toggle buttons)

### Keyboard Support

- `Enter` or `Space`: Activate button
- `Tab`: Focus navigation
- `Escape`: Blur focused button (browser default)

### Screen Reader Announcements

- On focus: Button label and role
- On click: Action feedback (handled by parent component)
- When disabled: "Button name, disabled"
- When loading: "Button name, loading"

### Focus Management

- Visible focus indicator (2px outline, 2px offset)
- Focus-visible only (not on mouse click)
- Tab order follows DOM order
- Can receive focus unless disabled or loading

## Dependencies

### External

- React (`React.ReactNode`, `React.MouseEvent`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Spinner` - Loading spinner component
- `@/styles/button.module.css` - Component styles

### Generated Types

None - uses primitive React types

## Implementation Notes

### Performance Optimizations

1. **CSS-only hover effects**: No JavaScript state for hover
2. **Memoization**: Wrap with `React.memo()` for prop comparison
3. **Event handler optimization**: Use `useCallback` in parent components
4. **Icon rendering**: Only render icon containers when icons provided

### Error Handling

- Missing children: Render empty button with warning in dev mode
- Invalid variant/size: Fall back to 'primary'/'medium' with console warning
- onClick missing: Button still renders but does nothing (valid for forms)

### Responsive Behavior

- Touch targets: Minimum 44×44px on mobile (iOS/Android guidelines)
- Size auto-adjusts: Small screens default to 'medium', never 'large'
- Full-width: Stretches to container width on mobile when `fullWidth={true}`
- Icon spacing: Adjusts based on size variant

## Test Scenarios

### Unit Tests

```typescript
describe('Button', () => {
  it('renders children text correctly', () => {
    // children="Click Me" should display "Click Me"
  });

  it('calls onClick when clicked', () => {
    // onClick handler should fire on click
  });

  it('does not call onClick when disabled', () => {
    // disabled=true should prevent onClick
  });

  it('does not call onClick when loading', () => {
    // isLoading=true should prevent onClick
  });

  it('applies variant class correctly', () => {
    // variant='danger' should apply danger styles
  });

  it('applies size class correctly', () => {
    // size='large' should apply large styles
  });

  it('renders icon before text', () => {
    // iconBefore should render before children
  });

  it('renders icon after text', () => {
    // iconAfter should render after children
  });

  it('shows loading spinner when loading', () => {
    // isLoading=true should render spinner
  });

  it('applies fullWidth class when specified', () => {
    // fullWidth=true should stretch to container
  });

  it('uses correct button type attribute', () => {
    // type='submit' should set attribute
  });

  it('applies custom className', () => {
    // className prop should merge with base classes
  });

  it('sets aria-label correctly', () => {
    // ariaLabel should override auto-generated label
  });

  it('sets aria-disabled when disabled', () => {
    // disabled=true should set aria-disabled="true"
  });

  it('sets aria-busy when loading', () => {
    // isLoading=true should set aria-busy="true"
  });
});
```

### Integration Tests

```typescript
describe('Button Integration', () => {
  it('works in form submission', () => {
    // type='submit' should submit parent form
  });

  it('supports keyboard navigation', () => {
    // Tab focus, Enter/Space activation
  });

  it('prevents double-click during loading', () => {
    // Should not trigger onClick multiple times
  });

  it('works with React Router Link wrapper', () => {
    // Can be wrapped for navigation
  });
});
```

### Visual Regression Tests

- All variant × size combinations (20 screenshots)
- Disabled and loading states for each variant
- Icon positions (before, after, both)
- Focus states (keyboard navigation)
- Hover states on desktop

## Usage Examples

### Basic Usage

```tsx
import { Button } from '@/components/ui/Button';

// Simple primary button
<Button onClick={handleClick}>
  Click Me
</Button>

// Danger button with loading state
<Button
  variant="danger"
  isLoading={isSubmitting}
  onClick={handleDelete}
>
  Delete
</Button>
```

### Game Actions

```tsx
// Roll dice button
<Button
  variant="primary"
  size="large"
  disabled={!canRoll}
  onClick={handleRollDice}
>
  Roll Dice
</Button>

// Declare mahjong button
<Button
  variant="primary"
  size="large"
  disabled={!canDeclareWin}
  onClick={handleDeclareWin}
  iconAfter={<MahjongIcon />}
>
  Mahjong!
</Button>

// Cancel charleston button
<Button
  variant="secondary"
  onClick={handleCancel}
>
  Cancel
</Button>
```

### Form Buttons

```tsx
// Submit form button
<form onSubmit={handleSubmit}>
  <Button
    type="submit"
    variant="primary"
    isLoading={isSubmitting}
    fullWidth
  >
    Join Room
  </Button>
</form>

// Secondary action
<Button
  variant="ghost"
  onClick={onCancel}
>
  Go Back
</Button>
```

### With Icons

```tsx
import { DiceIcon, ChevronRightIcon } from '@/components/icons';

<Button iconBefore={<DiceIcon />} onClick={handleRoll}>
  Roll Dice
</Button>

<Button iconAfter={<ChevronRightIcon />} variant="outline">
  Next
</Button>
```

## Style Guidelines

### CSS Module Structure

```css
.button {
  /* Base styles */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease-out;
  user-select: none;
  white-space: nowrap;
}

/* Size variants */
.button--small {
  height: 2rem;
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
}

.button--medium {
  height: 2.5rem;
  padding: 0 var(--space-6);
  font-size: var(--text-base);
}

.button--large {
  height: 3rem;
  padding: 0 var(--space-8);
  font-size: var(--text-lg);
}

/* Variant styles */
.button--primary {
  background: var(--color-primary);
  color: white;
}

.button--primary:hover:not(:disabled):not(.button--loading) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.button--secondary {
  background: transparent;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
}

.button--danger {
  background: var(--color-error);
  color: white;
}

.button--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.button--outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

/* States */
.button:active:not(:disabled):not(.button--loading) {
  transform: scale(0.98);
  box-shadow: none;
}

.button:disabled,
.button--loading {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button--full-width {
  width: 100%;
}
```

## Future Enhancements

- [ ] Button group component for segmented controls
- [ ] Icon-only button variant (circular)
- [ ] Tooltip support on hover
- [ ] Success animation on completion
- [ ] Haptic feedback on mobile
- [ ] Sound effects for important actions
- [ ] Animation variants (pulse, shake for errors)
- [ ] Theme variants (light/dark mode specific styles)

## Notes

- Prefer semantic HTML `<button>` over `<div role="button">` for accessibility
- Loading state prevents all interactions, not just onClick
- Touch target size automatically adjusts for mobile (minimum 44×44px)
- Works with form submission via `type="submit"`
- Can be styled externally via className for one-off customizations
- Icons should be 16px (small), 20px (medium), 24px (large) to match text
