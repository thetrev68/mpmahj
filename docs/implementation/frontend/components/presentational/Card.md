# Card Component Specification

## Component Type

Presentational Component

## Purpose

Provides consistent container styling for content sections with optional headers, footers, and interactive states. Foundation for game panels, room listings, and information displays.

## Related User Stories

- US-020: Join Game Room (room cards in lobby)
- US-021: Room Configuration (settings panels)
- US-028: Hand Analysis Display (analysis panel card)
- US-029: Pattern Card Viewer (pattern cards)
- US-030: Game History Replay (history panel)

## TypeScript Interface

```typescript
export interface CardProps {
  /** Card content */
  children: React.ReactNode;

  /** Card header content (title, actions) */
  header?: React.ReactNode;

  /** Card footer content (actions, meta info) */
  footer?: React.ReactNode;

  /** Visual variant */
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';

  /** Padding size */
  padding?: 'none' | 'small' | 'medium' | 'large';

  /** Whether card is interactive (clickable) */
  interactive?: boolean;

  /** Click handler for interactive cards */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;

  /** Whether card is selected/active */
  isSelected?: boolean;

  /** Whether card is disabled */
  isDisabled?: boolean;

  /** Whether to show loading state */
  isLoading?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}
```

## State Management

**Stateless** - All state managed by parent components.

## Visual Design

### Variant Styles

#### Default

- Background: `var(--color-background)` (#ffffff)
- Border: 1px solid `var(--color-border)` (#d1d5db)
- Shadow: None
- Use for: Standard content containers

#### Elevated

- Background: `var(--color-background)` (#ffffff)
- Border: None
- Shadow: `var(--shadow-md)`
- Hover shadow: `var(--shadow-lg)` (if interactive)
- Use for: Cards that float above surface, room cards

#### Outlined

- Background: Transparent
- Border: 2px solid `var(--color-border)` (#d1d5db)
- Shadow: None
- Use for: Secondary cards, settings panels

#### Flat

- Background: `var(--color-surface)` (#f3f4f6)
- Border: None
- Shadow: None
- Use for: Embedded panels, analysis sections

### Padding Variants

- **none**: 0px - Full bleed content
- **small**: 0.75rem (`var(--space-3)`) - Compact cards
- **medium**: 1rem (`var(--space-4)`) - Default
- **large**: 1.5rem (`var(--space-6)`) - Spacious layouts

### Display States

1. **Default**: Base styles as defined by variant
2. **Hover** (if interactive):
   - Elevated: Shadow increases to `var(--shadow-lg)`
   - Border cards: Border color changes to `var(--color-primary)`
   - Transform: `translateY(-2px)`
   - Transition: 200ms ease-out
3. **Selected/Active**:
   - Border: 2px solid `var(--color-primary)`
   - Background tint: `var(--color-primary-light)` overlay (5% opacity)
   - Shadow: `var(--shadow-md)`
4. **Disabled**:
   - Opacity: 0.6
   - Cursor: not-allowed
   - Pointer events: none
5. **Loading**:
   - Opacity: 0.7
   - Cursor: wait
   - Shimmer effect on content area

### Header/Footer Styling

- **Header**:
  - Padding: Same as card body
  - Border-bottom: 1px solid `var(--color-border)` (if header exists)
  - Background: `var(--color-surface)` (optional, for visual separation)
  - Sticky: Can be made sticky for scrollable content
- **Footer**:
  - Padding: Same as card body
  - Border-top: 1px solid `var(--color-border)` (if footer exists)
  - Background: `var(--color-surface)` (optional)
  - Flex layout: Typically right-aligned buttons

### Visual Effects

- Border radius: `var(--radius-lg)` (8px)
- Hover transition: 200ms ease-out
- Click: Scale 0.99, 100ms
- Loading shimmer: 1.5s linear infinite

## Accessibility

### ARIA Attributes

- `role="article"` for content cards
- `role="button"` for interactive cards (if onClick provided)
- `aria-label`: Descriptive label for interactive cards
- `aria-disabled={isDisabled}` when disabled
- `aria-busy={isLoading}` during loading
- `aria-selected={isSelected}` for selectable cards
- `tabIndex={interactive && !isDisabled ? 0 : -1}` for keyboard navigation

### Keyboard Support (when interactive)

- `Tab`: Focus card
- `Enter` or `Space`: Trigger onClick
- `Escape`: Deselect (if managed by parent)

### Screen Reader Announcements

- On focus: Card label and content summary
- On selection: "Selected {card name}"
- When disabled: "{card name}, disabled"
- When loading: "{card name}, loading"

### Focus Management

- Focus visible indicator: 2px outline, 2px offset
- Focus-visible only (not on mouse click)
- Interactive cards in tab order

## Dependencies

### External

- React
- `clsx` for conditional class names

### Internal

- `@/components/ui/Spinner` - Loading spinner (if needed)
- `@/styles/card.module.css` - Component styles

### Generated Types

None - uses primitive React types

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Wrap with `React.memo()` for cards with static content
2. **CSS transitions**: GPU-accelerated transforms for hover effects
3. **Lazy loading**: Load card content only when visible (intersection observer)
4. **Virtualization**: For long lists of cards, use virtual scrolling

### Error Handling

- Missing children: Render empty card with min-height
- Invalid variant: Fall back to 'default'
- Invalid padding: Fall back to 'medium'
- onClick without interactive: Log warning in dev mode

### Responsive Behavior

- Mobile: Reduce padding to 'small', remove shadows
- Tablet: Default padding and elevation
- Desktop: Full styles with hover effects
- Touch devices: Increase touch target, disable hover effects

## Test Scenarios

### Unit Tests

```typescript
describe('Card', () => {
  it('renders children content', () => {
    // children should render inside card body
  });

  it('renders header when provided', () => {
    // header prop should render in card header
  });

  it('renders footer when provided', () => {
    // footer prop should render in card footer
  });

  it('applies variant class correctly', () => {
    // variant='elevated' should apply shadow
  });

  it('applies padding class correctly', () => {
    // padding='large' should apply spacious padding
  });

  it('calls onClick when clicked', () => {
    // interactive=true, onClick should fire
  });

  it('does not call onClick when disabled', () => {
    // isDisabled=true should prevent onClick
  });

  it('applies selected styles when selected', () => {
    // isSelected=true should apply border and tint
  });

  it('shows loading state', () => {
    // isLoading=true should show shimmer
  });

  it('applies interactive class', () => {
    // interactive=true should add hover styles
  });

  it('sets correct role for interactive cards', () => {
    // interactive=true should have role="button"
  });

  it('sets aria-selected correctly', () => {
    // isSelected should set aria-selected
  });
});
```

### Integration Tests

```typescript
describe('Card Integration', () => {
  it('supports keyboard navigation', () => {
    // Tab focus, Enter/Space activation
  });

  it('works with complex header/footer content', () => {
    // Should render buttons, badges in header/footer
  });

  it('prevents interaction when loading', () => {
    // isLoading should prevent onClick
  });
});
```

### Visual Regression Tests

- All variant combinations
- Selected and disabled states
- With and without header/footer
- Different padding sizes
- Hover states (interactive)
- Loading shimmer animation

## Usage Examples

### Room Card in Lobby

```tsx
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function RoomCard({ room, onJoin }) {
  return (
    <Card
      variant="elevated"
      interactive
      onClick={() => onJoin(room.id)}
      header={
        <div className="flex justify-between items-center">
          <h3>{room.name}</h3>
          <Badge variant={room.status === 'open' ? 'success' : 'error'}>{room.status}</Badge>
        </div>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Badge>{room.playerCount}/4</Badge>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onJoin(room.id);
            }}
          >
            Join
          </Button>
        </div>
      }
    >
      <p>{room.description}</p>
    </Card>
  );
}
```

### Analysis Panel

```tsx
function HandAnalysisPanel({ analysis, isLoading }) {
  return (
    <Card variant="flat" padding="medium" isLoading={isLoading} header={<h3>Hand Analysis</h3>}>
      {analysis ? (
        <div className="analysis-content">
          <p>Distance to win: {analysis.distance}</p>
          <p>Viable patterns: {analysis.viablePatterns.length}</p>
        </div>
      ) : (
        <p>Select tiles to analyze</p>
      )}
    </Card>
  );
}
```

### Settings Panel

```tsx
function SettingsPanel({ settings, onChange }) {
  return (
    <Card
      variant="outlined"
      padding="large"
      header={<h2>Game Settings</h2>}
      footer={
        <Button variant="primary" onClick={handleSave}>
          Save Settings
        </Button>
      }
    >
      <div className="settings-form">{/* Settings controls */}</div>
    </Card>
  );
}
```

### Selectable Pattern Card

```tsx
function PatternCard({ pattern, isSelected, onClick }) {
  return (
    <Card variant="elevated" padding="small" interactive isSelected={isSelected} onClick={onClick}>
      <h4>{pattern.name}</h4>
      <p>{pattern.points} points</p>
    </Card>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.2s ease-out;
}

/* Variant styles */
.card--default {
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

.card--elevated {
  background: var(--color-background);
  box-shadow: var(--shadow-md);
}

.card--outlined {
  background: transparent;
  border: 2px solid var(--color-border);
}

.card--flat {
  background: var(--color-surface);
}

/* Interactive states */
.card--interactive {
  cursor: pointer;
  user-select: none;
}

.card--interactive:hover:not(.card--disabled) {
  transform: translateY(-2px);
}

.card--interactive.card--elevated:hover {
  box-shadow: var(--shadow-lg);
}

.card--selected {
  border: 2px solid var(--color-primary);
  background-color: var(--color-primary-light);
}

.card--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

/* Header/Footer */
.card__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.card__body {
  flex: 1;
  padding: var(--space-4);
}

.card__footer {
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* Padding variants */
.card--padding-none .card__body {
  padding: 0;
}
.card--padding-small .card__body {
  padding: var(--space-3);
}
.card--padding-medium .card__body {
  padding: var(--space-4);
}
.card--padding-large .card__body {
  padding: var(--space-6);
}

/* Loading shimmer */
.card--loading {
  opacity: 0.7;
  cursor: wait;
}

.card--loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  to {
    left: 100%;
  }
}
```

## Future Enhancements

- [ ] Collapsible cards with expand/collapse animation
- [ ] Card stacking/grouping component
- [ ] Drag-and-drop reordering
- [ ] Flip animation for card state changes
- [ ] Custom color themes per card
- [ ] Sticky header support
- [ ] Horizontal card variant (image + content)
- [ ] Card masonry layout helper

## Notes

- Cards are building blocks - keep content simple and focused
- Use header for titles and primary actions
- Use footer for secondary actions or metadata
- Interactive cards should have clear visual feedback
- Selected state distinct from hover state
- Loading state should not block card visibility (shimmer overlay)
- Elevation (shadows) creates visual hierarchy
- Padding adjusts based on card complexity and context

```

```
