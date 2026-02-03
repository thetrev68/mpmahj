# Test Scenario: Request Hints (AI Analysis)

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-027 - Request Hints (AI Analysis)
**Component Specs**: HintButton.md, HintPanel.md, AIAnalysisEngine.md
**Fixtures**: `playing-drawing.json`, `hint-analysis-sequence.json`
**Manual Test**: Manual Testing Checklist #27

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: East (user's turn, after drawing)
- **Player hand**: 14 tiles (standard hand, no winning patterns)
- **Turn stage**: Discarding (user has 14 tiles after drawing)
- **Hint system**: Enabled (AI analysis available)
- **Hint verbosity**: Medium (default setting)

## Steps (Act)

### Step 1: Verify hint button is available

- UI shows "Get Hint" button in ActionBar
- "Get Hint" button is enabled (user's turn)
- Hint panel is closed (hidden by default)
- Turn timer is running (30 seconds remaining)

### Step 2: User requests a hint

- User clicks "Get Hint" button
- WebSocket sends `RequestHint` command (no payload)
- "Get Hint" button shows spinner: "Analyzing..."
- Hint panel slides in from bottom of screen

### Step 3: Server performs AI analysis

- Server analyzes user's hand and game state:
  - Evaluates all possible discards
  - Calculates defensive safety of each tile
  - Identifies potential winning patterns
  - Considers opponent exposed melds
  - Assesses tile availability in wall
- WebSocket receives `HintProvided` event:
  - `player: "East"`
  - `analysis: { ... }` (detailed analysis results)

### Step 4: Hint panel displays analysis

- Hint panel shows:
  - **Header**: "AI Analysis - Your Turn"
  - **Recommended Discard**: "3 Crak (11)" (highlighted)
  - **Confidence**: 85%
  - **Reasoning**: "3 Crak is safe - no opponents have exposed Craks. Keeps your hand flexible for Consecutive Run pattern."
  - **Alternative Discards**:
    - "7 Dot (24)" - Confidence: 70% - "Moderately safe, but may help opponent"
    - "2 Bam (1)" - Confidence: 65% - "Risky - West has exposed Bam meld"
  - **Defensive Analysis**:
    - "3 Crak (11)": Safe (0% danger)
    - "7 Dot (24)": Low risk (15% danger)
    - "2 Bam (1)": High risk (60% danger)
  - **Pattern Progress**:
    - "Consecutive Run": 60% complete
    - "13579": 40% complete
  - **Joker Opportunities**: "1 Joker in hand - consider exchanging for flexibility"

### Step 5: User reviews hint details

- User clicks on "3 Crak (11)" to see more details
- Hint panel expands to show:
  - **Tile Statistics**:
    - "3 Crak (11)": 4 copies in deck, 1 in your hand, 0 exposed
  - **Opponent Analysis**:
    - "East (you)": No exposed Craks
    - "South": No exposed Craks
    - "West": No exposed Craks
    - "North": No exposed Craks
  - **Pattern Impact**:
    - "Discarding 3 Crak keeps Consecutive Run viable"
    - "Discarding 3 Crak breaks 13579 pattern"
  - **Wall Analysis**:
    - "3 Crak (11)": 3 copies remaining in wall (75% chance to draw)"

### Step 6: User acts on hint

- User selects "3 Crak (11)" in hand
- Tile highlights with selection border
- "Discard Tile" button label updates to "Discard 3 Crak (11)"
- User clicks "Discard Tile" button
- WebSocket sends `DiscardTile` command:
  - `tile: 11 (3 Crak)`
- Hint panel closes automatically

### Step 7: Server processes discard

- WebSocket receives `TileDiscarded` event:
  - `player: "East"`
  - `tile: 11 (3 Crak)`
- Discard pile updates: "3 Crak (11)" appears on top
- WebSocket receives `CallWindowOpened` event
- UI shows "Call Window Open" indicator

### Step 8: User requests another hint later

- Later in game, user's turn again
- User clicks "Get Hint" button
- WebSocket sends `RequestHint` command
- Hint panel slides in with new analysis based on current game state

## Expected Outcome (Assert)

- ✅ Hint button was available and enabled
- ✅ User successfully requested a hint
- ✅ AI analysis provided comprehensive recommendations
- ✅ Hint panel displayed analysis clearly
- ✅ User could view detailed information for each recommendation
- ✅ User acted on hint (discarded recommended tile)
- ✅ Hint panel closed automatically after discard
- ✅ WebSocket command/event sequence correct (RequestHint → HintProvided)

## Error Cases

### Requesting hint out of turn

- **When**: User clicks "Get Hint" when it's not their turn
- **Expected**: "Get Hint" button disabled
- **Assert**: Button's `disabled` state reflects `currentTurn !== userSeat`

### Requesting hint during call window

- **When**: User clicks "Get Hint" while call window is open
- **Expected**: "Get Hint" button disabled
- **Assert**: Button's `disabled` state reflects `callWindowOpen === true`

### Hint system disabled

- **When**: User clicks "Get Hint" but hint system is disabled in settings
- **Expected**: "Get Hint" button not visible or shows "Hints disabled"
- **Assert**: Button's `disabled` state reflects `hintsEnabled === false`

### Server fails to provide hint

- **When**: Server encounters error during AI analysis
- **Expected**: Server responds with error event
- **Assert**:
  - WebSocket receives `HintError` event:
    - `reason: "AI analysis failed"`
  - UI shows error: "Unable to provide hint - please try again"
  - "Get Hint" button re-enabled

### Hint analysis takes too long

- **When**: Server takes > 5 seconds to provide hint
- **Expected**: Client shows timeout message
- **Assert**:
  - Hint panel shows: "Analysis taking longer than expected..."
  - After 10 seconds: "Hint unavailable - try again later"
  - "Get Hint" button re-enabled

### Requesting hint with no valid discards

- **When**: User has only one tile to discard (edge case)
- **Expected**: Hint panel shows "Only one discard option available"
- **Assert**:
  - Hint panel displays: "Only 3 Crak (11) can be discarded"
  - No alternative recommendations shown

## Hint Analysis Features

### Analysis Components

| Component | Description |
|-----------|-------------|
| Recommended Discard | Best tile to discard based on AI analysis |
| Confidence | AI's confidence in recommendation (0-100%) |
| Reasoning | Explanation of why this tile is recommended |
| Alternative Discards | Other viable options with lower confidence |
| Defensive Analysis | Safety assessment of each tile (danger level) |
| Pattern Progress | Progress toward winning patterns |
| Joker Opportunities | Suggestions for Joker exchanges |

### Defensive Safety Levels

| Safety Level | Danger Range | Description |
|-------------|--------------|-------------|
| Safe | 0-10% | Very unlikely to be called |
| Low Risk | 11-30% | Unlikely to be called |
| Moderate Risk | 31-50% | Possible to be called |
| High Risk | 51-70% | Likely to be called |
| Very High Risk | 71-100% | Almost certain to be called |

### Pattern Recognition

The AI analyzes potential winning patterns:

- **Consecutive Run**: 1-2-3, 4-5-6, 7-8-9 sequences
- **13579**: Odd numbers in one suit
- **2468**: Even numbers in one suit
- **Winds/Dragons**: All winds or all dragons
- **Pairs**: Multiple pairs for pair-based patterns
- **Quints/Sextets**: Five or six of a kind

## Cross-References

### Related Scenarios

- `adjust-hint-verbosity.md` - Adjust hint verbosity settings
- `drawing-discarding.md` - Standard turn flow
- `joker-exchange-single.md` - Joker exchange hints
- `mahjong-self-draw.md` - Mahjong hints

### Related Components

- [HintButton](../../component-specs/game/HintButton.md)
- [HintPanel](../../component-specs/game/HintPanel.md)
- [AIAnalysisEngine](../../component-specs/game/AIAnalysisEngine.md)
- [ActionBar](../../component-specs/game/ActionBar.md)

### Backend References

- Commands: `mahjong_core::command::RequestHint`
- Events: `mahjong_core::event::HintProvided`, `HintError`
- Logic: `mahjong_ai::analysis::analyze_hand()`, `calculate_defensive_safety()`
- AI: `mahjong_ai::engine::HintEngine`

### Accessibility Notes

- "Get Hint" button announced: "Get AI hint, available"
- Hint panel announced: "AI analysis panel opened. Recommended discard: 3 Crack (11), 85% confidence"
- Recommendation announced: "3 Crack (11) recommended. Reason: 3 Crack is safe - no opponents have exposed Craks. Keeps your hand flexible for Consecutive Run pattern."
- Alternative announced: "Alternative: 7 Dot (24), 70% confidence. Moderately safe, but may help opponent"
- Defensive analysis announced: "3 Crack (11): Safe, 0% danger. 7 Dot (24): Low risk, 15% danger"
- Pattern progress announced: "Consecutive Run: 60% complete. 13579: 40% complete"
- Joker opportunities announced: "1 Joker in hand - consider exchanging for flexibility"
