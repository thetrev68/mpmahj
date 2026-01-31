# Input Component Specification

## Component Type

Presentational Component

## Purpose

Text input field with validation states, icons, and labels. Supports various input types including text, number, email, password with consistent styling and error handling.

## Related User Stories

- US-001: Player Authentication (username, password inputs)
- US-038: Room Settings (room name, password)
- US-036: Game Settings (numeric inputs for timer durations)
- Form interactions across all authenticated features

## TypeScript Interface

```typescript
export interface InputProps {
  /** Input type */
  type?: 'text' | 'number' | 'email' | 'password' | 'search';

  /** Input value */
  value: string | number;

  /** Change handler */
  onChange: (value: string | number) => void;

  /** Input name */
  name?: string;

  /** Label text */
  label?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Helper text below input */
  helperText?: string;

  /** Error message (shows error state) */
  error?: string;

  /** Success message (shows success state) */
  success?: string;

  /** Whether input is disabled */
  disabled?: boolean;

  /** Whether input is required */
  required?: boolean;

  /** Whether input is read-only */
  readOnly?: boolean;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Full width */
  fullWidth?: boolean;

  /** Icon to display (left side) */
  icon?: React.ReactNode;

  /** Icon to display (right side) */
  rightIcon?: React.ReactNode;

  /** Auto-focus on mount */
  autoFocus?: boolean;

  /** Max length */
  maxLength?: number;

  /** Min value (for number inputs) */
  min?: number;

  /** Max value (for number inputs) */
  max?: number;

  /** Step value (for number inputs) */
  step?: number;

  /** Autocomplete attribute */
  autoComplete?: string;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;

  /** Blur handler */
  onBlur?: () => void;

  /** Focus handler */
  onFocus?: () => void;

  /** Key down handler */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}
```text

## Internal State

```typescript
interface InputState {
  /** Whether input is focused */
  isFocused: boolean;

  /** Whether password is visible (for type='password') */
  showPassword: boolean;
}
```text

## State Management

**Internal useState** for focus state and password visibility toggle. Value managed by parent component (controlled).

## Visual Design

### Size Variants

- **small**: 32px height, 0.875rem font, 8px padding
- **medium**: 40px height, 1rem font, 12px padding (default)
- **large**: 48px height, 1.125rem font, 16px padding

### State Styles

#### Default

- Border: 1px solid `var(--color-border)` (#d1d5db)
- Background: `var(--color-background)` (#ffffff)
- Text: `var(--color-text-primary)` (#111827)
- Placeholder: `var(--color-text-disabled)` (#9ca3af)

#### Focused

- Border: 2px solid `var(--color-primary)` (#2563eb)
- Box shadow: `var(--shadow-focus)` (0 0 0 3px rgba(37, 99, 235, 0.1))
- Outline: none

#### Error

- Border: 1px solid `var(--color-error)` (#ef4444)
- Background: rgba(239, 68, 68, 0.05)
- Error text: `var(--color-error)`, `var(--text-sm)`

#### Success

- Border: 1px solid `var(--color-success)` (#10b981)
- Success text: `var(--color-success)`, `var(--text-sm)`

#### Disabled

- Border: 1px solid `var(--color-border)`
- Background: `var(--color-background-secondary)` (#f3f4f6)
- Text: `var(--color-text-disabled)`
- Cursor: not-allowed
- Opacity: 0.6

#### Read-only

- Border: 1px dashed `var(--color-border)`
- Background: `var(--color-background-secondary)`
- Cursor: default

### Icon Display

- **Left icon**: 16px × 16px, positioned 12px from left edge
- **Right icon**: 16px × 16px, positioned 12px from right edge
- **Input padding**: Adjusted to accommodate icons
- **Icon color**: `var(--color-text-secondary)` by default

### Label

- **Font size**: `var(--text-sm)` (0.875rem)
- **Font weight**: `var(--font-medium)` (500)
- **Color**: `var(--color-text-primary)`
- **Margin**: `var(--space-1)` (4px) below
- **Required indicator**: Red asterisk (\*) when required

### Helper/Error/Success Text

- **Font size**: `var(--text-xs)` (0.75rem)
- **Margin**: `var(--space-1)` above
- **Helper**: `var(--color-text-secondary)`
- **Error**: `var(--color-error)` with error icon
- **Success**: `var(--color-success)` with checkmark icon

## Accessibility

### ARIA Attributes

- `aria-label` or label element with `htmlFor`
- `aria-required="true"` when required
- `aria-invalid="true"` when error present
- `aria-describedby` linking to helperText/error ID
- `aria-readonly="true"` when readOnly

### Keyboard Support

- **Tab**: Focus input
- **Shift + Tab**: Focus previous element
- **Enter**: Submit form (if in form)
- **Escape**: Clear focus (blur)
- **Arrow Up/Down**: Increment/decrement (number inputs)

### Screen Reader Support

- Label announced before input
- Required state announced
- Error message announced on change (aria-live="polite")
- Helper text announced after input description
- Password visibility toggle announced ("Show password" / "Hide password")

### Visual Accessibility

- Focus visible (ring, not just color)
- Placeholder doesn't replace label
- Error not indicated by color alone (icon + border + message)
- High contrast in all states (WCAG AA)

## Dependencies

### External

- React (hooks: `useState`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/icons/` - Icon components (ErrorIcon, SuccessIcon, EyeIcon, EyeOffIcon)
- `@/styles/input.module.css` - Component styles

### Generated Types

None - uses standard HTML input types

## Implementation Notes

### Controlled Component Pattern

```typescript
// Parent manages value
const [username, setUsername] = useState('');

<Input
  value={username}
  onChange={setUsername}
  label="Username"
/>
```text

### Password Visibility Toggle

```typescript
// Internal state for password type
const [showPassword, setShowPassword] = useState(false);

// Render eye icon as rightIcon
<button onClick={() => setShowPassword(!showPassword)}>
  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
</button>
```text

### Validation Integration

```typescript
// Error prop shows validation state
const [email, setEmail] = useState('');
const error = isValidEmail(email) ? undefined : 'Invalid email address';

<Input
  type="email"
  value={email}
  onChange={setEmail}
  error={error}
/>
```text

### Number Input Constraints

```typescript
// min, max, step props for number inputs
<Input
  type="number"
  value={turnDuration}
  onChange={setTurnDuration}
  min={10}
  max={300}
  step={10}
  label="Turn duration (seconds)"
/>
```text

### Error Handling

- Invalid type: Fallback to 'text'
- Non-numeric value for number input: Convert or reject
- maxLength enforced via HTML attribute
- onChange always called with correct type (string vs number)

## Test Scenarios

### Unit Tests

```typescript
describe('Input', () => {
  it('renders label and input correctly', () => {
    // label prop should render label element
  });

  it('handles value changes', () => {
    // onChange should be called with new value
  });

  it('shows error state', () => {
    // error prop should apply error styles
  });

  it('shows success state', () => {
    // success prop should apply success styles
  });

  it('disables input when disabled', () => {
    // disabled prop should make input non-interactive
  });

  it('displays icons correctly', () => {
    // icon and rightIcon should render in correct positions
  });

  it('toggles password visibility', () => {
    // type='password' should show toggle button
  });

  it('applies size class', () => {
    // size prop should apply correct height/padding
  });

  it('enforces maxLength', () => {
    // maxLength prop should limit input
  });

  it('handles number input constraints', () => {
    // min/max should constrain number inputs
  });

  it('shows required indicator', () => {
    // required prop should show asterisk
  });

  it('auto-focuses when mounted', () => {
    // autoFocus should focus input on mount
  });
});
```text

### Integration Tests

```typescript
describe('Input Integration', () => {
  it('integrates with form validation', () => {
    // Error messages should update on blur/change
  });

  it('submits form on Enter', () => {
    // Enter key should trigger form submission
  });

  it('announces errors to screen readers', () => {
    // aria-describedby should link to error message
  });

  it('respects autocomplete attributes', () => {
    // autoComplete should enable browser autofill
  });
});
```text

### Visual Regression Tests

- All size variants
- All state variants (default, focused, error, success, disabled, readOnly)
- With icons (left, right, both)
- Password visibility toggle
- Full-width vs auto-width
- With label, helper text, error message

## Usage Examples

### Basic Text Input

```tsx
import { Input } from '@/components/forms/Input';

function UsernameInput() {
  const [username, setUsername] = useState('');

  return (
    <Input
      type="text"
      value={username}
      onChange={setUsername}
      label="Username"
      placeholder="Enter username"
      required
    />
  );
}
```text

### Password Input with Validation

```tsx
function PasswordInput() {
  const [password, setPassword] = useState('');
  const error =
    password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters'
      : undefined;

  return (
    <Input
      type="password"
      value={password}
      onChange={setPassword}
      label="Password"
      error={error}
      helperText="Must be at least 8 characters"
      required
    />
  );
}
```text

### Number Input with Constraints

```tsx
function TimerDurationInput() {
  const [duration, setDuration] = useState(60);

  return (
    <Input
      type="number"
      value={duration}
      onChange={setDuration}
      label="Turn duration"
      min={10}
      max={300}
      step={10}
      helperText="Duration in seconds"
    />
  );
}
```text

### Search Input with Icon

```tsx
function SearchInput() {
  const [query, setQuery] = useState('');

  return (
    <Input
      type="search"
      value={query}
      onChange={setQuery}
      placeholder="Search rooms..."
      icon={<SearchIcon />}
      fullWidth
    />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.input-wrapper--full-width {
  width: 100%;
}

/* Label */
.input__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.input__label--required::after {
  content: '*';
  color: var(--color-error);
}

/* Input container */
.input__container {
  position: relative;
  display: flex;
  align-items: center;
}

/* Input field */
.input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  transition: all 0.2s ease;
}

.input::placeholder {
  color: var(--color-text-disabled);
}

.input:focus {
  outline: none;
  border-width: 2px;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

/* Size variants */
.input--small {
  height: 2rem;
  padding: 0 var(--space-2);
  font-size: var(--text-sm);
}

.input--medium {
  height: 2.5rem;
  padding: 0 var(--space-3);
  font-size: var(--text-base);
}

.input--large {
  height: 3rem;
  padding: 0 var(--space-4);
  font-size: var(--text-lg);
}

/* With icons */
.input--with-icon {
  padding-left: 2.5rem;
}

.input--with-right-icon {
  padding-right: 2.5rem;
}

/* Icons */
.input__icon,
.input__right-icon {
  position: absolute;
  width: 1rem;
  height: 1rem;
  color: var(--color-text-secondary);
  pointer-events: none;
}

.input__icon {
  left: var(--space-3);
}

.input__right-icon {
  right: var(--space-3);
}

.input__right-icon--interactive {
  pointer-events: auto;
  cursor: pointer;
  padding: var(--space-1);
}

/* State variants */
.input--error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.05);
}

.input--success {
  border-color: var(--color-success);
}

.input--disabled {
  background: var(--color-background-secondary);
  color: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}

.input--readonly {
  border-style: dashed;
  background: var(--color-background-secondary);
  cursor: default;
}

/* Helper/Error/Success text */
.input__helper-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.input__error-text {
  color: var(--color-error);
}

.input__success-text {
  color: var(--color-success);
}
```text

## Future Enhancements

- [ ] Character counter for maxLength
- [ ] Clear button (X icon) to reset value
- [ ] Validation debouncing (async validation)
- [ ] Prefix/suffix text (currency symbols, units)
- [ ] Auto-resize for long text
- [ ] Input masking (phone numbers, credit cards)
- [ ] Autocomplete suggestions dropdown
- [ ] Color picker variant
- [ ] Date/time picker integration

## Notes

- Always use controlled component pattern (value + onChange)
- Password visibility toggle improves UX without sacrificing security
- Error messages should be specific and actionable
- Helper text should guide users before they make mistakes
- Icons should enhance, not replace, text labels
- Full-width useful for mobile layouts
- Auto-focus sparingly (accessibility concern)
- Number inputs: Use min/max to prevent invalid values
- autoComplete improves UX for repeated forms
- Read-only different from disabled (read-only can be selected/copied)
