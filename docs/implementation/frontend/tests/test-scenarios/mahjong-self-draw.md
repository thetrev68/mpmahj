# Test Scenario: Declaring Mahjong (Self-Draw)

**User Story**: US-018 - Self-Draw Mahjong
**Fixtures**: `playing-drawing.json`, `near-win-one-away.json`

## Setup

- Game state: Playing, Drawing stage
- User's turn: Drawing a tile
- Hand: One tile away from valid pattern

## Test Flow (Act & Assert)

1. **When**: User draws tile that completes valid pattern
2. **Send**: `DeclareMahjong { hand: [14 tiles], winning_tile: drawnTile }`
3. **Receive**: `HandValidated { player: User, valid: true, pattern: ... }`
4. **Receive**: `MahjongDeclared { player: User }`
5. **Receive**: `GameOver { winner: User, result: {...} }`
6. **Assert**: Mahjong accepted without call window, scoring displayed

## Success Criteria

- ✅ Self-drawn tile completes valid pattern
- ✅ Mahjong accepted on DeclareMahjong
- ✅ No call window opened (self-draw is immediate)
- ✅ Hand validation passed
- ✅ Game transitioned to GameOver
- ✅ Scoring displayed from GameOver result

## Error Cases

### Invalid self-draw Mahjong

- **When**: User draws tile but hand doesn't match pattern
- **Expected**: Server rejects via `HandValidated { valid: false }`
- **Assert**: User receives `HandDeclaredDead` event, hand now dead

### User doesn't declare within timeout

- **When**: User draws winning tile but doesn't click "Declare" within 5 seconds
- **Expected**: Game continues normally (user missed opportunity)
- **Assert**: Turn proceeds to next player
