//! Command validation for table state transitions.

use super::types::CommandError;
use super::Table;
use crate::command::GameCommand;
use crate::flow::charleston::CharlestonStage;
use crate::flow::playing::TurnStage;
use crate::flow::{GamePhase, SetupStage};
use crate::player::Seat;
use crate::tile::Tile;
use std::collections::HashMap;

/// Validates game commands against current table state.
///
/// # Errors
/// Returns a `CommandError` if the command is not valid in the current state.
pub fn validate(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    let player = cmd.player();

    // Check player exists and can act
    let player_obj = table
        .get_player(player)
        .ok_or(CommandError::PlayerNotFound)?;
    if !player_obj.can_act() && !matches!(cmd, GameCommand::LeaveGame { .. }) {
        return Err(CommandError::PlayerNotFound);
    }

    match cmd {
        GameCommand::RollDice { .. } | GameCommand::ReadyToStart { .. } => {
            validate_setup(table, cmd)
        }

        GameCommand::PassTiles { .. }
        | GameCommand::VoteCharleston { .. }
        | GameCommand::ProposeCourtesyPass { .. }
        | GameCommand::AcceptCourtesyPass { .. } => validate_charleston(table, cmd),

        GameCommand::DrawTile { .. }
        | GameCommand::DiscardTile { .. }
        | GameCommand::DeclareCallIntent { .. }
        | GameCommand::Pass { .. } => validate_playing(table, cmd),

        GameCommand::DeclareMahjong { .. }
        | GameCommand::ExchangeJoker { .. }
        | GameCommand::ExchangeBlank { .. }
        | GameCommand::AddToExposure { .. }
        | GameCommand::AbandonGame { .. } => validate_win(table, cmd),

        GameCommand::RequestState { .. }
        | GameCommand::LeaveGame { .. }
        | GameCommand::GetAnalysis { .. }
        | GameCommand::RequestHint { .. }
        | GameCommand::SetHintVerbosity { .. }
        | GameCommand::RequestHistory { .. }
        | GameCommand::JumpToMove { .. }
        | GameCommand::ResumeFromHistory { .. }
        | GameCommand::ReturnToPresent { .. }
        | GameCommand::PauseGame { .. }
        | GameCommand::ResumeGame { .. }
        | GameCommand::ForfeitGame { .. }
        | GameCommand::SmartUndo { .. }
        | GameCommand::VoteUndo { .. } => Ok(()),
    }
}

fn validate_setup(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    match cmd {
        GameCommand::RollDice { player } => {
            if !matches!(table.phase, GamePhase::Setup(SetupStage::RollingDice)) {
                return Err(CommandError::WrongPhase);
            }
            if *player != Seat::East {
                return Err(CommandError::OnlyEastCanRoll);
            }
        }
        GameCommand::ReadyToStart { player } => {
            if !matches!(table.phase, GamePhase::Setup(SetupStage::OrganizingHands)) {
                return Err(CommandError::WrongPhase);
            }
            if table.ready_players.contains(player) {
                return Err(CommandError::AlreadyReady);
            }
        }
        _ => unreachable!("Invalid command for setup validation"),
    }
    Ok(())
}

fn validate_charleston(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    match cmd {
        GameCommand::PassTiles {
            player,
            tiles,
            blind_pass_count,
            ..
        } => {
            if let GamePhase::Charleston(_) = table.phase {
                // Validate tile count
                if !cmd.validate_pass_tile_count() {
                    return Err(CommandError::InvalidPassCount);
                }
                // Validate no Jokers
                if cmd.contains_jokers() {
                    return Err(CommandError::ContainsJokers);
                }
                // Validate blind pass is allowed in this stage
                if let Some(charleston) = &table.charleston_state {
                    if blind_pass_count.is_some() && !charleston.stage.allows_blind_pass() {
                        return Err(CommandError::BlindPassNotAllowed);
                    }
                }
                // Check player has the tiles
                let player_obj = table
                    .get_player(*player)
                    .ok_or(CommandError::PlayerNotFound)?;
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
                table.phase,
                GamePhase::Charleston(CharlestonStage::VotingToContinue)
            ) {
                return Err(CommandError::WrongPhase);
            }
            if let Some(charleston) = &table.charleston_state {
                if charleston.votes.contains_key(player) {
                    return Err(CommandError::AlreadyVoted);
                }
            }
        }

        GameCommand::ProposeCourtesyPass { tile_count, .. } => {
            if !matches!(
                table.phase,
                GamePhase::Charleston(CharlestonStage::CourtesyAcross)
            ) {
                return Err(CommandError::NotInCourtesyPass);
            }
            if *tile_count > 3 {
                return Err(CommandError::InvalidCourtesyPassCount);
            }
        }

        GameCommand::AcceptCourtesyPass { player, tiles, .. } => {
            if !matches!(
                table.phase,
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

            // Validate tile count matches agreed proposal
            let pair = if *player == Seat::East || *player == Seat::West {
                (Seat::East, Seat::West)
            } else {
                (Seat::North, Seat::South)
            };

            if let Some(charleston) = &table.charleston_state {
                // Check if both players in pair have proposed
                if !charleston.courtesy_pair_ready(pair) {
                    return Err(CommandError::IncompleteCourtesyProposal);
                }

                // Validate tile count matches agreed count
                let agreed_count = charleston
                    .courtesy_agreed_count(pair)
                    .ok_or(CommandError::IncompleteCourtesyProposal)?;
                if tiles.len() != agreed_count as usize {
                    return Err(CommandError::InvalidCourtesyPassCount);
                }
            }

            // Check player has the tiles
            let player_obj = table
                .get_player(*player)
                .ok_or(CommandError::PlayerNotFound)?;
            for tile in tiles {
                if !player_obj.hand.has_tile(*tile) {
                    return Err(CommandError::TileNotInHand);
                }
            }
        }
        _ => unreachable!("Invalid command for charleston validation"),
    }
    Ok(())
}

/// Validates commands during the Playing game phase.
///
/// Delegates to specialized validators for each command type.
///
/// # Arguments
/// * `table` - The current table state
/// * `cmd` - The game command to validate
///
/// # Returns
/// * `Ok(())` if the command is valid for the current playing state
/// * `Err(CommandError)` describing the validation failure
///
/// # Errors
/// Returns `CommandError` if:
/// - Command is not valid for the current turn stage
/// - Player is not authorized to perform the action
/// - Command parameters are invalid
fn validate_playing(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    match cmd {
        GameCommand::DrawTile { player } => validate_draw(table, *player),
        GameCommand::DiscardTile { player, tile } => validate_discard(table, *player, *tile),
        GameCommand::DeclareCallIntent { player, intent } => {
            validate_call_intent(table, *player, intent)
        }
        GameCommand::Pass { player } => validate_pass(table, *player),
        _ => unreachable!("Invalid command for playing validation"),
    }
}

/// Validates a draw tile command.
///
/// # Arguments
/// * `table` - The current table state
/// * `player` - The player attempting to draw
///
/// # Returns
/// * `Ok(())` if the player is allowed to draw in the current state
///
/// # Errors
/// Returns `CommandError` if:
/// - Game is not in Drawing turn stage (`WrongPhase`)
/// - It is not the player's turn (`NotYourTurn`)
fn validate_draw(table: &Table, player: Seat) -> Result<(), CommandError> {
    if let GamePhase::Playing(TurnStage::Drawing { player: p }) = table.phase {
        if player != p {
            return Err(CommandError::NotYourTurn);
        }
        Ok(())
    } else {
        Err(CommandError::WrongPhase)
    }
}

/// Validates a discard tile command.
///
/// # Arguments
/// * `table` - The current table state
/// * `player` - The player attempting to discard
/// * `tile` - The tile to discard
///
/// # Returns
/// * `Ok(())` if the discard is valid
///
/// # Errors
/// Returns `CommandError` if:
/// - Game is not in Discarding turn stage (`WrongPhase`)
/// - It is not the player's turn (`NotYourTurn`)
/// - Player does not have the specified tile (`TileNotInHand`)
/// - Player not found in table state (`PlayerNotFound`)
fn validate_discard(table: &Table, player: Seat, tile: Tile) -> Result<(), CommandError> {
    if let GamePhase::Playing(TurnStage::Discarding { player: p }) = table.phase {
        if player != p {
            return Err(CommandError::NotYourTurn);
        }
        let player_obj = table
            .get_player(player)
            .ok_or(CommandError::PlayerNotFound)?;
        if !player_obj.hand.has_tile(tile) {
            return Err(CommandError::TileNotInHand);
        }
        Ok(())
    } else {
        Err(CommandError::WrongPhase)
    }
}

/// Validates a call intent declaration during a call window.
///
/// For Mahjong calls: Ensures the player can act in the call window.
/// For Meld calls: Validates the meld structure and verifies the player owns
/// the required tiles. Specifically:
/// - Meld structure is valid (correct tile count, matching tiles)
/// - Called tile matches the current window tile
/// - Meld contains the called tile
/// - Player owns all non-called tiles in the meld
///
/// # Arguments
/// * `table` - The current table state
/// * `player` - The player declaring the call intent
/// * `intent` - The type of call (Meld or Mahjong)
///
/// # Returns
/// * `Ok(())` if the call intent is valid
///
/// # Errors
/// Returns `CommandError` if:
/// - Game is not in CallWindow turn stage (`WrongPhase`)
/// - Player cannot act in the call window (`CannotActInCallWindow`)
/// - Player is trying to call their own discard (`CannotCallOwnDiscard`)
/// - Meld intent contains invalid tiles or structure (`InvalidMeld`)
/// - Meld's called tile doesn't match the window tile (`InvalidMeld`)
/// - Meld doesn't contain the called tile (`InvalidMeld`)
/// - Player doesn't own required tiles from the meld (`TileNotInHand`)
fn validate_call_intent(
    table: &Table,
    player: Seat,
    intent: &crate::call_resolution::CallIntentKind,
) -> Result<(), CommandError> {
    if let GamePhase::Playing(TurnStage::CallWindow {
        discarded_by,
        can_act,
        tile: window_tile,
        ..
    }) = &table.phase
    {
        if player == *discarded_by {
            return Err(CommandError::CannotCallOwnDiscard);
        }
        if !can_act.contains(&player) {
            return Err(CommandError::CannotActInCallWindow);
        }
        // Validate intent based on kind
        match intent {
            crate::call_resolution::CallIntentKind::Meld(meld) => {
                // 1. Basic meld structure validation
                if meld.validate().is_err() {
                    return Err(CommandError::InvalidMeld);
                }

                // 2. Meld must have a called_tile, and it must match the window tile
                let called_tile = meld.called_tile.ok_or(CommandError::InvalidMeld)?;
                if called_tile != *window_tile {
                    return Err(CommandError::InvalidMeld);
                }

                // 3. Meld tiles must include the called tile
                if !meld.tiles.contains(&called_tile) {
                    return Err(CommandError::InvalidMeld);
                }

                // 4. Player must own all tiles in the meld except the called tile
                let player_obj = table
                    .get_player(player)
                    .ok_or(CommandError::PlayerNotFound)?;

                let mut meld_counts: HashMap<Tile, usize> = HashMap::new();
                for &tile in meld.tiles.iter() {
                    *meld_counts.entry(tile).or_insert(0) += 1;
                }

                for (tile, count) in meld_counts {
                    let required = if tile == called_tile {
                        count.saturating_sub(1)
                    } else {
                        count
                    };
                    if player_obj.hand.count_tile(tile) < required {
                        return Err(CommandError::TileNotInHand);
                    }
                }
            }
            crate::call_resolution::CallIntentKind::Mahjong => {
                // Mahjong validation will happen during resolution
                // Just check player can act (already done above)
            }
        }
        Ok(())
    } else {
        Err(CommandError::WrongPhase)
    }
}

/// Validates a pass command during a call window.
///
/// # Arguments
/// * `table` - The current table state
/// * `player` - The player passing on the call opportunity
///
/// # Returns
/// * `Ok(())` if the pass is valid
///
/// # Errors
/// Returns `CommandError` if:
/// - Game is not in CallWindow turn stage (`WrongPhase`)
/// - Player is not in the list of players who can act (`CannotActInCallWindow`)
fn validate_pass(table: &Table, player: Seat) -> Result<(), CommandError> {
    if let GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) = &table.phase {
        if !can_act.contains(&player) {
            return Err(CommandError::CannotActInCallWindow);
        }
        Ok(())
    } else {
        Err(CommandError::WrongPhase)
    }
}

fn validate_win(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    match cmd {
        GameCommand::DeclareMahjong { player, .. } => {
            // Can declare during Discarding (self-draw) or CallWindow (calling for win)
            match &table.phase {
                GamePhase::Playing(TurnStage::Discarding { player: p }) => {
                    if player != p {
                        return Err(CommandError::NotYourTurn);
                    }
                }
                GamePhase::Playing(TurnStage::AwaitingMahjong { caller, .. }) => {
                    if player != caller {
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
            player,
            target_seat,
            meld_index,
            replacement,
            ..
        } => {
            // NMJL Rule: Joker exchange only allowed during Discarding stage
            // (after draw/call, before discard)
            if let GamePhase::Playing(TurnStage::Discarding { player: p }) = table.phase {
                if player != &p {
                    return Err(CommandError::NotYourTurn);
                }
            } else {
                return Err(CommandError::WrongPhase);
            }

            let target = table
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
            let player_obj = table
                .get_player(*player)
                .ok_or(CommandError::PlayerNotFound)?;
            if !player_obj.hand.has_tile(*replacement) {
                return Err(CommandError::TileNotInHand);
            }
            if !meld.can_exchange_joker(*replacement) {
                return Err(CommandError::InvalidReplacement);
            }
        }

        GameCommand::ExchangeBlank {
            player,
            discard_index,
            ..
        } => {
            if !table.house_rules.ruleset.blank_exchange_enabled {
                return Err(CommandError::BlankExchangeNotEnabled);
            }
            if *discard_index >= table.discard_pile.len() {
                return Err(CommandError::InvalidDiscardIndex);
            }
            // Check player has a Blank
            let player_obj = table
                .get_player(*player)
                .ok_or(CommandError::PlayerNotFound)?;
            if !player_obj.hand.concealed.iter().any(|t| t.is_blank()) {
                return Err(CommandError::NoBlankInHand);
            }
        }

        GameCommand::AddToExposure {
            player,
            meld_index,
            tile,
        } => {
            // Only valid during Discarding phase on the player's turn
            if let GamePhase::Playing(TurnStage::Discarding { player: p }) = table.phase {
                if player != &p {
                    return Err(CommandError::NotYourTurn);
                }
            } else {
                return Err(CommandError::WrongPhase);
            }

            // Check player has exposed melds
            let player_obj = table
                .get_player(*player)
                .ok_or(CommandError::PlayerNotFound)?;
            if *meld_index >= player_obj.hand.exposed.len() {
                return Err(CommandError::MeldIndexOutOfBounds);
            }

            // Check player has the tile to add
            if !player_obj.hand.has_tile(*tile) {
                return Err(CommandError::TileNotInHand);
            }

            // Check that the meld can be upgraded with this tile
            let meld = &player_obj.hand.exposed[*meld_index];

            // Verify the new tile matches the meld's tiles
            let non_joker_tile = meld.tiles.iter().find(|t| !t.is_joker());
            if let Some(&existing_tile) = non_joker_tile {
                if *tile != existing_tile {
                    return Err(CommandError::TileNotInHand);
                }
            } else if let Some(called) = meld.called_tile {
                // All-joker meld: tile must match called_tile
                if *tile != called {
                    return Err(CommandError::TileNotInHand);
                }
            }

            // Verify meld type can be upgraded (not already a Sextet)
            if meld.meld_type == crate::meld::MeldType::Sextet {
                return Err(CommandError::InvalidMeld);
            }
        }

        GameCommand::AbandonGame { .. } => {
            // Always allowed
        }
        _ => unreachable!("Invalid command for win validation"),
    }
    Ok(())
}
