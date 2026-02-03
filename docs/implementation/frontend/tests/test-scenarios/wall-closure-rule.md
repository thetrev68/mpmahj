# Test Scenario: Wall Closure Rule

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-017 - Wall Closure Rule
**Component Specs**: WallDisplay.md, GameTable.md, TurnIndicator.md
**Fixtures**: `playing-wall-closure.json`, `wall-closure-sequence.json`
**Manual Test**: Manual Testing Checklist #17

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-wall-closure.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: South (user's turn is next)
- **Player hand**: 13 tiles (standard hand, no winning patterns)
- **Wall tiles remaining**: 14 tiles (approaching dead wall)
- **Dead wall**: 14 tiles (reserved, not drawable)
- **Game phase**: Playing

## Steps (Act)

### Step 1: Verify wall state before closure

- UI shows wall display with tile counts:
  - Main wall: 14 tiles remaining
  - Dead wall: 14 tiles (reserved)
- Wall indicator shows "14 tiles remaining"
- Game log shows: "Wall approaching closure - 14 tiles remaining"
- Turn indicator shows: "South's turn"

### Step 2: South draws a tile

- South (not user) draws a tile
- WebSocket receives `TileDrawnPublic` event:
  - `remaining_tiles: 13`
- UI updates wall display: "13 tiles remaining"
- Game log shows: "South drew a tile"

### Step 3: South discards a tile

- South discards "2 Bam (1)"
- WebSocket receives `TileDiscarded` event:
  - `player: "South"`
  - `tile: 1 (2 Bam)`
- Discard pile updates: "2 Bam (1)" appears on top
- Call window opens (no calls in this scenario)
- WebSocket receives `TurnChanged` event:
  - `player: "West"`
  - `stage: "Drawing"`

### Step 4: West draws a tile

- West draws a tile
- WebSocket receives `TileDrawnPublic` event:
  - `remaining_tiles: 12`
- UI updates wall display: "12 tiles remaining"
- Game log shows: "West drew a tile"

### Step 5: West discards a tile

- West discards "7 Crak (15)"
- WebSocket receives `TileDiscarded` event:
  - `player: "West"`
  - `tile: 15 (7 Crak)`
- Discard pile updates: "7 Crak (15)" appears on top
- Call window opens (no calls)
- WebSocket receives `TurnChanged` event:
  - `player: "North"`
  - `stage: "Drawing"`

### Step 6: North draws a tile

- North draws a tile
- WebSocket receives `TileDrawnPublic` event:
  - `remaining_tiles: 11`
- UI updates wall display: "11 tiles remaining"
- Game log shows: "North drew a tile"

### Step 7: North discards a tile

- North discards "4 Dot (20)"
- WebSocket receives `TileDiscarded` event:
  - `player: "North"`
  - `tile: 20 (4 Dot)`
- Discard pile updates: "4 Dot (20)" appears on top
- Call window opens (no calls)
- WebSocket receives `TurnChanged` event:
  - `player: "East"`
  - `stage: "Drawing"`

### Step 8: User (East) attempts to draw tile

- UI highlights user's rack with "Your Turn" glow
- ActionBar shows "Draw Tile" button (enabled)
- Turn timer starts: 30 seconds countdown
- User clicks "Draw Tile" button
- WebSocket sends `DrawTile` command

### Step 9: Server detects wall closure

- Server checks wall state: 11 tiles remaining
- Server applies wall closure rule:
  - If wall has ≤ 14 tiles, no more draws allowed
  - Game transitions to WallGame (draw)
- WebSocket receives `WallClosed` event:
  - `remaining_tiles: 11`
  - `reason: "Wall closure rule - insufficient tiles"`
- WebSocket receives `GameOver` event:
  - `outcome: "Draw"`
  - `reason: "Wall exhausted - no winner"`
- UI shows "Wall Game - Draw" overlay

### Step 10: Game ends with draw

- UI displays scoring summary:
  - Outcome: Draw (Wall Game)
  - No winner
  - All players: 0 points (no score changes)
- "Next Game" or "Return to Lobby" buttons appear
- Game log shows: "Wall closed - Game ends in draw"

## Expected Outcome (Assert)

- ✅ Wall closure rule triggered correctly when ≤ 14 tiles remaining
- ✅ User's draw attempt was rejected (wall already closed)
- ✅ Game transitioned to WallGame (draw)
- ✅ All players notified of draw outcome
- ✅ WebSocket event sequence correct (WallClosed → GameOver)
- ✅ UI correctly displays draw outcome and scoring

## Error Cases

### Drawing from closed wall

- **When**: User tries to draw after wall closure
- **Expected**: "Draw Tile" button disabled or command rejected
- **Assert**:
  - If button enabled: Server rejects `DrawTile` command with `CommandRejected` event
  - UI shows error: "Cannot draw - wall is closed"

### Wall closure with pending call

- **When**: Wall closes while call window is open
- **Expected**: Call window closes immediately, game ends in draw
- **Assert**:
  - `CallWindowClosed` event received
  - `WallClosed` event received
  - `GameOver` event with `outcome: "Draw"`

### Wall closure with Mahjong claim

- **When**: Player declares Mahjong on last drawable tile
- **Expected**: Mahjong takes priority over wall closure
- **Assert**:
  - `MahjongDeclared` event received
  - `GameOver` event with `winner: [player]`
  - No `WallClosed` event (Mahjong wins)

### Wall closure with multiple tiles remaining

- **When**: Wall has 15 tiles (just above closure threshold)
- **Expected**: Game continues normally
- **Assert**:
  - Players can still draw tiles
  - No `WallClosed` event until ≤ 14 tiles

### WebSocket disconnect during wall closure

- **When**: Connection lost during wall closure detection
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client re-syncs state
  - If wall closed: shows draw outcome
  - If wall not closed: resumes gameplay

## Wall Closure Rule Details

### What is the Wall Closure Rule?

The wall closure rule is a NMJL rule that ends the game in a draw when the wall has insufficient tiles for normal gameplay:

- **Threshold**: ≤ 14 tiles remaining in main wall
- **Dead wall**: 14 tiles reserved (never drawn from)
- **Outcome**: Wall Game (draw)
- **Scoring**: No points awarded or deducted

### When Does Wall Closure Occur?

Wall closure is checked after each draw:

```
Player draws tile
  ↓
Server checks: remaining_tiles ≤ 14?
  ↓
Yes → WallClosed event → GameOver (Draw)
No  → Continue gameplay
```

### Wall Closure vs. Wall Game

| Condition | Outcome |
|-----------|---------|
| Wall has 0 tiles (all drawn) | Wall Game (Draw) |
| Wall has ≤ 14 tiles | Wall Game (Draw) |
| Player declares Mahjong | Mahjong (Win) |
| Player declares invalid Mahjong | Dead Hand (Loss) |

### Edge Cases

1. **Last tile draw**: If wall has 1 tile and player draws it, wall closes
2. **Call on last tile**: If player calls last tile for Mahjong, Mahjong wins
3. **Multiple calls on last tile**: Priority rules apply (Mahjong > Meld > Pass)

## Cross-References

### Related Scenarios

- `drawing-discarding.md` - Standard turn flow
- `wall-game.md` - Wall exhausted (0 tiles remaining)
- `mahjong-self-draw.md` - Mahjong on self-drawn tile
- `mahjong-called.md` - Mahjong on called discard

### Related Components

- [WallDisplay](../../component-specs/game/WallDisplay.md)
- [GameTable](../../component-specs/game/GameTable.md)
- [TurnIndicator](../../component-specs/game/TurnIndicator.md)
- [ScoringScreen](../../component-specs/game/ScoringScreen.md)

### Backend References

- Commands: `mahjong_core::command::DrawTile`
- Events: `mahjong_core::event::TileDrawnPublic`, `WallClosed`, `GameOver`
- Logic: `mahjong_core::game_flow::check_wall_closure()`
- Rules: NMJL rulebook section on wall closure

### Accessibility Notes

- Wall state announced: "14 tiles remaining in wall"
- Wall closure announced: "Wall closed - Game ends in draw"
- Draw outcome announced: "Wall Game - Draw. No winner. All players score 0 points."
- Turn transition announced: "Your turn ended, West's turn begins"
- "Draw Tile" button announced: "Draw tile from wall, 14 tiles remaining"
