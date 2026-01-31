# TileNeedsList Component Specification

## Component Type

Presentational Component

## Purpose

Displays tiles needed to complete viable patterns, helping players understand what to collect and what to discard. Shows pattern completion status, tile availability, and strategic guidance.

## Related User Stories

- US-029: Winning Probability (show tiles needed for viable patterns)
- US-030: Pattern Suggestions (AI-recommended patterns with needs)
- US-027: Defensive Strategy (show dangerous discards based on needs)
- US-031: Adaptive Difficulty (beginner hints show needed tiles)

## TypeScript Interface

````typescript
export interface TileNeedsListProps {
  /** Patterns with their tile needs */
  patternNeeds: PatternNeeds[];

  /** Current player's hand */
  playerHand: number[];

  /** Tiles remaining in wall (availability) */
  tilesRemaining: Record<number, number>;

  /** Display variant */
  variant?: 'full' | 'compact' | 'minimal';

  /** Sort order */
  sortBy?: 'probability' | 'points' | 'needs';

  /** Max patterns to show */
  maxPatterns?: number;

  /** Show tile availability indicators */
  showAvailability?: boolean;

  /** Show pattern details on click */
  expandable?: boolean;

  /** Callback when pattern is selected */
  onPatternSelect?: (pattern: PatternNeeds) => void;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface PatternNeeds {
  /** Pattern information */
  pattern: Pattern;

  /** Tiles needed to complete pattern */
  neededTiles: TileNeed[];

  /** Number of tiles still needed */
  tilesAway: number;

  /** Probability of completing (0-1) */
  probability: number;

  /** Whether pattern is concealed-only */
  concealedOnly: boolean;

  /** Tiles already matched in hand */
  matchedTiles: number[];
}

export interface TileNeed {
  /** Tile index */
  tile: number;

  /** Quantity needed */
  quantity: number;

  /** Quantity available in wall */
  available: number;

  /** Whether this tile is critical (bottleneck) */
  isCritical: boolean;

  /** Alternative tiles (for flexible patterns) */
  alternatives?: number[];
}

export interface Pattern {
  id: string;
  name: string;
  section: number;
  patternNumber: number;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}
```text

## Internal State

```typescript
interface TileNeedsListState {
  /** Expanded pattern IDs */
  expandedPatterns: Set<string>;

  /** Sort order state */
  currentSort: SortOrder;
}
```text

## State Management

**Internal useState** for expansion and sorting. Pattern needs data from parent component.

## Visual Design

### Variant Styles

#### Full

- Complete pattern cards with details
- Tile images for needs
- Probability bars
- Expandable sections
- Use for: Desktop sidebar, dedicated hints panel

#### Compact

- Single-line pattern summary
- Text-based tile representation
- No expansion
- Use for: Mobile, limited space

#### Minimal

- Pattern number + tiles away only
- No tile images
- Use for: Status bar, quick glance

### List Layout

```text
+--------------------------------------------------+
| Tile Needs (3 viable patterns)        [Sort ▼]  |
+--------------------------------------------------+
| ⭐⭐⭐ 2-3 "Consecutive Run" (35 pts)    📊 65%  |
| Need: 2 tiles                                    |
| [2B] [3B] (2 available each)                     |
| ✓ High probability • ⚠️ 2B is critical           |
+--------------------------------------------------+
| ⭐⭐ 5-1 "Like Numbers" (30 pts)          📊 45%  |
| Need: 3 tiles                                    |
| [5B] [5C] [5D] (1, 2, 3 available)               |
| ⚠️ 5B critical (only 1 left)                     |
+--------------------------------------------------+
| ⭐⭐⭐⭐ 7-5 "Winds & Dragons" (50 pts)   📊 15%  |
| Need: 4 tiles                                    |
| [🀀] [🀁] [🀂] [🀃] (concealed only)             |
| Low probability • Many tiles needed              |
+--------------------------------------------------+
```text

### Pattern Card Structure (Full Variant)

#### Header

- **Pattern name**: `var(--text-base)`, `var(--font-semibold)`
- **Pattern number**: "2-3" in gray
- **Points**: Bold, `var(--color-primary)`
- **Difficulty stars**: 1-4 stars
- **Probability bar**: Visual indicator (green→yellow→red)

#### Needs Section

- **"Need X tiles"**: Clear count
- **Tile images**: Actual tile renders with count badges
- **Availability**: "(2 available)" in gray
- **Critical indicator**: ⚠️ for bottleneck tiles

#### Status Badges

- **High probability**: Green badge "65%"
- **Medium probability**: Yellow badge "45%"
- **Low probability**: Red badge "15%"
- **Concealed only**: Purple badge "Concealed"

### Tile Representation

#### Full Variant

- **Tile images**: 32px × 43px tiles
- **Count badge**: "×2" in bottom-right corner
- **Availability**: Color-coded border
  - Green: 3+ available
  - Yellow: 1-2 available
  - Red: 0 available (impossible)

#### Compact Variant

- **Text format**: "[2B]"
- **Count**: "(need 2, 3 left)"
- **Color coding**: Green/yellow/red text color

### Probability Indicator

- **Bar**: Horizontal progress bar
- **Percentage**: Text label "65%"
- **Colors**:
  - 60-100%: `var(--color-success)` (green)
  - 30-59%: `var(--color-warning)` (yellow)
  - 0-29%: `var(--color-error)` (red)

### Sort Options

- **By Probability**: Highest chance first (default)
- **By Points**: Most valuable first
- **By Needs**: Fewest tiles needed first

### Empty State

```text
+--------------------------------------------------+
|  No viable patterns found                        |
|  Try collecting tiles from different suits       |
+--------------------------------------------------+
```text

## Accessibility

### ARIA Attributes

- `role="list"` for pattern list
- `role="listitem"` for each pattern
- `aria-label="Tile needs list"` for container
- `aria-label="{patternName}, need {count} tiles, {probability}% chance"` for patterns
- `aria-expanded` for expandable patterns
- `aria-live="polite"` for list updates

### Keyboard Support

- **Tab**: Navigate between patterns
- **Enter/Space**: Expand/collapse pattern (if expandable)
- **Arrow Up/Down**: Navigate patterns
- **Home/End**: First/last pattern

### Screen Reader Support

- Announce pattern: "Consecutive Run, need 2 tiles, 65% probability"
- Announce tiles: "Need 2 Bam, 2 available"
- Announce critical tiles: "Warning: 2 Bam is critical"
- Announce updates: "Tile needs updated, 2 viable patterns"

### Visual Accessibility

- High contrast for all text
- Probability not indicated by color alone (percentage + bar)
- Critical tiles marked with icon + text
- Focus visible on interactive elements

## Dependencies

### External

- React (hooks: `useState`, `useMemo`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/game/TileImage` - Tile rendering
- `@/components/ui/Badge` - Status badges
- `@/components/icons/StarIcon` - Difficulty stars
- `@/components/icons/WarningIcon` - Critical tile indicator
- `@/utils/tileUtils` - Tile formatting
- `@/utils/patternUtils` - Pattern calculations
- `@/styles/tileNeedsList.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Pattern.ts` - Pattern type

## Implementation Notes

### Probability Calculation

```typescript
const calculateProbability = (
  needs: TileNeed[],
  tilesRemaining: Record<number, number>,
  wallSize: number
): number => {
  // Hypergeometric distribution for each needed tile
  let totalProb = 1.0;

  for (const need of needs) {
    const available = tilesRemaining[need.tile] || 0;
    const prob = available >= need.quantity ? (available / wallSize) ** need.quantity : 0;

    totalProb *= prob;
  }

  return totalProb;
};
```text

### Critical Tile Detection

```typescript
const isCriticalTile = (
  tile: number,
  need: TileNeed,
  tilesRemaining: Record<number, number>
): boolean => {
  const available = tilesRemaining[tile] || 0;

  // Critical if availability ≤ quantity needed
  return available <= need.quantity && available > 0;
};
```text

### Sort Implementation

```typescript
const sortPatterns = (patterns: PatternNeeds[], sortBy: SortOrder): PatternNeeds[] => {
  return [...patterns].sort((a, b) => {
    switch (sortBy) {
      case 'probability':
        return b.probability - a.probability;
      case 'points':
        return b.pattern.points - a.pattern.points;
      case 'needs':
        return a.tilesAway - b.tilesAway;
      default:
        return 0;
    }
  });
};
```text

### Availability Color Coding

```typescript
const getAvailabilityColor = (available: number, needed: number): string => {
  if (available === 0) return 'var(--color-error)';
  if (available <= needed) return 'var(--color-warning)';
  return 'var(--color-success)';
};
```text

## Test Scenarios

### Unit Tests

```typescript
describe('TileNeedsList', () => {
  it('renders pattern needs correctly', () => {
    // Should display pattern name, points, tiles needed
  });

  it('sorts by probability', () => {
    // sortBy='probability' should order by probability desc
  });

  it('sorts by points', () => {
    // sortBy='points' should order by points desc
  });

  it('sorts by needs', () => {
    // sortBy='needs' should order by tilesAway asc
  });

  it('shows tile availability', () => {
    // showAvailability should display available count
  });

  it('highlights critical tiles', () => {
    // Tiles with low availability should show warning
  });

  it('calculates probability correctly', () => {
    // Probability should reflect tile availability
  });

  it('limits displayed patterns', () => {
    // maxPatterns should limit list length
  });

  it('handles empty state', () => {
    // Empty patternNeeds should show empty message
  });

  it('expands/collapses patterns', () => {
    // Clicking pattern should toggle expansion
  });
});
```text

### Integration Tests

```typescript
describe('TileNeedsList Integration', () => {
  it('updates when hand changes', () => {
    // Needs should recalculate on hand update
  });

  it('updates when tiles drawn', () => {
    // Availability should decrease as tiles drawn
  });

  it('integrates with pattern selection', () => {
    // Clicking pattern should trigger onPatternSelect
  });
});
```text

### Visual Regression Tests

- All variants (full, compact, minimal)
- All sort orders
- Empty state
- Expanded/collapsed states
- Different probability ranges
- Critical tile warnings

## Usage Examples

### Full Sidebar Display

```tsx
import { TileNeedsList } from '@/components/game/TileNeedsList';

function GameSidebar({ game }) {
  const patterns = analyzeViablePatterns(game.playerHand, game.availablePatterns);

  return (
    <aside className="game-sidebar">
      <TileNeedsList
        patternNeeds={patterns}
        playerHand={game.playerHand}
        tilesRemaining={game.wallTiles}
        variant="full"
        sortBy="probability"
        showAvailability
        expandable
      />
    </aside>
  );
}
```text

### Compact Mobile View

```tsx
function MobileHints({ patterns, hand, wall }) {
  return (
    <TileNeedsList
      patternNeeds={patterns}
      playerHand={hand}
      tilesRemaining={wall}
      variant="compact"
      maxPatterns={3}
      sortBy="probability"
    />
  );
}
```text

### Pattern Selection Dialog

```tsx
function PatternSelector({ onSelect }) {
  const patterns = useViablePatterns();

  return (
    <Modal>
      <h2>Choose Target Pattern</h2>
      <TileNeedsList
        patternNeeds={patterns}
        playerHand={playerHand}
        tilesRemaining={wallTiles}
        variant="full"
        sortBy="points"
        expandable
        onPatternSelect={onSelect}
      />
    </Modal>
  );
}
```text

### Minimal Status Bar

```tsx
function GameStatus({ patterns }) {
  const topPattern = patterns[0];

  return (
    <div className="status-bar">
      <TileNeedsList
        patternNeeds={[topPattern]}
        playerHand={hand}
        tilesRemaining={wall}
        variant="minimal"
        maxPatterns={1}
      />
    </div>
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.tile-needs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tile-needs-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-background-secondary);
  border-radius: var(--radius-md);
}

.tile-needs-list__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.tile-needs-list__sort {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

/* Pattern card */
.pattern-need {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: all 0.2s ease;
}

.pattern-need--expandable {
  cursor: pointer;
}

.pattern-need--expandable:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.pattern-need--expanded {
  border-color: var(--color-primary);
}

/* Pattern header */
.pattern-need__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.pattern-need__info {
  flex: 1;
}

.pattern-need__name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.pattern-need__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.pattern-need__number {
  font-weight: var(--font-medium);
}

.pattern-need__points {
  color: var(--color-primary);
  font-weight: var(--font-bold);
}

.pattern-need__difficulty {
  display: flex;
  align-items: center;
  gap: var(--space-0-5);
  color: var(--color-warning);
}

/* Probability */
.pattern-need__probability {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

.pattern-need__prob-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
}

.pattern-need__prob-value--high {
  color: var(--color-success);
}

.pattern-need__prob-value--medium {
  color: var(--color-warning);
}

.pattern-need__prob-value--low {
  color: var(--color-error);
}

.pattern-need__prob-bar {
  width: 60px;
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.pattern-need__prob-fill {
  height: 100%;
  background: currentColor;
  transition: width 0.3s ease;
}

/* Needs summary */
.pattern-need__summary {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
}

/* Tiles needed */
.pattern-need__tiles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tile-need {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.tile-need__image {
  position: relative;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  transition: border-color 0.2s ease;
}

.tile-need__image--available {
  border-color: var(--color-success);
}

.tile-need__image--limited {
  border-color: var(--color-warning);
}

.tile-need__image--unavailable {
  border-color: var(--color-error);
  opacity: 0.5;
}

.tile-need__count {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

.tile-need__availability {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.tile-need__critical {
  display: flex;
  align-items: center;
  gap: var(--space-0-5);
  color: var(--color-warning);
  font-size: var(--text-xs);
}

/* Status badges */
.pattern-need__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* Compact variant */
.pattern-need--compact {
  padding: var(--space-2);
}

.pattern-need--compact .pattern-need__name {
  font-size: var(--text-sm);
}

.pattern-need--compact .pattern-need__tiles {
  gap: var(--space-1);
}

/* Minimal variant */
.pattern-need--minimal {
  padding: var(--space-2);
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.pattern-need--minimal .pattern-need__name {
  font-size: var(--text-sm);
  margin: 0;
}

/* Empty state */
.tile-needs-list__empty {
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-disabled);
  font-size: var(--text-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .pattern-need {
    padding: var(--space-3);
  }

  .pattern-need__prob-bar {
    width: 40px;
  }
}
```text

## Future Enhancements

- [ ] Animated probability updates
- [ ] Tile need timeline (show when tiles might become available)
- [ ] Alternative pattern suggestions
- [ ] Pattern comparison mode
- [ ] Export needs list as image
- [ ] Voice announcement of top pattern
- [ ] Grouping by pattern category
- [ ] Filter by difficulty/points range
- [ ] Highlight tiles in hand that match needs
- [ ] Show discarded tiles that were needed
- [ ] Pattern needs history (track over turns)
- [ ] "Hot streak" indicator (pattern getting closer)

## Notes

- Probability calculated using hypergeometric distribution
- Critical tiles highlighted when availability ≤ quantity needed
- Sort by probability default (most achievable patterns first)
- Empty state when no viable patterns (rare, usually means scattered hand)
- Concealed-only patterns less valuable if player has exposed melds
- Tile availability decreases as game progresses (wall shrinks)
- High-value patterns often low probability (trade-off)
- Compact variant useful for mobile/small screens
- Expandable patterns show full tile composition
- Color coding: green (good), yellow (risky), red (unlikely)
- Consider showing "impossible" patterns (0% probability) with explanation
- Real-time updates as tiles drawn/discarded
- Integration with pattern matching engine from Rust backend
- Helps beginners understand what to collect
- Advanced players use for probability optimization
- Defensive players check to avoid feeding opponent's needs
````
