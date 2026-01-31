# US-018: Declaring Mahjong (Self-Draw)

## Story

**As a** player who has drawn a tile that completes my winning hand
**I want** to declare Mahjong and have my hand validated against NMJL patterns
**So that** I can win the game and proceed to scoring

## Acceptance Criteria

### AC-1: Mahjong Opportunity Detected

**Given** it is my turn and I am in the `Discarding` stage with 14 tiles
**When** I have a valid winning hand matching an NMJL pattern
**Then** a "Declare Mahjong" button appears in the action bar (in addition to discard option)
**And** the button is highlighted with a pulsing animation
**And** a sound effect plays (optional "opportunity chime")
**And** a message displays: "You have Mahjong! Declare to win or discard to continue"

### AC-2: Declare Mahjong (Self-Draw)

**Given** I have a winning hand after drawing a tile
**When** I click the "Declare Mahjong" button
**Then** a confirmation dialog appears: "Declare Mahjong with your current hand?"
**And** my hand is displayed in the dialog (all 14 tiles revealed)
**And** the winning pattern name is shown (e.g., "2025 - Odds Only - 35 points")

### AC-3: Confirm Mahjong Declaration

**Given** the Mahjong confirmation dialog is open
**When** I click "Confirm Mahjong"
**Then** a `DeclareMahjong { player: me, hand: Hand, winning_tile: None }` command is sent (None = self-draw)
**And** the dialog shows a loading state
**And** my hand becomes non-interactive
**And** all other players see: "[My Name] is declaring Mahjong..."

### AC-4: Hand Validation Success

**Given** I sent the `DeclareMahjong` command
**When** the server emits `MahjongDeclared { player: me }`
**And** the server emits `HandValidated { player: me, valid: true, pattern: "Odds Only" }`
**Then** a celebration animation plays (confetti, fireworks, 2 seconds)
**And** a victory sound effect plays
**And** a large overlay appears: "MAHJONG! [My Name] wins!"
**And** the winning pattern is displayed: "Odds Only - 35 points"
**And** my hand is revealed to all players with the winning tiles highlighted
**And** the game phase transitions to `Scoring`

### AC-5: Hand Validation Failure (Invalid Pattern)

**Given** I sent the `DeclareMahjong` command
**When** the server emits `HandValidated { player: me, valid: false, pattern: None }`
**Then** an error overlay appears: "Invalid Mahjong - Hand does not match any pattern"
**And** my hand is revealed to all players (penalty for false Mahjong)
**And** the server emits `HandDeclaredDead { player: me, reason: "Invalid Mahjong claim" }`
**And** I am out of the game (cannot win, but can still discard when turn comes)
**And** the turn advances to the next player

### AC-6: Scoring Display

**Given** my Mahjong was validated successfully
**When** the celebration animation completes
**Then** a scoring screen appears showing:

- **Winner**: My name and seat
- **Pattern**: "Odds Only" with full tile layout
- **Base Score**: 35 points
- **Payment**: Each player pays me 35 points
- **Self-Draw Bonus**: 2x payment (house rule dependent)
- **Final Scores**: Updated score table for all players

### AC-7: Game End After Mahjong

**Given** the scoring screen is displayed
**When** all players have viewed the scores (or 10 seconds elapsed)
**Then** the server emits `PhaseChanged { phase: GameOver }`
**And** options appear: "New Game", "Return to Lobby", "View Replay"

### AC-8: Bot Mahjong Declaration

**Given** a bot has a winning hand on their turn
**When** the bot's AI detects Mahjong opportunity
**Then** the bot automatically sends `DeclareMahjong` command after a delay (1-2 seconds)
**And** human players see: "[Bot Name] declares Mahjong!"
**And** the same validation and scoring flow occurs

### AC-9: Optional Mahjong (Strategic Choice)

**Given** I have a winning hand but want to continue playing for a higher-value pattern
**When** I choose to discard instead of declaring Mahjong
**Then** I can select a tile and discard normally
**And** the "Declare Mahjong" button remains available on future turns if hand is still valid
**Note:** This is a strategic decision - player may want to wait for a different pattern

### AC-10: Heavenly Hand (East Wins Before Charleston)

**Given** I am East and have a winning hand after the deal (14 tiles)
**When** the server detects this before Charleston begins
**Then** the server emits `HeavenlyHand { pattern: "...", base_score: X }`
**And** a special overlay appears: "HEAVENLY HAND! East wins with initial deal!"
**And** Charleston is skipped
**And** East receives double payment from all players
**And** the game proceeds directly to scoring

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  DeclareMahjong: {
    player: Seat,
    hand: Hand,  // All 14 tiles
    winning_tile: null  // None for self-draw
  }
}
```

### Events (Backend → Frontend)

**Public Events:**

```typescript
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
      pattern: string | null  // Pattern name if valid
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
      payments: Record<Seat, number>  // Who pays whom
    }
  }
}

// If invalid
{
  kind: 'Public',
  event: {
    HandDeclaredDead: {
      player: Seat,
      reason: "Invalid Mahjong claim"
    }
  }
}

// Special case: Heavenly Hand
{
  kind: 'Public',
  event: {
    HeavenlyHand: {
      pattern: string,
      base_score: number
    }
  }
}

{
  kind: 'Public',
  event: {
    PhaseChanged: {
      phase: "GameOver"
    }
  }
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `DeclareMahjong` command
  - `crates/mahjong_core/src/rules/validator.rs` - Hand validation logic (histogram-based)
  - `crates/mahjong_core/src/event/public_events.rs` - `MahjongDeclared`, `HandValidated`, `HeavenlyHand`
  - `crates/mahjong_core/src/scoring.rs` - Score calculation
  - `crates/mahjong_core/src/hand.rs` - Hand representation and deficiency calculation
- **Game Design Doc**:
  - Section 4.1 (Declaring Mahjong - Self-Draw)
  - Section 4.3 (Hand Validation Against NMJL Patterns)
  - Section 4.5 (Scoring and Payment)
  - Section 2.3 (Heavenly Hand Special Case)

## Components Involved

- **`<ActionBar>`** - "Declare Mahjong" button
- **`<MahjongConfirmationDialog>`** - Confirmation with hand display
- **`<HandValidator>`** - Client-side pre-validation (optional UX enhancement)
- **`<CelebrationOverlay>`** - Victory animation (confetti, fireworks)
- **`<WinningHandDisplay>`** - Shows winning hand with pattern layout
- **`<ScoringScreen>`** - Displays scores, pattern, payments
- **`<GameOverPanel>`** - Post-game options
- **`useSoundEffects()`** - Victory sound, opportunity chime

**Component Specs:**

- `component-specs/presentational/MahjongConfirmationDialog.md` (NEW)
- `component-specs/presentational/CelebrationOverlay.md` (NEW)
- `component-specs/presentational/WinningHandDisplay.md` (NEW)
- `component-specs/presentational/ScoringScreen.md` (NEW)
- `component-specs/presentational/GameOverPanel.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/mahjong-self-draw-valid.md`** - Valid Mahjong declaration
- **`tests/test-scenarios/mahjong-self-draw-invalid.md`** - Invalid Mahjong → dead hand
- **`tests/test-scenarios/mahjong-optional.md`** - Player chooses to discard instead
- **`tests/test-scenarios/mahjong-heavenly-hand.md`** - East wins before Charleston
- **`tests/test-scenarios/mahjong-bot-declares.md`** - Bot Mahjong behavior

## Mock Data

**Fixtures:**

- `tests/fixtures/game-states/mahjong-self-draw-opportunity.json` - State with winning hand
- `tests/fixtures/hands/winning-hand-odds-only.json` - Sample winning hand
- `tests/fixtures/events/mahjong-self-draw-valid-sequence.json` - Event flow for valid Mahjong
- `tests/fixtures/events/mahjong-self-draw-invalid-sequence.json` - Event flow for invalid Mahjong

**Sample Winning Hand (Odds Only - 2025 Card):**

```json
{
  "name": "Winning Hand - Odds Only",
  "tiles": [
    "Bam1",
    "Bam1",
    "Bam1",
    "Crak3",
    "Crak3",
    "Crak3",
    "Dot5",
    "Dot5",
    "Dot5",
    "Bam7",
    "Bam7",
    "Bam7",
    "Dot9",
    "Dot9"
  ],
  "pattern": "Odds Only",
  "section": "2-4-6-8",
  "score": 35,
  "note": "All tiles are odd numbers (1, 3, 5, 7, 9)"
}
```

**Sample Valid Mahjong Event Sequence:**

```json
{
  "scenario": "Self-Draw Mahjong (Valid)",
  "events": [
    {
      "kind": "Public",
      "event": { "MahjongDeclared": { "player": "South" } }
    },
    {
      "kind": "Public",
      "event": { "HandValidated": { "player": "South", "valid": true, "pattern": "Odds Only" } }
    },
    {
      "kind": "Public",
      "event": {
        "GameResult": {
          "winner": "South",
          "pattern": "Odds Only",
          "base_score": 35,
          "payments": {
            "East": -35,
            "South": 105,
            "West": -35,
            "North": -35
          }
        }
      }
    },
    {
      "kind": "Public",
      "event": { "PhaseChanged": { "phase": "GameOver" } }
    }
  ]
}
```

## Edge Cases

### EC-1: Invalid Mahjong Claim (Penalty)

**Given** I declare Mahjong but my hand doesn't match any pattern
**When** the server validates my hand
**Then** my hand is declared dead
**And** my hand is revealed to all players (penalty)
**And** I cannot win for the rest of the game
**And** I must continue discarding when my turn comes
**And** other players can still win

### EC-2: Client-Side Pre-Validation (UX Enhancement)

**Given** the frontend has access to the same pattern validation logic
**When** I draw a tile
**Then** the client can pre-validate whether I have Mahjong
**And** only show "Declare Mahjong" button if client-side validation passes
**Note:** Server always performs authoritative validation; client-side is optional UX improvement

### EC-3: Double-Click Prevention

**Given** I click "Declare Mahjong"
**When** I rapidly click again before server responds
**Then** only ONE `DeclareMahjong` command is sent
**And** the button is disabled after first click

### EC-4: Network Error on Declaration

**Given** I send `DeclareMahjong` but network fails
**When** no acknowledgment is received within 5 seconds
**Then** an error toast appears: "Failed to declare Mahjong. Retrying..."
**And** the command is automatically retried (max 3 attempts)
**And** if all retries fail, show "Connection lost" with manual retry button

### EC-5: Disconnection After Declaration

**Given** I declared Mahjong and am waiting for validation
**When** I disconnect from the server
**Then** the server continues validation process
**And** when I reconnect, I see the validation result (win or dead hand)

### EC-6: Multiple Winning Patterns (Choose Best)

**Given** my hand matches multiple patterns (e.g., "Odds Only" and "Any Like Numbers")
**When** the server validates my hand
**Then** the server selects the highest-scoring pattern
**And** that pattern is displayed in the scoring screen

### EC-7: Heavenly Hand Detection

**Given** I am East and dealt a winning hand (14 tiles)
**When** the deal completes
**Then** the server automatically detects Heavenly Hand
**And** I don't need to manually declare
**And** Charleston is skipped
**And** I receive double payment

### EC-8: Bot Strategic Mahjong

**Given** a bot has a winning hand but it's low-value
**When** the bot's strategy evaluates declaring vs continuing
**Then** Hard bots may choose to discard and wait for higher-value pattern
**And** Easy/Basic bots always declare immediately

## Related User Stories

- **US-019**: Declaring Mahjong (Called Discard) - Alternative win condition
- **US-020**: Invalid Mahjong → Dead Hand - Penalty details
- **US-011**: Call Window & Intent Buffering - Mahjong call has highest priority
- **US-021**: Wall Game (Draw) - Alternative end game condition

## Accessibility Considerations

### Keyboard Navigation

- **M Key**: Shortcut for "Declare Mahjong" button
- **Enter**: Confirm Mahjong declaration in dialog
- **Escape**: Cancel Mahjong declaration dialog
- **Space**: Navigate through scoring screen

### Screen Reader

- **Opportunity**: "Mahjong opportunity detected. You have a winning hand: Odds Only, 35 points. Press M to declare or select a tile to discard."
- **Declared**: "Declaring Mahjong. Validating hand against NMJL patterns..."
- **Valid**: "Mahjong! You win with Odds Only, 35 points. East pays 35, West pays 35, North pays 35."
- **Invalid**: "Invalid Mahjong. Your hand does not match any pattern. Hand declared dead. You cannot win this game."
- **Heavenly Hand**: "Heavenly Hand! East wins with initial deal. Pattern: Odds Only, 70 points (double payment)."

### Visual

- **High Contrast**: "Declare Mahjong" button has bold, high-contrast styling
- **Animation**: Celebration animation respects `prefers-reduced-motion` (static confetti or instant display)
- **Color-Blind**: Victory overlay uses text, not just color ("MAHJONG!" text in large font)
- **Pattern Display**: Winning pattern layout uses clear tile images, not just names

## Priority

**CRITICAL** - Core win condition, game-ending mechanic

## Story Points / Complexity

**8** - High complexity

- Hand validation against NMJL patterns (histogram-based)
- Multiple event types (MahjongDeclared, HandValidated, GameResult, HandDeclaredDead, HeavenlyHand)
- Celebration animations and sound effects
- Scoring calculation and display
- Dead hand penalty handling
- Heavenly Hand special case
- Bot strategic decision-making
- Game phase transition to GameOver

## Definition of Done

- [ ] "Declare Mahjong" button appears when valid hand detected
- [ ] Button has pulsing animation and opportunity sound
- [ ] Click button opens confirmation dialog with hand display
- [ ] Dialog shows winning pattern name and score
- [ ] Confirm sends `DeclareMahjong` command with hand and `winning_tile: null`
- [ ] `MahjongDeclared` event shows to all players
- [ ] `HandValidated { valid: true }` triggers celebration animation
- [ ] Celebration animation plays (confetti, fireworks, 2s)
- [ ] Victory sound effect plays
- [ ] Winning overlay displays with pattern and score
- [ ] Scoring screen shows winner, pattern, payments, final scores
- [ ] `HandValidated { valid: false }` triggers invalid Mahjong flow
- [ ] Invalid Mahjong reveals hand to all players
- [ ] `HandDeclaredDead` event marks player as dead hand
- [ ] Dead hand player cannot win but continues discarding
- [ ] Game phase transitions to `GameOver` after valid Mahjong
- [ ] Heavenly Hand detected automatically for East with winning deal
- [ ] Heavenly Hand skips Charleston and awards double payment
- [ ] Bot auto-declares Mahjong after 1-2s delay
- [ ] Hard bots may strategically choose to discard instead of declare
- [ ] Optional: Client-side pre-validation shows button only when valid
- [ ] Component tests pass (MahjongConfirmationDialog, CelebrationOverlay, ScoringScreen)
- [ ] Integration tests pass (valid Mahjong, invalid Mahjong, Heavenly Hand flows)
- [ ] E2E test passes (full game → Mahjong → scoring → game over)
- [ ] Accessibility tests pass (keyboard nav, screen reader, animations)
- [ ] Visual regression tests pass (celebration overlay, scoring screen)
- [ ] Network error handling tested (retry logic)
- [ ] Manually tested against `user-testing-plan.md` (Part 4, Winning scenarios)
- [ ] Code reviewed and approved
- [ ] Performance tested (validation doesn't lag)
- [ ] No console errors or warnings

## Notes for Implementers

### Hand Validation (Histogram-Based)

The backend uses histogram-based validation for performance. From `crates/mahjong_core/src/rules/validator.rs`:

```rust
pub fn validate_hand(hand: &Hand, card_year: u16) -> Option<PatternMatch> {
    let hand_histogram = hand.to_histogram();

    for pattern in load_patterns(card_year) {
        for variation in pattern.variations {
            let deficiency = calculate_deficiency(&hand_histogram, &variation.histogram);
            if deficiency == 0 {
                return Some(PatternMatch {
                    pattern_name: pattern.name,
                    score: pattern.score,
                    section: pattern.section
                });
            }
        }
    }
    None
}
```

Frontend receives the result via `HandValidated` event; no need to implement validation logic unless doing client-side pre-validation.

### Client-Side Pre-Validation (Optional UX)

For better UX, frontend can pre-validate to show "Declare Mahjong" button only when likely valid:

```typescript
import { validateHand } from './validation/handValidator';

function detectMahjongOpportunity(hand: Tile[], cardYear: number): PatternMatch | null {
  // This requires loading NMJL card data in frontend
  return validateHand(hand, cardYear);
}

const mahjongOpportunity = useMemo(() => {
  if (turnStage === 'Discarding' && yourHand.length === 14) {
    return detectMahjongOpportunity(yourHand, currentCardYear);
  }
  return null;
}, [yourHand, turnStage, currentCardYear]);
```

**Trade-off**: Requires bundling NMJL card data (~500KB) in frontend. Server validation is always authoritative.

### Celebration Animation

```typescript
<CelebrationOverlay
  show={showCelebration}
  winner={winner}
  pattern={winningPattern}
  score={baseScore}
  duration={2000}  // 2 seconds
  onComplete={() => {
    setShowCelebration(false);
    setShowScoringScreen(true);
  }}
/>
```

Animation options:

- **Confetti**: Particles falling from top
- **Fireworks**: Burst effects
- **Tile Rain**: Winning tiles falling
- **Respect `prefers-reduced-motion`**: Static "MAHJONG!" text instead

### Scoring Screen

```typescript
<ScoringScreen
  winner={winner}
  pattern={winningPattern}
  baseScore={baseScore}
  payments={payments}
  finalScores={finalScores}
  isSelfDraw={true}
  onContinue={() => {
    // Show game over options
    setShowGameOverPanel(true);
  }}
/>
```

Display format:

```text
╔══════════════════════════════════════╗
║           MAHJONG!                   ║
║        South Wins!                   ║
╠══════════════════════════════════════╣
║ Pattern: Odds Only                   ║
║ Score: 35 points                     ║
║ Self-Draw Bonus: 2x                  ║
╠══════════════════════════════════════╣
║ Payments:                            ║
║   East pays South: 35 pts            ║
║   West pays South: 35 pts            ║
║   North pays South: 35 pts           ║
╠══════════════════════════════════════╣
║ Final Scores:                        ║
║   East: 465 (-35)                    ║
║   South: 605 (+105)                  ║
║   West: 480 (-35)                    ║
║   North: 450 (-35)                   ║
╚══════════════════════════════════════╝
```

### Heavenly Hand Detection

Heavenly Hand is server-side only. Frontend receives event:

```typescript
case 'HeavenlyHand':
  setShowHeavenlyHandOverlay(true);
  setHeavenlyHandPattern(event.pattern);
  setHeavenlyHandScore(event.base_score);
  // Skip Charleston, go directly to scoring
  break;
```

Display: "HEAVENLY HAND! East wins with initial deal! Pattern: [X], Score: [Y] (double payment)"

### Bot Mahjong Strategy

```typescript
function shouldBotDeclareMahjong(
  hand: Tile[],
  pattern: PatternMatch,
  difficulty: BotDifficulty
): boolean {
  switch (difficulty) {
    case 'Basic':
    case 'Easy':
      return true; // Always declare immediately

    case 'Medium':
      // Declare if score >= 30
      return pattern.score >= 30;

    case 'Hard':
      // Strategic evaluation: declare if expected value of current win
      // is higher than expected value of waiting for better pattern
      const currentEV = pattern.score;
      const futureEV = estimateFuturePatternEV(hand);
      return currentEV >= futureEV;
  }
}
```

### Zustand Store Updates

```typescript
case 'MahjongDeclared':
  state.mahjongDeclared = {
    player: event.player,
    pending: true
  };
  break;

case 'HandValidated':
  if (event.valid) {
    state.winningPlayer = event.player;
    state.winningPattern = event.pattern;
    state.showCelebration = true;
  } else {
    state.deadHands.push(event.player);
    state.revealedHands[event.player] = state.yourHand;  // Penalty: reveal hand
  }
  state.mahjongDeclared.pending = false;
  break;

case 'GameResult':
  state.gameResult = event;
  state.finalScores = calculateFinalScores(state.scores, event.payments);
  break;

case 'HeavenlyHand':
  state.heavenlyHand = {
    pattern: event.pattern,
    baseScore: event.base_score
  };
  state.skipCharleston = true;
  break;

case 'PhaseChanged':
  if (event.phase === 'GameOver') {
    state.phase = 'GameOver';
    state.gameOver = true;
  }
  break;
```

### Instant Animation Mode

When "Instant Animations" setting is enabled:

- Skip celebration animation (show static "MAHJONG!" overlay for 0.5s)
- Instantly display scoring screen
- Victory sound still plays
- Heavenly Hand overlay appears instantly

```

```
