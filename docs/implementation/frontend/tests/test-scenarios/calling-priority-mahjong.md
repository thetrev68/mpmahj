# Test Scenario: Call Priority - Mahjong Beats Pung

**User Story**: US-012 (Call Priority Resolution), US-019 (Declaring Mahjong via Called Discard)
**Fixtures**: `playing-call-window.json`, `call-window-sequence.json`, `near-win-one-away.json`

## Setup

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: West (needs "5 Dot (22)" for Mahjong)
- **Player hand**: 13 tiles matching 2025 NMJL pattern with "5 Dot (22)" as winning tile
- **Current turn**: North (just discarded "5 Dot (22)")
- **Call window**: Open (5 seconds)
- **Other player**: East (has two "5 Dots (22)", wants to Pung)

## Test Flow

1. North discards "5 Dot (22)"
2. CallWindow overlay appears with: "Call for Mahjong", "Call for Pung", "Pass"
3. Timer shows 5 seconds
4. "Call for Mahjong" button enabled (hand completes to valid pattern)
5. User clicks "Call for Mahjong" button
6. WebSocket sends `DeclareCallIntent { intent: Mahjong }`
7. UI shows "Intent Submitted: Mahjong" spinner
8. East simultaneously sends `DeclareCallIntent { intent: Meld(Pung) }`
9. Server receives both intents (Mahjong > Pung priority)
10. WebSocket receives `CallResolved { resolution: Mahjong(West) }`
11. East's Pung intent rejected
12. UI shows "You called Mahjong!" notification
13. WebSocket receives `AwaitingMahjongValidation { caller: "West", called_tile: 22, discarded_by: "North" }`
14. User sends `DeclareMahjong { hand: [all 14 tiles], winning_tile: 22 }`
15. WebSocket receives `HandValidated { player: "West", valid: true, pattern: "Consecutive Run" }`
16. UI displays full hand face-up with pattern name
17. WebSocket receives `MahjongDeclared { player: "West" }`
18. WebSocket receives `GameOver { winner: "West", result: {...} }`
19. UI shows scoring: "You won with Consecutive Run, 25 points"

## Expected Outcome

- ✅ Successfully called Mahjong on discarded tile
- ✅ Intent took priority over East's Pung
- ✅ Hand validated against NMJL 2025 patterns
- ✅ Pattern identified and displayed
- ✅ Game transitioned to Scoring
- ✅ Command/event sequence correct

## Error Cases

### Invalid Mahjong Claim

- **When**: User clicks "Call for Mahjong" but hand doesn't match any pattern
- **Expected**: Server rejects via `HandValidated { valid: false }`
- **Assert**: Client receives `HandDeclaredDead { reason: "InvalidMahjong" }`, UI shows error, hand marked dead

### Timer Expires Before User Acts

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**: No `DeclareCallIntent` sent, call resolves to another player or "NoAction"

### Multiple Mahjong Intents (Tie)

- **When**: West and East both declare Mahjong simultaneously
- **Expected**: Turn order priority (closest counterclockwise from discarder)
- **Assert**: Server resolves to correct player, loser notified who won

### WebSocket Disconnect During Call Window

- **When**: Connection lost after clicking "Call for Mahjong"
- **Expected**: Client reconnects and syncs state
- **Assert**: If won, shows scoring; if lost opportunity, shows "Connection lost"
