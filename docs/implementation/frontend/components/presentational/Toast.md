# Toast Component Specification

## Component Type

Presentational Component (Global Notification)

## Purpose

Displays temporary overlay notifications for transient feedback (auto-dismissing messages). Provides non-intrusive visual feedback for background actions, confirmations, and status updates.

## Related User Stories

- US-010: Discarding a Tile (confirmation toast)
- US-013: Calling Pung/Kong/Quint (success toast)
- US-018: Declaring Mahjong (celebration toast)
- US-027: Request Hints (hint update toast)
- US-035: Animation Settings (settings saved toast)

## TypeScript Interface

```typescript
export interface ToastProps {
  /** Toast variant */
  variant?: 'info' | 'success' | 'warning' | 'error';

  /** Toast message */
  message: string;

  /** Optional title */
  title?: string;

  /** Auto-dismiss duration (ms), 0 = manual dismiss */
  duration?: number;

  /** Position on screen */
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

  /** Show progress bar */
  showProgress?: boolean;

  /** Action button */
  action?: ToastAction;

  /** Callback when dismissed */
  onDismiss?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastContextValue {
  /** Show toast */
  showToast: (toast: Omit<ToastProps, 'onDismiss'>) => string;

  /** Dismiss specific toast */
  dismissToast: (id: string) => void;

  /** Dismiss all toasts */
  dismissAll: () => void;
}
```text

## Internal State

```typescript
interface ToastState {
  /** Whether toast is visible */
  isVisible: boolean;

  /** Remaining time (for progress bar) */
  remainingTime: number;

  /** Whether paused (on hover) */
  isPaused: boolean;
}
```text

## State Management

**Global Context** (`ToastProvider`) manages toast queue. Individual toast uses internal state for animation and timing.

## Visual Design

### Variant Styles

#### Info

- **Background**: `var(--color-background)` with blue accent
- **Icon**: ℹ️ Info circle
- **Border**: `var(--color-info)`
- **Use for**: General notifications, FYI messages

#### Success

- **Background**: `var(--color-background)` with green accent
- **Icon**: ✓ Checkmark
- **Border**: `var(--color-success)`
- **Use for**: Successful actions, confirmations

#### Warning

- **Background**: `var(--color-background)` with amber accent
- **Icon**: ⚠️ Warning
- **Border**: `var(--color-warning)`
- **Use for**: Important notices, non-critical issues

#### Error

- **Background**: `var(--color-background)` with red accent
- **Icon**: ✕ Error
- **Border**: `var(--color-error)`
- **Use for**: Errors, failed actions

### Toast Layout

```text
+------------------------------------+
| [✓] Tile discarded              [×]|
|     You discarded 5 Bam.           |
|     [Undo]                         |
| [████████████░░░░] 60%             |
+------------------------------------+
```text

### Structure

- **Container**: Fixed position overlay, rounded corners, shadow
- **Icon**: Left-aligned, 20px icon
- **Content**: Title (optional, bold) + message
- **Dismiss**: Right-aligned X button
- **Action**: Optional action button (bottom)
- **Progress**: Bottom progress bar (if showProgress=true)

### Positioning

Default positions with stacking:

- **top-right** (default): Stack from top-right corner, 16px from edges
- **top-center**: Centered horizontally, stack vertically
- **bottom-right**: Stack from bottom-right corner
- Multiple toasts stack with 12px gap

### Dimensions

- **Width**: 320px (desktop), 100% - 32px (mobile)
- **Max height**: 200px (scrollable content)
- **Padding**: `var(--space-4)` (16px)

### Animation

#### Enter

- Slide in from edge (200ms ease-out)
- Fade in (200ms)

#### Exit

- Slide out to edge (200ms ease-in)
- Fade out (200ms)

### Timing

- **Default duration**: 4000ms (4 seconds)
- **Error duration**: 6000ms (6 seconds, longer for reading)
- **Success duration**: 3000ms (3 seconds, shorter)
- **Manual dismiss**: duration = 0

### Interaction

- **Hover**: Pause auto-dismiss timer
- **Click dismiss**: Immediate dismissal
- **Click action**: Execute action + dismiss
- **Swipe**: Dismiss (mobile)

## Accessibility

### ARIA Attributes

- `role="status"` for info/success
- `role="alert"` for warning/error
- `aria-live="polite"` for info/success
- `aria-live="assertive"` for warning/error
- `aria-atomic="true"` (announce entire message)
- `aria-label` for dismiss button

### Keyboard Support

- **Escape**: Dismiss focused toast
- **Tab**: Navigate to action button and dismiss
- **Enter/Space**: Activate focused button

### Screen Reader Support

- Announce toast content when shown
- Announce "Toast dismissed" when closed
- Read progress percentage (if shown)

### Visual Accessibility

- High contrast text
- Icon + color (not color alone)
- Focus visible on buttons
- Minimum touch target 44px

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useRef`, `useContext`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Button` - Action buttons
- `@/components/icons/*` - Variant icons
- `@/contexts/ToastContext` - Global toast management
- `@/styles/toast.module.css` - Component styles

## Implementation Notes

### Toast Queue Management

```typescript
const ToastProvider: React.FC = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<ToastProps, 'onDismiss'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};
```text

### Auto-Dismiss Timer

```typescript
useEffect(() => {
  if (duration === 0 || !isVisible || isPaused) return;

  const timer = setTimeout(() => {
    handleDismiss();
  }, duration);

  return () => clearTimeout(timer);
}, [duration, isVisible, isPaused]);
```text

### Progress Bar

```typescript
useEffect(() => {
  if (!showProgress || duration === 0 || !isVisible || isPaused) return;

  const interval = setInterval(() => {
    setRemainingTime((prev) => Math.max(0, prev - 50));
  }, 50);

  return () => clearInterval(interval);
}, [showProgress, duration, isVisible, isPaused]);

const progress = (remainingTime / duration) * 100;
```text

### Pause on Hover

```typescript
<div
  className={styles.toast}
  onMouseEnter={() => setIsPaused(true)}
  onMouseLeave={() => setIsPaused(false)}
>
  {/* toast content */}
</div>
```text

## Test Scenarios

### Unit Tests

```typescript
describe('Toast', () => {
  it('renders message correctly', () => {});
  it('applies variant styles', () => {});
  it('shows dismiss button', () => {});
  it('calls onDismiss when dismissed', () => {});
  it('auto-dismisses after duration', () => {});
  it('pauses on hover', () => {});
  it('resumes on mouse leave', () => {});
  it('shows progress bar when enabled', () => {});
  it('renders action button', () => {});
  it('calls action onClick', () => {});
  it('dismisses after action', () => {});
  it('does not auto-dismiss when duration=0', () => {});
  it('applies correct ARIA role', () => {});
});
```text

### Integration Tests

```typescript
describe('Toast Context', () => {
  it('shows toast via context', () => {});
  it('dismisses toast via context', () => {});
  it('stacks multiple toasts', () => {});
  it('dismisses all toasts', () => {});
});
```text

### Visual Regression Tests

- All variants
- All positions
- With/without title
- With/without action
- With/without progress bar
- Multiple toasts stacked

## Usage Examples

### Basic Toast

```tsx
import { useToast } from '@/contexts/ToastContext';

function DiscardAction() {
  const { showToast } = useToast();

  const handleDiscard = () => {
    // Discard tile logic...

    showToast({
      variant: 'success',
      message: 'You discarded 5 Bam.',
      duration: 3000,
    });
  };

  return <button onClick={handleDiscard}>Discard</button>;
}
```text

### Toast with Action

```tsx
function UndoableAction() {
  const { showToast } = useToast();

  const handleAction = () => {
    // Perform action...

    showToast({
      variant: 'info',
      message: 'Tile discarded.',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          // Undo logic
        },
      },
    });
  };
}
```text

### Error Toast

```tsx
function ErrorExample() {
  const { showToast } = useToast();

  const handleError = () => {
    showToast({
      variant: 'error',
      title: 'Connection Lost',
      message: 'Failed to connect to server. Retrying...',
      duration: 6000,
      showProgress: true,
    });
  };
}
```text

### Manual Dismiss

```tsx
function PersistentNotification() {
  const { showToast, dismissToast } = useToast();

  const showPersistent = () => {
    const id = showToast({
      variant: 'warning',
      message: 'Your turn will expire in 30 seconds.',
      duration: 0, // Manual dismiss only
    });

    // Dismiss after custom condition
    setTimeout(() => dismissToast(id), 30000);
  };
}
```text

## Style Guidelines

### CSS Module Structure

```css
.toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

.toast-container--top-right {
  top: var(--space-4);
  right: var(--space-4);
}

.toast-container--top-center {
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
}

.toast-container--bottom-right {
  bottom: var(--space-4);
  right: var(--space-4);
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-end;
}

.toast {
  width: 320px;
  max-width: calc(100vw - 32px);
  background: var(--color-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.toast--enter {
  animation: toast-enter 0.2s ease-out;
}

.toast--exit {
  animation: toast-exit 0.2s ease-in;
}

@keyframes toast-enter {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toast-exit {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast__content {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
}

.toast__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.toast--info .toast__icon {
  color: var(--color-info);
}

.toast--success .toast__icon {
  color: var(--color-success);
}

.toast--warning .toast__icon {
  color: var(--color-warning);
}

.toast--error .toast__icon {
  color: var(--color-error);
}

.toast__text {
  flex: 1;
  min-width: 0;
}

.toast__title {
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-1);
}

.toast__message {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.toast__dismiss {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-disabled);
  cursor: pointer;
  opacity: 0.6;
}

.toast__dismiss:hover {
  opacity: 1;
}

.toast__action {
  padding: 0 var(--space-4) var(--space-3);
}

.toast__progress {
  height: 4px;
  background: var(--color-border);
}

.toast__progress-bar {
  height: 100%;
  transition: width 0.05s linear;
}

.toast--info .toast__progress-bar {
  background: var(--color-info);
}

.toast--success .toast__progress-bar {
  background: var(--color-success);
}

.toast--warning .toast__progress-bar {
  background: var(--color-warning);
}

.toast--error .toast__progress-bar {
  background: var(--color-error);
}

@media (max-width: 640px) {
  .toast-container {
    left: var(--space-4);
    right: var(--space-4);
  }

  .toast {
    width: 100%;
  }
}
```text

## Future Enhancements

- [ ] Toast grouping (collapse similar toasts)
- [ ] Swipe-to-dismiss gesture
- [ ] Sound effects (optional)
- [ ] Custom animation presets
- [ ] Toast history panel
- [ ] Priority queue (urgent toasts first)
- [ ] Rich content (images, links)
- [ ] Multi-line actions
- [ ] Expandable details
- [ ] Persist across page reloads
- [ ] Network status integration
- [ ] Undo queue for multiple actions

## Notes

- Toast for transient feedback, Alert for persistent messages
- Keep messages concise (1 line preferred, 2 max)
- Don't spam toasts - batch similar notifications
- Error toasts should auto-dismiss slower (users need time to read)
- Success toasts can auto-dismiss faster (brief confirmation)
- Manual dismiss for critical information
- Action button for quick undo/retry
- Progress bar shows remaining time visually
- Pause on hover prevents premature dismissal
- Stack toasts in reading order (newest on top)
- Maximum 3-5 toasts visible simultaneously
- Auto-dismiss old toasts when queue exceeds limit
- Position based on screen region (avoid blocking important UI)
- Mobile: full-width, bottom position preferred
- Accessible to keyboard and screen readers
- Color + icon (not color alone)
- Toast should not steal focus
- Screen reader announces content immediately
