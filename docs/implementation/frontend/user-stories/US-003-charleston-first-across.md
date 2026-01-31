# US-003: Charleston First Across

## Story

**As a** player in any seat
**I want** to select 3 tiles from my hand and pass them to the player across from me
**So that** I can continue the Charleston tile exchange sequence

## Acceptance Criteria

### AC-1: Charleston Phase Entry

**Given** the First Right pass has completed and all players received tiles
**When** the server emits `CharlestonPhaseChanged { stage: FirstAcross }`
**Then** the Charleston tracker displays "Pass Across ↔" with a bidirectional arrow
**And** a timer starts (default: 60 seconds)
**And** my hand becomes interactive for tile selection
**And** the action bar shows a "Pass Tiles" button (disabled initially)
**And** the selection counter resets to "0/3 selected"

### AC-2: Tile Selection

**Given** I am in the `Charleston(FirstAcross)` stage
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

### AC-9: Tiles Exchange (Across Partner)

**Given** all 4 players have passed their tiles
**When** the server emits `TilesPassing { direction: Across }`
**Then** a brief animation shows tiles moving between across partners (0.6s with bidirectional arrows)

**When** the server emits `TilesReceived { player: me, tiles: [...], from: Across }`
**Then** 3 new tiles slide into my hand from the opposite side (0.3s)
**And** my hand auto-sorts by suit and rank
**And** my tile count returns to 13
**And** the newly received tiles have a brief highlight (2s pulsing border)

### AC-10: Phase Advancement

**Given** all players have received their tiles
**When** the server emits `CharlestonPhaseChanged { stage: FirstLeft }`
**Then** the Charleston tracker updates to "Pass Left ←" (with blind pass indicator)
**And** the timer resets for the next pass (60 seconds)
**And** my hand becomes interactive again
**And** the "Pass Tiles" button resets (disabled until 3 selected)
**And** the selection counter resets to "0/3 selected"

### AC-11: Bot Auto-Pass

**Given** the game is in `Charleston(FirstAcross)` stage
**And** one or more players are bots
**When** the phase begins
**Then** bots automatically select 3 non-Joker tiles after a delay (0.5-1.5 seconds)
**And** bots send `PassTiles` commands with their selections
**And** human players see "PlayerName (Bot) has passed tiles" message
**And** the progress indicator updates accordingly

## Technical Details

### Commands (Frontend → Backend)

````typescript
{
  PassTiles: {
    player: Seat,
    tiles: [Tile, Tile, Tile],      // Exactly 3 tiles
    blind_pass_count: null          // None for standard pass (FirstAcross is always standard)
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
      from: Some(Seat.North)  // Across player
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
      stage: { Charleston: "FirstAcross" }
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonTimerStarted: {
      stage: "FirstAcross",
      duration: 60,
      started_at_ms: 1706634060000,
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
      direction: "Across"
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "FirstLeft" }
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `PassTiles` command
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - Charleston state machine
  - `crates/mahjong_core/src/flow/charleston/stage.rs` - Stage definitions
- **Game Design Doc**:
  - Section 2.2.3 (Pass 2: First Across)
  - Section 2.2.1 (Global Charleston Constraints)

## Components Involved

- **`<CharlestonTracker>`** - Displays current stage with across arrow (↔)
- **`<CharlestonTimer>`** - Countdown timer (60s)
- **`<TileSelectionPanel>`** - Handles tile selection logic (3-tile limit, Joker blocking)
- **`<ConcealedHand>`** - Displays user's hand with selection state
- **`<ActionBar>`** - Contains "Pass Tiles" button
- **`<PassAnimationLayer>`** - Animates tile movement during pass (bidirectional for across)
- **`<PlayerStatusIndicator>`** - Shows checkmarks for ready players

**Component Specs:**

- `component-specs/presentational/CharlestonTracker.md`
- `component-specs/presentational/CharlestonTimer.md`
- `component-specs/container/TileSelectionPanel.md`
- `component-specs/container/ConcealedHand.md`
- `component-specs/integration/CharlestonFlow.md`

## Test Scenarios

- **`tests/test-scenarios/charleston-first-across.md`** - Full FirstAcross flow
- **`tests/test-scenarios/charleston-joker-blocking.md`** - Joker validation (shared)
- **`tests/test-scenarios/charleston-timer-expiry.md`** - Auto-pass on timeout (shared)
- **`tests/test-scenarios/charleston-bot-behavior.md`** - Bot auto-pass timing

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-first-across.json` - Initial state
- `tests/fixtures/hands/charleston-hand-after-first-right.json` - Hand after first pass
- `tests/fixtures/events/charleston-first-across-sequence.json` - Event flow

**Sample Hand (13 tiles after receiving from First Right):**

```json
{
  "name": "Charleston Hand After First Right",
  "tiles": [
    "Bam2",
    "Bam5",
    "Bam8",
    "Crak1",
    "Crak3",
    "Crak7",
    "Dot4",
    "Dot6",
    "Dot9",
    "Wind2",
    "Wind4",
    "Dragon1",
    "Joker"
  ],
  "note": "Newly received tiles: Crak1, Dot9, Dragon1"
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

### EC-6: Across Partner Identification

**Given** I am seated as East
**When** I pass tiles across
**Then** the tiles are sent to West (opposite seat)
**And** the animation shows tiles moving across the table diagonally
**And** I receive tiles from West

**Given** I am seated as South
**Then** my across partner is North
**And** tiles move vertically across the table

## Related User Stories

- **US-002**: Charleston First Right - Previous stage
- **US-004**: Charleston First Left (Blind Pass) - Next stage
- **US-005**: Charleston Voting - Occurs after FirstLeft
- **US-036**: Timer Configuration - Adjust default 60s timer
- **US-035**: Animation Settings - Fast mode, skip animations

## Accessibility Considerations

### Keyboard Navigation

- **Arrow Keys**: Navigate between tiles in hand
- **Space/Enter**: Toggle selection of focused tile
- **P Key**: Submit pass (when 3 selected)
- **Escape**: Deselect all tiles

### Screen Reader

- **Selection**: "Tile selected: 5 Bamboo. 2 of 3 selected."
- **Joker Block**: "Joker cannot be passed during Charleston."
- **Pass**: "Passing 3 tiles to player across from you."
- **Received**: "Received 3 tiles from player across from you."
- **Stage**: "Charleston stage: Pass Across. Select 3 tiles to pass."

### Visual

- **High Contrast**: Selected tiles have thick, high-contrast border
- **Color-Blind**: Use patterns in addition to color for selection state
- **Motion**: Respect `prefers-reduced-motion` for pass animations
- **Direction Indicator**: Bidirectional arrow (↔) clearly shows across direction

## Priority

**CRITICAL** - Core Charleston mechanic, required for game progression

## Story Points / Complexity

**5** - Medium-High complexity

- Similar to FirstRight but with different direction logic
- Across partner identification requires seat calculation
- Bidirectional animation requires different visual treatment
- Timer synchronization (shared logic with FirstRight)
- Bot auto-pass behavior
- Reuses most selection logic from US-002

## Definition of Done

- [ ] Charleston tracker shows "FirstAcross" stage with ↔ arrow
- [ ] Timer starts at 60 seconds and counts down
- [ ] User can select exactly 3 tiles (no more, no less)
- [ ] Jokers are blocked from selection with visual feedback
- [ ] "Pass Tiles" button enabled only when 3 non-Joker tiles selected
- [ ] `PassTiles` command sent with correct tiles
- [ ] Selected tiles animate out of hand on `TilesPassed` event
- [ ] Progress indicator shows ready status of all players
- [ ] Pass animation plays with bidirectional arrows on `TilesPassing` event
- [ ] Received tiles animate into hand from across player on `TilesReceived` event
- [ ] Hand auto-sorts after receiving new tiles
- [ ] Newly received tiles briefly highlighted
- [ ] Phase advances to "FirstLeft" after all exchanges complete
- [ ] Bot auto-pass behavior works correctly (0.5-1.5s delay)
- [ ] Across partner calculated correctly for all seats (East↔West, South↔North)
- [ ] Component tests pass (TileSelectionPanel, ConcealedHand, ActionBar)
- [ ] Integration tests pass (full Charleston FirstAcross flow)
- [ ] E2E test passes (4-player Charleston sequence through FirstAcross)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Visual regression tests pass (selection states, animations)
- [ ] Timer expiry behavior tested (auto-pass)
- [ ] Network error handling tested (retry logic)
- [ ] Manually tested against `user-testing-plan.md` (Part 3, Charleston scenarios)
- [ ] Code reviewed and approved
- [ ] Performance tested (no lag during animations)
- [ ] No console errors or warnings

## Notes for Implementers

### Across Partner Calculation

The across partner is the opposite seat:

```typescript
function getAcrossPartner(seat: Seat): Seat {
  const acrossMap = {
    [Seat.East]: Seat.West,
    [Seat.South]: Seat.North,
    [Seat.West]: Seat.East,
    [Seat.North]: Seat.South,
  };
  return acrossMap[seat];
}
```text

### Animation Direction

Unlike FirstRight (horizontal) or FirstLeft (horizontal), FirstAcross moves diagonally or vertically:

- **East ↔ West**: Horizontal across (left-right)
- **South ↔ North**: Vertical across (up-down)

Use different animation paths based on seat pair orientation.

### Selection State Management

Reuse the `useTileSelection` hook from US-002:

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
5. `CharlestonPhaseChanged` (public) - Advance to FirstLeft (blind pass)

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
- **Pass animation overlay**: 600ms with bidirectional arrows (↔)
- **Tiles received in**: 300ms ease-in
- **Auto-sort**: 200ms stagger

Total time: ~1.4 seconds from pass to fully sorted hand.

Ensure `getEventAnimationDelay()` accounts for this in the orchestrator.

### Bot Behavior

When a player is a bot:

- Frontend detects bot status from `gameState.seats[seat].player.is_bot`
- Bots automatically select 3 random non-Joker tiles
- Add realistic delay (500-1500ms) before sending `PassTiles` command
- Show message to human players: "PlayerName (Bot) has passed tiles"
- Progress indicator updates with bot's ready status

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
  // Track newly received tiles for highlighting
  state.newlyReceivedTiles = event.tiles;
  break;

case 'CharlestonPhaseChanged':
  state.phase = { Charleston: event.stage };
  // Clear newly received tiles highlight after phase change
  state.newlyReceivedTiles = [];
  break;
```text

### Testing with Mock WebSocket

For integration tests, simulate the event sequence:

```typescript
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonPhaseChanged: { stage: 'FirstAcross' } } });
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonTimerStarted: { ... } } });

// User selects tiles and passes...

mockWs.simulateEvent({ kind: 'Private', event: { TilesPassed: { ... } } });
mockWs.simulateEvent({ kind: 'Public', event: { PlayerReadyForPass: { player: 'South' } } });
// ... repeat for all players
mockWs.simulateEvent({ kind: 'Public', event: { TilesPassing: { direction: 'Across' } } });
mockWs.simulateEvent({ kind: 'Private', event: { TilesReceived: { from: Some('North'), ... } } });
mockWs.simulateEvent({ kind: 'Public', event: { CharlestonPhaseChanged: { stage: 'FirstLeft' } } });
```text

See `tests/test-scenarios/charleston-first-across.md` for full test script.

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Skip all 300ms and 600ms animations
- Tiles instantly disappear from hand
- Tiles instantly appear in hand
- Auto-sort happens immediately
- Sound effects still play (unless also disabled)
- Timer still counts down normally

Check `useAnimationSettings()` hook to determine animation mode.
````
