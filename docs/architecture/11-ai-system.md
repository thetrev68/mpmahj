# 11. AI System

The AI System provides computer-controlled opponents ("Bots") for single-player practice and filling empty seats in multiplayer games.

Bots operate on the **Server Side** within `mahjong_server`, utilizing logic defined in `mahjong_core`. They interact with the game exactly like human players: listening for `GameEvent`s and issuing `Command`s.

## 11.1 Design Goals

1. **Human-like Timing**: Bots must not act instantly. They should mimic human "thinking time" (e.g., 1-2 seconds to discard, 3-5 seconds for Charleston).
2. **Valid Play**: Bots must never make illegal moves (e.g., calling a dead hand, passing Jokers).
3. **Adjustable Difficulty**: Support for Beginner (Random), Intermediate (Pattern-aware), and Advanced (Defensive) styles.
4. **Stateless Execution**: The bot logic functions as a pure transformation: `(GameState, BotMemory) -> Command`.

---

## 11.2 Architecture

The AI module is located in `crates/mahjong_core/src/ai/`.

### 11.2.1 The Bot Trait

All bots implement a common trait that defines how they respond to game states.

```rust
// crates/mahjong_core/src/ai/mod.rs

pub trait BotStrategy {
    /// Name of the strategy (e.g., "Random", "Heuristic-v1")
    fn name(&self) -> &str;

    /// Decide the next move based on the current view of the table
    fn decide(&mut self, view: &PlayerView) -> Option<BotAction>;

    /// Handle Charleston tile selection
    fn select_charleston_pass(&mut self, hand: &Hand, stage: CharlestonStage) -> Vec<Tile>;

    /// Decide whether to stop or continue after First Charleston
    fn vote_charleston(&mut self, hand: &Hand) -> CharlestonVote;
}

pub enum BotAction {
    Discard(Tile),
    Call(MeldType, Vec<Tile>), // Call the current discard
    Pass,                      // Pass on the current discard
    Draw,                      // Explicit draw (if needed, usually auto)
    Mahjong,                   // Declare win
}
```

### 11.2.2 Server Integration

In `mahjong_server`, a `BotManager` wraps the AI logic. It subscribes to the game loop and schedules actions.

```rust
// crates/mahjong_server/src/bot_manager.rs

pub struct BotRunner {
    pub seat: Seat,
    pub strategy: Box<dyn BotStrategy>,
    pub pending_action: Option<ScheduledCommand>,
}

impl BotRunner {
    /// Called whenever the room processes an event
    pub fn on_event(&mut self, event: &GameEvent) {
        // Update internal memory (if any)
        // Schedule next reaction with randomized delay
    }

    /// Called every server tick (e.g., 100ms)
    pub async fn tick(&mut self, table: &Table) -> Option<Command> {
        // If it's my turn and delay has passed, execute logic
        if self.is_my_turn(table) && self.timer_expired() {
            let action = self.strategy.decide(&table.get_view(self.seat));
            return self.convert_to_command(action);
        }
        None
    }
}
```

---

## 11.3 Difficulty Levels

### 11.3.1 Level 1: "The Toddler" (RandomBot)

- **Goal**: Test harness and absolute beginner opponents.
- **Logic**:
  - **Discard**: Pick a random non-Joker tile.
  - **Call**: Never call (or call randomly if valid).
  - **Charleston**: Pass 3 random non-Jokers.
  - **Win**: Declare Mahjong if the random mess accidentally wins (unlikely).

### 11.3.2 Level 2: "The Student" (HeuristicBot)

- **Goal**: Standard opponent for casual play.
- **Logic**:
  - **Target Selection**: At game start, analyzes hand against "The Card". Picks top 3 "closest" patterns.
  - **Scoring**:
    - Each tile in hand is assigned a "Value".
    - Tiles fitting the target patterns = High Value.
    - Useless tiles = Low Value.
  - **Discard**: Throw the lowest value tile.
  - **Charleston**: Keep high-value tiles; pass low-value ones.
  - **Call**: Only call if it advances one of the top 3 target patterns.

### 11.3.3 Level 3: "The Shark" (AdvancedBot - Future)

- **Goal**: Challenge experienced players.
- **Logic**: Adds **Memory** and **Defense** to Level 2.
  - **Memory**: Tracks every discarded tile. Knows what is "dead".
  - **Defense**: If an opponent shows 3 exposures of "Evens", the bot refuses to discard an Even tile, even if it hurts its own hand.
  - **Switching**: If a target pattern becomes impossible (key tiles dead), it switches strategy mid-game.

---

## 11.4 Heuristics Engine (The Brain)

The core of the AI is the `HandEvaluator`, which scores a hand against the NMJL card.

### 11.4.1 Distance Metric

For any given pattern on the card, we calculate **Distance to Win**:

$$ D = \text{TotalTilesNeeded} - \text{MatchingTilesInHand} $$

- _MatchingTiles_ includes Jokers (optimized to fill gaps).
- A "Win" is $D=0$.
- "Waiting" (fishing) is $D=1$.

### 11.4.2 Tile Valuation

To decide on a discard, the bot calculates the **Marginal Utility** of each tile.

1. **Identify Candidates**: Find top $N$ patterns with smallest $D$.
2. **Score Tiles**:
   - If Tile $T$ is required by Candidate Pattern $A$: Score += Weight($A$).
   - Weight is higher if $D$ is smaller (closer to winning).
3. **Select Discard**: The tile with the lowest Score is the "safest" to discard (least likely to be needed).

```rust
// Conceptual Logic
fn evaluate_discard(hand: &Hand, card: &CardDefinition) -> Tile {
    let mut tile_scores: HashMap<Tile, f32> = HashMap::new();

    // 1. Find best patterns
    let best_patterns = find_closest_patterns(hand, card, 3);

    // 2. Score tiles based on utility
    for tile in &hand.concealed {
        for pattern in &best_patterns {
            if pattern.needs(tile) {
                tile_scores[tile] += pattern.weight();
            }
        }
    }

    // 3. Return tile with lowest score
    tile_scores.iter().min_by_key(|entry| entry.1).unwrap().0
}
```

---

## 11.5 The Charleston Strategy

The Charleston is critical because it filters the hand before the first draw.

### 11.5.1 The "Keep/Pass" Algorithm

1. **Analyze Hand**: Before First Right, rank all patterns.
2. **Lock Core**: Identify "Core Tiles" for the top 2 patterns.
3. **Identify Trash**: Identify tiles that fit _none_ of the top 5 patterns.
4. **Selection**:
   - If `Trash.len() >= 3`: Pass 3 Trash tiles.
   - If `Trash.len() < 3`: Pass Trash + lowest utility "maybe" tiles.
   - **Blind Pass**: If the bot is _very_ close to a hand (e.g., 4 tiles away) and has < 3 trash tiles, it might opt to steal (Blind Pass) to avoid breaking its hand.

---

## 11.6 Implementation Phases

### Phase 1: The "Toddler" (MVP)

- Implement `BotStrategy` trait.
- Create `RandomBot`.
- Hook up `BotRunner` in `mahjong_server`.
- **Success Criteria**: A game can be played start-to-finish with 1 Human + 3 Bots without crashing.

### Phase 2: The Evaluator

- Implement `HandEvaluator` struct.
- Load `CardDefinition` into AI context.
- Implement `HeuristicBot` (Level 2).
- **Success Criteria**: Bot actually wins sometimes (not just by luck).

### Phase 3: Tuning

- Adjust delays to feel natural.
- Add "Chatter" (optional): Bot sends emoji reactions when it wins or loses a Joker.
- Implement "Suggestions" for human players (reusing the Bot's brain to give hints).

---

## 11.7 Data Structures

```rust
// crates/mahjong_core/src/ai/evaluator.rs

pub struct ScoredPattern {
    pub pattern_id: String,
    pub distance: u8,      // How many tiles missing?
    pub score: f32,        // 0.0 to 100.0 (Win probability)
    pub needed_tiles: Vec<Tile>,
}

pub struct BotMemory {
    /// Tiles discarded by others (that are visible)
    pub visible_discards: HashSet<Tile>,

    /// Count of exposed tiles (to detect dead hands)
    pub exposure_counts: HashMap<Tile, u8>,
}
```
