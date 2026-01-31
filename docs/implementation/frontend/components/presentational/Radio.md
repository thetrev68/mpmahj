# Radio Component Specification

## Component Type

Presentational Component

## Purpose

Provides radio button groups for mutually exclusive selections. Users can choose exactly one option from a set of choices. Commonly used for settings, preferences, and configuration options.

## Related User Stories

- US-028: Adjust Hint Verbosity (verbosity level selection)
- US-034: Configure House Rules (rule option selection)
- US-035: Animation Settings (animation speed selection)
- US-036: Timer Configuration (timer mode selection)

## TypeScript Interface

```typescript
export interface RadioGroupProps {
  /** Group name (for form submission) */
  name: string;

  /** Radio options */
  options: RadioOption[];

  /** Currently selected value */
  value: string;

  /** Callback when selection changes */
  onChange: (value: string) => void;

  /** Group label */
  label?: string;

  /** Group description */
  description?: string;

  /** Layout orientation */
  orientation?: 'vertical' | 'horizontal';

  /** Disabled state */
  disabled?: boolean;

  /** Error state */
  error?: boolean;

  /** Error message */
  errorMessage?: string;

  /** Required field */
  required?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface RadioOption {
  /** Option value */
  value: string;

  /** Option label */
  label: string;

  /** Option description */
  description?: string;

  /** Disabled state for this option */
  disabled?: boolean;

  /** Icon for this option */
  icon?: React.ReactNode;
}
```

## Internal State

```typescript
interface RadioGroupState {
  /** Focused option index (for keyboard navigation) */
  focusedIndex: number;
}
```

## State Management

**Controlled component** - value and onChange from parent. Internal state for keyboard focus management.

## Visual Design

### Layout Orientations

#### Vertical (Default)

```text
Hint Verbosity *

Choose how detailed hints should be:

( ) Beginner
    Full explanations with examples

(•) Intermediate
    Strategic suggestions only

( ) Expert
    Minimal hints, no explanations

( ) Disabled
    No AI hints
```

#### Horizontal

```text
Animation Speed:  ( ) Slow  (•) Normal  ( ) Fast
```

### Radio Button Styles

#### Unchecked

- **Circle**: 20px diameter, 2px border, `var(--color-border)`
- **Inner dot**: Not visible
- **Background**: Transparent

#### Checked

- **Circle**: 20px diameter, 2px border, `var(--color-primary)`
- **Inner dot**: 10px diameter, `var(--color-primary)`, centered
- **Background**: `var(--color-background)`

#### Focused

- **Outline**: 2px solid `var(--color-primary)`, 2px offset
- **Circle**: Same as checked/unchecked

#### Disabled

- **Circle**: `var(--color-border-disabled)`
- **Inner dot**: `var(--color-text-disabled)` (if checked)
- **Opacity**: 0.6

#### Hover (Enabled)

- **Circle**: `var(--color-primary-light)` border
- **Cursor**: Pointer

#### Error

- **Circle**: `var(--color-error)` border
- **Label**: `var(--color-error)` text

### Option Layout

```text
[Radio] Label Text
        Description text (smaller, gray)
```

### Spacing

- **Between options (vertical)**: `var(--space-3)` (12px)
- **Between options (horizontal)**: `var(--space-4)` (16px)
- **Radio to label**: `var(--space-2)` (8px)
- **Label to description**: `var(--space-1)` (4px)
- **Group label to options**: `var(--space-2)` (8px)

### Typography

- **Group label**: `var(--text-base)`, `var(--font-semibold)`
- **Group description**: `var(--text-sm)`, `var(--color-text-secondary)`
- **Option label**: `var(--text-base)`, `var(--font-normal)`
- **Option description**: `var(--text-sm)`, `var(--color-text-secondary)`

## Accessibility

### ARIA Attributes

- `role="radiogroup"` for container
- `aria-labelledby` pointing to group label
- `aria-describedby` pointing to description/error
- `aria-required` when required
- `aria-invalid` when error
- `role="radio"` for each option
- `aria-checked` for each option
- `aria-disabled` for disabled options

### Keyboard Support

- **Tab**: Enter/exit radio group
- **Arrow Up/Down** (vertical): Navigate options, select
- **Arrow Left/Right** (horizontal): Navigate options, select
- **Space**: Select focused option
- **Home**: Focus first option
- **End**: Focus last option

### Screen Reader Support

- Announce group label and description
- Announce "radio button, {label}, {checked/unchecked}"
- Announce option descriptions when focused
- Announce required/error state
- Announce "{x} of {y}" position in group

### Visual Accessibility

- High contrast borders and text
- Focus visible (outline)
- Large touch targets (44px minimum)
- Clear checked state (not color alone)

## Dependencies

### External

- React (hooks: `useState`, `useRef`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/styles/radio.module.css` - Component styles

## Implementation Notes

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
  const { orientation } = props;
  const isVertical = orientation === 'vertical';

  let nextIndex = index;

  switch (e.key) {
    case 'ArrowUp':
      if (isVertical) {
        e.preventDefault();
        nextIndex = index > 0 ? index - 1 : options.length - 1;
      }
      break;
    case 'ArrowDown':
      if (isVertical) {
        e.preventDefault();
        nextIndex = index < options.length - 1 ? index + 1 : 0;
      }
      break;
    case 'ArrowLeft':
      if (!isVertical) {
        e.preventDefault();
        nextIndex = index > 0 ? index - 1 : options.length - 1;
      }
      break;
    case 'ArrowRight':
      if (!isVertical) {
        e.preventDefault();
        nextIndex = index < options.length - 1 ? index + 1 : 0;
      }
      break;
    case 'Home':
      e.preventDefault();
      nextIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      nextIndex = options.length - 1;
      break;
    case ' ':
      e.preventDefault();
      handleChange(options[index].value);
      return;
  }

  setFocusedIndex(nextIndex);
  handleChange(options[nextIndex].value);
};
```

### Selection Management

```typescript
const handleChange = (newValue: string) => {
  if (disabled) return;

  const option = options.find((opt) => opt.value === newValue);
  if (option?.disabled) return;

  onChange(newValue);
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('Radio', () => {
  it('renders all options', () => {});
  it('shows checked state for selected value', () => {});
  it('calls onChange when option clicked', () => {});
  it('shows group label', () => {});
  it('shows group description', () => {});
  it('shows option descriptions', () => {});
  it('applies vertical layout by default', () => {});
  it('applies horizontal layout', () => {});
  it('disables all options when disabled', () => {});
  it('disables specific options', () => {});
  it('shows error state', () => {});
  it('shows error message', () => {});
  it('shows required indicator', () => {});
  it('handles keyboard navigation (vertical)', () => {});
  it('handles keyboard navigation (horizontal)', () => {});
  it('wraps around on arrow keys', () => {});
  it('selects on Space key', () => {});
  it('applies correct ARIA attributes', () => {});
});
```

### Integration Tests

```typescript
describe('Radio Integration', () => {
  it('updates when value prop changes', () => {});
  it('prevents selection of disabled options', () => {});
  it('announces changes to screen readers', () => {});
});
```

### Visual Regression Tests

- All states (unchecked, checked, focused, disabled, error)
- Vertical and horizontal orientations
- With and without descriptions
- With and without icons
- Long option labels (wrapping)

## Usage Examples

### Basic Radio Group

```tsx
import { Radio } from '@/components/ui/Radio';

function HintSettings() {
  const [verbosity, setVerbosity] = useState('intermediate');

  return (
    <Radio
      name="hint-verbosity"
      label="Hint Verbosity"
      value={verbosity}
      onChange={setVerbosity}
      options={[
        {
          value: 'beginner',
          label: 'Beginner',
          description: 'Full explanations with examples',
        },
        {
          value: 'intermediate',
          label: 'Intermediate',
          description: 'Strategic suggestions only',
        },
        {
          value: 'expert',
          label: 'Expert',
          description: 'Minimal hints',
        },
      ]}
    />
  );
}
```

### Horizontal Layout

```tsx
function AnimationSpeed() {
  const [speed, setSpeed] = useState('normal');

  return (
    <Radio
      name="animation-speed"
      label="Animation Speed"
      orientation="horizontal"
      value={speed}
      onChange={setSpeed}
      options={[
        { value: 'slow', label: 'Slow' },
        { value: 'normal', label: 'Normal' },
        { value: 'fast', label: 'Fast' },
      ]}
    />
  );
}
```

### With Disabled Options

```tsx
function GameMode() {
  const [mode, setMode] = useState('casual');

  return (
    <Radio
      name="game-mode"
      label="Game Mode"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'casual', label: 'Casual' },
        { value: 'competitive', label: 'Competitive' },
        {
          value: 'tournament',
          label: 'Tournament',
          disabled: true,
          description: 'Coming soon',
        },
      ]}
    />
  );
}
```

### With Error State

```tsx
function RequiredSetting() {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (!value) {
      setError(true);
      return;
    }
    // Submit...
  };

  return (
    <Radio
      name="required-option"
      label="Choose an Option"
      value={value}
      onChange={(v) => {
        setValue(v);
        setError(false);
      }}
      required
      error={error}
      errorMessage="Please select an option"
      options={[
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ]}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.radio-group__label {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.radio-group__label--required::after {
  content: ' *';
  color: var(--color-error);
}

.radio-group__description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

.radio-group__options {
  display: flex;
  gap: var(--space-3);
}

.radio-group__options--vertical {
  flex-direction: column;
}

.radio-group__options--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.radio-group__error {
  font-size: var(--text-sm);
  color: var(--color-error);
  margin-top: var(--space-1);
}

/* Radio option */
.radio-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  transition: background-color 0.2s ease;
  min-height: 44px; /* Touch target */
}

.radio-option:hover:not(.radio-option--disabled) {
  background-color: var(--color-background-hover);
}

.radio-option--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Radio button */
.radio-option__button {
  position: relative;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px; /* Align with label baseline */
}

.radio-option__input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.radio-option__circle {
  display: block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-background);
  transition: border-color 0.2s ease;
}

.radio-option__input:checked + .radio-option__circle {
  border-color: var(--color-primary);
}

.radio-option__input:focus + .radio-option__circle {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.radio-option--error .radio-option__circle {
  border-color: var(--color-error);
}

.radio-option--disabled .radio-option__circle {
  border-color: var(--color-border-disabled);
}

/* Inner dot */
.radio-option__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.radio-option__input:checked ~ .radio-option__dot {
  opacity: 1;
}

.radio-option--disabled .radio-option__dot {
  background: var(--color-text-disabled);
}

/* Radio content */
.radio-option__content {
  flex: 1;
  min-width: 0;
}

.radio-option__label {
  font-size: var(--text-base);
  color: var(--color-text-primary);
  line-height: 1.4;
  word-wrap: break-word;
}

.radio-option__description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
  line-height: 1.5;
}

/* Horizontal layout adjustments */
.radio-group__options--horizontal .radio-option {
  flex: 0 0 auto;
}

/* Responsive */
@media (max-width: 640px) {
  .radio-group__options--horizontal {
    flex-direction: column;
  }
}
```

## Future Enhancements

- [ ] Card-style radio buttons (large clickable cards)
- [ ] Image radio buttons (thumbnails as options)
- [ ] Color picker radio buttons
- [ ] Radio button groups with icons
- [ ] Conditional options (show based on previous selection)
- [ ] Search/filter for large option sets
- [ ] Option badges (new, recommended, etc.)
- [ ] Multi-column layout for many options
- [ ] Animated selection transition
- [ ] Custom radio button shapes (square, custom SVG)

## Notes

- Radio for mutually exclusive choices (only one selected)
- Checkbox for independent choices (multiple selected)
- Default one option selected (avoid unselected state if possible)
- Vertical layout for <5 options, horizontal for 2-4 short options
- Descriptions help users understand options
- Disabled options shown but not selectable
- Group label required for accessibility
- Keyboard navigation essential (arrow keys change selection)
- Focus visible for keyboard users
- Large touch targets for mobile (44px minimum)
- Error state for validation feedback
- Required indicator for mandatory fields
- Screen reader announces group context
- Avoid too many options (>7) - consider Select instead
- Options should be mutually exclusive and collectively exhaustive
- Order options logically (common first, alphabetical, or by value)
- Keep option labels concise (1-3 words)
- Use descriptions for clarification, not essential information
- Radio buttons persist selection (unlike dropdowns which can close)
- Visual feedback on hover for better UX
- Consider card-style radios for visually distinct options

```text

```
