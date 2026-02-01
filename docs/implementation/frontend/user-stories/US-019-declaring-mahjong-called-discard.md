# US-019: Declaring Mahjong (Called Discard)

## Story

**As a** player who can win by calling a discarded tile
**I want** to declare Mahjong during the call window and have my hand validated
**So that** I can win the game by calling for Mahjong instead of waiting for self-draw

## Acceptance Criteria

### AC-1: Mahjong Call Opportunity

**Given** another player discarded a tile that completes my winning hand
**When** the server emits `CallWindowOpened { tile, discarded_by, can_call: [..., me, ...], ... }`
**And** the called tile would complete a valid NMJL pattern
**Then** the call window panel appears with options: "Call for Mahjong", "Call for Pung/Kong", "Pass"
**And** the "Call for Mahjong" button is highlighted (highest priority)
**And** a message displays: "[Player] discarded [Tile]. Call for Mahjong to win!"

### AC-2: Declare Mahjong Intent

**Given** the call window is open and I can win with the discarded tile
**When** I click "Call for Mahjong"
**Then** a `DeclareCallIntent { player: me, intent: Mahjong }` command is sent
**And** all call buttons become disabled
**And** a message appears: "Declared Mahjong! Waiting for validation..."
**And** a checkmark appears next to my name

### AC-3: Call Resolution (Mahjong Wins)

**Given** I declared Mahjong intent and possibly others declared meld intents
**When** the server emits `CallResolved { resolution: { winner: me, intent: Mahjong, ... } }`
**Then** a message appears: "You win the call for Mahjong!"
**And** the call window closes
**And** the server emits `AwaitingMahjongValidation { caller: me, called_tile, discarded_by }`
**And** I must now submit my full hand for validation

### AC-4: Submit Hand for Validation

**Given** the server is awaiting my Mahjong validation
**When** a validation dialog appears showing my 13 concealed tiles + the called tile
**And** I click "Submit for Validation"
**Then** a `DeclareMahjong { player: me, hand: Hand, winning_tile: Some(called_tile) }` command is sent
**And** the dialog shows loading state
**And** all players see: "[My Name] is validating Mahjong..."

### AC-5: Hand Validation Success

**Given** I submitted my hand for validation
**When** the server emits `HandValidated { player: me, valid: true, pattern: "Consecutive Run" }`
**Then** a celebration animation plays (confetti, fireworks, 2 seconds)
**And** a victory sound effect plays
**And** a large overlay appears: "MAHJONG! [My Name] wins by calling [Tile]!"
**And** the winning pattern is displayed with score
**And** my hand is revealed to all players with the winning tiles highlighted
**And** the called tile is shown as part of the exposed meld
**And** the game phase transitions to `Scoring`

### AC-6: Hand Validation Failure (Invalid Pattern)

**Given** I submitted my hand for validation
**When** the server emits `HandValidated { player: me, valid: false, pattern: None }`
**Then** an error overlay appears: "Invalid Mahjong - Hand does not match pattern with called tile"
**And** my hand is revealed to all players (penalty for false Mahjong claim)
**And** the server emits `HandDeclaredDead { player: me, reason: "Invalid Mahjong claim on called tile" }`
**And** I am out of the game (cannot win, but can still discard when turn comes)
**And** the turn advances to the discarder's next player (normal flow resumes)

### AC-7: Scoring Display (Called Mahjong)

**Given** my Mahjong was validated successfully
**When** the celebration animation completes
**Then** a scoring screen appears showing:

- **Winner**: My name and seat
- **Pattern**: Pattern name with full tile layout
- **Base Score**: Points from pattern
- **Called From**: The player who discarded (they pay 2x or full amount per house rules)
- **Payment**: Discarder pays more, others pay base (or discarder pays all per house rules)
- **Final Scores**: Updated score table for all players

### AC-8: Mahjong Priority Over Meld Calls

**Given** I declared Mahjong and South declared Pung
**When** the call resolution occurs
**Then** I win the call (Mahjong has highest priority)
**And** South's Pung intent is ignored
**And** the resolution message shows: "[My Name] wins call for Mahjong (priority over Pung)"

### AC-9: Multiple Mahjong Calls (Closest Wins)

**Given** both I (West) and North declared Mahjong
**When** East discarded the tile (turn order: East → South → West → North)
**Then** I win the call (West is closer to East than North)
**And** the resolution message shows: "West wins call for Mahjong (closer to discarder)"
**And** North's Mahjong intent is ignored

### AC-10: Bot Mahjong Call

**Given** a bot can win by calling a discarded tile
**When** the call window opens
**Then** the bot automatically sends `DeclareCallIntent { intent: Mahjong }` after a delay (0.5-1.0s)
**And** if the bot wins the call, it submits hand for validation
**And** the same validation and scoring flow occurs

## Technical Details

### Commands (Frontend → Backend)

````typescript
// Step 1: Declare intent during call window
{
  DeclareCallIntent: {
    player: Seat,
    intent: "Mahjong"
  }
}

// Step 2: Submit hand for validation (after winning call)
{
  DeclareMahjong: {
    player: Seat,
    hand: Hand,  // My 13 concealed tiles + called tile
    winning_tile: Tile  // Some(called_tile)
  }
}
```text

### Events (Backend → Frontend)

**Public Events:**

```typescript
{
  kind: 'Public',
  event: {
    CallWindowOpened: {
      tile: Tile,
      discarded_by: Seat,
      can_call: [Seat],
      timer: 10,
      started_at_ms: number,
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
        intent: "Mahjong",
        tile: Tile
      }
    }
  }
}

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

{
  kind: 'Public',
  event: {
    MahjongDeclared: {
      player: Seat
    }
  }
}

{
  kind: 'Public',
  event: {
    HandValidated: {
      player: Seat,
      valid: boolean,
      pattern: string | null
    }
  }
}

// If valid
{
  kind: 'Public',
  event: {
    GameResult: {
      winner: Seat,
      pattern: string,
      base_score: number,
      payments: Record<Seat, number>,
      called_from: Seat  // Who discarded
    }
  }
}

// If invalid
{
  kind: 'Public',
  event: {
    HandDeclaredDead: {
      player: Seat,
      reason: "Invalid Mahjong claim on called tile"
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `DeclareCallIntent`, `DeclareMahjong`
  - `crates/mahjong_core/src/call_resolution.rs` - Mahjong priority resolution
  - `crates/mahjong_core/src/rules/validator.rs` - Hand validation with called tile
  - `crates/mahjong_core/src/event/public_events.rs` - `AwaitingMahjongValidation`, `HandValidated`
  - `crates/mahjong_core/src/scoring.rs` - Called Mahjong scoring (discarder pays more)
- **Game Design Doc**:
  - Section 4.2 (Declaring Mahjong - Called Discard)
  - Section 4.4 (Hand Validation with Called Tile)
  - Section 4.6 (Scoring - Called Mahjong Payment Rules)

## Components Involved

- **`<CallWindowPanel>`** - "Call for Mahjong" button (from US-011)
- **`<MahjongValidationDialog>`** - Shows hand + called tile for validation
- **`<CelebrationOverlay>`** - Victory animation (from US-018)
- **`<WinningHandDisplay>`** - Shows winning hand with called tile highlighted
- **`<ScoringScreen>`** - Displays scores with "Called From" info
- **`useSoundEffects()`** - Victory sound

**Component Specs:**

- `component-specs/presentational/MahjongValidationDialog.md` (NEW)
- Reuse specs from US-018 for celebration and scoring

## Test Scenarios

- **`tests/test-scenarios/mahjong-called-valid.md`** - Valid called Mahjong
- **`tests/test-scenarios/mahjong-called-invalid.md`** - Invalid called Mahjong → dead hand
- **`tests/test-scenarios/mahjong-priority-over-meld.md`** - Mahjong beats Pung
- **`tests/test-scenarios/mahjong-multiple-callers.md`** - Closest caller wins
- **`tests/test-scenarios/mahjong-called-bot.md`** - Bot called Mahjong

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/call-window-mahjong-opportunity.json`
- `tests/fixtures/hands/winning-hand-with-called-tile.json`
- `tests/fixtures/events/mahjong-called-valid-sequence.json`
- `tests/fixtures/events/mahjong-called-invalid-sequence.json`

**Sample Called Mahjong Event Sequence:**

```json
{
  "scenario": "Called Mahjong (Valid)",
  "events": [
    {
      "kind": "Public",
      "event": {
        "CallWindowOpened": {
          "tile": "Dot5",
          "discarded_by": "East",
          "can_call": ["South", "West"],
          "timer": 10,
          "started_at_ms": 1706634400000,
          "timer_mode": "Standard"
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "CallResolved": {
          "resolution": {
            "winner": "South",
            "intent": "Mahjong",
            "tile": "Dot5"
          }
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "AwaitingMahjongValidation": {
          "caller": "South",
          "called_tile": "Dot5",
          "discarded_by": "East"
        }
      }
    },
    {
      "kind": "Public",
      "event": { "MahjongDeclared": { "player": "South" } }
    },
    {
      "kind": "Public",
      "event": {
        "HandValidated": {
          "player": "South",
          "valid": true,
          "pattern": "Consecutive Run"
        }
      }
    },
    {
      "kind": "Public",
      "event": {
        "GameResult": {
          "winner": "South",
          "pattern": "Consecutive Run",
          "base_score": 30,
          "payments": {
            "East": -90,
            "South": 120,
            "West": -15,
            "North": -15
          },
          "called_from": "East"
        }
      }
    },
    {
      "kind": "Public",
      "event": { "PhaseChanged": { "phase": "GameOver" } }
    }
  ]
}
```text

## Edge Cases

### EC-1: Invalid Mahjong Claim (Penalty)

**Given** I call for Mahjong but my hand + called tile doesn't match any pattern
**When** the server validates my hand
**Then** my hand is declared dead (same penalty as US-018)
**And** my hand is revealed to all players
**And** I cannot win for the rest of the game
**And** the turn advances to the next player

### EC-2: Mahjong Priority

Mahjong always wins over Pung/Kong/Quint, regardless of seat proximity.

### EC-3: Multiple Mahjong Callers

**Given** two players call for Mahjong
**Then** the player closer to the discarder (in turn order) wins
**And** the farther player's call is ignored

### EC-4: Called Tile Must Complete Pattern

**Given** I call for Mahjong with a tile
**When** the server validates
**Then** the called tile must be integral to the winning pattern
**And** simply having the tile in hand isn't enough (must be usable in pattern)

### EC-5: Network Error During Validation

**Given** I submit hand for validation but network fails
**When** no acknowledgment is received within 5 seconds
**Then** retry logic applies (max 3 attempts)

### EC-6: Disconnection During Validation

**Given** I'm awaiting validation after calling Mahjong
**When** I disconnect
**Then** the server waits for reconnection (grace period: 60 seconds)
**And** if I don't reconnect, my hand is auto-validated
**And** if invalid, I'm declared dead; if valid, I win

### EC-7: Payment Rules (House Rule Dependent)

**Given** I won by calling a discard
**Then** payment rules vary by house rules:

- **Discarder Pays All**: East (discarder) pays full amount (e.g., 90 pts)
- **Discarder Pays Double**: East pays 2x, others pay 1x (e.g., East: 60, others: 30 each)
- **Equal Payment**: All pay equally (rare for called Mahjong)

The `GameResult.payments` field reflects the configured house rule.

## Related User Stories

- **US-018**: Declaring Mahjong (Self-Draw) - Alternative win condition
- **US-011**: Call Window & Intent Buffering - Call mechanism
- **US-012**: Call Priority Resolution - Mahjong priority details
- **US-020**: Invalid Mahjong → Dead Hand - Penalty details

## Accessibility Considerations

### Keyboard Navigation

- **M Key**: Shortcut for "Call for Mahjong" button
- **Enter**: Submit hand for validation
- **Escape**: Cannot cancel once Mahjong declared (committed)

### Screen Reader

- **Opportunity**: "Call window open. East discarded 5 Dots. You can call for Mahjong to win. Press M to declare or X to pass."
- **Intent Declared**: "Declared Mahjong call. Waiting for call resolution..."
- **Call Won**: "You won the call for Mahjong. Submit your hand for validation."
- **Validating**: "Validating hand: 13 concealed tiles plus called 5 Dots..."
- **Valid**: "Mahjong! You win with Consecutive Run, 30 points. East (discarder) pays 90, West pays 15, North pays 15."
- **Invalid**: "Invalid Mahjong. Hand does not match pattern with called 5 Dots. Hand declared dead."

### Visual

- **High Contrast**: "Call for Mahjong" button prominently highlighted
- **Called Tile**: Called tile has distinct visual marker (e.g., gold border) in winning hand display
- **Animation**: Celebration respects `prefers-reduced-motion`

## Priority

**CRITICAL** - Core win condition, most common Mahjong type

## Story Points / Complexity

**8** - High complexity

- Two-step process (declare intent → submit hand)
- Call priority resolution (Mahjong beats meld, closest wins)
- Hand validation with called tile
- Celebration and scoring (similar to US-018)
- Dead hand penalty handling
- Payment rules for called Mahjong (discarder pays more)
- Bot behavior for calling Mahjong

## Definition of Done

- [ ] "Call for Mahjong" button appears in call window when winning tile discarded
- [ ] Button highlighted as highest priority option
- [ ] Click button sends `DeclareCallIntent { intent: Mahjong }`
- [ ] `CallResolved` event with Mahjong winner closes call window
- [ ] `AwaitingMahjongValidation` event triggers validation dialog
- [ ] Validation dialog shows 13 concealed tiles + called tile
- [ ] Submit sends `DeclareMahjong` with `winning_tile: Some(tile)`
- [ ] `HandValidated { valid: true }` triggers celebration animation
- [ ] Celebration animation plays (confetti, fireworks, 2s)
- [ ] Victory sound effect plays
- [ ] Winning overlay shows pattern and score
- [ ] Scoring screen shows "Called From" discarder
- [ ] Payment reflects called Mahjong rules (discarder pays more)
- [ ] `HandValidated { valid: false }` triggers invalid Mahjong flow
- [ ] Invalid Mahjong reveals hand to all players
- [ ] `HandDeclaredDead` marks player as dead hand
- [ ] Mahjong priority over meld calls verified
- [ ] Multiple Mahjong calls resolved by proximity
- [ ] Game phase transitions to `GameOver` after valid Mahjong
- [ ] Bot auto-calls Mahjong when winning tile discarded
- [ ] Component tests pass (MahjongValidationDialog, call window integration)
- [ ] Integration tests pass (valid/invalid called Mahjong flows)
- [ ] E2E test passes (call window → Mahjong → validation → scoring)
- [ ] Accessibility tests pass (keyboard nav, screen reader)
- [ ] Network error handling tested (retry logic)
- [ ] Manually tested against `user-testing-plan.md` (Part 4, Called Mahjong)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### Two-Step Mahjong Process

Called Mahjong requires two steps:

1. **Declare Intent** (during call window): `DeclareCallIntent { intent: Mahjong }`
2. **Submit Hand** (after winning call): `DeclareMahjong { hand, winning_tile: Some(tile) }`

This is because:

- Multiple players may declare Mahjong intent
- Only the winner needs to submit hand for validation
- Server needs to resolve priority before validation

### Mahjong Validation Dialog

```typescript
<MahjongValidationDialog
  show={awaitingValidation}
  concealedHand={yourHand}  // 13 tiles
  calledTile={calledTile}  // The tile that completes the hand
  discardedBy={discardedBy}
  onSubmit={() => {
    sendCommand({
      DeclareMahjong: {
        player: mySeat,
        hand: [...yourHand, calledTile],
        winning_tile: calledTile
      }
    });
  }}
/>
```text

Display:

```text
╔══════════════════════════════════════╗
║     Validate Mahjong                 ║
╠══════════════════════════════════════╣
║ Your Concealed Hand (13 tiles):      ║
║ [Bam1] [Bam2] [Bam3] [Crak1] ...     ║
║                                      ║
║ Called Tile (from East):             ║
║ [Dot5] ⭐                            ║
╠══════════════════════════════════════╣
║ Expected Pattern: Consecutive Run    ║
║ Expected Score: 30 points            ║
╠══════════════════════════════════════╣
║      [Submit for Validation]         ║
╚══════════════════════════════════════╝
```text

### Call Priority Resolution

From `crates/mahjong_core/src/call_resolution.rs`:

```rust
pub fn resolve_call(intents: Vec<CallIntent>) -> CallResolution {
    // Priority 1: Mahjong
    let mahjong_callers: Vec<_> = intents.iter()
        .filter(|i| i.intent == CallIntentKind::Mahjong)
        .collect();

    if !mahjong_callers.is_empty() {
        // Multiple Mahjong callers: closest to discarder wins
        return mahjong_callers.into_iter()
            .min_by_key(|i| proximity_to_discarder(i.player, discarder))
            .unwrap();
    }

    // Priority 2: Meld (Pung/Kong/Quint)
    let meld_callers: Vec<_> = intents.iter()
        .filter(|i| i.intent == CallIntentKind::Meld)
        .collect();

    if !meld_callers.is_empty() {
        // Multiple meld callers: closest wins
        return meld_callers.into_iter()
            .min_by_key(|i| proximity_to_discarder(i.player, discarder))
            .unwrap();
    }

    // No callers (shouldn't reach here)
    unreachable!()
}
```text

Frontend receives the result via `CallResolved` event.

### Payment Rules for Called Mahjong

Different house rules for payments:

**Discarder Pays All** (common):

- Discarder pays winner the full amount
- Other players pay nothing
- Example: Winner gets 90, East (discarder) pays -90, others: 0

**Discarder Pays Double** (moderate):

- Discarder pays 2x base score
- Other players pay 1x base score each
- Example: Base 30 → Winner gets 120 (2×30 + 2×30), East: -60, West: -30, North: -30

**Equal Payment** (rare):

- All players pay equally
- Example: Base 30 → Winner gets 90, all others: -30 each

The `GameResult.payments` field reflects the configured rule. Frontend displays accordingly.

### Scoring Screen for Called Mahjong

```typescript
<ScoringScreen
  winner={winner}
  pattern={winningPattern}
  baseScore={baseScore}
  payments={payments}
  finalScores={finalScores}
  isSelfDraw={false}
  calledFrom={calledFrom}  // Additional field for called Mahjong
  onContinue={() => {
    setShowGameOverPanel(true);
  }}
/>
```text

Display includes:

- "Called From: East" (highlight the discarder)
- Payment breakdown showing discarder pays more
- Visual indicator (arrow or highlight) showing tile came from discarder

### Bot Mahjong Call Strategy

```typescript
function shouldBotCallMahjong(hand: Tile[], calledTile: Tile, difficulty: BotDifficulty): boolean {
  // Check if hand + called tile forms valid pattern
  const pattern = validateHand([...hand, calledTile], cardYear);

  if (!pattern) return false;

  switch (difficulty) {
    case 'Basic':
    case 'Easy':
      return true; // Always call if valid

    case 'Medium':
      // Call if score >= 25
      return pattern.score >= 25;

    case 'Hard':
      // Strategic evaluation: consider position, other players' progress
      return evaluateCallMahjongEV(hand, calledTile, pattern);
  }
}
```text

### Zustand Store Updates

```typescript
case 'AwaitingMahjongValidation':
  if (event.caller === mySeat) {
    state.awaitingMahjongValidation = {
      calledTile: event.called_tile,
      discardedBy: event.discarded_by,
      pending: true
    };
  }
  break;

case 'MahjongDeclared':
  state.mahjongDeclared = {
    player: event.player,
    pending: true,
    calledMahjong: true
  };
  break;

case 'HandValidated':
  if (event.valid) {
    state.winningPlayer = event.player;
    state.winningPattern = event.pattern;
    state.showCelebration = true;
  } else {
    state.deadHands.push(event.player);
    state.revealedHands[event.player] = state.yourHand;
  }
  state.awaitingMahjongValidation.pending = false;
  state.mahjongDeclared.pending = false;
  break;

case 'GameResult':
  state.gameResult = {
    ...event,
    calledMahjong: event.called_from !== undefined
  };
  state.finalScores = calculateFinalScores(state.scores, event.payments);
  break;
```text

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Skip celebration animation
- Show static "MAHJONG!" overlay for 0.5s
- Instantly display scoring screen
- Victory sound still plays

```text

```text
````
