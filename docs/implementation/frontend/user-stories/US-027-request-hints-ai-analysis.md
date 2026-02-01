# US-027: Request Hints (AI Analysis)

## Story

**As a** player during my turn
**I want** to request AI-powered hints that analyze my hand and suggest optimal strategies
**So that** I can learn effective play patterns, improve my decision-making, and understand strategic reasoning

## Acceptance Criteria

### AC-1: Hint Button Availability

**Given** I am in an active game and it is my turn
**When** I am in the `Discarding` stage with 14 tiles in my hand
**Then** a "Get Hint" button appears in the action bar
**And** a tooltip displays: "AI analysis powered by MCTS engine"

### AC-2: Request Hint with Verbosity Selection

**Given** the "Get Hint" button is available
**When** I click the button
**Then** a verbosity selector appears with options: "Beginner", "Intermediate", "Expert"
**And** the default verbosity is set from my user preferences (US-028)
**And** a "Request Analysis" button appears

### AC-3: Send Hint Request Command

**Given** I selected verbosity level "Intermediate"
**When** I click "Request Analysis"
**Then** a `RequestHint { player: me, verbosity: Intermediate }` command is sent to the server
**And** a loading overlay appears: "AI analyzing your hand... (1-3 seconds)"
**And** the hint button is disabled during analysis
**And** a cancel button appears to abort the request

### AC-4: Receive AI Analysis (Beginner Verbosity)

**Given** I requested a "Beginner" hint
**When** the server emits `HintUpdate { hint }`
**Then** a hint panel appears with:

- **Recommended discard**: `hint.recommended_discard`
- **Reason**: `hint.discard_reason`
- **Top patterns**: `hint.best_patterns`
  **And** the recommended tile is highlighted in-hand

### AC-5: Receive AI Analysis (Intermediate Verbosity)

**Given** I requested an "Intermediate" hint
**When** the server emits `HintUpdate { hint }`
**Then** the hint panel shows:

- **Recommended discard**: `hint.recommended_discard`
- **Short label**: `hint.discard_reason` (if provided)

### AC-6: Receive AI Analysis (Expert Verbosity)

**Given** I requested an "Expert" hint
**When** the server emits `HintUpdate { hint }`
**Then** the hint panel shows comprehensive analysis:

- **Recommended discard**: `hint.recommended_discard` (highlighted)
- **Tile scores**: `hint.tile_scores` (if provided)
- **Utility scores**: `hint.utility_scores` (if provided)

### AC-7: Bot Players Do Not Request Hints

**Given** a bot player is in the game
**When** it is the bot's turn
**Then** the bot does NOT request hints (bots use their own AI logic)
**And** hint functionality is only for human players

## Technical Details

### Commands (Frontend → Backend)

````typescript
{
  RequestHint: {
    player: Seat,
    verbosity: "Beginner" | "Intermediate" | "Expert" | "Disabled"
  }
}
```text

### Events (Backend → Frontend)

**Private Events (to requesting player only):**

```typescript
{
  kind: 'Analysis',
  event: {
    HintUpdate: {
      hint: HintData
    }
  }
}

interface HintData {
  recommended_discard?: Tile;
  discard_reason?: string;
  best_patterns: PatternSummary[];
  tiles_needed_for_win: Tile[];
  distance_to_win: number;
  hot_hand: boolean;
  call_opportunities: CallOpportunity[];
  defensive_hints: DefensiveHint[];
  charleston_pass_recommendations: Tile[];
  tile_scores: Record<number, number>;
  utility_scores: Record<number, number>;
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `RequestHint` command
  - `crates/mahjong_ai/src/strategies/expected_value.rs` - Expected value calculations
  - `crates/mahjong_ai/src/mcts.rs` - Monte Carlo Tree Search engine for deep analysis
  - `crates/mahjong_ai/src/strategies/greedy.rs` - Greedy strategy for quick hints
  - `crates/mahjong_ai/src/bot/medium.rs` - Medium difficulty bot logic (similar to Intermediate hints)
  - `crates/mahjong_ai/src/bot/hard.rs` - Hard difficulty bot logic (similar to Expert hints)
  - `crates/mahjong_core/src/rules/validator.rs` - Pattern validation and deficiency calculation
  - `crates/mahjong_core/src/event/analysis_events.rs` - `HintUpdate` event
- **Game Design Doc**:
  - Section 6.1 (AI-Powered Hints System)
  - Section 6.2 (Hint Verbosity Levels)
  - Section 6.3 (MCTS Analysis for Expert Hints)

## Components Involved

- **`<HintButton>`** - Request hint button
- **`<HintVerbositySelector>`** - Choose Beginner/Intermediate/Expert
- **`<HintPanel>`** - Display AI suggestions
- **`<HintLoadingOverlay>`** - "AI analyzing..." animation
- **`<BeginnerHintDisplay>`** - Full reasoning
- **`<IntermediateHintDisplay>`** - Short label
- **`<ExpertHintDisplay>`** - Comprehensive analysis with EV
- **`<PatternRecommendationList>`** - List of viable patterns
- **`useSoundEffects()`** - Insight chime sound

**Component Specs:**

- `component-specs/presentational/HintButton.md` (NEW)
- `component-specs/presentational/HintVerbositySelector.md` (NEW)
- `component-specs/presentational/HintPanel.md` (NEW)
- `component-specs/presentational/BeginnerHintDisplay.md` (NEW)
- `component-specs/presentational/IntermediateHintDisplay.md` (NEW)
- `component-specs/presentational/ExpertHintDisplay.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/hint-request-beginner.md`** - Request and display beginner hint
- **`tests/test-scenarios/hint-request-intermediate.md`** - Request and display intermediate hint
- **`tests/test-scenarios/hint-request-expert.md`** - Request and display expert hint
- **`tests/test-scenarios/hint-network-error.md`** - Network failure during hint request

## Mock Data

**Fixtures:**

- `tests/fixtures/hints/beginner-hint-response.json` - Sample beginner hint
- `tests/fixtures/hints/intermediate-hint-response.json` - Sample intermediate hint
- `tests/fixtures/hints/expert-hint-response.json` - Sample expert hint
- `tests/fixtures/hands/hint-request-hand.json` - Sample hand for hint analysis

**Sample Hint Update:**

```json
{
  "hint": {
    "recommended_discard": "Bam7",
    "discard_reason": "Keeps options for Consecutive Run pattern",
    "best_patterns": [],
    "tiles_needed_for_win": ["Bam4", "Crak2", "Dot6"],
    "distance_to_win": 3,
    "hot_hand": false,
    "call_opportunities": [],
    "defensive_hints": [],
    "charleston_pass_recommendations": [],
    "tile_scores": {},
    "utility_scores": {}
  }
}
```text

## Edge Cases

### EC-1: Hint Request During Wrong Phase

**Given** I am in the `Drawing` stage (not Discarding)
**When** I try to request a hint
**Then** the "Get Hint" button is disabled or hidden
**And** a tooltip: "Hints only available during your Discarding phase"

### EC-2: Network Error During Hint Request

**Given** I request a hint but the network fails
**When** no `HintUpdate` event is received within 10 seconds
**Then** an error toast appears: "Failed to get hint. Retrying..."
**And** the request is automatically retried (max 2 attempts)
**And** if all retries fail: "Hint unavailable. Please try again later."
**And** failed requests do not change hint state

### EC-3: AI Analysis Timeout (Slow MCTS)

**Given** I requested an "Expert" hint
**When** the backend MCTS engine takes longer than 5 seconds
**Then** a timeout warning appears: "Complex analysis in progress... (5s elapsed)"
**And** after 10 seconds total, the backend returns an "Intermediate" hint instead
**And** a message: "Expert analysis unavailable. Showing intermediate hint."

### EC-5: Disconnection During Hint Analysis

**Given** I requested a hint and the server is analyzing
**When** I disconnect from the server
**Then** the hint request is cancelled server-side
**And** when I reconnect, no hint is provided

### EC-6: Cancel Hint Request

**Given** I requested a hint and the loading overlay is showing
**When** I click the "Cancel" button
**Then** a cancel message is sent to the server (best effort)
**And** the loading overlay closes
**And** the hint request is cleared locally

## Related User Stories

- **US-028**: Adjust Hint Verbosity - Configure default verbosity level
- **US-010**: Discarding a Tile - Hints help decide which tile to discard

## Accessibility Considerations

### Keyboard Navigation

- **H Key**: Shortcut to open hint request (when available)
- **Tab**: Navigate between verbosity options
- **Enter**: Request analysis
- **Escape**: Close hint panel or cancel request

### Screen Reader

- **Button Available**: "Get hint. AI-powered analysis available."
- **Verbosity Selection**: "Select hint detail level. Beginner: Full reasoning. Intermediate: Short label. Expert: Visual highlight only."
- **Loading**: "AI analyzing your hand. Please wait 1 to 3 seconds."
- **Beginner Hint**: "Hint received. Best discard: 7 Bamboo. Reason: Keeps options for Consecutive Run pattern."
- **Intermediate Hint**: "Hint received. Best discard: 7 Bamboo."
- **Expert Hint**: "Hint received. Comprehensive analysis. Best discard highlighted."

### Visual

- **High Contrast**: Hint panel has clear borders and backgrounds
- **Pattern Colors**: Each pattern type has a distinct color (Consecutive: blue, Odds: green, Year: gold)
- **Tile Highlighting**: Best discard tile highlighted with pulsing border in hand
- **Probability Bars**: Visual bars for win probabilities (40% = 40% filled bar)
- **Motion**: Hint panel slide animation respects `prefers-reduced-motion`

## Priority

**MEDIUM** - Learning and assistance feature, helpful but not critical for gameplay

## Story Points / Complexity

**5** - Medium-High complexity

- Integration with backend AI engine (MCTS, EV calculation)
- Three verbosity levels with different data structures
- Complex UI for displaying analysis (especially Expert level)
- Error handling and retry logic
- Performance considerations (AI analysis can be slow)

## Definition of Done

- [ ] "Get Hint" button appears during Discarding stage
- [ ] Click button opens verbosity selector (Beginner/Intermediate/Expert)
- [ ] Default verbosity from user preferences (US-028)
- [ ] "Request Analysis" button sends `RequestHint` command
- [ ] Loading overlay shows "AI analyzing..." with animation
- [ ] Cancel button allows aborting hint request
- [ ] `HintUpdate` event displays appropriate hint panel
- [ ] Beginner hint shows: best discard + short reason
- [ ] Intermediate hint shows: patterns + probabilities + alternatives
- [ ] Expert hint shows: full EV analysis + Joker optimization + opponent awareness
- [ ] Network error handling with retry logic (max 2 retries)
- [ ] AI timeout handling displays error state
- [ ] Disconnection during analysis cancels request
- [ ] Best discard tile highlighted in hand
- [ ] Sound effect plays when hint received
- [ ] Bots do not request hints (human players only)
- [ ] Component tests pass (HintButton, HintPanel, verbosity levels)
- [ ] Integration tests pass (request → AI analysis → display)
- [ ] E2E test passes (full hint flow for each verbosity)
- [ ] Accessibility tests pass (keyboard nav, screen reader, ARIA)
- [ ] Performance tests pass (UI doesn't freeze during AI analysis)
- [ ] Manually tested against `user-testing-plan.md` (Part 6, Hint features)
- [ ] Code reviewed and approved
- [ ] No console errors or warnings

## Notes for Implementers

### AI Analysis Backend

The hint system uses the existing `mahjong_ai` crate:

**Beginner Hints**: Use greedy strategy (fast, <500ms):

```rust
pub fn get_beginner_hint(hand: &Hand, card_year: u16) -> HintSuggestion {
    let greedy = GreedyStrategy::new(card_year);
    let best_discard = greedy.recommend_discard(hand);
  let reason = generate_beginner_reason(hand, best_discard);

    HintSuggestion {
        best_discard,
        reason,
        pattern_recommendations: vec![get_top_pattern(hand)],
        deficiency_analysis: calculate_deficiency_impact(hand, best_discard),
        alternative_discards: vec![],
    }
}
```text

**Intermediate Hints**: Use expected value with limited MCTS (1-2 seconds):

```rust
pub fn get_intermediate_hint(hand: &Hand, card_year: u16) -> HintSuggestion {
    let ev_strategy = EVStrategy::new(card_year);
    let best_discard = ev_strategy.recommend_discard(hand);
    let top_3_patterns = get_viable_patterns(hand, 3);
    let alternatives = get_alternative_discards(hand, 2);

    HintSuggestion {
        best_discard,
        reason: generate_intermediate_reason(hand, best_discard),
        pattern_recommendations: top_3_patterns,
        deficiency_analysis: calculate_deficiency_impact(hand, best_discard),
        alternative_discards: alternatives,
    }
}
```text

**Expert Hints**: Use full MCTS analysis (2-5 seconds):

```rust
pub fn get_expert_hint(hand: &Hand, game_state: &GameState, card_year: u16) -> HintSuggestion {
    let mcts = MCTSEngine::new(1000); // 1000 simulations
    let analysis = mcts.analyze_hand(hand, game_state);

    HintSuggestion {
        best_discard: analysis.best_discard,
        reason: generate_expert_reason(&analysis),
        pattern_recommendations: analysis.all_viable_patterns,
        deficiency_analysis: analysis.deficiency,
        alternative_discards: analysis.alternatives,
        expected_value: Some(analysis.ev),
        joker_optimization: Some(analysis.joker_strategy),
        opponent_awareness: Some(analyze_opponents(game_state)),
        risk_assessment: Some(assess_feed_risk(hand, game_state)),
    }
}
```text

### Hint Panel Component

```typescript
<HintPanel
  hint={receivedHint}
  verbosity={verbosity}
  onClose={() => setShowHint(false)}
/>
```text

The panel should adapt based on verbosity:

```typescript
function HintPanel({ hint, verbosity, onClose }: HintPanelProps) {
  switch (verbosity) {
    case 'Beginner':
      return <BeginnerHintDisplay hint={hint} onClose={onClose} />;
    case 'Intermediate':
      return <IntermediateHintDisplay hint={hint} onClose={onClose} />;
    case 'Expert':
      return <ExpertHintDisplay hint={hint} onClose={onClose} />;
  }
}
```text

### Tile Highlighting in Hand

When hint is received, highlight the recommended discard tile:

```typescript
<ConcealedHand
  tiles={yourHand}
  highlightedTiles={hint?.recommended_discard ? [hint.recommended_discard] : []}
  highlightColor="yellow"
  highlightStyle="pulsing"
/>
```text

### Zustand Store Updates

```typescript
case 'HintUpdate':
  state.currentHint = event.hint;
  state.showHintPanel = true;
  break;
```text

### Performance Considerations

Expert hints can take 2-5 seconds. Show loading state and allow cancellation:

```typescript
const [hintRequestPending, setHintRequestPending] = useState(false);
const hintRequestTimeout = useRef<NodeJS.Timeout>();

function requestHint(verbosity: Verbosity) {
  setHintRequestPending(true);

  sendCommand({ RequestHint: { player: mySeat, verbosity } });

  // Timeout after 10 seconds
  hintRequestTimeout.current = setTimeout(() => {
    showError('Hint request timed out. Please try again.');
    setHintRequestPending(false);
  }, 10000);
}

function cancelHintRequest() {
  if (hintRequestTimeout.current) {
    clearTimeout(hintRequestTimeout.current);
  }
  setHintRequestPending(false);
  // Optionally send cancel command to server
}

// Clear timeout when hint received
case 'HintUpdate':
  if (hintRequestTimeout.current) {
    clearTimeout(hintRequestTimeout.current);
  }
  setHintRequestPending(false);
  // ... handle hint
  break;
```text

```text

```text
````
