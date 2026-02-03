# Test Scenario: Call Window & Intent Buffering

**User Story**: US-011 - Call Window & Intent Buffering
**Fixtures**: `playing-call-window.json`, `intent-buffering-sequence.json`

## Setup

- Game state: Playing, CallWindow phase
- User seated as: South
- Current turn: North (just discarded "7 Dot")
- Player hand: 13 tiles
- Call window: Open (5 seconds)

## Test Flow (Act & Assert)

1. **When**: North discards "7 Dot", call window opens
2. **User hand**: Two matching "7 Dots" present
3. **User action**: Clicks "Call for Pung" button
4. **Send**: `DeclareCallIntent { intent: Meld(Pung), target_tile: 7Dot }`
5. **Intent buffered**: Stored locally for disconnect recovery
6. **Receive**: `CallResolved { resolution: Meld(Pung, South) }`
7. **Receive**: `CallConfirmed { call_type: Pung, tile: 7Dot }`
8. **User confirms**: Clicks "Confirm" button
9. **Send**: `ConfirmCall { call_type: Pung, tile: 7Dot }`
10. **Receive**: `MeldExposed { player: South, meld_type: Pung, tiles: [7Dot, 7Dot, 7Dot] }`
11. **Assert**: Hand removes 2 tiles, meld exposed on board
12. **Receive**: `TurnChanged { player: South, stage: Discarding }`

## Success Criteria

- ✅ Intent declared and buffered locally
- ✅ Call resolved to South with Pung
- ✅ User confirmed meld
- ✅ Meld exposed on board (3 tiles shown)
- ✅ Hand reduced by 2 tiles
- ✅ Turn changed to South (Discarding)
- ✅ Event sequence: DeclareCallIntent → CallResolved → CallConfirmed → ConfirmCall → MeldExposed → TurnChanged

## Error Cases

### Intent buffering on disconnect

- **When**: Connection lost after user clicks "Call for Pung" but before `CallResolved`
- **Expected**: Client preserves intent locally
- **Assert**: On reconnect, intent is re-sent if not yet resolved by server

### Timer expires before user acts

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**: No `DeclareCallIntent` sent, turn proceeds to next player

### Server rejects call (invalid meld)

- **When**: User declares Pung without 2 matching tiles
- **Expected**: Server validates and rejects via `CallRejected`
- **Assert**: UI shows error, call window closes
