# PatternCard Component Specification

## Component Type

**Presentational Component**

## Purpose

Displays a single NMJL pattern from the current year's card with visual representation, tile requirements, point value, and difficulty. Shows patterns in various contexts: full card view, search results, match indicators, and hint displays.

## Related User Stories

- US-023: View Patterns (display all patterns for current year)
- US-024: Pattern Search (display filtered patterns)
- US-027: Defensive Strategy (show dangerous patterns)
- US-029: Winning Probability (display viable patterns)
- US-030: Pattern Suggestions (AI-recommended patterns)

## TypeScript Interface

```typescript
import { Pattern } from '@/types/bindings/generated';

export interface PatternCardProps {
  /** Pattern data from runtime card */
  pattern: Pattern;
  
  /** Current player's hand (for match highlighting) */
  playerHand?: number[];
  
  /** Display variant */
  variant?: 'full' | 'compact' | 'minimal';
  
  /** Whether pattern is matched/achievable */
  isMatched?: boolean;
  
  /** Whether pattern is selected/focused */
  isSelected?: boolean;
  
  /** Callback when pattern is clicked */
  onClick?: (pattern: Pattern) => void;
  
  /** Show difficulty indicator */
  showDifficulty?: boolean;
  
  /** Show point value */
  showPoints?: boolean;
  
  /** Show matching tiles count */
  showMatchCount?: boolean;
  
  /** Highlight specific tile positions */
  highlightPositions?: number[];
  
  /** Show concealed/exposed indicator */
  showExposureType?: boolean;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Test ID */
  testId?: string;
}

export interface Pattern {
  /** Pattern ID */
  id: string;
  
  /** Pattern name/description */
  name: string;
  
  /** Section number (1-8) */
  section: number;
  
  /** Pattern number within section */
  patternNumber: number;
  
  /** Point value */
  points: number;
  
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Whether pattern is concealed-only */
  concealedOnly: boolean;
  
  /** Tile composition (symbolic representation) */
  composition: string[];
  
  /** Visual representation (for display) */
  visual: TileSlot[];
  
  /** Year this pattern is from */
  year: number;
}

export interface TileSlot {
  /** Tile type/value (or variable like VSUIT1) */
  type: string;
  
  /** Whether this slot is a joker */
  isJoker: boolean;
  
  /** Position in pattern (0-13) */
  position: number;
  
  /** Variable suit number (1-3) if applicable */
  variableSuit?: number;
}
```

## Internal State

```typescript
interface PatternCardState {
  /** Whether card is expanded (for full variant) */
  isExpanded: boolean;
  
  /** Hover state */
  isHovered: boolean;
}
```

## State Management

**Internal useState** for expansion and hover states. Pattern data and selection managed by parent component.

## Visual Design

### Variant Styles

#### Full (Default)

- Card layout with header, body, footer
- Width: 100% (responsive)
- Height: Auto
- Shows all pattern details
- Use for: Pattern catalog, detailed view

#### Compact

- Condensed layout, 50% width
- Shows name, tiles, points
- Omits description and difficulty
- Use for: Search results, pattern list

#### Minimal

- Single row, horizontal layout
- Name + point value only
- Use for: Quick reference, dropdowns

### Pattern Card Structure

```
+--------------------------------------------------+
| Section 2, Pattern 3                    25 pts   |  Header
| "Consecutive Run"                      [⭐⭐⭐]   |
+--------------------------------------------------+
| [1B][2B][3B]  [4C][5C][6C]  [7D][8D][9D] [1F][1F] |  Tiles
+--------------------------------------------------+
| Concealed only • Hard difficulty                 |  Footer
| 12/14 tiles matched                              |
+--------------------------------------------------+
```

### Colors & States

#### Default

- **Background**: `var(--color-card-background)` (#ffffff)
- **Border**: 1px solid `var(--color-border)` (#d1d5db)
- **Shadow**: `var(--shadow-sm)`

#### Matched

- **Border**: 2px solid `var(--color-success)` (#10b981)
- **Background**: Linear gradient with subtle green tint
- **Badge**: "Achievable" badge in green

#### Selected

- **Border**: 2px solid `var(--color-primary)` (#2563eb)
- **Background**: `var(--color-primary-light)` (rgba(37, 99, 235, 0.05))
- **Shadow**: `var(--shadow-lg)`

#### Hovered

- **Shadow**: `var(--shadow-md)`
- **Transform**: translateY(-2px)
- **Border**: `var(--color-primary-light)`

### Header Section

- **Section number**: `var(--text-xs)`, `var(--color-text-secondary)`
- **Pattern name**: `var(--text-lg)`, `var(--font-semibold)`, `var(--color-text-primary)`
- **Points**: `var(--text-xl)`, `var(--font-bold)`, `var(--color-primary)`
- **Difficulty stars**: 1-4 stars, `var(--color-warning)` (#f59e0b)

### Tile Display Section

- **Layout**: Horizontal groups with spacing
- **Tile size**: 32px × 43px (compact size)
- **Grouping**: Pungs/Kongs/Pairs separated by gaps
- **Joker indicator**: Gold border around joker positions
- **Variable suit**: Different background colors for VSUIT1, VSUIT2, VSUIT3
- **Matched tiles**: Green checkmark overlay

### Footer Section

- **Exposure type**: "Concealed only" or "Can be exposed" chip
- **Difficulty**: Text label with star rating
- **Match count**: "{matched}/{total} tiles matched"
- **Font size**: `var(--text-sm)`
- **Color**: `var(--color-text-secondary)`

### Difficulty Indicators

- **Easy**: 1 star (⭐)
- **Medium**: 2 stars (⭐⭐)
- **Hard**: 3 stars (⭐⭐⭐)
- **Expert**: 4 stars (⭐⭐⭐⭐)

## Accessibility

### ARIA Attributes

- `role="article"` for pattern card
- `aria-label="{patternName}, {points} points, {difficulty}"` for card
- `aria-selected="true"` when selected
- `aria-describedby` linking to pattern description
- `tabindex="0"` when interactive (clickable)

### Keyboard Support

- **Tab**: Focus card
- **Enter/Space**: Select card (if onClick provided)
- **Arrow Keys**: Navigate between cards (in grid layout)

### Screen Reader Support

- Announce pattern name, points, difficulty on focus
- Announce match status: "{matched} of {total} tiles matched"
- Announce exposure type: "concealed only" or "can be exposed"
- Announce selection state changes

### Visual Accessibility

- High contrast for all text
- Matched state not indicated by color alone (border + badge + text)
- Difficulty shown as text + stars (redundant coding)
- Touch targets min 44px when interactive

## Dependencies

### External

- React (hooks: `useState`, `useCallback`, `useMemo`)
- `clsx` for conditional class names

### Internal

- `@/components/game/TileImage` - Individual tile rendering
- `@/components/ui/Badge` - Difficulty and status badges
- `@/components/icons/StarIcon` - Difficulty stars
- `@/components/icons/CheckIcon` - Match indicators
- `@/utils/patternUtils` - Pattern analysis utilities
- `@/styles/patternCard.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Pattern.ts` - Pattern type from Rust

## Implementation Notes

### Pattern Matching Logic

```typescript
// Calculate how many tiles from hand match this pattern
const calculateMatchCount = (pattern: Pattern, hand: number[]): number => {
  const handHistogram = createHistogram(hand);
  const patternHistogram = pattern.visual.map(slot => slot.type);
  
  let matchCount = 0;
  patternHistogram.forEach(tileType => {
    if (handHistogram[tileType] > 0) {
      matchCount++;
      handHistogram[tileType]--;
    }
  });
  
  return matchCount;
};
```

### Variable Suit Rendering

```typescript
// VSUIT1, VSUIT2, VSUIT3 represent "same suit" constraints
const getVariableSuitColor = (suitNumber: number): string => {
  const colors = {
    1: 'var(--color-suit-1)', // Light blue
    2: 'var(--color-suit-2)', // Light green
    3: 'var(--color-suit-3)', // Light purple
  };
  return colors[suitNumber] || 'transparent';
};
```

### Tile Grouping

```typescript
// Group tiles visually (pungs, kongs, pairs)
const groupTiles = (visual: TileSlot[]): TileSlot[][] => {
  const groups: TileSlot[][] = [];
  let currentGroup: TileSlot[] = [];
  
  visual.forEach((slot, i) => {
    currentGroup.push(slot);
    
    // Check if next tile is different type (new group)
    if (i === visual.length - 1 || visual[i + 1].type !== slot.type) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  });
  
  return groups;
};
```

### Performance Optimizations

1. **Memoize match calculations**: Only recalculate when hand changes
2. **Virtual scrolling**: For pattern catalog with 60+ patterns
3. **Lazy loading**: Load tile images on demand
4. **CSS transforms**: Use transform for hover effects (GPU accelerated)

## Test Scenarios

### Unit Tests

```typescript
describe('PatternCard', () => {
  it('renders pattern name and points', () => {
    // name and points props should display correctly
  });
  
  it('displays difficulty stars', () => {
    // difficulty should render correct number of stars
  });
  
  it('shows tile composition', () => {
    // visual array should render tiles
  });
  
  it('applies variant styles', () => {
    // variant='compact' should use compact layout
  });
  
  it('highlights matched pattern', () => {
    // isMatched should apply success border
  });
  
  it('shows selection state', () => {
    // isSelected should apply primary border
  });
  
  it('handles click events', () => {
    // onClick should be called when card clicked
  });
  
  it('displays match count', () => {
    // showMatchCount should show "{matched}/{total}"
  });
  
  it('shows concealed indicator', () => {
    // concealedOnly should show "Concealed only" badge
  });
  
  it('groups tiles correctly', () => {
    // Tiles should be grouped by type
  });
});
```

### Integration Tests

```typescript
describe('PatternCard Integration', () => {
  it('calculates match count correctly', () => {
    // Match count should reflect hand overlap
  });
  
  it('updates when hand changes', () => {
    // Should recalculate matches on hand prop change
  });
  
  it('integrates with pattern search', () => {
    // Should highlight search matches
  });
});
```

### Visual Regression Tests

- All variants (full, compact, minimal)
- All states (default, matched, selected, hovered)
- All difficulties (easy, medium, hard, expert)
- Concealed vs exposed patterns
- With and without match count

## Usage Examples

### Full Pattern Display

```tsx
import { PatternCard } from '@/components/game/PatternCard';

function PatternCatalog({ patterns, playerHand }) {
  return (
    <div className="pattern-grid">
      {patterns.map(pattern => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          playerHand={playerHand}
          variant="full"
          showDifficulty
          showPoints
          showMatchCount
        />
      ))}
    </div>
  );
}
```

### Compact Pattern List

```tsx
function PatternSearchResults({ results }) {
  return (
    <div className="pattern-list">
      {results.map(pattern => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          variant="compact"
          showPoints
        />
      ))}
    </div>
  );
}
```

### Interactive Pattern Selection

```tsx
function PatternSelector({ patterns, selected, onSelect }) {
  return (
    <div>
      {patterns.map(pattern => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          isSelected={selected?.id === pattern.id}
          onClick={() => onSelect(pattern)}
          variant="full"
          showDifficulty
          showPoints
        />
      ))}
    </div>
  );
}
```

### Matched Patterns Highlight

```tsx
function AchievablePatterns({ patterns, playerHand, matchedPatternIds }) {
  return (
    <div>
      {patterns.map(pattern => (
        <PatternCard
          key={pattern.id}
          pattern={pattern}
          playerHand={playerHand}
          isMatched={matchedPatternIds.includes(pattern.id)}
          showMatchCount
          variant="compact"
        />
      ))}
    </div>
  );
}
```

## Style Guidelines

### CSS Module Structure

```css
.pattern-card {
  display: flex;
  flex-direction: column;
  background: var(--color-card-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all 0.2s ease;
}

.pattern-card--interactive {
  cursor: pointer;
}

.pattern-card--interactive:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--color-primary-light);
}

/* Variants */
.pattern-card--full {
  width: 100%;
}

.pattern-card--compact {
  width: 100%;
  max-width: 500px;
}

.pattern-card--minimal {
  flex-direction: row;
  align-items: center;
  padding: var(--space-2);
}

/* States */
.pattern-card--matched {
  border: 2px solid var(--color-success);
  background: linear-gradient(135deg, var(--color-card-background) 0%, rgba(16, 185, 129, 0.05) 100%);
}

.pattern-card--selected {
  border: 2px solid var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: var(--shadow-lg);
}

/* Header */
.pattern-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.pattern-card__meta {
  flex: 1;
}

.pattern-card__section {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--space-1);
}

.pattern-card__name {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.pattern-card__points {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pattern-card__points-value {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--color-primary);
}

.pattern-card__difficulty {
  display: flex;
  align-items: center;
  gap: var(--space-0-5);
  color: var(--color-warning);
}

/* Tiles section */
.pattern-card__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-4);
  justify-content: center;
  background: var(--color-background-secondary);
}

.pattern-card__tile-group {
  display: flex;
  gap: var(--space-1);
}

.pattern-card__tile {
  position: relative;
}

.pattern-card__tile--joker {
  box-shadow: 0 0 0 2px var(--color-joker-gold);
}

.pattern-card__tile--variable-suit {
  position: relative;
}

.pattern-card__tile--variable-suit::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: var(--variable-suit-color);
  opacity: 0.2;
  border-radius: var(--radius-sm);
  z-index: -1;
}

.pattern-card__tile--matched::after {
  content: '✓';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: var(--color-success);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

/* Footer */
.pattern-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-background-secondary);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.pattern-card__info {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.pattern-card__exposure-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.pattern-card__match-count {
  font-weight: var(--font-medium);
  color: var(--color-success);
}

/* Compact variant overrides */
.pattern-card--compact .pattern-card__header {
  padding: var(--space-3);
}

.pattern-card--compact .pattern-card__name {
  font-size: var(--text-base);
}

.pattern-card--compact .pattern-card__tiles {
  padding: var(--space-3);
  gap: var(--space-2);
}

.pattern-card--compact .pattern-card__footer {
  padding: var(--space-2) var(--space-3);
}

/* Minimal variant overrides */
.pattern-card--minimal .pattern-card__header,
.pattern-card--minimal .pattern-card__tiles,
.pattern-card--minimal .pattern-card__footer {
  padding: 0;
  border: none;
}

.pattern-card--minimal .pattern-card__name {
  font-size: var(--text-base);
  margin: 0;
}

.pattern-card--minimal .pattern-card__points-value {
  font-size: var(--text-base);
}

/* Responsive */
@media (max-width: 768px) {
  .pattern-card__tiles {
    gap: var(--space-2);
  }
  
  .pattern-card__tile-group {
    gap: var(--space-0-5);
  }
}
```

## Future Enhancements

- [ ] Animated tile entrance on card load
- [ ] Expand/collapse detail section
- [ ] Copy pattern to clipboard
- [ ] Share pattern (social, screenshot)
- [ ] Print-friendly view
- [ ] Filter by exposure type, difficulty, points
- [ ] Pattern comparison mode (side-by-side)
- [ ] Historical patterns (show pattern across multiple years)
- [ ] Pattern popularity statistics
- [ ] User notes/annotations on patterns

## Notes

- Pattern data comes from `data/cards/unified_cardYYYY.json`
- Variable suits (VSUIT1, VSUIT2, VSUIT3) must maintain same-suit constraint
- Concealed-only patterns cannot have exposed melds
- Point values are from official NMJL card (25, 30, 35, 40, 50, 60)
- Difficulty calculated based on tile complexity and flexibility
- Match count helps players prioritize achievable patterns
- Joker positions shown but not counted in match calculation (jokers are wildcards)
- Pattern groups (pungs, kongs, pairs) should be visually separated
- Tile size should be smaller than hand display (32px vs 48px)
- Click handler optional - not all contexts need interactive cards
- Selected state useful for pattern recommendation/suggestion flows
- Matched state indicates "you can win with this pattern"
- Compact variant ideal for lists and search results
- Minimal variant for dropdowns and quick references
- Full variant provides complete pattern information
