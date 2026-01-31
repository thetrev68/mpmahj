# Alert Component Specification

## Component Type

**Presentational Component**

## Purpose

Displays important contextual messages to users within the page flow (static notifications). Provides visual feedback for success, warnings, errors, and informational messages. Unlike Toast (temporary), Alert remains visible until dismissed.

## Related User Stories

- US-020: Invalid Mahjong (error alerts for dead hand)
- US-021: Wall Game Draw (info alert for draw condition)
- US-033: Abandon Game Voting (warning alerts for voting)
- US-034: Configure House Rules (info alerts for rule changes)

## TypeScript Interface

```typescript
export interface AlertProps {
  /** Alert variant */
  variant?: 'info' | 'success' | 'warning' | 'error';

  /** Alert title */
  title?: string;

  /** Alert message */
  message: string;

  /** Show dismiss button */
  dismissible?: boolean;

  /** Callback when dismissed */
  onDismiss?: () => void;

  /** Icon to display (overrides default) */
  icon?: React.ReactNode;

  /** Additional action buttons */
  actions?: AlertAction[];

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}
```

## Internal State

```typescript
interface AlertState {
  /** Whether alert is visible (for dismissal animation) */
  isVisible: boolean;
}
```

## State Management

**Internal useState** for visibility animation. Parent controls mounting/unmounting.

## Visual Design

### Variant Styles

#### Info (Default)

- **Background**: `var(--color-info-light)` (light blue)
- **Border**: `var(--color-info)` (blue)
- **Icon**: ℹ️ Information circle
- **Text**: `var(--color-info-dark)`
- **Use for**: General information, tips, FYI messages

#### Success

- **Background**: `var(--color-success-light)` (light green)
- **Border**: `var(--color-success)` (green)
- **Icon**: ✓ Checkmark circle
- **Text**: `var(--color-success-dark)`
- **Use for**: Successful actions, confirmations

#### Warning

- **Background**: `var(--color-warning-light)` (light amber)
- **Border**: `var(--color-warning)` (amber)
- **Icon**: ⚠️ Warning triangle
- **Text**: `var(--color-warning-dark)`
- **Use for**: Caution messages, important notices

#### Error

- **Background**: `var(--color-error-light)` (light red)
- **Border**: `var(--color-error)` (red)
- **Icon**: ✕ Error circle
- **Text**: `var(--color-error-dark)`
- **Use for**: Errors, validation failures, critical issues

### Alert Layout

```
+--------------------------------------------------------------+
| [Icon]  Dead Hand                                        [×] |
|         You have the wrong number of tiles (15).             |
|         You cannot win this hand.                            |
|                                                              |
|         [View Hand]  [Continue]                              |
+--------------------------------------------------------------+
```

### Structure

- **Container**: Full-width box with rounded corners
- **Icon**: Left-aligned, 24px circle icon
- **Content**: Title (bold) + message (regular)
- **Dismiss**: Right-aligned X button (if dismissible)
- **Actions**: Bottom-aligned buttons (optional)

### Spacing

- **Padding**: `var(--space-4)` (16px)
- **Icon spacing**: `var(--space-3)` (12px) from content
- **Title to message**: `var(--space-1)` (4px)
- **Message to actions**: `var(--space-3)` (12px)
- **Between actions**: `var(--space-2)` (8px)

### Border

- **Width**: 1px left border (accent color)
- **Radius**: `var(--radius-md)` (8px)

### Typography

- **Title**: `var(--text-base)`, `var(--font-semibold)`
- **Message**: `var(--text-sm)`, `var(--font-normal)`

## Accessibility

### ARIA Attributes

- `role="alert"` for errors/warnings
- `role="status"` for info/success
- `aria-live="polite"` for non-critical alerts
- `aria-live="assertive"` for errors/warnings
- `aria-labelledby` pointing to title (if present)
- `aria-describedby` pointing to message

### Keyboard Support

- **Tab**: Navigate to dismiss button and actions
- **Escape**: Dismiss alert (if dismissible)
- **Enter/Space**: Activate focused button

### Screen Reader Support

- Announce alert immediately when mounted
- Read title, then message, then available actions
- Announce dismissal: "Alert dismissed"

### Visual Accessibility

- High contrast text on colored backgrounds
- Icon + color coding (not color alone)
- Minimum 4.5:1 contrast ratio
- Focus visible on dismiss button

## Dependencies

### External

- React (hooks: `useState`, `useEffect`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Button` - Action buttons
- `@/components/icons/InfoIcon` - Info icon
- `@/components/icons/CheckCircleIcon` - Success icon
- `@/components/icons/WarningIcon` - Warning icon
- `@/components/icons/ErrorIcon` - Error icon
- `@/components/icons/CloseIcon` - Dismiss icon
- `@/styles/alert.module.css` - Component styles

## Implementation Notes

### Dismissal Animation

```typescript
const handleDismiss = () => {
  setIsVisible(false);

  // Wait for exit animation before calling onDismiss
  setTimeout(() => {
    onDismiss?.();
  }, 200); // Match CSS transition duration
};
```

### Default Icons

```typescript
const defaultIcons: Record<Variant, React.ReactNode> = {
  info: <InfoIcon />,
  success: <CheckCircleIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
};

const alertIcon = icon ?? defaultIcons[variant];
```

### ARIA Role Selection

```typescript
const getRole = (variant: Variant): string => {
  return variant === 'error' || variant === 'warning' ? 'alert' : 'status';
};

const getAriaLive = (variant: Variant): 'polite' | 'assertive' => {
  return variant === 'error' || variant === 'warning' ? 'assertive' : 'polite';
};
```

## Test Scenarios

### Unit Tests

```typescript
describe('Alert', () => {
  it('renders message correctly', () => {
    // Should display message text
  });

  it('renders title when provided', () => {
    // Should display title above message
  });

  it('applies variant styles', () => {
    // info/success/warning/error should have different colors
  });

  it('shows default icon for variant', () => {
    // Each variant should show appropriate icon
  });

  it('allows custom icon override', () => {
    // icon prop should override default
  });

  it('shows dismiss button when dismissible', () => {
    // dismissible=true should show X button
  });

  it('hides dismiss button when not dismissible', () => {
    // dismissible=false should hide X button
  });

  it('calls onDismiss when dismissed', () => {
    // Clicking X should call onDismiss callback
  });

  it('dismisses on Escape key', () => {
    // Pressing Escape should call onDismiss
  });

  it('renders action buttons', () => {
    // actions array should render buttons
  });

  it('calls action onClick handlers', () => {
    // Clicking action button should call onClick
  });

  it('applies correct ARIA role', () => {
    // Error/warning should have role="alert", others "status"
  });

  it('applies correct aria-live', () => {
    // Error/warning should be assertive, others polite
  });
});
```

### Integration Tests

```typescript
describe('Alert Integration', () => {
  it('announces to screen readers', () => {
    // Should announce alert content when mounted
  });

  it('animates dismissal', () => {
    // Should fade out before unmounting
  });

  it('focuses dismiss button on mount', () => {
    // Keyboard focus should move to dismiss button
  });
});
```

### Visual Regression Tests

- All variants (info, success, warning, error)
- With and without title
- With and without dismiss button
- With and without action buttons
- Long message text wrapping
- Multiple alerts stacked

## Usage Examples

### Basic Info Alert

```tsx
import { Alert } from '@/components/ui/Alert';

function GameInfo() {
  return <Alert variant="info" message="Charleston will begin after all players are ready." />;
}
```

### Success with Dismissal

```tsx
function SettingsSaved() {
  const [showAlert, setShowAlert] = useState(true);

  if (!showAlert) return null;

  return (
    <Alert
      variant="success"
      title="Settings Saved"
      message="Your preferences have been updated successfully."
      dismissible
      onDismiss={() => setShowAlert(false)}
    />
  );
}
```

### Error with Actions

```tsx
function DeadHandAlert({ onViewHand, onContinue }) {
  return (
    <Alert
      variant="error"
      title="Dead Hand"
      message="You have the wrong number of tiles (15). You cannot win this hand."
      actions={[
        { label: 'View Hand', onClick: onViewHand, variant: 'secondary' },
        { label: 'Continue', onClick: onContinue, variant: 'primary' },
      ]}
    />
  );
}
```

### Warning for Voting

```tsx
function AbandonVoteAlert({ votesFor, votesNeeded }) {
  return (
    <Alert
      variant="warning"
      title="Abandon Game Vote"
      message={`${votesFor} of ${votesNeeded} players have voted to abandon the game.`}
      dismissible={false}
    />
  );
}
```

### Custom Icon

```tsx
function PatternAlert() {
  return (
    <Alert
      variant="info"
      title="Pattern Suggestion"
      message="Consider switching to 'Consecutive Run' - you're 2 tiles away."
      icon={<TileIcon />}
    />
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border-left: 4px solid transparent;
  background: var(--color-background);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.alert--visible {
  opacity: 1;
  transform: translateY(0);
}

.alert--hidden {
  opacity: 0;
  transform: translateY(-8px);
}

/* Variant styles */
.alert--info {
  background: var(--color-info-light);
  border-left-color: var(--color-info);
  color: var(--color-info-dark);
}

.alert--success {
  background: var(--color-success-light);
  border-left-color: var(--color-success);
  color: var(--color-success-dark);
}

.alert--warning {
  background: var(--color-warning-light);
  border-left-color: var(--color-warning);
  color: var(--color-warning-dark);
}

.alert--error {
  background: var(--color-error-light);
  border-left-color: var(--color-error);
  color: var(--color-error-dark);
}

/* Icon */
.alert__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin-top: 2px; /* Align with title baseline */
}

.alert--info .alert__icon {
  color: var(--color-info);
}

.alert--success .alert__icon {
  color: var(--color-success);
}

.alert--warning .alert__icon {
  color: var(--color-warning);
}

.alert--error .alert__icon {
  color: var(--color-error);
}

/* Content */
.alert__content {
  flex: 1;
  min-width: 0; /* Allow text wrapping */
}

.alert__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
  line-height: 1.4;
}

.alert__message {
  font-size: var(--text-sm);
  line-height: 1.5;
  color: inherit;
}

/* Actions */
.alert__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* Dismiss button */
.alert__dismiss {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  align-self: flex-start;
  margin-top: 2px;
}

.alert__dismiss:hover {
  opacity: 1;
}

.alert__dismiss:focus {
  outline: 2px solid currentColor;
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Responsive */
@media (max-width: 640px) {
  .alert {
    padding: var(--space-3);
  }

  .alert__actions {
    flex-direction: column;
  }

  .alert__actions button {
    width: 100%;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .alert {
    transition: none;
  }
}
```

## Future Enhancements

- [ ] Auto-dismiss timer for transient alerts
- [ ] Progress bar for timed dismissal
- [ ] Expandable/collapsible details section
- [ ] Multiple messages in one alert (list format)
- [ ] Alert queue system (stack multiple alerts)
- [ ] Alert groups (category-based organization)
- [ ] Compact variant (smaller padding, no title)
- [ ] Inline variant (no background, border only)
- [ ] Sound notification option
- [ ] Persist dismissal state (localStorage)
- [ ] Animation presets (slide, fade, bounce)
- [ ] Custom color themes
- [ ] Icon animation (pulse, shake)

## Notes

- Alert vs. Toast: Alert is persistent (user must dismiss or take action), Toast is temporary (auto-dismisses)
- Alert is for in-context messages within page flow
- Toast is for global notifications overlaying content
- Use Alert for validation errors, form feedback, important warnings
- Use Toast for success confirmations, background process updates
- Alert should not stack - replace existing alert or show sequentially
- Multiple simultaneous alerts indicate poor UX design
- Keep messages concise (1-2 sentences max)
- Provide actionable next steps when possible
- Error alerts should explain what happened AND how to fix it
- Warning alerts should explain consequences of an action
- Info alerts should provide helpful context without blocking workflow
- Success alerts should confirm completion and next steps (optional)
- Dismissible alerts should not contain critical information users might miss
- Non-dismissible alerts should have clear actions to resolve
- Icon reinforces variant meaning (accessibility)
- Color alone should not convey meaning (icon + text required)
- Alert should be keyboard accessible (Tab to actions, Escape to dismiss)
- Screen reader should announce alert immediately (aria-live)
- Focus management: move focus to dismiss button on mount (optional)
- Alert should not steal focus from current task unless critical
- Consider placement: top of section, inline with content, or global
- Alert should be responsive: stack actions vertically on mobile
