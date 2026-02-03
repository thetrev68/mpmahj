# Test Scenario: Exchanging a Joker (Single Exchange)

**User Story**: US-014 - Exchanging Joker (Single)
**Fixtures**: `playing-drawing.json`, `with-jokers.json`

## Setup

- Game state: Playing, Discarding stage
- User seated as: East (user's turn)
- Player hand: 14 tiles (2 Jokers, 12 regular, including "3 Bam")
- Opponent exposed melds:
  - South: Pung with Joker (substituting "3 Bam")
  - West: Kong with Joker (substituting "Red Dragon")

## Test Flow (Act & Assert)

1. **When**: East is in Discarding stage with "3 Bam" in hand
2. **Opponent melds**: South's Pung has Joker (substituting "3 Bam")
3. **User action**: Clicks "Exchange Joker" button
4. **Dialog opens**: Shows available Jokers and natural tiles to exchange
5. **User selects**: South's Joker, then "3 Bam" from hand
6. **Send**: `ExchangeJoker { target_seat: South, meld_index: 0, replacement: 3Bam }`
7. **Receive**: `JokerExchanged { player: East, target_seat: South, replacement: 3Bam }`
8. **Assert**:
   - User's hand: "3 Bam" removed, Joker added (still 14 tiles)
   - South's Pung: Joker replaced with "3 Bam" (all natural)
   - "Exchange Joker" button disabled (once per turn)
9. **User still needs**: To discard one tile to complete turn

## Success Criteria

- ✅ User selected Joker from opponent's meld to exchange
- ✅ User selected matching natural tile from hand
- ✅ ExchangeJoker command sent correctly
- ✅ Opponent's meld updated (Joker replaced with natural tile)
- ✅ User's hand updated (natural tile removed, Joker added)
- ✅ "Exchange Joker" button disabled (once per turn)
- ✅ Event sequence: ExchangeJoker → JokerExchanged

## Error Cases

### Attempting to exchange without natural tile

- **When**: User tries to exchange West's Joker but doesn't have matching natural "Red Dragon"
- **Expected**: West's Joker is grayed out in dialog
- **Assert**: Only Jokers with matching natural tiles are selectable

### Server rejects exchange (not user's turn)

- **When**: User sends ExchangeJoker but it's another player's turn (race condition)
- **Expected**: Server rejects via `CommandRejected`
- **Assert**: Hand and meld states unchanged, error toast shown

### Attempting multiple exchanges in one turn

- **When**: User exchanges one Joker, then tries to exchange another
- **Expected**: "Exchange Joker" button disabled after first exchange
- **Assert**: Button disabled until next turn
