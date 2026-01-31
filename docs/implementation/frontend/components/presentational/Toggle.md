# Toggle Component Specification

## Component Type

Presentational Component

## Purpose

Binary switch component for toggling settings and preferences on/off. Provides visual feedback and accessibility for boolean configuration options.

## Related User Stories

- US-036: Game Settings (sound effects, animations, hints)
- US-037: Accessibility Settings (screen reader mode, reduced motion)
- US-038: Room Settings (private room, allow spectators, fill with bots)
- US-035: Keyboard Shortcuts (enable/disable shortcuts)

## TypeScript Interface

```typescript
export interface ToggleProps {
  /** Whether toggle is on */
  checked: boolean;

  /** Change handler */
  onChange: (checked: boolean) => void;

  /** Toggle label */
  label?: string;

  /** Helper text below toggle */
  helperText?: string;

  /** Error message (shows error state) */
  error?: string;

  /** Whether toggle is disabled */
  disabled?: boolean;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Color variant */
  color?: 'primary' | 'success' | 'warning' | 'error';

  /** Show icons in toggle */
  showIcons?: boolean;

  /** Position of label */
  labelPosition?: 'left' | 'right';

  /** Loading state (async toggle) */
  loading?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;

  /** Name attribute (for forms) */
  name?: string;
}
```

## Internal State

```typescript
interface ToggleState {
  /** Focus state */
  isFocused: boolean;
}
```

## State Management

**Internal useState** for focus state. Checked state managed by parent component (controlled).

## Visual Design

### Size Variants

- **small**: 32px × 18px track, 14px thumb
- **medium**: 44px × 24px track, 20px thumb (default)
- **large**: 56px × 30px track, 26px thumb

### Toggle States

#### Off (Unchecked)

- **Track background**: `var(--color-border)` (#d1d5db)
- **Thumb**: White, left position
- **Thumb shadow**: `var(--shadow-sm)`

#### On (Checked)

- **Track background**: Color variant (primary by default)
- **Thumb**: White, right position
- **Thumb shadow**: `var(--shadow-md)`

#### Focused

- **Box shadow**: `var(--shadow-focus)` (0 0 0 3px color with 0.1 opacity)
- **Outline**: none

#### Disabled

- **Track background**: `var(--color-background-secondary)` (#f3f4f6)
- **Thumb**: `var(--color-border)`
- **Cursor**: not-allowed
- **Opacity**: 0.6

#### Loading

- **Spinner**: Small spinner in thumb position
- **Track**: Pulsing animation
- **Interaction**: Disabled during loading

#### Error

- **Track border**: 2px solid `var(--color-error)` (#ef4444)
- **Error text**: `var(--color-error)`, `var(--text-sm)`

### Color Variants

- **primary**: `var(--color-primary)` (#2563eb) - Blue
- **success**: `var(--color-success)` (#10b981) - Green
- **warning**: `var(--color-warning)` (#f59e0b) - Amber
- **error**: `var(--color-error)` (#ef4444) - Red

### Toggle Animation

- **Transition**: 200ms ease-in-out
- **Thumb movement**: Smooth slide from left to right
- **Color change**: Gradual fade
- **Spring effect**: Slight overshoot (optional)

### Icons (When showIcons=true)

- **On icon**: Checkmark (✓), positioned in left side of track
- **Off icon**: X (✗), positioned in right side of track
- **Size**: 12px (small), 14px (medium), 16px (large)
- **Color**: White with 0.8 opacity

### Label Styling

- **Font size**: Matches size variant
- **Font weight**: `var(--font-medium)` (500)
- **Color**: `var(--color-text-primary)`
- **Position**: Left or right of toggle
- **Cursor**: pointer (clickable)

### Helper Text

- **Font size**: `var(--text-xs)` (0.75rem)
- **Color**: `var(--color-text-secondary)` (#6b7280)
- **Margin**: `var(--space-1)` (4px) below toggle

## Accessibility

### ARIA Attributes

- `role="switch"` on toggle element
- `aria-checked`: "true" or "false"
- `aria-label` or label element with `htmlFor`
- `aria-disabled="true"` when disabled
- `aria-invalid="true"` when error present
- `aria-describedby` linking to helperText/error
- `aria-busy="true"` when loading

### Keyboard Support

- **Space**: Toggle switch
- **Enter**: Toggle switch (optional)
- **Tab**: Focus toggle
- **Shift + Tab**: Focus previous element

### Screen Reader Support

- Label announced before toggle
- State announced: "on" or "off"
- Disabled state announced
- Loading state announced: "Loading, please wait"
- Error message announced on change (aria-live="polite")
- Helper text announced after toggle description

### Visual Accessibility

- Focus visible (ring, not just color)
- On/off state not indicated by color alone (position + optional icons)
- High contrast in all states (WCAG AA)
- Touch target min 44px

## Dependencies

### External

- React (hooks: `useState`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Spinner` - Loading indicator
- `@/components/icons/CheckIcon` - On icon
- `@/components/icons/XIcon` - Off icon
- `@/styles/toggle.module.css` - Component styles

### Generated Types

None - uses standard HTML input types

## Implementation Notes

### Controlled Component Pattern

```typescript
// Parent manages checked state
const [soundEnabled, setSoundEnabled] = useState(true);

<Toggle
  checked={soundEnabled}
  onChange={setSoundEnabled}
  label="Sound Effects"
/>
```

### Async Toggle (with Loading State)

```typescript
const [enabled, setEnabled] = useState(false);
const [loading, setLoading] = useState(false);

const handleChange = async (checked: boolean) => {
  setLoading(true);
  try {
    await saveSettingToServer('hints', checked);
    setEnabled(checked);
  } catch (error) {
    // Revert on error
    showError('Failed to save setting');
  } finally {
    setLoading(false);
  }
};

<Toggle
  checked={enabled}
  onChange={handleChange}
  loading={loading}
  label="Show Hints"
/>
```

### Smooth Animation with CSS

```css
.toggle__thumb {
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle__track {
  transition: background-color 200ms ease-in-out;
}

/* Optional spring effect */
@media (prefers-reduced-motion: no-preference) {
  .toggle__thumb {
    transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}
```

### Icon Rendering

```typescript
const renderIcons = () => {
  if (!showIcons) return null;

  return (
    <>
      <CheckIcon className="toggle__icon toggle__icon--on" />
      <XIcon className="toggle__icon toggle__icon--off" />
    </>
  );
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('Toggle', () => {
  it('renders label correctly', () => {
    // label prop should render label element
  });

  it('toggles on click', () => {
    // onChange should be called with opposite value
  });

  it('toggles on Space key', () => {
    // Space should toggle switch
  });

  it('shows checked state', () => {
    // checked=true should position thumb right
  });

  it('disables when disabled', () => {
    // disabled=true should make toggle non-interactive
  });

  it('shows loading state', () => {
    // loading=true should show spinner
  });

  it('shows error state', () => {
    // error prop should apply error styles
  });

  it('applies size class', () => {
    // size prop should apply correct sizing
  });

  it('applies color variant', () => {
    // color='success' should use success color
  });

  it('displays helper text', () => {
    // helperText should render below toggle
  });

  it('positions label correctly', () => {
    // labelPosition='left' should place label left
  });

  it('shows icons when enabled', () => {
    // showIcons should render check/x icons
  });
});
```

### Integration Tests

```typescript
describe('Toggle Integration', () => {
  it('integrates with form validation', () => {
    // Toggle in form should participate in validation
  });

  it('handles async changes', () => {
    // Loading state should prevent multiple toggles
  });

  it('announces changes to screen readers', () => {
    // aria-live should announce state changes
  });
});
```

### Visual Regression Tests

- All size variants
- All color variants
- All states (unchecked, checked, focused, disabled, loading, error)
- With and without label
- With helper text
- With icons
- Label positions (left, right)

## Usage Examples

### Basic Toggle

```tsx
import { Toggle } from '@/components/forms/Toggle';

function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  return <Toggle checked={enabled} onChange={setEnabled} label="Sound Effects" />;
}
```

### With Helper Text

```tsx
function HintsToggle() {
  const [showHints, setShowHints] = useState(false);

  return (
    <Toggle
      checked={showHints}
      onChange={setShowHints}
      label="Show Hints"
      helperText="Display pattern suggestions during gameplay"
    />
  );
}
```

### Color Variants Example

```tsx
function SettingsToggles() {
  return (
    <div>
      <Toggle checked={soundOn} onChange={setSoundOn} label="Sound" color="primary" />

      <Toggle
        checked={animationsOn}
        onChange={setAnimationsOn}
        label="Animations"
        color="success"
      />

      <Toggle checked={debugMode} onChange={setDebugMode} label="Debug Mode" color="warning" />
    </div>
  );
}
```

### Async Toggle with Loading

```tsx
function AsyncToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async (checked: boolean) => {
    setLoading(true);
    try {
      await api.updateSetting('hints', checked);
      setEnabled(checked);
    } catch (error) {
      toast.error('Failed to save setting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Toggle
      checked={enabled}
      onChange={handleChange}
      loading={loading}
      label="AI Hints"
      helperText="Sync with server..."
    />
  );
}
```

### With Icons

```tsx
function IconToggle() {
  return (
    <Toggle
      checked={nightMode}
      onChange={setNightMode}
      label="Dark Mode"
      showIcons
      color="primary"
      size="large"
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.toggle-wrapper {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.toggle-wrapper--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-wrapper--label-left {
  flex-direction: row-reverse;
}

/* Toggle input (hidden) */
.toggle__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* Toggle track */
.toggle__track {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-border);
  transition: background-color 200ms ease-in-out;
}

.toggle__track--small {
  width: 32px;
  height: 18px;
  padding: 2px;
}

.toggle__track--medium {
  width: 44px;
  height: 24px;
  padding: 2px;
}

.toggle__track--large {
  width: 56px;
  height: 30px;
  padding: 2px;
}

/* Checked state */
.toggle__input:checked + .toggle__track {
  background: var(--toggle-color);
}

/* Color variants */
.toggle__track--primary {
  --toggle-color: var(--color-primary);
}

.toggle__track--success {
  --toggle-color: var(--color-success);
}

.toggle__track--warning {
  --toggle-color: var(--color-warning);
}

.toggle__track--error {
  --toggle-color: var(--color-error);
}

/* Focus state */
.toggle__input:focus + .toggle__track {
  box-shadow: var(--shadow-focus);
}

/* Error state */
.toggle__track--error-state {
  border: 2px solid var(--color-error);
}

/* Disabled state */
.toggle__input:disabled + .toggle__track {
  background: var(--color-background-secondary);
  cursor: not-allowed;
}

/* Toggle thumb */
.toggle__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle__track--small .toggle__thumb {
  width: 14px;
  height: 14px;
}

.toggle__track--medium .toggle__thumb {
  width: 20px;
  height: 20px;
}

.toggle__track--large .toggle__thumb {
  width: 26px;
  height: 26px;
}

/* Checked thumb position */
.toggle__input:checked + .toggle__track--small .toggle__thumb {
  transform: translateX(14px);
}

.toggle__input:checked + .toggle__track--medium .toggle__thumb {
  transform: translateX(20px);
}

.toggle__input:checked + .toggle__track--large .toggle__thumb {
  transform: translateX(26px);
}

/* Spring effect (optional) */
@media (prefers-reduced-motion: no-preference) {
  .toggle__thumb {
    transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

/* Icons */
.toggle__icon {
  position: absolute;
  width: 12px;
  height: 12px;
  color: white;
  opacity: 0.8;
  pointer-events: none;
}

.toggle__track--medium .toggle__icon {
  width: 14px;
  height: 14px;
}

.toggle__track--large .toggle__icon {
  width: 16px;
  height: 16px;
}

.toggle__icon--on {
  left: 6px;
  opacity: 0;
  transition: opacity 150ms ease;
}

.toggle__icon--off {
  right: 6px;
  opacity: 0.8;
  transition: opacity 150ms ease;
}

.toggle__input:checked + .toggle__track .toggle__icon--on {
  opacity: 0.8;
}

.toggle__input:checked + .toggle__track .toggle__icon--off {
  opacity: 0;
}

/* Label */
.toggle__label-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
}

.toggle__label {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.toggle-wrapper--small .toggle__label {
  font-size: var(--text-sm);
}

.toggle-wrapper--large .toggle__label {
  font-size: var(--text-lg);
}

.toggle__helper-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.toggle__error-text {
  font-size: var(--text-xs);
  color: var(--color-error);
}

/* Loading state */
.toggle__track--loading {
  pointer-events: none;
}

.toggle__spinner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.toggle__track--loading .toggle__thumb {
  opacity: 0;
}

/* Loading animation */
@keyframes toggle-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.toggle__track--loading {
  animation: toggle-pulse 1.5s ease-in-out infinite;
}

/* Touch target */
@media (hover: none) {
  .toggle-wrapper {
    padding: var(--space-2);
    margin: calc(var(--space-2) * -1);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toggle__thumb,
  .toggle__track,
  .toggle__icon {
    transition: none !important;
  }
}
```

## Future Enhancements

- [ ] Customizable thumb/track colors
- [ ] Gradient backgrounds
- [ ] Custom icons (not just check/x)
- [ ] Sound effects on toggle
- [ ] Haptic feedback (mobile)
- [ ] Multi-state toggle (3+ states)
- [ ] Animated thumb with emoji/icon
- [ ] Toggle groups (radio-style exclusivity)
- [ ] Confirmation prompt for critical toggles
- [ ] Keyboard shortcut assignment

## Notes

- Always use controlled component pattern (checked + onChange)
- Label should be clickable for better UX
- Touch targets should be min 44px on mobile
- Focus ring essential for keyboard navigation
- Loading state prevents accidental double-toggles
- Error messages should be specific and actionable
- Helper text guides users before they make changes
- Disabled toggles cannot be toggled or focused
- Icons improve scannability but not required
- Spring animation adds delight but respect prefers-reduced-motion
- Color variants useful for categorizing settings
- Async toggles common for server-synced settings
- Position thumb with transform (GPU accelerated, smoother)
- Consider accessibility: state must be clear without color
- Toggle better than checkbox for instant on/off actions
- Use checkbox when action requires form submission
- Label position flexibility accommodates different layouts

```

```
