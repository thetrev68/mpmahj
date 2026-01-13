//! Bot-driven command selection based on table state.

use super::Table;
use crate::command::GameCommand;
use crate::flow::{CharlestonStage, CharlestonVote, GamePhase, SetupStage, TurnStage};
use crate::player::Seat;

/// Select a command for a bot, if one is needed in the current state.
///
/// # Examples
/// ```no_run
/// use mahjong_core::bot::BasicBot;
/// use mahjong_core::rules::card::UnifiedCard;
/// use mahjong_core::table::Table;
/// use mahjong_core::player::Seat;
///
/// let card = UnifiedCard::from_json(r#"{"year":2025,"sections":[]}"#).unwrap();
/// let bot = BasicBot::new(&card);
/// let table = Table::new("bot-table".to_string(), 0);
/// let _ = mahjong_core::table::bot::get_bot_command(&table, Seat::East, &bot);
/// ```
pub fn get_bot_command(
    table: &Table,
    seat: Seat,
    bot: &crate::bot::BasicBot,
) -> Option<GameCommand> {
    let player = table.get_player(seat)?;

    match &table.phase {
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
            if let Some(charleston) = &table.charleston_state {
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
            if let Some(charleston) = &table.charleston_state {
                // Check if bot has already proposed
                let has_proposed = charleston
                    .courtesy_proposals
                    .get(&seat)
                    .and_then(|&p| p)
                    .is_some();

                if !has_proposed {
                    // Propose 0 tiles (BasicBot is conservative)
                    return Some(GameCommand::ProposeCourtesyPass {
                        player: seat,
                        tile_count: 0,
                    });
                } else {
                    // Check if partner has also proposed
                    let partner = seat.across();
                    let partner_proposed = charleston
                        .courtesy_proposals
                        .get(&partner)
                        .and_then(|&p| p)
                        .is_some();

                    if partner_proposed {
                        // Both proposed, now submit tiles
                        let agreed_count =
                            charleston.courtesy_agreed_count((seat, partner)).unwrap();

                        if agreed_count == 0 {
                            // No exchange, submit empty vec
                            return Some(GameCommand::AcceptCourtesyPass {
                                player: seat,
                                tiles: vec![],
                            });
                        } else {
                            // Select worst tiles (for BasicBot, just pick first N)
                            if let Some(player) = table.get_player(seat) {
                                let tiles: Vec<_> = player
                                    .hand
                                    .concealed
                                    .iter()
                                    .take(agreed_count as usize)
                                    .copied()
                                    .collect();

                                return Some(GameCommand::AcceptCourtesyPass {
                                    player: seat,
                                    tiles,
                                });
                            }
                        }
                    }
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
            if !table.ready_players.contains(&seat) {
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
