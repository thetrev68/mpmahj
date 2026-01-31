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
**And** the button shows the hint count: "Get Hint (2/3 remaining)"
**And** a tooltip displays: "AI analysis powered by MCTS engine"

### AC-2: Request Hint with Verbosity Selection

**Given** the "Get Hint" button is available
**When** I click the button
**Then** a verbosity selector appears with options: "Brief", "Detailed", "Expert"
**And** the default verbosity is set from my user preferences (US-028)
**And** a "Request Analysis" button appears

### AC-3: Send Hint Request Command

**Given** I selected verbosity level "Detailed"
**When** I click "Request Analysis"
**Then** a `RequestHint { player: me, verbosity: Detailed }` command is sent to the server
**And** a loading overlay appears: "AI analyzing your hand... (1-3 seconds)"
**And** the hint button is disabled during analysis
**And** a cancel button appears to abort the request

### AC-4: Receive AI Analysis (Brief Verbosity)

**Given** I requested a "Brief" hint
**When** the server emits `HintProvided { player: me, suggestions: {...}, verbosity: Brief }`
**Then** a hint panel appears with:

- **Best Discard**: "7 Bamboo" (tile highlighted)
- **Reason**: "Keeps options for Consecutive Run pattern"
- **Quick Tip**: Icon-based pattern suggestion
  **And** the hint displays for 10 seconds or until dismissed
  **And** a sound effect plays (optional "insight chime")

### AC-5: Receive AI Analysis (Detailed Verbosity)

**Given** I requested a "Detailed" hint
**When** the server emits `HintProvided { player: me, suggestions: {...}, verbosity: Detailed }`
**Then** the hint panel shows:

- **Best Discard**: "7 Bamboo" with deficiency impact (3 → 3 tiles needed)
- **Top Patterns**: List of 3 viable patterns with win probabilities
  - Consecutive Run (40% win probability, needs [Bam4, Crak2, Dot6])
  - Odds Only (25% win probability, needs [Bam1, Crak3, Dot5])
  - Year 2025 (15% win probability, needs [Flower1, Dragon3])
- **Alternative Discards**: 2nd and 3rd best options
  - 5 Dots (deficiency: 3 → 4, less optimal)
  - 9 Crack (deficiency: 3 → 5, keep as backup)
- **Strategic Reasoning**: Paragraph explaining the recommendation

### AC-6: Receive AI Analysis (Expert Verbosity)

**Given** I requested an "Expert" hint
**When** the server emits `HintProvided { player: me, suggestions: {...}, verbosity: Expert }`
**Then** the hint panel shows comprehensive analysis:

- **Full Hand Evaluation**: Current deficiency (3 tiles) and composition analysis
- **All Viable Patterns**: Complete list with probabilities, deficiencies, and tile requirements
- **Expected Value (EV) Analysis**:
  - Discard 7 Bam: +2.3 EV points
  - Discard 5 Dots: +1.7 EV points
  - Discard 9 Crak: +0.9 EV points
- **Joker Optimization**: How to best use Jokers (e.g., "Hold Joker for Consecutive Run flexibility")
- **Opponent Awareness**: What tiles opponents are likely collecting (based on discards)
- **Risk Assessment**: Probability of feeding opponents (e.g., "5 Dots: 15% risk, East may need it")
- **Long-term Strategy**: Multi-turn planning and pattern pivoting advice

### AC-7: Hint Counter Decrements

**Given** I successfully received a hint
**When** the hint panel is displayed
**Then** the hint counter decrements: "2/3 remaining" → "1/3 remaining"
**And** a message displays: "2 hints remaining this game"
**And** the hint button shows the updated count

### AC-8: Hint Limit Reached

**Given** I have used all 3 hints in the current game
**When** my turn occurs
**Then** the "Get Hint" button is disabled and grayed out
**And** a tooltip displays: "Hint limit reached (3/3 used)"
**And** a message: "No more hints available this game"

### AC-9: Hint Cooldown Period

**Given** I just received a hint
**When** I try to request another hint immediately
**Then** the "Get Hint" button is disabled for 30 seconds
**And** a countdown timer displays: "Next hint in 28s..."
**And** after 30 seconds, the button is re-enabled (if hints remain)

### AC-10: Bot Players Do Not Request Hints

**Given** a bot player is in the game
**When** it is the bot's turn
**Then** the bot does NOT request hints (bots use their own AI logic)
**And** hint functionality is only for human players

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  RequestHint: {
    player: Seat,
    verbosity: "Brief" | "Detailed" | "Expert"
  }
}
```

### Events (Backend → Frontend)

**Private Events (to requesting player only):**

```typescript
{
  kind: 'Private',
  event: {
    HintProvided: {
      player: Seat,
      suggestions: {
        best_discard: Tile,
        reason: string,
        pattern_recommendations: PatternSuggestion[],
        deficiency_analysis: DeficiencyAnalysis,
        alternative_discards: AlternativeDiscard[],
        expected_value?: EVAnalysis,  // Expert only
        joker_optimization?: string,   // Expert only
        opponent_awareness?: OpponentAnalysis,  // Expert only
        risk_assessment?: RiskAnalysis  // Expert only
      },
      verbosity: "Brief" | "Detailed" | "Expert",
      analysis_time_ms: number  // Time AI took to analyze
    }
  }
}

interface PatternSuggestion {
  pattern_name: string;
  win_probability: number;  // 0.0 to 1.0
  deficiency: number;
  tiles_needed: Tile[];
  score: number;
}

interface DeficiencyAnalysis {
  current_deficiency: number;
  after_discard: number;
  improvement: number;  // Positive = better, negative = worse
}

interface AlternativeDiscard {
  tile: Tile;
  reason: string;
  deficiency_impact: number;
  ev_impact?: number;  // Expert only
}

interface EVAnalysis {
  tile: Tile;
  expected_value: number;
  calculation: string;  // Explanation of EV calculation
}

interface OpponentAnalysis {
  seat: Seat;
  likely_patterns: string[];
  dangerous_tiles: Tile[];
  safe_tiles: Tile[];
}

interface RiskAnalysis {
  tile: Tile;
  feed_probability: number;
  opponent: Seat | null;
}
```

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `RequestHint` command
  - `crates/mahjong_ai/src/strategies/expected_value.rs` - Expected value calculations
  - `crates/mahjong_ai/src/mcts.rs` - Monte Carlo Tree Search engine for deep analysis
  - `crates/mahjong_ai/src/strategies/greedy.rs` - Greedy strategy for quick hints
  - `crates/mahjong_ai/src/bot/medium.rs` - Medium difficulty bot logic (similar to Detailed hints)
  - `crates/mahjong_ai/src/bot/hard.rs` - Hard difficulty bot logic (similar to Expert hints)
  - `crates/mahjong_core/src/rules/validator.rs` - Pattern validation and deficiency calculation
  - `crates/mahjong_core/src/event/private_events.rs` - Add `HintProvided` event
- **Game Design Doc**:
  - Section 6.1 (AI-Powered Hints System)
  - Section 6.2 (Hint Verbosity Levels)
  - Section 6.3 (MCTS Analysis for Expert Hints)

## Components Involved

- **`<HintButton>`** - Request hint button with counter
- **`<HintVerbositySelector>`** - Choose Brief/Detailed/Expert
- **`<HintPanel>`** - Display AI suggestions
- **`<HintLoadingOverlay>`** - "AI analyzing..." animation
- **`<BriefHintDisplay>`** - Simple one-line suggestion
- **`<DetailedHintDisplay>`** - Pattern list and alternatives
- **`<ExpertHintDisplay>`** - Comprehensive analysis with EV
- **`<PatternRecommendationList>`** - List of viable patterns
- **`<HintCounter>`** - Shows remaining hints (e.g., "2/3")
- **`<HintCooldownTimer>`** - 30-second countdown
- **`useSoundEffects()`** - Insight chime sound

**Component Specs:**

- `component-specs/presentational/HintButton.md` (NEW)
- `component-specs/presentational/HintVerbositySelector.md` (NEW)
- `component-specs/presentational/HintPanel.md` (NEW)
- `component-specs/presentational/BriefHintDisplay.md` (NEW)
- `component-specs/presentational/DetailedHintDisplay.md` (NEW)
- `component-specs/presentational/ExpertHintDisplay.md` (NEW)
- `component-specs/presentational/HintCounter.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/hint-request-brief.md`** - Request and display brief hint
- **`tests/test-scenarios/hint-request-detailed.md`** - Request and display detailed hint
- **`tests/test-scenarios/hint-request-expert.md`** - Request and display expert hint
- **`tests/test-scenarios/hint-limit-reached.md`** - Use all 3 hints, button disabled
- **`tests/test-scenarios/hint-cooldown.md`** - 30-second cooldown between hints
- **`tests/test-scenarios/hint-network-error.md`** - Network failure during hint request

## Mock Data

**Fixtures:**

- `tests/fixtures/hints/brief-hint-response.json` - Sample brief hint
- `tests/fixtures/hints/detailed-hint-response.json` - Sample detailed hint
- `tests/fixtures/hints/expert-hint-response.json` - Sample expert hint
- `tests/fixtures/hands/hint-request-hand.json` - Sample hand for hint analysis

**Sample Brief Hint:**

```json
{
  "player": "South",
  "suggestions": {
    "best_discard": "Bam7",
    "reason": "Keeps options for Consecutive Run pattern",
    "pattern_recommendations": [
      {
        "pattern_name": "Consecutive Run",
        "win_probability": 0.4,
        "deficiency": 3,
        "tiles_needed": ["Bam4", "Crak2", "Dot6"],
        "score": 30
      }
    ],
    "deficiency_analysis": {
      "current_deficiency": 3,
      "after_discard": 3,
      "improvement": 0
    },
    "alternative_discards": []
  },
  "verbosity": "Brief",
  "analysis_time_ms": 450
}
```

**Sample Expert Hint:**

```json
{
  "player": "South",
  "suggestions": {
    "best_discard": "Bam7",
    "reason": "Optimal EV (+2.3 points) while maintaining pattern flexibility",
    "pattern_recommendations": [
      {
        "pattern_name": "Consecutive Run",
        "win_probability": 0.4,
        "deficiency": 3,
        "tiles_needed": ["Bam4", "Crak2", "Dot6"],
        "score": 30
      },
      {
        "pattern_name": "Odds Only",
        "win_probability": 0.25,
        "deficiency": 4,
        "tiles_needed": ["Bam1", "Crak3", "Dot5", "Dot9"],
        "score": 35
      },
      {
        "pattern_name": "Year 2025",
        "win_probability": 0.15,
        "deficiency": 5,
        "tiles_needed": ["Flower1", "Flower2", "Dragon3", "Wind4", "Joker"],
        "score": 50
      }
    ],
    "deficiency_analysis": {
      "current_deficiency": 3,
      "after_discard": 3,
      "improvement": 0
    },
    "alternative_discards": [
      {
        "tile": "Dot5",
        "reason": "Closes Consecutive Run option but keeps Odds Only viable",
        "deficiency_impact": 1,
        "ev_impact": -0.6
      },
      {
        "tile": "Crak9",
        "reason": "Backup option, minimal pattern impact",
        "deficiency_impact": 2,
        "ev_impact": -1.4
      }
    ],
    "expected_value": {
      "tile": "Bam7",
      "expected_value": 2.3,
      "calculation": "Weighted probability across all viable patterns with Joker flexibility"
    },
    "joker_optimization": "Hold Joker for Consecutive Run (40% win prob). Can substitute for Bam4, Crak2, or Dot6. Do not use Joker for Odds Only unless forced.",
    "opponent_awareness": {
      "East": {
        "likely_patterns": ["Winds and Dragons", "Year 2025"],
        "dangerous_tiles": ["Wind1", "Dragon2", "Flower1"],
        "safe_tiles": ["Bam7", "Crak9", "Dot1"]
      },
      "West": {
        "likely_patterns": ["Consecutive Run", "Like Numbers"],
        "dangerous_tiles": ["Bam4", "Bam5", "Bam6"],
        "safe_tiles": ["Wind3", "Dragon1"]
      }
    },
    "risk_assessment": [
      {
        "tile": "Dot5",
        "feed_probability": 0.15,
        "opponent": "East"
      },
      {
        "tile": "Bam7",
        "feed_probability": 0.05,
        "opponent": null
      }
    ]
  },
  "verbosity": "Expert",
  "analysis_time_ms": 2150
}
```

## Edge Cases

### EC-1: Hint Request During Wrong Phase

**Given** I am in the `Drawing` stage (not Discarding)
**When** I try to request a hint
**Then** the "Get Hint" button is disabled or hidden
**And** a tooltip: "Hints only available during your Discarding phase"

### EC-2: Network Error During Hint Request

**Given** I request a hint but the network fails
**When** no `HintProvided` event is received within 10 seconds
**Then** an error toast appears: "Failed to get hint. Retrying..."
**And** the request is automatically retried (max 2 attempts)
**And** if all retries fail: "Hint unavailable. Please try again later."
**And** the hint counter does NOT decrement (failed request doesn't count)

### EC-3: AI Analysis Timeout (Slow MCTS)

**Given** I requested an "Expert" hint
**When** the backend MCTS engine takes longer than 5 seconds
**Then** a timeout warning appears: "Complex analysis in progress... (5s elapsed)"
**And** after 10 seconds total, the backend returns a "Detailed" hint instead
**And** a message: "Expert analysis unavailable. Showing detailed hint."

### EC-4: Hint Limit Per Game

**Given** the room was created with "Unlimited Hints" house rule disabled
**When** I use my 3rd hint
**Then** the hint counter shows "3/3 used"
**And** the "Get Hint" button is permanently disabled for this game
**And** tooltip: "Hint limit reached. No more hints available."

### EC-5: Disconnection During Hint Analysis

**Given** I requested a hint and the server is analyzing
**When** I disconnect from the server
**Then** the hint request is cancelled server-side
**And** when I reconnect, no hint is provided
**And** the hint counter remains unchanged (request didn't complete)

### EC-6: Cancel Hint Request

**Given** I requested a hint and the loading overlay is showing
**When** I click the "Cancel" button
**Then** a cancel message is sent to the server (best effort)
**And** the loading overlay closes
**And** the hint counter does NOT decrement (cancelled request doesn't count)
**And** the cooldown is reset (can request again immediately)

## Related User Stories

- **US-028**: Adjust Hint Verbosity - Configure default verbosity level
- **US-034**: Configure House Rules - Hint limit can be configured per room
- **US-010**: Discarding a Tile - Hints help decide which tile to discard

## Accessibility Considerations

### Keyboard Navigation

- **H Key**: Shortcut to open hint request (when available)
- **Tab**: Navigate between verbosity options
- **Enter**: Request analysis
- **Escape**: Close hint panel or cancel request

### Screen Reader

- **Button Available**: "Get hint. 2 of 3 hints remaining. AI-powered analysis available."
- **Verbosity Selection**: "Select hint detail level. Brief: Quick suggestion. Detailed: Pattern analysis. Expert: Comprehensive evaluation."
- **Loading**: "AI analyzing your hand. Please wait 1 to 3 seconds."
- **Brief Hint**: "Hint received. Best discard: 7 Bamboo. Reason: Keeps options for Consecutive Run pattern."
- **Detailed Hint**: "Hint received. Best discard: 7 Bamboo. Top patterns: Consecutive Run 40% win probability, needs Bamboo 4, Crack 2, Dots 6. Odds Only 25% win probability, needs Bamboo 1, Crack 3, Dots 5."
- **Expert Hint**: "Hint received. Comprehensive analysis. Best discard: 7 Bamboo, expected value 2.3 points. [Full analysis read line by line]."
- **Limit Reached**: "Hint limit reached. 3 of 3 hints used. No more hints available this game."
- **Cooldown**: "Next hint available in 25 seconds."

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
- Hint counter and limit management
- Cooldown timer logic
- Complex UI for displaying analysis (especially Expert level)
- Error handling and retry logic
- Performance considerations (AI analysis can be slow)

## Definition of Done

- [ ] "Get Hint" button appears during Discarding stage
- [ ] Button shows hint counter (e.g., "2/3 remaining")
- [ ] Click button opens verbosity selector (Brief/Detailed/Expert)
- [ ] Default verbosity from user preferences (US-028)
- [ ] "Request Analysis" button sends `RequestHint` command
- [ ] Loading overlay shows "AI analyzing..." with animation
- [ ] Cancel button allows aborting hint request
- [ ] `HintProvided` event displays appropriate hint panel
- [ ] Brief hint shows: best discard + short reason
- [ ] Detailed hint shows: patterns + probabilities + alternatives
- [ ] Expert hint shows: full EV analysis + Joker optimization + opponent awareness
- [ ] Hint counter decrements after successful hint
- [ ] Hint limit enforced (3 per game default, configurable)
- [ ] "Get Hint" button disabled when limit reached
- [ ] 30-second cooldown between hints
- [ ] Cooldown timer displays countdown
- [ ] Network error handling with retry logic (max 2 retries)
- [ ] Failed requests don't count against hint limit
- [ ] AI timeout handling (fallback to Detailed after 10s)
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

**Brief Hints**: Use greedy strategy (fast, <500ms):

```rust
pub fn get_brief_hint(hand: &Hand, card_year: u16) -> HintSuggestion {
    let greedy = GreedyStrategy::new(card_year);
    let best_discard = greedy.recommend_discard(hand);
    let reason = generate_brief_reason(hand, best_discard);

    HintSuggestion {
        best_discard,
        reason,
        pattern_recommendations: vec![get_top_pattern(hand)],
        deficiency_analysis: calculate_deficiency_impact(hand, best_discard),
        alternative_discards: vec![],
    }
}
```

**Detailed Hints**: Use expected value with limited MCTS (1-2 seconds):

```rust
pub fn get_detailed_hint(hand: &Hand, card_year: u16) -> HintSuggestion {
    let ev_strategy = EVStrategy::new(card_year);
    let best_discard = ev_strategy.recommend_discard(hand);
    let top_3_patterns = get_viable_patterns(hand, 3);
    let alternatives = get_alternative_discards(hand, 2);

    HintSuggestion {
        best_discard,
        reason: generate_detailed_reason(hand, best_discard),
        pattern_recommendations: top_3_patterns,
        deficiency_analysis: calculate_deficiency_impact(hand, best_discard),
        alternative_discards: alternatives,
    }
}
```

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
```

### Hint Panel Component

```typescript
<HintPanel
  hint={receivedHint}
  verbosity={verbosity}
  onClose={() => setShowHint(false)}
/>
```

The panel should adapt based on verbosity:

```typescript
function HintPanel({ hint, verbosity, onClose }: HintPanelProps) {
  switch (verbosity) {
    case 'Brief':
      return <BriefHintDisplay hint={hint} onClose={onClose} />;
    case 'Detailed':
      return <DetailedHintDisplay hint={hint} onClose={onClose} />;
    case 'Expert':
      return <ExpertHintDisplay hint={hint} onClose={onClose} />;
  }
}
```

### Hint Counter Management

```typescript
const [hintsUsed, setHintsUsed] = useState(0);
const hintLimit = roomConfig.hint_limit ?? 3; // Default 3
const hintsRemaining = hintLimit - hintsUsed;

function handleHintReceived() {
  setHintsUsed((prev) => prev + 1);
  setLastHintTime(Date.now());
}

const canRequestHint = hintsRemaining > 0 && cooldownElapsed;
```

### Cooldown Timer

```typescript
const HINT_COOLDOWN_MS = 30000; // 30 seconds

const [lastHintTime, setLastHintTime] = useState<number | null>(null);

const cooldownRemaining = useMemo(() => {
  if (!lastHintTime) return 0;
  const elapsed = Date.now() - lastHintTime;
  return Math.max(0, HINT_COOLDOWN_MS - elapsed);
}, [lastHintTime]);

const cooldownElapsed = cooldownRemaining === 0;

// Update every second
useEffect(() => {
  if (cooldownRemaining > 0) {
    const interval = setInterval(() => {
      // Force re-render to update countdown
    }, 1000);
    return () => clearInterval(interval);
  }
}, [cooldownRemaining]);
```

### Tile Highlighting in Hand

When hint is received, highlight the recommended discard tile:

```typescript
<ConcealedHand
  tiles={yourHand}
  highlightedTiles={hintRecommendation ? [hintRecommendation.best_discard] : []}
  highlightColor="yellow"
  highlightStyle="pulsing"
/>
```

### Zustand Store Updates

```typescript
case 'HintProvided':
  state.currentHint = event.suggestions;
  state.hintVerbosity = event.verbosity;
  state.hintsUsed += 1;
  state.lastHintTime = Date.now();
  state.showHintPanel = true;
  break;
```

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
case 'HintProvided':
  if (hintRequestTimeout.current) {
    clearTimeout(hintRequestTimeout.current);
  }
  setHintRequestPending(false);
  // ... handle hint
  break;
```
