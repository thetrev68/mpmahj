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
  - Tile count: 3 for standard passes
  - Blind pass (FirstLeft/SecondRight only): Can specify `blind_pass_count` (1-3) to pass incoming tiles directly
  - Validation: `blind_pass_count + tiles_from_hand.len() == 3`
  - Cannot pass Jokers (applies to both regular and blind pass tiles)

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

## 11. Blind Pass Rules

Blind pass is a special Charleston mechanic available only during `FirstLeft` and `SecondRight` stages.

Rules:

- Instead of selecting tiles from hand, player can choose to pass 1-3 incoming tiles directly to the next player
- Player does not see what these tiles are (hence "blind")
- Remaining tiles (if fewer than 3 selected for blind pass) come from hand as normal
- Example: On FirstLeft, player receives 3 tiles from Across. They can blind pass 2 of those tiles to Left, and pass 1 tile from their hand
- Only available on `FirstLeft` and `SecondRight` stages (last pass of each Charleston)

Implementation:

- `PassTiles` command needs `blind_pass_count: Option<u8>` field (1-3)
- Server executes blind pass by routing incoming tiles directly without revealing to player
- Validation must ensure `blind_pass_count + hand_tiles.len() == 3` (or appropriate count for that stage)

---

## 12. Courtesy Pass Negotiation

Courtesy pass is an optional negotiation between across partners (East-West, North-South).

Rules:

- Occurs during `CourtesyAcross` stage
- Each pair negotiates independently
- Players can propose 0-3 tiles
- Must be mutual agreement (both players submit the same count)
- If counts don't match, conflict resolution applies (see below)

Commands:

- `ProposeCourtesyPass { player: Seat, tile_count: u8 }` - propose passing N tiles
- `AcceptCourtesyPass { player: Seat, tiles: Vec<Tile> }` - confirm and submit tiles

Events:

- `CourtesyPassProposed { player: Seat, tile_count: u8 }`
- `CourtesyPassMismatch { pair: (Seat, Seat), proposed: (u8, u8) }` - conflict detected
- `CourtesyPassComplete { pair: (Seat, Seat), tile_count: u8 }`

Conflict Resolution:

- If across partners propose different counts, server emits `CourtesyPassMismatch`
- Both players must confirm/revise their proposal
- If mismatch persists after revision, smallest count wins
- Blocking Charleston (proposing 0 tiles) always wins over non-zero proposals

---

## 13. Call Conflict Resolution

When multiple players call the same discard, server resolves deterministically.

Priority Rules:

1. **Mahjong (win) beats all other calls** - if any player declares Mahjong, they win regardless of position
2. **Turn order proximity** - if multiple players call for Pung/Kong/Quint, the player whose turn would be next wins
   - Turn order: East → South → West → North → East
   - If East discards, South is next, so South > West > North for call priority
   - If South discards, West > North > East
3. **First timestamp** - if somehow tied (shouldn't happen), earliest command timestamp wins

Implementation:

- Server collects all `CallTile` and `DeclareMahjong` commands during call window
- When window closes (all passed or timer expires), apply priority rules
- Emit `TileCalled` event for winner, `CallWindowClosed` for losers
- Only one player gets the tile

---

## 14. Score Calculation (Out of MVP Scope)

Scoring is **not implemented in MVP**. Focus is on validating game mechanics, not point calculation.

MVP Tracking (Simple):

- **Win/Loss only** - Track which player won, no points
- **Pattern matched** - Store the `HandPattern.description` that won
- **Statistics** - Count wins per player, games played

Future (Post-MVP):

- Point calculation based on `HandPattern.points`
- House rule bonuses (flowers, jokers, concealed hand)
- Payment calculations (East pays double, etc.)
- Leaderboards and ELO ratings

---

## 15. Charleston Tile Count Mismatch

During standard Charleston passes (not blind), all 4 players should submit exactly 3 tiles.

Conflict Handling:

- If a player submits wrong count (not 3), reject with `InvalidPassCount` error
- They must resubmit before pass can execute
- Timer continues - if timer expires, auto-select random tiles from their hand
- If mismatch in blind pass count validation, smallest count wins (blocking wins)
