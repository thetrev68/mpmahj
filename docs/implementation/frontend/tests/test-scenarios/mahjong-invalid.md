# Test Scenario: Invalid Mahjong Declaration

**User Story**: US-020 - Invalid Mahjong → Dead Hand
**Fixtures**: `playing-drawing.json`, `invalid-mahjong.json`

## Setup (Arrange)

- Game state: Playing phase, Discarding stage
- User seated as: East (seat 1)
- Player hand: 14 tiles (just drew)
- Hand does NOT match any 2025 NMJL pattern
- User attempts to declare Mahjong (mistaken or intentional)

## Test Flow (Act & Assert)

### Scenario: User Declares Invalid Mahjong (Self-Draw)

1. **When**: User has 14 tiles that don't form valid pattern
2. **Send**: `DeclareMahjong { player: East, hand: [14 tiles], winning_tile: last_drawn }`
3. **Server validates**: Checks hand against all 2025 NMJL patterns
4. **Receive**: `HandValidated { player: East, valid: false, reason: "NoMatchingPattern" }`
5. **Receive**: `HandDeclaredDead { player: East, reason: InvalidMahjong }`
6. **Assert**:
   - Hand marked dead (cannot win for remainder of game)
   - Player can still draw/discard but cannot call Mahjong
   - Game continues with East unable to win
7. **Receive**: `TurnChanged { player: South, stage: Drawing }`
8. **Assert**: Turn advances, East continues playing but cannot win

## Success Criteria

- ✅ DeclareMahjong command sent with invalid hand
- ✅ Server validation correctly identifies no matching pattern
- ✅ HandValidated event shows valid: false
- ✅ HandDeclaredDead event received
- ✅ Hand marked as dead for remainder of game
- ✅ Player can still draw/discard but Mahjong action disabled
- ✅ Game continues normally for other players

## Error Cases

### Invalid Mahjong on Called Discard

- **When**: Call window open, user calls for Mahjong with invalid hand
- **Send**: `DeclareCallIntent { player: East, intent: Mahjong }`
- **Receive**: `CallResolved { resolution: Mahjong, winner: East }`
- **Send**: `DeclareMahjong { player: East, hand: [14 tiles], winning_tile: called_tile }`
- **Receive**: `HandValidated { valid: false }`
- **Receive**: `HandDeclaredDead { reason: InvalidMahjong }`
- **Assert**: Hand dead, other players' calls might have been valid but blocked

### Pattern Almost Matches (One Tile Off)

- **When**: Hand has 13 correct tiles for pattern, 1 incorrect tile
- **Expected**: HandValidated shows valid: false
- **Assert**: Server doesn't do "fuzzy matching", requires exact pattern match
- **Note**: This is a common player mistake (thought they had valid hand)

### Joker in Pair When Not Allowed

- **When**: Pattern requires natural pair, user has Joker pair
- **Expected**: HandValidated shows valid: false, reason includes joker restriction
- **Assert**: Some patterns don't allow Jokers in pairs

### Wrong Card Year Pattern

- **When**: User's hand matches 2024 pattern, but game uses 2025 card
- **Expected**: HandValidated shows valid: false
- **Assert**: Validation only checks current card year patterns

## Technical Notes

**Validation Process**:

- Server checks hand against all patterns in configured card year
- Histogram-based validation for performance
- Joker substitution rules applied per pattern
- No partial credit - hand either matches exactly or doesn't

**Dead Hand Consequences**:

- Player can continue drawing and discarding
- Cannot declare Mahjong for rest of game
- Can still be called for Pung/Kong exposures
- Still participates in scoring (pays winner)
