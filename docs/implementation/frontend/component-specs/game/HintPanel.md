# HintPanel

## Purpose

Displays AI-generated gameplay suggestions based on strategic analysis. Shows visual tile highlights and optional text explanations depending on verbosity level (Beginner/Intermediate/Expert).

## User Stories

- US-027: Hint system for AI assistance
- US-028: Adjustable hint verbosity levels
- Accessibility: Learning support for new players

## Props

```typescript
interface HintPanelProps {
  /** Current hint data from backend */
  hint: HintData | null;

  /** User's hint preference level */
  verbosity: HintVerbosity;

  /** Callback when verbosity changes */
  onVerbosityChange: (level: HintVerbosity) => void;

  /** Show verbosity selector */
  showSettings?: boolean;

  /** Compact mode (icon + tooltip only) */
  compact?: boolean;
}

// From backend bindings
interface HintData {
  /** Recommended tile to discard */
  recommended_discard: Tile | null;

  /** Reasoning text (varies by verbosity) */
  explanation: string | null;

  /** Pattern viability impact */
  patterns_kept_viable: number;

  /** Alternative suggestions */
  alternatives: Array<{
    tile: Tile;
    score: number;
    reason: string;
  }>;
}

enum HintVerbosity {
  Beginner = 'Beginner', // Full reasoning + visual
  Intermediate = 'Intermediate', // Tile name + visual
  Expert = 'Expert', // Visual only
  Disabled = 'Disabled', // No hints
}
```

## Behavior

### Verbosity Levels

**Beginner:**

- Visual highlight on recommended tile (glow/border)
- Full text explanation: "Discard 7B - keeps 3 patterns viable and improves flexibility"
- Show alternative suggestions
- Show pattern count impact

**Intermediate:**

- Visual highlight on recommended tile
- Short label: "Suggested: 7B"
- No detailed reasoning

**Expert:**

- Visual highlight only (subtle glow/border on tile)
- No text explanation
- Minimal UI footprint

**Disabled:**

- No hints shown
- `hint` will be null from backend

### Hint Display

When hint is available:

- Beginner/Intermediate: Show panel with text + highlight
- Expert: Only apply CSS class to highlighted tile (no panel)
- Disabled: No visual changes

### Interaction

- Click "Why?" button (Beginner/Intermediate) → Show detailed analysis modal
- Click hint settings icon → Toggle verbosity dropdown
- Hover over suggested tile → Show tooltip with brief reason

### Auto-Hide

- Hint disappears after 10 seconds (configurable)
- Re-appears when new hint arrives
- User can manually dismiss

## Visual Requirements

### Layout (Beginner/Intermediate)

```text
┌────────────────────────────────────┐
│ 💡 Hint          [Settings ⚙️]     │
│                                    │
│ Suggested: Discard 7 Bam           │
│ ↳ Keeps 3 patterns viable          │
│                                    │
│ [Why?]  [Dismiss]                  │
└────────────────────────────────────┘
```

### Compact Mode

```text
[💡] (hover for hint)
```

### Tile Highlight (All Modes)

Apply CSS class to recommended tile:

```css
.tile-hint-recommended {
  box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.6);
  border: 2px solid #3b82f6;
  animation: pulse-hint 2s infinite;
}
```

### Settings Dropdown

```text
┌─────────────────┐
│ Hint Level      │
├─────────────────┤
│ ○ Disabled      │
│ ○ Expert        │
│ ⦿ Intermediate  │
│ ○ Beginner      │
└─────────────────┘
```

## Related Components

- **Used by**: `<GameBoard>`, `<ConcealedHand>`
- **Uses**: shadcn/ui `<Card>`, `<Button>`, `<Select>`, `<Dialog>`
- **Uses**: `<Tile>` for visual highlighting
- **Uses**: `useGameSocket()` to request hints

## Implementation Notes

### Requesting Hints

```typescript
const requestHint = async () => {
  if (verbosity === 'Disabled') return;

  await sendCommand({
    GetAnalysis: { player: currentSeat },
  });
};

// Backend responds with AnalysisEvent::HintUpdate
useEffect(() => {
  const handleHintEvent = (event: AnalysisEvent) => {
    if (event.HintUpdate) {
      setHint(event.HintUpdate.hint);
    }
  };

  // Subscribe to analysis events
  gameStore.subscribe(handleHintEvent);
}, []);
```

### Verbosity Filter

```typescript
const getDisplayedHint = (hint: HintData, verbosity: HintVerbosity): DisplayHint | null => {
  if (!hint || verbosity === 'Disabled') return null;

  switch (verbosity) {
    case 'Beginner':
      return {
        tile: hint.recommended_discard,
        text: hint.explanation,
        showAlternatives: true,
        showPatternCount: true,
      };

    case 'Intermediate':
      return {
        tile: hint.recommended_discard,
        text: `Suggested: ${hint.recommended_discard?.name}`,
        showAlternatives: false,
        showPatternCount: false,
      };

    case 'Expert':
      return {
        tile: hint.recommended_discard,
        text: null, // Visual only
        showAlternatives: false,
        showPatternCount: false,
      };
  }
};
```

### Tile Highlighting

```typescript
// In <ConcealedHand> component
const getTileClassName = (tile: Tile) => {
  const classes = ['tile'];

  if (hint?.recommended_discard?.equals(tile)) {
    classes.push('tile-hint-recommended');
  }

  return classes.join(' ');
};
```

### Auto-Dismiss Timer

```typescript
useEffect(() => {
  if (!hint) return;

  const timer = setTimeout(() => {
    setHint(null);
  }, 10000); // 10 seconds

  return () => clearTimeout(timer);
}, [hint]);
```

### Persistence

```typescript
// Save verbosity preference to localStorage
useEffect(() => {
  localStorage.setItem('hint_verbosity', verbosity);
}, [verbosity]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('hint_verbosity') as HintVerbosity;
  if (saved) {
    setVerbosity(saved);
  }
}, []);
```

## Accessibility

**ARIA:**

- Panel: `role="complementary"` `aria-label="Hint panel"`
- Highlight: `aria-label="Recommended tile to discard"`
- Settings: `aria-label="Hint verbosity settings"`

**Keyboard:**

- Tab to focus hint panel
- Enter to show detailed analysis
- Escape to dismiss hint
- Arrow keys in settings dropdown

**Screen Readers:**

- Announce new hints: `aria-live="polite"`
- Read recommendation: "Hint: Discard 7 Bamboo, keeps 3 patterns viable"

## Example Usage

```tsx
import { HintPanel } from '@/components/game/HintPanel';
import { useGameStore } from '@/stores/gameStore';

function GameView() {
  const hint = useGameStore((state) => state.currentHint);
  const [verbosity, setVerbosity] = useState<HintVerbosity>('Intermediate');

  return (
    <div className="game-container">
      <HintPanel
        hint={hint}
        verbosity={verbosity}
        onVerbosityChange={setVerbosity}
        showSettings={true}
      />

      {/* Compact mode in mobile */}
      <HintPanel hint={hint} verbosity={verbosity} compact={true} />
    </div>
  );
}
```

## Edge Cases

1. **Hint arrives while user acting:** Queue hint, show after action completes
2. **Multiple hints in quick succession:** Show latest, dismiss previous
3. **Verbosity changed mid-hint:** Update display immediately
4. **Disabled during active hint:** Hide hint panel, clear highlight
5. **Hint for tile no longer in hand:** Dismiss hint (stale data)
6. **No viable moves:** Show "No clear recommendation" message

## Testing Considerations

- Hint displays correctly for each verbosity level
- Tile highlighting applies to correct tile
- Settings persist across sessions
- Auto-dismiss timer works
- Dismissing hint clears state
- Disabled mode shows no hints
- Backend integration (AnalysisEvent::HintUpdate)
- Keyboard navigation works

---

**Estimated Complexity**: Medium (~100 lines)
**Dependencies**: shadcn/ui Card, Button, Select, Dialog
**Phase**: Phase 6 - Polish & Advanced (Optional)
