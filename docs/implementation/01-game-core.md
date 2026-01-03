# 01. Game Core Implementation Spec

This document turns the architecture into a concrete, implementable spec for the core game logic in `mahjong_core`.

---

## 1. Scope

The core is pure game logic with no network/UI/async. It is responsible for:

- Canonical game state and state transitions
- Command validation and command application
- Event generation (public + private)
- Deterministic tile dealing/shuffling (seeded RNG)
- Rules enforcement for American Mahjong (NMJL)

Not in scope for this doc:

- WebSocket transport
- Auth/session
- UI state
- Persistence

---

## 2. Crate Layout and Boundaries

- `crates/mahjong_core/src/`
  - `tile.rs` - Tile primitives
  - `deck.rs` - Deck/wall/deal
  - `hand.rs` - Hand/meld manipulation
  - `player.rs` - Player/seat
  - `table.rs` - Aggregate game state + command application
  - `flow.rs` - State machine types + transition helpers
  - `command.rs` - Command definitions
  - `event.rs` - Event definitions
  - `rules/` - Card schema + validation engine

Core design principle:

- No async, no network, no UI. File I/O only for card loading.

---

## 3. Canonical Types (required fields)

### 3.1 Tile

- `Tile { suit: Suit, rank: Rank }`
- `Suit`: Dots, Bams, Cracks, Winds, Dragons, Flowers, Jokers
- `Rank`:
  - Number(u8) for 1..=9
  - Winds: North, East, South, West
  - Dragons: Red, Green, White (White is also 0)
  - Flowers: Flower
  - Jokers: Joker
  - Blank (optional house rule)

Invariants:

- Numbered tiles are only in Dots/Bams/Cracks.
- White dragon represents 0 in year patterns.

### 3.2 Hand

- `Hand { concealed: Vec<Tile>, exposed: Vec<Meld>, joker_assignments: Option<HashMap<usize, Tile>> }`

Invariants:

- `concealed.len() + sum(meld.tiles.len()) == 14` when validating Mahjong.
- `joker_assignments` populated only after successful validation.

### 3.3 Meld

- `Meld { meld_type: MeldType, tiles: Vec<Tile>, called_tile: Option<Tile>, joker_assignments: HashMap<usize, Tile> }`
- `MeldType`: Pung(3), Kong(4), Quint(5)

Invariants:

- `tiles.len()` must match `meld_type`.
- `called_tile` present for called melds; absent for self-made melds.

### 3.4 Table

- `Table { players, wall, discard_pile, current_turn, phase, dealer, round_number, house_rules }`

Key fields:

- `players: HashMap<Seat, Player>`
- `wall: Wall`
- `discard_pile: Vec<DiscardedTile>`
- `phase: GamePhase`
- `current_turn: Seat`

---

## 4. State Machine (authoritative)

Top-level state transitions (see architecture Section 4 for enums):

- WaitingForPlayers -> Setup(RollingDice) when 4 players joined
- Setup stages in order: RollingDice -> BreakingWall -> Dealing -> OrganizingHands
- Charleston stages follow `CharlestonStage::next()`
- CharlestonComplete -> Playing(Discarding { player: East })
- Playing -> Scoring on DeclareMahjong
- Scoring -> GameOver on validation completion
- Playing -> GameOver on wall exhaustion

Turn stage rules:

- East starts with 14 tiles and begins in Discarding.
- After a discard, open CallWindow for other 3 players.
- If a call happens, caller becomes active and must discard.
- If all pass, next player draws.

Timers:

- Timers are logical values in state; actual timing is enforced by server.

---

## 5. Command Processing

### 5.1 Command Flow

- `validate_command(cmd, table) -> Result<(), CommandError>`
- `apply_command(cmd, table) -> Vec<GameEvent>`

Only `Table::process_command` can mutate state.

### 5.2 Validation Rules (core)

All validation must check:

- Current phase compatibility
- Current player turn (when applicable)
- Tile availability in hand/exposed
- House rule gates (blank exchange, etc.)

Per-command specifics:

- `RollDice`
  - Only in `Setup(RollingDice)`
  - Only East

- `ReadyToStart`
  - Only in `Setup(OrganizingHands)`
  - Each player once
  - Transition to Charleston when all ready

- `PassTiles`
  - Only in Charleston stages with pass direction
  - Tile count depends on stage (3 for standard, 1..=3 for blind pass)
  - Cannot pass Jokers

- `VoteCharleston`
  - Only during VotingToContinue
  - Collect 4 votes then transition accordingly

- `DrawTile`
  - Only in `Playing(Drawing { player })`
  - Player must equal `player`
  - Fails if wall exhausted

- `DiscardTile`
  - Only in `Playing(Discarding { player })`
  - Tile must be in concealed hand

- `CallTile`
  - Only in `Playing(CallWindow { .. })`
  - Caller cannot be discard owner
  - Called meld must be valid (including Joker rules)

- `Pass`
  - Only in `Playing(CallWindow { .. })`
  - Remove player from `can_act`

- `DeclareMahjong`
  - Only in `Playing(Discarding { player })` or `CallWindow` when the discard is the winning tile

- `ExchangeJoker`
  - Only when target meld contains Joker
  - Replacement tile must match meld

- `ExchangeBlank`
  - Only if house rule enabled
  - Player has Blank
  - Discard index valid

- `RequestState`, `LeaveGame`
  - Allowed at any time (server handles privacy)

---

## 6. Event Emission Rules

Event emission is deterministic and derived from command application.

Examples:

- `DiscardTile` emits:
  - `TileDiscarded`
  - `CallWindowOpened`

- `CallTile` emits:
  - `TileCalled`
  - `TurnChanged`

- `DrawTile` emits:
  - Private `TileDrawn { tile: Some(...) }` to drawer
  - Public `TileDrawn { tile: None }` to others

Event visibility must be enforced by server using `event_visibility` helper.

---

## 7. Dealing and RNG

Requirements:

- Shuffling uses a deterministic, seedable RNG (server provides seed).
- `Deck::shuffle(seed)` must be reproducible for testing.
- `Wall::deal_initial()` implements NMJL dealing rules (East gets 14).

Recommended signature:

- `Deck::shuffle_with_rng<R: RngCore>(&mut self, rng: &mut R)`
- `Table::new_with_seed(seed: u64)`

---

## 8. House Rules

Define a `HouseRules` struct with defaults:

- `blank_exchange_enabled: bool = false`
- `timers_enabled: bool = true`
- `call_window_seconds: u32 = 10`
- `charleston_timer_seconds: u32 = 60`

House rules live in `Table` and are read during validation.

---

## 9. Error Mapping

Command errors must be user-actionable.

Rules:

- Reject illegal phase/turn with `WrongPhase` / `NotYourTurn`.
- Reject tile issues with `TileNotInHand`, `InvalidMeld`, etc.
- Reject rule gates with `BlankExchangeNotEnabled`.
- Internal logic failures should not leak; map to `InternalError`.

---

## 10. Test Vectors (minimum)

These should exist in `mahjong_core` tests to lock behavior:

- Deal determinism with seed (same seed -> same hands)
- East starts discard after Charleston complete
- Charleston stage transitions with voting
- Call window resolution: Mahjong > next in turn
- Joker exchange validation (allowed/blocked cases)

---

## 11. Open Questions (to resolve before implementation)

- Exact blind pass rules and when 1..=3 tiles are allowed
- Courtesy pass negotiation command and event details
- Score calculation rules (card points vs house rules)
