# Test Scenario: Calling Pung, Kong, Quint, and Sextet

**User Story**: US-013 - Calling Pung/Kong/Quint/Sextet
**Fixtures**: `playing-call-window.json`, `meld-calling-sequence.json`

## Setup

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: West
- **Current turn**: North (just discarded a tile)
- **Player hand**: 13 tiles with meld opportunities
- **Call window**: Open (5 seconds remaining)

## Test Flow - Calling Pung

1. North discards "5 Bam (4)"
2. CallWindow overlay appears with: "Call for Pung", "Call for Kong", "Call for Quint", "Pass"
3. Timer shows 5 seconds
4. User has two "5 Bams (4)" in hand - "Call for Pung" button enabled
5. User clicks "Call for Pung" button
6. WebSocket sends `DeclareCallIntent { intent: Meld(Pung), target_tile: 4 (5 Bam) }`
7. UI shows "Intent Submitted: Pung" spinner
8. WebSocket receives `CallResolved { resolution: Meld(Pung, West) }`
9. UI shows "You won the call with Pung!" notification
10. WebSocket receives `CallConfirmed` event
11. UI shows "Confirm Pung" dialog: [5 Bam, 5 Bam, 5 Bam]
12. User clicks "Confirm" button
13. WebSocket sends `ConfirmCall` command
14. WebSocket receives `MeldExposed { player: "West", meld_type: Pung, tiles: [4, 4, 4] }`
15. Hand removes 2 "5 Bams (4)", exposed meld appears
16. WebSocket receives `TurnChanged { player: "West", stage: "Discarding" }`
17. User now discards from 14-tile hand

## Expected Outcome - Pung

- ✅ Successfully called Pung on 5 Bam (4)
- ✅ Meld exposed correctly on board
- ✅ Turn changed to West (caller)
- ✅ Command/event sequence correct

## Meld Types and Button Logic

| Meld Type | Tiles Required | Button Enabled When |
|-----------|---|---|
| Pung | 2 in hand + 1 discard | `matchingTiles.length >= 2` |
| Kong | 3 in hand + 1 discard | `matchingTiles.length >= 3` |
| Quint | 4 in hand + 1 discard | `matchingTiles.length >= 4` |
| Sextet | 5 in hand + 1 discard | `matchingTiles.length >= 5` |

## Error Cases

### Calling with Insufficient Tiles

- **When**: User clicks "Call for Kong" with only 2 matching tiles
- **Expected**: Button disabled (client-side validation)
- **Assert**: `disabled` reflects `matchingTiles.length < 3`

### Server Rejects Invalid Meld

- **When**: User declares Pung without 2 matching tiles
- **Expected**: Server rejects via `CallRejected` event
- **Assert**: UI shows "Invalid call - you don't have enough matching tiles"

### Timer Expires

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**: `DeclareCallIntent` not sent, UI shows "Call window closed"

### Multiple Players Call Same Meld

- **When**: West and East both declare Pung on same discard
- **Expected**: Turn order priority wins (closest counterclockwise from discarder)
- **Assert**: Server resolves to correct player, loser shown who won
