# Tabs Component Specification

## Component Type

Presentational Component

## Purpose

Provides tabbed navigation to organize related content into separate views. Users can switch between tabs to see different content sections without leaving the page.

## Related User Stories

- US-024: View Move History (tabs for timeline, events, analysis)
- US-027: Request Hints (tabs for patterns, defense, probability)
- US-034: Configure House Rules (tabs for game, timer, scoring)

## TypeScript Interface

````typescript
export interface TabsProps {
  /** Current active tab */
  activeTab: string;

  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;

  /** Tab items */
  tabs: Tab[];

  /** Tabs variant */
  variant?: 'underline' | 'pills' | 'enclosed';

  /** Tabs orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Full width tabs (equal sizing) */
  fullWidth?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface Tab {
  /** Unique tab ID */
  id: string;

  /** Tab label */
  label: string;

  /** Tab content */
  content: React.ReactNode;

  /** Icon for tab */
  icon?: React.ReactNode;

  /** Badge count */
  badge?: number;

  /** Disabled state */
  disabled?: boolean;
}
```text

## Internal State

```typescript
interface TabsState {
  /** Focused tab index (for keyboard navigation) */
  focusedIndex: number;
}
```text

## State Management

**Controlled component** - activeTab and onTabChange from parent. Internal state for keyboard focus.

## Visual Design

### Variant Styles

#### Underline (Default)

```text
┌─────────┬─────────┬─────────┐
│ Patterns│ Defense │ Hints   │
└─────────┴──┬──────┴─────────┘
             │
          [Content]
```text

- **Active tab**: Bottom border 2px `var(--color-primary)`
- **Inactive tabs**: No border, lighter text
- **Hover**: Light background highlight

#### Pills

```text
╭─────────╮ ╭─────────╮ ╭─────────╮
│ Patterns│ │ Defense │ │ Hints   │
╰─────────╯ ╰─────────╯ ╰─────────╯

[Content]
```text

- **Active tab**: Background `var(--color-primary)`, white text
- **Inactive tabs**: Light gray background
- **Hover**: Darker background

#### Enclosed

```text
┌─────────┐┌─────────┐┌─────────┐
│ Patterns││ Defense ││ Hints   │
├─────────┼┴─────────┴┴─────────┤
│                                │
│           [Content]            │
│                                │
└────────────────────────────────┘
```text

- **Active tab**: Connected to content, no bottom border
- **Inactive tabs**: Separate boxes
- **Background**: Content area enclosed

### Tab Layout

#### Horizontal

```text
┌─────────┬─────────┬─────────┐
│ [Icon]  │ [Icon]  │ [Icon]  │
│ Label   │ Label   │ Label   │
│    [5]  │         │         │
└─────────┴─────────┴─────────┘
```text

#### Vertical

```text
┌───────────┐
│ [Icon]    │ Label with Badge [3]
├───────────┤
│ [Icon]    │ Another Label
├───────────┤
│ [Icon]    │ Third Label
└───────────┘
```text

### Tab Elements

- **Icon**: Optional, 20px, left-aligned
- **Label**: Text, center or left-aligned
- **Badge**: Optional count, right-aligned, red circle
- **Spacing**: `var(--space-3)` between tabs

### Badge Styling

- **Background**: `var(--color-error)` (red)
- **Text**: White
- **Size**: 18px diameter (compact), 20px (with count)
- **Position**: Top-right corner (absolute)
- **Count**: Max 99 (show "99+" for higher)

### Dimensions

- **Min tab width**: 80px
- **Max tab width**: 200px (or full-width / count)
- **Tab height**: 48px (horizontal), auto (vertical)
- **Padding**: `var(--space-3)` horizontal, `var(--space-2)` vertical

## Accessibility

### ARIA Attributes

- `role="tablist"` for tab container
- `aria-orientation` for orientation
- `role="tab"` for each tab
- `aria-selected` for active tab
- `aria-controls` pointing to panel
- `role="tabpanel"` for content
- `aria-labelledby` pointing to tab
- `aria-disabled` for disabled tabs

### Keyboard Support

- **Tab**: Enter/exit tab list
- **Arrow Left/Right** (horizontal): Navigate tabs
- **Arrow Up/Down** (vertical): Navigate tabs
- **Home**: First tab
- **End**: Last tab
- **Space/Enter**: Activate focused tab

### Screen Reader Support

- Announce "tab list, {orientation}"
- Announce "tab, {label}, {x} of {y}, {selected/not selected}"
- Announce badge counts: "{label}, {count} items"
- Announce when tab changes

### Visual Accessibility

- High contrast active/inactive states
- Focus visible (outline)
- Active state not indicated by color alone
- Large touch targets (48px minimum)

## Dependencies

### External

- React (hooks: `useState`, `useMemo`, `useRef`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Badge` - Badge component
- `@/styles/tabs.module.css` - Component styles

## Implementation Notes

### Keyboard Navigation

```typescript
const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
  const { orientation } = props;
  const isHorizontal = orientation !== 'vertical';

  let nextIndex = index;
  let shouldActivate = false;

  switch (e.key) {
    case 'ArrowLeft':
      if (isHorizontal) {
        e.preventDefault();
        nextIndex = index > 0 ? index - 1 : tabs.length - 1;
      }
      break;
    case 'ArrowRight':
      if (isHorizontal) {
        e.preventDefault();
        nextIndex = index < tabs.length - 1 ? index + 1 : 0;
      }
      break;
    case 'ArrowUp':
      if (!isHorizontal) {
        e.preventDefault();
        nextIndex = index > 0 ? index - 1 : tabs.length - 1;
      }
      break;
    case 'ArrowDown':
      if (!isHorizontal) {
        e.preventDefault();
        nextIndex = index < tabs.length - 1 ? index + 1 : 0;
      }
      break;
    case 'Home':
      e.preventDefault();
      nextIndex = 0;
      break;
    case 'End':
      e.preventDefault();
      nextIndex = tabs.length - 1;
      break;
    case ' ':
    case 'Enter':
      e.preventDefault();
      shouldActivate = true;
      break;
  }

  // Skip disabled tabs
  while (tabs[nextIndex]?.disabled && nextIndex !== index) {
    nextIndex = nextIndex < tabs.length - 1 ? nextIndex + 1 : 0;
  }

  setFocusedIndex(nextIndex);

  if (shouldActivate && !tabs[index].disabled) {
    onTabChange(tabs[index].id);
  } else if (nextIndex !== index && !tabs[nextIndex].disabled) {
    onTabChange(tabs[nextIndex].id);
  }
};
```text

### Tab Change Handler

```typescript
const handleTabClick = (tabId: string, disabled?: boolean) => {
  if (disabled) return;
  onTabChange(tabId);
};
```text

## Test Scenarios

### Unit Tests

```typescript
describe('Tabs', () => {
  it('renders all tabs', () => {});
  it('shows active tab content', () => {});
  it('highlights active tab', () => {});
  it('calls onTabChange when tab clicked', () => {});
  it('applies variant styles', () => {});
  it('applies orientation', () => {});
  it('shows tab icons', () => {});
  it('shows tab badges', () => {});
  it('disables specific tabs', () => {});
  it('prevents click on disabled tabs', () => {});
  it('handles keyboard navigation', () => {});
  it('skips disabled tabs in keyboard nav', () => {});
  it('applies full-width layout', () => {});
  it('applies correct ARIA attributes', () => {});
});
```text

### Integration Tests

```typescript
describe('Tabs Integration', () => {
  it('updates when activeTab prop changes', () => {});
  it('announces tab changes to screen readers', () => {});
  it('maintains focus during tab switching', () => {});
});
```text

### Visual Regression Tests

- All variants (underline, pills, enclosed)
- All orientations (horizontal, vertical)
- With and without icons
- With and without badges
- Disabled tabs
- Full-width layout
- Long tab labels

## Usage Examples

### Basic Tabs

```tsx
import { Tabs } from '@/components/ui/Tabs';

function HintPanel() {
  const [activeTab, setActiveTab] = useState('patterns');

  return (
    <Tabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={[
        {
          id: 'patterns',
          label: 'Patterns',
          content: <PatternsList />,
        },
        {
          id: 'defense',
          label: 'Defense',
          content: <DefenseHints />,
        },
        {
          id: 'probability',
          label: 'Probability',
          content: <ProbabilityAnalysis />,
        },
      ]}
    />
  );
}
```text

### Tabs with Icons and Badges

```tsx
function HistoryPanel() {
  const [activeTab, setActiveTab] = useState('timeline');

  return (
    <Tabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      variant="pills"
      tabs={[
        {
          id: 'timeline',
          label: 'Timeline',
          icon: <ClockIcon />,
          content: <Timeline />,
        },
        {
          id: 'events',
          label: 'Events',
          icon: <ListIcon />,
          badge: 15,
          content: <EventLog />,
        },
        {
          id: 'analysis',
          label: 'Analysis',
          icon: <ChartIcon />,
          content: <GameAnalysis />,
        },
      ]}
    />
  );
}
```text

### Vertical Tabs

```tsx
function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('game');

  return (
    <Tabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      orientation="vertical"
      variant="enclosed"
      tabs={[
        {
          id: 'game',
          label: 'Game Settings',
          content: <GameSettings />,
        },
        {
          id: 'display',
          label: 'Display',
          content: <DisplaySettings />,
        },
        {
          id: 'sound',
          label: 'Sound',
          content: <SoundSettings />,
        },
      ]}
    />
  );
}
```text

### With Disabled Tab

```tsx
function FeatureTabs() {
  const [activeTab, setActiveTab] = useState('available');

  return (
    <Tabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={[
        {
          id: 'available',
          label: 'Available',
          content: <AvailableFeatures />,
        },
        {
          id: 'premium',
          label: 'Premium',
          disabled: true,
          content: <PremiumFeatures />,
        },
      ]}
    />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.tabs {
  display: flex;
  gap: var(--space-4);
}

.tabs--horizontal {
  flex-direction: column;
}

.tabs--vertical {
  flex-direction: row;
}

/* Tab list */
.tabs__list {
  display: flex;
  gap: var(--space-1);
}

.tabs__list--horizontal {
  flex-direction: row;
  border-bottom: 1px solid var(--color-border);
}

.tabs__list--vertical {
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  min-width: 200px;
}

.tabs__list--full-width .tabs__tab {
  flex: 1;
}

/* Tab button */
.tabs__tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 48px;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tabs__tab:hover:not(.tabs__tab--disabled) {
  color: var(--color-text-primary);
  background: var(--color-background-hover);
}

.tabs__tab:focus {
  outline: none;
}

.tabs__tab:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.tabs__tab--active {
  color: var(--color-primary);
}

.tabs__tab--disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Underline variant */
.tabs--underline .tabs__tab {
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tabs--underline .tabs__tab--active {
  border-bottom-color: var(--color-primary);
}

/* Pills variant */
.tabs--pills .tabs__tab {
  border-radius: var(--radius-full);
  background: var(--color-background-secondary);
}

.tabs--pills .tabs__tab--active {
  background: var(--color-primary);
  color: white;
}

.tabs--pills .tabs__tab:hover:not(.tabs__tab--disabled) {
  background: var(--color-background-hover);
}

.tabs--pills .tabs__tab--active:hover {
  background: var(--color-primary);
}

/* Enclosed variant */
.tabs--enclosed .tabs__tab {
  border: 1px solid var(--color-border);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  margin-right: -1px;
}

.tabs--enclosed .tabs__tab--active {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-background);
  margin-bottom: -1px;
  z-index: 1;
}

/* Tab content */
.tabs__tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tabs__tab-label {
  flex: 1;
}

.tabs__tab-badge {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  background: var(--color-error);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tabs__tab--active .tabs__tab-badge {
  background: white;
  color: var(--color-primary);
}

/* Panel */
.tabs__panel {
  flex: 1;
  padding: var(--space-4);
  min-height: 200px;
}

.tabs--enclosed .tabs__panel {
  border: 1px solid var(--color-border);
  border-radius: 0 var(--radius-md) var(--radius-md) var(--radius-md);
}

.tabs--vertical .tabs__panel {
  border-radius: var(--radius-md);
}

/* Responsive */
@media (max-width: 768px) {
  .tabs--vertical {
    flex-direction: column;
  }

  .tabs__list--vertical {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    min-width: auto;
    overflow-x: auto;
  }

  .tabs__tab {
    font-size: var(--text-sm);
    padding: var(--space-2);
  }
}
```text

## Future Enhancements

- [ ] Scrollable tab list (overflow arrows)
- [ ] Drag-to-reorder tabs
- [ ] Closeable tabs (X button)
- [ ] Add tab button (+ button)
- [ ] Tab context menu (right-click)
- [ ] Lazy load tab content
- [ ] Animated tab transitions
- [ ] Nested tabs
- [ ] Tab groups/categories
- [ ] Persist active tab (localStorage)
- [ ] URL-synced tabs (routing)

## Notes

- Tabs for organizing related content sections
- Accordion for vertically stacked collapsible sections
- Max 5-7 tabs for usability
- Use scrollable tabs for more than 7
- Label tabs clearly and concisely
- Active tab always visible
- Don't disable the active tab
- Keyboard navigation essential
- Vertical tabs for narrow spaces
- Horizontal tabs for wide spaces
- Pills variant for grouped actions
- Underline variant for subtle navigation
- Enclosed variant for traditional tabbed interface
- Badge for notification counts
- Icon for visual recognition
- Consider mobile: horizontal scroll or stacked
- Screen reader announces tab list and selected tab
- Focus visible for keyboard users
- Large touch targets for mobile
- Content should be related but independent
- Switching tabs should not lose state
- Consider lazy loading tab content for performance
- URL routing for shareable tab links
- Persist active tab across sessions if needed
````
