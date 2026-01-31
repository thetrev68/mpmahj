# Tooltip Component Specification

## Component Type

Presentational Component

## Purpose

Contextual help popover that appears on hover or focus, providing additional information about UI elements, tiles, patterns, and game actions. Supports rich content including text, icons, and interactive elements.

## Related User Stories

- US-023: View Patterns (pattern details on hover)
- US-027: Defensive Strategy (explain why tiles are dangerous)
- US-029: Winning Probability (show calculation details)
- US-035: Keyboard Shortcuts (shortcut hints)
- All UI elements requiring contextual help

## TypeScript Interface

````typescript
export interface TooltipProps {
  /** Tooltip content */
  content: React.ReactNode;

  /** Element that triggers tooltip */
  children: React.ReactElement;

  /** Placement relative to trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';

  /** Trigger mode */
  trigger?: 'hover' | 'click' | 'focus' | 'manual';

  /** Delay before showing (ms) */
  showDelay?: number;

  /** Delay before hiding (ms) */
  hideDelay?: number;

  /** Whether tooltip is open (for manual control) */
  open?: boolean;

  /** Callback when tooltip opens */
  onOpenChange?: (open: boolean) => void;

  /** Whether tooltip has arrow */
  showArrow?: boolean;

  /** Max width of tooltip */
  maxWidth?: number;

  /** Theme variant */
  variant?: 'dark' | 'light' | 'info' | 'warning' | 'error';

  /** Whether content is interactive (stays open on hover) */
  interactive?: boolean;

  /** Offset from trigger (px) */
  offset?: number;

  /** Whether tooltip is disabled */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}
```text

## Internal State

```typescript
interface TooltipState {
  /** Whether tooltip is currently visible */
  isOpen: boolean;

  /** Current placement after auto-positioning */
  actualPlacement: Placement;
}
```text

## State Management

**Internal useState** for open/closed state and placement. Can be controlled or uncontrolled via `open` prop.

## Visual Design

### Variant Styles

#### Dark (Default)

- **Background**: `var(--color-tooltip-dark)` (#1f2937)
- **Text**: white (#ffffff)
- **Border**: none
- **Shadow**: `var(--shadow-lg)`
- Use for: General tooltips, default UI

#### Light

- **Background**: white (#ffffff)
- **Text**: `var(--color-text-primary)` (#111827)
- **Border**: 1px solid `var(--color-border)` (#d1d5db)
- **Shadow**: `var(--shadow-md)`
- Use for: Rich content, longer descriptions

#### Info

- **Background**: `var(--color-primary)` (#2563eb)
- **Text**: white
- **Icon**: Info icon, left side
- Use for: Informational hints

#### Warning

- **Background**: `var(--color-warning)` (#f59e0b)
- **Text**: `var(--color-text-primary)`
- **Icon**: Warning icon, left side
- Use for: Cautionary messages

#### Error

- **Background**: `var(--color-error)` (#ef4444)
- **Text**: white
- **Icon**: Error icon, left side
- Use for: Error explanations

### Tooltip Container

- **Max width**: 300px default (configurable)
- **Padding**: 8px 12px (compact), 12px 16px (standard)
- **Border radius**: `var(--radius-md)` (6px)
- **Font size**: `var(--text-sm)` (0.875rem)
- **Line height**: 1.4
- **Z-index**: 100
- **Pointer events**: none (for hover), auto (for interactive)

### Arrow

- **Size**: 8px × 8px
- **Color**: Matches tooltip background
- **Position**: Centered on edge, pointing to trigger
- **Shadow**: Matches tooltip (partial for seamless appearance)

### Positioning

- **Offset**: 8px from trigger by default
- **Auto-flip**: Flips to opposite side if near viewport edge
- **Auto-shift**: Shifts along axis to stay in viewport
- **Portal rendering**: Rendered in document.body to avoid z-index issues

### Animation

- **Entrance**: Fade in + slight translate (150ms ease-out)
- **Exit**: Fade out + slight translate (100ms ease-in)
- **Direction**: Translates from placement direction

## Accessibility

### ARIA Attributes

- `role="tooltip"` on tooltip element
- `aria-describedby` on trigger (links to tooltip ID)
- `id` on tooltip (unique identifier)
- `aria-hidden="true"` when closed
- `tabindex="-1"` on tooltip (not focusable)

### Keyboard Support

- **Escape**: Close tooltip (if trigger='click')
- **Tab**: Close tooltip and move to next element
- **Hover triggers**: Show on focus for keyboard users

### Screen Reader Support

- Tooltip content announced when trigger is focused
- "Press Escape to close" for click-triggered tooltips
- Tooltip ID linked via aria-describedby for association

### Visual Accessibility

- High contrast in all variants
- Sufficient padding and spacing
- Readable font size (min 0.875rem)
- Not relying on color alone (icons for variants)

## Dependencies

### External

- React (hooks: `useState`, `useRef`, `useEffect`, `useCallback`)
- `@floating-ui/react` - Tooltip positioning and collision detection
- `clsx` for conditional class names
- `framer-motion` (optional) - Smooth animations

### Internal

- `@/components/icons/` - Icon components (Info, Warning, Error)
- `@/hooks/useDelayedState` - Delay show/hide
- `@/hooks/useClickOutside` - Close on outside click (click trigger)
- `@/styles/tooltip.module.css` - Component styles

### Generated Types

None - uses standard React types

## Implementation Notes

### Positioning with Floating UI

```typescript
import { useFloating, shift, flip, offset as floatingOffset, arrow } from '@floating-ui/react';

const {
  x,
  y,
  strategy,
  refs,
  placement: actualPlacement,
} = useFloating({
  placement: placement === 'auto' ? 'top' : placement,
  middleware: [floatingOffset(offset), flip(), shift({ padding: 8 }), arrow({ element: arrowRef })],
});
```text

### Delayed Show/Hide

```typescript
const [showTimeout, setShowTimeout] = useState<number | null>(null);
const [hideTimeout, setHideTimeout] = useState<number | null>(null);

const handleShow = () => {
  if (hideTimeout) clearTimeout(hideTimeout);
  const timeout = window.setTimeout(() => setIsOpen(true), showDelay);
  setShowTimeout(timeout);
};

const handleHide = () => {
  if (showTimeout) clearTimeout(showTimeout);
  const timeout = window.setTimeout(() => setIsOpen(false), hideDelay);
  setHideTimeout(timeout);
};
```text

### Interactive Tooltip (Hover Persistence)

```typescript
// Keep tooltip open when hovering over tooltip itself
const handleTooltipMouseEnter = () => {
  if (interactive) {
    if (hideTimeout) clearTimeout(hideTimeout);
  }
};

const handleTooltipMouseLeave = () => {
  if (interactive) {
    handleHide();
  }
};
```text

### Portal Rendering

```typescript
import { createPortal } from 'react-dom';

return (
  <>
    {cloneElement(children, triggerProps)}
    {isOpen && createPortal(
      <div ref={refs.setFloating} style={{ position: strategy, top: y, left: x }}>
        {/* Tooltip content */}
      </div>,
      document.body
    )}
  </>
);
```text

### Performance Optimizations

1. **Lazy rendering**: Only render tooltip DOM when open
2. **Memoize content**: Use React.memo for complex content
3. **Debounce positioning**: Throttle position updates on scroll/resize
4. **CSS animations**: Use CSS transitions over JavaScript

## Test Scenarios

### Unit Tests

```typescript
describe('Tooltip', () => {
  it('renders trigger element', () => {
    // children should render normally
  });

  it('shows on hover', () => {
    // Hovering trigger should show tooltip
  });

  it('hides on mouse leave', () => {
    // Leaving trigger should hide tooltip
  });

  it('respects showDelay', () => {
    // Tooltip should appear after delay
  });

  it('respects hideDelay', () => {
    // Tooltip should disappear after delay
  });

  it('shows on focus', () => {
    // Focusing trigger should show tooltip (for keyboard)
  });

  it('hides on Escape key', () => {
    // Escape should close click-triggered tooltips
  });

  it('applies placement correctly', () => {
    // placement='top' should position tooltip above trigger
  });

  it('flips when near viewport edge', () => {
    // Auto-flip should prevent tooltip from going offscreen
  });

  it('shows arrow when enabled', () => {
    // showArrow should render arrow element
  });

  it('applies variant styles', () => {
    // variant='warning' should use warning colors
  });

  it('supports controlled mode', () => {
    // open prop should control visibility
  });

  it('stays open when hovering interactive tooltip', () => {
    // interactive=true should keep tooltip open
  });
});
```text

### Integration Tests

```typescript
describe('Tooltip Integration', () => {
  it('works with disabled elements', () => {
    // Tooltip on disabled button should still work (wrapper)
  });

  it('integrates with keyboard navigation', () => {
    // Tab key should show tooltip on focus
  });

  it('announces to screen readers', () => {
    // aria-describedby should link to tooltip
  });
});
```text

### Visual Regression Tests

- All placements (top, bottom, left, right)
- All variants (dark, light, info, warning, error)
- With and without arrow
- Long content (wrapping)
- Rich content (icons, formatting)

## Usage Examples

### Basic Tooltip

```tsx
import { Tooltip } from '@/components/ui/Tooltip';

function HelpButton() {
  return (
    <Tooltip content="Click to view help documentation">
      <button>Help</button>
    </Tooltip>
  );
}
```text

### Tile Information Tooltip

```tsx
function TileWithTooltip({ tile }) {
  const content = (
    <div>
      <strong>{tileToString(tile)}</strong>
      <p>Index: {tile}</p>
      <p>Available: 3 remaining</p>
    </div>
  );

  return (
    <Tooltip content={content} variant="light" showArrow>
      <TileImage tile={tile} />
    </Tooltip>
  );
}
```text

### Pattern Details Tooltip

```tsx
function PatternWithTooltip({ pattern }) {
  return (
    <Tooltip content={`${pattern.name} - ${pattern.points} points`} placement="top" showDelay={500}>
      <div className="pattern-summary">
        {pattern.section}.{pattern.patternNumber}
      </div>
    </Tooltip>
  );
}
```text

### Warning Tooltip

```tsx
function DangerousTileTooltip({ tile, reason }) {
  return (
    <Tooltip content={`⚠️ Dangerous: ${reason}`} variant="warning" showArrow>
      <TileImage tile={tile} />
    </Tooltip>
  );
}
```text

### Interactive Tooltip with Rich Content

```tsx
function KeyboardShortcutTooltip() {
  const content = (
    <div>
      <h4>Keyboard Shortcuts</h4>
      <ul>
        <li>
          <kbd>D</kbd> - Discard
        </li>
        <li>
          <kbd>E</kbd> - Expose Meld
        </li>
        <li>
          <kbd>S</kbd> - Sort Hand
        </li>
      </ul>
    </div>
  );

  return (
    <Tooltip content={content} variant="light" interactive maxWidth={400} trigger="click">
      <button>⌨️ Shortcuts</button>
    </Tooltip>
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
/* Tooltip container */
.tooltip {
  position: absolute;
  z-index: 100;
  max-width: 300px;
  padding: 0.5rem 0.75rem;
  font-size: var(--text-sm);
  line-height: 1.4;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  word-wrap: break-word;
}

.tooltip--interactive {
  pointer-events: auto;
}

/* Variants */
.tooltip--dark {
  background: var(--color-tooltip-dark);
  color: white;
}

.tooltip--light {
  background: white;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

.tooltip--info {
  background: var(--color-primary);
  color: white;
}

.tooltip--warning {
  background: var(--color-warning);
  color: var(--color-text-primary);
}

.tooltip--error {
  background: var(--color-error);
  color: white;
}

/* Arrow */
.tooltip__arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: inherit;
  transform: rotate(45deg);
}

.tooltip__arrow--top {
  bottom: -4px;
}

.tooltip__arrow--bottom {
  top: -4px;
}

.tooltip__arrow--left {
  right: -4px;
}

.tooltip__arrow--right {
  left: -4px;
}

/* Animations */
@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes tooltip-fade-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(4px);
  }
}

.tooltip--entering {
  animation: tooltip-fade-in 150ms ease-out;
}

.tooltip--exiting {
  animation: tooltip-fade-out 100ms ease-in;
}

/* Placement-specific animations */
.tooltip--top.tooltip--entering {
  animation: tooltip-fade-in-top 150ms ease-out;
}

@keyframes tooltip-fade-in-top {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tooltip--bottom.tooltip--entering {
  animation: tooltip-fade-in-bottom 150ms ease-out;
}

@keyframes tooltip-fade-in-bottom {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tooltip--left.tooltip--entering {
  animation: tooltip-fade-in-left 150ms ease-out;
}

@keyframes tooltip-fade-in-left {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.tooltip--right.tooltip--entering {
  animation: tooltip-fade-in-right 150ms ease-out;
}

@keyframes tooltip-fade-in-right {
  from {
    opacity: 0;
    transform: translateX(4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Rich content */
.tooltip h4 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.tooltip p {
  margin: var(--space-1) 0;
}

.tooltip ul {
  margin: var(--space-2) 0;
  padding-left: var(--space-4);
}

.tooltip li {
  margin: var(--space-1) 0;
}

.tooltip kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .tooltip {
    animation: none !important;
  }
}
```text

## Future Enhancements

- [ ] Multi-line arrow positioning
- [ ] Auto-dismiss timer
- [ ] Tooltip on mobile (tap to show, tap outside to hide)
- [ ] Tooltip groups (close others when one opens)
- [ ] Tooltip chaining (nested tooltips)
- [ ] Custom animation timing curves
- [ ] Lazy content loading (async tooltips)
- [ ] Tooltip statistics (track hover duration, click rate)
- [ ] Touch-friendly version with close button

## Notes

- Tooltips should be concise (1-2 sentences max for simple tooltips)
- Use `title` attribute as fallback (native browser tooltip)
- Interactive tooltips should have visual affordance (cursor changes)
- Avoid tooltips on mobile unless absolutely necessary (prefer inline help)
- Click-triggered tooltips useful for complex interactions
- Delay prevents tooltips from appearing on accidental hovers
- Auto-flip ensures tooltips never go offscreen
- Portal rendering prevents z-index and overflow issues
- Arrow provides visual connection to trigger element
- Variant colors should match semantic meaning (warning for dangerous tiles)
- Screen readers use aria-describedby, not tooltip text directly
- Keyboard users must be able to access tooltip content (focus trigger)
- Interactive tooltips stay open when hovering tooltip itself
- Max width prevents tooltips from becoming too wide
- Rich content tooltips better with light variant (easier to read)
- Tooltips should not contain critical information (users may not see them)
- Consider accessibility: tooltips are supplementary, not primary content
- Test with keyboard navigation and screen readers
````
