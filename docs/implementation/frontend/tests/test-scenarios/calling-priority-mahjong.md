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

## Test Flow (Act & Assert)

### Scenario: West calls Mahjong, East calls Pung - Mahjong wins

1. **When**: North (seat 0) discards "5 Dot (22)"
2. **Receive**: `CallWindowOpened { discard: 22, caller: North, time_limit: 5 }`
3. **West can Mahjong**: Hand completes to valid pattern with tile 22
4. **East can Pung**: Has two "5 Dots (22)" in hand
5. **Send (West)**: `DeclareCallIntent { player: West, intent: Mahjong }`
6. **Send (East)**: `DeclareCallIntent { player: East, intent: Meld(Pung) }` (simultaneous)
7. **Server priority**: Mahjong > Pung (regardless of turn order)
8. **Receive**: `CallResolved { resolution: Mahjong, winner: West }`
9. **Assert**: East's Pung intent rejected, only West proceeds
10. **Receive**: `AwaitingMahjongValidation { caller: West, called_tile: 22, discarded_by: North }`
11. **Send**: `DeclareMahjong { player: West, hand: [all 14 tiles], winning_tile: 22 }`
12. **Receive**: `HandValidated { player: West, valid: true, pattern: "Consecutive Run" }`
13. **Receive**: `MahjongDeclared { player: West }`
14. **Receive**: `GameOver { winner: West, points: 25, pattern: "Consecutive Run" }`
15. **Assert**: West wins, East's call denied, game ends

## Success Criteria

- ✅ CallWindowOpened event received when discard occurs
- ✅ DeclareCallIntent sent for both Mahjong and Pung
- ✅ Server resolves to Mahjong (higher priority than Pung)
- ✅ CallResolved event shows West wins call
- ✅ Hand validated against NMJL patterns (valid: true)
- ✅ MahjongDeclared and GameOver events received
- ✅ East's Pung call rejected (not processed)

## Error Cases

### Invalid Mahjong Claim

- **When**: DeclareCallIntent sent for Mahjong but hand doesn't match any pattern
- **Expected**: `HandValidated { valid: false, reason: "NoMatchingPattern" }`
- **Receive**: `HandDeclaredDead { player: West, reason: InvalidMahjong }`
- **Assert**: Hand marked dead, game continues without West

### Timer Expires (No Call Intent)

- **When**: No DeclareCallIntent sent within time_limit
- **Expected**: Call window closes, treated as Pass
- **Receive**: `CallResolved { resolution: NoAction }` or another player's call
- **Assert**: Turn advances, West missed opportunity

### Multiple Mahjong Intents (Turn Order Tie-Break)

- **When**: West and East both send DeclareCallIntent with Mahjong
- **Expected**: Turn order priority (closest counterclockwise from discarder wins)
- **Assert**: If North discards, East (seat 1) wins over West (seat 3)
- **Receive**: `CallResolved { resolution: Mahjong, winner: East }`

### Disconnect During Call Window

- **When**: Connection lost after sending DeclareCallIntent
- **Expected**: Server preserves intent, processes when reconnected
- **Assert**: On reconnect, receive GameOver if won, or CallResolved if lost
