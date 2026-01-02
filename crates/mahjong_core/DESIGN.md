# Mahjong Core Design Document

This document outlines the architecture for `mahjong_core`, the pure Rust library responsible for the logic, state, and rules of American Mahjong.

## 1. Core Philosophy

* **Pure State Machine:** This crate does not know about WebSockets, Databases, or REST APIs. It takes inputs (Actions) and produces outputs (Events/State Changes).
* **Data-Driven Rules:** Valid hands (The Card) are loaded from data, not hardcoded, to support annual card updates.
* **Impossible States Impossible:** Use Rust's type system (Enums) to prevent invalid game states (e.g., trying to "Call" during the "Charleston").

## 2. Module Structure

We will split `src/lib.rs` into the following modules:

```text
mahjong_core/
├── src/
│   ├── lib.rs          # Exports modules
│   ├── tile.rs         # (Existing) Suit, Rank, Tile definitions
│   ├── deck.rs         # Wall generation, shuffling, dealing
│   ├── hand.rs         # Player's hand management (sorting, counting)
│   ├── player.rs       # Player entity (Seat, ID, Hand, status)
│   ├── table.rs        # The aggregate Game State (Players, Wall, Discards)
│   ├── flow.rs         # The State Machine (Phases, Turn logic)
│   ├── command.rs      # Input: Actions players can take (Discard, Pass)
│   ├── event.rs        # Output: What happened (Dealt, Passed, Won)
│   └── rules/          # The Logic Engine
│       ├── mod.rs
│       ├── card.rs     # Data structures for "The NMJL Card"
│       └── validator.rs# Logic to check a Hand against a Card
```

## 3. Data Models

### Deck & Wall

* **Deck:** Standard 152 tiles.
* **Wall:** A `Vec<Tile>` representing the remaining tiles. Supports `draw()`.

### Hand

* **Concealed:** `Vec<Tile>` (Private to player).
* **Exposed:** `Vec<Meld>` (Public).
* **Meld:** Structure representing a Pung, Kong, Quint, or Joker Exchange.

### Player

* **Seat:** Enum `{ East, South, West, North }`.
* **IsBot:** Boolean.
* **Hand:** The `Hand` struct.

### Table (Game State)

```rust
pub struct Table {
    pub players: HashMap<Seat, Player>,
    pub wall: Deck,
    pub discard_pile: Vec<Tile>,
    pub current_turn: Seat,
    pub phase: GamePhase,
    pub dealer: Seat,
}
```

## 4. The State Machine (`GamePhase`)

American Mahjong has a very distinct flow. We will model this with an Enum.

```rust
pub enum GamePhase {
    WaitingForPlayers,
    Setup(SetupStage),      // Breaking wall, Dealing
    Charleston(CharlestonStage),
    GameLoop(TurnStage),
    Scoring(WinReason),
    GameOver,
}

pub enum CharlestonStage {
    Right,
    Across,
    Left,
    BlindPass, // Optional "Left"
    Courtesy,  // Optional "Across"
}

pub enum TurnStage {
    Drawing,            // Player needs to draw
    Discarding,         // Player needs to discard (or Mahjong)
    Window(Tile),       // Other players can Call/Ignore the discard
}
```

## 5. Action/Event System

This allows the `mahjong_server` to interact with `mahjong_core` cleanly.

* **Command (Input):** `Action::Discard(Tile)`, `Action::PassTiles(Vec<Tile>)`, `Action::Call(MeldType)`.
* **Result:** `Result<Vec<GameEvent>, GameError>`.
* **Event (Output):** `GameEvent::TurnChanged(Seat)`, `GameEvent::HandUpdated(Seat)`, `GameEvent::CharlestonPhaseChanged`.

## 6. The "Card" Validator (The Hard Part)

We need a flexible schema to represent the NMJL card.

**Proposed Schema (JSON/Struct):**

```rust
struct CardDefinition {
    year: u16,
    sections: Vec<Section>, // e.g., "2468", "Winds - Dragons"
}

struct Section {
    name: String,
    hands: Vec<HandPattern>,
}

struct HandPattern {
    groups: Vec<GroupPattern>, // e.g., [Pair(2), Pung(4), Kong(6), Kong(8)]
    exposed_permitted: bool,   // "X" vs "C" on the card
}
```

**Validation Strategy:**

1. **Normalize:** Convert the player's hand into counts (e.g., "Three 5-Bams, Two Red Dragons").
2. **Permute Jokers:** Calculate all possible identities for the Jokers in the hand.
3. **Match:** Check if any permutation matches a `HandPattern` on the active Card.

## 7. Next Steps

1. Scaffold the file structure (`touch src/deck.rs`, etc.).
2. Implement `Deck` and `Wall` (requires `rand` crate).
3. Implement `Hand` and `Player`.
4. Implement the `Charleston` state machine (the trickiest flow logic).
