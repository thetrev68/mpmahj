# Test Scenario: Declaring Mahjong (Called Discard)

**User Story**: US-019 - Declaring Mahjong via Called Discard
**Fixtures**: `playing-call-window.json`, `near-win-one-away.json`

## Setup

- Game state: Playing, CallWindow phase
- User seated as: South
- Player hand: 13 tiles, needs "White Dragon (33)" to win
- Current turn: East (about to discard)
- Pattern: Singles and Pairs (2025)

## Test Flow (Act & Assert)

1. **When**: East discards "White Dragon (33)", call window opens
2. **Receive**: `TileDiscarded { player: East, tile: WhiteDragon }`
3. **User hand**: 13 tiles + 1 discard = 14 tiles matching "Singles and Pairs" pattern
4. **Receive**: `CallWindowOpened` event
5. **User action**: Clicks "Call for Mahjong" button
6. **Send**: `DeclareCallIntent { intent: Mahjong }`
7. **Receive**: `CallResolved { resolution: Mahjong(South) }`
8. **Receive**: `AwaitingMahjongValidation { caller: South, called_tile: WhiteDragon, discarded_by: East }`
9. **Send**: `DeclareMahjong { hand: [14 tiles], winning_tile: WhiteDragon }`
10. **Receive**: `HandValidated { player: South, valid: true, pattern: SinglesAndPairs }`
11. **Receive**: `MahjongDeclared { player: South }`
12. **Receive**: `GameOver { winner: South, result: {...} }`
13. **Assert**: Game transitioned to Scoring, winner is South

## Success Criteria

- ✅ East discarded winning tile (White Dragon)
- ✅ Call window opened automatically
- ✅ User declared Mahjong via DeclareCallIntent
- ✅ Hand validation passed (14 tiles match pattern)
- ✅ Pattern identified: Singles and Pairs
- ✅ Game transitioned to GameOver
- ✅ Event sequence correct: DeclareCallIntent → CallResolved → AwaitingMahjongValidation → DeclareMahjong → HandValidated → MahjongDeclared → GameOver

## Error Cases

### Invalid Mahjong declaration

- **When**: User declares Mahjong but hand doesn't match pattern
- **Expected**: Server rejects via `HandValidated { valid: false }`
- **Assert**: User receives `HandDeclaredDead` event, hand now dead

### Timer expires before declaration

- **When**: User doesn't click within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**: No DeclareCallIntent sent, next player's turn begins

### Another player calls simultaneously

- **When**: Both South and West declare Mahjong on same discard
- **Expected**: Turn order priority resolves (South wins, closer to discarder)
- **Assert**: Server resolves to South, West receives notification
