# 6. Command/Event System (API Contract)

The Command/Event pattern provides a clean boundary between the client (React) and core logic (Rust). Players send **Commands** (intent to act), and the server responds with **Events** (what actually happened).

---

## 6.0 Notation (2026-01): Delivery Metadata Moved to Server Boundary

**Important update:** the _delivery_ of events (public vs private, and which seat a private event targets) is now treated as **server-boundary metadata**, not something derived from `mahjong_core::event::GameEvent`.

Why:

- Some private `GameEvent`s intentionally do **not** encode their target seat (e.g., `TilesDealt { your_tiles }`, `TileDrawn { tile: Some(...) }`). They represent _what happened_, not _who saw it_.
- The server (`mahjong_server`) has connection/session context and can deterministically route these events and persist the correct visibility/target for replay.

Where this lives in code:

- Delivery metadata is computed during broadcast in `Room` and passed to persistence as `EventDelivery`.
- Persistence stores `visibility` and `target_player` using this metadata (instead of trying to infer it from the event alone).

**Historical note:** the remainder of this document (including the Rust examples below) is kept as the original implementation reference used during v0.1.0 development. Treat those examples as a snapshot, not necessarily the current on-the-wire JSON shape.

## 6.1 Commands (Player → Server → Core)

Commands represent player actions. The server validates them against the current game state before applying them.

```rust
/// Actions a player can take
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum Command {
    // ===== SETUP PHASE =====
    /// East rolls the dice to determine wall break point
    RollDice,

    /// Player indicates they've finished organizing their initial hand
    ReadyToStart { player: Seat },

    // ===== CHARLESTON PHASE =====
    /// Submit tiles to pass during Charleston
    PassTiles {
        player: Seat,
        tiles: Vec<Tile>,
    },

    /// Vote to continue or stop after First Charleston
    VoteCharleston {
        player: Seat,
        vote: CharlestonVote,
    },

    /// Negotiate courtesy pass (0-3 tiles with across partner)
    ProposeCourtesyPass {
        player: Seat,
        tile_count: u8, // 0-3
    },

    // ===== MAIN GAME PHASE =====
    /// Draw a tile from the wall
    DrawTile { player: Seat },

    /// Discard a tile from hand
    DiscardTile {
        player: Seat,
        tile: Tile,
    },

    /// Call a discarded tile to complete a meld (Pung/Kong/Quint)
    CallTile {
        player: Seat,
        meld_type: MeldType,
        /// The tiles from the player's hand (not including the called tile)
        tiles_from_hand: Vec<Tile>,
    },

    /// Declare that you don't want to call the discard
    Pass { player: Seat },

    /// Declare Mahjong (winning hand)
    DeclareMahjong {
        player: Seat,
        /// Optional: The tile that completed the hand (if calling)
        winning_tile: Option<Tile>,
    },

    /// Exchange a Joker from an exposed meld with a real tile
    ExchangeJoker {
        player: Seat,
        /// Which player's meld to exchange from
        target_player: Seat,
        /// Index of the meld in target player's exposed melds
        meld_index: usize,
        /// The real tile being traded for the Joker
        replacement_tile: Tile,
    },

    /// Exchange a blank tile with any tile from the discard pile (optional house rule)
    /// This is done secretly - other players don't know which tile was taken
    ExchangeBlank {
        player: Seat,
        /// The tile from the discard pile to take
        discard_tile: Tile,
        /// Index in the discard pile (to handle multiple identical tiles)
        discard_index: usize,
    },

    // ===== GAME MANAGEMENT =====
    /// Request current game state (for reconnection)
    RequestState { player: Seat },

    /// Leave the game
    LeaveGame { player: Seat },
}
```

---

## 6.2 Events (Server → Client)

Events are the "source of truth" broadcast to all clients. They describe what happened, not what should happen.

```rust
/// Events that occur during the game
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum GameEvent {
    // ===== GAME LIFECYCLE =====
    /// Game was created and is waiting for players
    GameCreated {
        game_id: String,
    },

    /// A player joined the game
    PlayerJoined {
        player: Seat,
        player_id: String,
        is_bot: bool,
    },

    /// All players joined, game is starting
    GameStarting,

    // ===== SETUP PHASE =====
    /// East rolled the dice
    DiceRolled {
        roll: u8, // 2-12
    },

    /// Wall was broken at the dice position
    WallBroken {
        position: usize,
    },

    /// Initial tiles dealt to all players
    TilesDealt {
        /// Only sent to each individual player (private info)
        /// Server sends different versions to each client
        your_tiles: Vec<Tile>,
    },

    // ===== CHARLESTON PHASE =====
    /// Charleston phase changed
    CharlestonPhaseChanged {
        stage: CharlestonStage,
    },

    /// A player submitted their tiles for the current pass
    PlayerReadyForPass {
        player: Seat,
    },

    /// All players ready, tiles are being passed now
    TilesPassing {
        direction: PassDirection,
    },

    /// You received tiles from a Charleston pass (private)
    TilesReceived {
        tiles: Vec<Tile>,
    },

    /// A player voted during the continue/stop decision
    PlayerVoted {
        player: Seat,
        // Vote is hidden until all votes are in
    },

    /// Voting complete, result announced
    VoteResult {
        result: CharlestonVote,
    },

    /// Charleston is complete, main game starting
    CharlestonComplete,

    // ===== MAIN GAME PHASE =====
    /// Game phase changed
    PhaseChanged {
        phase: GamePhase,
    },

    /// Turn changed to a new player
    TurnChanged {
        player: Seat,
        stage: TurnStage,
    },

    /// A tile was drawn from the wall (only the drawer sees what it is)
    TileDrawn {
        /// Only sent to the player who drew
        tile: Option<Tile>,
        /// Sent to everyone
        remaining_tiles: usize,
    },

    /// A tile was discarded
    TileDiscarded {
        player: Seat,
        tile: Tile,
    },

    /// Call window opened (other players can call or pass)
    CallWindowOpened {
        tile: Tile,
        discarded_by: Seat,
        can_call: Vec<Seat>,
        timer: u32,
        started_at_ms: u64,
        timer_mode: TimerMode,
    },

    /// Charleston timer started for current pass stage
    CharlestonTimerStarted {
        stage: CharlestonStage,
        duration: u32,
        started_at_ms: u64,
        timer_mode: TimerMode,
    },

    /// A player passed on calling the discard
    PlayerPassed {
        player: Seat,
    },

    /// Call window closed, no one called
    CallWindowClosed,

    /// A player called the discard and exposed a meld
    TileCalled {
        player: Seat,
        meld: Meld,
        called_tile: Tile,
    },

    /// A Joker was exchanged from an exposed meld
    JokerExchanged {
        from_player: Seat,
        by_player: Seat,
        meld_index: usize,
        joker: Tile,
        replacement: Tile,
    },

    /// A blank tile was exchanged with a discard (only visible to the player)
    /// Other players only see that someone took a tile from the discard pile
    BlankExchanged {
        player: Seat,
        /// The tile taken from discard (only sent to the player who exchanged)
        taken_tile: Option<Tile>,
        /// Which position in discard pile (sent to everyone)
        discard_index: usize,
    },

    // ===== WIN/SCORING =====
    /// A player declared Mahjong
    MahjongDeclared {
        player: Seat,
    },

    /// Hand validation in progress
    ValidatingHand {
        player: Seat,
    },

    /// Hand was valid, game won
    GameWon {
        result: GameResult,
    },

    /// Hand was invalid (false Mahjong declaration)
    InvalidMahjong {
        player: Seat,
        reason: String,
    },

    /// Wall exhausted, no winner (draw)
    WallExhausted,

    /// Game over
    GameOver {
        result: GameResult,
    },

    // ===== ERRORS =====
    /// A command was rejected
    CommandRejected {
        player: Seat,
        reason: CommandError,
    },

    /// A player disconnected
    PlayerDisconnected {
        player: Seat,
    },

    /// A player reconnected
    PlayerReconnected {
        player: Seat,
    },
}
```

---

## 6.3 Command Validation and Results

The server validates commands before processing them.

```rust
/// Result of processing a command
pub type CommandResult = Result<Vec<GameEvent>, CommandError>;

/// Errors that occur when processing commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export))]
pub enum CommandError {
    // ===== AUTHORIZATION =====
    /// Player is not in this game
    NotInGame,

    /// Action not allowed in current game phase
    WrongPhase {
        current: String,
        expected: String,
    },

    /// Not your turn
    NotYourTurn {
        current_player: Seat,
    },

    // ===== CHARLESTON ERRORS =====
    /// Wrong number of tiles passed
    InvalidPassCount {
        expected: u8,
        got: u8,
    },

    /// Tried to pass a Joker (not allowed)
    CannotPassJoker,

    /// Tile not in your hand
    TileNotInHand { tile: Tile },

    // ===== DISCARD/CALL ERRORS =====
    /// Tried to call your own discard
    CannotCallOwnDiscard,

    /// Call window expired
    CallWindowExpired,

    /// Invalid meld (tiles don't match)
    InvalidMeld { reason: String },

    /// Don't have the tiles needed for this meld
    InsufficientTiles,

    // ===== JOKER EXCHANGE ERRORS =====
    /// Meld has no Joker to exchange
    NoJokerInMeld,

    /// Replacement tile doesn't match meld
    InvalidReplacement {
        expected: Tile,
        got: Tile,
    },

    /// Don't have the replacement tile
    MissingReplacementTile,

    // ===== BLANK TILE EXCHANGE ERRORS =====
    /// Blank tile exchange is not enabled in house rules
    BlankExchangeNotEnabled,

    /// Player doesn't have a blank tile
    NoBlankTile,

    /// Requested tile is not in the discard pile
    TileNotInDiscardPile,

    /// Invalid discard index
    InvalidDiscardIndex,

    // ===== WIN VALIDATION ERRORS =====
    /// Hand doesn't match any pattern on The Card
    InvalidWinningHand { reason: String },

    /// Incorrect tile count
    InvalidTileCount { expected: u8, got: u8 },

    // ===== GENERIC =====
    /// Something went wrong internally
    InternalError { message: String },
}
```

---

## 6.4 Command Processing Pattern

Here's how the server processes a command:

```rust
impl Table {
    /// Process a command and return events
    pub fn process_command(&mut self, cmd: Command) -> CommandResult {
        // Step 1: Validate the command is legal right now
        self.validate_command(&cmd)?;

        // Step 2: Apply the command and generate events
        let events = match cmd {
            Command::DiscardTile { player, tile } => {
                self.handle_discard(player, tile)?
            }

            Command::CallTile { player, meld_type, tiles_from_hand } => {
                self.handle_call(player, meld_type, tiles_from_hand)?
            }

            Command::DeclareMahjong { player, winning_tile } => {
                self.handle_mahjong(player, winning_tile)?
            }

            Command::PassTiles { player, tiles } => {
                self.handle_charleston_pass(player, tiles)?
            }

            // ... other commands
            _ => vec![],
        };

        // Step 3: Return events to be broadcast
        Ok(events)
    }

    /// Validate a command is legal in the current state
    fn validate_command(&self, cmd: &Command) -> Result<(), CommandError> {
        match cmd {
            Command::DiscardTile { player, tile } => {
                // Check it's their turn
                if !matches!(self.phase, GamePhase::Playing(TurnStage::Discarding { player: p }) if p == *player) {
                    return Err(CommandError::NotYourTurn {
                        current_player: self.current_turn,
                    });
                }

                // Check they have the tile
                let player_obj = self.players.get(player).unwrap();
                if !player_obj.hand.concealed.contains(tile) {
                    return Err(CommandError::TileNotInHand { tile: *tile });
                }

                Ok(())
            }

            Command::CallTile { player, meld_type, tiles_from_hand } => {
                // Check we're in a call window
                if !matches!(self.phase, GamePhase::Playing(TurnStage::CallWindow { .. })) {
                    return Err(CommandError::WrongPhase {
                        current: format!("{:?}", self.phase),
                        expected: "CallWindow".to_string(),
                    });
                }

                // Check the tiles form a valid meld
                // (This is simplified - real impl needs to check Jokers, etc.)
                if tiles_from_hand.len() + 1 != meld_type.tile_count() {
                    return Err(CommandError::InvalidMeld {
                        reason: "Wrong number of tiles".to_string(),
                    });
                }

                Ok(())
            }

            Command::PassTiles { player, tiles } => {
                // Check we're in Charleston
                if !matches!(self.phase, GamePhase::Charleston(_)) {
                    return Err(CommandError::WrongPhase {
                        current: format!("{:?}", self.phase),
                        expected: "Charleston".to_string(),
                    });
                }

                // Check tile count (usually 3, but blind pass can be 1-3)
                // Check no Jokers
                if tiles.iter().any(|t| t.suit == Suit::Jokers) {
                    return Err(CommandError::CannotPassJoker);
                }

                Ok(())
            }

            Command::ExchangeBlank { player, discard_tile, discard_index } => {
                // Check house rules allow blank exchange
                if !self.house_rules.blank_exchange_enabled {
                    return Err(CommandError::BlankExchangeNotEnabled);
                }

                // Check player has a blank tile
                let player_obj = self.players.get(player).unwrap();
                let has_blank = player_obj.hand.concealed.iter()
                    .any(|t| matches!(t.rank, Rank::Blank));

                if !has_blank {
                    return Err(CommandError::NoBlankTile);
                }

                // Check the discard tile exists at that index
                if *discard_index >= self.discard_pile.len() {
                    return Err(CommandError::InvalidDiscardIndex);
                }

                let discarded = &self.discard_pile[*discard_index];
                if discarded.tile != *discard_tile {
                    return Err(CommandError::TileNotInDiscardPile);
                }

                Ok(())
            }

            _ => Ok(()), // Other commands validated elsewhere
        }
    }

    /// Handle a discard action
    fn handle_discard(&mut self, player: Seat, tile: Tile) -> Result<Vec<GameEvent>, CommandError> {
        // Remove tile from player's hand
        let player_obj = self.players.get_mut(&player).unwrap();
        player_obj.hand.remove_tile(tile)
            .map_err(|_| CommandError::TileNotInHand { tile })?;

        // Add to discard pile
        self.discard_pile.push(DiscardedTile {
            tile,
            discarded_by: player,
            turn_number: self.discard_pile.len() as u32,
        });

        // Transition to call window
        self.phase = GamePhase::Playing(TurnStage::CallWindow {
            tile,
            discarded_by: player,
            can_act: HashSet::from([player.right(), player.across(), player.left()]),
            timer: 10,
        });

        // Generate events
        Ok(vec![
            GameEvent::TileDiscarded { player, tile },
            GameEvent::CallWindowOpened {
                tile,
                discarded_by: player,
                timer: 10,
            },
        ])
    }

    // ... other handlers (handle_call, handle_charleston_pass, etc.)
}
```

---

## 6.5 TypeScript Type Generation

To ensure type safety across the network boundary, we use `ts-rs` to auto-generate TypeScript types from Rust structs.

**In `Cargo.toml`:**

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
ts-rs = { version = "7.0", optional = true }

[features]
typescript = ["ts-rs"]
```

**Generate types:**

```bash
cargo build --features typescript
```

**This generates (in `bindings/` directory):**

```typescript
// Command.ts
export type Command =
  | { type: 'RollDice' }
  | { type: 'DiscardTile'; player: Seat; tile: Tile }
  | { type: 'CallTile'; player: Seat; meld_type: MeldType; tiles_from_hand: Tile[] }
  | { type: 'DeclareMahjong'; player: Seat; winning_tile?: Tile };
// ... etc

// GameEvent.ts
export type GameEvent =
  | { type: 'TileDiscarded'; player: Seat; tile: Tile }
  | { type: 'CallWindowOpened'; tile: Tile; discarded_by: Seat; timer: number }
  | { type: 'GameWon'; result: GameResult };
// ... etc

// Tile.ts
export interface Tile {
  suit: Suit;
  rank: Rank;
}

export type Suit = 'Dots' | 'Bams' | 'Cracks' | 'Winds' | 'Dragons' | 'Flowers' | 'Jokers';
export type Rank = { type: 'Number'; value: number } | 'North' | 'East' | /* ... */ 'Joker';
```

**React usage:**

```typescript
import { Command, GameEvent, Tile, Seat } from '@/bindings';

// Type-safe command
const discardCmd: Command = {
  type: 'DiscardTile',
  player: 'East',
  tile: { suit: 'Dots', rank: { type: 'Number', value: 5 } },
};

// Type-safe event handler
function handleEvent(event: GameEvent) {
  switch (event.type) {
    case 'TileDiscarded':
      console.log(`${event.player} discarded ${event.tile.suit} ${event.tile.rank}`);
      break;
    case 'GameWon':
      console.log(`Winner: ${event.result.winner}`);
      break;
    // TypeScript ensures all cases are handled
  }
}
```

---

## 6.6 Event Visibility (Public vs Private)

Some events contain sensitive information and are sent only to specific players.

```rust
/// Determine which players should receive this event
pub fn event_visibility(event: &GameEvent, requesting_player: Seat) -> bool {
    match event {
        // Public events - everyone sees them
        GameEvent::TileDiscarded { .. } |
        GameEvent::CallWindowOpened { .. } |
        GameEvent::TurnChanged { .. } |
        GameEvent::PhaseChanged { .. } => true,

        // Private events - only the player sees them
        GameEvent::TileDrawn { tile: Some(_), .. } => {
            // Only the drawer knows what tile they drew
            // Server sends this event only to that player
            false // Server handles this specially
        }

        GameEvent::TilesReceived { .. } => {
            // Only you know what tiles you received in Charleston
            false
        }

        _ => true,
    }
}
```

**Server sends personalized events:**

```rust
// After a tile is drawn
let drawer_event = GameEvent::TileDrawn {
    tile: Some(drawn_tile), // Only drawer sees this
    remaining_tiles: wall.remaining(),
};

let public_event = GameEvent::TileDrawn {
    tile: None, // Others just know a tile was drawn
    remaining_tiles: wall.remaining(),
};

// Send different events to different players
send_to_player(drawer, drawer_event);
broadcast_to_others(public_event);
```

---

## 6.7 Command Priority and Conflict Resolution

When multiple players try to act simultaneously (e.g., during call window), the server resolves conflicts.

```rust
/// Resolve conflicting calls for the same discard
pub fn resolve_call_conflict(calls: Vec<(Seat, Command)>, discarded_by: Seat) -> Seat {
    // Priority 1: Mahjong beats everything
    if let Some((caller, _)) = calls.iter().find(|(_, cmd)| {
        matches!(cmd, Command::DeclareMahjong { .. })
    }) {
        return *caller;
    }

    // Priority 2: Closest player in turn order wins
    let next_in_turn = discarded_by.right();
    if calls.iter().any(|(seat, _)| *seat == next_in_turn) {
        return next_in_turn;
    }

    let two_away = next_in_turn.right();
    if calls.iter().any(|(seat, _)| *seat == two_away) {
        return two_away;
    }

    // Fallback (shouldn't happen)
    calls[0].0
}
```

---

## 6.8 Example: Full Turn Flow

Here's a complete turn cycle with commands and events:

```rust
// Player East discards
let cmd = Command::DiscardTile {
    player: Seat::East,
    tile: Tile::new_number(Suit::Bams, 7).unwrap(),
};

let events = table.process_command(cmd)?;
// Events:
// - TileDiscarded { player: East, tile: 7-Bam }
// - CallWindowOpened { tile: 7-Bam, discarded_by: East, timer: 10 }

// Player West decides to call
let cmd = Command::CallTile {
    player: Seat::West,
    meld_type: MeldType::Pung,
    tiles_from_hand: vec![
        Tile::new_number(Suit::Bams, 7).unwrap(),
        Tile::new_number(Suit::Bams, 7).unwrap(),
    ],
};

let events = table.process_command(cmd)?;
// Events:
// - TileCalled { player: West, meld: Pung(7-Bam x3), called_tile: 7-Bam }
// - TurnChanged { player: West, stage: Discarding }

// West must now discard
let cmd = Command::DiscardTile {
    player: Seat::West,
    tile: Tile::new_number(Suit::Dots, 1).unwrap(),
};

let events = table.process_command(cmd)?;
// ... cycle continues
```

---

## 6.9 Design Principles

1. **Commands are Intents**: They express what a player _wants_ to do, not what _will_ happen
2. **Events are Facts**: They describe what _actually happened_ after validation
3. **Type Safety**: Rust enums prevent impossible commands; TypeScript types prevent client errors
4. **Validation at Edge**: Commands are validated before state changes
5. **Privacy by Design**: Sensitive events (drawn tiles, concealed hands) are never broadcast publicly
6. **Conflict Resolution**: Server is authoritative; resolves race conditions deterministically
