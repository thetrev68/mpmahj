# Select Component Specification

## Component Type

**Presentational Component**

## Purpose

Dropdown selection component with keyboard navigation, search filtering, and custom option rendering. Supports single and multi-select modes with validation states.

## Related User Stories

- US-036: Game Settings (timer mode, ruleset selection)
- US-038: Room Settings (game mode, card year selection)
- US-025: Sort Hand (sort mode dropdown)
- US-040: Joker Exchange Options (target meld selection)

## TypeScript Interface

```typescript
export interface SelectProps<T = string> {
  /** Select options */
  options: SelectOption<T>[];

  /** Selected value(s) */
  value: T | T[];

  /** Change handler */
  onChange: (value: T | T[]) => void;

  /** Label text */
  label?: string;

  /** Placeholder when no selection */
  placeholder?: string;

  /** Helper text below select */
  helperText?: string;

  /** Error message (shows error state) */
  error?: string;

  /** Whether select is disabled */
  disabled?: boolean;

  /** Whether select is required */
  required?: boolean;

  /** Whether multiple selection allowed */
  multiple?: boolean;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Full width */
  fullWidth?: boolean;

  /** Enable search/filter */
  searchable?: boolean;

  /** Search placeholder text */
  searchPlaceholder?: string;

  /** Custom option renderer */
  renderOption?: (option: SelectOption<T>) => React.ReactNode;

  /** Custom value renderer (in collapsed state) */
  renderValue?: (value: T | T[]) => React.ReactNode;

  /** Group options by category */
  groupBy?: (option: SelectOption<T>) => string;

  /** Max height of dropdown (px) */
  maxHeight?: number;

  /** Position of dropdown */
  placement?: 'bottom' | 'top' | 'auto';

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface SelectOption<T = string> {
  /** Option value */
  value: T;

  /** Display label */
  label: string;

  /** Optional description/subtitle */
  description?: string;

  /** Whether option is disabled */
  disabled?: boolean;

  /** Optional icon */
  icon?: React.ReactNode;

  /** Optional category for grouping */
  category?: string;
}
```

## Internal State

```typescript
interface SelectState {
  /** Whether dropdown is open */
  isOpen: boolean;

  /** Search query (if searchable) */
  searchQuery: string;

  /** Focused option index */
  focusedIndex: number;
}
```

## State Management

**Internal useState** for open/closed state, search query, and keyboard focus. Selected value managed by parent component (controlled).

## Visual Design

### Size Variants

- **small**: 32px height, 0.875rem font, 8px padding
- **medium**: 40px height, 1rem font, 12px padding (default)
- **large**: 48px height, 1.125rem font, 16px padding

### Select Trigger (Collapsed State)

- **Border**: 1px solid `var(--color-border)` (#d1d5db)
- **Background**: `var(--color-background)` (#ffffff)
- **Text**: `var(--color-text-primary)` (#111827)
- **Placeholder**: `var(--color-text-disabled)` (#9ca3af)
- **Icon**: Chevron down, `var(--color-text-secondary)`
- **Border radius**: `var(--radius-md)` (6px)

### Dropdown Panel (Expanded State)

- **Background**: `var(--color-background)` (#ffffff)
- **Border**: 1px solid `var(--color-border)`
- **Box shadow**: `var(--shadow-lg)` (0 10px 15px rgba(0,0,0,0.1))
- **Border radius**: `var(--radius-md)`
- **Max height**: 300px default, scrollable
- **Z-index**: 50

### Option States

#### Default

- **Background**: transparent
- **Text**: `var(--color-text-primary)`
- **Padding**: 12px horizontal, 8px vertical

#### Hovered/Focused

- **Background**: `var(--color-background-secondary)` (#f3f4f6)
- **Cursor**: pointer

#### Selected

- **Background**: `var(--color-primary-light)` (rgba(37, 99, 235, 0.1))
- **Text**: `var(--color-primary)` (#2563eb)
- **Checkmark**: Right side, `var(--color-primary)`

#### Disabled

- **Text**: `var(--color-text-disabled)`
- **Cursor**: not-allowed
- **Opacity**: 0.5

### Search Input (When Searchable)

- Sticky at top of dropdown
- Border bottom: 1px solid `var(--color-border)`
- Padding: 8px
- Icon: Search icon, left side
- Clear button: X icon, right side (when query present)

### Multi-Select Tags

- Display selected items as chips/badges
- Max 3 visible, then "+N more" indicator
- Removable with X button
- Color: `var(--color-primary-light)` background

### Group Headers

- **Background**: `var(--color-background-secondary)`
- **Text**: `var(--text-xs)`, uppercase, `var(--font-semibold)`
- **Padding**: 8px 12px
- **Sticky**: Group headers stick during scroll

## Accessibility

### ARIA Attributes

- `role="combobox"` for trigger
- `role="listbox"` for dropdown
- `role="option"` for each option
- `role="group"` for option groups
- `aria-expanded` on trigger (true/false)
- `aria-haspopup="listbox"` on trigger
- `aria-labelledby` linking to label
- `aria-activedescendant` for focused option
- `aria-selected` for selected options
- `aria-disabled` for disabled options
- `aria-required` when required
- `aria-invalid` when error present

### Keyboard Support

- **Space/Enter**: Open dropdown (when closed)
- **Escape**: Close dropdown
- **Arrow Down**: Focus next option
- **Arrow Up**: Focus previous option
- **Home**: Focus first option
- **End**: Focus last option
- **Type character**: Jump to option starting with character
- **Enter**: Select focused option
- **Tab**: Close and move to next field

### Screen Reader Support

- Announce label and selected value
- Announce "Required" when required
- Announce error message when present
- Announce number of options available
- Announce option on focus
- Announce selection changes
- Announce "X of Y" for multi-select

### Visual Accessibility

- Focus visible (ring on trigger and options)
- Sufficient contrast for all states
- Error not indicated by color alone (icon + border + message)
- Options large enough for touch (44px min height)

## Dependencies

### External

- React (hooks: `useState`, `useRef`, `useCallback`, `useEffect`)
- `clsx` for conditional class names
- `@floating-ui/react` or similar for dropdown positioning

### Internal

- `@/components/icons/` - Icon components (ChevronDown, Check, Search, X)
- `@/components/ui/Badge` - Multi-select chips
- `@/hooks/useClickOutside` - Close dropdown on outside click
- `@/hooks/useKeyboardNavigation` - Keyboard navigation logic
- `@/styles/select.module.css` - Component styles

### Generated Types

None - uses generic TypeScript

## Implementation Notes

### Dropdown Positioning

```typescript
// Use floating-ui for smart positioning
import { useFloating, shift, flip } from '@floating-ui/react';

const { x, y, strategy, refs } = useFloating({
  placement: placement === 'auto' ? 'bottom-start' : placement,
  middleware: [shift(), flip()],
});
```

### Search Filtering

```typescript
const filteredOptions = searchQuery
  ? options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        option.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  : options;
```

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      if (focusedIndex >= 0) {
        handleOptionClick(options[focusedIndex]);
      }
      break;
    case 'Escape':
      setIsOpen(false);
      break;
  }
};
```

### Multi-Select Value Management

```typescript
const handleMultiSelect = (optionValue: T) => {
  const currentValues = Array.isArray(value) ? value : [];

  if (currentValues.includes(optionValue)) {
    // Remove
    onChange(currentValues.filter((v) => v !== optionValue));
  } else {
    // Add
    onChange([...currentValues, optionValue]);
  }
};
```

### Option Grouping

```typescript
const groupedOptions = groupBy
  ? options.reduce((groups, option) => {
      const category = groupBy(option);
      if (!groups[category]) groups[category] = [];
      groups[category].push(option);
      return groups;
    }, {} as Record<string, SelectOption<T>[])
  : { '': options };
```

### Performance Optimizations

1. **Virtualization**: For 100+ options, use react-window
2. **Memoization**: Memoize filtered and grouped options
3. **Debounce search**: Delay filtering until user stops typing
4. **Portal rendering**: Render dropdown in body for z-index management

## Test Scenarios

### Unit Tests

```typescript
describe('Select', () => {
  it('renders label and trigger', () => {
    // label prop should render label element
  });

  it('opens dropdown on click', () => {
    // Clicking trigger should open dropdown
  });

  it('closes dropdown on outside click', () => {
    // Clicking outside should close dropdown
  });

  it('handles option selection', () => {
    // onChange should be called with selected value
  });

  it('filters options when searchable', () => {
    // Search query should filter options
  });

  it('supports multi-select', () => {
    // multiple=true should allow multiple selections
  });

  it('groups options by category', () => {
    // groupBy should render group headers
  });

  it('disables select when disabled', () => {
    // disabled prop should make select non-interactive
  });

  it('shows error state', () => {
    // error prop should apply error styles
  });

  it('navigates with keyboard', () => {
    // Arrow keys should move focus
  });

  it('selects with Enter key', () => {
    // Enter should select focused option
  });

  it('closes with Escape key', () => {
    // Escape should close dropdown
  });
});
```

### Integration Tests

```typescript
describe('Select Integration', () => {
  it('integrates with form validation', () => {
    // Required select should show error when empty
  });

  it('updates value on selection', () => {
    // Selecting option should update value prop
  });

  it('announces changes to screen readers', () => {
    // aria-live should announce selections
  });

  it('positions dropdown correctly', () => {
    // Dropdown should flip when near bottom edge
  });
});
```

### Visual Regression Tests

- All size variants
- All states (default, open, focused, error, disabled)
- Searchable variant with query
- Multi-select with tags
- Grouped options
- Custom option rendering

## Usage Examples

### Basic Select

```tsx
import { Select } from '@/components/forms/Select';

function GameModeSelect() {
  const [mode, setMode] = useState('casual');

  const options = [
    { value: 'casual', label: 'Casual', description: 'Relaxed gameplay' },
    { value: 'competitive', label: 'Competitive', description: 'Ranked matches' },
    { value: 'practice', label: 'Practice', description: 'Learn the game' },
  ];

  return <Select options={options} value={mode} onChange={setMode} label="Game Mode" required />;
}
```

### Searchable Select with Icons

```tsx
function CardYearSelect() {
  const [year, setYear] = useState(2025);

  const options = [
    { value: 2025, label: '2025 Card', icon: <CalendarIcon /> },
    { value: 2024, label: '2024 Card', icon: <CalendarIcon /> },
    { value: 2023, label: '2023 Card', icon: <CalendarIcon /> },
    // ... more years
  ];

  return (
    <Select
      options={options}
      value={year}
      onChange={setYear}
      label="Card Year"
      searchable
      searchPlaceholder="Search years..."
    />
  );
}
```

### Multi-Select

```tsx
function PlayerInviteSelect() {
  const [invited, setInvited] = useState<string[]>([]);

  const options = players.map((p) => ({
    value: p.id,
    label: p.name,
    icon: <Avatar src={p.avatar} />,
  }));

  return (
    <Select
      options={options}
      value={invited}
      onChange={setInvited}
      label="Invite Players"
      multiple
      searchable
      placeholder="Select players to invite"
    />
  );
}
```

### Grouped Select

```tsx
function SettingsSelect() {
  const options = [
    { value: 'beginner', label: 'Beginner AI', category: 'AI Difficulty' },
    { value: 'intermediate', label: 'Intermediate AI', category: 'AI Difficulty' },
    { value: 'expert', label: 'Expert AI', category: 'AI Difficulty' },
    { value: 'casual', label: 'Casual', category: 'Game Mode' },
    { value: 'ranked', label: 'Ranked', category: 'Game Mode' },
  ];

  return (
    <Select
      options={options}
      value={setting}
      onChange={setSetting}
      label="Settings"
      groupBy={(option) => option.category!}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.select-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.select-wrapper--full-width {
  width: 100%;
}

/* Label */
.select__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.select__label--required::after {
  content: '*';
  color: var(--color-error);
  margin-left: var(--space-1);
}

/* Trigger */
.select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.select__trigger:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.select__trigger:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
}

.select__trigger--open {
  border-color: var(--color-primary);
}

.select__trigger--error {
  border-color: var(--color-error);
}

.select__trigger:disabled {
  background: var(--color-background-secondary);
  color: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Size variants */
.select__trigger--small {
  height: 2rem;
  padding: 0 var(--space-2);
  font-size: var(--text-sm);
}

.select__trigger--medium {
  height: 2.5rem;
  padding: 0 var(--space-3);
  font-size: var(--text-base);
}

.select__trigger--large {
  height: 3rem;
  padding: 0 var(--space-4);
  font-size: var(--text-lg);
}

/* Trigger content */
.select__value {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select__placeholder {
  color: var(--color-text-disabled);
}

.select__chevron {
  margin-left: var(--space-2);
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s ease;
}

.select__chevron--open {
  transform: rotate(180deg);
}

/* Dropdown panel */
.select__dropdown {
  position: absolute;
  z-index: 50;
  min-width: 100%;
  max-height: 300px;
  overflow-y: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  margin-top: var(--space-1);
}

/* Search input */
.select__search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
}

.select__search-input {
  width: 100%;
  padding: var(--space-2);
  padding-left: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.select__search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

/* Options */
.select__options {
  padding: var(--space-1) 0;
}

.select__group {
  margin-top: var(--space-2);
}

.select__group:first-child {
  margin-top: 0;
}

.select__group-header {
  position: sticky;
  top: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-background-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.select__option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: background 0.15s ease;
}

.select__option:hover:not(.select__option--disabled) {
  background: var(--color-background-secondary);
}

.select__option--focused {
  background: var(--color-background-secondary);
}

.select__option--selected {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-medium);
}

.select__option--disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

.select__option-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.select__option-content {
  flex: 1;
}

.select__option-label {
  font-size: var(--text-base);
}

.select__option-description {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-0-5);
}

.select__option-check {
  margin-left: auto;
  width: 1rem;
  height: 1rem;
  color: var(--color-primary);
}

/* Multi-select tags */
.select__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  max-width: calc(100% - 2rem);
}

.select__tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0-5) var(--space-2);
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
}

.select__tag-remove {
  cursor: pointer;
  width: 0.875rem;
  height: 0.875rem;
}

.select__tag-remove:hover {
  color: var(--color-error);
}

/* Helper/Error text */
.select__helper-text {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.select__error-text {
  color: var(--color-error);
}

/* Empty state */
.select__empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-disabled);
  font-size: var(--text-sm);
}
```

## Future Enhancements

- [ ] Virtualized scrolling for 1000+ options
- [ ] Async option loading (remote data)
- [ ] Create new option on-the-fly
- [ ] Customizable keyboard shortcuts
- [ ] Option icons with tooltips
- [ ] Drag-to-reorder selected items (multi-select)
- [ ] Fuzzy search instead of exact match
- [ ] Recent selections quick access
- [ ] Favorites/pinned options

## Notes

- Always use controlled component pattern (value + onChange)
- Dropdown should close on option select (single-select)
- Dropdown stays open for multi-select (allows multiple selections)
- Search should be case-insensitive by default
- Options should be virtualized for performance with 100+ items
- Dropdown position should flip if near viewport edge
- Multi-select tags should be removable individually
- Keyboard navigation essential for accessibility
- Focus should return to trigger when dropdown closes
- Empty state should guide user (e.g., "No options available")
- Grouped options improve scannability for large option sets
- Custom option rendering allows rich content (avatars, badges, etc.)
- Searchable variant critical for 20+ options
