use super::Table;
use crate::command::GameCommand;
use crate::flow::{CharlestonStage, CharlestonVote, GamePhase, SetupStage, TurnStage};
use crate::player::Seat;

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
            // For BasicBot, skip courtesy pass (0 tiles)
            if let Some(charleston) = &table.charleston_state {
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
