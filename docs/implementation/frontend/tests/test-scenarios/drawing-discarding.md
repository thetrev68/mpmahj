# Test Scenario: Drawing and Discarding (Standard Turn Flow)

**User Story**: US-009 (Drawing a Tile), US-010 (Discarding a Tile)
**Component Specs**: PlayerRack.md, DiscardPile.md, ActionBar.md
**Fixtures**: `playing-drawing.json`, `turn-flow-sequence.json`
**Manual Test**: Manual Testing Checklist #9, #10

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: South
- **Current turn**: South (user's turn)
- **Player hand**: 13 tiles (standard hand, no winning patterns)
- **Wall tiles remaining**: 72 tiles
- **Discard pile**: 8 tiles from previous turns
- **Turn stage**: Drawing

## Steps (Act)

### Step 1: Verify turn begins (Drawing stage)

- UI highlights user's rack with "Your Turn" glow
- ActionBar shows "Draw Tile" button (enabled)
- Other action buttons disabled (Discard, Call, Mahjong)
- Turn timer starts: 30 seconds countdown
- Game log shows "South's turn"

### Step 2: User draws a tile

- User clicks "Draw Tile" button
- WebSocket sends `DrawTile` command (no payload)
- "Draw Tile" button becomes disabled
- UI shows tile-drawing animation (optional, based on settings)

### Step 3: Server responds with TileDrawn event

- WebSocket receives `TileDrawn` event:
  - `player: "South"`
  - `tile: { suit: "Bam", value: 5 }` (visible to user only)
  - `source: "Wall"`
- Drawn tile appears in user's hand with highlight/glow
- Hand now contains 14 tiles
- Turn stage advances to Discarding
- ActionBar updates: "Discard Tile" enabled, "Mahjong" enabled (if applicable)

### Step 4: User considers hand (no Mahjong)

- UI checks: Does hand + new tile = winning pattern?
  - Result: No valid patterns matched
  - "Mahjong" button remains disabled or shows as unavailable
- User scans hand to decide which tile to discard

### Step 5: User selects tile to discard

- User clicks on tile at index 7 (e.g., "3 Crak")
- Tile highlights with "discard selection" border (different color than Charleston)
- "Discard Tile" button label updates to "Discard 3 Crak"

### Step 6: User discards selected tile

- User clicks "Discard Tile" button
- WebSocket sends `DiscardTile` command:
  - `tile: { suit: "Crak", value: 3 }`
- Tile animates from hand to discard pile (if animations enabled)
- Tile disappears from hand (13 tiles remain)

### Step 7: Server responds with TileDiscarded event

- WebSocket receives `TileDiscarded` event:
  - `player: "South"`
  - `tile: { suit: "Crak", value: 3 }`
- Discard pile updates: "3 Crak" appears on top
- Call window opens: 5-second timer for other players
- UI shows "Call Window Open" indicator
- User's turn ends, UI removes "Your Turn" highlight

### Step 8: Call window resolves (no calls)

- WebSocket receives `CallWindowClosed` event:
  - `result: "NoAction"`
- Next player's turn begins (West)
- UI updates: "West's turn" in game log
- ActionBar returns to disabled state (not user's turn)

## Expected Outcome (Assert)

- ✅ User successfully drew a tile from the wall
- ✅ User's hand temporarily had 14 tiles
- ✅ User discarded 1 tile, returning to 13 tiles
- ✅ Discarded tile visible in discard pile
- ✅ Turn advanced to next player (West)
- ✅ WebSocket commands sent in correct sequence
- ✅ UI state correctly reflects Playing phase, Discarding stage
- ✅ Turn timer reset for next player

## Error Cases

### Drawing out of turn

- **When**: User clicks "Draw Tile" when it's not their turn (button should be disabled)
- **Expected**: Button is disabled, no command sent
- **Assert**: ActionBar correctly disables buttons based on `currentTurn !== userSeat`

### Discarding without drawing first

- **When**: User tries to discard before drawing (edge case if UI state desyncs)
- **Expected**: Server rejects command with error event: "Cannot discard during Drawing stage"
- **Assert**: Client shows error toast, doesn't modify UI state

### Discarding wrong tile count

- **When**: User has 14 tiles but somehow tries to discard without selecting a tile
- **Expected**: "Discard Tile" button remains disabled until a tile is selected
- **Assert**: Button's `disabled` state reflects `selectedTile === null`

### Timer expiry during Drawing

- **When**: User doesn't draw within 30 seconds
- **Expected**: Server auto-draws a tile, immediately auto-discards a random tile
- **Assert**: Client receives `TileDrawn` + `TileDiscarded` events in sequence, shows "Auto-played due to timeout"

### Timer expiry during Discarding

- **When**: User draws but doesn't discard within 30 seconds
- **Expected**: Server auto-discards a random non-winning tile
- **Assert**: Client receives `TileDiscarded` event, shows notification

### WebSocket disconnect during discard

- **When**: Connection lost after clicking "Discard Tile" but before receiving confirmation
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**: On reconnect, state syncs from server (tile may or may not be discarded depending on server receipt)

### Attempting to draw from empty wall

- **When**: Wall has 0 drawable tiles (shouldn't happen; dead wall rule prevents this)
- **Expected**: Server transitions to WallGame (draw) instead of allowing draw
- **Assert**: Client receives `GameOver` event with `outcome: "Draw"`

## Performance Checks

- ✅ Tile animation completes within 500ms (or instant if animations disabled)
- ✅ Hand re-sort after draw completes within 100ms
- ✅ No visual lag between command send and optimistic UI update

## Cross-References

### Related Scenarios

- `calling-priority-mahjong.md` - When another player calls the discard
- `mahjong-self-draw.md` - When drawn tile completes a winning hand
- `joker-exchange-single.md` - Exchanging a Joker on user's turn
- `wall-game.md` - Wall exhausted before any player wins

### Related Components

- [PlayerRack](../../component-specs/game/PlayerRack.md)
- [DiscardPile](../../component-specs/game/DiscardPile.md)
- [ActionBar](../../component-specs/game/ActionBar.md)
- [TurnIndicator](../../component-specs/game/TurnIndicator.md)
- [CallWindowTimer](../../component-specs/game/CallWindowTimer.md)

### Backend References

- Commands: `mahjong_core::command::DrawTile`, `DiscardTile`
- Events: `mahjong_core::event::TileDrawn`, `TileDiscarded`, `CallWindowOpened`, `CallWindowClosed`
- State: `GameState::Playing(TurnStage::Drawing)` → `Playing(TurnStage::Discarding)`

### Accessibility Notes

- "Draw Tile" button announces: "Draw tile from wall, 72 tiles remaining"
- Drawn tile announced: "Drew 5 Bamboo, you now have 14 tiles"
- Discard selection announced: "3 Crack selected for discard"
- Turn transition announced: "Your turn ended, West's turn begins"
- Turn timer announces at 10s, 5s, "Time expired"
