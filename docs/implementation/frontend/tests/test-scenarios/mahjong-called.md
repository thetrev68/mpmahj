# Test Scenario: Declaring Mahjong (Called Discard)

**User Story**: US-019 (Declaring Mahjong via Called Discard)
**Component Specs**: MahjongDialog.md, CallWindow.md, HandValidator.md, ScoringScreen.md
**Fixtures**: `playing-call-window.json`, `near-win-one-away.json`
**Manual Test**: Manual Testing Checklist #19

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Player hand**: Load `fixtures/hands/near-win-one-away.json`
  - Hand contains 13 tiles matching a 2025 NMJL pattern except for one missing tile
  - Missing tile: "White Dragon"
  - Pattern: "2025 Singles and Pairs" (example)
- **Current turn**: East (about to discard)
- **Discard pile**: 15 tiles
- **Wall remaining**: 58 tiles

## Steps (Act)

### Step 1: Opponent discards winning tile

- East discards "White Dragon"
- WebSocket receives `TileDiscarded` event:
  - `player: "East"`
  - `tile: { suit: "Dragon", value: "White" }`
- Discard tile appears in center of board with emphasis (animation/highlight)
- Call window opens automatically

### Step 2: Call window appears for user

- CallWindow overlay slides in from bottom/center
- UI displays:
  - Discarded tile prominently: "White Dragon"
  - "Call for Mahjong" button (enabled, highlighted in gold/green)
  - "Pass" button
  - Timer: 5 seconds countdown with visual progress bar
- **Pattern hint** (optional): "This tile completes 'Singles and Pairs' - 25 points"

### Step 3: User evaluates winning condition

- Client-side validation runs: `canWinWithTile("White Dragon")`
  - Hand + White Dragon = 14 tiles
  - Matches pattern: "Singles and Pairs" (2025 card)
  - Validation passes ✅
- "Call for Mahjong" button glows/pulses to draw attention
- Game log shows: "White Dragon discarded by East - you can win!"

### Step 4: User declares Mahjong

- User clicks "Call for Mahjong" button
- WebSocket sends `IntentToCall` command:
  - `intent: "Mahjong"`
  - `tile: { suit: "Dragon", value: "White" }`
- UI immediately shows optimistic feedback:
  - Button changes to "Declaring..." with spinner
  - CallWindow shows "Validating hand..."
  - Other buttons disabled

### Step 5: Server validates and accepts

- WebSocket receives `CallResolved` event:
  - `winner: "South"`
  - `intent: "Mahjong"`
  - `tile: { suit: "Dragon", value: "White" }`
- No other players called, so no priority conflict
- CallWindow transitions to success state: "Mahjong Accepted! ✓"

### Step 6: Hand is exposed and validated

- WebSocket receives `MahjongDeclared` event:
  - `player: "South"`
  - `tile: { suit: "Dragon", value: "White" }` (called tile)
  - `pattern`:
    - `name: "Singles and Pairs"`
    - `section: "2468"` (example section)
    - `score: 25`
    - `concealed: false` (called discard = exposed)
  - `hand: [all 14 tiles]`
- UI exposes user's full hand on the game board:
  - Tiles arranged to show the winning pattern
  - Called "White Dragon" highlighted/marked differently (red border)
  - Pattern name displayed above/below hand

### Step 7: Scoring screen appears

- WebSocket receives `GameStateChanged` event:
  - `new_state: "Scoring"`
- ScoringScreen component renders:
  - **Winner**: South (You!) 🎉
  - **Pattern**: Singles and Pairs
  - **Score**: +75 (25 points × 3 losers)
  - **Breakdown**:
    - East (discarder): -25
    - West: -25
    - North: -25
- Celebration animation plays (confetti, sound effect, etc.)
- All players' hands are revealed (optional, based on settings)

### Step 8: Game over confirmation

- "New Game" button appears (if room owner)
- "Return to Lobby" button appears
- Game statistics updated (user's win count incremented)
- Replay option available: "View Replay"

## Expected Outcome (Assert)

- ✅ User successfully called Mahjong on opponent's discard
- ✅ Hand validation passed (14 tiles match NMJL pattern)
- ✅ Pattern correctly identified: "Singles and Pairs"
- ✅ Score calculated correctly: +75 (25 × 3)
- ✅ Game transitioned to Scoring → GameOver
- ✅ All players notified via events
- ✅ User's hand exposed on board with called tile highlighted
- ✅ WebSocket command/event flow correct

## Error Cases

### Invalid Mahjong declaration

- **When**: User clicks "Call for Mahjong" but hand doesn't actually match pattern
  - Possible causes:
    - Client-side validation bug (shouldn't enable button)
    - User modified hand via external tool (cheating attempt)
    - Rare edge case with Joker substitution rules
- **Expected**: Server rejects with `MahjongInvalid` event
- **Assert**:
  - WebSocket receives `DeadHandDeclared` event:
    - `player: "South"`
    - `reason: "InvalidMahjong"`
  - UI shows error modal: "Invalid Mahjong! Your hand is now dead and cannot win this game."
  - User's hand grayed out/marked with X
  - User can continue playing but cannot call or declare Mahjong
  - Game continues with remaining players

### Timer expires before declaration

- **When**: User hesitates and doesn't click within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**:
  - WebSocket receives `CallWindowClosed` event with `result: "NoAction"`
  - UI shows notification: "Call window closed - you passed"
  - Next player's turn begins
  - User missed winning opportunity

### Another player calls simultaneously

- **When**: Both South (user) and West declare Mahjong on same discard
- **Expected**: Turn order priority resolves winner
  - If East discarded: turn order is East → South → West → North
  - South is closer, so **user wins**
- **Assert**:
  - Server resolves to South
  - User receives successful `MahjongDeclared` event
  - West receives notification: "South won on turn order priority"

### Concealed vs. Exposed scoring

- **When**: User's pattern requires concealed hand but used called discard
- **Expected**: Score adjusts automatically (some patterns have concealed bonus)
- **Assert**:
  - Pattern metadata includes `concealed: false`
  - Score reflects exposed hand value (no concealed bonus)
  - UI shows pattern name without "(Concealed)" suffix

### WebSocket disconnect before validation

- **When**: Connection lost after clicking "Call for Mahjong" but before server responds
- **Expected**: Server still processes intent if received
- **Assert**:
  - On reconnect, client re-syncs to Scoring phase
  - User sees scoring screen (won) or game continues (lost connection before server received)
  - Event log shows full history

### Edge case: Joker substitution ambiguity

- **When**: User's hand has Jokers and could match multiple patterns
- **Expected**: Server selects highest-scoring valid pattern
- **Assert**:
  - `MahjongDeclared` event includes the highest-value pattern matched
  - UI explains why this pattern was chosen (optional tooltip)

## Client-Side Validation Logic

Pre-flight check before enabling "Call for Mahjong":

```typescript
function canWinWithTile(tile: Tile): boolean {
  const hand = [...playerHand, tile]; // 14 tiles total
  const validator = new HandValidator(card2025Patterns);
  const result = validator.validate(hand);
  return result.valid && result.patterns.length > 0;
}
```

Server-side validation (Rust):

- Uses `HandValidator::validate()` from `mahjong_core::rules::validator`
- Checks all 6000+ pre-compiled pattern histograms
- Handles Joker permutations
- Returns highest-scoring match

## Cross-References

### Related Scenarios

- `calling-priority-mahjong.md` - Priority conflict when multiple players call
- `mahjong-invalid.md` - Invalid declaration → Dead hand penalty
- `mahjong-self-draw.md` - Winning by drawing tile (not calling discard)
- `drawing-discarding.md` - Standard turn flow leading to discard

### Related Components

- [CallWindow](../../component-specs/game/CallWindow.md)
- [MahjongDialog](../../component-specs/game/MahjongDialog.md)
- [HandValidator](../../component-specs/game/HandValidator.md)
- [ScoringScreen](../../component-specs/game/ScoringScreen.md)
- [HandDisplay](../../component-specs/game/HandDisplay.md)
- [PatternHighlight](../../component-specs/game/PatternHighlight.md)

### Backend References

- Commands: `mahjong_core::command::IntentToCall`
- Events:
  - `mahjong_core::event::TileDiscarded`
  - `mahjong_core::event::CallResolved`
  - `mahjong_core::event::MahjongDeclared`
  - `mahjong_core::event::GameStateChanged`
  - `mahjong_core::event::DeadHandDeclared` (error case)
- Validation: `mahjong_core::rules::validator::HandValidator`
- Scoring: `mahjong_core::rules::scoring::calculate_scores()`

### Accessibility Notes

- Discard announced: "East discarded White Dragon, call window open"
- Button announced: "Call for Mahjong available, completes Singles and Pairs, 25 points. Press M to call."
- Timer countdown: Announced at 3s, 1s, "Time expired"
- Success announced: "Mahjong accepted! You won with Singles and Pairs, 25 points."
- Scoring announced: "You scored 75 points. East loses 25, West loses 25, North loses 25. Game over."
- Hand display: Each tile in winning hand announced with pattern position context
