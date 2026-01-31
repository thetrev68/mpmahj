# TextArea Component Specification

## Component Type

Presentational Component

## Purpose

Provides multiline text input for longer text entry (notes, messages, feedback). Supports auto-resizing, character limits, and rich text editing capabilities.

## Related User Stories

- US-029: Create Game Room (room description)
- US-031: Leave Game (optional leave reason)
- US-032: Forfeit Game (forfeit reason)
- US-033: Abandon Game (abandon reason)

## TypeScript Interface

```typescript
export interface TextAreaProps {
  /** Current value */
  value: string;

  /** Callback when value changes */
  onChange: (value: string) => void;

  /** Input label */
  label?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Helper text */
  helperText?: string;

  /** Error state */
  error?: boolean;

  /** Error message */
  errorMessage?: string;

  /** Disabled state */
  disabled?: boolean;

  /** Required field */
  required?: boolean;

  /** Minimum rows */
  minRows?: number;

  /** Maximum rows */
  maxRows?: number;

  /** Auto-resize to content */
  autoResize?: boolean;

  /** Maximum character count */
  maxLength?: number;

  /** Show character counter */
  showCharCount?: boolean;

  /** Resize handle */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}
```

## Internal State

```typescript
interface TextAreaState {
  /** Current height (for auto-resize) */
  height: number;

  /** Whether focused */
  isFocused: boolean;
}
```

## State Management

**Controlled component** - value and onChange from parent. Internal state for auto-resize and focus.

## Visual Design

### Layout

```text
Room Description *

+-------------------------------------------+
| Describe your game room...                |
|                                           |
|                                           |
|                                           |
+-------------------------------------------+
0 / 500 characters

Optional description for other players.
```

### States

#### Default

- **Border**: 1px solid `var(--color-border)`
- **Background**: `var(--color-background)`
- **Text**: `var(--color-text-primary)`

#### Focused

- **Border**: 2px solid `var(--color-primary)`
- **Shadow**: `var(--shadow-focus)`

#### Error

- **Border**: 2px solid `var(--color-error)`
- **Helper text**: `var(--color-error)`

#### Disabled

- **Background**: `var(--color-background-disabled)`
- **Text**: `var(--color-text-disabled)`
- **Border**: `var(--color-border-disabled)`
- **Cursor**: not-allowed

### Dimensions

- **Default height**: 96px (minRows = 3)
- **Min height**: 64px (minRows = 2)
- **Max height**: 400px (maxRows = 12) or unlimited
- **Padding**: `var(--space-3)` (12px)
- **Border radius**: `var(--radius-md)` (8px)

### Character Counter

- **Position**: Bottom-right below textarea
- **Format**: "{current} / {max} characters"
- **Colors**:
  - Normal: `var(--color-text-secondary)`
  - Warning (>80%): `var(--color-warning)`
  - Error (at max): `var(--color-error)`

### Typography

- **Label**: `var(--text-sm)`, `var(--font-medium)`
- **Input**: `var(--text-base)`, `var(--font-normal)`
- **Placeholder**: `var(--color-text-disabled)`
- **Helper**: `var(--text-sm)`, `var(--color-text-secondary)`
- **Error**: `var(--text-sm)`, `var(--color-error)`

## Accessibility

### ARIA Attributes

- `aria-label` or `aria-labelledby`
- `aria-describedby` pointing to helper/error
- `aria-invalid` when error
- `aria-required` when required
- `aria-multiline="true"`

### Keyboard Support

- **Tab**: Enter/exit textarea
- **Shift + Tab**: Previous field
- **Enter**: New line (not submit)
- **Ctrl/Cmd + Enter**: Submit (if in form)

### Screen Reader Support

- Announce label and description
- Announce character count updates
- Announce error messages
- Announce max length reached

### Visual Accessibility

- High contrast borders and text
- Focus visible (outline + shadow)
- Label always visible
- Error state clearly indicated

## Dependencies

### External

- React (hooks: `useState`, `useRef`, `useEffect`)
- `clsx` for conditional class names

### Internal

- `@/styles/textArea.module.css` - Component styles

## Implementation Notes

### Auto-Resize

```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null);

useEffect(() => {
  if (!autoResize || !textareaRef.current) return;

  const textarea = textareaRef.current;

  // Reset height to get correct scrollHeight
  textarea.style.height = 'auto';

  // Calculate new height
  const scrollHeight = textarea.scrollHeight;
  const minHeight = minRows * 24; // Approximate line height
  const maxHeight = maxRows ? maxRows * 24 : Infinity;

  const newHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

  textarea.style.height = `${newHeight}px`;
}, [value, autoResize, minRows, maxRows]);
```

### Character Count

```typescript
const remaining = maxLength ? maxLength - value.length : null;
const percentage = maxLength ? (value.length / maxLength) * 100 : 0;

const getCountColor = () => {
  if (percentage >= 100) return 'error';
  if (percentage >= 80) return 'warning';
  return 'normal';
};
```

### Handle Change

```typescript
const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const newValue = e.target.value;

  // Enforce max length
  if (maxLength && newValue.length > maxLength) {
    return;
  }

  onChange(newValue);
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('TextArea', () => {
  it('renders with initial value', () => {});
  it('calls onChange when text entered', () => {});
  it('shows label', () => {});
  it('shows placeholder when empty', () => {});
  it('shows helper text', () => {});
  it('shows error state and message', () => {});
  it('applies disabled state', () => {});
  it('shows required indicator', () => {});
  it('auto-resizes to content', () => {});
  it('respects minRows', () => {});
  it('respects maxRows', () => {});
  it('enforces maxLength', () => {});
  it('shows character counter', () => {});
  it('updates character counter on input', () => {});
  it('applies correct ARIA attributes', () => {});
});
```

### Integration Tests

```typescript
describe('TextArea Integration', () => {
  it('updates when value prop changes', () => {});
  it('announces character count to screen readers', () => {});
  it('prevents input beyond maxLength', () => {});
});
```

### Visual Regression Tests

- All states (default, focused, error, disabled)
- With and without label
- With and without helper text
- With and without character counter
- Auto-resize behavior
- Various text lengths

## Usage Examples

### Basic TextArea

```tsx
import { TextArea } from '@/components/ui/TextArea';

function RoomDescription() {
  const [description, setDescription] = useState('');

  return (
    <TextArea
      label="Room Description"
      value={description}
      onChange={setDescription}
      placeholder="Describe your game room..."
      helperText="Optional description for other players."
      maxLength={500}
      showCharCount
    />
  );
}
```

### Auto-Resizing TextArea

```tsx
function FeedbackForm() {
  const [feedback, setFeedback] = useState('');

  return (
    <TextArea
      label="Feedback"
      value={feedback}
      onChange={setFeedback}
      placeholder="Share your thoughts..."
      autoResize
      minRows={3}
      maxRows={10}
      required
    />
  );
}
```

### With Error State

```tsx
function ReasonInput() {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      setError(true);
      return;
    }
    // Submit...
  };

  return (
    <TextArea
      label="Reason for Leaving"
      value={reason}
      onChange={(v) => {
        setReason(v);
        setError(false);
      }}
      placeholder="Please provide a reason..."
      error={error}
      errorMessage="Reason must be at least 10 characters."
      required
    />
  );
}
```

### Fixed Size TextArea

```tsx
function Notes() {
  const [notes, setNotes] = useState('');

  return (
    <TextArea
      label="Game Notes"
      value={notes}
      onChange={setNotes}
      placeholder="Take notes during the game..."
      minRows={5}
      resize="none"
      maxLength={1000}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.textarea {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.textarea__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.textarea__label--required::after {
  content: ' *';
  color: var(--color-error);
}

.textarea__input-container {
  position: relative;
}

.textarea__input {
  width: 100%;
  min-height: 96px;
  padding: var(--space-3);
  font-family: inherit;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  resize: vertical;
}

.textarea__input::placeholder {
  color: var(--color-text-disabled);
}

.textarea__input:focus {
  outline: none;
  border-color: var(--color-primary);
  border-width: 2px;
  box-shadow: var(--shadow-focus);
  padding: calc(var(--space-3) - 1px); /* Compensate for border width */
}

.textarea__input--error {
  border-color: var(--color-error);
  border-width: 2px;
  padding: calc(var(--space-3) - 1px);
}

.textarea__input--disabled {
  background: var(--color-background-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  cursor: not-allowed;
}

.textarea__input--resize-none {
  resize: none;
}

.textarea__input--resize-horizontal {
  resize: horizontal;
}

.textarea__input--resize-both {
  resize: both;
}

.textarea__footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  min-height: 20px;
}

.textarea__helper {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.textarea__error {
  font-size: var(--text-sm);
  color: var(--color-error);
  line-height: 1.4;
}

.textarea__char-count {
  flex-shrink: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.textarea__char-count--warning {
  color: var(--color-warning);
}

.textarea__char-count--error {
  color: var(--color-error);
  font-weight: var(--font-semibold);
}

/* Auto-resize */
.textarea__input--auto-resize {
  overflow: hidden;
  resize: none;
}

/* Responsive */
@media (max-width: 640px) {
  .textarea__input {
    font-size: 16px; /* Prevent zoom on iOS */
  }

  .textarea__footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .textarea__char-count {
    align-self: flex-end;
  }
}
```

## Future Enhancements

- [ ] Rich text editing (bold, italic, lists)
- [ ] Markdown support
- [ ] Mention/tag suggestions (@player)
- [ ] Emoji picker integration
- [ ] Spell check toggle
- [ ] Word count (in addition to character count)
- [ ] Text formatting toolbar
- [ ] Draft auto-save (localStorage)
- [ ] Copy/paste formatting
- [ ] Keyboard shortcuts (Ctrl+B for bold, etc.)
- [ ] Template snippets
- [ ] Voice input support

## Notes

- TextArea for multiline text (>1 sentence)
- Input for single-line text
- Auto-resize improves UX (no manual resizing)
- Character limit prevents excessive input
- Show character count when limit exists
- Helper text provides guidance
- Error messages are specific and actionable
- Required indicator for mandatory fields
- Label always visible (not placeholder)
- Placeholder for hints, not labels
- Disabled state prevents interaction
- Focus visible for keyboard users
- Large touch targets for mobile
- Prevent iOS zoom with 16px font size
- Consider max height to prevent excessive scrolling
- Respect user's resize preference
- Announce character count to screen readers
- Error state clearly indicated
- Consider text formatting for rich content
- Auto-save drafts for important forms
- Trim whitespace before validation
- Handle paste events appropriately
- Consider keyboard shortcuts for common actions
- Provide undo/redo for text editing

```

```
