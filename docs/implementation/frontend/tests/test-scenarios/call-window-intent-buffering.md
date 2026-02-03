# Test Scenario: Call Window & Intent Buffering

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-011 - Call Window & Intent Buffering
**Component Specs**: CallWindow.md, IntentBuffering.md, ActionBar.md
**Fixtures**: `playing-call-window.json`, `intent-buffering-sequence.json`
**Manual Test**: Manual Testing Checklist #11

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Current turn**: North (just discarded a tile)
- **Player hand**: 13 tiles (standard hand, no winning patterns)
- **Discard pile**: 9 tiles (North just discarded "7 Dot (26)")
- **Call window**: Open (5 seconds remaining)
- **Intent buffering**: Enabled (client-side buffering of call intents)

## Steps (Act)

### Step 1: Discard appears, call window opens

- North discards "7 Dot (26)"
- UI shows "7 Dot (26)" tile prominently in center or on discard pile
- CallWindow overlay appears for South (user)
- Buttons appear: "Call for Pung", "Call for Kong", "Pass"
- Timer shows 5 seconds countdown
- Audio cue plays (if sound enabled)
- Game log shows: "North discarded 7 Dot (26)"

### Step 2: User evaluates hand for call opportunities

- UI highlights matching tiles in user's hand:
  - User has two "7 Dots (26)" in hand
  - Tiles highlight with "can call" indicator
- "Call for Pung" button is **enabled** (user can complete Pung)
- "Call for Kong" button is **disabled** (user only has two, not three)
- User considers whether to call or pass

### Step 3: User declares Pung intent (buffered)

- User clicks "Call for Pung" button
- **Intent buffering**: Client immediately shows "Intent Submitted: Pung" with spinner
- CallWindow buttons become disabled ("Waiting for resolution...")
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Meld(Pung)`
  - `target_tile: 26 (7 Dot)`
- Intent is buffered locally (stored in client state) in case of disconnect

### Step 4: Other players also declare intents

- Simulated: East declares "Pass" (no interest)
- Simulated: West declares "Pass" (no interest)
- Simulated: North (discarder) cannot call their own discard
- Server receives intents from all players within call window

### Step 5: Server resolves call priority

- WebSocket receives `CallResolved` event:
  - `resolution: Meld(Pung, South)`
  - `all_intents: { East: Pass, South: Pung, West: Pass, North: N/A }`
- South's Pung intent is **accepted** (only caller)
- UI shows "You won the call with Pung!" notification

### Step 6: Server sends call confirmation

- WebSocket receives `CallConfirmed` event:
  - `caller: "South"`
  - `call_type: Pung`
  - `tile: 26 (7 Dot)`
- UI shows "Confirm Pung" dialog:
  - "You called Pung on 7 Dot (26)"
  - Shows the three tiles: [7 Dot, 7 Dot, 7 Dot]
  - "Confirm" and "Cancel" buttons

### Step 7: User confirms the call

- User clicks "Confirm" button
- WebSocket sends `ConfirmCall` command:
  - `call_type: Pung`
  - `tile: 26 (7 Dot)`
- UI shows "Processing call..." spinner

### Step 8: Server processes the call

- WebSocket receives `MeldExposed` event:
  - `player: "South"`
  - `meld_type: Pung`
  - `tiles: [26, 26, 26]` (three 7 Dots)
- UI updates:
  - User's hand removes two "7 Dots (26)"
  - Exposed meld appears on user's side of board: [7 Dot, 7 Dot, 7 Dot]
  - Discard pile removes "7 Dot (26)" from North's discard
- WebSocket receives `TurnChanged` event:
  - `player: "South"`
  - `stage: "Discarding"`
- UI shows "Your turn - discard a tile"
- ActionBar shows "Discard Tile" button (enabled)

### Step 9: User discards a tile

- User selects a tile (e.g., "3 Bam (2)") and clicks "Discard Tile"
- WebSocket sends `DiscardTile` command
- Turn proceeds normally (see `drawing-discarding.md`)

## Expected Outcome (Assert)

- ✅ Call window opened correctly on discard
- ✅ User successfully declared Pung intent
- ✅ Intent was buffered locally (for disconnect recovery)
- ✅ Call resolved correctly (South won with Pung)
- ✅ User confirmed the call
- ✅ Meld exposed correctly on board
- ✅ Turn changed to South (caller)
- ✅ WebSocket command/event sequence correct (DeclareCallIntent → CallResolved → CallConfirmed → ConfirmCall → MeldExposed → TurnChanged)
- ✅ UI state correctly reflects Playing phase, Discarding stage

## Error Cases

### Intent buffering on disconnect

- **When**: Connection lost after user clicks "Call for Pung" but before receiving `CallResolved`
- **Expected**: Client preserves intent in local buffer
- **Assert**:
  - On reconnect, client checks if intent was received by server
  - If received: shows current game state (may be resolved)
  - If not received: re-sends `DeclareCallIntent` command with buffered intent

### Multiple intents from same player

- **When**: User clicks "Call for Pung", then quickly clicks "Call for Kong" (shouldn't happen due to UI)
- **Expected**: Only first intent is sent, subsequent clicks ignored
- **Assert**: WebSocket receives only one `DeclareCallIntent` command

### Timer expires before user acts

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**:
  - Server receives no `DeclareCallIntent` from user
  - Call resolves to "NoAction"
  - UI shows "Call window closed" notification

### Server rejects call (invalid meld)

- **When**: User declares Pung but doesn't actually have two matching tiles
- **Expected**: Server validates and rejects via `CallRejected` event
- **Assert**:
  - WebSocket receives `CallRejected` event:
    - `reason: "Invalid meld - insufficient matching tiles"`
  - UI shows error: "Invalid call - you don't have enough matching tiles"
  - Call window closes, turn proceeds to next player

### Call window opens during user's turn

- **When**: User is about to discard, but another player's discard triggers call window
- **Expected**: Call window takes priority, user's discard action paused
- **Assert**:
  - CallWindow overlay appears
  - "Discard Tile" button disabled
  - After call resolution, user can resume discard

### Intent buffering overflow

- **When**: Multiple rapid discards trigger multiple call windows (edge case)
- **Expected**: Client buffers only the most recent intent
- **Assert**: Intent buffer contains only one intent at a time

## Intent Buffering Behavior

### What is Intent Buffering?

Intent buffering is a client-side mechanism that stores call intents locally to handle network instability:

1. **Immediate feedback**: User sees "Intent Submitted" immediately, even before server acknowledgment
2. **Disconnect recovery**: If connection drops after intent submission, client can re-send on reconnect
3. **Duplicate prevention**: Client tracks sent intents to avoid duplicate submissions

### Buffer Lifecycle

```
User clicks "Call for Pung"
  ↓
Intent stored in local buffer
  ↓
WebSocket sends DeclareCallIntent
  ↓
[Network may be unstable]
  ↓
Server receives intent (or not)
  ↓
Client receives CallResolved (or reconnects)
  ↓
Intent cleared from buffer
```

### Buffer State Management

- **Empty**: No intent pending
- **Pending**: Intent sent, waiting for resolution
- **Resolved**: Intent resolved, buffer cleared
- **Expired**: Call window closed without resolution, buffer cleared

## Cross-References

### Related Scenarios

- `calling-priority-mahjong.md` - Mahjong beats Pung/Kong
- `calling-priority-turn-order.md` - Turn order breaks ties
- `calling-pung-kong-quint-sextet.md` - Detailed meld calling flow
- `drawing-discarding.md` - Standard turn flow without calls

### Related Components

- [CallWindow](../../component-specs/game/CallWindow.md)
- [IntentBuffering](../../component-specs/game/IntentBuffering.md)
- [ActionBar](../../component-specs/game/ActionBar.md)
- [ExposedMeldsDisplay](../../component-specs/game/ExposedMeldsDisplay.md)

### Backend References

- Commands: `mahjong_core::command::DeclareCallIntent`, `ConfirmCall`
- Events: `mahjong_core::event::CallResolved`, `CallConfirmed`, `CallRejected`, `MeldExposed`, `TurnChanged`
- Logic: `mahjong_core::call_resolution::resolve_calls()`
- Buffering: Client-side implementation in `IntentBuffering` store

### Accessibility Notes

- Call window announced: "7 Dot (26) discarded by North, call window open, 5 seconds"
- Button options announced: "Call for Pung available, Press P. Call for Kong unavailable. Pass, Press Escape."
- Intent submission announced: "Intent submitted: Pung"
- Resolution announced: "You won the call with Pung!" or "Call resolved to another player"
- Confirmation dialog announced: "Confirm Pung on 7 Dot (26). Press Enter to confirm, Escape to cancel."
- Timer countdown announced at 3s, 1s
