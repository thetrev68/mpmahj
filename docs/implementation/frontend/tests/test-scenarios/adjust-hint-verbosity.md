# Test Scenario: Adjust Hint Verbosity

**User Story**: US-028 - Adjust Hint Verbosity
**Fixtures**: `playing-drawing.json`, `hint-verbosity-sequence.json`

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: East (user's turn, after drawing)
- **Player hand**: 14 tiles (standard hand, no winning patterns)
- **Turn stage**: Discarding (user has 14 tiles after drawing)
- **Hint system**: Enabled
- **Hint verbosity**: Medium (default setting)

## Test Flow (Act & Assert)

### Default Verbosity (Medium)

1. **When**: User requests hint with default verbosity (Medium)
2. **Send**: `RequestHint { player: East, verbosity: Medium }`
3. **Receive**: `HintUpdate` event with:
   - Recommended discard with confidence
   - Reasoning and alternatives
   - Defensive analysis summary
4. **Assert**: Hint includes balanced information (medium detail)

### Low Verbosity

1. **When**: User sets hint verbosity to Low
2. **Send**: `SetHintVerbosity { player: East, verbosity: Low }`
3. **Receive**: `HintUpdate` event with:
   - Only recommended discard and confidence
   - NO reasoning, alternatives, or defensive analysis
4. **Assert**: Hint contains minimal information only

### High Verbosity

1. **When**: User sets hint verbosity to High
2. **Send**: `SetHintVerbosity { player: East, verbosity: High }`
3. **Request**: `RequestHint { player: East, verbosity: High }`
4. **Receive**: `HintUpdate` event with:
   - Recommended discard, confidence, detailed reasoning
   - Alternative discards with detailed explanations
   - Full defensive analysis with tile statistics
   - Pattern progress with requirements
5. **Assert**: Hint contains detailed information with explanations

### Expert Verbosity

1. **When**: User sets hint verbosity to Expert
2. **Send**: `SetHintVerbosity { player: East, verbosity: Expert }`
3. **Request**: `RequestHint { player: East, verbosity: Expert }`
4. **Receive**: `HintUpdate` event with:
   - All High verbosity content
   - Probability calculations and statistics
   - Opponent analysis and wall statistics
5. **Assert**: Hint contains comprehensive analysis

## Error Cases

### Error: Invalid verbosity value

- **When**: Server receives invalid verbosity value
- **Send**: `SetHintVerbosity { player: East, verbosity: "InvalidValue" }`
- **Expected**: `CommandError::InvalidVerbosity`
- **Assert**: Verbosity unchanged, previous setting retained

### Error: Setting verbosity out of turn

- **When**: Non-current player tries to set verbosity
- **Send**: `SetHintVerbosity { player: South, verbosity: Expert }` (not your turn)
- **Expected**: `CommandError::NotYourTurn`
- **Assert**: Verbosity unchanged for that player

## Success Criteria

- ✅ Verbosity setting affects hint content detail level
- ✅ Low shows minimal (discard + confidence only)
- ✅ Medium shows balanced (includes reasoning, alternatives)
- ✅ High shows detailed (includes explanations, requirements)
- ✅ Expert shows comprehensive (includes statistics, probabilities)
- ✅ Verbosity persists across hint requests
- ✅ Command/event sequence correct (SetHintVerbosity → RequestHint → HintUpdate)
