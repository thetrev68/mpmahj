# US-002: Charleston First Right (Standard Pass)

## Story

**As a** player in any seat
**I want** to select 3 tiles from my hand and pass them to the player on my right
**So that** I can exchange unwanted tiles during the Charleston phase

## Acceptance Criteria

### AC-1: Charleston Phase Entry

**Given** the deal has completed and I have 13 tiles
**When** the server emits `CharlestonPhaseChanged { stage: FirstRight }`
**Then** the Charleston tracker displays "Pass Right →" with an arrow pointing right
**And** a timer starts (default: 60 seconds)
**And** my hand becomes interactive for tile selection
**And** the action bar shows a "Pass Tiles" button (disabled initially)

### AC-2: Tile Selection

**Given** I am in the `Charleston(FirstRight)` stage
**When** I click on a tile in my hand
**Then** the tile is visually highlighted (raised 10px, yellow border)
**And** the selection counter shows "1/3 selected"
**And** the "Pass Tiles" button remains disabled

**When** I click on 2 more tiles (total 3 selected)
**Then** all 3 tiles are raised & highlighted
**And** the selection counter shows "3/3 selected"
**And** the "Pass Tiles" button becomes enabled

### AC-3: Joker Lock Validation

**Given** I am selecting tiles for Charleston
**When** I click on a Joker tile in my hand
**Then** the Joker is NOT selected
**And** a tooltip appears: "Jokers cannot be passed"
**And** the Joker tile has a visual indicator (red tint, diagonal strike-through)

### AC-4: Deselection

**Given** I have selected 3 tiles
**When** I click on a selected tile again
**Then** the tile is deselected (highlight removed)
**And** the selection counter updates (e.g., "2/3 selected")
**And** the "Pass Tiles" button becomes disabled

### AC-5: Over-Selection Prevention

**Given** I have selected 3 tiles
**When** I click on a 4th tile (not previously selected)
**Then** the tile is NOT selected
**And** a tooltip appears: "No more than 3 tiles may be selected for passing"
**And** the total remains 3 selected tiles
**And** the selection counter shows "3/3 selected"

### AC-6: Pass Submission

**Given** I have exactly 3 tiles selected
**When** I click the "Pass Tiles" button
**Then** a `PassTiles` command is sent to the server
**And** the button shows a loading state (spinner, disabled)
**And** my hand becomes non-interactive (cannot select/deselect)
**And** a message appears: "Waiting for other players..."

### AC-7: Server Acknowledgment

**Given** I submitted my tiles to pass
**When** the server emits `TilesPassed { player: me, tiles: [...] }`
**Then** the selected tiles slide out of my hand with animation (0.3s)
**And** my tile count temporarily shows 10 tiles
**And** a checkmark appears next to my name in the player list

### AC-8: Waiting for All Players

**Given** I have passed my tiles
**When** other players complete their selections
**Then** I see `PlayerReadyForPass { player }` events for each player
**And** a progress indicator shows "3/4 players ready"
**And** the message updates: "Waiting for [PlayerName]..."

### AC-9: Tiles Exchange

**Given** all 4 players have passed their tiles
**When** the server emits `TilesPassing { direction: Right }`
**Then** a brief animation shows tiles moving between players (0.6s with directional arrows)

**When** the server emits `TilesReceived { player: me, tiles: [...], from: West }`
**Then** 3 new tiles slide into my hand from the left (0.3s)
**And** my hand auto-sorts by suit and rank
**And** my tile count returns to 13
**And** the newly received tiles have a brief highlight (2s pulsing border)

### AC-10: Phase Advancement

**Given** all players have received their tiles
**When** the server emits `CharlestonPhaseChanged { stage: FirstAcross }`
**Then** the Charleston tracker updates to "Pass Across ↔"
**And** the timer resets for the next pass (60 seconds)
**And** my hand becomes interactive again
**And** the "Pass Tiles" button resets (disabled until 3 selected)
**And** the selection counter resets to "0/3 selected"

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  PassTiles: {
    player: Seat,
    tiles: [Tile, Tile, Tile],      // Exactly 3 tiles
    blind_pass_count: null          // None for standard pass
  }
}
```text

### Events (Backend → Frontend)

**Private Event (to me only):**

```typescript
{
  kind: 'Private',
  event: {
    TilesPassed: {
      player: Seat,
      tiles: [Tile, Tile, Tile]
    }
  }
}

{
  kind: 'Private',
  event: {
    TilesReceived: {
      player: Seat,
      tiles: [Tile, Tile, Tile],
      from: Seat.West  // Who I received from (left player)
    }
  }
}
```text

**Public Events (to all players):**

```typescript
{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "FirstRight" }
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonTimerStarted: {
      stage: "FirstRight",
      duration: 60,
      started_at_ms: 1706634000000,
      timer_mode: "Standard"
    }
  }
}

{
  kind: 'Public',
  event: {
    PlayerReadyForPass: {
      player: Seat
    }
  }
}

{
  kind: 'Public',
  event: {
    TilesPassing: {
      direction: "Right"
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "FirstAcross" }
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `PassTiles` command
  - `crates/mahjong_core/src/charleston.rs` - Charleston state machine
- **Game Design Doc**:
  - Section 2.2.2 (Pass 1: First Right)
  - Section 2.2.1 (Global Charleston Constraints)

## Components Involved

- **`<CharlestonTracker>`** - Displays current stage and progress
- **`<CharlestonTimer>`** - Countdown timer (60s)
- **`<TileSelectionPanel>`** - Handles tile selection logic (3-tile limit, Joker blocking)
- **`<ConcealedHand>`** - Displays user's hand with selection state
- **`<ActionBar>`** - Contains "Pass Tiles" button
- **`<PassAnimationLayer>`** - Animates tile movement during pass
- **`<PlayerStatusIndicator>`** - Shows checkmarks for ready players

**Component Specs:**

- `component-specs/presentational/CharlestonTracker.md`
- `component-specs/presentational/CharlestonTimer.md`
- `component-specs/container/TileSelectionPanel.md`
- `component-specs/container/ConcealedHand.md`
- `component-specs/integration/CharlestonFlow.md`

## Test Scenarios

- **`tests/test-scenarios/charleston-standard.md`** - Full FirstRight flow
- **`tests/test-scenarios/charleston-joker-blocking.md`** - Joker validation
- **`tests/test-scenarios/charleston-timer-expiry.md`** - Auto-pass on timeout

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-first-right.json` - Initial state
- `tests/fixtures/hands/charleston-hand-standard.json` - Sample 13-tile hand
- `tests/fixtures/events/charleston-first-right-sequence.json` - Event flow

**Sample Hand (13 tiles):**

```json
{
  "name": "Charleston Starting Hand",
  "tiles": [
    "Bam1",
    "Bam4",
    "Bam7",
    "Crak2",
    "Crak5",
    "Crak9",
    "Dot3",
    "Dot6",
    "Dot8",
    "Wind1",
    "Dragon2",
    "Dragon3",
    "Joker"
  ],
  "note": "Includes 1 Joker to test blocking"
}
```text

## Edge Cases

### EC-1: Timer Expiry

**Given** the timer reaches 0 and I haven't passed tiles
**When** timeout occurs
**Then** the first 3 available non-Joker tiles are automatically selected
**And** a `PassTiles` command is sent with those tiles
**And** I see a message: "Time expired - auto-passing tiles"

### EC-2: All Tiles Are Jokers (Impossible in Practice)

**Given** I somehow have only Jokers in my hand (invalid game state)
**When** the timer expires
**Then** the frontend logs an error
**And** sends an error report to backend
**And** the game enters error recovery state

### EC-3: Disconnection During Selection

**Given** I have selected 2 tiles but haven't passed
**When** I disconnect from the server
**And** reconnect within the timer window
**Then** my selection state is NOT preserved (resets to 0)
**And** I must re-select 3 tiles
**And** the timer continues from server time (not reset)

### EC-4: Double-Submit Prevention

**Given** I click "Pass Tiles" with 3 selected
**When** I rapidly click the button again before server responds
**Then** only ONE `PassTiles` command is sent
**And** the button is disabled after first click

### EC-5: Network Error on Pass

**Given** I submit tiles but network fails
**When** no `TilesPassed` acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to pass tiles. Retrying..."
**And** the command is automatically retried (max 3 attempts)
**And** if all retries fail, show "Connection lost" with manual retry button

## Related User Stories

- **US-003**: Charleston First Left (Blind Pass) - Next stage after FirstAcross
- **US-004**: Charleston Voting - Occurs after FirstLeft
- **US-016**: Timer Configuration - Adjust default 60s timer
- **US-017**: Animation Settings - Fast mode, skip animations

## Accessibility Considerations

### Keyboard Navigation

- **Arrow Keys**: Navigate between tiles in hand
- **Space/Enter**: Toggle selection of focused tile
- **P Key**: Submit pass (when 3 selected)
- **Escape**: Deselect all tiles

### Screen Reader

- **Selection**: "Tile selected: 3 Bamboo. 1 of 3 selected."
- **Joker Block**: "Joker cannot be passed during Charleston."
- **Pass**: "Passing 3 tiles to player on your right."
- **Received**: "Received 3 tiles from player on your left."

### Visual

- **High Contrast**: Selected tiles have thick, high-contrast border
- **Color-Blind**: Use patterns in addition to color for selection state
- **Motion**: Respect `prefers-reduced-motion` for pass animations

## Priority

**CRITICAL** - Core Charleston mechanic, required for game progression

## Story Points / Complexity

**8** - High complexity

- Multi-tile selection logic
- Joker blocking validation
- Timer synchronization
- Multi-step event sequence
- Animations (tile pass, received)
- State management (selection, waiting, received)
- Network error handling

## Definition of Done

- [x] Charleston tracker shows "FirstRight" stage
- [x] Timer starts at 60 seconds and counts down
- [x] User can select exactly 3 tiles (no more, no less)
- [x] Jokers are blocked from selection with visual feedback
- [x] "Pass Tiles" button enabled only when 3 non-Joker tiles selected
- [x] `PassTiles` command sent with correct tiles
- [x] Selected tiles animate out of hand on `TilesPassed` event
- [x] Progress indicator shows ready status of all players
- [x] Pass animation plays on `TilesPassing` event
- [x] Received tiles animate into hand on `TilesReceived` event
- [x] Hand auto-sorts after receiving new tiles
- [x] Phase advances to "FirstAcross" after all exchanges complete
- [x] Component tests pass (TileSelectionPanel, ConcealedHand, ActionBar)
- [x] Integration tests pass (full Charleston FirstRight flow)
- [x] E2E test passes (4-player Charleston sequence)
- [x] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [x] Visual regression tests pass (selection states, animations)
- [x] Timer expiry behavior tested (auto-pass)
- [x] Network error handling tested (retry logic)
- [x] Manually tested against `user-testing-plan.md` (Part 3, Scenarios 3.1, 3.10)
- [x] Code reviewed and approved
- [x] Performance tested (no lag during animations)
- [x] No console errors or warnings

## Notes for Implementers

### Selection State Management

Use a custom hook for clean separation:

```typescript
const { selectedTiles, toggleTile, canSelect, isSelected, clearSelection } = useTileSelection({
  maxSelection: 3,
  hand: yourHand,
  disabledTiles: yourHand.filter((tile) => tile === 'Joker'),
});
```text

### Event Synchronization

The Charleston pass involves multiple events in sequence:

1. `TilesPassed` (private) - Acknowledge my tiles removed
2. `PlayerReadyForPass` (public) - Each player's ready status
3. `TilesPassing` (public) - Pass animation trigger
4. `TilesReceived` (private) - New tiles added to hand
5. `CharlestonPhaseChanged` (public) - Advance to next stage

Use `useActionQueue` to sequence animations correctly. Each event should wait for previous animation to complete.

### Timer Synchronization

Timer must sync with server time, not local time:

```typescript
const timeRemaining = useMemo(() => {
  if (!timerStart) return 0;
  const serverTime = Date.now(); // Adjust for server time offset
  const elapsed = serverTime - timerStart;
  return Math.max(0, timerDuration - elapsed);
}, [timerStart, timerDuration]);
```text

This prevents timer desync if client clock is inaccurate.

### Auto-Sort Logic

After receiving tiles, hand should auto-sort by:

1. Suit (Bam → Crak → Dot → Winds → Dragons → Flowers → Jokers)
2. Rank within suit (1-9)

Use the `sortHand()` utility in `apps/client/src/utils/tileFormatter.ts`.

### Animation Coordination

Recommended timing (from Section 1.7):

- **Tile selection**: Instant (no animation)
- **Tiles passing out**: 300ms ease-out
- **Pass animation overlay**: 600ms with arrows
- **Tiles received in**: 300ms ease-in
- **Auto-sort**: 200ms stagger

Total time: ~1.4 seconds from pass to fully sorted hand.

Ensure `getEventAnimationDelay()` accounts for this in the orchestrator.

### Zustand Store Updates

The `gameStore` should handle these events:

```typescript
case 'TilesPassed':
  // Remove tiles from yourHand
  state.yourHand = state.yourHand.filter(
    tile => !event.tiles.includes(tile)
  );
  break;

case 'TilesReceived':
  // Add tiles to yourHand
  state.yourHand.push(...event.tiles);
  // Auto-sort
  state.yourHand = sortHand(state.yourHand);
  break;

case 'CharlestonPhaseChanged':
  state.phase = { Charleston: event.stage };
  break;
```text

### Testing with Mock WebSocket

For integration tests, simulate the event sequence:

```typescript
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonPhaseChanged: { stage: 'FirstRight' } } });
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonTimerStarted: { ... } } });

// User selects tiles and passes...

mockWs.simulateEvent({ kind: 'Private', event: { TilesPassed: { ... } } });
mockWs.simulateEvent({ kind: 'Public', event: { PlayerReadyForPass: { player: 'South' } } });
// ... repeat for all players
mockWs.simulateEvent({ kind: 'Public', event: { TilesPassing: { direction: 'Right' } } });
mockWs.simulateEvent({ kind: 'Private', event: { TilesReceived: { ... } } });
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonPhaseChanged: { stage: 'FirstAcross' } } });
```text

See `tests/test-scenarios/charleston-standard.md` for full test script.

```text

```text
```
