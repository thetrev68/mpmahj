# ActionBar Component Specification

## 1. Overview

**Purpose**: Container for action buttons with responsive layout (horizontal/vertical). Groups related buttons for different game contexts (turn actions, Charleston tile selection, call intents, etc.).

**Category**: Presentational Component (Core Game Elements)

**Related Stories**: US-001 (Roll Dice), US-009-010 (Draw/Discard), US-011 (Call Window), US-002-007 (Charleston)

**Related Components**:

- `<ActionButtons>` - Specialized turn action button group
- `<Button>` - Individual button component
- `<CallWindowPanel>` - Call intent buttons (Pung/Kong/Mahjong/Pass)
- `<TileSelectionPanel>` - Charleston tile selection with counter

---

## 2. Core Functionality

### 2.1 Layout Orientations

```typescript
type ActionBarOrientation = 'horizontal' | 'vertical' | 'responsive';
```

- **Horizontal**: Buttons arranged left-to-right in a single row
- **Vertical**: Buttons stacked top-to-bottom in a single column
- **Responsive**: Horizontal on desktop/tablet, vertical on mobile

### 2.2 Content Alignment

```typescript
type ActionBarAlignment = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
```

- **Start**: Buttons aligned to left (horizontal) or top (vertical)
- **Center**: Buttons centered
- **End**: Buttons aligned to right (horizontal) or bottom (vertical)
- **Space-between**: Equal spacing between buttons, no spacing at edges
- **Space-around**: Equal spacing around each button

### 2.3 Button Grouping

```typescript
type ButtonGroup = {
  id: string;
  buttons: React.ReactNode[];
  separator?: boolean; // Show visual separator after this group
};
```

Groups allow logical separation of related actions (e.g., primary actions vs. secondary actions).

---

## 3. Props Interface

```typescript
interface ActionBarProps {
  // Layout
  orientation?: ActionBarOrientation; // Default: 'responsive'
  alignment?: ActionBarAlignment; // Default: 'center'
  fullWidth?: boolean; // Stretch to fill container width (default: false)

  // Content
  children?: React.ReactNode; // Buttons to display
  groups?: ButtonGroup[]; // Alternative: organized button groups

  // Styling
  variant?: 'default' | 'compact' | 'prominent'; // Default: 'default'
  spacing?: 'tight' | 'normal' | 'loose'; // Default: 'normal'
  background?: boolean; // Show background panel (default: true)

  // Behavior
  sticky?: boolean; // Stick to bottom of viewport on scroll (default: false)
  disabled?: boolean; // Disable all child buttons (default: false)

  // Accessibility
  ariaLabel?: string; // Describe button group purpose
  role?: string; // Default: 'group'

  // Styling
  className?: string;
  style?: React.CSSProperties;
}
```

---

## 4. Visual Design

### 4.1 Default Variant - Horizontal

```text
┌────────────────────────────────────────────────┐
│  [Draw Tile]  [Discard]  [Pass]  [Call Mahjong]│  Background panel
└────────────────────────────────────────────────┘
     8px gap between buttons
```

**Characteristics**:

- Background: Light gray panel with border
- Buttons: Normal spacing (8px gap)
- Height: 56px (desktop), 48px (mobile)
- Padding: 12px horizontal, 8px vertical

### 4.2 Compact Variant - Horizontal

```text
┌──────────────────────────────────┐
│ [Draw] [Discard] [Pass] [Mahjong]│  Smaller buttons, tighter spacing
└──────────────────────────────────┘
     4px gap
```

**Characteristics**:

- Background: Subtle border only
- Buttons: Compact size, tight spacing (4px gap)
- Height: 40px
- Padding: 8px horizontal, 4px vertical

### 4.3 Prominent Variant - Horizontal

```text
┌────────────────────────────────────────────────────┐
│                                                    │
│    [DRAW TILE]    [DISCARD]    [CALL MAHJONG]     │  Large buttons
│                                                    │
└────────────────────────────────────────────────────┘
     16px gap
```

**Characteristics**:

- Background: Strong background with shadow
- Buttons: Large size, generous spacing (16px gap)
- Height: 72px (desktop), 64px (mobile)
- Padding: 16px horizontal, 12px vertical

### 4.4 Vertical Layout (Mobile)

```text
┌──────────────────┐
│   [Draw Tile]    │
├──────────────────┤
│   [Discard]      │
├──────────────────┤
│   [Pass]         │
├──────────────────┤
│ [Call Mahjong]   │
└──────────────────┘
```

**Characteristics**:

- Full-width buttons in vertical stack
- 8px gap between buttons
- Stretch to fill available width
- Compact height (48px per button)

### 4.5 Button Groups with Separators

```text
┌─────────────────────────────────────────────────────┐
│ [Draw Tile] [Discard]  │  [Pung] [Kong] [Mahjong]   │
│   Primary Actions      │    Call Actions            │
└─────────────────────────────────────────────────────┘
         Group 1         Separator     Group 2
```

**Characteristics**:

- Vertical divider line between groups
- Different styling for group sections
- Logical separation of action types

---

## 5. Behavior Specifications

### 5.1 Responsive Behavior

```typescript
const useResponsiveOrientation = (orientation: ActionBarOrientation): 'horizontal' | 'vertical' => {
  const [currentOrientation, setCurrentOrientation] = useState<'horizontal' | 'vertical'>(
    'horizontal'
  );

  useEffect(() => {
    if (orientation !== 'responsive') {
      setCurrentOrientation(orientation);
      return;
    }

    const handleResize = () => {
      const isMobile = window.innerWidth < 640; // Tailwind sm breakpoint
      setCurrentOrientation(isMobile ? 'vertical' : 'horizontal');
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [orientation]);

  return currentOrientation;
};
```

### 5.2 Sticky Positioning

```typescript
const useStickyBar = (sticky: boolean) => {
  const [isSticky, setIsSticky] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sticky) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 1 }
    );

    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [sticky]);

  return { barRef, isSticky };
};
```

### 5.3 Disabled State Propagation

```typescript
// Recursively disable all child buttons
const disableChildren = (children: React.ReactNode, disabled: boolean): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Clone button element with disabled prop
    if (child.type === Button || child.props?.role === 'button') {
      return React.cloneElement(child, { disabled: disabled || child.props?.disabled });
    }

    // Recursively process nested children
    if (child.props?.children) {
      return React.cloneElement(child, {
        children: disableChildren(child.props.children, disabled),
      });
    }

    return child;
  });
};
```

---

## 6. Accessibility

### 6.1 ARIA Attributes

```tsx
<div
  role={role || 'group'}
  aria-label={ariaLabel || 'Game actions'}
  aria-disabled={disabled}
  className={classNames('action-bar', className)}
>
  {children}
</div>
```

**Recommended ARIA labels by context**:

- Turn actions: `"Turn action buttons"`
- Charleston: `"Charleston tile selection actions"`
- Call window: `"Call intent buttons"`
- Game setup: `"Game setup actions"`

### 6.2 Keyboard Navigation

ActionBar itself is not focusable. Keyboard navigation flows through child buttons using native tab order:

```text
Tab → Button 1 → Tab → Button 2 → Tab → Button 3 → ...
```

For button groups, ensure logical tab order:

```tsx
<ActionBar
  groups={[
    {
      id: 'primary',
      buttons: [
        <Button key="draw" tabIndex={0}>
          Draw
        </Button>,
        <Button key="discard" tabIndex={0}>
          Discard
        </Button>,
      ],
    },
    {
      id: 'secondary',
      buttons: [
        <Button key="pass" tabIndex={0}>
          Pass
        </Button>,
      ],
      separator: true,
    },
  ]}
/>
```

### 6.3 Screen Reader Announcements

```tsx
// Announce when ActionBar content changes (e.g., new buttons available)
useEffect(() => {
  if (announceChanges && children) {
    const buttonCount = React.Children.count(children);
    announceToScreenReader(`${buttonCount} actions available`);
  }
}, [children]);
```

---

## 7. Integration Points

### 7.1 Turn Actions (US-009, US-010)

```tsx
import { ActionBar } from '@/components/presentational/ActionBar';
import { Button } from '@/components/presentational/Button';

<ActionBar
  orientation="responsive"
  alignment="center"
  variant="default"
  ariaLabel="Turn action buttons"
>
  <Button
    variant="primary"
    onClick={handleDrawTile}
    disabled={turnStage !== 'Drawing'}
    icon={<TileIcon />}
  >
    Draw Tile
  </Button>
  <Button
    variant="primary"
    onClick={handleDiscardTile}
    disabled={turnStage !== 'Discarding' || selectedTile === null}
    icon={<DiscardIcon />}
  >
    Discard
  </Button>
  <Button variant="secondary" onClick={handleShowHints} icon={<HintIcon />}>
    Hints
  </Button>
</ActionBar>;
```

### 7.2 Call Window (US-011)

```tsx
<ActionBar
  orientation="horizontal"
  alignment="center"
  variant="prominent"
  sticky={true}
  ariaLabel="Call intent buttons"
>
  <Button variant="call-pung" onClick={handleCallPung}>
    Pung
  </Button>
  <Button variant="call-kong" onClick={handleCallKong}>
    Kong
  </Button>
  <Button variant="call-mahjong" onClick={handleCallMahjong}>
    Mahjong
  </Button>
  <Button variant="secondary" onClick={handlePass}>
    Pass
  </Button>
</ActionBar>
```

### 7.3 Charleston Tile Selection (US-002-004)

```tsx
<ActionBar
  orientation="responsive"
  alignment="space-between"
  variant="default"
  ariaLabel="Charleston tile passing actions"
  groups={[
    {
      id: 'selection',
      buttons: [<SelectionCounter key="counter" selected={selectedTiles.length} total={3} />],
    },
    {
      id: 'actions',
      buttons: [
        <Button key="clear" variant="secondary" onClick={handleClearSelection}>
          Clear
        </Button>,
        <Button
          key="pass"
          variant="primary"
          onClick={handlePassTiles}
          disabled={selectedTiles.length !== 3}
        >
          Pass Tiles
        </Button>,
      ],
      separator: true,
    },
  ]}
/>
```

### 7.4 Game Setup (US-001)

```tsx
<ActionBar
  orientation="horizontal"
  alignment="center"
  variant="prominent"
  ariaLabel="Game setup actions"
>
  <Button variant="primary" size="large" onClick={handleRollDice} disabled={!isEastSeat}>
    Roll Dice
  </Button>
  <Button variant="secondary" onClick={handleViewRules}>
    Rules
  </Button>
</ActionBar>
```

### 7.5 Sticky Bottom Bar (Mobile)

```tsx
<ActionBar
  orientation="vertical"
  alignment="center"
  variant="compact"
  sticky={true}
  fullWidth={true}
  className="mobile-action-bar"
>
  <Button variant="primary" fullWidth onClick={handlePrimaryAction}>
    Primary Action
  </Button>
  <Button variant="secondary" fullWidth onClick={handleSecondaryAction}>
    Secondary Action
  </Button>
</ActionBar>
```

---

## 8. Styling (CSS Module)

```css
/* ActionBar.module.css */

/* Base container */
.action-bar {
  display: flex;
  gap: var(--spacing-2); /* 8px */
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--border-radius-md);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* Orientation */
.action-bar--horizontal {
  flex-direction: row;
  align-items: center;
}

.action-bar--vertical {
  flex-direction: column;
  align-items: stretch;
}

/* Alignment (horizontal) */
.action-bar--start {
  justify-content: flex-start;
}

.action-bar--center {
  justify-content: center;
}

.action-bar--end {
  justify-content: flex-end;
}

.action-bar--space-between {
  justify-content: space-between;
}

.action-bar--space-around {
  justify-content: space-around;
}

/* Full width */
.action-bar--full-width {
  width: 100%;
}

/* Variants */
.action-bar--default {
  background: hsl(0, 0%, 98%);
  border: 1px solid hsl(0, 0%, 85%);
}

.action-bar--compact {
  gap: var(--spacing-1); /* 4px */
  padding: var(--spacing-1) var(--spacing-2);
  background: transparent;
  border: 1px solid hsl(0, 0%, 90%);
}

.action-bar--prominent {
  gap: var(--spacing-4); /* 16px */
  padding: var(--spacing-3) var(--spacing-4);
  background: hsl(0, 0%, 97%);
  border: 2px solid hsl(210, 50%, 85%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Spacing */
.action-bar--spacing-tight {
  gap: var(--spacing-1); /* 4px */
}

.action-bar--spacing-normal {
  gap: var(--spacing-2); /* 8px */
}

.action-bar--spacing-loose {
  gap: var(--spacing-4); /* 16px */
}

/* Background */
.action-bar--no-background {
  background: transparent;
  border: none;
}

/* Sticky positioning */
.action-bar--sticky {
  position: sticky;
  bottom: 0;
  z-index: 10;
  margin-top: auto; /* Push to bottom if in flex container */
}

.action-bar--sticky.is-stuck {
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
}

/* Disabled state */
.action-bar--disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* Button groups */
.action-bar__group {
  display: flex;
  gap: inherit; /* Inherit gap from parent */
}

.action-bar--horizontal .action-bar__group {
  flex-direction: row;
  align-items: center;
}

.action-bar--vertical .action-bar__group {
  flex-direction: column;
  align-items: stretch;
}

/* Group separator */
.action-bar__separator {
  width: 1px;
  height: 32px;
  background: hsl(0, 0%, 80%);
  margin: 0 var(--spacing-2);
}

.action-bar--vertical .action-bar__separator {
  width: 100%;
  height: 1px;
  margin: var(--spacing-2) 0;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .action-bar--responsive {
    flex-direction: column;
    align-items: stretch;
  }

  .action-bar--responsive .action-bar__group {
    flex-direction: column;
  }

  .action-bar--responsive .action-bar__separator {
    width: 100%;
    height: 1px;
    margin: var(--spacing-2) 0;
  }

  /* Sticky bars on mobile take full width */
  .action-bar--sticky {
    width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .action-bar {
    transition: none;
  }
}
```

---

## 9. Testing Requirements

### 9.1 Unit Tests

```typescript
describe('ActionBar', () => {
  test('renders children buttons', () => {
    render(
      <ActionBar>
        <button>Action 1</button>
        <button>Action 2</button>
      </ActionBar>
    );

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
  });

  test('applies orientation class', () => {
    const { container, rerender } = render(
      <ActionBar orientation="horizontal">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--horizontal');

    rerender(
      <ActionBar orientation="vertical">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--vertical');
  });

  test('applies alignment class', () => {
    const { container } = render(
      <ActionBar alignment="space-between">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--space-between');
  });

  test('applies variant class', () => {
    const { container, rerender } = render(
      <ActionBar variant="default">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--default');

    rerender(
      <ActionBar variant="compact">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--compact');

    rerender(
      <ActionBar variant="prominent">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--prominent');
  });

  test('applies spacing class', () => {
    const { container } = render(
      <ActionBar spacing="loose">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--spacing-loose');
  });

  test('applies full-width class when enabled', () => {
    const { container } = render(
      <ActionBar fullWidth={true}>
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--full-width');
  });

  test('applies sticky class when enabled', () => {
    const { container } = render(
      <ActionBar sticky={true}>
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--sticky');
  });

  test('disables all child buttons when disabled prop is true', () => {
    render(
      <ActionBar disabled={true}>
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </ActionBar>
    );

    expect(screen.getByText('Action 1')).toBeDisabled();
    expect(screen.getByText('Action 2')).toBeDisabled();
  });

  test('renders button groups with separators', () => {
    const { container } = render(
      <ActionBar
        groups={[
          {
            id: 'group1',
            buttons: [<button key="1">Action 1</button>],
          },
          {
            id: 'group2',
            buttons: [<button key="2">Action 2</button>],
            separator: true,
          },
        ]}
      />
    );

    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    expect(container.querySelector('.action-bar__separator')).toBeInTheDocument();
  });

  test('uses custom ARIA label when provided', () => {
    const { container } = render(
      <ActionBar ariaLabel="Custom action group">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveAttribute('aria-label', 'Custom action group');
  });

  test('has role="group" by default', () => {
    const { container } = render(
      <ActionBar>
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveAttribute('role', 'group');
  });

  test('allows custom role', () => {
    const { container } = render(
      <ActionBar role="toolbar">
        <button>Action</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveAttribute('role', 'toolbar');
  });
});
```

### 9.2 Integration Tests

```typescript
describe('ActionBar Integration', () => {
  test('switches to vertical layout on mobile', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop
    });

    const { container } = render(
      <ActionBar orientation="responsive">
        <button>Action 1</button>
        <button>Action 2</button>
      </ActionBar>
    );

    expect(container.firstChild).toHaveClass('action-bar--horizontal');

    // Simulate mobile resize
    act(() => {
      window.innerWidth = 480;
      window.dispatchEvent(new Event('resize'));
    });

    expect(container.firstChild).toHaveClass('action-bar--vertical');
  });

  test('sticky bar adds shadow when scrolled', () => {
    const { container } = render(
      <ActionBar sticky={true}>
        <button>Action</button>
      </ActionBar>
    );

    const bar = container.firstChild;

    // Initially not stuck
    expect(bar).not.toHaveClass('is-stuck');

    // Simulate scroll (IntersectionObserver would normally handle this)
    act(() => {
      // Mock IntersectionObserver callback
      bar?.classList.add('is-stuck');
    });

    expect(bar).toHaveClass('is-stuck');
  });

  test('keyboard navigation flows through buttons', () => {
    render(
      <ActionBar>
        <Button>Action 1</Button>
        <Button>Action 2</Button>
        <Button>Action 3</Button>
      </ActionBar>
    );

    const button1 = screen.getByText('Action 1');
    const button2 = screen.getByText('Action 2');
    const button3 = screen.getByText('Action 3');

    button1.focus();
    expect(button1).toHaveFocus();

    userEvent.tab();
    expect(button2).toHaveFocus();

    userEvent.tab();
    expect(button3).toHaveFocus();
  });

  test('disabled state prevents button interaction', () => {
    const handleClick = vi.fn();

    render(
      <ActionBar disabled={true}>
        <Button onClick={handleClick}>Action</Button>
      </ActionBar>
    );

    const button = screen.getByText('Action');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

### 9.3 Visual Regression Tests

```typescript
describe('ActionBar Visual Regression', () => {
  test('default variant matches snapshot', () => {
    const { container } = render(
      <ActionBar variant="default" orientation="horizontal" alignment="center">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </ActionBar>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('compact variant matches snapshot', () => {
    const { container } = render(
      <ActionBar variant="compact" spacing="tight">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </ActionBar>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('prominent variant matches snapshot', () => {
    const { container } = render(
      <ActionBar variant="prominent" spacing="loose">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
      </ActionBar>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('vertical layout matches snapshot', () => {
    const { container } = render(
      <ActionBar orientation="vertical" alignment="start">
        <Button fullWidth>Action 1</Button>
        <Button fullWidth>Action 2</Button>
      </ActionBar>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('button groups with separator matches snapshot', () => {
    const { container } = render(
      <ActionBar
        groups={[
          {
            id: 'primary',
            buttons: [<Button key="1">Primary 1</Button>, <Button key="2">Primary 2</Button>],
          },
          {
            id: 'secondary',
            buttons: [<Button key="3">Secondary</Button>],
            separator: true,
          },
        ]}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('sticky bar matches snapshot', () => {
    const { container } = render(
      <ActionBar sticky={true} variant="prominent" fullWidth>
        <Button>Sticky Action</Button>
      </ActionBar>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

---

## 10. Performance Considerations

### 10.1 Memoization

```typescript
const ActionBar = React.memo<ActionBarProps>(
  ({ orientation, alignment, variant, children, groups /* ... */ }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.orientation === nextProps.orientation &&
      prevProps.alignment === nextProps.alignment &&
      prevProps.variant === nextProps.variant &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.children === nextProps.children &&
      prevProps.groups === nextProps.groups
    );
  }
);
```

### 10.2 Resize Observer Optimization

```typescript
// Debounce resize events to avoid excessive re-renders
const useDebouncedResize = (callback: () => void, delay: number = 150) => {
  useEffect(() => {
    const handleResize = debounce(callback, delay);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      handleResize.cancel?.(); // Cancel pending debounced calls
    };
  }, [callback, delay]);
};
```

### 10.3 Conditional Rendering

```typescript
// Only render separators when there are multiple groups
{
  groups &&
    groups.length > 1 &&
    groups.map((group, index) => (
      <Fragment key={group.id}>
        <div className="action-bar__group">{group.buttons}</div>
        {group.separator && index < groups.length - 1 && (
          <div className="action-bar__separator" aria-hidden="true" />
        )}
      </Fragment>
    ));
}
```

---

## 11. Related Documentation

- **User Stories**: [US-001](../user-stories/US-001-roll-dice-break-wall.md), [US-009-010](../user-stories/US-009-drawing-a-tile.md), [US-011](../user-stories/US-011-call-window-intent-buffering.md), [US-002-007](../user-stories/US-002-charleston-first-right.md)
- **Design System**: [GameDesignDocument-Section-1-Visual-Layout.md](../GameDesignDocument-Section-1-Visual-Layout.md)
- **Related Components**: `<ActionButtons>`, `<Button>`, `<CallWindowPanel>`, `<TileSelectionPanel>`

---

## 12. Notes for Implementers

1. **Flexible Content**: ActionBar is a layout container. It doesn't prescribe button content—use `<Button>`, custom components, or any React nodes as children.

2. **Responsive Design**: Use `orientation="responsive"` for mobile-friendly layouts. Desktop shows horizontal row, mobile shows vertical stack.

3. **Sticky Behavior**: `sticky={true}` keeps ActionBar visible at bottom of viewport during scroll. Essential for mobile gameplay where buttons must always be accessible.

4. **Button Groups**: Use `groups` prop for logically separated button sets (e.g., primary vs. secondary actions). Separators provide visual distinction.

5. **Disabled Propagation**: When `disabled={true}`, all child buttons inherit disabled state. Individual buttons can still have their own disabled logic.

6. **Accessibility**: Always provide meaningful `ariaLabel` describing the button group's purpose. Screen reader users benefit from context (e.g., "Turn action buttons" vs. generic "Actions").

7. **Testing**: Test responsive behavior across viewport sizes. Verify sticky positioning works correctly. Ensure keyboard navigation flows logically.

8. **Performance**: Memoize ActionBar to prevent unnecessary re-renders. Debounce resize events. Only render separators when needed.

9. **Future Enhancements**:
   - Collapsible groups (accordion-style on mobile)
   - Overflow menu for many buttons (More → dropdown)
   - Drag-and-drop button reordering (customizable action bar)
   - Keyboard shortcuts displayed on buttons (e.g., "D" for Draw)
