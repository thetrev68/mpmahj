# Test Scenario: Call Priority - Mahjong Beats Pung

**User Story**: US-012 (Call Priority Resolution), US-019 (Declaring Mahjong via Called Discard)
**Component Specs**: CallWindow.md, MahjongDialog.md, IntentBuffering.md
**Fixtures**: `playing-call-window.json`, `call-window-sequence.json`, `near-win-one-away.json`
**Manual Test**: Manual Testing Checklist #12, #19

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: West
- **Player hand**: Load `fixtures/hands/near-win-one-away.json` (needs "5 Dot" for Mahjong)
- **Current turn**: North (just discarded "5 Dot")
- **Call window**: Open (5 seconds remaining)
- **Other players**:
  - **East**: Has two "5 Dots" in hand, wants to Pung the discard
  - **South**: Has no interest in the discard
  - **West (user)**: Needs "5 Dot" to complete winning hand

## Steps (Act)

### Step 1: Discard appears, call window opens

- North discards "5 Dot"
- UI shows "5 Dot" tile prominently in center or on discard pile
- CallWindow overlay appears for West (user)
- Buttons appear: "Call for Mahjong", "Call for Pung", "Pass" (or just "Mahjong" and "Pass" if user can't Pung)
- Timer shows 5 seconds countdown
- Audio cue plays (if sound enabled)

### Step 2: User evaluates hand

- UI optionally highlights the winning pattern if "5 Dot" is added
- User has a valid 2025 NMJL pattern (e.g., Consecutive Run with "5 Dot" as final tile)
- "Call for Mahjong" button is **enabled**
- User also has two "5 Dots" in hand, so "Call for Pung" is also available (hypothetically)

### Step 3: User declares Mahjong intent

- User clicks "Call for Mahjong" button
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Mahjong`
- UI shows "Intent Submitted: Mahjong" with spinner
- CallWindow buttons become disabled ("Waiting for resolution...")

### Step 4: Another player (East) also declares intent (Meld)

- Simultaneously (within call window), East sends `DeclareCallIntent` with `intent: Meld(Pung)`
- Server receives both intents before call window closes
- Server must resolve priority: **Mahjong > Meld**

### Step 5: Server resolves call priority

- WebSocket receives `CallResolved` event:
  - `resolution: Mahjong(West)`
- East's Pung intent is **rejected** (Mahjong takes priority)
- WebSocket receives `AwaitingMahjongValidation` event:
  - `caller: "West"`
  - `called_tile: "5 Dot"`
  - `discarded_by: "North"`
- UI shows "You called Mahjong!" notification

### Step 6: User validates Mahjong

- User sends `DeclareMahjong` command with:
  - `hand: [all 14 tiles]`
  - `winning_tile: "5 Dot"`
- WebSocket receives `HandValidated` event:
  - `player: "West"`
  - `valid: true`
  - `pattern: "Consecutive Run"`
- WebSocket receives `MahjongDeclared` event:
  - `player: "West"`
- UI displays user's full hand face-up on the board
- Pattern name shown in overlay: "Consecutive Run"
- Winning tile ("5 Dot") highlighted in hand display

### Step 7: Game ends and scoring is shown

- WebSocket receives `GameOver` event:
  - `winner: "West"`
  - `result: { ... }` (score breakdown and final scores)
- UI shows scoring summary:
  - Winner: West (user)
  - Pattern: Consecutive Run
  - Points: derived from `result`
  - Losers pay: derived from `result`
- "Next Game" or "Return to Lobby" buttons appear

## Expected Outcome (Assert)

- ✅ User successfully called Mahjong on discarded tile
- ✅ User's intent took priority over East's Pung intent
- ✅ Hand was validated against NMJL 2025 patterns
- ✅ Winning pattern correctly identified and displayed
- ✅ Game transitioned to Scoring phase
- ✅ All players notified of winner and scores
- ✅ WebSocket command/event sequence correct (DeclareCallIntent → CallResolved → AwaitingMahjongValidation → DeclareMahjong → HandValidated → MahjongDeclared → GameOver)

## Error Cases

### Invalid Mahjong claim

- **When**: User clicks "Call for Mahjong" but hand doesn't actually match any pattern
- **Expected**: Server validates and rejects via `HandValidated { valid: false }`
- **Assert**:
  - Client receives `HandDeclaredDead` event (`player: "West"`, `reason: "InvalidMahjong"`)
  - UI shows error: "Invalid Mahjong! Your hand is now dead."
  - User's hand marked as dead, cannot win for rest of game
  - See: `mahjong-invalid.md` scenario

### Timer expires before user acts

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**:
  - Server receives no `IntentToCall` from user
  - Call resolves to another player (East's Pung) or "NoAction"
  - UI shows "Call window closed" notification

### Multiple Mahjong intents (tie)

- **When**: Both West (user) and East declare Mahjong simultaneously
- **Expected**: Turn order priority: closest player clockwise wins
  - If North discarded, turn order is: East → South → West → North
  - East is closer to North than West, so **East wins**
- **Assert**:
  - Server resolves to East
  - User receives `CallResolved` with `winner: "East"`
  - UI shows "East called Mahjong" (user's intent was valid but lost on turn order)

### WebSocket disconnect during call window

- **When**: Connection lost after user clicks "Call for Mahjong"
- **Expected**:
  - If server received intent before disconnect: call proceeds, user reconnects to see result
  - If server didn't receive intent: user loses opportunity
- **Assert**:
  - Client re-syncs state on reconnect
  - If user won: shows scoring screen
  - If user lost opportunity: shows "Connection lost, call window closed"

### Calling on wrong tile

- **When**: User's hand needs "5 Dot" but North discarded "6 Dot"
- **Expected**: "Call for Mahjong" button should be **disabled** (client-side hinting only)
- **Assert**: Button's `disabled` state reflects `canWinWithTile(discardedTile) === false` but server remains authoritative

## Priority Resolution Matrix

Reference for testing all priority scenarios:

| User Intent | Other Player Intent | Winner Determined By       |
| ----------- | ------------------- | -------------------------- |
| Mahjong     | Mahjong             | Turn order (closest first) |
| Mahjong     | Pung/Kong/Quint     | Mahjong (always wins)      |
| Mahjong     | Pass                | User (Mahjong)             |
| Pung        | Pung                | Turn order                 |
| Pung        | Pass                | User (Pung)                |
| Pass        | Pass                | No action                  |

## Cross-References

### Related Scenarios

- `mahjong-called.md` - Detailed Mahjong declaration flow (no priority conflict)
- `mahjong-invalid.md` - Invalid Mahjong claim → Dead hand penalty
- `calling-priority-turn-order.md` - Turn order resolution when intents tied
- `drawing-discarding.md` - Basic turn flow without calls

### Related Components

- [CallWindow](../../component-specs/game/CallWindow.md)
- [IntentBuffering](../../component-specs/game/IntentBuffering.md)
- [MahjongDialog](../../component-specs/game/MahjongDialog.md)
- [HandValidator](../../component-specs/game/HandValidator.md)
- [ScoringScreen](../../component-specs/game/ScoringScreen.md)

### Backend References

- Commands: `mahjong_core::command::DeclareCallIntent`, `DeclareMahjong`
- Events:
  - `mahjong_core::event::CallResolved`
  - `mahjong_core::event::AwaitingMahjongValidation`
  - `mahjong_core::event::HandValidated`
  - `mahjong_core::event::MahjongDeclared`
  - `mahjong_core::event::GameOver`
- Logic: `mahjong_core::call_resolution::resolve_calls()` (Rust function handling priority)
- Validation: `mahjong_core::rules::validator::HandValidator::validate()`

### Accessibility Notes

- Call window announced: "5 Dot discarded by North, call window open, 5 seconds"
- Button options announced: "Call for Mahjong available, Press M. Call for Pung available, Press P. Pass, Press Escape."
- Timer countdown announced at 3s, 1s
- Resolution announced: "You won the call with Mahjong!" or "East won the call with Mahjong, turn order priority"
- Scoring details announced: "You won with Consecutive Run, 25 points. East loses 25, South loses 25, North loses 25."
