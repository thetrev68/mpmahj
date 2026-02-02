# US-025: Jump to Historical Move

## Story

**As a** player reviewing game history
**I want** to jump the game view to a specific historical move and see the exact game state at that point
**So that** I can analyze decisions, understand critical moments, and learn from the game

## Acceptance Criteria

### AC-1: Jump Option in History Panel

**Given** the history panel is open (US-024)
**When** I click on a move entry to expand it
**Then** a "Jump to This Move" button appears in the expanded details
**And** the button shows the move number: "Jump to Move #42"

### AC-2: Initiate Jump to Historical Move

**Given** I clicked "Jump to This Move" for move #42
**When** the button is clicked
**Then** a `JumpToMove { player: me, move_number: 42 }` command is sent
**And** a loading overlay appears: "Loading game state from move #42..."
**And** the history panel remains open but dims slightly

### AC-3: Historical State View Activated

**Given** the server processed my jump request
**When** the server emits `StateRestored { move_number: 42, description, mode }`
**Then** the main game view transitions to show the historical state
**And** a prominent overlay banner appears at the top: "VIEWING HISTORY - Move #42 (Read-Only)"
**And** the game state displays exactly as it was at move #42:

- Hand shows tiles from that moment
- Exposed melds show state from that moment
- Discard pool shows tiles discarded up to that point
- Wall counter shows tiles remaining at that moment
- Turn indicator shows whose turn it was

### AC-4: Read-Only Mode Restrictions

**Given** I am viewing a historical state (move #42)
**When** I try to interact with the game
**Then** all action buttons are disabled (grayed out)
**And** tiles are not clickable
**And** a tooltip appears: "Read-only mode - viewing history"
**And** the action bar shows: "Historical View - No actions available"

### AC-5: Timeline Scrubber

**Given** I am in historical view mode
**When** a timeline scrubber appears below the history banner
**Then** the scrubber shows:

- A slider from move #1 to current move (#87)
- Current position marker at move #42
- Phase markers (Setup, Charleston, Playing) along the timeline
- Draggable handle to quickly navigate between moves
  **And** I can drag the handle to jump to different moves instantly

### AC-6: Navigate Between Moves (Arrow Keys)

**Given** I am viewing move #42 in historical mode
**When** I press the Left Arrow key
**Then** the view jumps to move #41 (previous move)
**And** the game state updates to reflect move #41

**When** I press the Right Arrow key
**Then** the view jumps to move #43 (next move)
**And** the game state updates to reflect move #43

### AC-7: Return to Current Game State

**Given** I am viewing a historical state (move #42)
**When** I click the "Return to Current" button in the history banner
**Or** press Escape key
**Then** a `ReturnToPresent { player: me }` command is sent
**And** the historical view closes
**And** the game view returns to the current live state (move #87)
**And** the history banner disappears
**And** all game controls are re-enabled

### AC-8: Historical View in Completed Games

**Given** I am viewing a completed game (game over)
**When** I jump to a historical move
**Then** the historical view works the same as in active games
**And** the "Return to Current" button shows "Return to Final State"
**And** clicking it returns to the game over screen

### AC-9: Historical View with Move Details

**Given** I am viewing move #42 in historical mode
**When** the historical state loads
**Then** a details panel shows:

- **Move**: "#42 - South discarded 5 Dots"
- **Game State**: Phase, turn, tiles remaining
- **Player States**: Hand sizes, exposed melds for all players
- **Context**: "This led to move #43: West called Pung"

### AC-10: Cannot Jump in Multiplayer (Active Game)

**Given** I am in an active multiplayer game (2+ human players)
**When** I try to jump to a historical move
**Then** a warning dialog appears: "Cannot jump to history in active multiplayer game. This feature is read-only and requires game pause."
**And** the jump is blocked
**Note:** Jumping is allowed in solo games and completed games only

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  JumpToMove: {
    player: Seat,
    move_number: number
  }
}

{
  ReturnToPresent: {
    player: Seat
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    StateRestored: {
      move_number: number,
      description: string,
      mode: "Viewing" | "Paused" | "None"
    }
  }
}

{
  kind: 'Public',
  event: {
    HistoryError: {
      message: string
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `JumpToMove`, `ReturnToPresent`
  - `crates/mahjong_core/src/history.rs` - History viewing modes
  - `crates/mahjong_core/src/event/public_events.rs` - `StateRestored`, `HistoryError`
- **Game Design Doc**:
  - Section 5.5 (Historical State Viewing)
  - Section 5.6 (Read-Only Mode)

## Components Involved

- **`<HistoricalViewBanner>`** - Top banner showing "Viewing History" with move info
- **`<TimelineScrubber>`** - Slider to navigate between moves
- **`<ReturnToCurrentButton>`** - Exit historical view
- **`<ReadOnlyOverlay>`** - Disables interactions in historical mode
- **`<HistoricalDetailsPanel>`** - Shows move context and details
- **`<GameBoard>`** - Updated to display historical state (read-only)

**Component Specs:**

- `component-specs/presentational/HistoricalViewBanner.md` (NEW)
- `component-specs/presentational/TimelineScrubber.md` (NEW)
- `component-specs/presentational/ReadOnlyOverlay.md` (NEW)
- `component-specs/container/GameBoard.md` (UPDATE for historical view)

## Test Scenarios

- **`tests/test-scenarios/jump-to-move-basic.md`** - Jump to move and view state
- **`tests/test-scenarios/jump-to-move-timeline.md`** - Navigate with timeline scrubber
- **`tests/test-scenarios/jump-to-move-arrows.md`** - Navigate with arrow keys
- **`tests/test-scenarios/jump-to-move-return.md`** - Return to current state
- **`tests/test-scenarios/jump-to-move-completed-game.md`** - Jump in finished game
- **`tests/test-scenarios/jump-to-move-multiplayer-blocked.md`** - Blocked in active multiplayer

## Mock Data

**Fixtures:**

- `tests/fixtures/history/historical-snapshot-move-42.json` - Game state at move #42
- `tests/fixtures/history/historical-snapshot-move-10.json` - Charleston state
- `tests/fixtures/events/jump-to-move-sequence.json` - Jump event flow

**Sample History Restore Event:**

```json
{
  "move_number": 42,
  "description": "Move 42: South discarded 5 Dots",
  "mode": { "Viewing": { "at_move": 42 } }
}
```text

## Edge Cases

### EC-1: Jump to Move #1 (Start of Game)

**Given** I jump to move #1
**When** the historical state loads
**Then** the game shows the initial deal state
**And** all players have 13 tiles (East has 14)
**And** the discard pool is empty

### EC-2: Jump to Current Move

**Given** the current live move is #87
**When** I jump to move #87
**Then** the view shows current state (no change)
**And** the "Return to Current" button is disabled or hidden
**And** a message: "Already viewing current state"

### EC-3: Jump to Non-Existent Move

**Given** the game has 87 total moves
**When** I try to jump to move #150 (doesn't exist)
**Then** an error appears: "Move #150 does not exist (max: 87)"
**And** the jump is cancelled

### EC-4: Network Error on Jump

**Given** I request jump to move #42 but network fails
**When** no `HistoricalStateView` event is received within 5 seconds
**Then** an error toast: "Failed to load historical state. Retrying..."
**And** the request is retried (max 3 attempts)

### EC-5: Timeline Scrubber Drag Performance

**Given** I drag the timeline scrubber rapidly
**When** dragging across many moves
**Then** the view updates smoothly (throttled to 10 FPS max)
**And** no lag or freezing occurs

### EC-6: Multiplayer Restriction

**Given** I am in an active multiplayer game
**When** I try to jump to history
**Then** the jump is blocked with a warning
**And** only solo games and completed games allow jumping

## Related User Stories

- **US-024**: View Move History - History panel provides jump option
- **US-026**: Resume from History Point - Resume playing from historical move
- **US-022**: Smart Undo (Solo) - Undo is a form of jumping back

## Accessibility Considerations

### Keyboard Navigation

- **Left Arrow**: Navigate to previous move
- **Right Arrow**: Navigate to next move
- **Home**: Jump to move #1 (start of game)
- **End**: Jump to current/final move
- **Escape**: Exit historical view and return to current
- **Space**: Play/pause auto-playback (optional feature)

### Screen Reader

- **Historical View**: "Historical view activated. Viewing move 42. South discarded 5 Dots. Read-only mode. Press Escape to return to current game."
- **Timeline**: "Timeline scrubber. Move 42 of 87. Use arrow keys to navigate. Drag to jump."
- **Navigate**: "Navigated to move 43. West called Pung of 5 Dots."
- **Return**: "Returned to current game state. Move 87. Historical view closed."

### Visual

- **High Contrast**: Historical view banner has distinct color (blue with white text)
- **Read-Only Indicator**: All disabled elements have clear visual styling (grayed out, lower opacity)
- **Timeline**: Phase markers are color-coded and labeled
- **Motion**: Banner slide and timeline updates respect `prefers-reduced-motion`

## Priority

**MEDIUM** - Analysis and learning feature

## Story Points / Complexity

**5** - Medium-High complexity

- Historical state loading and display
- Read-only mode enforcement
- Timeline scrubber UI and logic
- Arrow key navigation
- Return to current state
- Multiplayer restriction logic
- Performance optimization for rapid navigation

## Definition of Done

- [ ] "Jump to This Move" button appears in expanded move entry (US-024)
- [ ] Button click sends `JumpToMove` command with move number
- [ ] `HistoricalStateView` event loads historical game state
- [ ] Historical view banner displays at top: "VIEWING HISTORY - Move #X"
- [ ] Game board shows exact state from that move (hand, melds, discards, wall, etc.)
- [ ] All action buttons disabled in historical mode
- [ ] Read-only overlay prevents interactions
- [ ] Timeline scrubber appears with phase markers
- [ ] Scrubber handle draggable to navigate between moves
- [ ] Left/Right arrow keys navigate prev/next move
- [ ] Home key jumps to move #1
- [ ] End key jumps to current move
- [ ] "Return to Current" button exits historical view
- [ ] Escape key exits historical view
- [ ] Historical details panel shows move context
- [ ] Jump to move #1 shows initial deal state
- [ ] Jump to current move shows no change or is disabled
- [ ] Jump to non-existent move shows error
- [ ] Network error handling with retry logic
- [ ] Timeline drag performance optimized (throttled updates)
- [ ] Multiplayer restriction: jump blocked in active multiplayer games
- [ ] Jump allowed in solo games and completed games
- [ ] Component tests pass (HistoricalViewBanner, TimelineScrubber, ReadOnlyOverlay)
- [ ] Integration tests pass (jump → load state → navigate → return)
- [ ] E2E test passes (full historical viewing flow)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Performance tests pass (smooth timeline dragging)
- [ ] Manually tested against `user-testing-plan.md` (Part 5, Historical viewing)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Historical View Banner

```typescript
<HistoricalViewBanner
  moveNumber={historicalMoveNumber}
  moveDescription={historicalMoveDescription}
  onReturn={() => {
    setHistoricalMode(false);
    setCurrentView('live');
  }}
/>
```text

Banner display:

```text
╔════════════════════════════════════════════════════════════╗
║ 📜 VIEWING HISTORY - Move #42: South discarded 5 Dots      ║
║ [Return to Current] | Playing Phase | 87 tiles remaining   ║
╚════════════════════════════════════════════════════════════╝
```text

### Timeline Scrubber Implementation

```typescript
<TimelineScrubber
  currentMove={historicalMoveNumber}
  totalMoves={totalMoves}
  phases={phaseMarkers}
  onMoveChange={(move: number) => {
    jumpToMove(move);
  }}
/>
```text

Timeline should:

- Show slider from 1 to totalMoves
- Mark phase transitions (e.g., move #14: Charleston → Playing)
- Throttle updates during drag (max 10 FPS)
- Show tooltip with move description on hover

```typescript
const handleDrag = useMemo(
  () =>
    throttle((moveNumber: number) => {
      jumpToMove(moveNumber);
    }, 100), // 100ms throttle = 10 FPS
  []
);
```text

### Read-Only Mode Enforcement

```typescript
interface GameBoardProps {
  readOnly?: boolean;
  historicalState?: GameSnapshot;
}

function GameBoard({ readOnly, historicalState }: GameBoardProps) {
  const isInteractive = !readOnly && !historicalState;

  return (
    <div className={readOnly ? 'read-only-mode' : ''}>
      {readOnly && <ReadOnlyOverlay message="Viewing historical state - no actions available" />}

      <ConcealedHand
        tiles={historicalState?.your_hand || yourHand}
        interactive={isInteractive}
        onTileClick={isInteractive ? handleTileClick : undefined}
      />

      <ActionBar
        disabled={readOnly}
        buttons={readOnly ? [] : getAvailableActions()}
      />
    </div>
  );
}
```text

### Arrow Key Navigation

```typescript
useEffect(() => {
  if (!isHistoricalMode) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        if (historicalMoveNumber > 1) {
          jumpToMove(historicalMoveNumber - 1);
        }
        break;

      case 'ArrowRight':
        if (historicalMoveNumber < totalMoves) {
          jumpToMove(historicalMoveNumber + 1);
        }
        break;

      case 'Home':
        jumpToMove(1);
        break;

      case 'End':
        jumpToMove(totalMoves);
        exitHistoricalMode();
        break;

      case 'Escape':
        exitHistoricalMode();
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isHistoricalMode, historicalMoveNumber, totalMoves]);
```text

### Multiplayer Restriction Check

```typescript
function canJumpToHistory(): boolean {
  // Solo games: allowed
  const humanPlayers = players.filter((p) => !p.is_bot);
  if (humanPlayers.length === 1) {
    return true;
  }

  // Completed games: allowed
  if (gamePhase === 'GameOver') {
    return true;
  }

  // Active multiplayer: blocked
  return false;
}

function handleJumpRequest(moveNumber: number) {
  if (!canJumpToHistory()) {
    showWarning(
      'Cannot jump to history in active multiplayer game. This feature is read-only and requires game pause.'
    );
    return;
  }

  sendCommand({ JumpToMove: { player: mySeat, move_number: moveNumber } });
}
```text

### Zustand Store Updates

```typescript
case 'HistoricalStateView':
  state.historicalMode = true;
  state.historicalMoveNumber = event.move_number;
  state.historicalSnapshot = event.snapshot;
  state.historicalContext = event.context;
  break;

// Exit historical mode
function exitHistoricalMode() {
  state.historicalMode = false;
  state.historicalMoveNumber = null;
  state.historicalSnapshot = null;
  state.historicalContext = null;
}
```text

### Performance Optimization

For rapid timeline dragging:

```typescript
const throttledJump = useMemo(
  () =>
    throttle((moveNumber: number) => {
      // Request snapshot from backend
      sendCommand({ JumpToMove: { player: mySeat, move_number: moveNumber } });
    }, 100), // Max 10 jumps per second
  []
);

const handleTimelineDrag = (moveNumber: number) => {
  // Update UI immediately (optimistic)
  setHistoricalMoveNumber(moveNumber);

  // Throttle actual backend requests
  throttledJump(moveNumber);
};
```text

### Accessibility Implementation

```typescript
<div
  role="banner"
  aria-label="Historical view mode"
  aria-live="polite"
>
  <span aria-live="assertive">
    Viewing move {historicalMoveNumber} of {totalMoves}. {moveDescription}. Read-only mode.
  </span>

  <button
    onClick={exitHistoricalMode}
    aria-label={`Return to ${gamePhase === 'GameOver' ? 'final state' : 'current game'}`}
  >
    Return to Current
  </button>
</div>

<div
  role="slider"
  aria-label="Timeline scrubber"
  aria-valuemin={1}
  aria-valuemax={totalMoves}
  aria-valuenow={historicalMoveNumber}
  aria-valuetext={`Move ${historicalMoveNumber}: ${moveDescription}`}
  tabIndex={0}
  onKeyDown={handleTimelineKeyDown}
>
  {/* Scrubber UI */}
</div>
```text

```text

```text
```
