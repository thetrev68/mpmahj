# Checkbox Component Specification

## Component Type

Presentational Component

## Purpose

Checkbox input with label, indeterminate state, and validation. Supports standalone checkboxes and checkbox groups for multi-selection scenarios.

## Related User Stories

- US-036: Game Settings (enable/disable features)
- US-038: Room Settings (fill empty seats with bots, privacy settings)
- US-035: Keyboard Shortcuts (enable/disable shortcuts)
- Form interactions across all settings

## TypeScript Interface

```typescript
export interface CheckboxProps {
  /** Whether checkbox is checked */
  checked: boolean;

  /** Change handler */
  onChange: (checked: boolean) => void;

  /** Checkbox label */
  label?: string;

  /** Helper text below checkbox */
  helperText?: string;

  /** Error message (shows error state) */
  error?: string;

  /** Whether checkbox is disabled */
  disabled?: boolean;

  /** Whether checkbox is required */
  required?: boolean;

  /** Indeterminate state (for "select all" scenarios) */
  indeterminate?: boolean;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Checkbox value (for checkbox groups) */
  value?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;

  /** Name attribute (for forms) */
  name?: string;
}

export interface CheckboxGroupProps {
  /** Group label */
  label?: string;

  /** Available options */
  options: CheckboxOption[];

  /** Selected values */
  value: string[];

  /** Change handler */
  onChange: (values: string[]) => void;

  /** Layout direction */
  direction?: 'horizontal' | 'vertical';

  /** Whether group is disabled */
  disabled?: boolean;

  /** Error message for group */
  error?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface CheckboxOption {
  /** Option value */
  value: string;

  /** Option label */
  label: string;

  /** Optional helper text */
  helperText?: string;

  /** Whether option is disabled */
  disabled?: boolean;
}
```

## Internal State

```typescript
interface CheckboxState {
  /** Focus state */
  isFocused: boolean;
}
```

## State Management

**Internal useState** for focus state. Checked state managed by parent component (controlled).

## Visual Design

### Size Variants

- **small**: 16px × 16px box, 0.875rem font
- **medium**: 20px × 20px box, 1rem font (default)
- **large**: 24px × 24px box, 1.125rem font

### Checkbox States

#### Unchecked

- **Border**: 2px solid `var(--color-border)` (#d1d5db)
- **Background**: `var(--color-background)` (#ffffff)
- **Border radius**: `var(--radius-sm)` (2px)

#### Checked

- **Border**: 2px solid `var(--color-primary)` (#2563eb)
- **Background**: `var(--color-primary)`
- **Checkmark**: White, centered, animated entrance

#### Indeterminate

- **Border**: 2px solid `var(--color-primary)`
- **Background**: `var(--color-primary)`
- **Dash**: White horizontal line, centered

#### Focused

- **Box shadow**: `var(--shadow-focus)` (0 0 0 3px rgba(37, 99, 235, 0.1))
- **Outline**: none

#### Disabled

- **Border**: `var(--color-border)`
- **Background**: `var(--color-background-secondary)` (#f3f4f6)
- **Checkmark**: `var(--color-text-disabled)` (#9ca3af)
- **Cursor**: not-allowed
- **Opacity**: 0.6

#### Error

- **Border**: 2px solid `var(--color-error)` (#ef4444)
- **Error text**: `var(--color-error)`, `var(--text-sm)`

### Label

- **Font size**: Matches size variant
- **Font weight**: `var(--font-normal)` (400)
- **Color**: `var(--color-text-primary)`
- **Margin**: `var(--space-2)` (8px) left of checkbox
- **Cursor**: pointer (clickable)

### Helper Text

- **Font size**: `var(--text-xs)` (0.75rem)
- **Color**: `var(--color-text-secondary)` (#6b7280)
- **Margin**: `var(--space-1)` (4px) above

### Checkbox Group Layout

#### Vertical (Default)

```text
□ Option 1
□ Option 2
□ Option 3
```

- Stacked vertically
- Gap: `var(--space-3)` (12px)

#### Horizontal

```text
□ Option 1   □ Option 2   □ Option 3
```

- Arranged horizontally
- Gap: `var(--space-4)` (16px)
- Wraps on small screens

## Accessibility

### ARIA Attributes

- `role="checkbox"` on checkbox element
- `aria-checked`: "true", "false", or "mixed" (indeterminate)
- `aria-label` or label element with `htmlFor`
- `aria-disabled="true"` when disabled
- `aria-required="true"` when required
- `aria-invalid="true"` when error present
- `aria-describedby` linking to helperText/error

### Keyboard Support

- **Space**: Toggle checkbox
- **Tab**: Focus checkbox
- **Shift + Tab**: Focus previous element

### Screen Reader Support

- Label announced before checkbox
- State announced: "checked", "unchecked", "mixed"
- Required state announced
- Disabled state announced
- Error message announced on change (aria-live="polite")
- Helper text announced after checkbox description

### Visual Accessibility

- Focus visible (ring, not just color)
- Checked state not indicated by color alone (checkmark icon)
- High contrast in all states (WCAG AA)
- Touch target min 44px (padding around checkbox)

## Dependencies

### External

- React (hooks: `useState`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/icons/CheckIcon` - Checkmark icon
- `@/components/icons/MinusIcon` - Indeterminate dash
- `@/styles/checkbox.module.css` - Component styles

### Generated Types

None - uses standard HTML input types

## Implementation Notes

### Controlled Component Pattern

```typescript
// Parent manages checked state
const [agreed, setAgreed] = useState(false);

<Checkbox
  checked={agreed}
  onChange={setAgreed}
  label="I agree to the terms"
  required
/>
```

### Indeterminate State

```typescript
// Used for "select all" scenarios
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const allItems = ['item1', 'item2', 'item3'];

const allSelected = selectedItems.length === allItems.length;
const someSelected = selectedItems.length > 0 && !allSelected;

<Checkbox
  checked={allSelected}
  indeterminate={someSelected}
  onChange={() => {
    setSelectedItems(allSelected ? [] : allItems);
  }}
  label="Select all"
/>
```

### Checkbox Group Implementation

```typescript
const handleGroupChange = (optionValue: string) => {
  if (value.includes(optionValue)) {
    onChange(value.filter((v) => v !== optionValue));
  } else {
    onChange([...value, optionValue]);
  }
};
```

### Checkmark Animation

```css
/* Checkmark entrance animation */
@keyframes checkmark-enter {
  0% {
    transform: scale(0) rotate(45deg);
  }
  100% {
    transform: scale(1) rotate(45deg);
  }
}
```

## Test Scenarios

### Unit Tests

```typescript
describe('Checkbox', () => {
  it('renders label correctly', () => {
    // label prop should render label element
  });

  it('toggles on click', () => {
    // onChange should be called with opposite value
  });

  it('toggles on Space key', () => {
    // Space should toggle checkbox
  });

  it('shows checked state', () => {
    // checked=true should show checkmark
  });

  it('shows indeterminate state', () => {
    // indeterminate=true should show dash
  });

  it('disables when disabled', () => {
    // disabled=true should make checkbox non-interactive
  });

  it('shows error state', () => {
    // error prop should apply error styles
  });

  it('applies size class', () => {
    // size prop should apply correct sizing
  });

  it('displays helper text', () => {
    // helperText should render below label
  });
});

describe('CheckboxGroup', () => {
  it('renders all options', () => {
    // options array should render correct number of checkboxes
  });

  it('handles multi-selection', () => {
    // onChange should be called with updated array
  });

  it('applies layout direction', () => {
    // direction='horizontal' should arrange horizontally
  });

  it('disables all when group disabled', () => {
    // disabled=true should disable all checkboxes
  });
});
```

### Integration Tests

```typescript
describe('Checkbox Integration', () => {
  it('integrates with form validation', () => {
    // Required checkbox should show error when unchecked
  });

  it('works in checkbox group', () => {
    // Multiple selections should work correctly
  });

  it('announces changes to screen readers', () => {
    // aria-live should announce state changes
  });
});
```

### Visual Regression Tests

- All size variants
- All states (unchecked, checked, indeterminate, focused, disabled, error)
- With and without label
- With helper text
- Checkbox group (vertical and horizontal)

## Usage Examples

### Basic Checkbox

```tsx
import { Checkbox } from '@/components/forms/Checkbox';

function TermsCheckbox() {
  const [agreed, setAgreed] = useState(false);

  return (
    <Checkbox
      checked={agreed}
      onChange={setAgreed}
      label="I agree to the terms and conditions"
      required
    />
  );
}
```

### With Helper Text

```tsx
function NotificationCheckbox() {
  const [enabled, setEnabled] = useState(true);

  return (
    <Checkbox
      checked={enabled}
      onChange={setEnabled}
      label="Enable notifications"
      helperText="Receive updates when it's your turn"
    />
  );
}
```

### Indeterminate (Select All)

```tsx
function SelectAllCheckbox({ items, selected, onSelectAll }) {
  const allSelected = selected.length === items.length;
  const someSelected = selected.length > 0 && !allSelected;

  return (
    <Checkbox
      checked={allSelected}
      indeterminate={someSelected}
      onChange={() => onSelectAll(!allSelected)}
      label="Select all"
    />
  );
}
```

### Checkbox Group

```tsx
function SettingsCheckboxGroup() {
  const [settings, setSettings] = useState<string[]>(['hints']);

  const options = [
    { value: 'hints', label: 'Show hints', helperText: 'Display pattern suggestions' },
    { value: 'sounds', label: 'Sound effects', helperText: 'Play audio for actions' },
    { value: 'animations', label: 'Animations', helperText: 'Smooth transitions' },
  ];

  return (
    <CheckboxGroup
      label="Game Settings"
      options={options}
      value={settings}
      onChange={setSettings}
      direction="vertical"
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.checkbox-wrapper {
  display: inline-flex;
  align-items: flex-start;
  cursor: pointer;
  user-select: none;
}

.checkbox-wrapper--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Checkbox input (hidden) */
.checkbox__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* Checkbox box */
.checkbox__box {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  transition: all 0.2s ease;
}

.checkbox__box--small {
  width: 1rem;
  height: 1rem;
}

.checkbox__box--medium {
  width: 1.25rem;
  height: 1.25rem;
}

.checkbox__box--large {
  width: 1.5rem;
  height: 1.5rem;
}

/* Checked state */
.checkbox__input:checked + .checkbox__box {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

/* Indeterminate state */
.checkbox__box--indeterminate {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

/* Focus state */
.checkbox__input:focus + .checkbox__box {
  box-shadow: var(--shadow-focus);
}

/* Error state */
.checkbox__box--error {
  border-color: var(--color-error);
}

/* Disabled state */
.checkbox__input:disabled + .checkbox__box {
  background: var(--color-background-secondary);
  border-color: var(--color-border);
  cursor: not-allowed;
}

/* Checkmark */
.checkbox__check {
  width: 60%;
  height: 60%;
  color: white;
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s ease;
}

.checkbox__input:checked + .checkbox__box .checkbox__check {
  opacity: 1;
  transform: scale(1);
  animation: checkmark-enter 0.2s ease;
}

/* Indeterminate dash */
.checkbox__dash {
  width: 60%;
  height: 2px;
  background: white;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.checkbox__box--indeterminate .checkbox__dash {
  opacity: 1;
}

/* Label */
.checkbox__label-wrapper {
  display: flex;
  flex-direction: column;
  margin-left: var(--space-2);
}

.checkbox__label {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  color: var(--color-text-primary);
}

.checkbox-wrapper--small .checkbox__label {
  font-size: var(--text-sm);
}

.checkbox-wrapper--large .checkbox__label {
  font-size: var(--text-lg);
}

.checkbox__helper-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-0-5);
}

.checkbox__error-text {
  font-size: var(--text-xs);
  color: var(--color-error);
  margin-top: var(--space-0-5);
}

/* Checkbox Group */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.checkbox-group__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.checkbox-group__options {
  display: flex;
  gap: var(--space-3);
}

.checkbox-group__options--vertical {
  flex-direction: column;
}

.checkbox-group__options--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.checkbox-group__error {
  font-size: var(--text-xs);
  color: var(--color-error);
  margin-top: var(--space-1);
}

/* Animations */
@keyframes checkmark-enter {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

/* Touch target */
@media (hover: none) {
  .checkbox-wrapper {
    padding: var(--space-2);
    margin: calc(var(--space-2) * -1);
  }
}
```

## Future Enhancements

- [ ] Custom checkmark icon/SVG
- [ ] Color variants (success, warning, error)
- [ ] Switch-style toggle variant
- [ ] Animated transitions between states
- [ ] Rich label content (HTML, icons)
- [ ] Nested checkbox trees (with indeterminate parent)
- [ ] Keyboard shortcuts for checkbox groups
- [ ] Persistence to localStorage

## Notes

- Always use controlled component pattern (checked + onChange)
- Indeterminate state only visual (not a true checked state)
- Label should be clickable for better UX
- Touch targets should be min 44px on mobile
- Checkbox groups useful for multi-select settings
- Focus ring essential for keyboard navigation
- Error messages should be specific and actionable
- Helper text guides users before they make mistakes
- Disabled checkboxes cannot be toggled or focused
- Checkbox groups should allow individual option disabling
- Horizontal layout better for 2-4 options, vertical for 5+
- Animations improve perceived responsiveness
- Consider using `<fieldset>` for checkbox groups (semantic HTML)

```text

```
