//! Table state and command dispatch for a single Mahjong game.

mod bot;
pub mod handlers;
pub mod replay;
mod snapshot;
#[cfg(test)]
mod tests;
pub mod types;
mod validation;

pub use types::*;
// Re-export GameStateSnapshot directly from the crate root source
pub use crate::snapshot::GameStateSnapshot;

use crate::{
    command::GameCommand,
    deck::Wall,
    event::GameEvent,
    flow::charleston::CharlestonState,
    player::{Player, Seat},
    rules::validator::HandValidator,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// The game table holding all state for a single American Mahjong game.
///
/// # Examples
/// ```
/// use mahjong_core::table::Table;
///
/// let table = Table::new("game-1".to_string(), 42);
/// assert_eq!(table.game_id, "game-1");
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    /// Unique game identifier.
    pub game_id: String,
    /// Players mapped by seat.
    pub players: HashMap<Seat, Player>,
    /// Wall state used for draws.
    pub wall: Wall,
    /// Ordered discard pile.
    pub discard_pile: Vec<DiscardedTile>,
    /// Current game phase.
    pub phase: GamePhase,
    /// Current turn seat.
    pub current_turn: Seat,
    /// Current dealer seat.
    pub dealer: Seat,
    /// Round counter (1-based).
    pub round_number: u32,
    /// Configured ruleset and house rules.
    pub house_rules: HouseRules,
    /// Charleston state, if currently in Charleston.
    pub charleston_state: Option<CharlestonState>,
    /// Turn counter incremented each time a new player starts their turn.
    /// Useful for undo/restore support and AI decision-making (early/mid/late game).
    pub turn_number: u32,
    /// Optional validator for hand analysis and win checking.
    #[serde(skip)]
    pub validator: Option<HandValidator>,

    // Track which players have marked ready during OrganizingHands
    pub(crate) ready_players: HashSet<Seat>,
}

impl Table {
    // ========================================================================
    // Construction
    // ========================================================================

    /// Create a new game table with standard house rules.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::Table;
    ///
    /// let table = Table::new("game-2".to_string(), 7);
    /// assert_eq!(table.round_number, 1);
    /// ```
    #[must_use]
    pub fn new(game_id: String, seed: u64) -> Self {
        Self::new_with_rules(game_id, seed, HouseRules::default())
    }

    /// Create a new game table with custom house rules.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{HouseRules, Table};
    ///
    /// let rules = HouseRules::default();
    /// let table = Table::new_with_rules("game-3".to_string(), 3, rules);
    /// assert_eq!(table.current_turn, mahjong_core::player::Seat::East);
    /// ```
    #[must_use]
    pub fn new_with_rules(game_id: String, seed: u64, rules: HouseRules) -> Self {
        // Create wall with seed (will break wall on dice roll)
        let wall = Wall::from_deck_with_seed(seed, 0);

        Table {
            game_id,
            players: HashMap::new(),
            wall,
            discard_pile: Vec::new(),
            phase: GamePhase::WaitingForPlayers,
            current_turn: Seat::East,
            dealer: Seat::East,
            round_number: 1,
            house_rules: rules,
            charleston_state: None,
            turn_number: 0,
            validator: None,
            ready_players: HashSet::new(),
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /// Get a player by seat.
    #[must_use]
    pub fn get_player(&self, seat: Seat) -> Option<&Player> {
        self.players.get(&seat)
    }

    /// Get a mutable reference to a player by seat.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::Table;
    /// use mahjong_core::player::Seat;
    ///
    /// let mut table = Table::new("game-4".to_string(), 1);
    /// assert!(table.get_player_mut(Seat::East).is_none());
    /// ```
    pub fn get_player_mut(&mut self, seat: Seat) -> Option<&mut Player> {
        self.players.get_mut(&seat)
    }

    /// Check if it's a specific player's turn.
    #[must_use]
    pub fn is_player_turn(&self, seat: Seat) -> bool {
        self.current_turn == seat
    }

    /// Attach a hand validator for Mahjong validation.
    pub fn set_validator(&mut self, validator: HandValidator) {
        self.validator = Some(validator);
    }

    /// Advance to the next player's turn.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::player::Seat;
    /// use mahjong_core::table::Table;
    ///
    /// let mut table = Table::new("game-5".to_string(), 0);
    /// assert_eq!(table.advance_turn(), Seat::South);
    /// ```
    pub fn advance_turn(&mut self) -> Seat {
        self.current_turn = self.current_turn.right();
        self.current_turn
    }

    /// Transition to a new game phase.
    ///
    /// # Errors
    ///
    /// Returns `CommandError::WrongPhase` if the transition is not valid for the current phase.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{CommandError, Table};
    /// use mahjong_core::flow::{GamePhase, PhaseTrigger, SetupStage};
    ///
    /// let mut table = Table::new("game-6".to_string(), 0);
    /// table.transition_phase(PhaseTrigger::AllPlayersJoined).unwrap();
    /// assert_eq!(table.phase, GamePhase::Setup(SetupStage::RollingDice));
    /// ```
    pub fn transition_phase(&mut self, trigger: PhaseTrigger) -> Result<(), CommandError> {
        self.phase = self
            .phase
            .transition(trigger)
            .map_err(|_| CommandError::WrongPhase)?;
        Ok(())
    }

    // ========================================================================
    // Command Processing (Main Entry Point)
    // ========================================================================

    /// Process a command and return events to broadcast.
    ///
    /// This is the ONLY way to mutate game state.
    /// Returns a list of events that the server should emit.
    ///
    /// # Errors
    ///
    /// Returns various `CommandError` variants if the command is invalid for the current game state,
    /// such as wrong phase, not player's turn, invalid tile operations, etc.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::command::GameCommand;
    /// use mahjong_core::player::{Player, Seat};
    /// use mahjong_core::table::Table;
    ///
    /// let mut table = Table::new("game-7".to_string(), 1);
    /// let player = Player::new("Player1".to_string(), Seat::East, false);
    /// table.players.insert(Seat::East, player);
    /// let result = table.process_command(GameCommand::RequestState { player: Seat::East });
    /// assert!(result.is_ok());
    /// ```
    pub fn process_command(&mut self, cmd: GameCommand) -> Result<Vec<GameEvent>, CommandError> {
        // Validate the command is legal
        validation::validate(self, &cmd)?;

        // Apply the command and generate events
        match cmd {
            GameCommand::RollDice { player } => Ok(handlers::setup::roll_dice(self, player)),
            GameCommand::ReadyToStart { player } => {
                Ok(handlers::setup::ready_to_start(self, player))
            }

            GameCommand::PassTiles {
                player,
                tiles,
                blind_pass_count,
            } => Ok(handlers::charleston::pass_tiles(
                self,
                player,
                &tiles,
                blind_pass_count,
            )),
            GameCommand::VoteCharleston { player, vote } => {
                Ok(handlers::charleston::vote_charleston(self, player, vote))
            }
            GameCommand::ProposeCourtesyPass { player, tile_count } => Ok(
                handlers::charleston::propose_courtesy_pass(self, player, tile_count),
            ),
            GameCommand::AcceptCourtesyPass { player, tiles } => Ok(
                handlers::charleston::accept_courtesy_pass(self, player, tiles),
            ),

            GameCommand::DrawTile { player } => Ok(handlers::playing::draw_tile(self, player)),
            GameCommand::DiscardTile { player, tile } => {
                Ok(handlers::playing::discard_tile(self, player, tile))
            }
            GameCommand::DeclareCallIntent { player, intent } => {
                Ok(handlers::playing::declare_call_intent(self, player, intent))
            }
            GameCommand::Pass { player } => Ok(handlers::playing::pass(self, player)),

            GameCommand::DeclareMahjong {
                player,
                hand,
                winning_tile,
            } => Ok(handlers::win::declare_mahjong(
                self,
                player,
                hand,
                winning_tile,
            )),
            GameCommand::ExchangeJoker {
                player,
                target_seat,
                meld_index,
                replacement,
            } => Ok(handlers::win::exchange_joker(
                self,
                player,
                target_seat,
                meld_index,
                replacement,
            )),
            GameCommand::ExchangeBlank {
                player,
                discard_index,
            } => Ok(handlers::win::exchange_blank(self, player, discard_index)),
            GameCommand::AbandonGame { player, reason } => {
                Ok(handlers::win::abandon_game(self, player, reason))
            }

            GameCommand::RequestState { .. }
            | GameCommand::GetAnalysis { .. }
            | GameCommand::RequestHint { .. }
            | GameCommand::SetHintVerbosity { .. } => Ok(vec![]),
            GameCommand::RequestHistory { .. }
            | GameCommand::JumpToMove { .. }
            | GameCommand::ResumeFromHistory { .. }
            | GameCommand::ReturnToPresent { .. }
            | GameCommand::PauseGame { .. }
            | GameCommand::ResumeGame { .. }
            | GameCommand::ForfeitGame { .. } => {
                // ForfeitGame is handled entirely in the server layer (commands.rs)
                // It doesn't modify table state directly; the server creates GameOver events
                Ok(vec![])
            }
            GameCommand::LeaveGame { player } => {
                if let Some(p) = self.get_player_mut(player) {
                    p.status = crate::player::PlayerStatus::Disconnected;
                }
                Ok(vec![])
            }
        }
    }

    /// Generate a state snapshot for a specific player (for reconnection).
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::player::Seat;
    /// use mahjong_core::table::Table;
    ///
    /// let table = Table::new("game-8".to_string(), 9);
    /// let snapshot = table.create_snapshot(Seat::East);
    /// let _ = snapshot;
    /// ```
    pub fn create_snapshot(&self, requesting_seat: Seat) -> GameStateSnapshot {
        snapshot::create_snapshot(self, requesting_seat)
    }

    /// Generate a full state snapshot for server persistence (includes all hands).
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::table::Table;
    ///
    /// let table = Table::new("game-9".to_string(), 9);
    /// let snapshot = table.create_full_snapshot();
    /// let _ = snapshot;
    /// ```
    pub fn create_full_snapshot(&self) -> GameStateSnapshot {
        snapshot::create_full_snapshot(self)
    }

    /// Restore table from a snapshot (for replay/undo).
    ///
    /// # Examples
    /// ```no_run
    /// use mahjong_core::rules::validator::HandValidator;
    /// use mahjong_core::table::Table;
    ///
    /// fn restore(table: Table, validator: HandValidator) -> Table {
    ///     let snapshot = table.create_full_snapshot();
    ///     Table::from_snapshot(snapshot, validator)
    /// }
    /// ```
    pub fn from_snapshot(snapshot: GameStateSnapshot, validator: HandValidator) -> Self {
        // Reconstruct wall from seed
        let mut wall =
            Wall::from_seed_with_break(snapshot.wall_seed, snapshot.wall_break_point as usize);

        // Fast-forward wall state (draw tiles that were already drawn)
        for _ in 0..snapshot.wall_draw_index {
            wall.draw();
        }

        // Reconstruct players
        let mut players = HashMap::new();
        for p_info in &snapshot.players {
            let mut hand = crate::hand::Hand::empty();
            hand.exposed = p_info.exposed_melds.clone();

            // Reconstruct concealed hand
            // 1. If all_player_hands exists (full snapshot), use it.
            // 2. Else if this is the viewer (your_seat), use your_hand.
            // 3. Otherwise, hand remains empty (must be reconstructed from events if replaying).
            if let Some(all_hands) = &snapshot.all_player_hands {
                if let Some(concealed) = all_hands.get(&p_info.seat) {
                    for tile in concealed {
                        hand.add_tile(*tile);
                    }
                }
            } else if p_info.seat == snapshot.your_seat {
                for tile in &snapshot.your_hand {
                    hand.add_tile(*tile);
                }
            }

            let player = Player {
                id: p_info.player_id.clone(),
                seat: p_info.seat,
                is_bot: p_info.is_bot,
                hand,
                status: p_info.status,
            };
            players.insert(p_info.seat, player);
        }

        let discard_pile = snapshot
            .discard_pile
            .iter()
            .map(|d| DiscardedTile {
                tile: d.tile,
                discarded_by: d.discarded_by,
            })
            .collect();

        Table {
            game_id: snapshot.game_id,
            players,
            wall,
            discard_pile,
            phase: snapshot.phase,
            current_turn: snapshot.current_turn,
            dealer: snapshot.dealer,
            round_number: snapshot.round_number,
            house_rules: snapshot.house_rules,
            charleston_state: snapshot.charleston_state,
            turn_number: snapshot.turn_number,
            validator: Some(validator),
            ready_players: HashSet::new(),
        }
    }

    /// Get the appropriate command for a bot to execute in the current game state.
    #[must_use]
    pub fn get_bot_command(&self, seat: Seat, bot: &crate::bot::BasicBot) -> Option<GameCommand> {
        bot::get_bot_command(self, seat, bot)
    }
}
