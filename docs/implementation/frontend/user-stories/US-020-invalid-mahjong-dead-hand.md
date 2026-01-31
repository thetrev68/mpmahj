# US-020: Invalid Mahjong → Dead Hand

## Story

**As a** player who incorrectly declared Mahjong
**I want** to understand the penalties for false Mahjong claims
**So that** I know the consequences and can continue playing (without ability to win)

## Acceptance Criteria

### AC-1: Invalid Mahjong Detection

**Given** I declared Mahjong (self-draw or called)
**When** the server validates my hand
**And** my hand does NOT match any NMJL pattern
**Then** the server emits `HandValidated { player: me, valid: false, pattern: null }`
**And** the validation fails

### AC-2: Dead Hand Penalty Applied

**Given** my Mahjong validation failed
**When** the server emits `HandDeclaredDead { player: me, reason: "Invalid Mahjong claim" }`
**Then** a penalty overlay appears: "DEAD HAND - Invalid Mahjong Claim"
**And** my hand is revealed to all players (public penalty)
**And** a red "DEAD HAND" badge appears next to my name permanently for this game
**And** a penalty sound effect plays (low, somber tone)

### AC-3: Dead Hand Restrictions

**Given** my hand is declared dead
**When** the game continues
**Then** I cannot declare Mahjong for the rest of the game (no win condition)
**And** I cannot call discards for Pung/Kong/Quint (no calling allowed)
**And** I can still draw and discard tiles on my turn (must participate)
**And** my turn indicator shows "Dead Hand" status
**And** a message displays: "You have a dead hand. Continue discarding but cannot win."

### AC-4: Dead Hand Player Turn Behavior

**Given** I have a dead hand
**When** it is my turn
**Then** I draw a tile normally
**And** I must discard a tile (cannot skip turn)
**And** no "Declare Mahjong" button appears even if I would have a valid hand
**And** my discards are visible to other players (they can call them)

### AC-5: Other Players See Dead Hand

**Given** I have a dead hand
**When** other players view the game state
**Then** my seat shows a "DEAD HAND" badge
**And** my hand is visible (face-up) to all players (penalty for false claim)
**And** a message in the game log: "[My Name]'s hand declared dead - Invalid Mahjong claim"

### AC-6: Multiple Dead Hands

**Given** multiple players have declared dead hands
**When** the game continues
**Then** all dead hand players continue drawing and discarding
**And** remaining players can still call and win
**And** if all 4 players have dead hands, the game ends in a draw (see US-021)

### AC-7: Dead Hand After Self-Draw Mahjong

**Given** I declared Mahjong after drawing a tile
**When** validation fails
**Then** dead hand penalty applies
**And** I must discard the drawn tile to complete my turn
**And** the turn advances to the next player

### AC-8: Dead Hand After Called Mahjong

**Given** I won a call for Mahjong but validation failed
**When** dead hand penalty applies
**Then** the turn advances to the next player after the discarder (not me)
**And** the called tile remains in the discard pool (not awarded to me)
**And** the discarder is not penalized (their discard was legal)

### AC-9: Game End with Dead Hands

**Given** 3 players have dead hands and only 1 active player remains
**When** the wall is exhausted or the active player wins
**Then** the game ends normally
**And** dead hand players receive 0 points (or negative penalty per house rules)
**And** the scoring screen shows "DEAD HAND" for penalized players

### AC-10: Dead Hand Recovery (None)

**Given** my hand is declared dead
**Then** there is NO way to recover or undo the dead hand status
**And** the status persists until the game ends
**And** I must continue playing until someone wins or the wall is exhausted

## Technical Details

### Commands (Frontend → Backend)

No new commands - dead hand is a consequence of `DeclareMahjong` with invalid hand.

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    HandValidated: {
      player: Seat,
      valid: false,
      pattern: null
    }
  }
}

{
  kind: 'Public',
  event: {
    HandDeclaredDead: {
      player: Seat,
      reason: "Invalid Mahjong claim"  // or "Invalid Mahjong claim on called tile"
    }
  }
}

// Dead hand player's hand is revealed
{
  kind: 'Public',
  event: {
    HandRevealed: {
      player: Seat,
      tiles: [Tile],  // All 13-14 tiles visible to everyone
      reason: "Dead hand penalty"
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/rules/validator.rs` - Validation failure detection
  - `crates/mahjong_core/src/event/public_events.rs` - `HandDeclaredDead`, `HandRevealed`
  - `crates/mahjong_core/src/flow/playing.rs` - Dead hand turn restrictions
  - `crates/mahjong_core/src/table/types.rs` - Dead hand player state
- **Game Design Doc**:
  - Section 4.7 (Dead Hand Penalty)
  - Section 4.8 (Invalid Mahjong Consequences)

## Components Involved

- **`<DeadHandOverlay>`** - Penalty announcement overlay
- **`<DeadHandBadge>`** - Red badge next to player name
- **`<RevealedHand>`** - Shows dead hand player's tiles to all
- **`<TurnIndicator>`** - Updated to show "Dead Hand" status
- **`<GameLog>`** - Records dead hand event
- **`useSoundEffects()`** - Penalty sound

**Component Specs:**

- `component-specs/presentational/DeadHandOverlay.md` (NEW)
- `component-specs/presentational/DeadHandBadge.md` (NEW)
- `component-specs/presentational/RevealedHand.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/dead-hand-invalid-self-draw.md`** - Invalid self-draw Mahjong
- **`tests/test-scenarios/dead-hand-invalid-called.md`** - Invalid called Mahjong
- **`tests/test-scenarios/dead-hand-turn-flow.md`** - Dead hand player's turn behavior
- **`tests/test-scenarios/dead-hand-multiple-players.md`** - Multiple dead hands
- **`tests/test-scenarios/dead-hand-game-end.md`** - Game end with dead hands

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/dead-hand-state.json` - State with dead hand player
- `tests/fixtures/hands/invalid-mahjong-hand.json` - Hand that doesn't match patterns
- `tests/fixtures/events/dead-hand-sequence.json` - Dead hand event flow

**Sample Invalid Mahjong Event Sequence:**

```json
{
  "scenario": "Invalid Mahjong → Dead Hand",
  "events": [
    {
      "kind": "Public",
      "event": { "MahjongDeclared": { "player": "South" } }
    },
    {
      "kind": "Public",
      "event": {
        "HandValidated": {
          "player": "South",
          "valid": false,
          "pattern": null
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "HandDeclaredDead": {
          "player": "South",
          "reason": "Invalid Mahjong claim"
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "HandRevealed": {
          "player": "South",
          "tiles": ["Bam1", "Bam2", "Crak3", "Dot5", ...],
          "reason": "Dead hand penalty"
        }
      }
    },
    {
      "kind": "Public",
      "event": { "TurnChanged": { "player": "West", "stage": { "Playing": "Drawing" } } }
    }
  ]
}
```

## Edge Cases

### EC-1: Dead Hand Cannot Call

**Given** I have a dead hand
**When** another player discards a tile I could use for Pung
**Then** I do NOT see a call window
**And** I cannot call the tile (dead hand restriction)

### EC-2: Dead Hand Cannot Win

**Given** I have a dead hand
**When** I later draw a tile that would complete a valid pattern
**Then** no "Declare Mahjong" button appears
**And** I cannot win (permanent restriction)

### EC-3: Dead Hand Continues Playing

**Given** I have a dead hand
**When** it is my turn
**Then** I must draw and discard normally
**And** skipping my turn is not allowed
**And** other players can call my discards

### EC-4: All Players Dead Hand → Draw

**Given** all 4 players have dead hands
**When** any player's turn occurs
**Then** the game should end in a draw
**And** the server emits `GameAbandoned { reason: AllDeadHands }`
**And** no winner, all players score 0 (or per house rules)

### EC-5: Dead Hand Penalty Scoring

**Given** a player has a dead hand when game ends
**Then** their scoring varies by house rules:

- **No Penalty**: Dead hand player scores 0
- **Fixed Penalty**: Dead hand player scores -50 (or configured amount)
- **Pay Winner**: Dead hand player pays winner same as others

The `GameResult` event includes dead hand players in payments appropriately.

### EC-6: Hand Revelation Timing

**Given** my Mahjong validation fails
**When** `HandRevealed` event is emitted
**Then** all players immediately see my tiles
**And** my tiles remain visible for the rest of the game
**And** my rack shows tiles face-up (not face-down)

## Related User Stories

- **US-018**: Declaring Mahjong (Self-Draw) - Can result in dead hand
- **US-019**: Declaring Mahjong (Called Discard) - Can result in dead hand
- **US-021**: Wall Game (Draw) - Alternative if all players dead hand

## Accessibility Considerations

### Keyboard Navigation

- **Enter**: Acknowledge dead hand overlay (close after viewing)

### Screen Reader

- **Penalty**: "Dead hand penalty applied. Invalid Mahjong claim. Your hand is revealed to all players. You cannot win this game but must continue playing."
- **Turn**: "Your turn. Dead hand. Draw a tile and discard. You cannot call or declare Mahjong."
- **Other Players**: "South has a dead hand. Invalid Mahjong claim. South's hand is now visible: 1 Bamboo, 2 Bamboo, 3 Crack, 5 Dots..."

### Visual

- **High Contrast**: Red "DEAD HAND" badge with clear text
- **Revealed Hand**: Dead hand player's tiles shown face-up with red border
- **Overlay**: Dead hand penalty overlay has clear, prominent text

## Priority

**HIGH** - Important penalty enforcement, prevents false Mahjong claims

## Story Points / Complexity

**5** - Medium-High complexity

- Dead hand state management
- Hand revelation to all players
- Turn restrictions (cannot call, cannot win)
- Badge and visual indicators
- Multiple dead hands handling
- Scoring penalties

## Definition of Done

- [ ] `HandValidated { valid: false }` triggers dead hand flow
- [ ] `HandDeclaredDead` event applies penalty
- [ ] Dead hand overlay displays with reason
- [ ] Penalty sound effect plays
- [ ] "DEAD HAND" badge appears next to player name
- [ ] `HandRevealed` event shows tiles to all players
- [ ] Dead hand player's tiles visible face-up to everyone
- [ ] Dead hand player cannot declare Mahjong (no button)
- [ ] Dead hand player cannot call discards (no call window)
- [ ] Dead hand player can still draw and discard on their turn
- [ ] Other players see dead hand status and revealed tiles
- [ ] Multiple dead hands supported
- [ ] All dead hands → game ends in draw
- [ ] Dead hand players score 0 or penalty in final scores
- [ ] Dead hand status persists until game end (no recovery)
- [ ] Component tests pass (DeadHandOverlay, DeadHandBadge, RevealedHand)
- [ ] Integration tests pass (invalid Mahjong → dead hand flow)
- [ ] E2E test passes (Mahjong declaration → validation failure → dead hand → game continues)
- [ ] Accessibility tests pass (keyboard nav, screen reader)
- [ ] Manually tested against `user-testing-plan.md` (Part 4, Dead Hand scenarios)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Dead Hand State Management

```typescript
interface DeadHandState {
  players: Set<Seat>; // Players with dead hands
  revealedHands: Record<Seat, Tile[]>; // Dead hand players' tiles
  reasons: Record<Seat, string>; // Why hand is dead
}
```

Zustand store:

```typescript
case 'HandDeclaredDead':
  state.deadHands.add(event.player);
  state.deadHandReasons[event.player] = event.reason;
  break;

case 'HandRevealed':
  state.revealedHands[event.player] = event.tiles;
  break;
```

### Dead Hand Overlay

```typescript
<DeadHandOverlay
  show={showDeadHandOverlay}
  player={deadHandPlayer}
  reason={deadHandReason}
  revealedHand={revealedHand}
  onAcknowledge={() => {
    setShowDeadHandOverlay(false);
  }}
/>
```

Display:

```text
╔══════════════════════════════════════╗
║         DEAD HAND PENALTY            ║
╠══════════════════════════════════════╣
║ Player: South                        ║
║ Reason: Invalid Mahjong claim        ║
╠══════════════════════════════════════╣
║ Consequences:                        ║
║ • Your hand is revealed to all       ║
║ • You cannot declare Mahjong         ║
║ • You cannot call discards           ║
║ • You must continue playing          ║
╠══════════════════════════════════════╣
║ Your Revealed Hand:                  ║
║ [Bam1] [Bam2] [Crak3] [Dot5] ...     ║
╠══════════════════════════════════════╣
║         [Acknowledge]                ║
╚══════════════════════════════════════╝
```

### Dead Hand Badge

```typescript
<PlayerNameDisplay
  seat={seat}
  name={playerName}
  isDeadHand={deadHands.has(seat)}
/>

// If dead hand:
<div className="player-name">
  {playerName}
  <span className="dead-hand-badge">DEAD HAND</span>
</div>
```

Badge styling:

- Red background
- White text
- Bold font
- Pulsing animation (optional, can disable)

### Revealed Hand Display

For dead hand players, show tiles face-up to all:

```typescript
<PlayerRack
  seat={seat}
  tiles={revealedHands[seat] || []}  // Use revealed tiles if dead hand
  isDeadHand={deadHands.has(seat)}
  faceUp={deadHands.has(seat)}  // Always face-up for dead hands
/>
```

Styling:

- Red border around rack
- Tiles displayed face-up
- "REVEALED" watermark over tiles

### Turn Restrictions for Dead Hand

```typescript
function canDeclareCallIntent(player: Seat): boolean {
  if (deadHands.has(player)) {
    return false; // Dead hand cannot call
  }
  return true;
}

function canDeclareMahjong(player: Seat): boolean {
  if (deadHands.has(player)) {
    return false; // Dead hand cannot win
  }
  return true;
}

function mustContinuePlaying(player: Seat): boolean {
  if (deadHands.has(player)) {
    return true; // Dead hand must draw/discard
  }
  return false;
}
```

### All Dead Hands → Draw

```typescript
useEffect(() => {
  if (deadHands.size === 4) {
    // All players have dead hands → game should end
    // Server will emit GameAbandoned event
  }
}, [deadHands]);

case 'GameAbandoned':
  if (event.reason === 'AllDeadHands') {
    state.gameResult = {
      winner: null,
      reason: 'All players have dead hands',
      finalScores: state.scores  // No changes
    };
    state.phase = 'GameOver';
  }
  break;
```

### Dead Hand Penalty Scoring

At game end, dead hand players may receive penalty:

```typescript
function calculateDeadHandPenalty(
  houseRules: HouseRules,
  winner: Seat | null,
  baseScore: number
): number {
  switch (houseRules.deadHandPenalty) {
    case 'None':
      return 0;
    case 'FixedPenalty':
      return -50; // Configured amount
    case 'PayWinner':
      return winner ? -baseScore : 0; // Pay same as other losers
  }
}
```

The `GameResult.payments` field includes dead hand players.

### Game Log Entry

```typescript
case 'HandDeclaredDead':
  addGameLogEntry({
    type: 'DeadHand',
    player: event.player,
    reason: event.reason,
    timestamp: Date.now(),
    message: `${getPlayerName(event.player)}'s hand declared dead - ${event.reason}`
  });
  break;
```

Display in game log:

```text
[12:34] South declared Mahjong
[12:34] South's hand declared dead - Invalid Mahjong claim
[12:34] South's hand revealed to all players
```

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Dead hand overlay appears instantly (no fade-in)
- Badge appears immediately
- Penalty sound still plays
- Revealed hand displays instantly

```text

```
