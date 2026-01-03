# 08. Bot AI Implementation Spec

This document specifies bot player AI for testing and single-player mode.

---

## 1. Scope

Bots are automated players that make decisions without human input.

MVP Goals:

- Enable single-player testing (1 human + 3 bots)
- Provide automated integration testing (4 bots)
- Complete full games without human intervention
- Make legal, reasonably sensible moves

Not in MVP:

- Advanced strategy or optimization
- Multiple difficulty levels
- Learning/adaptation
- Perfect play or expert-level decisions

---

## 2. Architecture

Bots live in `crates/mahjong_core/src/bot/` as pure logic (no I/O).

```rust
pub struct Bot {
    /// The seat this bot is playing
    seat: Seat,

    /// Bot personality/strategy (for future difficulty levels)
    strategy: BotStrategy,

    /// Random number generator (for non-deterministic choices)
    rng: StdRng,
}

impl Bot {
    /// Decide which tiles to pass during Charleston
    pub fn choose_charleston_pass(
        &mut self,
        hand: &Hand,
        stage: CharlestonStage,
    ) -> Vec<Tile>;

    /// Decide whether to vote Continue or Stop after First Charleston
    pub fn vote_charleston(&self, hand: &Hand) -> CharlestonVote;

    /// Decide which tile to discard
    pub fn choose_discard(
        &mut self,
        hand: &Hand,
        card: &CardDefinition,
    ) -> Tile;

    /// Decide whether to call a discarded tile
    pub fn should_call(
        &self,
        hand: &Hand,
        discard: &Tile,
        card: &CardDefinition,
    ) -> Option<MeldType>;

    /// Decide whether to exchange a Joker from an exposed meld
    pub fn should_exchange_joker(
        &self,
        hand: &Hand,
        exposed_melds: &[Meld],
    ) -> Option<(usize, Tile)>;
}
```

---

## 3. Charleston Strategy

Bot uses a simple heuristic for tile passing:

### First Charleston (FirstRight, FirstAcross, FirstLeft)

Pass tiles in this priority order:

1. **Isolated high-value tiles** - Single Dragons, Winds, Flowers (valuable but hard to use)
2. **Extreme numbers** - 1s and 9s (least flexible for patterns)
3. **Duplicate middle tiles** - If you have 3+ of the same middle-range tile, keep 2 and pass extras
4. **Random selection** - If hand is balanced, pass random tiles

### Voting (Continue or Stop)

- **Vote Continue** if hand has 5+ tiles that could fit into patterns (conservative)
- **Vote Stop** if hand already has promising structure (2+ pairs, a pung, etc.)
- Default: **Stop** (most players prefer to start playing)

### Blind Pass

- Bot doesn't use blind pass in MVP (always selects from hand)
- Future: Use blind pass probabilistically (20% chance)

### Courtesy Pass

- Propose **0 tiles** (block Charleston) if hand looks good
- Propose **3 tiles** if hand is weak
- "Good hand" = 3+ pairs or 1+ pung

---

## 4. Discard Strategy

Bot chooses discard using a scoring system:

### Tile Value Score (lower = more likely to discard)

For each tile in hand, calculate:

```rust
fn tile_discard_score(tile: &Tile, hand: &Hand, card: &CardDefinition) -> i32 {
    let mut score = 0;

    // Penalty: Tiles that fit into many patterns (keep valuable tiles)
    score -= count_patterns_using_tile(tile, card) * 10;

    // Penalty: Tiles that pair with others in hand
    if hand.contains_pair(tile) {
        score -= 20;
    }

    // Penalty: Jokers (never discard Jokers)
    if tile.is_joker() {
        score -= 1000;
    }

    // Penalty: Flowers (useful for many patterns)
    if tile.is_flower() {
        score -= 15;
    }

    // Bonus: Isolated tiles (no nearby tiles in same suit)
    if is_isolated(tile, hand) {
        score += 10;
    }

    // Bonus: Extreme numbers (1, 9) are less flexible
    if matches!(tile.rank, Rank::Number(1) | Rank::Number(9)) {
        score += 5;
    }

    score
}
```

Discard the tile with the **lowest score** (least valuable to keep).

---

## 5. Call Decision Strategy

Bot decides whether to call a discard based on:

### Rule 1: Don't Call Early

- If hand is < 50% complete (far from winning), **don't call**
- Calling exposes your strategy and limits flexibility

### Rule 2: Only Call for High-Value Melds

- **Call** if the discard completes a **Pung** or **Kong** of tiles that fit into multiple patterns
- **Don't call** for single-use melds

### Rule 3: Don't Call if Close to Concealed Win

- If hand is 1-2 tiles from a **concealed hand** pattern, **don't call**
- Concealed hands are often worth more points (future scoring)

Implementation:

```rust
fn should_call(&self, hand: &Hand, discard: &Tile, card: &CardDefinition) -> Option<MeldType> {
    // Never call if hand is < 50% complete
    let completion = estimate_completion(hand, card);
    if completion < 0.5 {
        return None;
    }

    // Check if discard completes a meld
    if let Some(meld_type) = can_form_meld(hand, discard) {
        // Check if resulting meld fits into high-value patterns
        let pattern_count = count_patterns_with_meld(hand, discard, meld_type, card);
        if pattern_count >= 3 {
            return Some(meld_type);
        }
    }

    None
}
```

---

## 6. Mahjong Declaration

Bot declares Mahjong immediately when validation confirms a winning hand.

Check after:

1. **Drawing a tile** - Call `validate_hand()` on new 14-tile hand
2. **Call window opens** - If calling the discard would complete a winning hand

Implementation:

```rust
fn should_declare_mahjong(&self, hand: &Hand, card: &CardDefinition) -> bool {
    // Run validation engine
    match validate_hand(hand, card, concealed_only) {
        ValidationResult::Valid { .. } => true,
        ValidationResult::Invalid { .. } => false,
    }
}
```

Bot doesn't "bluff" or delay - declares immediately upon winning.

---

## 7. Joker Exchange Strategy

Bot exchanges Jokers from exposed melds only when:

1. The replacement tile is **useless** in current hand (isolated, doesn't fit patterns)
2. The Joker would be **highly valuable** for completing patterns

This is a rare move - bot prioritizes simple strategy over complex optimization.

---

## 8. Bot Personality (Future)

For difficulty levels (post-MVP), use `BotStrategy` enum:

```rust
pub enum BotStrategy {
    /// Random legal moves (easiest)
    Random,

    /// Simple heuristics (described above)
    Basic,

    /// Advanced pattern recognition
    Intermediate,

    /// Near-optimal play with lookahead
    Expert,
}
```

MVP implements **Basic** only.

---

## 9. Integration with Server

Bots are instantiated by the server when:

1. Player creates a game and requests bots
2. Player leaves mid-game (bot takes over their seat)

Server API:

```rust
// In mahjong_server
pub struct GameRoom {
    players: HashMap<Seat, PlayerConnection>,
    bots: HashMap<Seat, Bot>,
}

impl GameRoom {
    /// Replace a player with a bot
    pub fn add_bot(&mut self, seat: Seat) {
        let bot = Bot::new(seat, BotStrategy::Basic, seed);
        self.bots.insert(seat, bot);
    }

    /// Bot generates a command based on current state
    pub fn tick_bot(&mut self, seat: Seat) -> Option<Command> {
        if let Some(bot) = self.bots.get_mut(&seat) {
            return bot.decide_action(&self.game_state);
        }
        None
    }
}
```

Bots run on server side, not client side.

---

## 10. Timing and Delays

Bots introduce artificial delays to simulate human behavior:

- **Charleston pass**: 2-5 seconds (random)
- **Discard**: 1-3 seconds
- **Call decision**: 0.5-2 seconds
- **Mahjong declaration**: Immediate (0 seconds)

This makes the game feel more natural and gives human players time to observe.

---

## 11. Testing Requirements

Bot AI must pass these tests:

- [ ] Bot completes a full game (setup → Charleston → playing → win/loss)
- [ ] Bot never makes illegal moves
- [ ] Bot declares Mahjong when holding a valid winning hand
- [ ] Bot passes exactly 3 tiles during standard Charleston
- [ ] Bot doesn't pass Jokers during Charleston
- [ ] 4-bot game completes without errors (100 simulated games)

---

## 12. Known Limitations (MVP)

- **No strategic depth** - Bots don't plan ahead, just react to current state
- **No opponent modeling** - Bots ignore what other players discard
- **No bluffing** - Bots play honestly, don't try to mislead
- **No risk assessment** - Bots don't avoid discarding dangerous tiles
- **Single difficulty** - All bots play at same level

These are acceptable for MVP testing. Future versions can add sophistication.

---

## 13. Performance

Bots must decide quickly:

- **Decision time**: < 100ms per action (imperceptible to users)
- **Memory**: < 10KB per bot instance
- **No blocking**: Bot logic runs async, doesn't block server

Pattern validation is the slowest operation - bot re-validates hand frequently. This is acceptable for MVP with 4 bots.

---

## 14. Implementation Checklist

- [ ] `Bot` struct and trait definition
- [ ] Charleston tile selection algorithm
- [ ] Charleston voting logic
- [ ] Discard scoring system
- [ ] Call decision logic
- [ ] Mahjong detection
- [ ] Integration with game server
- [ ] Timing delays
- [ ] Unit tests for bot decisions
- [ ] 4-bot integration test
