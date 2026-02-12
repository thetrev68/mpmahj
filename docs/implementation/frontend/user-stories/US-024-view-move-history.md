# US-024: View Move History

## Story

**As a** player
**I want** to view a chronological list of all moves in the current game
**So that** I can review what happened, analyze the game flow, and learn from past decisions

## Acceptance Criteria

### AC-1: History Panel Access

**Given** I am in an active game or viewing a completed game
**When** I click the "History" button in the UI or press H key
**Then** a history panel slides in from the right side
**And** the panel displays a chronological list of all moves
**And** the current game view remains visible (panel overlays 30% of screen)

### AC-2: Move List Display

**Given** the history panel is open
**When** I view the move list
**Then** each entry shows:

- **Move number** (e.g., "#42")
- **Player** (East/South/West/North with color coding)
- **Action** (from `MoveAction`)
- **Description** (e.g., "Discarded 5 Dots", "Passed 3 tiles right")
- **Timestamp** (relative: "2 minutes ago" or absolute: "12:34 PM")
  **And** the list is scrollable
  **And** the most recent move is highlighted

### AC-3: Optional Action Grouping

**Given** the history panel is open
**When** I scroll through the move list
**Then** moves may be grouped by action category (Draw/Discard/Call/Pass/etc.) for readability

### AC-4: Filter by Player

**Given** the history panel is open
**When** I click a player filter button (East/South/West/North/All)
**Then** only moves by the selected player(s) are shown
**And** the filter buttons highlight the active selection
**And** a count shows: "Showing 23 of 87 moves (East only)"

### AC-5: Filter by Action Type

**Given** the history panel is open
**When** I select action type filters (Discard, Call, Charleston, Special Actions, All)
**Then** only moves of the selected type(s) are shown
**And** multiple filters can be active simultaneously
**And** the count updates: "Showing 15 of 87 moves (Discards + Calls)"

### AC-6: Search Moves

**Given** the history panel is open
**When** I enter text in the search box (e.g., "5 Dots")
**Then** only moves matching the search are shown
**And** matching text is highlighted in yellow
**And** search works on action details, player names, and tiles

### AC-7: Move Details Expansion

**Given** the history panel is open
**When** I click on a move entry
**Then** the entry expands to show additional details:

- **Full action description**
- **Action payload** (from `MoveAction`)
- **"Jump to Move" button** (if enabled, see US-025)
  **And** clicking again collapses the entry

### AC-8: Auto-Scroll to Latest

**Given** the history panel is open during an active game
**When** a new move occurs
**Then** the history list auto-scrolls to show the latest move
**And** the new move briefly pulses (1s highlight)
**And** a notification sound plays (optional, configurable)

### AC-9: Export History

**Given** the history panel is open
**When** I click the "Export" button
**Then** a download dialog appears with format options: JSON, CSV, Text
**And** selecting JSON downloads a file: `game-{room_id}-history.json`
**And** the file contains all move entries with full details

### AC-10: Close History Panel

**Given** the history panel is open
**When** I click the "X" button, press Escape, or click outside the panel
**Then** the panel slides out and closes
**And** the game view returns to full width

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  RequestHistory: {
    player: Seat;
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    HistoryList: {
      entries: MoveHistorySummary[]
    }
  }
}

interface MoveHistorySummary {
  move_number: number;
  seat: Seat;
  action: MoveAction;
  description: string;  // e.g., "Discarded 5 Dots"
  timestamp: string;    // ISO timestamp
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/history.rs` - Move history tracking and storage
  - `crates/mahjong_core/src/command.rs` - `RequestHistory` command
  - `crates/mahjong_core/src/event/public_events.rs` - `HistoryList` event
  - `crates/mahjong_core/src/table/replay.rs` - History replay functionality
- **Game Design Doc**:
  - Section 5.3 (Move History Viewing)
  - Section 5.4 (History Export and Analysis)

## Components Involved

- **`<HistoryPanel>`** - Main sliding panel component
- **`<MoveList>`** - Scrollable list of moves
- **`<MoveEntry>`** - Individual move display with expand/collapse
- **`<HistoryFilters>`** - Filter controls (player, action type)
- **`<HistorySearch>`** - Search input with highlighting
- **`<PhaseMarker>`** - Phase separator with sticky header
- **`<ExportButton>`** - Export history to file
- **`useHistoryData()`** - Hook for fetching and managing history

**Component Specs:**

- `component-specs/container/HistoryPanel.md` (NEW)
- `component-specs/presentational/MoveList.md` (NEW)
- `component-specs/presentational/MoveEntry.md` (NEW)
- `component-specs/presentational/HistoryFilters.md` (NEW)
- `component-specs/hooks/useHistoryData.md` (NEW)

```json
  "seat": "North",
  "action": { "DeclareWin": { "pattern_name": "Odds Only", "score": 35 } },
  "timestamp": "2026-02-01T12:40:00Z"
```

- **`tests/test-scenarios/history-filter-action.md`** - Filter by action type
- **`tests/test-scenarios/history-search.md`** - Search functionality
- **`tests/test-scenarios/history-export.md`** - Export to JSON/CSV

```json
  {
  "seat": "North",
  "action": { "DrawTile": { "tile": "Dot5", "visible": true } },
  "description": "Drew tile from wall",
  "timestamp": "2026-02-01T12:39:00Z",
  "action_type": "Draw",
  "description": "Drew tile from wall",
  "timestamp_ms": 1706635150000,
  "phase": "Playing"
  },
  {
  "move_number": 81,
  "player": "East",
  "action_type": "Discard",
  "description": "Discarded 3 Crack",
  "timestamp_ms": 1706635140000,
  "phase": "Playing"
  },
  {
  "move_number": 80,
  "player": "East",
  "action_type": "Draw",
  "description": "Drew tile from wall",
  "timestamp_ms": 1706635130000,
  "phase": "Playing"
  },
  {
  "move_number": 79,
  "player": "North",
  "action_type": "Call",
  "description": "Called Pung of 2 Bamboo from West",
  "timestamp_ms": 1706635120000,
  "phase": "Playing"
  },
  {
  "move_number": 78,
  "player": "West",
  "action_type": "Discard",
  "description": "Discarded 2 Bamboo",
  "timestamp_ms": 1706635110000,
  "phase": "Playing"
  }
```

## Edge Cases

### EC-1: Empty History (Game Just Started)

**Given** the game just started (no moves yet)
**When** I open the history panel
**Then** a message displays: "No moves yet. History will appear here."
**And** filter and search controls are disabled

### EC-2: Large History (100+ Moves)

**Given** the game has 100+ moves
**When** I open the history panel
**Then** the list is virtualized (only visible entries rendered)
**And** scrolling is smooth (no lag)
**And** search and filters work efficiently

### EC-3: Network Error on History Request

**Given** I request history but network fails
**When** no `HistoryList` event is received within 5 seconds
**Then** an error message displays: "Failed to load history. Retrying..."
**And** the request is automatically retried (max 3 attempts)

### EC-4: History During Replay

**Given** I am viewing a completed game replay
**When** I open the history panel
**Then** the history shows all moves from the replayed game
**And** the current replay position is highlighted in the history

### EC-5: Real-Time Updates During Active Game

**Given** the history panel is open during an active game
**When** other players make moves
**Then** new entries appear in real-time
**And** the list auto-scrolls if I'm viewing the bottom
**And** if I'm scrolled to an older move, a "New moves available" badge appears

### EC-6: Filter Combinations

**Given** I have both player and action type filters active
**When** the filters are applied
**Then** only moves matching BOTH filters are shown (AND logic)
**And** the count reflects the combined filter: "Showing 5 of 87 moves (East + Discards)"

## Related User Stories

- **US-025**: Jump to Historical Move - Click move to jump to that state
- **US-026**: Resume from History Point - Resume playing from historical move
- **US-022**: Smart Undo (Solo) - Undo uses move history
- **US-023**: Smart Undo (Voting) - Undo in multiplayer uses history

## Accessibility Considerations

### Keyboard Navigation

- **H Key**: Toggle history panel open/closed
- **Tab**: Navigate through filter buttons and move entries
- **Arrow Up/Down**: Navigate move list
- **Enter**: Expand/collapse focused move entry
- **Escape**: Close history panel
- **/ (Slash)**: Focus search input

### Screen Reader

- **Panel Open**: "History panel opened. Showing 87 moves from current game."
- **Move Entry**: "Move 42. South discarded 5 Dots. 2 minutes ago. Playing phase."
- **Expanded**: "Move 42 details. South discarded 5 Dots from a hand of 14 tiles. Wall: 87 tiles remaining. 1 exposed meld."
- **Filter Applied**: "Filter applied. Showing 23 of 87 moves. East only."
- **Search**: "Search active. Found 5 matches for '5 Dots'."
- **New Move**: "New move: North declared Mahjong. Move 87."

### Visual

- **High Contrast**: Move entries have clear borders and distinct background colors
- **Phase Colors**: Each phase has a unique color code (Setup: blue, Charleston: green, Playing: yellow, Scoring: gold)
- **Player Colors**: Each player (East/South/West/North) has a consistent color
- **Motion**: Panel slide animation respects `prefers-reduced-motion` (instant appear/disappear)
- **Text Size**: Adjustable text size for move descriptions

## Priority

**MEDIUM** - Analysis and learning feature, not critical for gameplay

## Story Points / Complexity

**3** - Medium complexity

- History panel UI with slide animation
- Move list virtualization for performance
- Filter and search functionality
- Real-time updates during active game
- Export functionality
- Phase grouping and markers

## Definition of Done

- [ ] "History" button accessible in UI (all game states)
- [ ] H key opens/closes history panel
- [ ] Panel slides in from right (30% width overlay)
- [ ] Move list displays chronologically with all required fields
- [ ] Each entry shows: move#, player, action, details, timestamp, phase
- [ ] Moves grouped by phase with sticky headers
- [ ] Phase separators with distinct visual styling
- [ ] Filter by player works (East/South/West/North/All)
- [ ] Filter by action type works (multiple selection)
- [ ] Search functionality with text highlighting
- [ ] Move entries expand/collapse on click
- [ ] Expanded view shows full details and events
- [ ] "Jump to Move" button appears in expanded view (links to US-025)
- [ ] Auto-scroll to latest move during active game
- [ ] New move pulse animation (1s highlight)
- [ ] Export button downloads JSON/CSV/Text
- [ ] Close button and Escape key close panel
- [ ] Virtualization for 100+ move lists (no lag)
- [ ] Real-time updates when other players move
- [ ] "New moves available" badge when scrolled away from latest
- [ ] Empty state message when no moves
- [ ] Network error handling with retry logic
- [ ] Component tests pass (HistoryPanel, MoveList, MoveEntry, Filters)
- [ ] Integration tests pass (fetch history, filter, search, export)
- [ ] E2E test passes (full history viewing flow)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Performance tests pass (smooth scrolling with 100+ moves)
- [ ] Manually tested against `user-testing-plan.md` (Part 5, History features)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### History Panel Component

```typescript
<HistoryPanel
  isOpen={isHistoryOpen}
  onClose={() => setIsHistoryOpen(false)}
  moves={historyMoves}
  currentMove={currentMoveNumber}
  onJumpToMove={(moveNum) => {
    // See US-025 for implementation
  }}
/>
```

Panel should:

- Slide in from right with 300ms animation
- Overlay 30% of screen width (responsive: 40% on mobile)
- Be dismissible by clicking outside or pressing Escape
- Show scrollbar only when needed

### Move List Virtualization

For performance with large histories, use virtualization:

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={filteredMoves.length}
  itemSize={80}  // Height per move entry
  width="100%"
>
  {({ index, style }) => (
    <MoveEntry
      move={filteredMoves[index]}
      style={style}
      isExpanded={expandedMoves.has(index)}
      onToggle={() => toggleExpanded(index)}
    />
  )}
</FixedSizeList>
```

This ensures smooth scrolling even with 500+ moves.

### Phase Grouping

```typescript
interface PhaseGroup {
  phase: GamePhase;
  moves: MoveHistorySummary[];
  startMove: number;
  endMove: number;
}

function groupMovesByPhase(moves: MoveHistorySummary[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  let currentPhase: GamePhase | null = null;
  let currentGroup: MoveHistorySummary[] = [];

  moves.forEach((move) => {
    if (move.phase !== currentPhase) {
      if (currentGroup.length > 0) {
        groups.push({
          phase: currentPhase!,
          moves: currentGroup,
          startMove: currentGroup[0].move_number,
          endMove: currentGroup[currentGroup.length - 1].move_number,
        });
      }
      currentPhase = move.phase;
      currentGroup = [move];
    } else {
      currentGroup.push(move);
    }
  });

  if (currentGroup.length > 0) {
    groups.push({
      phase: currentPhase!,
      moves: currentGroup,
      startMove: currentGroup[0].move_number,
      endMove: currentGroup[currentGroup.length - 1].move_number,
    });
  }

  return groups;
}
```

### Filter Logic

```typescript
function filterMoves(
  moves: MoveHistorySummary[],
  playerFilter: Seat | 'All',
  actionFilters: Set<ActionType>,
  searchQuery: string
): MoveHistorySummary[] {
  return moves.filter((move) => {
    // Player filter
    if (playerFilter !== 'All' && move.player !== playerFilter) {
      return false;
    }

    // Action type filter
    if (actionFilters.size > 0 && !actionFilters.has(move.action_type)) {
      return false;
    }

    // Search query
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchDescription = move.description.toLowerCase().includes(searchLower);
      const matchPlayer = move.player.toLowerCase().includes(searchLower);
      const matchTiles =
        move.details?.tiles?.some((tile) => tile.toLowerCase().includes(searchLower)) ?? false;

      if (!matchDescription && !matchPlayer && !matchTiles) {
        return false;
      }
    }

    return true;
  });
}
```

### Export Functionality

```typescript
function exportHistory(moves: MoveHistorySummary[], format: 'json' | 'csv' | 'txt') {
  let content: string;
  let mimeType: string;
  let filename: string;

  switch (format) {
    case 'json':
      content = JSON.stringify({ moves, exported_at: new Date().toISOString() }, null, 2);
      mimeType = 'application/json';
      filename = `game-${roomId}-history.json`;
      break;

    case 'csv':
      const headers = 'Move,Player,Action,Description,Timestamp,Phase\n';
      const rows = moves
        .map(
          (m) =>
            `${m.move_number},"${m.player}","${m.action_type}","${m.description}",${m.timestamp_ms},"${m.phase}"`
        )
        .join('\n');
      content = headers + rows;
      mimeType = 'text/csv';
      filename = `game-${roomId}-history.csv`;
      break;

    case 'txt':
      content = moves
        .map(
          (m) =>
            `#${m.move_number} - ${m.player}: ${m.description} (${formatTimestamp(m.timestamp_ms)})`
        )
        .join('\n');
      mimeType = 'text/plain';
      filename = `game-${roomId}-history.txt`;
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Real-Time Updates

```typescript
useEffect(() => {
  // Subscribe to new move events
  const unsubscribe = subscribeToGameEvents((event) => {
    if (isHistoryEvent(event)) {
      const newMove = convertEventToHistoryEntry(event);
      setHistoryMoves((prev) => [...prev, newMove]);

      // Auto-scroll if viewing bottom
      if (isScrolledToBottom) {
        scrollToBottom();
      } else {
        setHasNewMoves(true);
      }
    }
  });

  return unsubscribe;
}, []);
```

### Zustand Store Updates

```typescript
case 'HistoryList':
  state.history = event.entries;
  state.historyLoaded = true;
  break;

// Real-time move tracking
case 'TileDiscarded':
  state.history.push({
    move_number: state.currentMove + 1,
    player: event.player,
    action_type: 'Discard',
    description: `Discarded ${event.tile}`,
    timestamp_ms: Date.now(),
    phase: state.phase,
    details: { tiles: [event.tile] }
  });
  state.currentMove += 1;
  break;

// Similar for other action events...
```

### Accessibility Implementation

```typescript
<div
  role="dialog"
  aria-label="Game move history"
  aria-modal="false"  // Overlay, not modal
>
  <button
    aria-label="Close history panel"
    onClick={onClose}
  >
    ✕
  </button>

  <div role="search">
    <input
      type="search"
      placeholder="Search moves..."
      aria-label="Search move history"
    />
  </div>

  <div
    role="region"
    aria-label="Move list"
    aria-live="polite"  // Announce new moves
  >
    {moves.map(move => (
      <div
        key={move.move_number}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Move ${move.move_number}. ${move.player} ${move.description}.`}
      >
        {/* Move content */}
      </div>
    ))}
  </div>
</div>
```
