//! Bot runner task that drives AI players in rooms.
//!
//! ```no_run
//! use mahjong_server::network::bot_runner::spawn_bot_runner;
//! use std::sync::Arc;
//! use tokio::sync::Mutex;
//! let (room, _rx) = mahjong_server::network::room::Room::new();
//! spawn_bot_runner(Arc::new(Mutex::new(room)));
//! ```
use crate::network::commands::RoomCommands;
use crate::network::room::Room;
use mahjong_ai::{create_ai, MahjongAI};
use mahjong_core::{
    command::GameCommand,
    flow::{GamePhase, TurnStage},
    player::Seat,
    table::Table,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Spawns a background task that issues bot commands for active seats.
pub fn spawn_bot_runner(room_arc: Arc<Mutex<Room>>) {
    tokio::spawn(async move {
        // Get difficulty from room (snapshot at start of runner).
        let difficulty = {
            let room = room_arc.lock().await;
            room.bot_difficulty
        };

        // Create bots for all seats using the configured difficulty.
        // Note: We create one for each seat, but only use them if the seat is in bot_seats.
        let mut bots: HashMap<Seat, Box<dyn MahjongAI>> = Seat::all()
            .into_iter()
            .map(|seat| {
                let seed = rand::random::<u64>();
                (seat, create_ai(difficulty, seed))
            })
            .collect();

        let mut interval = tokio::time::interval(std::time::Duration::from_millis(200));

        loop {
            interval.tick().await;
            let mut room = room_arc.lock().await;

            if room.bot_seats.is_empty() {
                room.bot_runner_active = false;
                break;
            }

            let table = match room.table.as_ref() {
                Some(table) => table,
                None => continue,
            };

            let mut commands = Vec::new();
            for seat in &room.bot_seats {
                if let Some(bot) = bots.get_mut(seat) {
                    // TODO: Consolidate bot decision logic with core Table helpers when available.

                    if table.current_turn != *seat {
                        continue; // Not my turn.
                    }

                    if let Some(cmd) = get_ai_command(table, *seat, bot.as_mut()) {
                        commands.push(cmd);
                    }
                }
            }

            for command in commands {
                let _ = room.handle_bot_command(command).await;
            }
        }
    });
}

/// Bridge function to get a command from a MahjongAI trait object.
fn get_ai_command(table: &Table, seat: Seat, ai: &mut dyn MahjongAI) -> Option<GameCommand> {
    let player = table.players.get(&seat)?;
    let validator = table.validator.as_ref()?;

    // Construct visible tiles context.
    let mut visible = mahjong_ai::VisibleTiles::new();
    for d in &table.discard_pile {
        visible.add_discard(d.tile);
    }
    // Add exposures.
    for (seat, p) in &table.players {
        for meld in &p.hand.exposed {
            visible.add_meld(*seat, meld.clone());
        }
    }

    match &table.phase {
        GamePhase::Charleston(stage) => {
            // Handle Charleston logic.
            if let Some(cs) = &table.charleston_state {
                // Check if we haven't acted yet (pending_passes is None).
                if cs.pending_passes.get(&seat).is_none_or(|v| v.is_none()) {
                    if stage.requires_pass() {
                        let tiles =
                            ai.select_charleston_tiles(&player.hand, *stage, &visible, validator);
                        if tiles.len() == 3 {
                            return Some(GameCommand::PassTiles {
                                player: seat,
                                tiles,
                                blind_pass_count: None,
                            });
                        }
                    } else if *stage == mahjong_core::flow::CharlestonStage::VotingToContinue {
                        if !cs.votes.contains_key(&seat) {
                            let vote = ai.vote_charleston(&player.hand, &visible, validator);
                            return Some(GameCommand::VoteCharleston { player: seat, vote });
                        }
                    } else if *stage == mahjong_core::flow::CharlestonStage::CourtesyAcross {
                        // Check if bot has proposed
                        let has_proposed =
                            cs.courtesy_proposals.get(&seat).and_then(|&p| p).is_some();

                        if !has_proposed {
                            // Propose 0 tiles.
                            return Some(GameCommand::ProposeCourtesyPass {
                                player: seat,
                                tile_count: 0,
                            });
                        } else {
                            // Check if partner has also proposed.
                            let partner = seat.across();
                            let partner_proposed = cs
                                .courtesy_proposals
                                .get(&partner)
                                .and_then(|&p| p)
                                .is_some();

                            if partner_proposed {
                                // Both proposed, get agreed count and submit.
                                let agreed_count =
                                    cs.courtesy_agreed_count((seat, partner)).unwrap();

                                if agreed_count == 0 {
                                    // No exchange, submit empty vec.
                                    return Some(GameCommand::AcceptCourtesyPass {
                                        player: seat,
                                        tiles: vec![],
                                    });
                                } else {
                                    // Select tiles to pass (simplified: pick first N).
                                    // TODO: Improve tile selection strategy for courtesy passes.
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
            }
            None
        }
        GamePhase::Playing(stage) => {
            match stage {
                TurnStage::Discarding { player: p } if *p == seat => {
                    let tile = ai.select_discard(&player.hand, &visible, validator);
                    Some(GameCommand::DiscardTile { player: seat, tile })
                }
                TurnStage::Drawing { player: p } if *p == seat => {
                    Some(GameCommand::DrawTile { player: seat })
                }
                TurnStage::CallWindow {
                    discarded_by,
                    can_act,
                    ..
                } if can_act.contains(&seat) && *discarded_by != seat => {
                    // TODO: Implement bot call logic for call windows.
                    Some(GameCommand::Pass { player: seat })
                }
                _ => None,
            }
        }
        _ => None,
    }
}
