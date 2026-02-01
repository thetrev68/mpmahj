# Test Scenario: Wall Game - Draw from Exhausted Wall

**User Story**: US-031 (Draw/Wall Exhaustion)
**Component Specs**: GameBoard.md, GameOverDialog.md, WallDisplay.md
**Fixtures**: `game-states/wall-near-empty.json`, `event-sequences/wall-exhausted.json`

## Setup (Arrange)

- Game state: Playing phase, main gameplay
- Mock WebSocket: connected
- User seated as: South (seat 1)
- Wall has exactly 1 tile remaining
- No player has declared Mahjong
- Current turn: East player

## Steps (Act)

1. East player draws the last tile from wall
2. Server emits `TileDrawn` event with `last_tile: true` flag
3. UI shows wall count: "0 tiles remaining"
4. East player discards a tile
5. No players call the discard
6. Server attempts to advance to next turn (South)
7. Server detects wall is empty (no tiles to draw)
8. Server emits `GameOver` event with outcome: `WallExhausted`
9. UI displays "Wall Game - Draw" notification
10. Final scores shown: all players score 0 (no winner)
11. GameOverDialog appears with "Game ended in a draw (wall exhausted)"

## Expected Outcome (Assert)

- WallDisplay component shows "0 tiles" or empty state indicator
- No winner is declared
- All players' scores remain at 0
- GameOverDialog displays:
  - Title: "Game Over - Draw"
  - Message: "The wall has been exhausted. No winner."
  - Button options: "New Game" / "Return to Lobby"
- Action buttons (Draw Tile, Declare Mahjong) are disabled
- Game state transitions to `GameOver`
- Replay is available for review

## Error Cases

- **Last tile drawn but Mahjong declared**: Mahjong takes precedence, game ends with winner
- **Last tile called for Pung/Kong**: After discard, wall is empty → draw
- **Wall count desync**: Server count is authoritative, client updates on event
- **Multiple players attempt to draw**: Server enforces turn order, only current player can draw
- **Charleston wall reservation**: Wall game can only happen in Playing phase (after Charleston uses 36 tiles)

## Technical Notes

### Wall Tile Math

- Total tiles: 152
- Initial deal: 13 × 4 players = 52 tiles
- East gets extra: +1 = 53 tiles dealt
- Charleston exchanges: 0 net change (tiles redistributed)
- Remaining wall: 152 - 53 = 99 tiles at game start
- Wall exhaustion: occurs after ~99 draw actions (accounting for calls that skip draws)

### Server Behavior

From backend (mahjong_core):

- Wall::draw() returns `Option<Tile>` → `None` when empty
- Game::advance_turn() checks wall before drawing
- If wall is empty and no Mahjong → emit `GameOver { outcome: WallExhausted }`

### UI Requirements

- WallDisplay should show countdown: "52 tiles remaining" → "1 tile" → "0 tiles - Last Draw!"
- Visual warning when wall count < 10 tiles
- Final tile draw should be visually highlighted

## Cross-References

- **Related Scenarios**: `mahjong-self-draw.md` (win on last tile), `mahjong-called.md` (win on last discard)
- **Component Tests**: WallDisplay, GameOverDialog
- **Integration Tests**: Full game simulation with controlled wall depletion
- **Manual Testing**: User Testing Plan - End Game Conditions section
