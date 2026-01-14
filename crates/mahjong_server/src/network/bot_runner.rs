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
    call_resolution::CallIntentKind,
    command::GameCommand,
    flow::{GamePhase, TurnStage},
    meld::{Meld, MeldType},
    player::{Player, Seat},
    rules::validator::HandValidator,
    table::Table,
    tile::{tiles::JOKER, Tile},
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

        // TODO: Add human-like action delays (charleston, discard, call) instead of a fixed tick.
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
                                    // Select tiles to pass using AI's Charleston logic.
                                    // This reuses the same tile scoring that evaluates
                                    // which tiles contribute least to winning patterns.
                                    let all_candidates = ai.select_charleston_tiles(
                                        &player.hand,
                                        *stage,
                                        &visible,
                                        validator,
                                    );
                                    // Take only the agreed count (0-3) from the AI's selection.
                                    let tiles: Vec<_> = all_candidates
                                        .into_iter()
                                        .take(agreed_count as usize)
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
                    tile,
                    discarded_by,
                    can_act,
                    ..
                } if can_act.contains(&seat) && *discarded_by != seat => {
                    // TODO: Add proper turn_number field to Table for undo/restore support.
                    // Using discard pile length as proxy for now.
                    let turn_number = table.discard_pile.len() as u32;
                    get_call_window_command(
                        player, *tile, *discarded_by, seat, ai, validator, turn_number, &visible,
                    )
                }
                _ => None,
            }
        }
        _ => None,
    }
}

/// Determine the bot's action during a call window.
///
/// Evaluates whether the bot should call the discarded tile based on:
/// 1. Can the bot win (Mahjong) with this tile? (highest priority)
/// 2. Can the bot form a valid meld (Pung/Kong/Quint)?
/// 3. Does the AI strategy recommend calling?
#[allow(clippy::too_many_arguments)]
fn get_call_window_command(
    player: &Player,
    tile: Tile,
    discarded_by: Seat,
    seat: Seat,
    ai: &mut dyn MahjongAI,
    validator: &HandValidator,
    turn_number: u32,
    visible: &mahjong_ai::VisibleTiles,
) -> Option<GameCommand> {
    let hand = &player.hand;

    // Can't call jokers
    if tile.is_joker() {
        return Some(GameCommand::Pass { player: seat });
    }

    // Check if calling this tile would complete a winning hand (Mahjong)
    let mut test_hand = hand.clone();
    test_hand.add_tile(tile);
    if validator.validate_win(&test_hand).is_some() {
        // Declare intent to call for Mahjong
        return Some(GameCommand::DeclareCallIntent {
            player: seat,
            intent: CallIntentKind::Mahjong,
        });
    }

    // Count natural (non-joker) copies of the tile in hand
    let natural_count = hand.concealed.iter().filter(|&&t| t == tile).count();

    // Count jokers in hand (can substitute for natural tiles in melds)
    let joker_count = hand.concealed.iter().filter(|t| t.is_joker()).count();

    // Total tiles available to form meld: naturals + jokers + the called tile
    // But we need at least 1 natural tile (the called tile) to define the meld
    let available_for_meld = natural_count + joker_count;

    // Determine possible meld types based on tiles available in hand
    // Need 2 tiles for Pung (3 total with discard)
    // Need 3 tiles for Kong (4 total with discard)
    // Need 4 tiles for Quint (5 total with discard)
    let possible_melds: Vec<MeldType> = [
        (4, MeldType::Quint),
        (3, MeldType::Kong),
        (2, MeldType::Pung),
    ]
    .into_iter()
    .filter(|(required, _)| available_for_meld >= *required)
    .map(|(_, meld_type)| meld_type)
    .collect();

    // Try each possible meld type, starting with the largest
    for meld_type in possible_melds {
        if ai.should_call(
            hand,
            tile,
            meld_type,
            visible,
            validator,
            turn_number,
            discarded_by,
            seat,
        ) {
            // Build meld tiles: use naturals first, then fill with jokers
            // The called tile is included in the meld
            let meld_size = meld_type.tile_count();
            let tiles_needed_from_hand = meld_size - 1; // -1 for the called tile

            let mut meld_tiles = vec![tile]; // Start with called tile
            let naturals_to_use = natural_count.min(tiles_needed_from_hand);
            let jokers_to_use = tiles_needed_from_hand - naturals_to_use;

            // Add natural tiles from hand, then jokers
            meld_tiles.extend(std::iter::repeat_n(tile, naturals_to_use));
            meld_tiles.extend(std::iter::repeat_n(JOKER, jokers_to_use));

            if let Ok(meld) = Meld::new(meld_type, meld_tiles, Some(tile)) {
                return Some(GameCommand::DeclareCallIntent {
                    player: seat,
                    intent: CallIntentKind::Meld(meld),
                });
            }
        }
    }

    // No call - pass
    Some(GameCommand::Pass { player: seat })
}
