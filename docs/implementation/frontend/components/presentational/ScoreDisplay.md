# ScoreDisplay Component Specification

## Component Type

Presentational Component

## Purpose

Displays current game score for all players with breakdown by scoring events (mahjong, exposures, flowers, dead hand penalties). Shows running totals and round-by-round history with visual indicators for leader and score changes.

## Related User Stories

- US-020: Score Calculation (display calculated scores)
- US-021: End Round (round score summary)
- US-034: Spectator Features (score visibility for observers)
- US-033: Save and Resume (historical score display)

## TypeScript Interface

```typescript
export interface ScoreDisplayProps {
  /** Player scores */
  scores: PlayerScore[];

  /** Current round number */
  currentRound?: number;

  /** Total rounds in game */
  totalRounds?: number;

  /** Display mode */
  mode?: 'compact' | 'detailed' | 'history';

  /** Current dealer index */
  dealerIndex?: number;

  /** Highlighted player (winner, current turn) */
  highlightedPlayer?: number;

  /** Show score breakdown */
  showBreakdown?: boolean;

  /** Score history (all rounds) */
  scoreHistory?: RoundScore[];

  /** Whether to animate score changes */
  animateChanges?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Test ID */
  testId?: string;
}

export interface PlayerScore {
  /** Player index (0-3) */
  playerIndex: number;

  /** Player name */
  playerName: string;

  /** Total score */
  totalScore: number;

  /** Score this round */
  roundScore?: number;

  /** Score change from previous round */
  scoreChange?: number;

  /** Whether player won this round */
  wonRound?: boolean;

  /** Whether player is dealer */
  isDealer?: boolean;

  /** Seat position */
  seat: 'east' | 'south' | 'west' | 'north';
}

export interface RoundScore {
  /** Round number */
  round: number;

  /** Winner index */
  winnerIndex?: number;

  /** Scoring details */
  details: ScoreBreakdown[];
}

export interface ScoreBreakdown {
  /** Player index */
  playerIndex: number;

  /** Base score (mahjong value) */
  baseScore: number;

  /** Flower bonuses */
  flowerBonus: number;

  /** Exposure penalties/bonuses */
  exposureAdjustment: number;

  /** Dead hand penalty */
  deadHandPenalty: number;

  /** Total for this round */
  roundTotal: number;
}
```text

## Internal State

```typescript
interface ScoreDisplayState {
  /** Currently expanded player detail */
  expandedPlayer: number | null;

  /** Animation state */
  animatingScores: Map<number, number>; // playerIndex -> animating score
}
```text

## State Management

**Internal useState** for expanded details and animations. Scores managed by parent component.

## Visual Design

### Mode Variants

#### Compact

- Single row with player names and total scores
- Width: 100% (responsive)
- Height: 48px
- Use for: In-game header, persistent score bar

#### Detailed

- Grid layout (2×2) showing all players
- Shows round score, total score, seat indicator
- Dealer marked with "D" badge
- Use for: Game table display, post-round summary

#### History

- Table with rounds as rows, players as columns
- Shows round-by-round progression
- Running totals row at bottom
- Use for: End of game, score review

### Player Score Cards (Detailed Mode)

- **Card**: `var(--color-card-background)` background, `var(--shadow-md)`
- **Seat color**: Border-left 4px solid seat color (East: red, South: green, West: blue, North: yellow)
- **Dealer badge**: "D" in seat color, top-right corner
- **Winner**: Gold medal icon, green background tint
- **Name**: `var(--text-base)`, `var(--font-semibold)`
- **Total score**: `var(--text-2xl)`, `var(--font-bold)`
- **Round score**: `var(--text-sm)`, green if positive, red if negative
- **Spacing**: `var(--space-4)` padding, `var(--space-2)` gap

### Score Change Indicators

- **Positive change**: Green arrow up ↑, "+{points}"
- **Negative change**: Red arrow down ↓, "-{points}"
- **No change**: Gray dash "—"
- **Animation**: Number counter from old → new score (1 second)

### Compact Mode Layout

```text
+----------------------------------------------------------+
| Player 1: 240  |  Player 2: 185  |  Player 3: 210  |  P4: 165 |
+----------------------------------------------------------+
```text

### Detailed Mode Layout (2×2 Grid)

```text
+------------------------+  +------------------------+
| EAST (Dealer) [D]      |  | SOUTH                  |
| Player 1               |  | Player 2               |
| 240  (+50) ↑          |  | 185  (-10) ↓          |
| Round 3 of 4           |  | Round 3 of 4           |
+------------------------+  +------------------------+

+------------------------+  +------------------------+
| WEST                   |  | NORTH                  |
| Player 3               |  | Player 4               |
| 210  (+20) ↑          |  | 165  (-5) ↓           |
| Round 3 of 4           |  | Round 3 of 4           |
+------------------------+  +------------------------+
```text

### History Mode Table

```text
Round | Player 1 (E) | Player 2 (S) | Player 3 (W) | Player 4 (N)
------|--------------|--------------|--------------|-------------
  1   |    +50       |    +25       |    +25       |    +25
  2   |    +30       |    -20       |    +40       |    -30
  3   |    +50       |    -10       |    +20       |    -5
------|--------------|--------------|--------------|-------------
Total |    240       |    185       |    210       |    165
```text

### Score Breakdown Expansion

Clicking a player card expands to show:

- Base score: 50
- Flower bonuses: +8 (2 flowers)
- Exposure penalties: 0
- Dead hand penalty: 0
- **Round total: 58**

## Accessibility

### ARIA Attributes

- `role="table"` for history mode
- `role="rowgroup"`, `role="row"`, `role="columnheader"`, `role="cell"` for table structure
- `aria-label="Score display"` for container
- `aria-label="{name}, {total} points, {seat}"` for each player
- `aria-label="Current dealer"` for dealer badge
- `aria-label="Round winner"` for winner indicator
- `aria-live="polite"` for score changes
- `aria-expanded` for expandable breakdown

### Keyboard Support

- **Tab**: Navigate between player cards
- **Enter/Space**: Expand/collapse breakdown (detailed mode)
- **Arrow Keys**: Navigate table cells (history mode)

### Screen Reader Support

- Announce player, seat, score, and role on focus
- Announce "Dealer" when dealer badge present
- Announce "Winner this round" when won
- Announce score changes: "{name} scored {points} this round, total {total}"
- Announce round progression: "Round {current} of {total}"

### Visual Accessibility

- High contrast for scores
- Color not sole indicator (icons + text for winner/dealer)
- Sufficient spacing for touch targets (48px min)
- Focus visible on keyboard navigation

## Dependencies

### External

- React (hooks: `useState`, `useEffect`, `useCallback`)
- `clsx` for conditional class names

### Internal

- `@/components/ui/Badge` - Dealer badge, winner medal
- `@/components/ui/Card` - Player score cards
- `@/utils/formatScore` - Score formatting (+50, -10)
- `@/utils/seatColors` - Seat color mapping
- `@/styles/scoreDisplay.module.css` - Component styles

### Generated Types

- `@/types/bindings/generated/Score.ts` - Score types
- `@/types/bindings/generated/Seat.ts` - Seat enum

## Implementation Notes

### Score Animation

```typescript
const animateScore = (playerIndex: number, from: number, to: number) => {
  const duration = 1000; // 1 second
  const startTime = Date.now();

  const updateScore = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.round(from + (to - from) * progress);

    setAnimatingScores((prev) => new Map(prev).set(playerIndex, current));

    if (progress < 1) {
      requestAnimationFrame(updateScore);
    }
  };

  requestAnimationFrame(updateScore);
};
```text

### Score Change Calculation

```typescript
const getScoreChange = (currentScore: number, previousScore: number): number => {
  return currentScore - previousScore;
};

const formatScoreChange = (change: number): string => {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return '—';
};
```text

### Seat Color Mapping

```typescript
const SEAT_COLORS = {
  east: 'var(--color-seat-east)', // #ef4444 red
  south: 'var(--color-seat-south)', // #10b981 green
  west: 'var(--color-seat-west)', // #3b82f6 blue
  north: 'var(--color-seat-north)', // #f59e0b yellow
};
```text

### Performance Optimizations

1. **Memoize score calculations**: Use `useMemo` for breakdown totals
2. **Virtualize history table**: For games with 20+ rounds
3. **Throttle animations**: Don't animate every score update
4. **CSS animations**: Use CSS for entrance/exit, not JavaScript

## Test Scenarios

### Unit Tests

```typescript
describe('ScoreDisplay', () => {
  it('renders all player scores', () => {
    // scores.length should render correct number of player cards
  });

  it('displays compact mode correctly', () => {
    // mode='compact' should show single row
  });

  it('displays detailed mode with grid', () => {
    // mode='detailed' should show 2×2 grid
  });

  it('displays history mode as table', () => {
    // mode='history' should render table with rounds
  });

  it('marks dealer correctly', () => {
    // isDealer should show dealer badge
  });

  it('highlights winner', () => {
    // wonRound should show winner indicator
  });

  it('calculates score changes', () => {
    // scoreChange should be formatted correctly
  });

  it('expands score breakdown', () => {
    // Clicking card should show breakdown details
  });

  it('animates score changes', () => {
    // animateChanges should trigger counter animation
  });

  it('applies seat colors', () => {
    // Seat colors should match border-left colors
  });
});
```text

### Integration Tests

```typescript
describe('ScoreDisplay Integration', () => {
  it('updates when scores change', () => {
    // Score prop changes should re-render
  });

  it('transitions between modes', () => {
    // Mode changes should update layout
  });

  it('integrates with round progression', () => {
    // currentRound should update display
  });

  it('announces changes to screen readers', () => {
    // aria-live should announce score updates
  });
});
```text

### Visual Regression Tests

- All mode variants (compact, detailed, history)
- Score change indicators (positive, negative, none)
- Dealer badge display
- Winner highlighting
- Expanded breakdown view
- Animation frames

## Usage Examples

### Compact Mode (In-Game Header)

```tsx
import { ScoreDisplay } from '@/components/game/ScoreDisplay';

function GameHeader({ scores }) {
  return (
    <header>
      <ScoreDisplay scores={scores} mode="compact" animateChanges={false} />
    </header>
  );
}
```text

### Detailed Mode (Game Table)

```tsx
function GameTable({ game }) {
  return (
    <div className="game-table">
      <ScoreDisplay
        scores={game.scores}
        mode="detailed"
        currentRound={game.currentRound}
        totalRounds={game.totalRounds}
        dealerIndex={game.dealerIndex}
        highlightedPlayer={game.currentPlayerIndex}
        showBreakdown
        animateChanges
      />
    </div>
  );
}
```text

### History Mode (End of Game)

```tsx
function GameSummary({ scoreHistory, finalScores }) {
  return (
    <div>
      <h2>Game Summary</h2>
      <ScoreDisplay scores={finalScores} mode="history" scoreHistory={scoreHistory} />
    </div>
  );
}
```text

### Post-Round Summary

```tsx
function RoundSummary({ roundScore, scores }) {
  const winnerIndex = roundScore.winnerIndex;

  return (
    <ScoreDisplay
      scores={scores}
      mode="detailed"
      highlightedPlayer={winnerIndex}
      showBreakdown
      animateChanges
    />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.score-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Compact mode */
.score-display--compact {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-card-background);
  border-bottom: 1px solid var(--color-border);
}

.score-display--compact .player-score {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

/* Detailed mode */
.score-display--detailed {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.player-card {
  position: relative;
  padding: var(--space-4);
  background: var(--color-card-background);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border-left: 4px solid var(--seat-color);
  transition: all 0.2s ease;
}

.player-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.player-card--winner {
  background: linear-gradient(
    135deg,
    var(--color-card-background) 0%,
    rgba(16, 185, 129, 0.1) 100%
  );
  border-color: var(--color-success);
}

.player-card--highlighted {
  box-shadow: 0 0 0 3px var(--color-primary);
}

/* Player info */
.player-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-2);
}

.player-card__seat {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--seat-color);
  text-transform: uppercase;
}

.player-card__name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  margin-top: var(--space-1);
}

/* Scores */
.player-card__total {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin: var(--space-2) 0;
}

.player-card__change {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.player-card__change--positive {
  color: var(--color-success);
}

.player-card__change--negative {
  color: var(--color-error);
}

.player-card__change--neutral {
  color: var(--color-text-disabled);
}

/* Badges */
.dealer-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--seat-color);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

.winner-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-success);
  margin-top: var(--space-2);
}

/* Score breakdown */
.score-breakdown {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.score-breakdown__row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0;
  font-size: var(--text-sm);
}

.score-breakdown__label {
  color: var(--color-text-secondary);
}

.score-breakdown__value {
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

/* History mode */
.score-display--history {
  overflow-x: auto;
}

.score-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-card-background);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.score-table th,
.score-table td {
  padding: var(--space-3);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.score-table th {
  background: var(--color-background-secondary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.score-table td {
  font-size: var(--text-base);
}

.score-table .total-row {
  background: var(--color-background-secondary);
  font-weight: var(--font-bold);
}

.score-table .positive-score {
  color: var(--color-success);
}

.score-table .negative-score {
  color: var(--color-error);
}

/* Animations */
@keyframes score-increase {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    color: var(--color-success);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes score-decrease {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.9);
    color: var(--color-error);
  }
  100% {
    transform: scale(1);
  }
}

.score-animating-up {
  animation: score-increase 0.5s ease;
}

.score-animating-down {
  animation: score-decrease 0.5s ease;
}

/* Responsive */
@media (max-width: 768px) {
  .score-display--detailed {
    grid-template-columns: 1fr;
  }

  .score-display--compact {
    font-size: var(--text-xs);
    padding: var(--space-2);
  }
}
```text

## Future Enhancements

- [ ] Score graph/chart over time
- [ ] Predicted final scores (based on current trend)
- [ ] Player statistics (avg score, win rate)
- [ ] Export score history (CSV, JSON)
- [ ] Comparison mode (this game vs previous games)
- [ ] Custom scoring rules configuration
- [ ] Sound effects for score changes
- [ ] Leaderboard integration (across multiple games)
- [ ] Achievement badges (highest score, comeback, etc.)

## Notes

- Scores should update in real-time during round resolution
- Animation duration: 1 second (smooth but not too slow)
- Dealer badge always visible for clarity
- Winner indication should be prominent but not garish
- Seat colors consistent with game board display
- Breakdown expansion useful for dispute resolution
- History mode allows players to review entire game
- Compact mode optimized for persistent display during gameplay
- Score changes use relative indicators (+/-) not absolute values
- Running totals in history mode help track progression
- Mobile layout may need single-column detailed view
- Consider localStorage for score history persistence
- NMJL scoring can reach high values (200+), ensure layout accommodates
