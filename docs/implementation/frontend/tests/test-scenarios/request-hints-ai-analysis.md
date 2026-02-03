# Test Scenario: Request Hints (AI Analysis)

**User Story**: US-027 - Request Hints (AI Analysis)
**Fixtures**: `playing-drawing.json`, `hint-analysis-sequence.json`

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: East (user's turn, after drawing)
- **Player hand**: 14 tiles (standard hand, no winning patterns)
- **Turn stage**: Discarding (user has 14 tiles after drawing)
- **Hint system**: Enabled (AI analysis available)
- **Hint verbosity**: Medium (default setting)

## Test Flow (Act & Assert)

### Happy Path

1. **When**: User is on their turn with 14 tiles (Discarding stage)
2. **User requests**: Hint for current hand
3. **Send**: `RequestHint { player: East, verbosity: Medium }`
4. **Receive**: `HintUpdate` event with analysis data:
   - `recommended_discard: Tile(11)` (3 Crak)
   - `confidence: 85`
   - `reasoning: "3 Crak is safe - no opponents have exposed Craks"`
5. **Assert**:
   - Hint contains recommended discard and confidence level
   - Analysis includes safety assessment for top 3 options
   - Player can use hint to inform discard decision
6. **User discards**: The recommended tile (or any tile)
7. **Send**: `DiscardTile { player: East, tile: Tile(11) }`
8. **Receive**: `TileDiscarded` event
9. **Assert**: Game advances to call window

## Error Cases

### Error: Requesting hint out of turn

- **When**: User not on turn or call window is open
- **Send**: `RequestHint` from non-current player
- **Expected**: `CommandError::NotYourTurn`
- **Assert**: Hand unchanged, no hint provided

### Error: Server analysis fails

- **When**: Server encounters error during AI analysis
- **Send**: `RequestHint`
- **Receive**: `AnalysisError` event with `reason: "AI analysis failed"`
- **Assert**: No hint data returned, error displayed to user

### Error: Hint analysis timeout

- **When**: Server takes > 10 seconds to provide hint
- **Send**: `RequestHint`
- **Expected**: Client timeout, error message shown
- **Assert**: Button re-enabled, no hang in UI

## Success Criteria

- ✅ User requested hint while on turn
- ✅ AI analysis provided recommended discard with confidence
- ✅ Analysis included defensive safety assessment
- ✅ Hint data received via HintUpdate event
- ✅ User acted on or ignored hint without error
- ✅ Game flow continued normally
