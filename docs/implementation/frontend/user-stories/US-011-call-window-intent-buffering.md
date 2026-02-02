# US-011: Call Window & Intent Buffering

## Story

**As a** player who can call a discarded tile
**I want** to declare my intent (Pung/Kong/Quint/Mahjong) during the call window
**So that** the system can resolve conflicts and award the tile to the highest priority caller

## Acceptance Criteria

### AC-1: Call Window Opens

**Given** a player discarded a callable tile
**When** the server emits `CallWindowOpened { tile: Dot5, discarded_by: East, can_call: [South, West], timer: 10, ... }`
**And** I am in the `can_call` list
**Then** a call window panel appears with options: "Call for Pung", "Call for Kong", "Call for Mahjong", "Pass"
**And** a 10-second timer starts
**And** a message displays: "East discarded 5 Dots. Call or Pass?"
**And** the discard pool highlights the callable tile

### AC-2: Declare Call Intent (Pung)

**Given** the call window is open
**When** I click "Call for Pung"
**Then** a `DeclareCallIntent { player: me, intent: Meld }` command is sent
**And** all call buttons become disabled
**And** a message appears: "Declared intent to call for Pung. Waiting for others..."
**And** a checkmark appears next to my name

### AC-3: Declare Call Intent (Mahjong - Highest Priority)

**Given** the call window is open
**When** I click "Call for Mahjong"
**Then** a `DeclareCallIntent { player: me, intent: Mahjong }` command is sent
**And** all call buttons become disabled
**And** a message appears: "Declared Mahjong! Waiting for validation..."
**Note:** Mahjong has highest priority and will win over any meld calls

### AC-4: Pass on Call

**Given** the call window is open
**When** I click "Pass"
**Then** a `Pass { player: me }` command is sent
**And** the call window panel dismisses
**And** a message appears: "Passed on 5 Dots"

### AC-5: Intent Buffering (Multiple Players Declare)

**Given** both South (me) and West declared call intent
**When** all eligible players have responded (called or passed)
**Then** the server buffers all intents and resolves priority
**And** the call window remains open until all players respond or timer expires

### AC-6: Call Resolution (Mahjong Wins)

**Given** South declared Mahjong and West declared Pung
**When** the server emits `CallResolved { resolution: { winner: South, intent: Mahjong, ... } }`
**Then** a message appears: "South wins call for Mahjong"
**And** the call window closes
**And** the server emits `AwaitingMahjongValidation { caller: South, called_tile: Dot5, discarded_by: East }`
**And** South must now validate their winning hand (see US-019)

### AC-7: Call Resolution (Closest Player Wins on Tie)

**Given** both South and West declared Pung
**When** the server emits `CallResolved { resolution: { winner: West, intent: Meld, ... } }`
**Then** a message appears: "West wins call for Pung (closer to discarder)"
**And** the call window closes
**And** the server emits `TileCalled { player: West, meld: Pung(...), called_tile: Dot5 }`
**And** West's turn begins

### AC-8: Call Window Timeout (All Pass)

**Given** the call window timer reaches 0
**When** no one declared call intent (or all passed)
**Then** the server emits `CallWindowClosed`
**And** the server emits `TurnChanged { player: next_player, stage: Drawing }`
**And** the turn advances clockwise

### AC-9: Auto-Pass on Timeout

**Given** the call window timer reaches 0 and I haven't responded
**When** timeout occurs
**Then** an automatic `Pass` command is sent on my behalf
**And** a message appears: "Time expired - auto-passed"

### AC-10: Call Window Not Shown (If Not Eligible)

**Given** a tile is discarded but I cannot call it
**When** the server emits `CallWindowOpened` with `can_call` not including me
**Then** no call window panel appears for me
**And** I see a message: "[Player] can call [Tile]"
**And** I wait for call window to resolve

### AC-11: Bot Auto-Call Behavior

**Given** a bot is in the `can_call` list
**When** the call window opens
**Then** the bot evaluates whether to call based on strategy
**And** the bot sends `DeclareCallIntent` or `Pass` after a delay (0.3-1.0s)
**And** bot strategy:

- **Basic**: Rarely calls (10% chance), prioritizes safe hands
- **Easy**: Calls if it helps (30% chance)
- **Medium**: Calls if deficiency improves
- **Hard**: Strategic analysis (expected value, pattern viability, opponent analysis)

## Technical Details

### Commands (Frontend → Backend)

```typescript
// Declare call intent
{
  DeclareCallIntent: {
    player: Seat,
    intent: "Meld"  // or "Mahjong"
  }
}

// Pass on call
{
  Pass: {
    player: Seat
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CallWindowOpened: {
      tile: Tile,
      discarded_by: Seat,
      can_call: [Seat],  // Eligible callers
      timer: 10,
      started_at_ms: 1706634360000,
      timer_mode: "Standard"
    }
  }
}

{
  kind: 'Public',
  event: {
    CallResolved: {
      resolution: {
        winner: Seat,
        intent: "Mahjong",  // or "Meld"
        tile: Tile
      }
    }
  }
}

{
  kind: 'Public',
  event: {
    CallWindowClosed: {}
  }
}

// If Mahjong call
{
  kind: 'Public',
  event: {
    AwaitingMahjongValidation: {
      caller: Seat,
      called_tile: Tile,
      discarded_by: Seat
    }
  }
}

// If Meld call
{
  kind: 'Public',
  event: {
    TileCalled: {
      player: Seat,
      meld: Meld,  // Pung/Kong/Quint
      called_tile: Tile
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `DeclareCallIntent`, `Pass`
  - `crates/mahjong_core/src/call_resolution.rs` - Priority resolution logic
  - `crates/mahjong_core/src/flow/playing.rs` - Call window stage
  - `crates/mahjong_core/src/event/public_events.rs` - `CallWindowOpened`, `CallResolved`
- **Game Design Doc**:
  - Section 3.2 (Call Window Mechanics)
  - Section 3.2.2 (Intent Buffering and Priority Resolution)

## Components Involved

- **`<CallWindowPanel>`** - New component: call buttons and timer
- **`<CallIntentIndicator>`** - Shows who has declared intent
- **`<DiscardPool>`** - Highlights callable tile
- **`<CallTimer>`** - 10-second countdown
- **`useSoundEffects()`** - Call window sound

**Component Specs:**

- `component-specs/presentational/CallWindowPanel.md` (NEW)
- `component-specs/presentational/CallIntentIndicator.md` (NEW)
- `component-specs/presentational/CallTimer.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/call-window-single-caller.md`** - One player calls
- **`tests/test-scenarios/call-window-mahjong-priority.md`** - Mahjong beats meld
- **`tests/test-scenarios/call-window-tie-closest.md`** - Two melds, closest wins
- **`tests/test-scenarios/call-window-all-pass.md`** - All pass, turn advances
- **`tests/test-scenarios/call-window-timeout.md`** - Timer expires, auto-pass

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/call-window-open.json`
- `tests/fixtures/events/call-window-sequence.json`

## Edge Cases

### EC-1: Mahjong Priority

Mahjong always wins, regardless of seat proximity.

### EC-2: Meld Tie (Closest Wins)

If multiple players call for meld, closest player (in turn order) wins.

### EC-3: Timer Expiry (Auto-Pass)

If timer expires without response, auto-pass is sent.

### EC-4: Cannot Call Own Discard

The player who discarded cannot call their own tile.

### EC-5: Network Error

If network fails during call, retry logic applies.

## Related User Stories

- **US-010**: Discarding a Tile - Previous stage
- **US-012**: Call Priority Resolution - Details on priority logic
- **US-013**: Calling Pung/Kong/Quint - Meld call outcome
- **US-019**: Declaring Mahjong (Called Discard) - Mahjong call outcome

## Accessibility Considerations

### Keyboard Navigation

- **M Key**: Call for Mahjong
- **K Key**: Call for Kong
- **P Key**: Call for Pung
- **X Key**: Pass
- **Tab**: Navigate between call buttons

### Screen Reader

- **Window Open**: "Call window open. East discarded 5 Dots. You can call for Pung, Kong, or Mahjong. 10 seconds remaining."
- **Intent Declared**: "Declared intent to call for Pung. Waiting for other players."
- **Resolution**: "Call resolved. South wins for Mahjong."

### Visual

- **High Contrast**: Call buttons have distinct colors (Mahjong: red, Meld: blue, Pass: gray)
- **Timer**: Visual countdown bar (10s)
- **Motion**: Respect `prefers-reduced-motion`

## Priority

**CRITICAL** - Core calling mechanic

## Story Points / Complexity

**8** - High complexity

- Call window UI with multiple buttons
- Intent buffering logic (frontend tracks who responded)
- Priority resolution display
- Timer synchronization
- Bot auto-call strategy
- Multiple event types and outcomes

## Definition of Done

- [ ] Call window panel appears when `CallWindowOpened` received and I'm eligible
- [ ] Buttons: Call for Pung/Kong/Mahjong, Pass
- [ ] Timer counts down from 10 seconds
- [ ] Click button sends `DeclareCallIntent` or `Pass` command
- [ ] All buttons disabled after response
- [ ] Intent indicator shows who has responded
- [ ] `CallResolved` event displays winner and intent
- [ ] Call window closes after resolution
- [ ] Mahjong priority works (beats any meld)
- [ ] Closest player wins on meld tie
- [ ] Auto-pass on timer expiry
- [ ] Bot auto-call behavior works
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E test passes
- [ ] Accessibility tests pass
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Call Window Panel Component

```typescript
<CallWindowPanel
  callableTile={tile}
  discardedBy={seat}
  canCallForPung={canFormPung}
  canCallForKong={canFormKong}
  canCallForMahjong={true}  // Always an option
  onCallIntent={(intent: CallIntent) => {
    sendCommand({ DeclareCallIntent: { player: mySeat, intent } });
  }}
  onPass={() => {
    sendCommand({ Pass: { player: mySeat } });
  }}
  timerRemaining={timerRemaining}
/>
```

### Priority Logic (Server-Side)

Frontend does not implement this, but for reference:

1. **Mahjong** > **Meld** (Pung/Kong/Quint)
2. If multiple Mahjong calls: closest player wins
3. If multiple Meld calls: closest player wins

Closest = next in turn order from discarder (clockwise).

### Timer Synchronization

```typescript
const timerRemaining = useMemo(() => {
  if (!callWindowStart) return 0;
  const serverTime = Date.now(); // Adjust for server time offset
  const elapsed = (serverTime - callWindowStart) / 1000;
  return Math.max(0, 10 - elapsed); // 10-second window
}, [callWindowStart]);

useEffect(() => {
  if (timerRemaining === 0 && !hasResponded) {
    sendCommand({ Pass: { player: mySeat } });
    setHasResponded(true);
  }
}, [timerRemaining, hasResponded]);
```

### Bot Auto-Call Strategy

```typescript
function getBotCallDecision(
  hand: Tile[],
  callableTile: Tile,
  difficulty: BotDifficulty
): 'Mahjong' | 'Meld' | 'Pass' {
  // Check if calling for Mahjong
  if (canWinWithTile(hand, callableTile)) {
    return 'Mahjong';
  }

  // Check if calling for Meld improves hand
  if (canFormMeld(hand, callableTile)) {
    switch (difficulty) {
      case 'Basic':
        return Math.random() < 0.1 ? 'Meld' : 'Pass';
      case 'Easy':
        return Math.random() < 0.3 ? 'Meld' : 'Pass';
      case 'Medium':
        return deficiencyImproves(hand, callableTile) ? 'Meld' : 'Pass';
      case 'Hard':
        return evaluateCallEV(hand, callableTile) > 0 ? 'Meld' : 'Pass';
    }
  }

  return 'Pass';
}
```

### Zustand Store Updates

```typescript
case 'CallWindowOpened':
  state.callWindow = {
    active: true,
    tile: event.tile,
    discardedBy: event.discarded_by,
    canCall: event.can_call,
    timerStart: event.started_at_ms,
    timerDuration: event.timer,
    responses: {}
  };
  break;

case 'CallResolved':
  state.callWindow.active = false;
  state.callWindow.resolution = event.resolution;
  break;

case 'CallWindowClosed':
  state.callWindow = { active: false };
  break;
```

### Instant Animation Mode

- Call window appears instantly (no fade-in)
- Timer still counts down
- Resolution overlay appears/dismisses instantly

```text

```

```text

```
