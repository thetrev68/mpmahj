//! Main game state and command processing for American Mahjong.
//!
//! The Table struct is the central coordinator that:
//! - Holds canonical game state (players, wall, phase, turn order)
//! - Validates commands against current state
//! - Applies commands and generates events
//! - Enforces state machine transitions
//!
//! All mutations happen through `process_command()`, which returns events for
//! the server to broadcast to clients.

use crate::{
    command::GameCommand,
    deck::Wall,
    event::GameEvent,
    flow::{
        CharlestonStage, CharlestonState, CharlestonVote, GamePhase, PhaseTrigger, SetupStage,
        TurnAction, TurnStage, WinContext, WinType,
    },
    hand::Hand,
    meld::Meld,
    player::{Player, PlayerStatus, Seat},
    rules::validator::HandValidator,
    tile::Tile,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use thiserror::Error;
use ts_rs::TS;

// ============================================================================
// Supporting Types
// ============================================================================

/// Timer behavior mode for call windows and Charleston.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TimerMode {
    /// Timer is visible to players but does not enforce actions (visual indicator only).
    Visible,
    /// Timer is not shown to players (no time pressure).
    Hidden,
}

/// Complete ruleset configuration for a game.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Ruleset {
    /// NMJL card year (e.g., 2025).
    pub card_year: u16,

    /// Timer behavior configuration.
    pub timer_mode: TimerMode,

    /// Allow blank tile exchange from discard pile.
    pub blank_exchange_enabled: bool,

    /// Call window duration in seconds.
    pub call_window_seconds: u32,

    /// Charleston pass timer in seconds.
    pub charleston_timer_seconds: u32,
}

impl Default for Ruleset {
    fn default() -> Self {
        Self {
            card_year: 2025,
            timer_mode: TimerMode::Visible,
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 60,
        }
    }
}

/// House rules that modify game behavior. Contains the complete ruleset configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HouseRules {
    /// The ruleset configuration.
    pub ruleset: Ruleset,
}

impl HouseRules {
    /// Create with a specific card year (uses defaults for other settings).
    pub fn with_card_year(card_year: u16) -> Self {
        Self {
            ruleset: Ruleset {
                card_year,
                ..Ruleset::default()
            },
        }
    }

    /// Create with custom ruleset.
    pub fn with_ruleset(ruleset: Ruleset) -> Self {
        Self { ruleset }
    }
}

/// A discarded tile with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct DiscardedTile {
    pub tile: Tile,
    pub discarded_by: Seat,
}

/// Errors that occur during command validation/processing.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CommandError {
    #[error("Command not valid for current phase")]
    WrongPhase,

    #[error("Not your turn")]
    NotYourTurn,

    #[error("Tile not in hand")]
    TileNotInHand,

    #[error("Invalid meld")]
    InvalidMeld,

    #[error("Wall exhausted")]
    WallExhausted,

    #[error("Invalid tile count for pass (expected 3 total)")]
    InvalidPassCount,

    #[error("Cannot pass Jokers during Charleston")]
    ContainsJokers,

    #[error("Blank exchange is not enabled")]
    BlankExchangeNotEnabled,

    #[error("Player not found")]
    PlayerNotFound,

    #[error("Cannot call your own discard")]
    CannotCallOwnDiscard,

    #[error("No discard to call")]
    NoDiscardToCall,

    #[error("Player already voted")]
    AlreadyVoted,

    #[error("Invalid discard index")]
    InvalidDiscardIndex,

    #[error("Meld does not contain a Joker")]
    MeldHasNoJoker,

    #[error("Replacement tile does not match Joker assignment")]
    InvalidReplacement,

    #[error("Target player not found")]
    TargetNotFound,

    #[error("Meld index out of bounds")]
    MeldIndexOutOfBounds,

    #[error("Player has no Blank tile")]
    NoBlankInHand,

    #[error("Call window has no active tile")]
    NoActiveCallWindow,

    #[error("Player cannot act in this call window")]
    CannotActInCallWindow,

    #[error("Blind pass not allowed in this stage")]
    BlindPassNotAllowed,

    #[error("Only East can roll dice")]
    OnlyEastCanRoll,

    #[error("All players have already marked ready")]
    AllPlayersReady,

    #[error("Player has already marked ready")]
    AlreadyReady,

    #[error("Courtesy pass requires 0-3 tiles")]
    InvalidCourtesyPassCount,

    #[error("Not in courtesy pass stage")]
    NotInCourtesyPass,

    #[error("Cannot pass tiles to non-across partner in courtesy pass")]
    CourtesyPassOnlyAcross,
}

// ============================================================================
// Main Table Struct
// ============================================================================

/// The game table holding all state for a single American Mahjong game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub game_id: String,
    pub players: HashMap<Seat, Player>,
    pub wall: Wall,
    pub discard_pile: Vec<DiscardedTile>,
    pub phase: GamePhase,
    pub current_turn: Seat,
    pub dealer: Seat,
    pub round_number: u32,
    pub house_rules: HouseRules,
    pub charleston_state: Option<CharlestonState>,
    #[serde(skip)]
    pub validator: Option<HandValidator>,

    // Track which players have marked ready during OrganizingHands
    ready_players: HashSet<Seat>,
}

impl Table {
    // ========================================================================
    // Construction
    // ========================================================================

    /// Create a new game table with standard house rules.
    #[must_use]
    pub fn new(game_id: String, seed: u64) -> Self {
        Self::new_with_rules(game_id, seed, HouseRules::default())
    }

    /// Create a new game table with custom house rules.
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
    pub fn advance_turn(&mut self) -> Seat {
        self.current_turn = self.current_turn.right();
        self.current_turn
    }

    /// Transition to a new game phase.
    ///
    /// # Errors
    ///
    /// Returns `CommandError::WrongPhase` if the transition is not valid for the current phase.
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
    pub fn process_command(&mut self, cmd: GameCommand) -> Result<Vec<GameEvent>, CommandError> {
        // Validate the command is legal
        self.validate_command(&cmd)?;

        // Apply the command and generate events
        let events = match cmd {
            GameCommand::RollDice { player } => self.apply_roll_dice(player),
            GameCommand::ReadyToStart { player } => self.apply_ready_to_start(player),
            GameCommand::PassTiles {
                player,
                tiles,
                blind_pass_count,
            } => self.apply_pass_tiles(player, &tiles, blind_pass_count),
            GameCommand::VoteCharleston { player, vote } => {
                self.apply_vote_charleston(player, vote)
            }
            GameCommand::ProposeCourtesyPass { player, tile_count } => {
                self.apply_propose_courtesy_pass(player, tile_count)
            }
            GameCommand::AcceptCourtesyPass { player, tiles } => {
                self.apply_accept_courtesy_pass(player, tiles)
            }
            GameCommand::DrawTile { player } => self.apply_draw_tile(player),
            GameCommand::DiscardTile { player, tile } => self.apply_discard_tile(player, tile),
            GameCommand::DeclareCallIntent { player, intent } => {
                self.apply_declare_call_intent(player, intent.clone())
            }
            GameCommand::CallTile { player, meld } => self.apply_call_tile(player, meld),
            GameCommand::Pass { player } => self.apply_pass(player),
            GameCommand::DeclareMahjong {
                player,
                hand,
                winning_tile,
            } => self.apply_declare_mahjong(player, hand, winning_tile),
            GameCommand::ExchangeJoker {
                player,
                target_seat,
                meld_index,
                replacement,
            } => self.apply_exchange_joker(player, target_seat, meld_index, replacement),
            GameCommand::ExchangeBlank {
                player,
                discard_index,
            } => self.apply_exchange_blank(player, discard_index),
            GameCommand::RequestState { .. } => {
                // RequestState doesn't mutate state, just returns current state
                // The server will handle responding with current state
                vec![]
            }
            GameCommand::LeaveGame { player } => {
                // Mark player as disconnected
                if let Some(p) = self.get_player_mut(player) {
                    p.status = PlayerStatus::Disconnected;
                }
                vec![]
            }
            GameCommand::AbandonGame { player, reason } => self.apply_abandon_game(player, reason),
        };

        Ok(events)
    }

    // ========================================================================
    // Command Validation
    // ========================================================================

    fn validate_command(&self, cmd: &GameCommand) -> Result<(), CommandError> {
        let player = cmd.player();

        // Check player exists and can act
        let player_obj = self
            .get_player(player)
            .ok_or(CommandError::PlayerNotFound)?;
        if !player_obj.can_act() && !matches!(cmd, GameCommand::LeaveGame { .. }) {
            return Err(CommandError::PlayerNotFound);
        }

        // Validate based on command type
        match cmd {
            GameCommand::RollDice { player } => {
                if !matches!(self.phase, GamePhase::Setup(SetupStage::RollingDice)) {
                    return Err(CommandError::WrongPhase);
                }
                if *player != Seat::East {
                    return Err(CommandError::OnlyEastCanRoll);
                }
            }

            GameCommand::ReadyToStart { player } => {
                if !matches!(self.phase, GamePhase::Setup(SetupStage::OrganizingHands)) {
                    return Err(CommandError::WrongPhase);
                }
                if self.ready_players.contains(player) {
                    return Err(CommandError::AlreadyReady);
                }
            }

            GameCommand::PassTiles {
                tiles,
                blind_pass_count,
                ..
            } => {
                if let GamePhase::Charleston(_) = self.phase {
                    // Validate tile count
                    if !cmd.validate_pass_tile_count() {
                        return Err(CommandError::InvalidPassCount);
                    }
                    // Validate no Jokers
                    if cmd.contains_jokers() {
                        return Err(CommandError::ContainsJokers);
                    }
                    // Validate blind pass is allowed in this stage
                    if let Some(charleston) = &self.charleston_state {
                        if blind_pass_count.is_some() && !charleston.stage.allows_blind_pass() {
                            return Err(CommandError::BlindPassNotAllowed);
                        }
                    }
                    // Check player has the tiles
                    let player_obj = self.get_player(player).unwrap();
                    for tile in tiles {
                        if !player_obj.hand.has_tile(*tile) {
                            return Err(CommandError::TileNotInHand);
                        }
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::VoteCharleston { player, .. } => {
                if !matches!(
                    self.phase,
                    GamePhase::Charleston(CharlestonStage::VotingToContinue)
                ) {
                    return Err(CommandError::WrongPhase);
                }
                if let Some(charleston) = &self.charleston_state {
                    if charleston.votes.contains_key(player) {
                        return Err(CommandError::AlreadyVoted);
                    }
                }
            }

            GameCommand::ProposeCourtesyPass { tile_count, .. } => {
                if !matches!(
                    self.phase,
                    GamePhase::Charleston(CharlestonStage::CourtesyAcross)
                ) {
                    return Err(CommandError::NotInCourtesyPass);
                }
                if *tile_count > 3 {
                    return Err(CommandError::InvalidCourtesyPassCount);
                }
            }

            GameCommand::AcceptCourtesyPass { tiles, .. } => {
                if !matches!(
                    self.phase,
                    GamePhase::Charleston(CharlestonStage::CourtesyAcross)
                ) {
                    return Err(CommandError::NotInCourtesyPass);
                }
                if tiles.len() > 3 {
                    return Err(CommandError::InvalidCourtesyPassCount);
                }
                if cmd.contains_jokers() {
                    return Err(CommandError::ContainsJokers);
                }
                // Check player has the tiles
                let player_obj = self.get_player(player).unwrap();
                for tile in tiles {
                    if !player_obj.hand.has_tile(*tile) {
                        return Err(CommandError::TileNotInHand);
                    }
                }
            }

            GameCommand::DrawTile { player } => {
                if let GamePhase::Playing(TurnStage::Drawing { player: p }) = self.phase {
                    if *player != p {
                        return Err(CommandError::NotYourTurn);
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::DiscardTile { player, tile } => {
                if let GamePhase::Playing(TurnStage::Discarding { player: p }) = self.phase {
                    if *player != p {
                        return Err(CommandError::NotYourTurn);
                    }
                    let player_obj = self.get_player(*player).unwrap();
                    if !player_obj.hand.has_tile(*tile) {
                        return Err(CommandError::TileNotInHand);
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::CallTile { player, meld } => {
                if let GamePhase::Playing(TurnStage::CallWindow {
                    discarded_by,
                    can_act,
                    ..
                }) = &self.phase
                {
                    if player == discarded_by {
                        return Err(CommandError::CannotCallOwnDiscard);
                    }
                    if !can_act.contains(player) {
                        return Err(CommandError::CannotActInCallWindow);
                    }
                    // Validate meld is valid
                    if meld.validate().is_err() {
                        return Err(CommandError::InvalidMeld);
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::DeclareCallIntent { player, intent } => {
                if let GamePhase::Playing(TurnStage::CallWindow {
                    discarded_by,
                    can_act,
                    ..
                }) = &self.phase
                {
                    if player == discarded_by {
                        return Err(CommandError::CannotCallOwnDiscard);
                    }
                    if !can_act.contains(player) {
                        return Err(CommandError::CannotActInCallWindow);
                    }
                    // Validate intent based on kind
                    match intent {
                        crate::call_resolution::CallIntentKind::Meld(meld) => {
                            if meld.validate().is_err() {
                                return Err(CommandError::InvalidMeld);
                            }
                        }
                        crate::call_resolution::CallIntentKind::Mahjong => {
                            // Mahjong validation will happen during resolution
                            // Just check player can act
                        }
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::Pass { player } => {
                if let GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) = &self.phase {
                    if !can_act.contains(player) {
                        return Err(CommandError::CannotActInCallWindow);
                    }
                } else {
                    return Err(CommandError::WrongPhase);
                }
            }

            GameCommand::DeclareMahjong { player, .. } => {
                // Can declare during Discarding (self-draw) or CallWindow (calling for win)
                match &self.phase {
                    GamePhase::Playing(TurnStage::Discarding { player: p }) => {
                        if player != p {
                            return Err(CommandError::NotYourTurn);
                        }
                    }
                    GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) => {
                        if !can_act.contains(player) {
                            return Err(CommandError::CannotActInCallWindow);
                        }
                    }
                    _ => return Err(CommandError::WrongPhase),
                }
            }

            GameCommand::ExchangeJoker {
                target_seat,
                meld_index,
                replacement,
                ..
            } => {
                let target = self
                    .get_player(*target_seat)
                    .ok_or(CommandError::TargetNotFound)?;
                if *meld_index >= target.hand.exposed.len() {
                    return Err(CommandError::MeldIndexOutOfBounds);
                }
                let meld = &target.hand.exposed[*meld_index];
                // Check if meld has a joker
                let has_joker = meld.tiles.iter().any(|t| t.is_joker());
                if !has_joker {
                    return Err(CommandError::MeldHasNoJoker);
                }
                // Check player has replacement tile
                let player_obj = self.get_player(player).unwrap();
                if !player_obj.hand.has_tile(*replacement) {
                    return Err(CommandError::TileNotInHand);
                }
                if !meld.can_exchange_joker(*replacement) {
                    return Err(CommandError::InvalidReplacement);
                }
            }

            GameCommand::ExchangeBlank { discard_index, .. } => {
                if !self.house_rules.ruleset.blank_exchange_enabled {
                    return Err(CommandError::BlankExchangeNotEnabled);
                }
                if *discard_index >= self.discard_pile.len() {
                    return Err(CommandError::InvalidDiscardIndex);
                }
                // Check player has a Blank
                let player_obj = self.get_player(player).unwrap();
                if !player_obj.hand.concealed.iter().any(|t| t.is_blank()) {
                    return Err(CommandError::NoBlankInHand);
                }
            }

            GameCommand::RequestState { .. }
            | GameCommand::LeaveGame { .. }
            | GameCommand::AbandonGame { .. } => {
                // Always allowed
            }
        }

        Ok(())
    }

    // ========================================================================
    // Setup Phase Commands
    // ========================================================================

    fn apply_roll_dice(&mut self, _player: Seat) -> Vec<GameEvent> {
        // Roll two dice (2-12)
        #[allow(clippy::cast_possible_truncation)]
        let roll = (self.wall.total_tiles() % 11 + 2) as u8; // Simple deterministic roll, always in range 2-12

        // Break the wall at the rolled position
        self.wall = Wall::from_deck(crate::deck::Deck::new(), roll as usize);

        let mut events = vec![
            GameEvent::DiceRolled { roll },
            GameEvent::WallBroken {
                position: roll as usize,
            },
        ];

        // Transition: RollingDice -> BreakingWall -> Dealing
        let _ = self.transition_phase(PhaseTrigger::DiceRolled);
        let _ = self.transition_phase(PhaseTrigger::WallBroken);

        // Deal tiles
        if let Ok(hands) = self.wall.deal_initial() {
            // Assign hands to players
            for (idx, seat) in Seat::all().iter().enumerate() {
                if let Some(player) = self.get_player_mut(*seat) {
                    player.hand = Hand::new(hands[idx].clone());
                    player.status = PlayerStatus::Active;

                    // Emit private event for each player
                    events.push(GameEvent::TilesDealt {
                        your_tiles: hands[idx].clone(),
                    });
                }
            }

            // Transition: Dealing -> OrganizingHands
            let _ = self.transition_phase(PhaseTrigger::TilesDealt);
        }

        events
    }

    fn apply_ready_to_start(&mut self, player: Seat) -> Vec<GameEvent> {
        self.ready_players.insert(player);

        let mut events = vec![];

        // If all 4 players ready, start Charleston
        if self.ready_players.len() == 4 {
            // Transition to Charleston
            let _ = self.transition_phase(PhaseTrigger::HandsOrganized);

            // Initialize Charleston state
            self.charleston_state = Some(CharlestonState::new());

            events.push(GameEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::FirstRight,
            });
        }

        events
    }

    // ========================================================================
    // Charleston Phase Commands
    // ========================================================================

    fn apply_pass_tiles(
        &mut self,
        player: Seat,
        tiles: &[Tile],
        _blind_pass_count: Option<u8>,
    ) -> Vec<GameEvent> {
        let mut events = vec![];

        // Remove tiles from player's hand
        if let Some(p) = self.get_player_mut(player) {
            for &tile in tiles {
                let _ = p.hand.remove_tile(tile);
            }
        }

        // Mark player as ready in Charleston state and collect tile exchanges
        let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
        let mut should_advance = false;
        let mut next_stage = CharlestonStage::FirstRight;

        if let Some(charleston) = &mut self.charleston_state {
            charleston
                .pending_passes
                .insert(player, Some(tiles.to_vec()));

            events.push(GameEvent::PlayerReadyForPass { player });

            // If all players ready, collect exchanges
            if charleston.all_players_ready() {
                let direction = charleston.stage.pass_direction();
                events.push(GameEvent::TilesPassing {
                    direction: direction.unwrap(),
                });

                // Collect all tile exchanges to perform
                for seat in Seat::all() {
                    let target = direction.unwrap().target_from(seat);
                    if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
                        exchanges.push((target, tiles.clone()));
                    }
                }

                // Determine next stage
                next_stage = if charleston.stage == CharlestonStage::FirstLeft {
                    CharlestonStage::VotingToContinue
                } else if matches!(
                    charleston.stage,
                    CharlestonStage::FirstRight
                        | CharlestonStage::FirstAcross
                        | CharlestonStage::SecondLeft
                        | CharlestonStage::SecondAcross
                        | CharlestonStage::SecondRight
                ) {
                    charleston.stage.next(None).unwrap()
                } else {
                    charleston.stage
                };

                should_advance = true;
            }
        }

        // Execute tile exchanges (after dropping charleston borrow)
        for (target, tiles) in exchanges {
            if let Some(target_player) = self.get_player_mut(target) {
                for tile in &tiles {
                    target_player.hand.add_tile(*tile);
                }
                events.push(GameEvent::TilesReceived {
                    player: target,
                    tiles: tiles.clone(),
                });
            }
        }

        // Advance stage if needed
        if should_advance {
            if let Some(charleston) = &mut self.charleston_state {
                charleston.clear_pending_passes();
                charleston.stage = next_stage;
            }
            events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });
            self.phase = GamePhase::Charleston(next_stage);
        }

        events
    }

    fn apply_vote_charleston(&mut self, player: Seat, vote: CharlestonVote) -> Vec<GameEvent> {
        let mut events = vec![GameEvent::PlayerVoted { player }];

        if let Some(charleston) = &mut self.charleston_state {
            charleston.votes.insert(player, vote);

            // If all players voted, tally result and transition
            if charleston.voting_complete() {
                let result = charleston.vote_result().unwrap();
                events.push(GameEvent::VoteResult { result });

                // Clear votes
                charleston.votes.clear();

                // Transition to next stage based on vote
                let next_stage = charleston.stage.next(Some(result)).unwrap();
                charleston.stage = next_stage;
                self.phase = GamePhase::Charleston(next_stage);

                events.push(GameEvent::CharlestonPhaseChanged { stage: next_stage });
            }
        }

        events
    }

    #[allow(clippy::unused_self)]
    fn apply_propose_courtesy_pass(&mut self, _player: Seat, _tile_count: u8) -> Vec<GameEvent> {
        // This is a simplified implementation
        // In a full implementation, this would open negotiation with across partner
        vec![]
    }

    fn apply_accept_courtesy_pass(&mut self, player: Seat, tiles: Vec<Tile>) -> Vec<GameEvent> {
        let mut events = vec![];

        // Remove tiles from player's hand
        if let Some(p) = self.get_player_mut(player) {
            for tile in &tiles {
                let _ = p.hand.remove_tile(*tile);
            }
        }

        // Mark ready and collect tile exchanges
        let mut exchanges: Vec<(Seat, Vec<Tile>)> = Vec::new();
        let mut should_complete = false;

        if let Some(charleston) = &mut self.charleston_state {
            charleston.pending_passes.insert(player, Some(tiles));

            events.push(GameEvent::PlayerReadyForPass { player });

            // If all ready, collect exchanges
            if charleston.all_players_ready() {
                // Collect all tile exchanges to perform
                for seat in Seat::all() {
                    let target = seat.across();
                    if let Some(tiles) = charleston.pending_passes.get(&seat).unwrap() {
                        if !tiles.is_empty() {
                            exchanges.push((target, tiles.clone()));
                        }
                    }
                }
                should_complete = true;
            }
        }

        // Execute tile exchanges (after dropping charleston borrow)
        for (target, tiles) in exchanges {
            if let Some(target_player) = self.get_player_mut(target) {
                for tile in &tiles {
                    target_player.hand.add_tile(*tile);
                }
                events.push(GameEvent::TilesReceived {
                    player: target,
                    tiles: tiles.clone(),
                });
            }
        }

        // Complete Charleston if needed
        if should_complete {
            events.push(GameEvent::CharlestonComplete);
            let _ = self.transition_phase(PhaseTrigger::CharlestonComplete);
            self.charleston_state = None;
        }

        events
    }

    // ========================================================================
    // Main Game Commands
    // ========================================================================

    fn apply_draw_tile(&mut self, player: Seat) -> Vec<GameEvent> {
        let mut events = vec![];

        if let Some(tile) = self.wall.draw() {
            // Add tile to player's hand
            if let Some(p) = self.get_player_mut(player) {
                p.hand.add_tile(tile);
            }

            // Private event for drawer (includes tile)
            events.push(GameEvent::TileDrawn {
                tile: Some(tile),
                remaining_tiles: self.wall.remaining(),
            });

            // Public event for others (tile hidden)
            events.push(GameEvent::TileDrawn {
                tile: None,
                remaining_tiles: self.wall.remaining(),
            });

            // Transition to Discarding stage
            if let GamePhase::Playing(stage) = &self.phase {
                if let Ok((next_stage, next_turn)) = stage.next(TurnAction::Draw, self.current_turn)
                {
                    self.phase = GamePhase::Playing(next_stage.clone());
                    self.current_turn = next_turn;
                    events.push(GameEvent::TurnChanged {
                        player: next_turn,
                        stage: next_stage,
                    });
                }
            }
        } else {
            // Wall exhausted - game ends in a draw
            events.push(GameEvent::WallExhausted {
                remaining_tiles: self.wall.remaining(),
            });

            // Collect all final hands
            let all_hands: HashMap<Seat, Hand> = self
                .players
                .iter()
                .map(|(seat, p)| (*seat, p.hand.clone()))
                .collect();

            // Build draw result
            let game_result = crate::scoring::build_draw_result(all_hands, self.dealer);

            let _ = self.transition_phase(PhaseTrigger::WallExhausted(game_result.clone()));

            events.push(GameEvent::GameOver {
                winner: None,
                result: game_result,
            });
        }

        events
    }

    fn apply_discard_tile(&mut self, player: Seat, tile: Tile) -> Vec<GameEvent> {
        let mut events = vec![];

        // Remove tile from player's hand
        if let Some(p) = self.get_player_mut(player) {
            let _ = p.hand.remove_tile(tile);
        }

        // Add to discard pile
        self.discard_pile.push(DiscardedTile {
            tile,
            discarded_by: player,
        });

        events.push(GameEvent::TileDiscarded { player, tile });

        // Open call window
        if let GamePhase::Playing(stage) = &self.phase {
            if let Ok((next_stage, _)) = stage.next(TurnAction::Discard(tile), self.current_turn) {
                self.phase = GamePhase::Playing(next_stage.clone());

                // Emit call window event
                if let TurnStage::CallWindow {
                    tile,
                    discarded_by,
                    can_act,
                    ..
                } = &next_stage
                {
                    events.push(GameEvent::CallWindowOpened {
                        tile: *tile,
                        discarded_by: *discarded_by,
                        can_call: can_act.iter().copied().collect(),
                    });
                }
            }
        }

        events
    }

    fn apply_declare_call_intent(
        &mut self,
        player: Seat,
        intent: crate::call_resolution::CallIntentKind,
    ) -> Vec<GameEvent> {
        // Add intent to pending intents in CallWindow
        if let GamePhase::Playing(TurnStage::CallWindow {
            pending_intents,
            can_act,
            ..
        }) = &mut self.phase
        {
            // Get next sequence number
            let sequence = pending_intents.len() as u32;

            // Create and add the intent
            let call_intent = crate::call_resolution::CallIntent::new(player, intent, sequence);
            pending_intents.push(call_intent);

            // Remove player from can_act (they've declared their intent)
            can_act.remove(&player);

            // If all players have acted, resolve immediately
            if can_act.is_empty() {
                return self.resolve_call_window();
            }
        }

        vec![]
    }

    fn apply_call_tile(&mut self, player: Seat, meld: Meld) -> Vec<GameEvent> {
        let mut events = vec![];

        // Get the called tile (last discard)
        let called_tile = if let Some(last) = self.discard_pile.last() {
            last.tile
        } else {
            return vec![];
        };

        // Remove called tile from discard pile
        self.discard_pile.pop();

        // Add meld to player's exposed melds
        if let Some(p) = self.get_player_mut(player) {
            let _ = p.hand.expose_meld(meld.clone());
        }

        events.push(GameEvent::TileCalled {
            player,
            meld,
            called_tile,
        });

        // Transition to Discarding stage for caller
        if let GamePhase::Playing(stage) = &self.phase {
            if let Ok((next_stage, next_turn)) =
                stage.next(TurnAction::Call(player), self.current_turn)
            {
                self.phase = GamePhase::Playing(next_stage.clone());
                self.current_turn = next_turn;
                events.push(GameEvent::TurnChanged {
                    player: next_turn,
                    stage: next_stage,
                });
            }
        }

        events
    }

    fn apply_pass(&mut self, player: Seat) -> Vec<GameEvent> {
        // Remove player from can_act set
        if let GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) = &mut self.phase {
            can_act.remove(&player);

            // If all players passed or declared intent, resolve the call window
            if can_act.is_empty() {
                return self.resolve_call_window();
            }
        }

        vec![]
    }

    /// Resolve the call window by adjudicating pending intents.
    fn resolve_call_window(&mut self) -> Vec<GameEvent> {
        let mut events = vec![];

        if let GamePhase::Playing(TurnStage::CallWindow {
            pending_intents,
            discarded_by,
            tile,
            ..
        }) = &self.phase
        {
            let intents = pending_intents.clone();
            let discarded_by = *discarded_by;
            let tile = *tile;

            // Resolve using priority rules
            let resolution = crate::call_resolution::resolve_calls(&intents, discarded_by);

            events.push(GameEvent::CallResolved {
                resolution: resolution.clone(),
            });

            // Process the resolution
            match resolution {
                crate::call_resolution::CallResolution::NoCall => {
                    // No one called - advance to next player
                    events.push(GameEvent::CallWindowClosed);

                    if let GamePhase::Playing(stage) = &self.phase {
                        if let Ok((next_stage, next_turn)) =
                            stage.next(crate::flow::TurnAction::AllPassed, self.current_turn)
                        {
                            self.phase = GamePhase::Playing(next_stage.clone());
                            self.current_turn = next_turn;
                            events.push(GameEvent::TurnChanged {
                                player: next_turn,
                                stage: next_stage,
                            });
                        }
                    }
                }
                crate::call_resolution::CallResolution::Meld { seat, meld } => {
                    // Process the meld call
                    // Remove called tile from discard pile
                    if self.discard_pile.last().map(|d| d.tile) == Some(tile) {
                        self.discard_pile.pop();
                    }

                    // Add meld to player's exposed melds
                    if let Some(p) = self.get_player_mut(seat) {
                        let _ = p.hand.expose_meld(meld.clone());
                    }

                    events.push(GameEvent::TileCalled {
                        player: seat,
                        meld,
                        called_tile: tile,
                    });

                    // Transition to Discarding stage for caller
                    if let GamePhase::Playing(stage) = &self.phase {
                        if let Ok((next_stage, next_turn)) =
                            stage.next(crate::flow::TurnAction::Call(seat), self.current_turn)
                        {
                            self.phase = GamePhase::Playing(next_stage.clone());
                            self.current_turn = next_turn;
                            events.push(GameEvent::TurnChanged {
                                player: next_turn,
                                stage: next_stage,
                            });
                        }
                    }
                }
                crate::call_resolution::CallResolution::Mahjong(seat) => {
                    // Mahjong declared - transition to scoring
                    // The actual hand validation will be done when DeclareMahjong command is processed
                    // For now, just record that someone won via call
                    events.push(GameEvent::MahjongDeclared { player: seat });

                    // Note: Full win processing should happen through DeclareMahjong command
                    // This path is for when Mahjong is declared via call intent
                }
            }
        }

        events
    }

    // ========================================================================
    // Win/Advanced Commands
    // ========================================================================

    fn apply_declare_mahjong(
        &mut self,
        player: Seat,
        hand: Hand,
        winning_tile: Option<Tile>,
    ) -> Vec<GameEvent> {
        let mut events = vec![GameEvent::MahjongDeclared { player }];

        let validation = self
            .validator
            .as_ref()
            .and_then(|validator| validator.validate_win(&hand));

        if self.validator.is_some() && validation.is_none() {
            events.push(GameEvent::HandValidated {
                player,
                valid: false,
                pattern: None,
            });
            events.push(GameEvent::CommandRejected {
                player,
                reason: "Invalid Mahjong (no matching pattern)".to_string(),
            });
            return events;
        }

        // Determine win type
        let win_type = if let Some(_tile) = winning_tile {
            // Called discard
            WinType::CalledDiscard(self.discard_pile.last().map_or(player, |d| d.discarded_by))
        } else {
            WinType::SelfDraw
        };

        // Create win context
        let win_context = WinContext {
            winner: player,
            win_type,
            winning_tile: winning_tile.unwrap_or_else(|| hand.concealed[0]),
            hand: hand.clone(),
        };

        // Transition to Scoring phase
        let _ = self.transition_phase(PhaseTrigger::MahjongDeclared(win_context.clone()));

        let winning_pattern = validation
            .as_ref()
            .map(|analysis| analysis.pattern_id.clone())
            .unwrap_or_else(|| "Pattern Validation Not Implemented".to_string());

        // Collect all final hands
        let all_hands: HashMap<Seat, Hand> = self
            .players
            .iter()
            .map(|(seat, p)| (*seat, p.hand.clone()))
            .collect();

        // Build complete game result with scoring
        let game_result = crate::scoring::build_win_result(
            &win_context,
            winning_pattern.clone(),
            all_hands,
            self.dealer,
        );

        let _ = self.transition_phase(PhaseTrigger::ValidationComplete(game_result.clone()));

        events.push(GameEvent::HandValidated {
            player,
            valid: true,
            pattern: Some(winning_pattern),
        });

        events.push(GameEvent::GameOver {
            winner: Some(player),
            result: game_result,
        });

        events
    }

    fn apply_abandon_game(
        &mut self,
        player: Seat,
        reason: crate::flow::AbandonReason,
    ) -> Vec<GameEvent> {
        let mut events = vec![GameEvent::GameAbandoned {
            reason,
            initiator: Some(player),
        }];

        // Collect all final hands
        let all_hands: HashMap<Seat, Hand> = self
            .players
            .iter()
            .map(|(seat, p)| (*seat, p.hand.clone()))
            .collect();

        // Build abandon result
        let game_result = crate::scoring::build_abandon_result(all_hands, self.dealer, reason);

        // Transition to GameOver
        self.phase = crate::flow::GamePhase::GameOver(game_result.clone());

        events.push(GameEvent::GameOver {
            winner: None,
            result: game_result,
        });

        events
    }

    fn apply_exchange_joker(
        &mut self,
        player: Seat,
        target_seat: Seat,
        meld_index: usize,
        replacement: Tile,
    ) -> Vec<GameEvent> {
        let mut joker_tile = None;

        // Get the Joker from target's meld
        if let Some(target) = self.get_player_mut(target_seat) {
            if let Some(meld) = target.hand.exposed.get_mut(meld_index) {
                if meld.exchange_joker(replacement).is_ok() {
                    joker_tile = Some(crate::tile::tiles::JOKER);
                }
            }
        }

        // Give Joker to player, remove replacement from their hand
        if let (Some(joker), Some(p)) = (joker_tile, self.get_player_mut(player)) {
            let _ = p.hand.remove_tile(replacement);
            p.hand.add_tile(joker);

            return vec![GameEvent::JokerExchanged {
                player,
                target_seat,
                joker,
                replacement,
            }];
        }

        vec![]
    }

    fn apply_exchange_blank(&mut self, player: Seat, discard_index: usize) -> Vec<GameEvent> {
        // Get the tile from discard pile first
        let discarded_tile = if discard_index < self.discard_pile.len() {
            Some(self.discard_pile[discard_index].tile)
        } else {
            None
        };

        // Remove blank from player's hand and add discarded tile
        if let Some(p) = self.get_player_mut(player) {
            // Find and remove blank
            if let Some(pos) = p.hand.concealed.iter().position(|t| t.is_blank()) {
                p.hand.concealed.remove(pos);
            }

            // Add tile from discard pile
            if let Some(tile) = discarded_tile {
                p.hand.add_tile(tile);
            }
        }

        // Remove tile from discard pile
        if discard_index < self.discard_pile.len() {
            self.discard_pile.remove(discard_index);
        }

        vec![GameEvent::BlankExchanged { player }]
    }

    // ========================================================================
    // Bot Integration
    // ========================================================================

    /// Get the appropriate command for a bot to execute in the current game state.
    ///
    /// This helper method analyzes the current phase and player's hand to determine
    /// what command a bot should issue. Returns None if it's not the bot's turn
    /// or no action is required.
    ///
    /// # Arguments
    /// * `seat` - The seat position of the bot
    /// * `bot` - Reference to the BasicBot AI
    ///
    /// # Returns
    /// Some(GameCommand) if the bot should act, None otherwise
    #[must_use]
    pub fn get_bot_command(&self, seat: Seat, bot: &crate::bot::BasicBot) -> Option<GameCommand> {
        let player = self.get_player(seat)?;

        match &self.phase {
            // Charleston phases - choose tiles to pass
            GamePhase::Charleston(stage) if stage.requires_pass() => {
                let tiles = bot.choose_charleston_tiles(&player.hand);
                Some(GameCommand::PassTiles {
                    player: seat,
                    tiles,
                    blind_pass_count: None,
                })
            }

            // Charleston voting
            GamePhase::Charleston(CharlestonStage::VotingToContinue) => {
                // For BasicBot, always vote to stop (conservative strategy)
                if let Some(charleston) = &self.charleston_state {
                    if !charleston.votes.contains_key(&seat) {
                        return Some(GameCommand::VoteCharleston {
                            player: seat,
                            vote: CharlestonVote::Stop,
                        });
                    }
                }
                None
            }

            // Charleston courtesy pass
            GamePhase::Charleston(CharlestonStage::CourtesyAcross) => {
                // For BasicBot, skip courtesy pass (0 tiles)
                if let Some(charleston) = &self.charleston_state {
                    // Check if this seat hasn't submitted yet (value is None)
                    if matches!(charleston.pending_passes.get(&seat), Some(None)) {
                        return Some(GameCommand::AcceptCourtesyPass {
                            player: seat,
                            tiles: vec![],
                        });
                    }
                }
                None
            }

            // Setup phase - roll dice (only East)
            GamePhase::Setup(SetupStage::RollingDice) if seat == Seat::East => {
                Some(GameCommand::RollDice { player: seat })
            }

            // Setup phase - mark ready
            GamePhase::Setup(SetupStage::OrganizingHands) => {
                if !self.ready_players.contains(&seat) {
                    return Some(GameCommand::ReadyToStart { player: seat });
                }
                None
            }

            // Main game - drawing
            GamePhase::Playing(TurnStage::Drawing { player: p }) if *p == seat => {
                Some(GameCommand::DrawTile { player: seat })
            }

            // Main game - discarding
            GamePhase::Playing(TurnStage::Discarding { player: p }) if *p == seat => {
                // Check if we can win first
                if bot.check_win(&player.hand) {
                    return Some(GameCommand::DeclareMahjong {
                        player: seat,
                        hand: player.hand.clone(),
                        winning_tile: None,
                    });
                }

                // Otherwise, choose a tile to discard
                let tile = bot.choose_discard(&player.hand);
                Some(GameCommand::DiscardTile { player: seat, tile })
            }

            // Main game - call window
            GamePhase::Playing(TurnStage::CallWindow {
                tile,
                discarded_by,
                can_act,
                ..
            }) if can_act.contains(&seat) && *discarded_by != seat => {
                // Check if we can win by calling
                let mut test_hand = player.hand.clone();
                test_hand.add_tile(*tile);

                if bot.check_win(&test_hand) {
                    return Some(GameCommand::DeclareMahjong {
                        player: seat,
                        hand: test_hand,
                        winning_tile: Some(*tile),
                    });
                }

                // Check if we should call for a meld
                if let Some(meld) = bot.should_call(&player.hand, *tile) {
                    return Some(GameCommand::CallTile { player: seat, meld });
                }

                // Otherwise, pass
                Some(GameCommand::Pass { player: seat })
            }

            // Not our turn or no action needed
            _ => None,
        }
    }

    // ========================================================================
    // State Snapshot for Reconnection
    // ========================================================================

    /// Generate a state snapshot for a specific player (for reconnection).
    /// This includes all public game state plus the requesting player's private hand.
    pub fn create_snapshot(&self, requesting_seat: Seat) -> crate::snapshot::GameStateSnapshot {
        use crate::snapshot::{DiscardInfo, GameStateSnapshot, PublicPlayerInfo};

        // Convert players to public info
        let players: Vec<PublicPlayerInfo> = self
            .players
            .values()
            .map(|p| PublicPlayerInfo {
                seat: p.seat,
                player_id: p.id.clone(),
                is_bot: p.is_bot,
                status: p.status,
                tile_count: p.hand.tile_count(),
                exposed_melds: p.hand.exposed.clone(),
            })
            .collect();

        // Get private hand for requesting player
        let your_hand = self
            .players
            .get(&requesting_seat)
            .map(|p| p.hand.concealed.clone())
            .unwrap_or_default();

        // Convert discard pile
        let discard_pile: Vec<DiscardInfo> = self
            .discard_pile
            .iter()
            .map(|d| DiscardInfo {
                tile: d.tile,
                discarded_by: d.discarded_by,
            })
            .collect();

        GameStateSnapshot {
            game_id: self.game_id.clone(),
            phase: self.phase.clone(),
            current_turn: self.current_turn,
            dealer: self.dealer,
            round_number: self.round_number,
            remaining_tiles: self.wall.remaining(),
            discard_pile,
            players,
            house_rules: self.house_rules.clone(),
            your_seat: requesting_seat,
            your_hand,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::{Tile, BLANK_INDEX, DOT_START, JOKER_INDEX};

    // Helper to create tiles
    fn dot(n: u8) -> Tile {
        Tile(DOT_START + (n - 1))
    }

    #[test]
    fn test_table_creation() {
        let table = Table::new("game123".to_string(), 42);
        assert_eq!(table.game_id, "game123");
        assert_eq!(table.dealer, Seat::East);
        assert_eq!(table.round_number, 1);
        assert!(matches!(table.phase, GamePhase::WaitingForPlayers));
    }

    #[test]
    fn test_seat_navigation() {
        let table = Table::new("test".to_string(), 0);
        assert_eq!(table.current_turn, Seat::East);

        let mut table = table;
        table.advance_turn();
        assert_eq!(table.current_turn, Seat::South);
        table.advance_turn();
        assert_eq!(table.current_turn, Seat::West);
        table.advance_turn();
        assert_eq!(table.current_turn, Seat::North);
        table.advance_turn();
        assert_eq!(table.current_turn, Seat::East);
    }

    #[test]
    fn test_add_players() {
        let mut table = Table::new("test".to_string(), 0);

        // Add 4 players
        for seat in Seat::all() {
            let player = Player::new(format!("player_{}", seat.index()), seat, false);
            table.players.insert(seat, player);
        }

        assert_eq!(table.players.len(), 4);
        assert!(table.get_player(Seat::East).is_some());
        assert!(table.get_player(Seat::South).is_some());
    }

    #[test]
    fn test_roll_dice_command() {
        let mut table = Table::new("test".to_string(), 42);

        // Add East player
        table.players.insert(
            Seat::East,
            Player::new("east".to_string(), Seat::East, false),
        );

        // Transition to Setup phase
        table.phase = GamePhase::Setup(SetupStage::RollingDice);

        let cmd = GameCommand::RollDice { player: Seat::East };
        let events = table.process_command(cmd).unwrap();

        assert!(events
            .iter()
            .any(|e| matches!(e, GameEvent::DiceRolled { .. })));
        assert!(events
            .iter()
            .any(|e| matches!(e, GameEvent::WallBroken { .. })));
        assert!(events
            .iter()
            .any(|e| matches!(e, GameEvent::TilesDealt { .. })));
        assert!(matches!(
            table.phase,
            GamePhase::Setup(SetupStage::OrganizingHands)
        ));
    }

    #[test]
    fn test_only_east_can_roll_dice() {
        let mut table = Table::new("test".to_string(), 42);

        // Add South player
        table.players.insert(
            Seat::South,
            Player::new("south".to_string(), Seat::South, false),
        );

        table.phase = GamePhase::Setup(SetupStage::RollingDice);

        let cmd = GameCommand::RollDice {
            player: Seat::South,
        };
        let result = table.process_command(cmd);

        assert!(matches!(result, Err(CommandError::OnlyEastCanRoll)));
    }

    #[test]
    fn test_discard_tile_validation() {
        let mut table = Table::new("test".to_string(), 42);

        // Set up player with hand
        let mut player = Player::new("east".to_string(), Seat::East, false);
        player.hand = Hand::new(vec![dot(1), dot(2), dot(3)]);
        player.status = PlayerStatus::Active;
        table.players.insert(Seat::East, player);

        // Set phase to Discarding
        table.phase = GamePhase::Playing(TurnStage::Discarding { player: Seat::East });

        // Try to discard a tile not in hand
        let cmd = GameCommand::DiscardTile {
            player: Seat::East,
            tile: dot(5),
        };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::TileNotInHand)));

        // Discard a tile in hand
        let cmd = GameCommand::DiscardTile {
            player: Seat::East,
            tile: dot(1),
        };
        let result = table.process_command(cmd);
        assert!(result.is_ok());
    }

    #[test]
    fn test_wrong_phase_rejection() {
        let mut table = Table::new("test".to_string(), 42);

        let mut player = Player::new("east".to_string(), Seat::East, false);
        player.status = PlayerStatus::Active;
        table.players.insert(Seat::East, player);

        // Try to draw during Setup phase
        table.phase = GamePhase::Setup(SetupStage::RollingDice);

        let cmd = GameCommand::DrawTile { player: Seat::East };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::WrongPhase)));
    }

    #[test]
    fn test_not_your_turn_rejection() {
        let mut table = Table::new("test".to_string(), 42);

        // Add two players
        let mut east = Player::new("east".to_string(), Seat::East, false);
        east.status = PlayerStatus::Active;
        let mut south = Player::new("south".to_string(), Seat::South, false);
        south.status = PlayerStatus::Active;

        table.players.insert(Seat::East, east);
        table.players.insert(Seat::South, south);

        // Set to Drawing phase for East
        table.phase = GamePhase::Playing(TurnStage::Drawing { player: Seat::East });
        table.current_turn = Seat::East;

        // South tries to draw
        let cmd = GameCommand::DrawTile {
            player: Seat::South,
        };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::NotYourTurn)));
    }

    #[test]
    fn test_charleston_no_jokers() {
        let mut table = Table::new("test".to_string(), 42);

        let mut player = Player::new("east".to_string(), Seat::East, false);
        player.hand = Hand::new(vec![dot(1), Tile(JOKER_INDEX), dot(3)]);
        player.status = PlayerStatus::Active;
        table.players.insert(Seat::East, player);

        table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
        table.charleston_state = Some(CharlestonState::new());

        // Try to pass Joker
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles: vec![dot(1), Tile(JOKER_INDEX), dot(3)],
            blind_pass_count: None,
        };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::ContainsJokers)));
    }

    #[test]
    fn test_pass_tiles_count_validation() {
        let mut table = Table::new("test".to_string(), 42);

        let mut player = Player::new("east".to_string(), Seat::East, false);
        player.hand = Hand::new(vec![dot(1), dot(2)]);
        player.status = PlayerStatus::Active;
        table.players.insert(Seat::East, player);

        table.phase = GamePhase::Charleston(CharlestonStage::FirstRight);
        table.charleston_state = Some(CharlestonState::new());

        // Try to pass only 2 tiles
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles: vec![dot(1), dot(2)],
            blind_pass_count: None,
        };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::InvalidPassCount)));
    }

    #[test]
    fn test_blank_exchange_requires_house_rule() {
        let mut table = Table::new("test".to_string(), 42);

        let mut player = Player::new("east".to_string(), Seat::East, false);
        player.hand = Hand::new(vec![Tile(BLANK_INDEX)]);
        player.status = PlayerStatus::Active;
        table.players.insert(Seat::East, player);

        table.discard_pile.push(DiscardedTile {
            tile: dot(5),
            discarded_by: Seat::South,
        });

        // House rule disabled by default
        let cmd = GameCommand::ExchangeBlank {
            player: Seat::East,
            discard_index: 0,
        };
        let result = table.process_command(cmd);
        assert!(matches!(result, Err(CommandError::BlankExchangeNotEnabled)));

        // Enable house rule
        table.house_rules.ruleset.blank_exchange_enabled = true;
        let cmd2 = GameCommand::ExchangeBlank {
            player: Seat::East,
            discard_index: 0,
        };
        let result = table.process_command(cmd2);
        assert!(result.is_ok());
    }

    #[test]
    fn test_ruleset_default_values() {
        let ruleset = Ruleset::default();
        assert_eq!(ruleset.card_year, 2025);
        assert!(matches!(ruleset.timer_mode, TimerMode::Visible));
        assert!(!ruleset.blank_exchange_enabled);
        assert_eq!(ruleset.call_window_seconds, 10);
        assert_eq!(ruleset.charleston_timer_seconds, 60);
    }

    #[test]
    fn test_ruleset_custom_values() {
        let ruleset = Ruleset {
            card_year: 2024,
            timer_mode: TimerMode::Hidden,
            blank_exchange_enabled: true,
            call_window_seconds: 15,
            charleston_timer_seconds: 90,
        };

        assert_eq!(ruleset.card_year, 2024);
        assert!(matches!(ruleset.timer_mode, TimerMode::Hidden));
        assert!(ruleset.blank_exchange_enabled);
    }

    #[test]
    fn test_house_rules_default() {
        let house_rules = HouseRules::default();
        assert_eq!(house_rules.ruleset.card_year, 2025);
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
    }

    #[test]
    fn test_house_rules_with_card_year() {
        let house_rules = HouseRules::with_card_year(2020);
        assert_eq!(house_rules.ruleset.card_year, 2020);
        // Other values should be defaults
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Visible));
    }

    #[test]
    fn test_house_rules_with_custom_ruleset() {
        let ruleset = Ruleset {
            card_year: 2025,
            timer_mode: TimerMode::Hidden,
            blank_exchange_enabled: true,
            call_window_seconds: 20,
            charleston_timer_seconds: 120,
        };
        let house_rules = HouseRules::with_ruleset(ruleset);

        assert_eq!(house_rules.ruleset.card_year, 2025);
        assert!(matches!(house_rules.ruleset.timer_mode, TimerMode::Hidden));
        assert!(house_rules.ruleset.blank_exchange_enabled);
        assert_eq!(house_rules.ruleset.call_window_seconds, 20);
    }

    #[test]
    fn test_table_creation_with_house_rules() {
        let house_rules = HouseRules::with_card_year(2025);
        let table = Table::new_with_rules("test-game".to_string(), 42, house_rules);

        assert_eq!(table.house_rules.ruleset.card_year, 2025);
        assert!(!table.house_rules.ruleset.blank_exchange_enabled);
    }

    #[test]
    fn test_snapshot_contains_ruleset() {
        let table = Table::new("test-game".to_string(), 42);
        let snapshot = table.create_snapshot(Seat::East);

        assert_eq!(snapshot.house_rules.ruleset.card_year, 2025);
        assert!(matches!(
            snapshot.house_rules.ruleset.timer_mode,
            TimerMode::Visible
        ));
    }

    #[test]
    fn test_snapshot_card_year_accessors() {
        let table = Table::new("test-game".to_string(), 42);
        let snapshot = table.create_snapshot(Seat::East);

        assert_eq!(snapshot.card_year(), 2025);
        assert!(matches!(snapshot.timer_mode(), TimerMode::Visible));
    }
}
