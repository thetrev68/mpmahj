# Test Scenario: Exchanging Jokers (Multiple in One Turn)

**User Story**: US-015 - Exchanging Joker (Multiple)
**Fixtures**: `playing-drawing.json`, `with-jokers.json`

## Setup

- Game state: Discarding stage
- User's turn: 14 tiles in hand
- Multiple exchange opportunities: 2+ opponent melds with Jokers
- House rule: Allow multiple exchanges per turn (variant)

## Test Flow (Act & Assert)

1. **When**: User's turn, 14 tiles, multiple Joker exchanges possible
2. **First exchange**: User exchanges natural tile for Joker from opponent A's meld
3. **Send**: `ExchangeJoker { target_seat: A, meld_index: 0, replacement: NaturalTile1 }`
4. **Receive**: `JokerExchanged { player: User, target_seat: A, replacement: NaturalTile1 }`
5. **Assert**: User's hand updated, opponent A's meld updated
6. **UI check**: "Exchange Joker" button remains enabled (variant rule)
7. **Second exchange**: User exchanges another natural tile for Joker from opponent B
8. **Send**: `ExchangeJoker { target_seat: B, meld_index: 1, replacement: NaturalTile2 }`
9. **Receive**: `JokerExchanged { player: User, target_seat: B, replacement: NaturalTile2 }`
10. **Assert**: User's hand updated, opponent B's meld updated
11. **User still must**: Discard one tile before turn ends

## Success Criteria

- ✅ First exchange executed successfully
- ✅ Second exchange executed successfully
- ✅ User's hand reflects both exchanges (2 natural tiles removed, 2 Jokers added)
- ✅ Both opponent melds updated (Jokers replaced with natural tiles)
- ✅ "Exchange Joker" button remains enabled between exchanges (variant)
- ✅ User still has 14 tiles after both exchanges
- ✅ User must discard to complete turn
- ✅ Both ExchangeJoker commands and JokerExchanged events correct

## Error Cases

### Multiple exchanges not allowed (standard rule)

- **When**: User exchanges once, tries again in same turn
- **Expected**: "Exchange Joker" button disabled after first exchange
- **Assert**: Only one exchange allowed per turn

### Attempted exchange with insufficient tiles

- **When**: User attempts second exchange but no matching natural tiles remain
- **Expected**: All remaining Jokers in dialog are grayed out
- **Assert**: User cannot select any Joker for exchange

### Server rejects second exchange (turn ended)

- **When**: User takes too long between exchanges, turn times out
- **Expected**: Server closes turn, random discard sent
- **Assert**: Second exchange command fails with "Not your turn" error
