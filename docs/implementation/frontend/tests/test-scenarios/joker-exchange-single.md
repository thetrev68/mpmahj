# Test Scenario: Exchanging a Joker (Single Exchange)

**User Story**: US-014 (Exchanging Joker - Single)
**Component Specs**: ExposedMeldsDisplay.md, JokerExchangeDialog.md, ActionBar.md
**Fixtures**: `playing-drawing.json`, `with-jokers.json`
**Manual Test**: Manual Testing Checklist #14

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: East (user's turn, after drawing)
- **Player hand**: Load `fixtures/hands/with-jokers.json`
  - Hand contains: 2 Jokers, 12 regular tiles
  - Hand contains specific tile: "6 Crak" (natural tile to exchange)
- **Turn stage**: Discarding (user has 14 tiles after drawing)
- **Opponent exposed melds**:
  - **South** has exposed **Pung**: Joker, "3 Bam", "3 Bam" (Joker substituting for third "3 Bam")
  - **West** has exposed **Kong**: "Red Dragon", "Red Dragon", Joker, "Red Dragon" (Joker substituting for fourth Red Dragon)

## Steps (Act)

### Step 1: User identifies exchange opportunity

- UI highlights South's Pung containing a Joker
- User has a natural "3 Bam" in hand that can replace the Joker
- ActionBar shows "Exchange Joker" button (enabled) in addition to "Discard Tile"
- Turn timer is running (30 seconds remaining)

### Step 2: User initiates Joker exchange

- User clicks "Exchange Joker" button
- JokerExchangeDialog modal opens:
  - **Title**: "Exchange Joker from Exposed Meld"
  - **Prompt**: "Select a Joker to exchange and the natural tile from your hand"
  - **Section 1**: "Available Jokers" (shows opponent melds containing Jokers)
    - South's Pung: Joker (substituting "3 Bam") - clickable
    - West's Kong: Joker (substituting "Red Dragon") - clickable
  - **Section 2**: "Your Natural Tiles" (shows tiles in user's hand that can replace a Joker)
    - "3 Bam" (can replace South's Joker) - enabled
    - "Red Dragon" (can replace West's Joker) - grayed out (user doesn't have it)
  - **Buttons**: "Confirm Exchange", "Cancel"

### Step 3: User selects Joker to exchange

- User clicks on South's Joker in the Pung
- Joker highlights with selection border
- UI filters "Your Natural Tiles" to show only "3 Bam" (the natural tile that matches)

### Step 4: User selects natural tile from hand

- User clicks "3 Bam" in the hand section
- "3 Bam" highlights with selection border
- "Confirm Exchange" button becomes enabled
- UI preview shows:
  - **Before**: South's Pung = [Joker, 3 Bam, 3 Bam]
  - **After**: South's Pung = [3 Bam, 3 Bam, 3 Bam]
  - **Your hand**: "3 Bam" removed, Joker added

### Step 5: User confirms exchange

- User clicks "Confirm Exchange" button
- WebSocket sends `ExchangeJoker` command:
  - `target_seat: "South"`
  - `meld_index: 0` (South's first exposed meld)
  - `replacement: "3 Bam"`
- JokerExchangeDialog shows spinner: "Processing exchange..."

### Step 6: Server validates and processes

- Server validates:
  - ✅ It's user's turn
  - ✅ User has "3 Bam" in hand
  - ✅ South's meld contains a Joker substituting for "3 Bam"
  - ✅ Exchange is legal per NMJL rules
- WebSocket receives `JokerExchanged` event:
  - `player: "East"` (user)
  - `target_seat: "South"`
  - `joker: "Joker"`
  - `replacement: "3 Bam"`

### Step 7: UI updates

- JokerExchangeDialog closes with success animation
- **User's hand updates**:
  - "3 Bam" removed
  - Joker added
  - Hand still has 14 tiles (must discard next)
- **South's exposed meld updates**:
  - Joker replaced with "3 Bam"
  - Meld now shows: [3 Bam, 3 Bam, 3 Bam] (all natural tiles)
- ActionBar updates:
  - "Exchange Joker" button disabled (can only exchange once per turn)
  - "Discard Tile" button remains enabled
- Game log shows: "East exchanged Joker from South's Pung with 3 Bam"

### Step 8: User discards a tile

- User must still discard a tile (has 14 tiles)
- User selects a tile (e.g., "7 Dot") and clicks "Discard Tile"
- WebSocket sends `DiscardTile` command
- Turn proceeds normally (see `drawing-discarding.md`)

## Expected Outcome (Assert)

- ✅ User successfully exchanged a natural tile for a Joker in opponent's meld
- ✅ User's hand now contains a Joker (increased strategic flexibility)
- ✅ Opponent's meld updated to all natural tiles
- ✅ Exchange only allowed once per turn (button disabled after)
- ✅ User still required to discard (14 tiles total)
- ✅ WebSocket command/event sequence correct
- ✅ UI state updates reflected on both user's hand and opponent's board

## Error Cases

### Attempting to exchange without natural tile

- **When**: User tries to exchange West's Joker (substituting "Red Dragon") but doesn't have "Red Dragon"
- **Expected**: West's Joker is not clickable/selectable in the dialog
- **Assert**: UI grays out or hides Jokers user cannot exchange (no matching natural tile)

### Attempting to exchange out of turn

- **When**: User clicks "Exchange Joker" when it's not their turn (button should be disabled)
- **Expected**: Button is disabled, no dialog opens
- **Assert**: ActionBar correctly disables "Exchange Joker" when `currentTurn !== userSeat`

### Attempting multiple exchanges in one turn

- **When**: User exchanges one Joker, then tries to exchange another
- **Expected**: "Exchange Joker" button disabled after first exchange
- **Assert**:
  - After `JokerExchanged` event, button state updates to `disabled`
  - User can exchange again on their next turn
  - See `joker-exchange-multiple.md` for variant rules allowing multiple exchanges

### Attempting to exchange from a Pair

- **When**: Opponent has exposed Pair: [Joker, "5 Dot"], user has "5 Dot"
- **Expected**: Joker in Pair cannot be exchanged (NMJL rule: Pairs must stay as-is in most cases)
- **Assert**:
  - JokerExchangeDialog only shows Jokers in Pungs, Kongs, Quints, Sextets
  - Pairs are excluded from "Available Jokers" list
  - Exception: Some patterns allow Joker Pairs; validation depends on pattern

### Server rejects exchange (race condition)

- **When**: User sends `ExchangeJoker` command, but turn has already changed (network delay)
- **Expected**: Server responds with error event: `CommandRejected`
- **Assert**:
  - WebSocket receives `CommandRejected` event:
    - `command: "ExchangeJoker"`
    - `reason: "Not your turn"`
  - UI shows error toast: "Exchange failed - not your turn"
  - Hand and meld states remain unchanged

### WebSocket disconnect during exchange

- **When**: Connection lost after clicking "Confirm Exchange"
- **Expected**:
  - If server received command: exchange processes, state syncs on reconnect
  - If server didn't receive: dialog remains open, user can retry
- **Assert**:
  - On reconnect, client checks latest game state
  - If exchange succeeded: hand + meld updated
  - If exchange failed: dialog re-opens with retry option

### Timer expires during exchange dialog

- **When**: User opens JokerExchangeDialog but doesn't confirm within 30 seconds
- **Expected**: Server auto-closes turn, randomly discards a tile (no exchange happens)
- **Assert**:
  - Client receives `TileDiscarded` event with auto-played tile
  - JokerExchangeDialog force-closes
  - Notification: "Turn timed out - auto-discarded"

## Strategic Notes

Why exchange Jokers?

1. **Flexibility**: Jokers can substitute for any tile, giving user more options for completing patterns
2. **Blocking**: Prevents opponent from using that natural tile in their pattern
3. **Pattern completion**: User may need natural tiles and can spare one to gain a Joker

When NOT to exchange:

- User already has many Jokers (2+ in hand)
- Natural tile is critical for user's own pattern
- Exchange would help opponent by completing their hand

## Cross-References

### Related Scenarios

- `joker-exchange-multiple.md` - Multiple exchanges in one turn (variant rule)
- `drawing-discarding.md` - Standard turn flow after exchange
- `meld-upgrade.md` - Adding tiles to existing melds (related concept)

### Related Components

- [ExposedMeldsDisplay](../../component-specs/game/ExposedMeldsDisplay.md)
- [JokerExchangeDialog](../../component-specs/game/JokerExchangeDialog.md)
- [ActionBar](../../component-specs/game/ActionBar.md)
- [PlayerRack](../../component-specs/game/PlayerRack.md)
- [MeldHighlight](../../component-specs/game/MeldHighlight.md)

### Backend References

- Commands: `mahjong_core::command::ExchangeJoker`
- Events: `mahjong_core::event::JokerExchanged`
- Validation: `mahjong_core::rules::joker::validate_exchange()`
- Rules: NMJL rulebook section on Joker exchanges (not in code; reference material)

### Accessibility Notes

- "Exchange Joker" button announced: "Exchange Joker from exposed meld, available"
- Dialog announced: "Joker exchange dialog opened. 2 Jokers available for exchange."
- Selection announced: "Selected Joker from South's Pung, substituting 3 Bamboo. Select natural 3 Bamboo from your hand to exchange."
- Confirmation announced: "Exchange confirmed. 3 Bamboo replaced Joker in South's Pung. You received the Joker."
- Meld update announced: "South's Pung updated: 3 Bamboo, 3 Bamboo, 3 Bamboo, all natural tiles."
- Keyboard navigation: Tab through Jokers and natural tiles, Space to select, Enter to confirm
