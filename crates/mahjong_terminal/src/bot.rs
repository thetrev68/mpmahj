//! Bot automation for the terminal client.
//!
//! This module wires a `MahjongAI` implementation into the terminal client's
//! network loop, enabling scripted or automated play for testing server flow.

use anyhow::Result;
use std::time::Duration;

use mahjong_ai::{create_ai, Difficulty, MahjongAI};
use mahjong_core::{
    call_resolution::CallIntentKind,
    command::GameCommand,
    flow::{GamePhase, TurnStage},
    hand::Hand,
    meld::{Meld, MeldType},
    rules::card::UnifiedCard,
    rules::validator::HandValidator,
    tile::{tiles::JOKER, Tile},
};
use mahjong_server::network::messages::Envelope;

use crate::client::{Client, GameState};

/// Automated Mahjong client logic for exercising game flow.
///
/// # Known Issues (TODO)
///
/// 1. **No pending action tracking**: The bot doesn't track whether it has already
///    submitted a command for the current phase (e.g., PassTiles during Charleston).
///    This causes duplicate submissions that the server rejects or rate-limits.
///
/// 2. **No rate limit back-off**: When the server returns "Command rate limit exceeded",
///    the bot should wait longer before retrying (exponential back-off), not just 500ms.
///
/// 3. **No variable "thinking time"**: The server-side bot runner in
///    `mahjong_server::network::bot_runner::calculate_delay()` has proper variable delays
///    (2-4s Charleston, 1-3s discarding, etc.). This terminal bot uses a fixed 500ms
///    which is too fast and causes rate limiting. Either extract that logic to a shared
///    crate, or duplicate it here.
pub struct Bot {
    /// AI decision engine used to pick moves.
    ai: Box<dyn MahjongAI>,
    /// Validator for evaluating hands against the unified card.
    validator: HandValidator,
    // TODO: Add fields to track pending actions:
    // - `pending_charleston_pass: bool` - true after submitting PassTiles, cleared on TilesPassed/TilesReceived
    // - `pending_discard: bool` - true after submitting DiscardTile, cleared on TileDiscarded event
    // - `pending_call: bool` - true after submitting DeclareCallIntent, cleared on resolution
    // - `last_error_was_rate_limit: bool` - for exponential back-off
    // - `consecutive_rate_limits: u32` - to calculate back-off duration
}

impl Bot {
    /// Create a new bot with a deterministic seed.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_ai::Difficulty;
    /// use mahjong_terminal::bot::Bot;
    ///
    /// let bot = Bot::new(Difficulty::Easy, 42);
    /// ```
    pub fn new(difficulty: Difficulty, seed: u64) -> Self {
        let card_json = include_str!("../../../data/cards/unified_card2025.json");
        let card = UnifiedCard::from_json(card_json).expect("Failed to load card");
        let validator = HandValidator::new(&card);

        Self {
            ai: create_ai(difficulty, seed),
            validator,
        }
    }

    /// Decide the next action to take given the current game state.
    ///
    /// Returns `None` when the bot has no valid action for the phase.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_ai::Difficulty;
    /// use mahjong_terminal::bot::Bot;
    /// use mahjong_terminal::client::GameState;
    ///
    /// let mut bot = Bot::new(Difficulty::Easy, 42);
    /// let state = GameState::default();
    /// let action = bot.decide_action(&state);
    /// ```
    pub fn decide_action(&mut self, state: &GameState) -> Option<GameCommand> {
        let seat = state.seat?;

        match &state.phase {
            GamePhase::Charleston(stage) => {
                if stage.requires_pass() {
                    // TODO: BUG - This logic is broken in multiple ways:
                    //
                    // 1. No pending pass tracking: We submit PassTiles every loop iteration
                    //    until the phase changes, causing rate limit errors and duplicate
                    //    submissions. Should track `pending_charleston_pass` and only submit
                    //    once per stage.
                    //
                    // 2. Stale hand state: The client's `state.hand` may not reflect tiles
                    //    we already passed. The server emits TilesPassed events, but
                    //    client.rs doesn't handle them (see update_state_from_event).
                    //    This causes "Tile not in hand" errors when we try to pass tiles
                    //    we already passed in a previous stage.
                    //
                    // FIX: Add TilesPassed handler in client.rs to remove passed tiles,
                    // and add pending_charleston_pass flag here to avoid re-submitting.
                    let tiles = self.ai.select_charleston_tiles(
                        &state.hand,
                        *stage,
                        &state.visible_tiles,
                        &self.validator,
                    );
                    if tiles.len() == 3 {
                        return Some(GameCommand::PassTiles {
                            player: seat,
                            tiles,
                            blind_pass_count: None,
                        });
                    }
                } else if *stage == mahjong_core::flow::CharlestonStage::VotingToContinue {
                    let vote =
                        self.ai
                            .vote_charleston(&state.hand, &state.visible_tiles, &self.validator);
                    return Some(GameCommand::VoteCharleston { player: seat, vote });
                }
            }
            GamePhase::Playing(stage) => {
                // TODO: Similar issues exist here as in Charleston:
                //
                // 1. No pending action tracking: If we submit DiscardTile or DrawTile,
                //    we'll keep re-submitting until the phase changes. Need to track
                //    pending_discard, pending_draw, pending_call flags.
                //
                // 2. The TileDiscarded handler in client.rs DOES remove tiles from our
                //    hand (unlike TilesPassed), so that part is OK. But we still spam
                //    the server with duplicate commands.
                match stage {
                    TurnStage::Discarding { player } if *player == seat => {
                        // Check for win first
                        let analysis = self.validator.analyze(&state.hand, 1);
                        if let Some(best) = analysis.first() {
                            if best.deficiency == 0 {
                                return Some(GameCommand::DeclareMahjong {
                                    player: seat,
                                    hand: state.hand.clone(),
                                    winning_tile: None,
                                });
                            }
                        }

                        let tile = self.ai.select_discard(
                            &state.hand,
                            &state.visible_tiles,
                            &self.validator,
                        );
                        return Some(GameCommand::DiscardTile { player: seat, tile });
                    }
                    TurnStage::Drawing { player } if *player == seat => {
                        return Some(GameCommand::DrawTile { player: seat });
                    }
                    TurnStage::CallWindow {
                        tile,
                        discarded_by,
                        can_act,
                        ..
                    } if can_act.contains(&seat) && *discarded_by != seat => {
                        // Check if we can win with this tile
                        let mut test_hand = state.hand.clone();
                        test_hand.add_tile(*tile);
                        let analysis = self.validator.analyze(&test_hand, 1);
                        if let Some(best) = analysis.first() {
                            if best.deficiency == 0 {
                                return Some(GameCommand::DeclareCallIntent {
                                    player: seat,
                                    intent: CallIntentKind::Mahjong,
                                });
                            }
                        }

                        // Check for meld opportunities (Pung/Kong/Quint)
                        if let Some((meld_type, meld)) =
                            self.evaluate_call(&state.hand, *tile, *discarded_by, seat)
                        {
                            if self.ai.should_call(
                                &state.hand,
                                *tile,
                                meld_type,
                                &state.visible_tiles,
                                &self.validator,
                                0, // Turn number not tracked in terminal client
                                *discarded_by,
                                seat,
                            ) {
                                return Some(GameCommand::DeclareCallIntent {
                                    player: seat,
                                    intent: CallIntentKind::Meld(meld),
                                });
                            }
                        }

                        return Some(GameCommand::Pass { player: seat });
                    }
                    _ => {}
                }
            }
            _ => {}
        }

        None
    }

    /// Evaluate whether a meld can be formed with the discarded tile.
    ///
    /// Returns the largest valid meld type (Quint > Kong > Pung) along with
    /// the constructed meld, or `None` if no meld is possible.
    fn evaluate_call(
        &self,
        hand: &Hand,
        discard: Tile,
        _discarded_by: mahjong_core::player::Seat,
        _seat: mahjong_core::player::Seat,
    ) -> Option<(MeldType, Meld)> {
        // Can't call jokers
        if discard.is_joker() {
            return None;
        }

        // Count matching tiles in hand (naturals + jokers as wildcards)
        let natural_count = hand.count_tile(discard);
        let joker_count = hand.count_tile(JOKER);
        let usable_count = natural_count + joker_count;

        // Determine the best meld we can form (prefer larger melds)
        // Quint needs 4 in hand + 1 called = 5
        // Kong needs 3 in hand + 1 called = 4
        // Pung needs 2 in hand + 1 called = 3
        let meld_type = if usable_count >= 4 {
            MeldType::Quint
        } else if usable_count >= 3 {
            MeldType::Kong
        } else if usable_count >= 2 {
            MeldType::Pung
        } else {
            return None;
        };

        // Build the meld tiles: use naturals first, then jokers
        let tiles_needed = meld_type.tile_count();
        let from_hand = tiles_needed - 1; // One comes from the discard
        let naturals_to_use = natural_count.min(from_hand);
        let jokers_to_use = from_hand - naturals_to_use;

        let mut tiles = vec![discard; naturals_to_use];
        tiles.extend(std::iter::repeat_n(JOKER, jokers_to_use));
        tiles.push(discard); // The called tile

        Meld::new(meld_type, tiles, Some(discard))
            .ok()
            .map(|meld| (meld_type, meld))
    }
}

/// Run the bot in auto-play mode until the process is stopped or an error occurs.
///
/// This loop continuously drains server messages, evaluates the current state,
/// and submits commands with short delays to avoid tight-looping.
///
/// # Examples
///
/// ```ignore
/// use anyhow::Result;
/// use mahjong_ai::Difficulty;
/// use mahjong_terminal::bot::run_bot;
/// use mahjong_terminal::client::Client;
///
/// # async fn run() -> Result<()> {
/// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
/// client.connect().await?;
/// client.authenticate().await?;
/// run_bot(&mut client, Difficulty::Easy).await?;
/// # Ok(())
/// # }
/// ```
pub async fn run_bot(client: &mut Client, difficulty: Difficulty) -> Result<()> {
    tracing::info!("Bot mode starting with difficulty: {:?}...", difficulty);

    let seed = rand::random::<u64>();
    let mut bot = Bot::new(difficulty, seed);
    let state_arc = client.state.clone();

    loop {
        // 1. Process server messages to keep state updated
        while let Ok(Ok(Some(envelope))) =
            tokio::time::timeout(Duration::from_millis(10), client.receive_envelope()).await
        {
            client.handle_server_envelope(envelope).await?;
        }

        // 2. Decide and act
        let command = {
            let state = state_arc.lock().await;
            bot.decide_action(&state)
        };

        if let Some(command) = command {
            tracing::info!("Bot taking action: {:?}", command);
            client
                .send_envelope(Envelope::Command(
                    mahjong_server::network::messages::CommandPayload { command },
                ))
                .await?;

            // TODO: Implement proper delay and back-off logic:
            //
            // 1. Variable "thinking time": The server-side bot runner already has this!
            //    See `mahjong_server::network::bot_runner::calculate_delay()` which uses:
            //    - Charleston: 2000-4000ms (stays slow)
            //    - Drawing: 200-500ms
            //    - Discarding: 1000-3000ms (speeds up as wall empties)
            //    - CallWindow: 800-2000ms (speeds up as wall empties)
            //    Consider extracting that logic to a shared crate or duplicating it here.
            //
            // 2. Rate limit back-off: Track consecutive rate limit errors and use
            //    exponential back-off (e.g., 1s, 2s, 4s, 8s...) instead of fixed 500ms.
            //    Reset the counter when a command succeeds.
            //
            // 3. Error-specific handling: The bot loop doesn't currently see server
            //    errors - they're logged in client.rs but not communicated back here.
            //    Consider adding an error channel or checking a flag after send_envelope.
            //
            // Small delay to prevent tight loops if command is rejected
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        // 3. Wait a bit before next check
        // TODO: This fixed 100ms polling is fine, but consider event-driven approach
        // where the bot only wakes up when a relevant event arrives.
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
