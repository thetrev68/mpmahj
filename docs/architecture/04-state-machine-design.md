# 4. State Machine Design

The game flow is modeled as a hierarchical state machine. Each phase has its own sub-states, and transitions are strictly controlled to prevent invalid actions.

## 4.1 Core Game Phase

The top-level state that governs what type of activity is currently happening.

```rust
/// The top-level game phase
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GamePhase {
    /// Waiting for 4 players to join
    WaitingForPlayers,

    /// Pre-game setup (dice roll, wall break, dealing)
    Setup(SetupStage),

    /// Mandatory tile exchange phase
    Charleston(CharlestonStage),

    /// Main draw-discard loop
    Playing(TurnStage),

    /// Someone won - validating and scoring
    Scoring(WinContext),

    /// Game completed, showing results
    GameOver(GameResult),
}

/// Setup sub-phases
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SetupStage {
    /// East is rolling dice to determine wall break
    RollingDice,

    /// Wall is being broken at the dice position
    BreakingWall,

    /// Dealing initial tiles to all players
    Dealing,

    /// Players are organizing their initial hands
    OrganizingHands,
}

/// Win context for validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinContext {
    /// Who declared Mahjong
    pub winner: Seat,

    /// How they won
    pub win_type: WinType,

    /// The winning tile (drawn or called)
    pub winning_tile: Tile,

    /// The complete winning hand (for validation)
    pub hand: Hand,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WinType {
    /// Won by drawing the winning tile themselves
    SelfDraw,

    /// Won by calling someone else's discard
    CalledDiscard(Seat), // Who discarded the winning tile
}

/// Final game results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameResult {
    /// The validated winner
    pub winner: Seat,

    /// The winning pattern from The Card
    pub winning_pattern: String, // e.g., "2468 Consecutive Run"

    /// Final hands of all players (for review)
    pub final_hands: HashMap<Seat, Hand>,

    // Note: Point calculation is out of MVP scope
    // Future: Add points, bonuses, payment calculations
}
```

---

## 4.2 Charleston Stage

The Charleston is the most complex phase because it involves synchronized tile passing between all 4 players.

```rust
/// Charleston sub-phases
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CharlestonStage {
    // ===== FIRST CHARLESTON (Mandatory) =====

    /// First pass: Everyone passes 3 tiles RIGHT
    FirstRight,

    /// Second pass: Everyone passes 3 tiles ACROSS
    FirstAcross,

    /// Third pass: Everyone passes 3 tiles LEFT
    /// Note: Blind pass/steal option available here
    FirstLeft,

    // ===== DECISION POINT =====

    /// All players vote: Continue to Second Charleston or stop?
    /// If ANY player votes "stop", move to CourtesyAcross
    /// If ALL players vote "continue", move to SecondLeft
    VotingToContinue,

    // ===== SECOND CHARLESTON (Optional - requires unanimous vote) =====

    /// Fourth pass: Everyone passes 3 tiles LEFT (reverse direction)
    SecondLeft,

    /// Fifth pass: Everyone passes 3 tiles ACROSS
    SecondAcross,

    /// Sixth pass: Everyone passes 3 tiles RIGHT
    /// Note: Blind pass/steal option available here
    SecondRight,

    // ===== COURTESY PASS (Optional) =====

    /// Across partners negotiate passing 0-3 tiles
    /// East-West negotiate independently of North-South
    CourtesyAcross,

    /// Charleston is complete, transitioning to main game
    Complete,
}

impl CharlestonStage {
    /// Get the direction tiles are being passed
    pub fn pass_direction(&self) -> Option<PassDirection> {
        match self {
            Self::FirstRight | Self::SecondRight => Some(PassDirection::Right),
            Self::FirstAcross | Self::SecondAcross => Some(PassDirection::Across),
            Self::FirstLeft | Self::SecondLeft => Some(PassDirection::Left),
            Self::CourtesyAcross => Some(PassDirection::Across),
            Self::VotingToContinue | Self::Complete => None,
        }
    }

    /// Can players do a blind pass/steal on this stage?
    pub fn allows_blind_pass(&self) -> bool {
        matches!(self, Self::FirstLeft | Self::SecondRight)
    }

    /// Is this the courtesy pass (different rules)?
    pub fn is_courtesy_pass(&self) -> bool {
        matches!(self, Self::CourtesyAcross)
    }

    /// Get the next stage after this one completes
    pub fn next(&self, vote_result: Option<CharlestonVote>) -> Result<Self, StateError> {
        match self {
            Self::FirstRight => Ok(Self::FirstAcross),
            Self::FirstAcross => Ok(Self::FirstLeft),
            Self::FirstLeft => Ok(Self::VotingToContinue),

            Self::VotingToContinue => {
                match vote_result {
                    Some(CharlestonVote::Continue) => Ok(Self::SecondLeft),
                    Some(CharlestonVote::Stop) => Ok(Self::CourtesyAcross),
                    None => Err(StateError::MissingVoteResult),
                }
            }

            Self::SecondLeft => Ok(Self::SecondAcross),
            Self::SecondAcross => Ok(Self::SecondRight),
            Self::SecondRight => Ok(Self::CourtesyAcross),

            Self::CourtesyAcross => Ok(Self::Complete),
            Self::Complete => Err(StateError::CharlestonAlreadyComplete),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PassDirection {
    Right,
    Across,
    Left,
}

impl PassDirection {
    /// Get the target seat for a pass from a given seat
    pub fn target_from(&self, from: Seat) -> Seat {
        match self {
            PassDirection::Right => from.right(),
            PassDirection::Across => from.across(),
            PassDirection::Left => from.left(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CharlestonVote {
    Continue, // Do the optional Second Charleston
    Stop,     // Skip to Courtesy Pass
}

/// Tracks Charleston state for all players
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharlestonState {
    /// Current stage of the Charleston
    pub stage: CharlestonStage,

    /// Tiles selected by each player for the current pass
    /// None means they haven't selected yet
    pub pending_passes: HashMap<Seat, Option<Vec<Tile>>>,

    /// Votes for continuing to Second Charleston
    /// Only populated during VotingToContinue stage
    pub votes: HashMap<Seat, CharlestonVote>,

    /// Timer for the current pass (seconds remaining)
    pub timer: Option<u32>,
}

impl CharlestonState {
    /// Check if all players have submitted their tiles for this pass
    pub fn all_players_ready(&self) -> bool {
        self.pending_passes.values().all(|tiles| tiles.is_some())
    }

    /// Check if voting is complete
    pub fn voting_complete(&self) -> bool {
        self.stage == CharlestonStage::VotingToContinue
            && self.votes.len() == 4
    }

    /// Get the vote result (Continue only if unanimous)
    pub fn vote_result(&self) -> Option<CharlestonVote> {
        if !self.voting_complete() {
            return None;
        }

        // If ANY player votes Stop, the result is Stop
        if self.votes.values().any(|v| *v == CharlestonVote::Stop) {
            Some(CharlestonVote::Stop)
        } else {
            Some(CharlestonVote::Continue)
        }
    }
}
```

---

## 4.3 Turn Stage (Main Game Loop)

Once the Charleston is complete, the game enters the draw-discard loop.

```rust
/// Turn sub-phases during main gameplay
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum TurnStage {
    /// Current player needs to draw a tile from the wall
    /// (East starts with 14 tiles, so skips this on first turn)
    Drawing { player: Seat },

    /// Current player has drawn and must now discard or declare Mahjong
    Discarding { player: Seat },

    /// A tile was just discarded - other players can call it or pass
    CallWindow {
        /// The tile that was just discarded
        tile: Tile,

        /// Who discarded it
        discarded_by: Seat,

        /// Players who can still act (haven't passed yet)
        /// As players pass, they're removed from this set
        can_act: HashSet<Seat>,

        /// Timer for the call window (typically 5-10 seconds)
        timer: u32,
    },
}

impl TurnStage {
    /// Get the player whose turn it is (for Drawing/Discarding)
    pub fn active_player(&self) -> Option<Seat> {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => Some(*player),
            Self::CallWindow { .. } => None, // Multiple players can act
        }
    }

    /// Check if a specific player can take an action right now
    pub fn can_player_act(&self, seat: Seat) -> bool {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => *player == seat,
            Self::CallWindow { can_act, discarded_by, .. } => {
                // Can't call your own discard
                seat != *discarded_by && can_act.contains(&seat)
            }
        }
    }

    /// Transition to the next stage
    pub fn next(
        &self,
        action: TurnAction,
        current_turn: Seat,
    ) -> Result<(Self, Seat), StateError> {
        match (self, action) {
            // Drew a tile → Now must discard
            (Self::Drawing { player }, TurnAction::Draw) => {
                Ok((Self::Discarding { player: *player }, current_turn))
            }

            // Discarded a tile → Open call window for others
            (Self::Discarding { player }, TurnAction::Discard(tile)) => {
                let mut can_act = HashSet::new();
                can_act.insert(player.right());
                can_act.insert(player.across());
                can_act.insert(player.left());

                Ok((
                    Self::CallWindow {
                        tile,
                        discarded_by: *player,
                        can_act,
                        timer: 10, // Default 10 second window
                    },
                    current_turn,
                ))
            }

            // Player called the discard → They become active player
            (Self::CallWindow { discarded_by, .. }, TurnAction::Call(caller)) => {
                // Caller gets the tile and must now discard
                Ok((Self::Discarding { player: caller }, caller))
            }

            // All players passed → Next player draws
            (Self::CallWindow { .. }, TurnAction::AllPassed) => {
                let next_player = current_turn.right();
                Ok((Self::Drawing { player: next_player }, next_player))
            }

            _ => Err(StateError::InvalidActionForStage),
        }
    }
}

/// Actions that can happen during a turn
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TurnAction {
    Draw,
    Discard(Tile),
    Call(Seat), // Who called
    AllPassed,
}
```

---

## 4.4 State Transition Rules

Here's how the top-level `GamePhase` transitions:

```rust
impl GamePhase {
    /// Attempt to transition to the next phase
    pub fn transition(&self, trigger: PhaseTrigger) -> Result<Self, StateError> {
        match (self, trigger) {
            // Players joined → Start setup
            (Self::WaitingForPlayers, PhaseTrigger::AllPlayersJoined) => {
                Ok(Self::Setup(SetupStage::RollingDice))
            }

            // Setup stages progress sequentially
            (Self::Setup(SetupStage::RollingDice), PhaseTrigger::DiceRolled) => {
                Ok(Self::Setup(SetupStage::BreakingWall))
            }
            (Self::Setup(SetupStage::BreakingWall), PhaseTrigger::WallBroken) => {
                Ok(Self::Setup(SetupStage::Dealing))
            }
            (Self::Setup(SetupStage::Dealing), PhaseTrigger::TilesDealt) => {
                Ok(Self::Setup(SetupStage::OrganizingHands))
            }
            (Self::Setup(SetupStage::OrganizingHands), PhaseTrigger::HandsOrganized) => {
                Ok(Self::Charleston(CharlestonStage::FirstRight))
            }

            // Charleston → Main game (East starts by discarding)
            (Self::Charleston(_), PhaseTrigger::CharlestonComplete) => {
                Ok(Self::Playing(TurnStage::Discarding { player: Seat::East }))
            }

            // Someone declared Mahjong → Validate
            (Self::Playing(_), PhaseTrigger::MahjongDeclared(ctx)) => {
                Ok(Self::Scoring(ctx))
            }

            // Validation complete → Show results
            (Self::Scoring(_), PhaseTrigger::ValidationComplete(result)) => {
                Ok(Self::GameOver(result))
            }

            // Wall exhausted (no winner)
            (Self::Playing(_), PhaseTrigger::WallExhausted) => {
                Ok(Self::GameOver(GameResult {
                    winner: Seat::East, // Placeholder - need to handle draws
                    winning_pattern: "No Winner".to_string(),
                    points: 0,
                    final_hands: HashMap::new(),
                }))
            }

            _ => Err(StateError::InvalidTransition),
        }
    }
}

/// Events that trigger phase transitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PhaseTrigger {
    AllPlayersJoined,
    DiceRolled,
    WallBroken,
    TilesDealt,
    HandsOrganized,
    CharlestonComplete,
    MahjongDeclared(WinContext),
    ValidationComplete(GameResult),
    WallExhausted,
}
```

---

## 4.5 Error Handling

```rust
/// Errors that occur during state transitions
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StateError {
    /// Tried to transition in an invalid way
    InvalidTransition,

    /// Action is not allowed in the current stage
    InvalidActionForStage,

    /// Player tried to act when it's not their turn
    NotYourTurn,

    /// Charleston is already complete
    CharlestonAlreadyComplete,

    /// Vote result was needed but not provided
    MissingVoteResult,

    /// Player tried to call their own discard
    CannotCallOwnDiscard,
}
```

---

## 4.6 Example: Charleston Flow

Here's a concrete example of how the Charleston state machine works:

```rust
// Start the Charleston
let mut charleston = CharlestonState {
    stage: CharlestonStage::FirstRight,
    pending_passes: HashMap::from([
        (Seat::East, None),
        (Seat::South, None),
        (Seat::West, None),
        (Seat::North, None),
    ]),
    votes: HashMap::new(),
    timer: Some(60),
};

// Player East selects 3 tiles to pass right
charleston.pending_passes.insert(
    Seat::East,
    Some(vec![
        Tile::new_number(Suit::Dots, 1).unwrap(),
        Tile::new_number(Suit::Dots, 2).unwrap(),
        Tile::new_number(Suit::Dots, 3).unwrap(),
    ])
);

// ... other players select ...

if charleston.all_players_ready() {
    // Execute the pass (swap tiles between players)
    // Then advance to next stage
    charleston.stage = charleston.stage.next(None)?;
    charleston.pending_passes.clear();
}

// After FirstLeft, move to voting
charleston.stage = CharlestonStage::VotingToContinue;

// Players vote
charleston.votes.insert(Seat::East, CharlestonVote::Continue);
charleston.votes.insert(Seat::South, CharlestonVote::Stop);
// ... others vote ...

if charleston.voting_complete() {
    let result = charleston.vote_result().unwrap();
    charleston.stage = charleston.stage.next(Some(result))?;
    // If any player voted Stop, stage is now CourtesyAcross
    // If all voted Continue, stage is now SecondLeft
}
```

---

## 4.7 Design Principles

1. **Explicit States**: Every possible game state is represented by the type system
2. **Impossible States Impossible**: Can't discard during Charleston, can't vote during main game
3. **Clear Transitions**: Each state knows its valid next states
4. **Validation at Edges**: Actions are validated before state changes occur
5. **Serializable**: All states can be sent over the network for client sync
