# Test Scenario: Adjust Hint Verbosity

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-028 - Adjust Hint Verbosity
**Component Specs**: SettingsPanel.md, HintVerbositySelector.md, HintPanel.md
**Fixtures**: `playing-drawing.json`, `hint-verbosity-sequence.json`
**Manual Test**: Manual Testing Checklist #28

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-drawing.json`
- **Mock WebSocket**: Connected
- **User seated as**: East
- **Current turn**: East (user's turn, after drawing)
- **Player hand**: 14 tiles (standard hand, no winning patterns)
- **Turn stage**: Discarding (user has 14 tiles after drawing)
- **Hint system**: Enabled
- **Hint verbosity**: Medium (default setting)
- **Settings panel**: Closed (hidden by default)

## Steps (Act)

### Step 1: User opens settings panel

- User clicks "Settings" button in toolbar
- Settings panel slides in from right side of screen
- UI shows settings panel with:
  - Header: "Settings"
  - Sections: "Game", "Hints", "Animations", "Audio"
  - "Close" button

### Step 2: User navigates to Hints section

- User clicks "Hints" section
- Settings panel shows hint-related settings:
  - **Hint Verbosity**: [Medium ▼] (dropdown)
  - **Hint Frequency**: [On Request ▼] (dropdown)
  - **Show Defensive Analysis**: [✓] (checkbox)
  - **Show Pattern Progress**: [✓] (checkbox)
  - **Show Joker Opportunities**: [✓] (checkbox)

### Step 3: User changes hint verbosity to Low

- User clicks "Hint Verbosity" dropdown
- Dropdown options appear:
  - **Low** - Minimal information, just recommendation
  - **Medium** - Balanced information (default)
  - **High** - Detailed information with explanations
  - **Expert** - Comprehensive analysis with statistics
- User selects "Low"
- Settings panel shows: "Hint Verbosity: Low"
- WebSocket sends `UpdateSettings` command:
  - `hint_verbosity: "Low"`

### Step 4: User requests a hint with Low verbosity

- User closes settings panel (clicks "Close" button)
- User clicks "Get Hint" button
- WebSocket sends `RequestHint` command
- Hint panel slides in from bottom of screen

### Step 5: Hint panel displays Low verbosity analysis

- Hint panel shows (minimal information):
  - **Header**: "AI Analysis - Your Turn"
  - **Recommended Discard**: "3 Crak (11)" (highlighted)
  - **Confidence**: 85%
- No reasoning, no alternatives, no defensive analysis, no pattern progress

### Step 6: User changes hint verbosity to High

- User clicks "Settings" button
- Settings panel slides in
- User navigates to Hints section
- User clicks "Hint Verbosity" dropdown
- User selects "High"
- Settings panel shows: "Hint Verbosity: High"
- WebSocket sends `UpdateSettings` command:
  - `hint_verbosity: "High"`

### Step 7: User requests another hint with High verbosity

- User closes settings panel
- User clicks "Get Hint" button
- WebSocket sends `RequestHint` command
- Hint panel slides in

### Step 8: Hint panel displays High verbosity analysis

- Hint panel shows (detailed information):
  - **Header**: "AI Analysis - Your Turn"
  - **Recommended Discard**: "3 Crak (11)" (highlighted)
  - **Confidence**: 85%
  - **Reasoning**: "3 Crak is safe - no opponents have exposed Craks. Keeps your hand flexible for Consecutive Run pattern. Discarding 3 Crak maintains 60% progress toward Consecutive Run and 40% toward 13579."
  - **Alternative Discards**:
    - "7 Dot (24)" - Confidence: 70% - "Moderately safe, but may help opponent. Discarding 7 Dot reduces Consecutive Run progress to 50%."
    - "2 Bam (1)" - Confidence: 65% - "Risky - West has exposed Bam meld. Discarding 2 Bam breaks 13579 pattern."
  - **Defensive Analysis**:
    - "3 Crak (11)": Safe (0% danger) - "No opponents have exposed Craks"
    - "7 Dot (24)": Low risk (15% danger) - "South has exposed Dot meld"
    - "2 Bam (1)": High risk (60% danger) - "West has exposed Bam Pung"
  - **Pattern Progress**:
    - "Consecutive Run": 60% complete - "Need: 4 Bam, 5 Bam, 6 Bam"
    - "13579": 40% complete - "Need: 1 Bam, 3 Bam, 5 Bam, 7 Bam, 9 Bam"
  - **Joker Opportunities**: "1 Joker in hand - consider exchanging for flexibility. Can exchange with South's Pung (Joker substituting 3 Bam)"

### Step 9: User changes hint verbosity to Expert

- User clicks "Settings" button
- Settings panel slides in
- User navigates to Hints section
- User clicks "Hint Verbosity" dropdown
- User selects "Expert"
- Settings panel shows: "Hint Verbosity: Expert"
- WebSocket sends `UpdateSettings` command:
  - `hint_verbosity: "Expert"`

### Step 10: User requests another hint with Expert verbosity

- User closes settings panel
- User clicks "Get Hint" button
- WebSocket sends `RequestHint` command
- Hint panel slides in

### Step 11: Hint panel displays Expert verbosity analysis

- Hint panel shows (comprehensive information):
  - **Header**: "AI Analysis - Your Turn"
  - **Recommended Discard**: "3 Crak (11)" (highlighted)
  - **Confidence**: 85%
  - **Reasoning**: "3 Crak is safe - no opponents have exposed Craks. Keeps your hand flexible for Consecutive Run pattern. Discarding 3 Crak maintains 60% progress toward Consecutive Run and 40% toward 13579. Statistical analysis shows 3 Crak has 0% probability of being called based on opponent exposed melds and discard history."
  - **Alternative Discards**:
    - "7 Dot (24)" - Confidence: 70% - "Moderately safe, but may help opponent. Discarding 7 Dot reduces Consecutive Run progress to 50%. Probability of being called: 15% based on South's exposed Dot meld."
    - "2 Bam (1)" - Confidence: 65% - "Risky - West has exposed Bam meld. Discarding 2 Bam breaks 13579 pattern. Probability of being called: 60% based on West's exposed Bam Pung."
  - **Defensive Analysis**:
    - "3 Crak (11)": Safe (0% danger) - "No opponents have exposed Craks. 3 copies remaining in wall (75% chance to draw)."
    - "7 Dot (24)": Low risk (15% danger) - "South has exposed Dot meld. 2 copies remaining in wall (50% chance to draw)."
    - "2 Bam (1)": High risk (60% danger) - "West has exposed Bam Pung. 3 copies remaining in wall (75% chance to draw)."
  - **Pattern Progress**:
    - "Consecutive Run": 60% complete - "Need: 4 Bam, 5 Bam, 6 Bam. Probability of completing: 35%."
    - "13579": 40% complete - "Need: 1 Bam, 3 Bam, 5 Bam, 7 Bam, 9 Bam. Probability of completing: 20%."
  - **Joker Opportunities**: "1 Joker in hand - consider exchanging for flexibility. Can exchange with South's Pung (Joker substituting 3 Bam). Exchange value: High - increases pattern completion probability by 15%."
  - **Tile Statistics**:
    - "3 Crak (11)": 4 copies in deck, 1 in your hand, 0 exposed, 3 remaining in wall
    - "7 Dot (24)": 4 copies in deck, 1 in your hand, 1 exposed, 2 remaining in wall
    - "2 Bam (1)": 4 copies in deck, 1 in your hand, 2 exposed, 1 remaining in wall
  - **Opponent Analysis**:
    - "East (you)": No exposed melds
    - "South": Exposed Dot Pung (7 Dot, 7 Dot, 7 Dot)
    - "West": Exposed Bam Pung (2 Bam, 2 Bam, 2 Bam)
    - "North": No exposed melds
  - **Wall Analysis**: "86 tiles remaining. Average tiles per draw: 1.2 turns per tile."

### Step 12: User changes hint verbosity back to Medium

- User clicks "Settings" button
- Settings panel slides in
- User navigates to Hints section
- User clicks "Hint Verbosity" dropdown
- User selects "Medium"
- Settings panel shows: "Hint Verbosity: Medium"
- WebSocket sends `UpdateSettings` command:
  - `hint_verbosity: "Medium"`

## Expected Outcome (Assert)

- ✅ Settings panel opened and closed correctly
- ✅ User successfully changed hint verbosity (Low → High → Expert → Medium)
- ✅ Hint panel displayed appropriate information for each verbosity level
- ✅ Low verbosity showed minimal information
- ✅ High verbosity showed detailed information with explanations
- ✅ Expert verbosity showed comprehensive analysis with statistics
- ✅ WebSocket command/event sequence correct (UpdateSettings → RequestHint → HintProvided)
- ✅ Settings persisted between hint requests

## Error Cases

### Changing verbosity during hint display

- **When**: User changes hint verbosity while hint panel is open
- **Expected**: Hint panel closes, new verbosity applies to next hint
- **Assert**:
  - Hint panel closes automatically
  - Next hint uses new verbosity level

### Invalid verbosity value

- **When**: Server receives invalid verbosity value (shouldn't happen)
- **Expected**: Server rejects and uses default (Medium)
- **Assert**:
  - WebSocket receives `SettingsError` event:
    - `reason: "Invalid hint verbosity"`
  - Settings panel shows: "Hint Verbosity: Medium" (default)

### WebSocket disconnect during settings update

- **When**: Connection lost after changing verbosity
- **Expected**: Client shows "Reconnecting..." overlay
- **Assert**:
  - On reconnect, client re-syncs settings
  - If update succeeded: shows new verbosity
  - If update failed: shows previous verbosity

### Hint system disabled

- **When**: User tries to change verbosity but hint system is disabled
- **Expected**: Hint verbosity dropdown disabled
- **Assert**: Dropdown's `disabled` state reflects `hintsEnabled === false`

## Hint Verbosity Levels

| Verbosity | Information Level | Components Shown |
|-----------|------------------|------------------|
| **Low** | Minimal | Recommended discard, confidence |
| **Medium** | Balanced | Recommended discard, confidence, reasoning, alternatives, defensive analysis, pattern progress, joker opportunities |
| **High** | Detailed | All Medium components + detailed explanations, pattern requirements |
| **Expert** | Comprehensive | All High components + statistics, probabilities, opponent analysis, wall analysis |

## Cross-References

### Related Scenarios

- `request-hints-ai-analysis.md` - Request hints with AI analysis
- `drawing-discarding.md` - Standard turn flow
- `joker-exchange-single.md` - Joker exchange hints

### Related Components

- [SettingsPanel](../../component-specs/game/SettingsPanel.md)
- [HintVerbositySelector](../../component-specs/game/HintVerbositySelector.md)
- [HintPanel](../../component-specs/game/HintPanel.md)
- [HintButton](../../component-specs/game/HintButton.md)

### Backend References

- Commands: `mahjong_core::command::UpdateSettings`, `RequestHint`
- Events: `mahjong_core::event::SettingsUpdated`, `HintProvided`, `SettingsError`
- State: `GameState::settings` (user settings including hint_verbosity)
- Logic: `mahjong_ai::analysis::generate_hint(verbosity)`

### Accessibility Notes

- "Settings" button announced: "Open settings"
- Settings panel announced: "Settings panel opened"
- Hints section announced: "Hints settings"
- Hint verbosity dropdown announced: "Hint verbosity, Medium selected. Options: Low, Medium, High, Expert"
- Low verbosity selected: "Hint verbosity set to Low. Minimal information"
- High verbosity selected: "Hint verbosity set to High. Detailed information"
- Expert verbosity selected: "Hint verbosity set to Expert. Comprehensive analysis"
- Hint panel (Low) announced: "AI analysis panel opened. Recommended discard: 3 Crack (11), 85% confidence"
- Hint panel (High) announced: "AI analysis panel opened. Recommended discard: 3 Crack (11), 85% confidence. Reasoning: 3 Crack is safe - no opponents have exposed Craks. Keeps your hand flexible for Consecutive Run pattern. Discarding 3 Crack maintains 60% progress toward Consecutive Run and 40% toward 13579."
