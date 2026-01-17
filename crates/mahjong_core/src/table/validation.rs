//! Command validation for table state transitions.

use super::types::CommandError;
use super::Table;
use crate::command::GameCommand;
use crate::flow::{CharlestonStage, GamePhase, SetupStage, TurnStage};
use crate::player::Seat;

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
        | GameCommand::AbandonGame { .. } => validate_win(table, cmd),

        GameCommand::RequestState { .. }
        | GameCommand::LeaveGame { .. }
        | GameCommand::GetAnalysis { .. }
        | GameCommand::RequestHint { .. }
        | GameCommand::SetHintVerbosity { .. }
        | GameCommand::RequestHistory { .. }
        | GameCommand::JumpToMove { .. }
        | GameCommand::ResumeFromHistory { .. }
        | GameCommand::ReturnToPresent { .. } => Ok(()),
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

fn validate_playing(table: &Table, cmd: &GameCommand) -> Result<(), CommandError> {
    match cmd {
        GameCommand::DrawTile { player } => {
            if let GamePhase::Playing(TurnStage::Drawing { player: p }) = table.phase {
                if *player != p {
                    return Err(CommandError::NotYourTurn);
                }
            } else {
                return Err(CommandError::WrongPhase);
            }
        }

        GameCommand::DiscardTile { player, tile } => {
            if let GamePhase::Playing(TurnStage::Discarding { player: p }) = table.phase {
                if *player != p {
                    return Err(CommandError::NotYourTurn);
                }
                let player_obj = table
                    .get_player(*player)
                    .ok_or(CommandError::PlayerNotFound)?;
                if !player_obj.hand.has_tile(*tile) {
                    return Err(CommandError::TileNotInHand);
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
            }) = &table.phase
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
            if let GamePhase::Playing(TurnStage::CallWindow { can_act, .. }) = &table.phase {
                if !can_act.contains(player) {
                    return Err(CommandError::CannotActInCallWindow);
                }
            } else {
                return Err(CommandError::WrongPhase);
            }
        }
        _ => unreachable!("Invalid command for playing validation"),
    }
    Ok(())
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

        GameCommand::AbandonGame { .. } => {
            // Always allowed
        }
        _ => unreachable!("Invalid command for win validation"),
    }
    Ok(())
}
