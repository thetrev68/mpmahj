//! Bot automation for the terminal client.
//!
//! This module wires a `MahjongAI` implementation into the terminal client's
//! network loop, enabling scripted or automated play for testing server flow.

use anyhow::Result;
use std::time::Duration;

use mahjong_ai::{create_ai, Difficulty, MahjongAI};
use mahjong_core::{
    bot_utils::calculate_bot_delay,
    call_resolution::CallIntentKind,
    command::GameCommand,
    flow::playing::TurnStage,
    flow::GamePhase,
    hand::Hand,
    meld::{Meld, MeldType},
    rules::card::UnifiedCard,
    rules::validator::HandValidator,
    tile::{tiles::JOKER, Tile},
};
use mahjong_server::network::messages::Envelope;

use crate::client::{Client, GameState};

/// Automated Mahjong client logic for exercising game flow.
pub struct Bot {
    /// AI decision engine used to pick moves.
    ai: Box<dyn MahjongAI>,
    /// Validator for evaluating hands against the unified card.
    validator: HandValidator,
    /// Track if we've submitted a Charleston pass for the current stage.
    pending_charleston_pass: bool,
    /// Track if we've submitted a discard for the current turn.
    pending_discard: bool,
    /// Track if we've submitted a draw for the current turn.
    pending_draw: bool,
    /// Track if we've submitted a call intent for the current call window.
    pending_call: bool,
    /// Track the last Charleston stage we acted in.
    last_charleston_stage: Option<mahjong_core::flow::charleston::CharlestonStage>,
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
        let card_json = mahjong_core::test_utils::load_test_card_json();
        let card = UnifiedCard::from_json(card_json).expect("Failed to load card");
        let validator = HandValidator::new(&card);

        Self {
            ai: create_ai(difficulty, seed),
            validator,
            pending_charleston_pass: false,
            pending_discard: false,
            pending_draw: false,
            pending_call: false,
            last_charleston_stage: None,
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
                // Check if stage changed - reset pending flag if so
                if self.last_charleston_stage != Some(*stage) {
                    self.pending_charleston_pass = false;
                    self.last_charleston_stage = Some(*stage);
                }

                if stage.requires_pass() {
                    // Only submit if we haven't already passed for this stage
                    if self.pending_charleston_pass {
                        return None;
                    }

                    let tiles = self.ai.select_charleston_tiles(
                        &state.hand,
                        *stage,
                        &state.visible_tiles,
                        &self.validator,
                    );
                    if tiles.len() == 3 {
                        self.pending_charleston_pass = true;
                        return Some(GameCommand::PassTiles {
                            player: seat,
                            tiles,
                            blind_pass_count: None,
                        });
                    }
                } else if *stage
                    == mahjong_core::flow::charleston::CharlestonStage::VotingToContinue
                {
                    // Only submit vote once
                    if self.pending_charleston_pass {
                        return None;
                    }
                    self.pending_charleston_pass = true;
                    let vote =
                        self.ai
                            .vote_charleston(&state.hand, &state.visible_tiles, &self.validator);
                    return Some(GameCommand::VoteCharleston { player: seat, vote });
                }
            }
            GamePhase::Playing(stage) => {
                match stage {
                    TurnStage::Discarding { player } if *player == seat => {
                        // Only submit if we haven't already discarded
                        if self.pending_discard {
                            return None;
                        }

                        // Check for win first
                        let analysis = self.validator.analyze(&state.hand, 1);
                        if let Some(best) = analysis.first() {
                            if best.deficiency == 0 {
                                self.pending_discard = true;
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
                        self.pending_discard = true;
                        return Some(GameCommand::DiscardTile { player: seat, tile });
                    }
                    TurnStage::Drawing { player } if *player == seat => {
                        // Only submit if we haven't already drawn
                        if self.pending_draw {
                            return None;
                        }
                        self.pending_draw = true;
                        return Some(GameCommand::DrawTile { player: seat });
                    }
                    TurnStage::CallWindow {
                        tile,
                        discarded_by,
                        can_act,
                        ..
                    } if can_act.contains(&seat) && *discarded_by != seat => {
                        // Only submit if we haven't already called
                        if self.pending_call {
                            return None;
                        }
                        // Check if we can win with this tile
                        let mut test_hand = state.hand.clone();
                        test_hand.add_tile(*tile);
                        let analysis = self.validator.analyze(&test_hand, 1);
                        if let Some(best) = analysis.first() {
                            if best.deficiency == 0 {
                                self.pending_call = true;
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
                                self.pending_call = true;
                                return Some(GameCommand::DeclareCallIntent {
                                    player: seat,
                                    intent: CallIntentKind::Meld(meld),
                                });
                            }
                        }

                        self.pending_call = true;
                        return Some(GameCommand::Pass { player: seat });
                    }
                    _ => {}
                }
            }
            _ => {}
        }

        None
    }

    /// Update bot state based on game events to clear pending flags.
    pub fn handle_event(
        &mut self,
        event: &mahjong_core::event::GameEvent,
        my_seat: mahjong_core::player::Seat,
    ) {
        use mahjong_core::event::GameEvent;

        match event {
            // Clear draw flag when we receive a private TileDrawn event (tile: Some)
            // This indicates we successfully drew a tile
            GameEvent::TileDrawn { tile: Some(_), .. } => {
                self.pending_draw = false;
            }
            // Clear discard flag when we actually discard
            GameEvent::TileDiscarded { player, .. } if *player == my_seat => {
                self.pending_discard = false;
            }
            // Clear call flag when call window closes or is resolved
            GameEvent::CallWindowClosed | GameEvent::TileCalled { .. } => {
                self.pending_call = false;
            }
            // Clear Charleston pass flag when we receive tiles (pass completed)
            GameEvent::TilesReceived { .. } => {
                self.pending_charleston_pass = false;
            }
            // Clear flags on turn changes
            GameEvent::TurnChanged { .. } => {
                self.pending_draw = false;
                self.pending_discard = false;
                self.pending_call = false;
            }
            _ => {}
        }
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
            // Extract events before handling to update bot state
            if let Envelope::Event(ref payload) = envelope {
                let state = state_arc.lock().await;
                if let Some(my_seat) = state.seat {
                    bot.handle_event(&payload.event, my_seat);
                }
            }
            client.handle_server_envelope(envelope).await?;
        }

        // 2. Decide and act
        let command = {
            let state = state_arc.lock().await;
            bot.decide_action(&state)
        };

        if let Some(command) = command {
            tracing::info!("Bot taking action: {:?}", command);

            // Calculate delay before acting (uses shared bot_utils)
            let delay = {
                let state = state_arc.lock().await;
                calculate_bot_delay(&state.phase)
            };

            // Wait before acting (human-like behavior)
            tokio::time::sleep(delay).await;

            client
                .send_envelope(Envelope::Command(
                    mahjong_server::network::messages::CommandPayload { command },
                ))
                .await?;
        }

        // 3. Wait a bit before next check
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
