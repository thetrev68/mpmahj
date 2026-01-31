# Modal Component Specification

## Component Type

Presentational Component

## Purpose

Displays overlay dialogs for confirmations, forms, and important information that requires user attention. Manages focus trapping and backdrop interaction.

## Related User Stories

- US-007: Declare Win Intent (mahjong confirmation modal)
- US-013: Abandon Game (confirmation dialog)
- US-020: Join Game Room (join confirmation modal)
- US-021: Room Configuration (settings modal)
- US-033: Leave Game Confirmation (leave dialog)

## TypeScript Interface

````typescript
export interface ModalProps {
  /** Whether modal is visible */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Modal title */
  title?: React.ReactNode;

  /** Modal content */
  children: React.ReactNode;

  /** Footer content (typically buttons) */
  footer?: React.ReactNode;

  /** Size variant */
  size?: 'small' | 'medium' | 'large' | 'full';

  /** Whether clicking backdrop closes modal */
  closeOnBackdropClick?: boolean;

  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;

  /** Whether to show close button */
  showCloseButton?: boolean;

  /** Disable scroll on body when open */
  preventBodyScroll?: boolean;

  /** Initial focus element ref */
  initialFocusRef?: React.RefObject<HTMLElement>;

  /** Final focus element ref (return focus on close) */
  finalFocusRef?: React.RefObject<HTMLElement>;

  /** Additional CSS classes for modal content */
  className?: string;

  /** Z-index override */
  zIndex?: number;

  /** Test ID */
  testId?: string;
}
```text

## Internal State

```typescript
interface ModalState {
  /** Whether modal is in enter/exit transition */
  isTransitioning: boolean;

  /** Focus trap state */
  focusTrapActive: boolean;
}
```text

## State Management

**Internal useState** for transition and focus management. Open/close state managed by parent.

## Visual Design

### Size Variants

- **small**: 400px max-width - Confirmations, simple dialogs
- **medium**: 600px max-width - Default, forms, settings
- **large**: 800px max-width - Complex forms, detailed content
- **full**: 95vw max-width - Full-screen on mobile, large content

### Layout Structure

```text
[Backdrop - 50% black overlay]
  └─ [Modal Container - centered]
      ├─ [Header]
      │   ├─ Title
      │   └─ Close Button (X)
      ├─ [Body - scrollable]
      │   └─ children content
      └─ [Footer - sticky]
          └─ Action buttons
```text

### Visual Appearance

- **Backdrop**: `background: rgba(0, 0, 0, 0.5)`, backdrop-filter blur
- **Modal**: `background: var(--color-background)`, `shadow: var(--shadow-2xl)`
- **Border radius**: `var(--radius-xl)` (12px)
- **Header**: Border-bottom 1px, padding 1.5rem
- **Body**: Padding 1.5rem, max-height 70vh, overflow-y auto
- **Footer**: Border-top 1px, padding 1rem, flex justify-end

### Animation Sequence

#### Enter Animation (200ms)

1. Backdrop: Fade in from opacity 0 → 1
2. Modal: Scale from 0.95 → 1, opacity 0 → 1
3. Easing: ease-out

#### Exit Animation (150ms)

1. Modal: Scale from 1 → 0.95, opacity 1 → 0
2. Backdrop: Fade out from opacity 1 → 0
3. Easing: ease-in

### Display States

1. **Closed**: Display none, not in DOM
2. **Opening**: Enter animation, focus trap activating
3. **Open**: Fully visible, focus trapped
4. **Closing**: Exit animation, focus trap deactivating
5. **Closed**: Removed from DOM, focus returned

## Accessibility

### ARIA Attributes

- `role="dialog"` on modal container
- `aria-modal="true"` to indicate modal behavior
- `aria-labelledby={titleId}` linking to title
- `aria-describedby={contentId}` linking to content
- Focus trap within modal (no tabbing to background)

### Keyboard Support

- `Escape`: Close modal (if `closeOnEscape={true}`)
- `Tab`: Cycle focus within modal (focus trap)
- `Shift+Tab`: Reverse cycle focus
- First/last element wraps focus

### Screen Reader Announcements

- On open: "Dialog opened, {title}"
- On close: Focus returns to trigger element
- Backdrop: `aria-hidden="true"` (not announced)

### Focus Management

1. **On open**:
   - Store currently focused element
   - Move focus to `initialFocusRef` or first focusable element
   - Activate focus trap
2. **While open**:
   - Tab cycles through modal elements only
   - Background content inert (not focusable)
3. **On close**:
   - Deactivate focus trap
   - Return focus to `finalFocusRef` or originally focused element

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useRef`, `useCallback`)
- `focus-trap-react` - Focus trapping utility
- `react-portal` or `ReactDOM.createPortal` - Render outside root
- `clsx` for conditional class names

### Internal

- `@/components/icons/CloseIcon` - Close button icon
- `@/components/ui/Button` - Footer buttons
- `@/hooks/useLockBodyScroll` - Prevent page scroll when open
- `@/hooks/useEscapeKey` - Escape key handler
- `@/styles/modal.module.css` - Component styles

### Generated Types

None - uses primitive React types

## Implementation Notes

### Performance Optimizations

1. **Portal rendering**: Render modal outside app root to avoid z-index issues
2. **Lazy mounting**: Only mount modal when `isOpen={true}`
3. **Animation via CSS**: Use CSS transitions, not JavaScript
4. **Body scroll lock**: Prevent scroll on background during modal

### Focus Trap Implementation

```typescript
useEffect(() => {
  if (!isOpen) return;

  // Store current focus
  const previousFocus = document.activeElement;

  // Focus initial element or first focusable
  const initialElement =
    initialFocusRef?.current || modalRef.current?.querySelector('[tabindex="0"]');
  initialElement?.focus();

  // Return focus on unmount
  return () => {
    finalFocusRef?.current?.focus() || previousFocus?.focus();
  };
}, [isOpen]);
```text

### Error Handling

- Missing title: Render modal without header (body only)
- Invalid size: Fall back to 'medium'
- Portal mount failure: Fall back to inline rendering with warning
- Focus trap error: Log warning, continue without trap

### Responsive Behavior

- Mobile (<768px): Full-width with padding, full-height available
- Tablet: Sized modal with margins
- Desktop: Centered modal with size constraints
- Touch devices: Swipe-down to close gesture (optional enhancement)

## Test Scenarios

### Unit Tests

```typescript
describe('Modal', () => {
  it('renders when isOpen is true', () => {
    // isOpen=true should render modal
  });

  it('does not render when isOpen is false', () => {
    // isOpen=false should not render
  });

  it('renders title correctly', () => {
    // title prop should display in header
  });

  it('renders children content', () => {
    // children should render in modal body
  });

  it('renders footer when provided', () => {
    // footer prop should render in modal footer
  });

  it('calls onClose when close button clicked', () => {
    // Close button should trigger onClose
  });

  it('calls onClose when backdrop clicked', () => {
    // closeOnBackdropClick=true, backdrop click should close
  });

  it('does not close on backdrop click when disabled', () => {
    // closeOnBackdropClick=false should prevent close
  });

  it('calls onClose when Escape pressed', () => {
    // closeOnEscape=true, Escape should close
  });

  it('applies size class correctly', () => {
    // size='large' should apply large width
  });

  it('hides close button when showCloseButton=false', () => {
    // Close button should not render
  });

  it('locks body scroll when open', () => {
    // preventBodyScroll=true should prevent scroll
  });
});
```text

### Integration Tests

```typescript
describe('Modal Integration', () => {
  it('traps focus within modal', () => {
    // Tab should cycle within modal elements
  });

  it('returns focus on close', () => {
    // Close should return focus to trigger
  });

  it('focuses initial element on open', () => {
    // initialFocusRef should receive focus
  });

  it('renders in portal outside root', () => {
    // Modal should render outside app container
  });

  it('animates on open/close', () => {
    // Transitions should play
  });
});
```text

### Visual Regression Tests

- All size variants
- With and without header/footer
- Open/close animation frames
- Mobile fullscreen layout
- Backdrop blur effect

## Usage Examples

### Confirmation Dialog

```tsx
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

function ConfirmAbandonModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Abandon Game?"
      size="small"
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Abandon
          </Button>
        </>
      }
    >
      <p>Are you sure you want to abandon this game? This action cannot be undone.</p>
    </Modal>
  );
}
```text

### Settings Form

```tsx
function SettingsModal({ isOpen, onClose, onSave }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Game Settings"
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save Settings
          </Button>
        </>
      }
    >
      <form className="settings-form">{/* Settings controls */}</form>
    </Modal>
  );
}
```text

### Full-Screen Content

```tsx
function CardViewerModal({ isOpen, onClose, card }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${card.year} Mahjong Card`}
      size="full"
      closeOnEscape
    >
      <div className="card-viewer-content">{/* Full card display */}</div>
    </Modal>
  );
}
```text

### No Header Modal

```tsx
function ImagePreviewModal({ isOpen, onClose, imageUrl }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large" showCloseButton closeOnBackdropClick>
      <img src={imageUrl} alt="Preview" className="full-width" />
    </Modal>
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background: var(--color-background);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  position: relative;
}

/* Size variants */
.modal--small {
  max-width: 400px;
}
.modal--medium {
  max-width: 600px;
}
.modal--large {
  max-width: 800px;
}
.modal--full {
  max-width: 95vw;
}

/* Header */
.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-border);
}

.modal__title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin: 0;
}

.modal__close {
  padding: var(--space-2);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-md);
}

.modal__close:hover {
  background: var(--color-surface);
}

/* Body */
.modal__body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
}

/* Footer */
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
}

/* Animations */
.modal-enter {
  opacity: 0;
}

.modal-enter .modal {
  transform: scale(0.95);
}

.modal-enter-active {
  opacity: 1;
  transition: opacity 200ms ease-out;
}

.modal-enter-active .modal {
  transform: scale(1);
  transition: transform 200ms ease-out;
}

.modal-exit {
  opacity: 1;
}

.modal-exit-active {
  opacity: 0;
  transition: opacity 150ms ease-in;
}

.modal-exit-active .modal {
  transform: scale(0.95);
  transition: transform 150ms ease-in;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal {
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .modal-backdrop {
    padding: 0;
  }
}
```text

## Future Enhancements

- [ ] Stacked modals support (multiple modals open)
- [ ] Slide-in panel variant (side drawer)
- [ ] Swipe-to-dismiss on mobile
- [ ] Custom backdrop colors/blur
- [ ] Confirm-before-close prompt
- [ ] Auto-height adjustment
- [ ] Fullscreen mode toggle
- [ ] Persistent modal (survives page navigation)

## Notes

- Always render modals via portal to avoid z-index stacking issues
- Focus management critical for accessibility
- Backdrop click to close improves UX but shouldn't be forced
- Escape key should close non-critical modals
- Body scroll lock prevents confusing scroll behavior
- Size variants should adapt to content, not force content to fit
- Footer buttons typically right-aligned (confirm on right, cancel on left)
- Mobile modals often better as full-screen for usability
````
