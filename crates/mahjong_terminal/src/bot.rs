//! Bot automation for the terminal client.
//!
//! This module wires a `MahjongAI` implementation into the terminal client's
//! network loop, enabling scripted or automated play for testing server flow.

use anyhow::Result;
use std::time::Duration;

use mahjong_ai::{create_ai, Difficulty, MahjongAI};
use mahjong_core::{
    command::GameCommand,
    flow::{GamePhase, TurnStage},
    rules::card::UnifiedCard,
    rules::validator::HandValidator,
};
use mahjong_server::network::messages::Envelope;

use crate::client::{Client, GameState};

/// Automated Mahjong client logic for exercising game flow.
pub struct Bot {
    /// AI decision engine used to pick moves.
    ai: Box<dyn MahjongAI>,
    /// Validator for evaluating hands against the unified card.
    validator: HandValidator,
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
                    // Check if we need to pass (simplified check: we don't have pending passes in local state yet)
                    // For the terminal bot, we'll assume we act whenever we are in this phase
                    // and let the server reject if redundant.
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
                match stage {
                    TurnStage::Discarding { player } if *player == seat => {
                        // Check for win first
                        // TODO: Add an AI-facing win check once the trait exposes it.
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
                        // TODO: Teach the bot to evaluate call opportunities.
                        return Some(GameCommand::Pass { player: seat });
                    }
                    _ => {}
                }
            }
            _ => {}
        }

        None
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
/// let mut client = Client::new("ws://localhost:8080".to_string(), None).await?;
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
            // TODO: Expose a public message-processing API instead of calling a private helper.
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

            // Small delay to prevent tight loops if command is rejected
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        // 3. Wait a bit before next check
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}
