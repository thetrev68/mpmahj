# Test Scenario: Roll Dice & Break Wall

**User Story**: US-001 - Roll Dice & Break Wall
**Fixtures**: `pre-game-lobby.json`, `dice-roll-sequence.json`

## Setup

- Game state: PreGame, waiting to start
- User seated as: East (dealer)
- Players: All 4 seated
- Wall: 152 tiles arranged in 4 walls (38 each)
- Dead wall: 14 tiles reserved

## Test Flow (Act & Assert)

1. **When**: All 4 players seated, game ready
2. **User action**: East (dealer) clicks "Start Game" button
3. **Send**: `StartGame` command
4. **UI shows**: "Rolling dice..." animation
5. **Receive**: `DiceRolled { roller: East, dice: [3, 4], total: 7 }`
6. **UI displays**: Dice animation, final values 3 and 4, total 7
7. **Game log**: "East rolled 3 + 4 = 7"
8. **Receive**: `WallBroken { break_wall: South, break_position: 7, dealer: East }`
9. **UI highlights**: Break point on South's wall at position 7
10. **Receive**: `HandsDealt { dealer: East, tiles_per_player: 13, dealer_extra: 1 }`
11. **UI shows**: Dealing animation, tiles moving to each player
12. **Assert**:
    - East receives 14 tiles (13 + 1 dealer bonus)
    - South, West, North receive 13 tiles each
    - User's hand visible, other hands concealed
13. **Receive**: `PhaseChanged { from: PreGame, to: Charleston, stage: FirstRight }`
14. **UI updates**: Charleston tracker appears, "Pass Tiles" button (disabled)
15. **Wall state**: 86 tiles remaining (152 - 14 dead - 52 dealt)

## Success Criteria

- ✅ Dice rolled successfully (3 + 4 = 7)
- ✅ Wall broken at correct position (South, position 7)
- ✅ Starting hands dealt correctly (East: 14, others: 13)
- ✅ Game transitioned to Charleston phase
- ✅ Tile counts updated correctly in all walls
- ✅ Dead wall preserved (14 tiles)
- ✅ Event sequence: StartGame → DiceRolled → WallBroken → HandsDealt → PhaseChanged

## Error Cases

### Non-dealer attempts to start game

- **When**: Non-dealer player clicks "Start Game" button
- **Expected**: Button is disabled (disabled state in UI)
- **Assert**: Only East (dealer) can start game, button disabled for others

### Game start with incomplete players

- **When**: Only 3 players seated, user tries to start
- **Expected**: "Start Game" button is disabled
- **Assert**: Button enabled only when 4 players present

### Invalid dice roll (both zeros)

- **When**: Dice roll returns [0, 0] (shouldn't happen, but test edge case)
- **Expected**: Server recalculates or uses default break position
- **Assert**: Game continues with default position or re-rolls
