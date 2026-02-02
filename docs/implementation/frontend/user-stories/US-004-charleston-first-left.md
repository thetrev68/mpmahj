# US-004: Charleston First Left (Blind Pass)

## Story

**As a** player in any seat
**I want** to select tiles from my hand AND/OR blindly pass incoming tiles to the player on my left
**So that** I can complete the first Charleston sequence with optional blind pass/steal strategy

## Acceptance Criteria

### AC-1: Charleston Phase Entry

**Given** the First Across pass has completed and all players received tiles
**When** the server emits `CharlestonPhaseChanged { stage: FirstLeft }`
**Then** the Charleston tracker displays "Pass Left ← (Blind Pass Available)" with a left arrow
**And** a timer starts (default: 60 seconds)
**And** my hand becomes interactive for tile selection
**And** the action bar shows a "Pass Tiles" button (disabled initially)
**And** a new UI element appears: "Blind Pass Options" panel
**And** the selection counter shows "0/3 selected"

### AC-2: Standard Tile Selection (From Hand)

**Given** I am in the `Charleston(FirstLeft)` stage
**When** I click on a tile in my hand
**Then** the tile is visually highlighted (raised 10px, yellow border)
**And** the selection counter updates (e.g., "1/3 selected")
**And** the "Pass Tiles" button remains disabled until 3 total selected

### AC-3: Blind Pass Option Selection

**Given** I am in the `Charleston(FirstLeft)` stage
**And** I have not yet passed my tiles
**When** I click on the "Blind Pass" button in the options panel
**Then** a slider appears allowing me to select 1-3 tiles for blind pass
**And** the slider shows: "Pass 0 tiles blindly" (default)
**And** I can drag to select 1, 2, or 3 blind tiles

**When** I select 2 blind pass tiles
**Then** the blind pass counter shows "2 blind"
**And** the selection counter shows "0/1 selected" (need 1 more from hand)
**And** the "Pass Tiles" button remains disabled

### AC-4: Mixed Selection (Blind + Hand)

**Given** I have selected 2 tiles for blind pass
**When** I select 1 tile from my hand
**Then** the selection counter shows "1/1 selected"
**And** the blind pass counter shows "2 blind"
**And** the total counter shows "3/3 total (2 blind + 1 hand)"
**And** the "Pass Tiles" button becomes enabled

### AC-5: Full Blind Pass (3 Tiles)

**Given** I am in the `Charleston(FirstLeft)` stage
**When** I drag the blind pass slider to 3
**Then** the blind pass counter shows "3 blind"
**And** the selection counter shows "0/0 selected" (no hand tiles needed)
**And** the total counter shows "3/3 total (all blind)"
**And** the "Pass Tiles" button becomes enabled
**And** a warning appears: "If all 4 players blind pass 3 tiles, IOU will trigger"

### AC-6: Joker Lock Validation (Hand Selection Only)

**Given** I am selecting tiles from my hand
**When** I click on a Joker tile in my hand
**Then** the Joker is NOT selected
**And** a tooltip appears: "Jokers cannot be passed"
**And** the Joker tile has a visual indicator (red tint, diagonal strike-through)

**Note:** Blind pass tiles are not validated (they haven't been received yet), so Jokers could theoretically be passed blindly if received from FirstAcross.

### AC-7: Pass Submission (Mixed)

**Given** I have selected 2 tiles from hand and 1 blind pass
**When** I click the "Pass Tiles" button
**Then** a `PassTiles` command is sent with `tiles: [tile1, tile2], blind_pass_count: 1`
**And** the button shows a loading state (spinner, disabled)
**And** my hand becomes non-interactive
**And** a message appears: "Waiting for other players..."

### AC-8: Pass Submission (Full Blind)

**Given** I have selected 3 blind pass tiles
**When** I click the "Pass Tiles" button
**Then** a `PassTiles` command is sent with `tiles: [], blind_pass_count: 3`
**And** the button shows a loading state
**And** my hand becomes non-interactive
**And** a message appears: "Waiting for other players..."

### AC-9: Server Acknowledgment (Standard Blind Pass)

**Given** I submitted my tiles to pass (not full 3 blind)
**When** the server emits `TilesPassed { player: me, tiles: [...] }`
**Then** the selected tiles from my hand slide out with animation (0.3s)
**And** my tile count temporarily decreases
**And** a checkmark appears next to my name in the player list

**When** the server emits `BlindPassPerformed { player: me, blind_count: N, hand_count: M }`
**Then** a message appears: "You passed N tiles blindly and M from hand"
**And** all players see this public event

### AC-10: Server Acknowledgment (Full Blind - Potential IOU)

**Given** I submitted 3 blind pass tiles
**When** ALL 4 players also submitted 3 blind pass tiles
**Then** the server emits `IOUDetected { debts: [...] }`
**And** a special UI overlay appears: "IOU Scenario Detected!"
**And** the Charleston flow pauses for IOU resolution
**And** the message explains: "All players attempted full blind pass. IOU resolution starting..."

**When** the server emits `IOUResolved { summary: "..." }`
**Then** the IOU overlay dismisses
**And** the Charleston continues normally

### AC-11: Tiles Exchange (Normal Flow)

**Given** all 4 players have passed their tiles (not all 3 blind)
**When** the server emits `TilesPassing { direction: Left }`
**Then** a brief animation shows tiles moving left between players (0.6s with left arrows)

**When** the server emits `TilesReceived { player: me, tiles: [...], from: East }`
**Then** 3 new tiles slide into my hand from the right (0.3s)
**And** my hand auto-sorts by suit and rank
**And** my tile count returns to 13
**And** the newly received tiles have a brief highlight (2s pulsing border)

### AC-12: Phase Advancement (To Voting)

**Given** all players have received their tiles and IOU is resolved (if triggered)
**When** the server emits `CharlestonPhaseChanged { stage: VotingToContinue }`
**Then** the Charleston tracker updates to "Vote: Stop or Continue?"
**And** a voting UI appears with "Stop" and "Continue" buttons
**And** the timer resets for voting (default: 30 seconds)

### AC-13: Bot Auto-Pass (Mixed Strategy)

**Given** the game is in `Charleston(FirstLeft)` stage
**And** one or more players are bots
**When** the phase begins
**Then** bots decide on a strategy (random: 0-3 blind, remainder from hand)
**And** bots send `PassTiles` commands after a delay (0.5-1.5 seconds)
**And** human players see "PlayerName (Bot) has passed tiles (X blind)" message

## Technical Details

### Commands (Frontend → Backend)

```typescript
// Mixed: 1 from hand, 2 blind
{
  PassTiles: {
    player: Seat,
    tiles: [Tile],                  // Tiles from hand
    blind_pass_count: 2             // Tiles to pass blindly from incoming
  }
}

// Full blind: all 3 incoming
{
  PassTiles: {
    player: Seat,
    tiles: [],                      // No tiles from hand
    blind_pass_count: 3             // All 3 tiles blindly passed
  }
}

// Standard: all 3 from hand
{
  PassTiles: {
    player: Seat,
    tiles: [Tile, Tile, Tile],      // All 3 from hand
    blind_pass_count: 0             // No blind pass
  }
}
```

### Events (Backend → Frontend)

**Private Events:**

```typescript
{
  kind: 'Private',
  event: {
    TilesPassed: {
      player: Seat,
      tiles: [Tile]  // Only tiles from hand (blind tiles not included here)
    }
  }
}

{
  kind: 'Private',
  event: {
    TilesReceived: {
      player: Seat,
      tiles: [Tile, Tile, Tile],
      from: Some(Seat.East)  // Right player
    }
  }
}
```

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "FirstLeft" }
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonTimerStarted: {
      stage: "FirstLeft",
      duration: 60,
      started_at_ms: 1706634120000,
      timer_mode: "Standard"
    }
  }
}

{
  kind: 'Public',
  event: {
    BlindPassPerformed: {
      player: Seat,
      blind_count: 2,  // Number of tiles blindly passed
      hand_count: 1    // Number from hand
    }
  }
}

{
  kind: 'Public',
  event: {
    IOUDetected: {
      debts: [
        [Seat.East, 3],
        [Seat.South, 3],
        [Seat.West, 3],
        [Seat.North, 3]
      ]
    }
  }
}

{
  kind: 'Public',
  event: {
    IOUResolved: {
      summary: "IOU resolved - all players passed 2 tiles, East picked up final pass"
    }
  }
}

{
  kind: 'Public',
  event: {
    TilesPassing: {
      direction: "Left"
    }
  }
}

{
  kind: 'Public',
  event: {
    CharlestonPhaseChanged: {
      stage: { Charleston: "VotingToContinue" }
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `PassTiles` command with `blind_pass_count`
  - `crates/mahjong_core/src/flow/charleston/mod.rs` - Charleston state machine
  - `crates/mahjong_core/src/flow/charleston/stage.rs` - FirstLeft stage with blind pass logic
  - `crates/mahjong_core/src/event/public_events.rs` - `BlindPassPerformed`, `IOUDetected`, `IOUResolved`
- **Game Design Doc**:
  - Section 2.2.4 (Pass 3: First Left - Blind Pass)
  - Section 2.2.5 (IOU Scenario)
  - Section 2.2.1 (Global Charleston Constraints)

## Components Involved

- **`<CharlestonTracker>`** - Displays "FirstLeft" stage with left arrow and blind pass indicator
- **`<CharlestonTimer>`** - Countdown timer (60s)
- **`<BlindPassPanel>`** - New component: slider for selecting blind pass count (0-3)
- **`<TileSelectionPanel>`** - Handles tile selection from hand (3 - blind_count tiles)
- **`<ConcealedHand>`** - Displays user's hand with selection state
- **`<ActionBar>`** - Contains "Pass Tiles" button
- **`<PassAnimationLayer>`** - Animates tile movement during pass (left direction)
- **`<IOUOverlay>`** - Special overlay for IOU scenario detection and resolution
- **`<PlayerStatusIndicator>`** - Shows checkmarks and blind pass counts for ready players

**Component Specs:**

- `component-specs/presentational/CharlestonTracker.md`
- `component-specs/presentational/BlindPassPanel.md` (NEW)
- `component-specs/presentational/IOUOverlay.md` (NEW)
- `component-specs/container/TileSelectionPanel.md`
- `component-specs/container/ConcealedHand.md`
- `component-specs/integration/CharlestonFlow.md`

## Test Scenarios

- **`tests/test-scenarios/charleston-first-left-standard.md`** - Standard pass (all from hand)
- **`tests/test-scenarios/charleston-first-left-mixed.md`** - Mixed blind + hand pass
- **`tests/test-scenarios/charleston-first-left-full-blind.md`** - Full 3 blind (no IOU)
- **`tests/test-scenarios/charleston-iou-scenario.md`** - All players full blind → IOU detection
- **`tests/test-scenarios/charleston-blind-pass-validation.md`** - Edge cases and validation

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/charleston-first-left.json` - Initial state
- `tests/fixtures/game-states/charleston-iou-detected.json` - IOU scenario state
- `tests/fixtures/hands/charleston-hand-after-first-across.json` - Hand before FirstLeft
- `tests/fixtures/events/charleston-first-left-standard.json` - Standard pass event flow
- `tests/fixtures/events/charleston-first-left-iou.json` - IOU scenario event flow

**Sample Blind Pass Event:**

```json
{
  "scenario": "Mixed Blind Pass (1 hand, 2 blind)",
  "events": [
    {
      "kind": "Public",
      "event": { "CharlestonPhaseChanged": { "stage": "FirstLeft" } }
    },
    {
      "kind": "Private",
      "event": { "TilesPassed": { "player": "South", "tiles": ["Bam3"] } }
    },
    {
      "kind": "Public",
      "event": { "BlindPassPerformed": { "player": "South", "blind_count": 2, "hand_count": 1 } }
    },
    {
      "kind": "Public",
      "event": { "TilesPassing": { "direction": "Left" } }
    },
    {
      "kind": "Private",
      "event": {
        "TilesReceived": { "player": "South", "tiles": ["Crak5", "Dot7", "Wind3"], "from": "East" }
      }
    }
  ]
}
```

## Edge Cases

### EC-1: Timer Expiry (Auto-Select Strategy)

**Given** the timer reaches 0 and I haven't passed tiles
**When** timeout occurs
**Then** the system auto-selects 0 blind pass and 3 tiles from hand (first 3 non-Joker)
**And** a `PassTiles` command is sent with those tiles
**And** I see a message: "Time expired - auto-passing 3 tiles from hand"

### EC-2: IOU Detection (All 4 Players Full Blind)

**Given** all 4 players select 3 blind pass
**When** all players submit their passes
**Then** the server emits `IOUDetected { debts: [...] }`
**And** the IOU overlay appears with explanation
**And** the server automatically resolves IOU per NMJL rules
**And** the server emits `IOUResolved { summary: "..." }`
**And** the Charleston continues to voting

### EC-3: Invalid Blind Pass Count

**Given** I select 4 blind pass tiles (impossible via UI but could be hacked)
**When** I submit the command
**Then** the server rejects with error: "Blind pass count must be 0-3"
**And** the frontend resets the selection
**And** an error message appears

### EC-4: Joker in Blind Pass (Allowed but Discouraged)

**Given** I select 3 blind pass tiles
**When** one of the incoming tiles from FirstAcross is a Joker
**Then** the Joker is blindly passed to the left (allowed by rules)
**And** I receive confirmation that 3 tiles were passed
**Note:** This is technically allowed because I haven't seen the tile yet.

### EC-5: Disconnection During Selection

**Given** I have selected 1 tile from hand and 2 blind
**When** I disconnect from the server
**And** reconnect within the timer window
**Then** my selection state is NOT preserved (resets to 0)
**And** I must re-select tiles
**And** the timer continues from server time

### EC-6: Double-Submit Prevention

**Given** I click "Pass Tiles" with valid selection
**When** I rapidly click the button again before server responds
**Then** only ONE `PassTiles` command is sent
**And** the button is disabled after first click

### EC-7: Network Error on Pass

**Given** I submit tiles but network fails
**When** no `TilesPassed` acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to pass tiles. Retrying..."
**And** the command is automatically retried (max 3 attempts)
**And** if all retries fail, show "Connection lost" with manual retry button

## Related User Stories

- **US-003**: Charleston First Across - Previous stage
- **US-005**: Charleston Voting (Stop/Continue) - Next stage
- **US-008**: Charleston IOU Detection (Edge Case) - Detailed IOU flow
- **US-036**: Timer Configuration - Adjust default 60s timer
- **US-035**: Animation Settings - Fast mode, skip animations

## Accessibility Considerations

### Keyboard Navigation

- **Arrow Keys**: Navigate between tiles in hand
- **Space/Enter**: Toggle selection of focused tile
- **B Key**: Focus blind pass slider
- **+/- Keys**: Increment/decrement blind pass count (when slider focused)
- **P Key**: Submit pass (when valid selection)
- **Escape**: Deselect all tiles and reset blind pass to 0

### Screen Reader

- **Selection**: "Tile selected: 7 Crack. 1 of 1 from hand selected. 2 blind pass tiles. Total: 3 of 3."
- **Blind Pass**: "Blind pass slider: 2 tiles. Use arrow keys to adjust."
- **Joker Block**: "Joker cannot be passed during Charleston."
- **Pass**: "Passing 1 tile from hand and 2 tiles blindly to player on your left."
- **Received**: "Received 3 tiles from player on your right."
- **IOU**: "IOU scenario detected. All players attempted full blind pass. IOU resolution in progress."

### Visual

- **High Contrast**: Selected tiles and blind pass slider have high-contrast borders
- **Color-Blind**: Use patterns in addition to color for selection state
- **Motion**: Respect `prefers-reduced-motion` for pass animations and IOU overlay
- **Blind Pass Indicator**: Clear visual distinction between hand tiles and blind count

## Priority

**CRITICAL** - Core Charleston mechanic with unique blind pass feature

## Story Points / Complexity

**13** - Very High complexity

- Introduces new blind pass UI element (slider)
- Requires mixed selection logic (hand + blind)
- IOU detection and resolution flow
- Multiple event types (`BlindPassPerformed`, `IOUDetected`, `IOUResolved`)
- Complex validation (tiles.len() + blind_pass_count == 3)
- Left direction animation
- Bot strategy for blind pass decisions
- Significantly more complex than FirstRight and FirstAcross

## Definition of Done

- [ ] Charleston tracker shows "FirstLeft" stage with ← arrow and blind pass indicator
- [ ] Timer starts at 60 seconds and counts down
- [ ] Blind pass panel appears with slider (0-3 tiles)
- [ ] User can select mixed combination: hand tiles + blind pass (total 3)
- [ ] User can select all 3 blind pass (no hand tiles)
- [ ] User can select 0 blind pass (all 3 from hand)
- [ ] Selection counter shows correct breakdown (e.g., "1 hand + 2 blind = 3 total")
- [ ] Jokers blocked from hand selection (but not blind)
- [ ] "Pass Tiles" button enabled only when total = 3
- [ ] `PassTiles` command sent with correct tiles array and blind_pass_count
- [ ] Selected hand tiles animate out on `TilesPassed` event
- [ ] `BlindPassPerformed` event displays public message with counts
- [ ] IOU detection triggers overlay when all 4 players blind pass 3
- [ ] IOU resolution displays summary and dismisses overlay
- [ ] Pass animation plays with left arrows on `TilesPassing` event
- [ ] Received tiles animate into hand from right player on `TilesReceived` event
- [ ] Hand auto-sorts after receiving new tiles
- [ ] Phase advances to "VotingToContinue" after all exchanges complete
- [ ] Bot auto-pass behavior works with random blind pass strategy
- [ ] Component tests pass (BlindPassPanel, TileSelectionPanel, IOUOverlay)
- [ ] Integration tests pass (standard, mixed, full blind flows)
- [ ] E2E test passes (4-player Charleston with IOU scenario)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Visual regression tests pass (blind pass slider, IOU overlay)
- [ ] Timer expiry behavior tested (auto-pass strategy)
- [ ] Network error handling tested (retry logic)
- [ ] IOU scenario tested (all 4 players full blind)
- [ ] Manually tested against `user-testing-plan.md` (Part 3, Charleston scenarios)
- [ ] Code reviewed and approved
- [ ] Performance tested (no lag during animations or IOU resolution)
- [ ] No console errors or warnings

## Notes for Implementers

### Blind Pass Validation

The backend validates: `tiles.len() + blind_pass_count == 3`

Examples:

- `tiles: [A, B, C], blind_pass_count: 0` ✓ (3 + 0 = 3)
- `tiles: [A], blind_pass_count: 2` ✓ (1 + 2 = 3)
- `tiles: [], blind_pass_count: 3` ✓ (0 + 3 = 3)
- `tiles: [A, B], blind_pass_count: 2` ✗ (2 + 2 = 4, invalid)

### Blind Pass UI Component

```typescript
<BlindPassPanel
  maxBlind={3}
  onBlindCountChange={(count: number) => setBlindCount(count)}
  handSelectionCount={selectedFromHand.length}
  totalRequired={3}
/>
```

The slider should:

- Show values 0-3
- Update in real-time
- Display warning when count = 3 ("Potential IOU if all players blind pass 3")
- Be disabled after submission

### Selection Counter Logic

```typescript
const handCount = selectedFromHand.length;
const blindCount = blindPassCount;
const total = handCount + blindCount;
const isValid = total === 3;

const counterText =
  blindCount > 0
    ? `${handCount} hand + ${blindCount} blind = ${total} total`
    : `${handCount}/3 selected`;
```

### IOU Overlay

When `IOUDetected` event is received:

```typescript
<IOUOverlay
  debts={event.debts}
  onResolved={() => {
    // IOUResolved event will trigger dismissal
    setShowIOUOverlay(false);
  }}
/>
```

Display:

- Title: "IOU Scenario Detected!"
- Explanation: "All 4 players attempted to blind pass 3 tiles. Per NMJL rules, IOU resolution is triggered."
- Loading spinner: "Resolving IOU..."
- When `IOUResolved` received: Show summary and auto-dismiss after 3 seconds

### Animation Direction (Left)

Tiles move from right to left:

```typescript
function getLeftPassAnimation(fromSeat: Seat, toSeat: Seat) {
  // East → South, South → West, West → North, North → East
  const direction = 'left';
  return {
    startPosition: getPlayerPosition(fromSeat),
    endPosition: getPlayerPosition(toSeat),
    path: 'horizontal-left', // or 'curve-left' for visual appeal
  };
}
```

### Bot Blind Pass Strategy

Bots should use varied strategies for realism:

```typescript
function getBotBlindPassStrategy(difficulty: BotDifficulty): number {
  switch (difficulty) {
    case 'Basic':
      return 0; // Never blind pass
    case 'Easy':
      return Math.random() < 0.2 ? randomInt(1, 2) : 0; // 20% chance, 1-2 blind
    case 'Medium':
      return Math.random() < 0.4 ? randomInt(1, 3) : 0; // 40% chance, 1-3 blind
    case 'Hard':
      // Strategic decision based on hand analysis
      return calculateOptimalBlindCount(hand);
  }
}
```

### Event Sequencing

FirstLeft pass sequence:

1. `CharlestonPhaseChanged { stage: FirstLeft }`
2. User selects tiles + blind count
3. `PassTiles { tiles: [...], blind_pass_count: N }`
4. `TilesPassed { tiles: [...] }` (private, only hand tiles)
5. `BlindPassPerformed { player, blind_count, hand_count }` (public)
6. `PlayerReadyForPass { player }` (public)
7. (If IOU) `IOUDetected { debts }` → `IOUResolved { summary }`
8. `TilesPassing { direction: Left }`
9. `TilesReceived { tiles, from }` (private)
10. `CharlestonPhaseChanged { stage: VotingToContinue }`

### IOU Resolution (Server-Side)

The backend automatically resolves IOU per NMJL rules:

- Each player passes 1-2 tiles (not 3)
- First player (East) picks up the final pass to "make good" on the debt
- Frontend only displays the outcome, does not implement resolution logic

### Zustand Store Updates

```typescript
case 'BlindPassPerformed':
  // Update player status to show blind pass count
  state.playerStatuses[event.player].blindPassCount = event.blind_count;
  state.playerStatuses[event.player].handPassCount = event.hand_count;
  break;

case 'IOUDetected':
  state.iouScenario = {
    active: true,
    debts: event.debts
  };
  break;

case 'IOUResolved':
  state.iouScenario = {
    active: false,
    debts: [],
    summary: event.summary
  };
  break;
```

### Testing IOU Scenario

Mock all 4 players submitting 3 blind pass:

```typescript
// All players submit full blind
mockWs.sendCommand({ PassTiles: { player: 'East', tiles: [], blind_pass_count: 3 } });
mockWs.sendCommand({ PassTiles: { player: 'South', tiles: [], blind_pass_count: 3 } });
mockWs.sendCommand({ PassTiles: { player: 'West', tiles: [], blind_pass_count: 3 } });
mockWs.sendCommand({ PassTiles: { player: 'North', tiles: [], blind_pass_count: 3 } });

// Server detects IOU
mockWs.simulateEvent({ kind: 'Public', event: { IOUDetected: { debts: [...] } } });

// Server resolves IOU
mockWs.simulateEvent({ kind: 'Public', event: { IOUResolved: { summary: "..." } } });

// Normal flow continues
mockWs.simulateEvent({ kind: 'Public', event: { TilesPassing: { direction: 'Left' } } });
// ...
```

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Skip blind pass slider animation
- Tiles instantly disappear/appear
- IOU overlay appears/dismisses instantly (no fade)
- Sound effects still play

```text

```

```text

```
