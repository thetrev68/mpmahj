# 10. AI Strategy Engine Implementation Spec

This document specifies the AI decision-making system for American Mahjong, designed to work alongside the validation engine to create intelligent computer opponents.

<!-- ****implemented**** -->

---

## 1. Architecture Overview

The AI strategy engine is separated from core game logic into a dedicated `mahjong_ai` crate:

- **`mahjong_core`**: Answers "Is this legal?" (validation, state management)
- **`mahjong_ai`**: Answers "What should I do?" (strategic decision-making)
- **Integration Point**: AI queries the validator for pattern analysis, then applies strategic evaluation

### 1.1 Design Separation

```text
┌─────────────────────────────────────────────────────────────┐
│                     mahjong_server                          │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Table       │ ◄────── │   AI Player  │                 │
│  │  (Game Loop) │         │   Controller │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
└─────────┼────────────────────────┼──────────────────────────┘
          │                        │
          ▼                        ▼
┌─────────────────┐      ┌──────────────────────────┐
│  mahjong_core   │      │     mahjong_ai           │
│  ┌────────────┐ │      │  ┌─────────────────────┐ │
│  │ Validator  │ │      │  │  MCTS Engine        │ │
│  │ (Is legal?)│ │◄─────┤  │  (What to do?)      │ │
│  └────────────┘ │      │  └─────────────────────┘ │
│  ┌────────────┐ │      │  ┌─────────────────────┐ │
│  │  Hand      │ │      │  │  Tile Availability  │ │
│  │  State     │ │      │  │  Tracking           │ │
│  └────────────┘ │      │  └─────────────────────┘ │
└─────────────────┘      │  ┌─────────────────────┐ │
                         │  │  EV Calculation     │ │
                         │  └─────────────────────┘ │
                         └──────────────────────────┘
```

**Why Separate Crates?**

1. **Validation is deterministic** - Same input always produces same output
2. **AI is probabilistic** - Uses Monte Carlo methods, randomness, heuristics
3. **Core must be fast** - ~50 µs validations enable thousands of simulations
4. **AI can be swapped** - Future: Replace MCTS with neural networks
5. **Testing isolation** - AI bugs don't break core game rules

### 1.2 Module Structure

```text
crates/mahjong_ai/
├── src/
│   ├── lib.rs                  # Public API exports
│   ├── trait.rs                # MahjongAI trait definition
│   ├── context.rs              # VisibleTiles, GamePhaseContext
│   ├── evaluation.rs           # EV calculation, difficulty scoring
│   ├── probability.rs          # Tile availability, P(tile) calculations
│   ├── mcts/
│   │   ├── mod.rs              # MCTS orchestrator
│   │   ├── node.rs             # Tree node structure
│   │   ├── simulation.rs       # Determinization, rollout
│   │   └── ucb.rs              # Selection policy (UCB1)
│   ├── strategies/
│   │   ├── mod.rs              # Strategy registry
│   │   ├── random.rs           # RandomAI (easy difficulty)
│   │   ├── greedy.rs           # GreedyAI (medium difficulty)
│   │   └── expert.rs           # ExpertAI (MCTS-based, hard/expert)
│   └── charleston.rs           # Charleston-specific logic
└── Cargo.toml
```

**Dependencies:**

- `mahjong_core` (validation, hand types)
- `rand` (determinization, random playouts)
- `rayon` (parallel MCTS simulations)
- `serde` (serialization for debugging/analysis)

### 1.3 Performance Targets

| Operation                 | Target Time | Notes                                    |
| ------------------------- | ----------- | ---------------------------------------- |
| **Charleston decision**   | <50ms       | Evaluate ~10 patterns, pick best tiles   |
| **Discard selection**     | <100ms      | MCTS with 1,000-10,000 iterations        |
| **Call decision**         | <10ms       | Simple EV calculation, no search         |
| **MCTS iteration**        | ~10 µs      | Validation + eval (must be fast!)        |
| **Memory per AI player**  | <50MB       | Tree nodes + probability tables          |

**Rationale:** AI decisions must feel instant to human players. 100ms is the threshold for perceived instantaneousness.

---

## 2. Relationship to BasicBot (08-bot-ai.md)

This specification describes a **strategic AI engine** for competitive play. It is separate from and complementary to the **BasicBot** described in [08-bot-ai.md](08-bot-ai.md).

### 2.1 Two AI Systems, Different Purposes

| Aspect | BasicBot (08-bot-ai.md) | Strategic AI (This Spec) |
| ------ | ----------------------- | ------------------------ |
| **Purpose** | Testing, MVP single-player | Competitive gameplay, challenge mode |
| **Complexity** | Simple heuristics | MCTS + probabilistic modeling |
| **Decision Time** | <10ms (instant) | <100ms (deliberate) |
| **Memory** | <10KB per bot | <50MB per AI |
| **Difficulty Levels** | 1 (Basic only) | 4 (Easy/Medium/Hard/Expert) |
| **Strategic Depth** | None (reactive only) | Deep (lookahead, opponent modeling) |
| **Implementation** | ~1-2 weeks | ~6-10 weeks |
| **Use Cases** | Integration tests, practice mode | Competitive play, teaching tool |

### 2.2 Shared Interface

Both AI systems implement the same `MahjongAI` trait, making them interchangeable:

```rust
pub trait MahjongAI {
    fn select_charleston_tiles(&mut self, hand: &Hand, ...) -> Vec<Tile>;
    fn select_discard(&mut self, hand: &Hand, ...) -> Tile;
    fn should_call(&self, hand: &Hand, discard: Tile, ...) -> bool;
}

// MVP: Simple rule-based bot (08-bot-ai.md)
pub struct BasicBot {
    rng: StdRng,
}

impl MahjongAI for BasicBot {
    fn select_discard(&mut self, hand: &Hand, ...) -> Tile {
        // Simple scoring heuristic:
        // Keep: Jokers (-1000), Flowers (-15), Pairs (-20)
        // Discard: Isolated tiles (+10), 1s/9s (+5)
        hand.concealed.iter()
            .min_by_key(|t| tile_discard_score(t, hand))
            .unwrap()
    }
}

// Strategic: MCTS-powered expert AI (this spec)
pub struct ExpertAI {
    mcts_engine: MCTSEngine,
    visible_tiles: VisibleTiles,
}

impl MahjongAI for ExpertAI {
    fn select_discard(&mut self, hand: &Hand, ...) -> Tile {
        // Run 10,000 MCTS simulations, pick best move
        self.mcts_engine.search(hand, &self.visible_tiles, 10_000)
    }
}
```

### 2.3 When to Use Each

**Use BasicBot when:**

- Running integration tests (need 4 bots to complete quickly)
- Providing casual single-player practice
- Debugging game flow (fast, predictable behavior)
- Users want a relaxed, easy opponent

**Use Strategic AI when:**

- Users want a challenge (Hard/Expert modes)
- Teaching optimal play (show AI reasoning)
- AI tournaments or competitions
- Demonstrating "best possible" play

### 2.4 Migration Path

```text
Phase 1: Validation Engine (02-validation.md)
    ↓
Phase 2: BasicBot (08-bot-ai.md)
    ↓ (Both AI types depend on validation)
    ↓
Phase 3: Strategic AI Engine (this spec)
    ↓
Phase 4: Neural Network AI (future)
```

**Recommendation:** Implement BasicBot first. It unblocks testing and provides a working game. Strategic AI can be added later as an enhancement without disrupting existing functionality.

---

## 3. Core Data Structures

### 3.1 VisibleTiles

Tracks all publicly known tiles (discards, exposed melds, revealed Charleston passes).

```rust
/// Tracks all tiles visible to all players.
/// Used for calculating tile availability and probability.
#[derive(Debug, Clone)]
pub struct VisibleTiles {
    /// Count of each tile type that is known to be unavailable.
    /// Index matches Tile encoding (0-36).
    pub counts: Vec<u8>,

    /// Tiles in the discard pile (ordered, for sequence analysis).
    pub discards: Vec<Tile>,

    /// Exposed melds by each player.
    pub exposed_melds: HashMap<Seat, Vec<Meld>>,

    /// Total tiles drawn so far (for wall depletion tracking).
    pub tiles_drawn: usize,
}

impl VisibleTiles {
    /// Create a new tracker at game start.
    pub fn new() -> Self {
        Self {
            counts: vec![0u8; TILE_COUNT],
            discards: Vec::new(),
            exposed_melds: HashMap::new(),
            tiles_drawn: 0,
        }
    }

    /// Add a discarded tile.
    pub fn add_discard(&mut self, tile: Tile) {
        self.counts[tile.0 as usize] += 1;
        self.discards.push(tile);
    }

    /// Add an exposed meld.
    pub fn add_meld(&mut self, seat: Seat, meld: Meld) {
        for tile in &meld.tiles {
            if !tile.is_joker() {
                self.counts[tile.0 as usize] += 1;
            }
        }
        self.exposed_melds.entry(seat).or_default().push(meld);
    }

    /// Get the number of a specific tile that are visible.
    pub fn count_visible(&self, tile: Tile) -> usize {
        self.counts[tile.0 as usize] as usize
    }

    /// Calculate how many of a tile remain available.
    /// Standard American Mahjong has 4 of each tile (except Flowers=8, Jokers=8).
    pub fn count_available(&self, tile: Tile) -> usize {
        let total = if tile.is_flower() || tile.is_joker() { 8 } else { 4 };
        total.saturating_sub(self.count_visible(tile))
    }

    /// Check if a tile is "dead" (all copies are visible).
    pub fn is_dead(&self, tile: Tile) -> bool {
        self.count_available(tile) == 0
    }

    /// Estimate wall depletion percentage (0.0 = full, 1.0 = empty).
    /// Used to adjust risk tolerance (play aggressively when wall is depleting).
    pub fn wall_depletion(&self) -> f64 {
        const TOTAL_TILES: usize = 152;
        const DEAD_WALL: usize = 14; // Tiles reserved by dice roll
        const DEALT_TILES: usize = 52; // 13 per player

        let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
        self.tiles_drawn as f64 / drawable as f64
    }
}
```

**Key Insight:** `VisibleTiles` is the AI's "shared knowledge" - what everyone at the table knows. Each AI also tracks its own concealed hand.

### 2.2 StrategicEvaluation

Extends `AnalysisResult` with probability and difficulty metrics.

```rust
/// Strategic evaluation of a hand against a specific pattern.
/// Extends AnalysisResult with AI-specific metrics.
#[derive(Debug, Clone)]
pub struct StrategicEvaluation {
    /// The pattern being evaluated.
    pub pattern_id: String,
    pub variation_id: String,

    /// Deficiency from validator (exact tiles needed).
    pub deficiency: i32,

    /// Difficulty-weighted deficiency (accounts for tile scarcity).
    pub difficulty: f64,

    /// Probability of completing this pattern (0.0-1.0).
    pub probability: f64,

    /// Expected Value: V(pattern) × P(completion).
    pub expected_value: f64,

    /// Pattern score if won.
    pub score: u16,

    /// Is this pattern still viable? (false if required tiles are dead)
    pub viable: bool,
}

impl StrategicEvaluation {
    /// Create from AnalysisResult and VisibleTiles context.
    pub fn from_analysis(
        analysis: AnalysisResult,
        hand: &Hand,
        visible: &VisibleTiles,
        target_histogram: &[u8],
    ) -> Self {
        let difficulty = calculate_difficulty(hand, target_histogram, visible);
        let probability = calculate_probability(hand, target_histogram, visible);
        let viable = check_viability(target_histogram, visible);

        let expected_value = if viable {
            (analysis.score as f64) * probability
        } else {
            0.0
        };

        Self {
            pattern_id: analysis.pattern_id,
            variation_id: analysis.variation_id,
            deficiency: analysis.deficiency,
            difficulty,
            probability,
            expected_value,
            score: analysis.score,
            viable,
        }
    }
}
```

**Design Decision:** Keep `AnalysisResult` in `mahjong_core` as a pure validation output. `StrategicEvaluation` is the AI-specific extension that adds strategic context.

### 2.3 GamePhaseContext

Different game phases have different available information.

```rust
/// Contextual information available to AI during different game phases.
#[derive(Debug, Clone)]
pub enum GamePhaseContext {
    Charleston {
        stage: CharlestonStage,
        hand: Hand,
        visible: VisibleTiles,
        pass_direction: PassDirection,
    },

    Playing {
        hand: Hand,
        visible: VisibleTiles,
        drawn_tile: Option<Tile>,
        turn_number: u32,
        current_seat: Seat,
    },

    CallWindow {
        hand: Hand,
        visible: VisibleTiles,
        discard: Tile,
        discarded_by: Seat,
        current_seat: Seat,
    },
}

impl GamePhaseContext {
    /// Extract the AI's current hand.
    pub fn hand(&self) -> &Hand {
        match self {
            Self::Charleston { hand, .. } => hand,
            Self::Playing { hand, .. } => hand,
            Self::CallWindow { hand, .. } => hand,
        }
    }

    /// Extract visible tiles.
    pub fn visible(&self) -> &VisibleTiles {
        match self {
            Self::Charleston { visible, .. } => visible,
            Self::Playing { visible, .. } => visible,
            Self::CallWindow { visible, .. } => visible,
        }
    }
}
```

**Why Separate Contexts?**

- **Charleston:** No discards yet, focus on hand potential
- **Playing:** Full game state, MCTS needs complete information
- **CallWindow:** Time-critical decision, simple heuristics only

### 2.4 AIDecision

The output type for all AI decisions.

```rust
/// The result of an AI decision.
#[derive(Debug, Clone)]
pub enum AIDecision {
    /// Charleston: Which tiles to pass.
    CharlestonPass {
        tiles: Vec<Tile>,
        reasoning: String, // For debugging/logging
    },

    /// Charleston: Vote to continue or stop.
    CharlestonVote {
        vote: CharlestonVote,
        reasoning: String,
    },

    /// Main game: Which tile to discard.
    Discard {
        tile: Tile,
        reasoning: String,
    },

    /// Call window: Should we call this discard?
    Call {
        should_call: bool,
        call_type: Option<MeldType>, // Pung/Kong/Quint/Mahjong
        reasoning: String,
    },
}
```

**Reasoning Field:** Helps with debugging and analysis. Can be logged for post-game review.

---

## 3. Tile Availability & Probability

### 3.1 Probability Calculation

Calculate the probability of drawing a specific tile given current game state.

```rust
/// Calculate P(tile) - probability of drawing a specific tile.
///
/// # Arguments
/// * `tile` - The tile we want to draw
/// * `visible` - Tiles that are publicly visible
/// * `hand` - AI's current hand (tiles AI already has)
///
/// # Returns
/// Probability between 0.0 and 1.0
pub fn calculate_tile_probability(
    tile: Tile,
    visible: &VisibleTiles,
    hand: &Hand,
) -> f64 {
    // Total copies in deck (4 for most tiles, 8 for Flowers/Jokers)
    let total = if tile.is_flower() || tile.is_joker() { 8 } else { 4 };

    // Visible + in our hand
    let visible_count = visible.count_visible(tile);
    let in_hand = hand.count_tile(tile);
    let known = visible_count + in_hand;

    // Remaining copies in the wall
    let remaining_copies = total.saturating_sub(known);

    if remaining_copies == 0 {
        return 0.0; // Dead tile
    }

    // Total tiles remaining in wall
    const TOTAL_TILES: usize = 152;
    const DEAD_WALL: usize = 14;
    const DEALT_TILES: usize = 52; // 13 × 4 players

    let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
    let tiles_in_wall = drawable - visible.tiles_drawn;

    if tiles_in_wall == 0 {
        return 0.0; // Wall exhausted
    }

    // Simple probability: remaining copies / remaining tiles
    remaining_copies as f64 / tiles_in_wall as f64
}

/// Calculate probability of completing a pattern from current hand.
///
/// Uses a simplified Monte Carlo estimate:
/// 1. Identify missing tiles from target histogram
/// 2. Calculate P(drawing each missing tile)
/// 3. Combine probabilities (assuming independence)
///
/// # Returns
/// Estimated probability of completion (0.0-1.0)
pub fn calculate_probability(
    hand: &Hand,
    target_histogram: &[u8],
    visible: &VisibleTiles,
) -> f64 {
    let deficiency = hand.calculate_deficiency(target_histogram);

    if deficiency == 0 {
        return 1.0; // Already complete
    }

    if deficiency > 6 {
        return 0.0; // Too far away to be realistic
    }

    // Collect missing tiles
    let mut missing_tiles = Vec::new();
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];
        if needed > have {
            let tile = Tile::new(i as u8);
            for _ in 0..(needed - have) {
                missing_tiles.push(tile);
            }
        }
    }

    // Calculate joint probability (simplified: assume independent draws)
    // This is an approximation - true calculation requires hypergeometric distribution
    let mut prob = 1.0;
    for tile in missing_tiles {
        let p = calculate_tile_probability(tile, visible, hand);
        prob *= p;

        if prob < 0.001 {
            return 0.0; // Effectively impossible
        }
    }

    prob
}
```

**Mathematical Note:** The true probability requires hypergeometric distribution (drawing without replacement). This simplified approach assumes independence, which underestimates probability but is fast enough for real-time decisions.

### 3.2 Dead Hand Detection

```rust
/// Check if a pattern is still viable (all required tiles are available).
/// Returns false if any required tile is completely dead (all copies visible).
pub fn check_viability(target_histogram: &[u8], visible: &VisibleTiles) -> bool {
    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        if needed > 0 {
            let tile = Tile::new(i as u8);
            let available = visible.count_available(tile);

            if available < needed as usize {
                return false; // Not enough tiles left
            }
        }
    }
    true
}

/// Find all "dead" patterns for a hand (patterns that can never be completed).
pub fn filter_dead_patterns(
    evaluations: Vec<StrategicEvaluation>,
) -> Vec<StrategicEvaluation> {
    evaluations.into_iter().filter(|e| e.viable).collect()
}
```

**Use Case:** Early in the game, most patterns are viable. As discards accumulate, patterns become "dead" and should be excluded from strategic consideration.

---

## 4. Strategic Evaluation Functions

### 4.1 Deficiency vs Difficulty

**Deficiency** (from validator): Exact number of tiles needed, assuming infinite tile availability.

**Difficulty** (AI-specific): Weighted count accounting for tile scarcity.

```rust
/// Calculate difficulty-weighted deficiency for a pattern.
///
/// Formula: C(H) = Σ (count_i × weight_i)
/// where weight_i = 1 / (available_i + 1)
///
/// Higher difficulty = harder to complete (tiles are scarce)
pub fn calculate_difficulty(
    hand: &Hand,
    target_histogram: &[u8],
    visible: &VisibleTiles,
) -> f64 {
    let mut difficulty = 0.0;

    for (i, &needed) in target_histogram.iter().enumerate().take(35) {
        let have = hand.counts[i];

        if needed > have {
            let missing = (needed - have) as usize;
            let tile = Tile::new(i as u8);
            let available = visible.count_available(tile);

            // Weight = 1 / (available + 1)
            // If available = 0 (dead), weight = 1.0 (maximum difficulty)
            // If available = 3 (all remaining), weight = 0.25
            let weight = 1.0 / (available as f64 + 1.0);

            difficulty += (missing as f64) * weight;
        }
    }

    difficulty
}
```

**Example:**

- **Pattern needs:** 3× 1-Bam, 1× East
- **Hand has:** 1× 1-Bam, 0× East
- **Available:** 1-Bam (1 remaining), East (3 remaining)

**Deficiency:** 2 (need 2 more 1-Bam) + 1 (need 1 East) = 3

**Difficulty:**

- 1-Bam: 2 × (1 / (1 + 1)) = 2 × 0.5 = 1.0
- East: 1 × (1 / (3 + 1)) = 1 × 0.25 = 0.25
- **Total:** 1.25

**Interpretation:** Even though deficiency is 3, the difficulty is lower because East is plentiful.

### 4.2 Expected Value (EV)

```rust
/// Calculate Expected Value for a pattern.
/// EV(pattern) = V(pattern) × P(completion)
///
/// V(pattern) = score if won
/// P(completion) = probability of drawing required tiles
pub fn calculate_expected_value(evaluation: &StrategicEvaluation) -> f64 {
    if !evaluation.viable {
        return 0.0;
    }

    (evaluation.score as f64) * evaluation.probability
}

/// Calculate EV for a specific move (discard or Charleston pass).
///
/// Process:
/// 1. Apply move to hand (hypothetically)
/// 2. Re-evaluate top N patterns
/// 3. Return maximum EV across all patterns
pub fn evaluate_move(
    hand: &Hand,
    move_tile: Tile,
    validator: &HandValidator,
    visible: &VisibleTiles,
) -> f64 {
    // Create hypothetical hand after move
    let mut test_hand = hand.clone();
    test_hand.remove_tile(move_tile).ok()?;

    // Analyze top 10 patterns
    let analyses = validator.analyze(&test_hand, 10);

    // Convert to strategic evaluations
    let evaluations: Vec<StrategicEvaluation> = analyses
        .into_iter()
        .map(|a| {
            // Need histogram for difficulty calculation
            // This requires validator to expose histograms (future enhancement)
            StrategicEvaluation::from_analysis(a, &test_hand, visible, &[])
        })
        .collect();

    // Return maximum EV (focus on best pattern)
    evaluations
        .iter()
        .map(|e| e.expected_value)
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .unwrap_or(0.0)
}
```

### 4.3 Multi-Hand Flexibility

**Flexibility Score:** How many viable patterns overlap with a tile?

```rust
/// Calculate flexibility of a tile (how many patterns it appears in).
/// Higher flexibility = more strategic value (keep this tile).
pub fn calculate_tile_flexibility(
    tile: Tile,
    evaluations: &[StrategicEvaluation],
    validator: &HandValidator,
) -> usize {
    // Count how many top patterns require this tile
    evaluations
        .iter()
        .filter(|e| e.viable && e.deficiency <= 3)
        .filter(|e| {
            // Check if this pattern's histogram requires the tile
            // This requires validator to expose pattern histograms
            // Placeholder: true
            true
        })
        .count()
}

/// Utility scoring for Charleston tile selection.
/// U(tile) = Σ I(tile ∈ pattern_i) × w_i
/// where w_i = EV of pattern i
pub fn calculate_tile_utility(
    tile: Tile,
    evaluations: &[StrategicEvaluation],
) -> f64 {
    evaluations
        .iter()
        .filter(|e| e.viable)
        .map(|e| {
            // If tile is needed for this pattern, add its EV
            // Otherwise contribute 0
            // Requires checking if tile is in pattern histogram
            e.expected_value
        })
        .sum()
}
```

**Use Case:** During Charleston, prioritize keeping tiles that appear in multiple high-EV patterns.

---

## 5. Phase-Specific AI Logic

### 5.1 Charleston Strategy

```rust
/// Charleston decision logic.
pub struct CharlestonAI;

impl CharlestonAI {
    /// Select 3 tiles to pass during Charleston.
    ///
    /// Strategy:
    /// 1. Analyze top 10 patterns from validator
    /// 2. Calculate utility score for each tile
    /// 3. Pass tiles with lowest utility (least valuable)
    pub fn select_tiles_to_pass(
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
        stage: CharlestonStage,
    ) -> Vec<Tile> {
        // Analyze current hand
        let analyses = validator.analyze(hand, 10);
        let evaluations: Vec<StrategicEvaluation> = analyses
            .into_iter()
            .map(|a| StrategicEvaluation::from_analysis(a, hand, visible, &[]))
            .collect();

        // Score each unique tile in hand
        let mut tile_scores: Vec<(Tile, f64)> = Vec::new();
        let unique_tiles: HashSet<Tile> = hand.concealed.iter().copied().collect();

        for tile in unique_tiles {
            // Jokers are NEVER passed in Charleston (rule violation)
            if tile.is_joker() {
                continue;
            }

            let utility = calculate_tile_utility(tile, &evaluations);
            tile_scores.push((tile, utility));
        }

        // Sort by utility (ascending - pass lowest utility first)
        tile_scores.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        // Select 3 lowest utility tiles
        let mut tiles_to_pass = Vec::new();
        for (tile, _) in tile_scores.iter().take(3) {
            tiles_to_pass.push(*tile);
        }

        // Ensure we have exactly 3 tiles
        while tiles_to_pass.len() < 3 {
            // Fallback: pick any non-joker tile
            if let Some(tile) = hand.concealed.iter().find(|t| !t.is_joker()) {
                tiles_to_pass.push(*tile);
            }
        }

        tiles_to_pass
    }

    /// Decide whether to vote for continuing to Second Charleston.
    ///
    /// Strategy:
    /// - Vote CONTINUE if hand is still very flexible (many viable patterns)
    /// - Vote STOP if hand is converging on 1-2 strong patterns
    pub fn vote_to_continue(
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> CharlestonVote {
        let analyses = validator.analyze(hand, 10);
        let evaluations: Vec<StrategicEvaluation> = analyses
            .into_iter()
            .map(|a| StrategicEvaluation::from_analysis(a, hand, visible, &[]))
            .collect();

        // Count patterns with deficiency <= 4 (close to winning)
        let close_patterns = evaluations.iter().filter(|e| e.deficiency <= 4).count();

        // If we have 3+ close patterns, keep shuffling (continue)
        // If we have 1-2 strong patterns, stop and commit
        if close_patterns >= 3 {
            CharlestonVote::Continue
        } else {
            CharlestonVote::Stop
        }
    }
}
```

**Design Rationale:** Charleston is about exploration vs exploitation. Early passes should explore (diversify hand). Later passes should exploit (focus on best patterns).

### 5.2 Draw/Discard Strategy

This is the heart of the AI - MCTS-based search.

```rust
/// Main gameplay AI using Monte Carlo Tree Search.
pub struct DiscardAI {
    pub mcts_engine: MCTSEngine,
}

impl DiscardAI {
    /// Select which tile to discard using MCTS.
    ///
    /// Process:
    /// 1. For each possible discard, run MCTS simulations
    /// 2. Evaluate resulting game states
    /// 3. Pick discard that maximizes expected outcome
    pub fn select_discard(
        &self,
        hand: &Hand,
        drawn_tile: Tile,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        // Enumerate all possible discards (tiles in hand + drawn tile)
        let mut candidates: Vec<Tile> = hand.concealed.clone();
        candidates.push(drawn_tile);

        // Edge case: If we can win now, don't search
        let mut winning_hand = hand.clone();
        winning_hand.add_tile(drawn_tile);
        if validator.validate_win(&winning_hand).is_some() {
            // Discard anything - we're declaring Mahjong
            return drawn_tile;
        }

        // Run MCTS for each candidate
        let mut best_tile = drawn_tile;
        let mut best_score = f64::NEG_INFINITY;

        for tile in candidates.iter().cloned() {
            // Create hypothetical hand after discard
            let mut test_hand = winning_hand.clone();
            test_hand.remove_tile(tile).ok();

            // Run MCTS simulations
            let score = self.mcts_engine.evaluate_position(
                &test_hand,
                validator,
                visible,
            );

            if score > best_score {
                best_score = score;
                best_tile = tile;
            }
        }

        best_tile
    }
}
```

**Complexity:** With 14 tiles in hand, we evaluate ~14 positions. Each position runs 1,000-10,000 MCTS iterations. Target: <100ms total.

### 5.3 Calling Decisions

```rust
/// AI for deciding whether to call a discard.
pub struct CallAI;

impl CallAI {
    /// Decide whether to call a discarded tile.
    ///
    /// Strategy:
    /// - Early game (first 20 turns): Only call if overlaps 3+ viable patterns
    /// - Mid game (turns 20-60): Call if reaches deficiency ≤ 2
    /// - Late game (turns 60+): Call aggressively if reaches deficiency ≤ 3
    pub fn should_call(
        hand: &Hand,
        discard: Tile,
        validator: &HandValidator,
        visible: &VisibleTiles,
        turn_number: u32,
    ) -> bool {
        // Quick check: Can this tile form a valid meld with our hand?
        if hand.count_tile(discard) < 2 {
            return false; // Need at least 2 copies to form Pung
        }

        // Create hypothetical hand after calling
        let mut test_hand = hand.clone();
        test_hand.add_tile(discard);

        // Expose the meld
        let meld_tiles = vec![discard, discard, discard];
        let meld = Meld::new(MeldType::Pung, meld_tiles, Some(discard)).ok()?;
        test_hand.expose_meld(meld).ok()?;

        // Analyze patterns with exposed hand
        let analyses = validator.analyze(&test_hand, 5);
        let evaluations: Vec<StrategicEvaluation> = analyses
            .into_iter()
            .map(|a| StrategicEvaluation::from_analysis(a, &test_hand, visible, &[]))
            .collect();

        // Find best pattern
        let best = evaluations.first()?;

        // Decision thresholds by game phase
        let threshold = match turn_number {
            0..=20 => 1,   // Early: Only call if deficiency = 1 (almost winning)
            21..=60 => 2,  // Mid: Call if deficiency ≤ 2
            _ => 3,        // Late: Call if deficiency ≤ 3 (aggressive)
        };

        best.viable && best.deficiency <= threshold
    }

    /// Determine call priority when multiple players want the same discard.
    /// Returns priority score (higher = stronger claim).
    pub fn call_priority(
        hand: &Hand,
        discard: Tile,
        validator: &HandValidator,
    ) -> i32 {
        // Priority: Mahjong > deficiency = 1 > deficiency = 2
        let mut test_hand = hand.clone();
        test_hand.add_tile(discard);

        if validator.validate_win(&test_hand).is_some() {
            return 100; // Mahjong call (highest priority)
        }

        let analyses = validator.analyze(&test_hand, 1);
        if let Some(best) = analyses.first() {
            return (10 - best.deficiency) as i32; // Lower deficiency = higher priority
        }

        0
    }
}
```

**Defensive Play (Future):** Track what opponents are collecting. Avoid discarding tiles that help opponents complete high-scoring patterns.

---

## 6. Monte Carlo Tree Search (MCTS)

### 6.1 Algorithm Overview

MCTS explores the game tree by simulating random playouts and backpropagating results.

**Four Phases:**

1. **Selection:** Traverse tree using UCB1 policy
2. **Expansion:** Add new child node
3. **Simulation:** Random playout to terminal state
4. **Backpropagation:** Update node statistics

```text
                   Root (current hand)
                   /     |     \
            Discard A  Discard B  Discard C
            /  |  \      /  \       /  \
          ...  ... ...  ... ...   ... ...
```

### 6.2 Node Structure

```rust
/// A node in the MCTS tree.
#[derive(Debug, Clone)]
pub struct MCTSNode {
    /// Game state at this node
    pub hand: Hand,

    /// The move that led to this state (tile discarded)
    pub move_tile: Option<Tile>,

    /// Statistics
    pub visits: u32,
    pub total_value: f64,

    /// Children (possible next moves)
    pub children: Vec<MCTSNode>,

    /// Is this a terminal node? (win or wall exhausted)
    pub terminal: bool,
}

impl MCTSNode {
    /// Calculate UCB1 score for selection.
    /// UCB1(node) = (value / visits) + C × sqrt(ln(parent_visits) / visits)
    ///
    /// - First term: Exploitation (pick best-performing child)
    /// - Second term: Exploration (try less-visited children)
    /// - C: Exploration constant (typically sqrt(2) ≈ 1.414)
    pub fn ucb1_score(&self, parent_visits: u32, exploration_constant: f64) -> f64 {
        if self.visits == 0 {
            return f64::INFINITY; // Unvisited nodes have infinite priority
        }

        let exploitation = self.total_value / (self.visits as f64);
        let exploration = exploration_constant
            * ((parent_visits as f64).ln() / (self.visits as f64)).sqrt();

        exploitation + exploration
    }

    /// Select best child using UCB1.
    pub fn select_child(&self, exploration_constant: f64) -> Option<&MCTSNode> {
        self.children
            .iter()
            .max_by(|a, b| {
                let score_a = a.ucb1_score(self.visits, exploration_constant);
                let score_b = b.ucb1_score(self.visits, exploration_constant);
                score_a.partial_cmp(&score_b).unwrap()
            })
    }

    /// Backpropagate simulation result up the tree.
    pub fn backpropagate(&mut self, value: f64) {
        self.visits += 1;
        self.total_value += value;
    }
}
```

### 6.3 MCTS Engine

```rust
/// Monte Carlo Tree Search engine for move selection.
pub struct MCTSEngine {
    /// Number of simulations per move evaluation
    pub iterations: usize,

    /// Time budget in milliseconds (alternative to iteration count)
    pub time_budget_ms: u64,

    /// Exploration constant for UCB1 (default: sqrt(2))
    pub exploration_constant: f64,

    /// Random number generator for determinization
    pub rng: StdRng,
}

impl MCTSEngine {
    pub fn new(iterations: usize) -> Self {
        Self {
            iterations,
            time_budget_ms: 100,
            exploration_constant: 1.414,
            rng: StdRng::from_entropy(),
        }
    }

    /// Evaluate a position using MCTS.
    /// Returns average score from simulations.
    pub fn evaluate_position(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        let root = MCTSNode {
            hand: hand.clone(),
            move_tile: None,
            visits: 0,
            total_value: 0.0,
            children: Vec::new(),
            terminal: false,
        };

        let start_time = std::time::Instant::now();

        for _ in 0..self.iterations {
            // Time budget check
            if start_time.elapsed().as_millis() > self.time_budget_ms as u128 {
                break;
            }

            // MCTS iteration
            let mut node = root.clone();

            // 1. Selection
            while !node.children.is_empty() {
                node = node.select_child(self.exploration_constant)?.clone();
            }

            // 2. Expansion
            if node.visits > 0 && !node.terminal {
                self.expand_node(&mut node);
            }

            // 3. Simulation
            let value = self.simulate_playout(&node.hand, validator, visible);

            // 4. Backpropagation
            node.backpropagate(value);
        }

        // Return average value
        if root.visits > 0 {
            root.total_value / (root.visits as f64)
        } else {
            0.0
        }
    }

    /// Expand a node by adding all possible child moves.
    fn expand_node(&self, node: &mut MCTSNode) {
        for tile in node.hand.concealed.iter().cloned() {
            let mut child_hand = node.hand.clone();
            child_hand.remove_tile(tile).ok();

            node.children.push(MCTSNode {
                hand: child_hand,
                move_tile: Some(tile),
                visits: 0,
                total_value: 0.0,
                children: Vec::new(),
                terminal: false,
            });
        }
    }

    /// Simulate a random playout from current state to terminal state.
    /// Returns evaluation score (higher = better).
    fn simulate_playout(
        &mut self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> f64 {
        // Determinize: Assign unknown tiles randomly
        let wall = self.determinize_wall(hand, visible);

        // Simulate random draw/discard until win or wall exhausted
        let mut sim_hand = hand.clone();
        let mut sim_wall = wall;
        let mut turns = 0;
        const MAX_TURNS: usize = 50;

        while turns < MAX_TURNS {
            // Draw tile
            if let Some(tile) = sim_wall.pop() {
                sim_hand.add_tile(tile);
            } else {
                break; // Wall exhausted
            }

            // Check for win
            if validator.validate_win(&sim_hand).is_some() {
                return 100.0; // Win!
            }

            // Discard random tile
            if let Some(&discard) = sim_hand.concealed.choose(&mut self.rng) {
                sim_hand.remove_tile(discard).ok();
            }

            turns += 1;
        }

        // Didn't win - evaluate final hand
        let analyses = validator.analyze(&sim_hand, 1);
        if let Some(best) = analyses.first() {
            // Score based on deficiency (closer to win = higher score)
            return (10 - best.deficiency) as f64;
        }

        0.0
    }

    /// Determinize the wall (assign unknown tiles randomly).
    /// This is necessary for MCTS in hidden information games.
    fn determinize_wall(
        &mut self,
        hand: &Hand,
        visible: &VisibleTiles,
    ) -> Vec<Tile> {
        let mut wall = Vec::new();

        // For each tile type, add remaining copies to wall
        for tile_id in 0..35 {
            let tile = Tile::new(tile_id);
            let total = if tile.is_flower() || tile.is_joker() { 8 } else { 4 };
            let visible_count = visible.count_visible(tile);
            let in_hand = hand.count_tile(tile);
            let remaining = total.saturating_sub(visible_count + in_hand);

            for _ in 0..remaining {
                wall.push(tile);
            }
        }

        // Shuffle wall
        wall.shuffle(&mut self.rng);

        wall
    }
}
```

**Performance Note:** Each simulation:

- 1× `determinize_wall()` (~10 µs)
- ~20 iterations × (`validate_win()` + discard) = ~20 × 300 µs = 6ms
- **Total:** ~6ms per playout

With 1,000 iterations: ~6 seconds (too slow!)

**Optimization:** Shallow playouts (max 10 turns) + better evaluation function (EV instead of random playouts).

### 6.4 Determinization Strategy

**Problem:** In American Mahjong, we don't know what tiles other players have or what's in the wall.

**Solution:** Determinization - randomly assign unknown tiles, then search as if we had perfect information.

```rust
/// Sample multiple determinizations and average results.
///
/// Process:
/// 1. Generate N random determinizations (assignments of hidden tiles)
/// 2. Run MCTS on each determinization
/// 3. Average the results
pub fn multi_determinization_search(
    &mut self,
    hand: &Hand,
    validator: &HandValidator,
    visible: &VisibleTiles,
    num_determinizations: usize,
) -> f64 {
    let mut total_score = 0.0;

    for _ in 0..num_determinizations {
        let score = self.evaluate_position(hand, validator, visible);
        total_score += score;
    }

    total_score / (num_determinizations as f64)
}
```

**Tradeoff:** More determinizations = more accurate, but slower. Recommended: 3-5 determinizations.

### 6.5 Parallelization

```rust
use rayon::prelude::*;

/// Parallel MCTS using Rayon.
/// Runs multiple MCTS iterations concurrently.
pub fn parallel_evaluate(
    hand: &Hand,
    validator: &HandValidator,
    visible: &VisibleTiles,
    iterations: usize,
) -> f64 {
    // Split iterations across threads
    let results: Vec<f64> = (0..iterations)
        .into_par_iter()
        .map(|_| {
            let mut engine = MCTSEngine::new(1);
            engine.evaluate_position(hand, validator, visible)
        })
        .collect();

    // Average results
    results.iter().sum::<f64>() / (results.len() as f64)
}
```

**Speedup:** On 8-core CPU, ~6x faster (not 8x due to overhead).

---

## 7. Difficulty Levels

AI strength is controlled by search depth and heuristic quality. The difficulty levels integrate both the BasicBot (from [08-bot-ai.md](08-bot-ai.md)) and the strategic AI implementations.

```rust
/// AI difficulty levels.
#[derive(Debug, Clone, Copy)]
pub enum Difficulty {
    /// Uses BasicBot from 08-bot-ai.md (simple heuristics, <10ms)
    Basic,

    /// Greedy EV maximization (no lookahead, ~20ms)
    Medium,

    /// MCTS with 1,000 iterations (~50ms)
    Hard,

    /// MCTS with 10,000 iterations (~100ms)
    Expert,
}

impl Difficulty {
    /// Get MCTS iteration count for this difficulty.
    pub fn mcts_iterations(&self) -> usize {
        match self {
            Difficulty::Basic => 0,        // No MCTS, uses BasicBot heuristics
            Difficulty::Medium => 0,       // No MCTS, greedy EV only
            Difficulty::Hard => 1_000,     // Standard search
            Difficulty::Expert => 10_000,  // Deep search
        }
    }

    /// Should this difficulty use MCTS?
    pub fn uses_mcts(&self) -> bool {
        matches!(self, Difficulty::Hard | Difficulty::Expert)
    }

    /// Which AI implementation to use?
    pub fn ai_type(&self) -> AIType {
        match self {
            Difficulty::Basic => AIType::BasicBot,
            Difficulty::Medium => AIType::GreedyEV,
            Difficulty::Hard | Difficulty::Expert => AIType::MCTS,
        }
    }
}

/// AI implementation types.
#[derive(Debug, Clone, Copy)]
pub enum AIType {
    /// BasicBot from 08-bot-ai.md (simple rule-based)
    BasicBot,

    /// Greedy Expected Value (single-step lookahead)
    GreedyEV,

    /// Monte Carlo Tree Search (full strategic planning)
    MCTS,
}
```

### 7.1 Basic Difficulty (BasicBot)

**Implementation:** Uses `BasicBot` from [08-bot-ai.md](08-bot-ai.md)

**Characteristics:**

- Simple tile scoring heuristics
- No lookahead or search
- Decisions in <10ms
- Memory: <10KB

**Strategy:**

- **Charleston:** Pass isolated tiles, Dragons/Winds, extremes (1s/9s)
- **Discard:** Keep Jokers/Flowers/Pairs, discard isolated tiles
- **Calling:** Only call if >50% complete and meld fits 3+ patterns
- **Mistakes:** Doesn't consider opponent tiles, no defensive play

**Use Case:** Casual practice, integration testing

**Code Reference:** See [08-bot-ai.md](08-bot-ai.md) for full implementation

---

### 7.2 Medium Difficulty (Greedy AI)

**Implementation:** Greedy Expected Value maximization

```rust
/// Medium AI: Greedy EV maximization (no lookahead).
pub struct GreedyAI {
    evaluator: EVEvaluator,
}

impl MahjongAI for GreedyAI {
    fn select_discard(
        &self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        let mut best_tile = hand.concealed[0];
        let mut best_ev = f64::NEG_INFINITY;

        // Try discarding each tile, pick the one that leaves highest EV
        for &tile in &hand.concealed {
            if tile.is_joker() {
                continue; // Never discard jokers
            }

            let mut test_hand = hand.clone();
            test_hand.remove_tile(tile);

            let ev = self.evaluator.calculate_ev(&test_hand, validator, visible);

            if ev > best_ev {
                best_ev = ev;
                best_tile = tile;
            }
        }

        best_tile
    }
}
```

**Characteristics:**

- Evaluates immediate EV after each possible discard
- No opponent modeling or multi-step lookahead
- Decisions in ~20ms
- Memory: ~100KB

**Strategy:**

- **Charleston:** Keep tiles that maximize EV for top 3 patterns
- **Discard:** Choose tile whose removal leaves highest EV
- **Calling:** Call if EV(with meld) > EV(without meld) + risk penalty
- **Strengths:** Better than BasicBot at recognizing good patterns
- **Weaknesses:** Doesn't plan ahead, can't see traps

**Use Case:** Intermediate challenge, shows strategic thinking without being too hard

---

### 7.3 Hard Difficulty (MCTS 1K)

**Implementation:** Monte Carlo Tree Search with 1,000 iterations

```rust
/// Hard AI: MCTS with 1,000 iterations.
pub struct HardAI {
    mcts_engine: MCTSEngine,
}

impl MahjongAI for HardAI {
    fn select_discard(
        &self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        self.mcts_engine.search(hand, validator, visible, 1_000)
    }
}
```

**Characteristics:**

- Full MCTS with 1,000 simulations
- Decisions in ~50ms
- Memory: ~20MB (tree structure)

**Strategy:**

- **Charleston:** MCTS simulations to find optimal pass selection
- **Discard:** Multi-step lookahead (4-6 turns ahead)
- **Calling:** Considers opponent responses and game state evolution
- **Strengths:** Strategic planning, sees traps, plays defensively
- **Weaknesses:** Sometimes makes suboptimal moves due to limited search depth

**Use Case:** Challenging opponent for experienced players

---

### 7.4 Expert Difficulty (MCTS 10K)

**Implementation:** Monte Carlo Tree Search with 10,000 iterations

```rust
/// Expert AI: Full MCTS with 10,000 iterations.
pub struct ExpertAI {
    mcts_engine: MCTSEngine,
}

impl MahjongAI for ExpertAI {
    fn select_discard(
        &self,
        hand: &Hand,
        validator: &HandValidator,
        visible: &VisibleTiles,
    ) -> Tile {
        self.mcts_engine.search(hand, validator, visible, 10_000)
    }
}
```

**Characteristics:**

- Full MCTS with 10,000 simulations (10x deeper than Hard)
- Decisions in ~100ms
- Memory: ~50MB (larger tree)

**Strategy:**

- **Charleston:** Near-optimal tile selection via deep search
- **Discard:** Sees 8-12 turns ahead, models all opponents
- **Calling:** Perfect risk/reward analysis
- **Strengths:** Plays at or above expert human level
- **Weaknesses:** None (within computational limits)

**Use Case:** Maximum challenge, teaching tool for optimal play

---

### 7.5 Difficulty Comparison Table

| Metric | Basic | Medium | Hard | Expert |
| ------ | ----- | ------ | ---- | ------ |
| **Implementation** | BasicBot (08) | Greedy EV | MCTS 1K | MCTS 10K |
| **Decision Time** | <10ms | ~20ms | ~50ms | ~100ms |
| **Memory** | <10KB | ~100KB | ~20MB | ~50MB |
| **Lookahead Depth** | 0 turns | 1 turn | 4-6 turns | 8-12 turns |
| **Opponent Modeling** | None | None | Basic | Advanced |
| **Win Rate vs Human** | ~20% (beginner) | ~40% (casual) | ~60% (intermediate) | ~80% (expert) |
| **Makes Mistakes** | Often | Sometimes | Rarely | Almost never |

### 7.6 Factory Function

```rust
/// Create an AI player at the specified difficulty level.
pub fn create_ai(difficulty: Difficulty, seed: u64) -> Box<dyn MahjongAI> {
    match difficulty.ai_type() {
        AIType::BasicBot => {
            // From 08-bot-ai.md
            Box::new(BasicBot::new(seed))
        }
        AIType::GreedyEV => {
            Box::new(GreedyAI::new())
        }
        AIType::MCTS => {
            let iterations = difficulty.mcts_iterations();
            Box::new(MCTSAIPlayer::new(iterations, seed))
        }
    }
}
```

**Design Principle:** Each difficulty level should have a distinct "feel". Basic makes obvious mistakes. Medium plays reasonably. Hard is challenging. Expert is formidable.

---

## 8. Performance Requirements

### 8.1 Benchmarks

Target metrics (measured with Criterion):

```rust
#[bench]
fn bench_charleston_decision(b: &mut Bencher) {
    let hand = create_test_hand();
    let validator = create_validator();
    let visible = VisibleTiles::new();

    b.iter(|| {
        CharlestonAI::select_tiles_to_pass(&hand, &validator, &visible, CharlestonStage::FirstRight)
    });

    // Target: <50ms
}

#[bench]
fn bench_discard_mcts_1000(b: &mut Bencher) {
    let hand = create_test_hand();
    let validator = create_validator();
    let visible = VisibleTiles::new();
    let mut engine = MCTSEngine::new(1000);

    b.iter(|| {
        engine.evaluate_position(&hand, &validator, &visible)
    });

    // Target: <100ms
}

#[bench]
fn bench_call_decision(b: &mut Bencher) {
    let hand = create_test_hand();
    let validator = create_validator();
    let visible = VisibleTiles::new();

    b.iter(|| {
        CallAI::should_call(&hand, Tile::new(0), &validator, &visible, 30)
    });

    // Target: <10ms
}
```

### 8.2 Memory Budget

```rust
/// Measure MCTS tree memory usage.
fn mcts_memory_usage(iterations: usize) -> usize {
    let node_size = std::mem::size_of::<MCTSNode>();
    let max_children = 14; // Max tiles in hand
    let max_depth = 10;

    // Approximate: iterations × node_size
    iterations * node_size * max_children
}

// Example:
// 1,000 iterations × 256 bytes/node × 14 children = ~3.5 MB (acceptable)
// 10,000 iterations × 256 bytes/node × 14 children = ~35 MB (acceptable)
```

**Limit:** <50MB per AI player to support 4 concurrent AIs.

### 8.3 Optimization Strategies

**If performance targets are not met:**

1. **Reduce MCTS depth:** Limit simulations to 5 turns instead of 50
2. **Prune unpromising moves:** Only explore top 5 discards by greedy EV
3. **Cache evaluations:** Store `hand_histogram → EV` mapping
4. **Parallel MCTS:** Use Rayon to distribute simulations
5. **Replace simulations:** Use learned evaluation function (neural net) instead of playouts

---

## 9. API Design

### 9.1 MahjongAI Trait

```rust
/// Trait for AI decision-making strategies.
pub trait MahjongAI: Send + Sync {
    /// Select tiles to pass during Charleston.
    fn select_charleston_tiles(
        &self,
        hand: &Hand,
        phase: CharlestonStage,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Vec<Tile>;

    /// Vote to continue or stop Charleston.
    fn vote_charleston(
        &self,
        hand: &Hand,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> CharlestonVote;

    /// Select which tile to discard.
    fn select_discard(
        &self,
        hand: &Hand,
        drawn_tile: Tile,
        visible: &VisibleTiles,
        validator: &HandValidator,
    ) -> Tile;

    /// Decide whether to call a discard.
    fn should_call(
        &self,
        hand: &Hand,
        discard: Tile,
        call_type: MeldType,
        visible: &VisibleTiles,
        validator: &HandValidator,
        turn_number: u32,
    ) -> bool;
}
```

### 9.2 Factory Function

```rust
/// Create an AI player of specified difficulty.
pub fn create_ai(difficulty: Difficulty) -> Box<dyn MahjongAI> {
    match difficulty {
        Difficulty::Easy => Box::new(RandomAI),
        Difficulty::Medium => Box::new(GreedyAI),
        Difficulty::Hard => Box::new(ExpertAI {
            mcts_engine: MCTSEngine::new(1000),
        }),
        Difficulty::Expert => Box::new(ExpertAI {
            mcts_engine: MCTSEngine::new(10000),
        }),
    }
}
```

### 9.3 Integration with Game Loop

```rust
// In mahjong_server/src/table.rs

use mahjong_ai::{MahjongAI, VisibleTiles, create_ai, Difficulty};

pub struct AIPlayer {
    seat: Seat,
    ai: Box<dyn MahjongAI>,
    visible: VisibleTiles,
}

impl AIPlayer {
    pub fn new(seat: Seat, difficulty: Difficulty) -> Self {
        Self {
            seat,
            ai: create_ai(difficulty),
            visible: VisibleTiles::new(),
        }
    }

    /// Handle AI turn.
    pub fn take_turn(
        &mut self,
        hand: &Hand,
        drawn_tile: Tile,
        validator: &HandValidator,
    ) -> GameCommand {
        let discard = self.ai.select_discard(hand, drawn_tile, &self.visible, validator);
        GameCommand::Discard { seat: self.seat, tile: discard }
    }

    /// Update AI's knowledge when a tile is discarded.
    pub fn observe_discard(&mut self, tile: Tile) {
        self.visible.add_discard(tile);
    }

    /// Update AI's knowledge when a meld is exposed.
    pub fn observe_meld(&mut self, seat: Seat, meld: Meld) {
        self.visible.add_meld(seat, meld);
    }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_probability() {
        let visible = VisibleTiles::new();
        let hand = Hand::empty();

        // All tiles available at start
        let prob = calculate_tile_probability(Tile::new(0), &visible, &hand);
        assert!(prob > 0.0);
    }

    #[test]
    fn test_dead_tile_detection() {
        let mut visible = VisibleTiles::new();
        let tile = Tile::new(0); // 1 Bam

        // Discard all 4 copies
        for _ in 0..4 {
            visible.add_discard(tile);
        }

        assert!(visible.is_dead(tile));
        assert_eq!(visible.count_available(tile), 0);
    }

    #[test]
    fn test_charleston_no_jokers() {
        let mut hand = Hand::new(vec![
            Tile::new(0), Tile::new(1), Tile::new(2), // Bams
            Tile::new(35), // Joker
        ]);

        let validator = create_test_validator();
        let visible = VisibleTiles::new();

        let tiles = CharlestonAI::select_tiles_to_pass(
            &hand,
            &validator,
            &visible,
            CharlestonStage::FirstRight,
        );

        // Must not include jokers
        assert!(!tiles.iter().any(|t| t.is_joker()));
        assert_eq!(tiles.len(), 3);
    }

    #[test]
    fn test_mcts_basic_search() {
        let hand = create_test_hand();
        let validator = create_test_validator();
        let visible = VisibleTiles::new();

        let mut engine = MCTSEngine::new(100);
        let score = engine.evaluate_position(&hand, &validator, &visible);

        assert!(score >= 0.0);
        assert!(score <= 100.0);
    }
}
```

### 10.2 Integration Tests

```rust
#[test]
fn test_ai_vs_ai_game() {
    let mut table = Table::new_with_ai([
        Difficulty::Easy,
        Difficulty::Medium,
        Difficulty::Hard,
        Difficulty::Expert,
    ]);

    // Run a full game
    let result = table.play_game();

    // Should complete without errors
    assert!(result.is_ok());

    // Should have a winner
    assert!(result.unwrap().winner.is_some());
}
```

### 10.3 AI vs AI Tournaments

```rust
/// Run a tournament to balance AI difficulties.
fn run_tournament(num_games: usize) -> TournamentResults {
    let mut results = TournamentResults::new();

    for _ in 0..num_games {
        let mut table = Table::new_with_ai([
            Difficulty::Easy,
            Difficulty::Medium,
            Difficulty::Hard,
            Difficulty::Expert,
        ]);

        let result = table.play_game().unwrap();
        results.record_win(result.winner);
    }

    results
}

#[test]
fn test_difficulty_balance() {
    let results = run_tournament(100);

    // Expert should win >60% against Easy
    let expert_win_rate = results.win_rate(Difficulty::Expert);
    assert!(expert_win_rate > 0.6);

    // Easy should win <20%
    let easy_win_rate = results.win_rate(Difficulty::Easy);
    assert!(easy_win_rate < 0.2);
}
```

### 10.4 Regression Tests

```rust
/// Known good hands that should be recognized.
const KNOWN_GOOD_HANDS: &[(&str, &[Tile])] = &[
    ("13579 pattern", &[/* tiles */]),
    ("Year hand 2025", &[/* tiles */]),
    // ...
];

#[test]
fn test_ai_recognizes_winning_hands() {
    let validator = create_validator();
    let ai = create_ai(Difficulty::Hard);

    for (name, tiles) in KNOWN_GOOD_HANDS {
        let hand = Hand::new(tiles.to_vec());
        let visible = VisibleTiles::new();

        // AI should NOT discard a winning hand
        let discard = ai.select_discard(&hand, Tile::new(0), &visible, &validator);

        let mut test_hand = hand.clone();
        test_hand.add_tile(Tile::new(0));

        // After discard, should still have winning hand
        test_hand.remove_tile(discard).ok();
        assert!(validator.validate_win(&test_hand).is_some(), "Failed on: {}", name);
    }
}
```

### 10.5 Performance Benchmarks

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_charleston(c: &mut Criterion) {
    let hand = create_test_hand();
    let validator = create_validator();
    let visible = VisibleTiles::new();

    c.bench_function("charleston_decision", |b| {
        b.iter(|| {
            CharlestonAI::select_tiles_to_pass(
                black_box(&hand),
                black_box(&validator),
                black_box(&visible),
                CharlestonStage::FirstRight,
            )
        })
    });
}

fn benchmark_mcts(c: &mut Criterion) {
    let hand = create_test_hand();
    let validator = create_validator();
    let visible = VisibleTiles::new();

    c.bench_function("mcts_1000_iterations", |b| {
        b.iter(|| {
            let mut engine = MCTSEngine::new(1000);
            engine.evaluate_position(
                black_box(&hand),
                black_box(&validator),
                black_box(&visible),
            )
        })
    });
}

criterion_group!(benches, benchmark_charleston, benchmark_mcts);
criterion_main!(benches);
```

---

## 11. Future Optimizations

### 11.1 Neural Network Evaluation

Replace MCTS simulations with learned position evaluation:

```rust
/// Neural network-based evaluation function.
pub struct NeuralEvaluator {
    model: TorchModel, // PyTorch or TensorFlow
}

impl NeuralEvaluator {
    /// Evaluate a hand position (returns score 0.0-1.0).
    pub fn evaluate(&self, hand: &Hand, visible: &VisibleTiles) -> f64 {
        // Convert hand to feature vector
        let features = hand_to_features(hand, visible);

        // Run inference
        self.model.forward(features)
    }
}

/// Train the network using self-play data.
pub fn train_network(games: Vec<Game>) -> NeuralEvaluator {
    // Collect (hand, outcome) pairs
    // Train supervised learning: hand features → win probability
    // Use gradient descent to optimize

    todo!("Implement neural network training")
}
```

**Benefits:**

- Faster than MCTS (~1ms vs ~100ms)
- Learns patterns humans use
- Can be fine-tuned for specific play styles

**Challenges:**

- Requires large training dataset (10,000+ games)
- Offline training pipeline
- Model deployment and versioning

### 11.2 Opening Book

Pre-compute optimal Charleston strategies for common starting hands:

```rust
/// Opening book for Charleston decisions.
pub struct OpeningBook {
    /// Map: hand_signature → tiles_to_pass
    book: HashMap<u64, Vec<Tile>>,
}

impl OpeningBook {
    /// Generate opening book by exhaustive analysis.
    pub fn generate(validator: &HandValidator) -> Self {
        let mut book = HashMap::new();

        // For each starting hand configuration
        for hand in generate_all_starting_hands() {
            let signature = hand_signature(&hand);
            let best_pass = find_best_charleston_pass(&hand, validator);
            book.insert(signature, best_pass);
        }

        Self { book }
    }

    /// Look up pre-computed Charleston decision.
    pub fn lookup(&self, hand: &Hand) -> Option<Vec<Tile>> {
        let signature = hand_signature(hand);
        self.book.get(&signature).cloned()
    }
}

/// Generate a unique signature for a hand (tile counts).
fn hand_signature(hand: &Hand) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    hand.counts.hash(&mut hasher);
    hasher.finish()
}
```

**Benefits:**

- Instant Charleston decisions (<1ms)
- Guaranteed optimal (if exhaustively computed)
- Reduces complexity for players

**Challenges:**

- Combinatorial explosion (13 tiles from 152 = astronomical)
- Need to cluster similar hands
- Storage (book could be gigabytes)

### 11.3 Endgame Tablebase

When few tiles remain, compute perfect play:

```rust
/// Endgame tablebase (perfect play with <10 tiles remaining).
pub struct EndgameTablebase {
    /// Map: (hand, remaining_tiles) → best_move
    table: HashMap<GameState, Tile>,
}

impl EndgameTablebase {
    /// Generate tablebase by backward induction.
    pub fn generate(validator: &HandValidator) -> Self {
        // Start from terminal states (0 tiles left)
        // Work backwards, computing best move at each state

        todo!("Implement tablebase generation")
    }

    /// Look up perfect move.
    pub fn lookup(&self, hand: &Hand, remaining: usize) -> Option<Tile> {
        if remaining > 10 {
            return None; // Outside tablebase range
        }

        let state = GameState { hand: hand.clone(), remaining };
        self.table.get(&state).copied()
    }
}
```

**Benefits:**

- Perfect endgame play
- No search needed (instant lookup)
- Beats human experts in endgame

**Challenges:**

- Exponential state space
- Difficult to handle multiple opponents
- Storage requirements

### 11.4 Opponent Modeling

Learn opponent tendencies and adapt strategy:

```rust
/// Opponent model (tracks what tiles opponents collect).
pub struct OpponentModel {
    /// Patterns each opponent is likely pursuing.
    likely_patterns: HashMap<Seat, Vec<String>>,

    /// Tiles each opponent has called/exposed.
    observed_tiles: HashMap<Seat, Vec<Tile>>,
}

impl OpponentModel {
    /// Update model when opponent calls a tile.
    pub fn observe_call(&mut self, seat: Seat, tile: Tile) {
        self.observed_tiles.entry(seat).or_default().push(tile);

        // Infer likely patterns from called tiles
        self.infer_patterns(seat);
    }

    /// Infer which patterns opponent is pursuing.
    fn infer_patterns(&mut self, seat: Seat) {
        // Use Bayesian inference to update pattern probabilities
        // P(pattern | observed_tiles) ∝ P(observed_tiles | pattern) × P(pattern)

        todo!("Implement pattern inference")
    }

    /// Should we avoid discarding this tile? (defensive play)
    pub fn is_dangerous_discard(&self, tile: Tile, seat: Seat) -> bool {
        // Check if tile helps opponent's likely patterns

        todo!("Implement danger detection")
    }
}
```

**Benefits:**

- Defensive play (avoid feeding opponents)
- Exploit predictable opponents
- More realistic AI behavior

**Challenges:**

- Requires statistical learning
- Must handle noisy observations
- Opponent may change strategy mid-game

---

## 12. Implementation Checklist

### Phase 1: Foundation (Weeks 1-2)

- [ ] Create `mahjong_ai` crate structure
- [ ] Implement `VisibleTiles` tracker
- [ ] Implement `StrategicEvaluation` and `GamePhaseContext`
- [ ] Implement tile probability calculations
- [ ] Write unit tests for probability functions
- [ ] Benchmark probability calculations (<1ms target)

### Phase 2: Basic AI (Weeks 3-4)

- [ ] Implement `RandomAI` (easy difficulty)
- [ ] Implement `GreedyAI` (medium difficulty)
- [ ] Implement Charleston decision logic
- [ ] Implement calling decision logic
- [ ] Write integration tests (AI vs AI games)
- [ ] Verify AI makes legal moves

### Phase 3: MCTS Engine (Weeks 5-6)

- [ ] Implement `MCTSNode` structure
- [ ] Implement UCB1 selection policy
- [ ] Implement determinization (random wall generation)
- [ ] Implement simulation/playout
- [ ] Implement backpropagation
- [ ] Write MCTS unit tests
- [ ] Benchmark MCTS (1,000 iterations <100ms)

### Phase 4: Expert AI (Weeks 7-8)

- [ ] Implement `ExpertAI` using MCTS
- [ ] Optimize MCTS for performance (parallel simulations)
- [ ] Implement multi-determinization search
- [ ] Tune exploration constant and iteration count
- [ ] Run AI vs AI tournaments for balance
- [ ] Adjust difficulty levels based on win rates

### Phase 5: Polish & Testing (Weeks 9-10)

- [ ] Add reasoning/logging to AI decisions
- [ ] Implement defensive play heuristics
- [ ] Add configurable AI personalities
- [ ] Write comprehensive regression tests
- [ ] Profile and optimize performance bottlenecks
- [ ] Document AI behavior and strategy

### Phase 6: Future Enhancements (Post-MVP)

- [ ] Opening book generation
- [ ] Neural network evaluation
- [ ] Endgame tablebase
- [ ] Opponent modeling
- [ ] Reinforcement learning training pipeline

---

## 13. Conclusion

The AI strategy engine is the intelligence layer that sits atop the validation engine. By separating deterministic validation from probabilistic strategy, we achieve:

1. **Fast validation** (~53 µs) enables thousands of MCTS simulations
2. **Clean architecture** allows swapping AI algorithms without changing core logic
3. **Difficulty tuning** via search depth (easy = random, expert = deep MCTS)
4. **Extensibility** for future ML-based approaches

**Key Insight:** The validation engine answers "Can I win with this hand?" (fast, deterministic). The AI engine answers "What move gets me closest to winning?" (slower, probabilistic). They work together but solve different problems.

**Performance Summary:**

| Operation          | Current     | Target    | Status |
| ------------------ | ----------- | --------- | ------ |
| Validation         | ~53 µs      | <1ms      | ✅     |
| Charleston AI      | TBD         | <50ms     | 🚧     |
| Discard AI (MCTS)  | TBD         | <100ms    | 🚧     |
| Call AI            | TBD         | <10ms     | 🚧     |

With careful optimization (shallow playouts, pruning, parallelization), we can meet all performance targets and deliver an AI that feels instant to human players.

---

## Appendix A: Mathematical Foundations

### A.1 Expected Value Calculation

```text
EV(move) = Σ P(outcome_i | move) × V(outcome_i)

where:
- P(outcome_i | move) = probability of reaching outcome i after making move
- V(outcome_i) = value of outcome i (win = 100, score if won = pattern score)
```

For American Mahjong:

```text
EV(discard tile_x) = Σ P(pattern_i | discard tile_x) × score(pattern_i)
```

### A.2 UCB1 Formula

```text
UCB1(node) = X̄_i + C × sqrt(ln(N) / n_i)

where:
- X̄_i = average reward of node i
- N = parent visits
- n_i = node visits
- C = exploration constant (typically sqrt(2))
```

**Intuition:**

- If node is under-explored (low n_i), exploration term is large → try it
- If node has high average reward (high X̄_i), exploitation term is large → exploit it
- Balance is controlled by C

### A.3 Hypergeometric Distribution

True probability of drawing k specific tiles from n draws without replacement:

```text
P(X = k) = C(K, k) × C(N - K, n - k) / C(N, n)

where:
- N = total tiles in wall
- K = copies of desired tile
- n = number of draws
- k = number of desired tiles drawn
- C(a, b) = binomial coefficient (a choose b)
```

**Simplification used in AI:** Assume independent draws (binomial approximation).

```text
P(drawing tile) ≈ (K / N)^k
```

This underestimates true probability but is fast to compute.

---

## Appendix B: References

### Academic Papers

1. **MCTS in Imperfect Information Games**
   - "Monte Carlo Tree Search for Multi-Player, Non-Deterministic and Combinatorial Games" (Cowling et al., 2015)
   - Determinization techniques for hidden information

2. **Mahjong AI**
   - "Deep Reinforcement Learning for Multiplayer Mahjong" (Li et al., 2020)
   - Neural network approaches to tile games

3. **UCB Algorithm**
   - "Finite-time Analysis of the Multiarmed Bandit Problem" (Auer et al., 2002)
   - Theoretical foundation for UCB1

### Existing Implementations

- **Tenhou AI** (Japanese Mahjong): Uses deep learning + MCTS hybrid
- **AlphaGo Zero** (Go): Inspiration for self-play reinforcement learning
- **Libratus** (Poker): Abstraction techniques for large state spaces

### Internal Documentation

- [docs/implementation/02-validation.md](c:\Repos\mpmahj\docs\implementation\02-validation.md) - Validation engine spec
- [docs/architecture/04-state-machine-design.md](c:\Repos\mpmahj\docs\architecture\04-state-machine-design.md) - Game phase state machine
- [docs/architecture/05-data-models.md](c:\Repos\mpmahj\docs\architecture\05-data-models.md) - Core data structures

---

**Document Status:** Draft for Review
**Last Updated:** 2026-01-03
**Author:** AI Strategy Team
**Reviewers:** [Pending]
