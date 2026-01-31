# CharlestonTracker Component Specification

## 1. Component Overview

### Purpose

Visual indicator showing the current Charleston phase, pass direction, and progress through the Charleston stages (First Right/Across/Left, voting, Second Charleston, Courtesy Pass).

### Category

Presentational Component - Core Game Elements

### User Stories

- US-002: Charleston - First Right
- US-003: Charleston - First Across
- US-004: Charleston - First Left
- US-005: Charleston - Voting (Stop/Continue)
- US-006: Charleston - Second Charleston
- US-007: Courtesy Pass Negotiation
- US-008: Charleston - IOU Detection

### Design Principles

- **Visual Clarity**: Clear indication of current phase and direction
- **Progress Awareness**: Show completed, current, and upcoming stages
- **Directional Feedback**: Arrows indicate pass direction
- **Compact Display**: Efficient use of screen space
- **Cultural Accuracy**: Correct terminology and sequence

---

## 2. Visual Design

### Layout Modes

#### Horizontal Timeline (Default)

```
┌──────────────────────────────────────────────────────────────────┐
│  CHARLESTON PHASE                                                │
│  ● First Right  →  ● First Across  →  ● First Left  →  ● Vote   │
│  ✓               ✓                 ●                            │
└──────────────────────────────────────────────────────────────────┘
Width: 600px, Height: 60px
```

#### Vertical Progress (Mobile)

```
┌─────────────────┐
│  CHARLESTON     │
│─────────────────│
│  ✓ First Right  │
│  ✓ First Across │
│  ● First Left   │ ← Current
│  ○ Vote         │
│  ○ 2nd Right    │
└─────────────────┘
Width: 180px, Height: auto
```

#### Compact Indicator

```
┌───────────────────────────┐
│ Charleston: First Left → │
└───────────────────────────┘
Width: 240px, Height: 36px
```

### Stage Indicators

#### Stage States

```
✓ - Completed (Green checkmark, #10B981)
● - Current   (Blue filled circle, #2563EB, pulsing)
○ - Upcoming  (Gray outlined circle, #D1D5DB)
✕ - Skipped   (Red X, #EF4444)
```

#### Directional Arrows

```
→ - Right (East → South → West → North → East)
↓ - Across (East ↔ West, North ↔ South)
← - Left (reverse of right)
⟲ - Blind Pass (circular arrow)
↔ - Courtesy Pass (bidirectional between pairs)
```

### Charleston Sequence

#### First Charleston

1. **First Right** → (pass 3 tiles right)
2. **First Across** ↓ (pass 3 tiles across)
3. **First Left** ← (pass 3 tiles left)
4. **Blind Pass** ⟲ (optional, 0-3 tiles right from incoming)
5. **Vote** (Stop or Continue)

#### Second Charleston (if vote continues)

6. **Second Right** →
7. **Second Across** ↓
8. **Second Left** ←
9. **Blind Pass** ⟲

#### Courtesy Pass (if negotiated)

10. **Courtesy Propose** ↔
11. **Courtesy Accept** ↔
12. **Courtesy Exchange** ↔

### Color Scheme

```css
Current Stage:     #2563EB (Blue-600) - Filled circle, pulsing
Completed Stage:   #10B981 (Green-500) - Checkmark
Upcoming Stage:    #D1D5DB (Gray-300) - Outlined circle
Skipped Stage:     #EF4444 (Red-500) - X mark, strikethrough text
Background:        #F3F4F6 (Gray-100)
Border:            #E5E7EB (Gray-200)
Arrow Color:       #6B7280 (Gray-500)
```

### Typography

- **Title**: 14px, bold, uppercase, gray-900 ("CHARLESTON PHASE")
- **Stage Name**: 13px, medium, gray-700
- **Direction**: 16px, gray-500 (arrows)
- **Progress**: 12px, gray-600 ("3 of 5 stages")

---

## 3. Props Interface

```typescript
import { CharlestonStage } from '@/types/bindings/generated';

export interface CharlestonTrackerProps {
  /** Current Charleston stage */
  currentStage: CharlestonStage;

  /** Stages that have been completed */
  completedStages: CharlestonStage[];

  /** Whether second Charleston was skipped (voted stop) */
  secondCharlestonSkipped?: boolean;

  /** Whether courtesy pass is being negotiated */
  courtesyPassActive?: boolean;

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical' | 'compact';

  /** Whether to show stage descriptions (tooltips) */
  showDescriptions?: boolean;

  /** Optional CSS classes */
  className?: string;
}

/** Charleston stage display names */
const STAGE_NAMES: Record<CharlestonStage, string> = {
  FirstRight: 'First Right',
  FirstAcross: 'First Across',
  FirstLeft: 'First Left',
  FirstBlindPassCollect: 'Blind Pass',
  StopVote: 'Vote',
  SecondRight: 'Second Right',
  SecondAcross: 'Second Across',
  SecondLeft: 'Second Left',
  SecondBlindPassCollect: 'Blind Pass 2',
  CourtesyPropose: 'Courtesy',
  CourtesyAccept: 'Courtesy Accept',
  Complete: 'Complete',
};

/** Directional arrows for each stage */
const STAGE_ARROWS: Record<CharlestonStage, string> = {
  FirstRight: '→',
  FirstAcross: '↓',
  FirstLeft: '←',
  FirstBlindPassCollect: '⟲',
  StopVote: '',
  SecondRight: '→',
  SecondAcross: '↓',
  SecondLeft: '←',
  SecondBlindPassCollect: '⟲',
  CourtesyPropose: '↔',
  CourtesyAccept: '↔',
  Complete: '',
};

/** Stage descriptions for tooltips */
const STAGE_DESCRIPTIONS: Record<CharlestonStage, string> = {
  FirstRight: 'Pass 3 tiles to the player on your right',
  FirstAcross: 'Pass 3 tiles to the player across from you',
  FirstLeft: 'Pass 3 tiles to the player on your left',
  FirstBlindPassCollect: 'Optional: Pass 0-3 tiles right from incoming tiles',
  StopVote: 'Vote to stop or continue the Charleston',
  SecondRight: 'Pass 3 tiles to the player on your right',
  SecondAcross: 'Pass 3 tiles to the player across from you',
  SecondLeft: 'Pass 3 tiles to the player on your left',
  SecondBlindPassCollect: 'Optional: Pass 0-3 tiles right from incoming tiles',
  CourtesyPropose: 'Propose courtesy pass with your opponent',
  CourtesyAccept: 'Accept or decline courtesy pass',
  Complete: 'Charleston complete, game begins',
};
```

---

## 4. Component Variants

### 1. First Charleston Active

```tsx
<CharlestonTracker
  currentStage="FirstLeft"
  completedStages={['FirstRight', 'FirstAcross']}
  orientation="horizontal"
  showDescriptions={true}
/>
```

**Visual**: Timeline with First Right/Across checked, First Left pulsing blue, Vote/Second upcoming gray

### 2. Voting Stage

```tsx
<CharlestonTracker
  currentStage="StopVote"
  completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'FirstBlindPassCollect']}
  orientation="horizontal"
/>
```

**Visual**: First Charleston stages completed (green checks), Vote stage current (blue pulse), Second Charleston grayed out

### 3. Second Charleston Skipped

```tsx
<CharlestonTracker
  currentStage="Complete"
  completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'FirstBlindPassCollect', 'StopVote']}
  secondCharlestonSkipped={true}
  orientation="horizontal"
/>
```

**Visual**: First Charleston completed, Second Charleston stages have red X (skipped), Complete stage green

### 4. Courtesy Pass Active

```tsx
<CharlestonTracker
  currentStage="CourtesyPropose"
  completedStages={[
    'FirstRight',
    'FirstAcross',
    'FirstLeft',
    'FirstBlindPassCollect',
    'StopVote',
    'SecondRight',
    'SecondAcross',
    'SecondLeft',
    'SecondBlindPassCollect',
  ]}
  courtesyPassActive={true}
  orientation="horizontal"
/>
```

**Visual**: All Charleston stages completed, Courtesy Pass current with bidirectional arrow

### 5. Mobile Vertical Layout

```tsx
<CharlestonTracker
  currentStage="FirstAcross"
  completedStages={['FirstRight']}
  orientation="vertical"
  showDescriptions={false}
/>
```

**Visual**: Vertical stack with checkmark for First Right, blue dot for First Across, outlined circles for remaining stages

### 6. Compact Display

```tsx
<CharlestonTracker
  currentStage="SecondLeft"
  completedStages={[
    'FirstRight',
    'FirstAcross',
    'FirstLeft',
    'FirstBlindPassCollect',
    'StopVote',
    'SecondRight',
    'SecondAcross',
  ]}
  orientation="compact"
/>
```

**Visual**: "Charleston: Second Left ←" with progress "8/10"

---

## 5. Behavior & Interaction

### Stage Progression

#### Automatic Updates

- Component updates when `currentStage` prop changes
- Completed stages automatically marked with checkmark
- Upcoming stages remain grayed out
- Current stage pulses to draw attention

#### Stage Transitions

```typescript
// Transition animation when stage changes
useEffect(() => {
  if (currentStage !== previousStage) {
    // Animate previous stage to completed (fade to green checkmark)
    animatePreviousStageComplete(previousStage);

    // Animate current stage to active (fade in blue pulse)
    animateCurrentStageActive(currentStage);
  }
}, [currentStage, previousStage]);
```

### Visual Feedback

#### Current Stage Pulse

```css
@keyframes stagePulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.8;
  }
}

.stage-current {
  animation: stagePulse 2s ease-in-out infinite;
}
```

#### Completion Animation

```css
@keyframes checkmarkDraw {
  0% {
    stroke-dashoffset: 20;
    opacity: 0;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

.checkmark-icon {
  animation: checkmarkDraw 300ms ease-out forwards;
}
```

### Tooltips (when showDescriptions=true)

#### Hover Behavior

- Hover over any stage to see description tooltip
- Tooltip appears above stage indicator (centered)
- 200ms delay before showing
- Tooltip content: Stage name + description

```tsx
<Tooltip content={STAGE_DESCRIPTIONS[stage]} delay={200}>
  <StageIndicator stage={stage} />
</Tooltip>
```

### Interactions

#### No Direct User Interaction

- Component is read-only display
- No click handlers (purely informational)
- Keyboard navigation skips over (not focusable)
- Only animations are automatic (pulse, transitions)

---

## 6. Accessibility

### ARIA Attributes

```tsx
<div
  role="status"
  aria-label={`Charleston progress: ${STAGE_NAMES[currentStage]}`}
  aria-live="polite"
  aria-atomic="true"
  className="charleston-tracker"
>
  {/* Stage indicators */}
</div>
```

### Screen Reader Announcements

#### Stage Change

```
"Charleston phase: First Left. Pass 3 tiles to the player on your left."
```

#### Completion

```
"First Charleston complete. Voting on second Charleston."
```

#### Skip Notification

```
"Second Charleston skipped. Proceeding to game start."
```

### Semantic HTML

```tsx
<ol className="stage-list" aria-label="Charleston stages">
  {stages.map((stage) => (
    <li
      key={stage}
      className={getStageClass(stage)}
      aria-current={stage === currentStage ? 'step' : undefined}
    >
      <StageIndicator stage={stage} />
      <span className="stage-name">{STAGE_NAMES[stage]}</span>
    </li>
  ))}
</ol>
```

### Visual Indicators Beyond Color

- **Completed**: ✓ checkmark symbol (not just green color)
- **Current**: ● filled circle + pulsing animation (not just blue color)
- **Skipped**: ✕ X mark + strikethrough (not just red color)
- **Arrows**: Directional symbols supplement color coding

### Keyboard Navigation

- Component not focusable (informational only)
- If tooltips present, accessible via adjacent focusable elements

---

## 7. Responsive Design

### Breakpoints

#### Desktop (≥768px)

- Horizontal timeline layout
- Full stage names displayed
- Arrows between stages
- Width: 600px (expandable)
- Height: 60px

#### Tablet (640px - 767px)

- Horizontal timeline, slightly compressed
- Abbreviated stage names ("1st Right", "1st Across")
- Smaller arrows
- Width: 480px
- Height: 50px

#### Mobile (<640px)

- Vertical list layout (orientation="vertical" forced)
- Compact stage indicators
- No arrows (implied by vertical order)
- Width: 100%, max 200px
- Height: auto (expands with stages)

### Layout Adaptations

#### Horizontal to Vertical Transition

```typescript
const useResponsiveOrientation = () => {
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'vertical' : 'horizontal');
    };

    mediaQuery.addEventListener('change', handleChange);
    setOrientation(mediaQuery.matches ? 'vertical' : 'horizontal');

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return orientation;
};
```

### Font Scaling

- Use `rem` units for all text
- Respect user font size preferences
- Minimum stage indicator size: 20px (for touch targets on mobile)

---

## 8. Integration Points

### Parent Components

#### CharlestonPanel

```tsx
<CharlestonPanel>
  <CharlestonTracker
    currentStage={currentCharlestonStage}
    completedStages={completedCharlestonStages}
    secondCharlestonSkipped={voteResult === 'Stop'}
    courtesyPassActive={isCourtesyPassPhase}
    orientation="horizontal"
    showDescriptions={true}
  />

  {/* Charleston tile selection UI */}
  <CharlestonTileSelection />

  {/* Action buttons */}
  <ActionBar>
    <Button onClick={handlePassTiles}>Pass Tiles</Button>
  </ActionBar>
</CharlestonPanel>
```

#### GameBoard (Header)

```tsx
<GameBoard>
  <GameHeader>
    {gamePhase === 'Charleston' && (
      <CharlestonTracker
        currentStage={charlestonStage}
        completedStages={completedStages}
        orientation="compact"
        showDescriptions={false}
      />
    )}
  </GameHeader>

  {/* Game table */}
</GameBoard>
```

### State Management

#### Zustand Store (gameStore)

```typescript
interface GameState {
  gamePhase: GamePhase;
  charlestonState: {
    currentStage: CharlestonStage;
    completedStages: CharlestonStage[];
    voteResult?: 'Stop' | 'Continue';
    courtesyPassActive: boolean;
  };
}

// Selectors
const useCharlestonStage = () => useGameStore((state) => state.charlestonState.currentStage);

const useCompletedStages = () => useGameStore((state) => state.charlestonState.completedStages);
```

### Event Handlers

#### Charleston Stage Progression

```typescript
useEffect(() => {
  const handleEvent = (event: PublicEvent) => {
    if (event.type === 'CharlestonStageAdvanced') {
      updateCharlestonStage(event.newStage);
      addCompletedStage(event.previousStage);
    }

    if (event.type === 'CharlestonVoteResult') {
      if (event.result === 'Stop') {
        markSecondCharlestonSkipped();
      }
    }
  };

  socket.on('event', handleEvent);
  return () => socket.off('event', handleEvent);
}, []);
```

### User Stories Integration

#### US-002 to US-004: First Charleston Stages

- Display First Right/Across/Left with directional arrows
- Mark each as completed when stage advances

#### US-005: Charleston Voting

- Show "Vote" stage when vote begins
- Update UI based on vote result (skip or continue)

#### US-006: Second Charleston

- Show Second Right/Across/Left if vote continues
- Mark as skipped with red X if vote stops

#### US-007: Courtesy Pass

- Show Courtesy stages when negotiation begins
- Display bidirectional arrow for courtesy exchange

#### US-008: IOU Detection

- Potentially show warning indicator if IOU detected (not in current spec)

---

## 9. Error Handling

### Missing Data

#### Invalid Stage

```typescript
if (!STAGE_NAMES[currentStage]) {
  console.error(`Invalid Charleston stage: ${currentStage}`);
  return <div className="error">Invalid stage</div>;
}
```

#### Empty Completed Stages

```typescript
const completedStages = props.completedStages ?? [];
```

### Edge Cases

#### Stage Order Validation

```typescript
// Ensure completed stages are valid sequence
const validateStageSequence = (stages: CharlestonStage[]) => {
  const validSequence = [
    'FirstRight',
    'FirstAcross',
    'FirstLeft',
    'FirstBlindPassCollect',
    'StopVote',
    'SecondRight',
    'SecondAcross',
    'SecondLeft',
    'SecondBlindPassCollect',
    'CourtesyPropose',
    'CourtesyAccept',
  ];

  const invalidStages = stages.filter((s) => !validSequence.includes(s));
  if (invalidStages.length > 0) {
    console.warn('Invalid stages in completed list:', invalidStages);
  }
};
```

#### Current Stage Already Completed

```typescript
if (completedStages.includes(currentStage)) {
  console.warn('Current stage is in completed list, likely state error');
  // Remove from completed or mark as error
}
```

### Warnings

#### Stage Skip Without Vote

```typescript
if (secondCharlestonSkipped && !completedStages.includes('StopVote')) {
  console.warn('Second Charleston skipped without vote stage');
}
```

---

## 10. Testing Requirements

### Unit Tests

#### Rendering Tests

```typescript
describe('CharlestonTracker', () => {
  it('renders current stage', () => {
    render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight', 'FirstAcross']}
      />
    );

    expect(screen.getByText('First Left')).toBeInTheDocument();
  });

  it('marks completed stages with checkmark', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight', 'FirstAcross']}
      />
    );

    const firstRight = container.querySelector('[data-stage="FirstRight"]');
    expect(firstRight).toHaveClass('stage-completed');
    expect(firstRight?.querySelector('.checkmark')).toBeInTheDocument();
  });

  it('shows current stage with pulse', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight']}
      />
    );

    const currentStage = container.querySelector('[data-stage="FirstLeft"]');
    expect(currentStage).toHaveClass('stage-current');
  });

  it('displays directional arrows', () => {
    render(
      <CharlestonTracker
        currentStage="FirstRight"
        completedStages={[]}
      />
    );

    expect(screen.getByText('→')).toBeInTheDocument(); // Right arrow
  });
});
```

#### Variant Tests

```typescript
describe('CharlestonTracker - Variants', () => {
  it('shows skipped stages when secondCharlestonSkipped', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="Complete"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'StopVote']}
        secondCharlestonSkipped={true}
      />
    );

    const secondRight = container.querySelector('[data-stage="SecondRight"]');
    expect(secondRight).toHaveClass('stage-skipped');
    expect(secondRight?.querySelector('.skip-mark')).toBeInTheDocument();
  });

  it('shows courtesy pass stages when active', () => {
    render(
      <CharlestonTracker
        currentStage="CourtesyPropose"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft']}
        courtesyPassActive={true}
      />
    );

    expect(screen.getByText('Courtesy')).toBeInTheDocument();
    expect(screen.getByText('↔')).toBeInTheDocument(); // Bidirectional arrow
  });

  it('renders vertical orientation', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight']}
        orientation="vertical"
      />
    );

    expect(container.firstChild).toHaveClass('orientation-vertical');
  });

  it('renders compact orientation', () => {
    render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight', 'FirstAcross']}
        orientation="compact"
      />
    );

    expect(screen.getByText(/Charleston:/)).toBeInTheDocument();
    expect(screen.getByText(/First Left/)).toBeInTheDocument();
  });
});
```

### Integration Tests

#### Stage Progression

```typescript
describe('CharlestonTracker - Stage Progression', () => {
  it('updates when stage changes', () => {
    const { rerender } = render(
      <CharlestonTracker
        currentStage="FirstRight"
        completedStages={[]}
      />
    );

    expect(screen.getByText('First Right')).toHaveClass('stage-current');

    rerender(
      <CharlestonTracker
        currentStage="FirstAcross"
        completedStages={['FirstRight']}
      />
    );

    expect(screen.getByText('First Across')).toHaveClass('stage-current');
    const firstRight = screen.getByText('First Right');
    expect(firstRight.closest('.stage-indicator')).toHaveClass('stage-completed');
  });

  it('handles vote result (stop)', () => {
    const { rerender } = render(
      <CharlestonTracker
        currentStage="StopVote"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft']}
      />
    );

    rerender(
      <CharlestonTracker
        currentStage="Complete"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'StopVote']}
        secondCharlestonSkipped={true}
      />
    );

    expect(screen.getByText('Second Right').closest('.stage-indicator'))
      .toHaveClass('stage-skipped');
  });
});
```

### Visual Regression Tests

#### Snapshot Tests

```typescript
describe('CharlestonTracker - Visual Snapshots', () => {
  it('matches snapshot for first charleston', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight', 'FirstAcross']}
        orientation="horizontal"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot for voting stage', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="StopVote"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'FirstBlindPassCollect']}
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with skipped second charleston', () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="Complete"
        completedStages={['FirstRight', 'FirstAcross', 'FirstLeft', 'StopVote']}
        secondCharlestonSkipped={true}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
```

### Accessibility Tests

```typescript
describe('CharlestonTracker - Accessibility', () => {
  it('has correct ARIA attributes', () => {
    render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight']}
      />
    );

    const tracker = screen.getByRole('status');
    expect(tracker).toHaveAttribute('aria-label', expect.stringContaining('Charleston progress'));
    expect(tracker).toHaveAttribute('aria-live', 'polite');
  });

  it('announces stage changes to screen readers', () => {
    const { rerender } = render(
      <CharlestonTracker
        currentStage="FirstRight"
        completedStages={[]}
      />
    );

    const tracker = screen.getByRole('status');

    rerender(
      <CharlestonTracker
        currentStage="FirstAcross"
        completedStages={['FirstRight']}
      />
    );

    expect(tracker).toHaveAttribute('aria-label', expect.stringContaining('First Across'));
  });

  it('passes axe accessibility tests', async () => {
    const { container } = render(
      <CharlestonTracker
        currentStage="FirstLeft"
        completedStages={['FirstRight', 'FirstAcross']}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## 11. Performance Considerations

### Memoization

```typescript
export const CharlestonTracker = React.memo<CharlestonTrackerProps>(
  ({ currentStage, completedStages, ...props }) => {
    // Component logic
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentStage === nextProps.currentStage &&
      arraysEqual(prevProps.completedStages, nextProps.completedStages) &&
      prevProps.secondCharlestonSkipped === nextProps.secondCharlestonSkipped &&
      prevProps.courtesyPassActive === nextProps.courtesyPassActive
    );
  }
);
```

### Computed Values

```typescript
// Memoize stage list to avoid recalculation
const stageList = useMemo(() => {
  return getAllStages(secondCharlestonSkipped, courtesyPassActive);
}, [secondCharlestonSkipped, courtesyPassActive]);

// Memoize stage states
const stageStates = useMemo(() => {
  return stageList.map((stage) => ({
    name: stage,
    isCompleted: completedStages.includes(stage),
    isCurrent: stage === currentStage,
    isSkipped: isStageSkipped(stage, secondCharlestonSkipped),
  }));
}, [stageList, completedStages, currentStage, secondCharlestonSkipped]);
```

### Animation Optimization

#### CSS Animations (GPU-Accelerated)

```css
.stage-current {
  animation: stagePulse 2s ease-in-out infinite;
  will-change: transform, opacity;
}

/* Avoid animating layout properties */
@keyframes stagePulse {
  0%,
  100% {
    transform: scale(1); /* Uses GPU */
    opacity: 1; /* Uses GPU */
  }
  50% {
    transform: scale(1.15);
    opacity: 0.8;
  }
}
```

#### Conditional Animations

```typescript
// Only animate current stage
const stageClassName = useMemo(() => {
  return clsx(styles.stageIndicator, {
    [styles.completed]: isCompleted,
    [styles.current]: isCurrent && !isCompleted,
    [styles.skipped]: isSkipped,
  });
}, [isCompleted, isCurrent, isSkipped]);
```

### Bundle Size

#### Import Optimization

```typescript
// Import only needed types
import type { CharlestonStage } from '@/types/bindings/generated';

// Tree-shakable icon imports
import { Check, Circle, X } from 'lucide-react';
```

---

## 12. Implementation Notes

### File Structure

```
src/components/presentational/CharlestonTracker/
├── CharlestonTracker.tsx          # Main component
├── CharlestonTracker.module.css   # Scoped styles
├── CharlestonTracker.test.tsx     # Unit tests
├── constants.ts                   # Stage names, arrows, descriptions
├── utils.ts                       # Helper functions (stage ordering, etc.)
└── index.ts                       # Re-export
```

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@axe-core/react": "^4.8.0",
    "vitest": "^1.0.0"
  }
}
```

### Constants File

```typescript
// constants.ts
import type { CharlestonStage } from '@/types/bindings/generated';

export const STAGE_NAMES: Record<CharlestonStage, string> = {
  FirstRight: 'First Right',
  FirstAcross: 'First Across',
  FirstLeft: 'First Left',
  FirstBlindPassCollect: 'Blind Pass',
  StopVote: 'Vote',
  SecondRight: 'Second Right',
  SecondAcross: 'Second Across',
  SecondLeft: 'Second Left',
  SecondBlindPassCollect: 'Blind Pass 2',
  CourtesyPropose: 'Courtesy',
  CourtesyAccept: 'Courtesy Accept',
  Complete: 'Complete',
};

export const STAGE_ARROWS: Record<CharlestonStage, string> = {
  FirstRight: '→',
  FirstAcross: '↓',
  FirstLeft: '←',
  FirstBlindPassCollect: '⟲',
  StopVote: '',
  SecondRight: '→',
  SecondAcross: '↓',
  SecondLeft: '←',
  SecondBlindPassCollect: '⟲',
  CourtesyPropose: '↔',
  CourtesyAccept: '↔',
  Complete: '',
};

export const STAGE_DESCRIPTIONS: Record<CharlestonStage, string> = {
  FirstRight: 'Pass 3 tiles to the player on your right',
  FirstAcross: 'Pass 3 tiles to the player across from you',
  FirstLeft: 'Pass 3 tiles to the player on your left',
  FirstBlindPassCollect: 'Optional: Pass 0-3 tiles right from incoming tiles',
  StopVote: 'Vote to stop or continue the Charleston',
  SecondRight: 'Pass 3 tiles to the player on your right',
  SecondAcross: 'Pass 3 tiles to the player across from you',
  SecondLeft: 'Pass 3 tiles to the player on your left',
  SecondBlindPassCollect: 'Optional: Pass 0-3 tiles right from incoming tiles',
  CourtesyPropose: 'Propose courtesy pass with your opponent',
  CourtesyAccept: 'Accept or decline courtesy pass',
  Complete: 'Charleston complete, game begins',
};

export const FIRST_CHARLESTON_STAGES: CharlestonStage[] = [
  'FirstRight',
  'FirstAcross',
  'FirstLeft',
  'FirstBlindPassCollect',
  'StopVote',
];

export const SECOND_CHARLESTON_STAGES: CharlestonStage[] = [
  'SecondRight',
  'SecondAcross',
  'SecondLeft',
  'SecondBlindPassCollect',
];

export const COURTESY_STAGES: CharlestonStage[] = ['CourtesyPropose', 'CourtesyAccept'];
```

### Utils File

```typescript
// utils.ts
import type { CharlestonStage } from '@/types/bindings/generated';
import { FIRST_CHARLESTON_STAGES, SECOND_CHARLESTON_STAGES, COURTESY_STAGES } from './constants';

export function getAllStages(
  secondCharlestonSkipped: boolean,
  courtesyPassActive: boolean
): CharlestonStage[] {
  const stages = [...FIRST_CHARLESTON_STAGES];

  if (!secondCharlestonSkipped) {
    stages.push(...SECOND_CHARLESTON_STAGES);
  }

  if (courtesyPassActive) {
    stages.push(...COURTESY_STAGES);
  }

  stages.push('Complete');

  return stages;
}

export function isStageSkipped(stage: CharlestonStage, secondCharlestonSkipped: boolean): boolean {
  return secondCharlestonSkipped && SECOND_CHARLESTON_STAGES.includes(stage);
}

export function getStageIndex(stage: CharlestonStage, allStages: CharlestonStage[]): number {
  return allStages.indexOf(stage);
}

export function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}
```

### CSS Module Structure

```css
/* CharlestonTracker.module.css */

.tracker {
  background-color: var(--gray-100);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 12px 16px;
}

.title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gray-900);
  margin-bottom: 8px;
}

/* Horizontal layout */
.tracker.horizontal {
  width: 600px;
  max-width: 100%;
}

.stageList.horizontal {
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

/* Vertical layout */
.tracker.vertical {
  width: 180px;
}

.stageList.vertical {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

/* Compact layout */
.tracker.compact {
  width: 240px;
  padding: 8px 12px;
}

.compactContent {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

/* Stage indicator */
.stageItem {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stageIndicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.stageIndicator.completed {
  background-color: var(--green-500);
  color: white;
}

.stageIndicator.current {
  background-color: var(--blue-600);
  color: white;
  animation: stagePulse 2s ease-in-out infinite;
  will-change: transform, opacity;
}

.stageIndicator.upcoming {
  border: 2px solid var(--gray-300);
  background-color: transparent;
}

.stageIndicator.skipped {
  background-color: var(--red-100);
  color: var(--red-500);
}

@keyframes stagePulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.8;
  }
}

/* Stage name */
.stageName {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
  white-space: nowrap;
}

.stageName.skipped {
  text-decoration: line-through;
  opacity: 0.6;
}

/* Arrow */
.arrow {
  font-size: 16px;
  color: var(--gray-500);
  margin: 0 4px;
}

/* Checkmark icon */
.checkmark {
  width: 14px;
  height: 14px;
  stroke-width: 3px;
  animation: checkmarkDraw 300ms ease-out forwards;
}

@keyframes checkmarkDraw {
  0% {
    stroke-dashoffset: 20;
    opacity: 0;
  }
  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

/* Progress indicator (compact mode) */
.progress {
  font-size: 12px;
  color: var(--gray-600);
  margin-left: auto;
}

/* Responsive */
@media (max-width: 640px) {
  .tracker.horizontal {
    /* Force vertical on mobile */
    width: 100%;
    max-width: 200px;
  }

  .stageList.horizontal {
    flex-direction: column;
    align-items: flex-start;
  }

  .arrow {
    display: none; /* Hide arrows in vertical mobile layout */
  }
}
```

### Implementation Example

```typescript
// CharlestonTracker.tsx
import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Check, Circle, X } from 'lucide-react';
import type { CharlestonStage } from '@/types/bindings/generated';
import {
  STAGE_NAMES,
  STAGE_ARROWS,
  STAGE_DESCRIPTIONS,
} from './constants';
import { getAllStages, isStageSkipped } from './utils';
import styles from './CharlestonTracker.module.css';

export interface CharlestonTrackerProps {
  currentStage: CharlestonStage;
  completedStages: CharlestonStage[];
  secondCharlestonSkipped?: boolean;
  courtesyPassActive?: boolean;
  orientation?: 'horizontal' | 'vertical' | 'compact';
  showDescriptions?: boolean;
  className?: string;
}

export const CharlestonTracker = React.memo<CharlestonTrackerProps>(
  ({
    currentStage,
    completedStages,
    secondCharlestonSkipped = false,
    courtesyPassActive = false,
    orientation = 'horizontal',
    showDescriptions = false,
    className,
  }) => {
    const allStages = useMemo(() => {
      return getAllStages(secondCharlestonSkipped, courtesyPassActive);
    }, [secondCharlestonSkipped, courtesyPassActive]);

    const stageStates = useMemo(() => {
      return allStages.map(stage => ({
        name: stage,
        displayName: STAGE_NAMES[stage],
        arrow: STAGE_ARROWS[stage],
        description: STAGE_DESCRIPTIONS[stage],
        isCompleted: completedStages.includes(stage),
        isCurrent: stage === currentStage,
        isSkipped: isStageSkipped(stage, secondCharlestonSkipped),
      }));
    }, [allStages, completedStages, currentStage, secondCharlestonSkipped]);

    const currentStageInfo = stageStates.find(s => s.isCurrent);
    const completedCount = stageStates.filter(s => s.isCompleted).length;

    if (orientation === 'compact') {
      return (
        <div
          role="status"
          aria-label={`Charleston progress: ${currentStageInfo?.displayName || 'Unknown'}`}
          aria-live="polite"
          className={clsx(styles.tracker, styles.compact, className)}
        >
          <div className={styles.compactContent}>
            <span>Charleston:</span>
            <span className={styles.stageName}>
              {currentStageInfo?.displayName || 'Unknown'}
            </span>
            {currentStageInfo?.arrow && (
              <span className={styles.arrow}>{currentStageInfo.arrow}</span>
            )}
            <span className={styles.progress}>
              {completedCount}/{allStages.length}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        role="status"
        aria-label={`Charleston progress: ${currentStageInfo?.displayName || 'Unknown'}`}
        aria-live="polite"
        aria-atomic="true"
        className={clsx(
          styles.tracker,
          styles[orientation],
          className
        )}
      >
        <div className={styles.title}>Charleston Phase</div>

        <ol
          className={clsx(styles.stageList, styles[orientation])}
          aria-label="Charleston stages"
        >
          {stageStates.map((stage, index) => (
            <React.Fragment key={stage.name}>
              <li
                className={styles.stageItem}
                data-stage={stage.name}
                aria-current={stage.isCurrent ? 'step' : undefined}
              >
                <div
                  className={clsx(styles.stageIndicator, {
                    [styles.completed]: stage.isCompleted,
                    [styles.current]: stage.isCurrent,
                    [styles.upcoming]: !stage.isCompleted && !stage.isCurrent,
                    [styles.skipped]: stage.isSkipped,
                  })}
                  title={showDescriptions ? stage.description : undefined}
                >
                  {stage.isCompleted && !stage.isSkipped && (
                    <Check className={styles.checkmark} size={14} />
                  )}
                  {stage.isCurrent && <Circle size={12} fill="currentColor" />}
                  {stage.isSkipped && <X size={14} />}
                  {!stage.isCompleted && !stage.isCurrent && !stage.isSkipped && (
                    <Circle size={12} />
                  )}
                </div>

                <span
                  className={clsx(styles.stageName, {
                    [styles.skipped]: stage.isSkipped,
                  })}
                >
                  {stage.displayName}
                </span>
              </li>

              {orientation === 'horizontal' && index < stageStates.length - 1 && (
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              )}
            </React.Fragment>
          ))}
        </ol>
      </div>
    );
  }
);

CharlestonTracker.displayName = 'CharlestonTracker';
```

### Browser Support

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **CSS Features**: Flexbox, CSS Animations, CSS Variables
- **JavaScript**: ES2020+ (Optional chaining, Nullish coalescing)

### Accessibility Checklist

- [ ] ARIA role="status" for live updates
- [ ] aria-live="polite" for stage changes
- [ ] aria-current="step" for current stage
- [ ] Semantic `<ol>` for stage list
- [ ] Visual indicators beyond color (checkmark, circle, X)
- [ ] Screen reader announcements for stage changes
- [ ] Passes axe-core audit
- [ ] Keyboard navigation (if interactive tooltips added)
