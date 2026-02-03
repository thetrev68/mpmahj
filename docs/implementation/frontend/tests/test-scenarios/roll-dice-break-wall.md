# Test Scenario: Roll Dice & Break Wall

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-001 - Roll Dice & Break Wall
**Component Specs**: DiceRoller.md, WallDisplay.md, GameTable.md
**Fixtures**: `pre-game-lobby.json`, `dice-roll-sequence.json`
**Manual Test**: Manual Testing Checklist #1

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/pre-game-lobby.json`
- **Mock WebSocket**: Connected
- **User seated as**: East (dealer position)
- **Players**: All 4 players seated (East, South, West, North)
- **Game phase**: PreGame (waiting to start)
- **Wall**: 152 tiles arranged in 4 walls (38 tiles each)
- **Dead wall**: 14 tiles separated from main wall (not visible to players)

## Steps (Act)

### Step 1: Verify pre-game state

- UI shows all 4 players seated at table
- "Start Game" button is visible and enabled (for East/dealer)
- Wall display shows 4 walls with tile counts (38 each)
- Dead wall indicator shows 14 tiles reserved
- Game log shows "Waiting for game to start..."

### Step 2: Dealer (East) starts the game

- User (East) clicks "Start Game" button
- WebSocket sends `StartGame` command (no payload)
- "Start Game" button becomes disabled
- UI shows "Rolling dice..." animation

### Step 3: Server initiates dice roll

- WebSocket receives `DiceRolled` event:
  - `roller: "East"` (dealer)
  - `dice: [3, 4]` (example values)
  - `total: 7`
- UI displays dice roll animation:
  - Two dice shown rolling
  - Final values displayed: 3 and 4
  - Total: 7 highlighted
- Game log shows: "East rolled 3 + 4 = 7"

### Step 4: Server determines wall break position

- Server calculates break position based on dice total:
  - Count clockwise from dealer's wall
  - For total 7: break at 7th tile from right end of South's wall
- WebSocket receives `WallBroken` event:
  - `break_wall: "South"`
  - `break_position: 7` (tiles from right end)
  - `dealer: "East"`
- UI highlights the break point on South's wall
- Visual indicator shows "Wall broken at South, position 7"

### Step 5: Server distributes starting hands

- WebSocket receives `HandsDealt` event:
  - `dealer: "East"`
  - `tiles_per_player: 13`
  - `dealer_extra: 1` (dealer gets 14 tiles)
- UI shows tile dealing animation:
  - Tiles animate from wall to each player's rack
  - East receives 14 tiles (13 + 1 extra for dealer)
  - South, West, North each receive 13 tiles
- User's hand (East) displays 14 tiles face-up (concealed from others)
- Other players' hands show tile counts only (13 tiles each)

### Step 6: Game transitions to Charleston phase

- WebSocket receives `PhaseChanged` event:
  - `from: "PreGame"`
  - `to: "Charleston"`
  - `stage: "FirstRight"`
- UI updates:
  - Charleston tracker appears: "Charleston: First Right"
  - "Pass Tiles" button appears (disabled until 3 tiles selected)
  - Tile selection UI becomes active
- Game log shows: "Charleston phase started - First Right pass"

### Step 7: Verify wall state after break

- Main wall now has 152 - 14 (dead wall) - 52 (dealt) = 86 tiles remaining
- Dead wall still has 14 tiles (unchanged)
- Wall display updates tile counts:
  - South's wall: 38 - 7 (break) - 13 (dealt) = 18 tiles
  - Other walls adjusted based on dealing sequence
- Remaining tiles indicator shows "86 tiles remaining"

## Expected Outcome (Assert)

- ✅ Dice rolled successfully (3 + 4 = 7)
- ✅ Wall broken at correct position (South, position 7)
- ✅ Starting hands dealt correctly (East: 14, others: 13)
- ✅ Game transitioned to Charleston phase
- ✅ WebSocket command/event sequence correct (StartGame → DiceRolled → WallBroken → HandsDealt → PhaseChanged)
- ✅ UI correctly displays dice roll, wall break, and hand distribution
- ✅ Dead wall preserved (14 tiles untouched)

## Error Cases

### Starting game without all players seated

- **When**: User clicks "Start Game" with fewer than 4 players
- **Expected**: "Start Game" button disabled or shows error
- **Assert**: Button's `disabled` state reflects `players.length < 4`

### WebSocket disconnect during dice roll

- **When**: Connection lost after clicking "Start Game" but before receiving dice result
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**: On reconnect, client re-syncs state and receives current game phase (may be in Charleston if server continued)

### Invalid dice values (server-side validation)

- **When**: Server somehow generates invalid dice (shouldn't happen)
- **Expected**: Server rejects and re-rolls
- **Assert**: Client receives `DiceRolled` event with valid values (1-6 each)

### Wall break position out of bounds

- **When**: Dice total results in break position beyond wall size (shouldn't happen with proper validation)
- **Expected**: Server wraps around or adjusts position
- **Assert**: `WallBroken` event contains valid `break_position` (1-38)

### Multiple start game attempts

- **When**: User clicks "Start Game" multiple times rapidly
- **Expected**: Only first click sends command, subsequent clicks ignored
- **Assert**: WebSocket receives only one `StartGame` command, button disabled after first click

## Cross-References

### Related Scenarios

- `charleston-standard.md` - First pass after wall break
- `charleston-blind-pass.md` - Blind passing variant
- `drawing-discarding.md` - Main gameplay after Charleston

### Related Components

- [DiceRoller](../../component-specs/game/DiceRoller.md)
- [WallDisplay](../../component-specs/game/WallDisplay.md)
- [GameTable](../../component-specs/game/GameTable.md)
- [PlayerRack](../../component-specs/game/PlayerRack.md)

### Backend References

- Commands: `mahjong_core::command::StartGame`
- Events: `mahjong_core::event::DiceRolled`, `WallBroken`, `HandsDealt`, `PhaseChanged`
- Logic: `mahjong_core::game_setup::roll_dice()`, `break_wall()`, `deal_hands()`
- Rules: NMJL rulebook section on dice rolling and wall breaking

### Accessibility Notes

- "Start Game" button announced: "Start game, all 4 players seated"
- Dice roll announced: "East rolled 3 and 4, total 7"
- Wall break announced: "Wall broken at South, position 7"
- Hand distribution announced: "You received 14 tiles. South has 13, West has 13, North has 13"
- Phase transition announced: "Charleston phase started, First Right pass"
