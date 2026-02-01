# MoveHistoryList

## Purpose

Displays a chronological timeline of all game moves with player actions, decision points, and navigation to specific moves. Enables players to review game history and jump to any past state.

## User Stories

- US-024: Move history timeline viewing
- US-025: Jump to specific move in history
- Replay and analysis support

## Props

```typescript
interface MoveHistoryListProps {
  /** Array of move history entries from backend */
  history: MoveHistorySummary[];

  /** Currently selected move number (for highlighting) */
  currentMove: number | null;

  /** Callback when user clicks a move to jump to it */
  onJumpToMove: (moveNumber: number) => void;

  /** Filter options */
  filter?: HistoryFilter;

  /** Compact mode (smaller font, less spacing) */
  compact?: boolean;

  /** Show only decision points */
  decisionsOnly?: boolean;
}

// From backend bindings
// MoveHistorySummary: { move_number, timestamp, seat, action, description }

enum MoveAction {
  DrawTile = 'DrawTile',
  DiscardTile = 'DiscardTile',
  PassTiles = 'PassTiles',
  CallPung = 'CallPung',
  CallKong = 'CallKong',
  DeclareMahjong = 'DeclareMahjong',
  Pass = 'Pass',
  VoteCharleston = 'VoteCharleston',
  // ... etc
}

interface HistoryFilter {
  seats?: Seat[]; // Show only specific players
  actions?: MoveAction[]; // Show only specific action types
  decisionsOnly?: boolean; // Show only decision points
}
```

## Behavior

### Timeline Display

- Chronological list of moves (oldest at top, newest at bottom)
- Auto-scroll to current move when view opens
- Highlight current move if viewing history
- Show player indicator (seat color/icon)
- Show action icon (draw/discard/call/pass)

### Navigation

- Click any move → emit `onJumpToMove(moveNumber)`
- Scroll to navigate through long histories
- Sticky header with current move indicator

### Filtering

- **All Moves:** Every action (draws, discards, passes)
- **Decisions Only:** Only moves where player made a choice (discard, call, pass)
- **By Player:** Filter to specific seat(s)
- **By Action Type:** Filter to specific actions (e.g., only discards)

### Decision Points

Decision point labeling should be derived from `MoveAction` on the client (not provided in summary).

### Timestamps

- Show relative time: "2 minutes ago"
- Hover for absolute time: "2:34:56 PM"

## Visual Requirements

### Layout

```text
┌──────────────────────────────────────┐
│ Move History       [Filter ▼] [⚙️]   │
├──────────────────────────────────────┤
│ Move 0 | East        🎲 2m ago       │
│   Rolled dice: 7                     │
│                                      │
│ Move 1 | East        ⬇️ 2m ago       │
│   Drew tile                          │
│                                      │
│ Move 2 | East        ⏏️ 2m ago  ⭐   │
│   Discarded 7 Bam                    │
│                                      │
│ Move 3 | South       ❌ 2m ago       │
│   Passed                             │
│                                      │
│ Move 4 | West        🤝 2m ago  ⭐   │
│   Called Pung (7 Bam)                │
│                                      │
│ ... (scrollable)                     │
│                                      │
│ Move 42 | North      ⏏️ just now ⭐  │
│ → Discarded 3 Dot                    │← Current
└──────────────────────────────────────┘
```

### Icons by Action Type

- 🎲 Dice roll
- ⬇️ Draw tile
- ⏏️ Discard tile
- 🤝 Call (Pung/Kong/Mahjong)
- ❌ Pass
- 🔄 Charleston pass
- 🗳️ Vote
- ⭐ Decision point marker

### Current Move Indicator

```css
.history-entry-current {
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid #3b82f6;
  font-weight: 600;
}
```

### Player Colors

Match seat colors from game board:

- East: Red
- South: Blue
- West: Green
- North: Yellow

## Related Components

- **Used by**: Replay viewer, game analysis screen
- **Uses**: shadcn/ui `<ScrollArea>`, `<Select>`, `<Button>`, `<Badge>`
- **Uses**: `<HistoryScrubber>` for navigation controls
- **Integrates with**: `useGameSocket()` for `JumpToMove` command

## Implementation Notes

### Data Fetching

```typescript
// History is maintained by backend, sent via events
useEffect(() => {
  const handleHistoryUpdate = (event: Event) => {
    if (event.Public?.HistoryList) {
      setHistory(event.Public.HistoryList.entries);
    }
  };

  gameStore.subscribe(handleHistoryUpdate);
}, []);
```

### Jump to Move

```typescript
const handleJumpToMove = async (moveNumber: number) => {
  try {
    await sendCommand({
      JumpToMove: {
        player: currentSeat,
        move_number: moveNumber,
      },
    });

    // Backend sends StateSnapshot event with historical state
  } catch (error) {
    toast.error('Failed to jump to move');
  }
};
```

### Filtering Logic

```typescript
const getFilteredHistory = (
  history: MoveHistoryEntry[],
  filter: HistoryFilter
): MoveHistoryEntry[] => {
  return history.filter((entry) => {
    // Filter by seat
    if (filter.seats && !filter.seats.includes(entry.seat)) {
      return false;
    }

    // Filter by action type
    if (filter.actions && !filter.actions.includes(entry.action)) {
      return false;
    }

    // Filter by decision points
    if (filter.decisionsOnly && !entry.is_decision_point) {
      return false;
    }

    return true;
  });
};
```

### Auto-Scroll to Current

```typescript
useEffect(() => {
  if (currentMove === null) return;

  const element = document.getElementById(`move-${currentMove}`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}, [currentMove]);
```

### Relative Timestamps

```typescript
import { formatDistanceToNow } from 'date-fns';

const getRelativeTime = (timestamp: string): string => {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
};

// "2 minutes ago", "just now", "1 hour ago"
```

### Action Icons

```typescript
const getActionIcon = (action: MoveAction): string => {
  const icons: Record<MoveAction, string> = {
    DrawTile: '⬇️',
    DiscardTile: '⏏️',
    CallPung: '🤝',
    CallKong: '🤝',
    DeclareMahjong: '🎉',
    Pass: '❌',
    PassTiles: '🔄',
    VoteCharleston: '🗳️',
    RollDice: '🎲',
    // ... etc
  };

  return icons[action] || '•';
};
```

## Accessibility

**ARIA:**

- List: `role="feed"` for dynamic content
- Entries: `role="article"` with `aria-label="Move {number} by {player}"`
- Current move: `aria-current="true"`
- Jump button: `aria-label="Jump to move {number}"`

**Keyboard:**

- Arrow keys to navigate entries
- Enter to jump to selected move
- Home/End to jump to first/last move
- / to open filter

**Screen Readers:**

- Announce when new move added: `aria-live="polite"`
- Read entry: "Move 42, North discarded 3 Dot, 2 minutes ago"

## Example Usage

```tsx
import { MoveHistoryList } from '@/components/game/MoveHistoryList';
import { useGameStore } from '@/stores/gameStore';

function HistoryView() {
  const history = useGameStore((state) => state.moveHistory);
  const currentMove = useGameStore((state) => state.currentMoveNumber);
  const { sendCommand } = useGameSocket();

  const handleJump = async (moveNumber: number) => {
    await sendCommand({
      JumpToMove: {
        player: 'East',
        target_move: moveNumber,
      },
    });
  };

  return (
    <MoveHistoryList
      history={history}
      currentMove={currentMove}
      onJumpToMove={handleJump}
      decisionsOnly={false}
    />
  );
}
```

## Edge Cases

1. **Empty history:** Show "No moves yet" message
2. **Very long history (1000+ moves):** Virtual scrolling for performance
3. **Jump to future move:** Disable button if move > current
4. **Jump while in present:** Show warning "Already at current state"
5. **Filter removes all entries:** Show "No moves match filter"
6. **Rapid new moves:** Debounce scroll-to-current

## Testing Considerations

- History entries render correctly
- Filtering works for all filter types
- Jump to move sends correct command
- Current move highlighting updates
- Auto-scroll to current works
- Decision points marked correctly
- Icons match action types
- Timestamps update (relative time)
- Virtual scrolling with large lists

---

**Estimated Complexity**: Medium (~100 lines)
**Dependencies**: shadcn/ui ScrollArea, Select, Button, Badge, date-fns
**Phase**: Phase 6 - Polish & Advanced (Optional)
