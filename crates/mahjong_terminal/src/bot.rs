use anyhow::Result;
use std::time::Duration;

use mahjong_ai::{MahjongAI, Difficulty, create_ai};
use mahjong_core::{
    command::GameCommand,
    flow::{GamePhase, TurnStage},
    rules::validator::HandValidator,
    rules::card::UnifiedCard,
};
use mahjong_server::network::messages::Envelope;

use crate::client::{Client, GameState};

/// Simple bot wrapper for automated testing
pub struct Bot {
    ai: Box<dyn MahjongAI>,
    validator: HandValidator,
}

impl Bot {
    pub fn new(difficulty: Difficulty, seed: u64) -> Self {
        let card_json = include_str!("../../../data/cards/unified_card2025.json");
        let card = UnifiedCard::from_json(card_json).expect("Failed to load card");
        let validator = HandValidator::new(&card);
        
        Self {
            ai: create_ai(difficulty, seed),
            validator,
        }
    }

    /// Decide what action to take given the current game state
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
                        &self.validator
                    );
                    if tiles.len() == 3 {
                        return Some(GameCommand::PassTiles { 
                            player: seat, 
                            tiles, 
                            blind_pass_count: None 
                        });
                    }
                } else if *stage == mahjong_core::flow::CharlestonStage::VotingToContinue {
                    let vote = self.ai.vote_charleston(
                        &state.hand, 
                        &state.visible_tiles, 
                        &self.validator
                    );
                    return Some(GameCommand::VoteCharleston { player: seat, vote });
                }
            }
            GamePhase::Playing(stage) => {
                match stage {
                    TurnStage::Discarding { player } if *player == seat => {
                        // Check for win first
                        // (AI trait doesn't have check_win yet, but we can check deficiency)
                        let analysis = self.validator.analyze(&state.hand, 1);
                        if let Some(best) = analysis.first() {
                            if best.deficiency == 0 {
                                return Some(GameCommand::DeclareMahjong { 
                                    player: seat, 
                                    hand: state.hand.clone(), 
                                    winning_tile: None 
                                });
                            }
                        }

                        let tile = self.ai.select_discard(
                            &state.hand, 
                            &state.visible_tiles, 
                            &self.validator
                        );
                        return Some(GameCommand::DiscardTile { player: seat, tile });
                    }
                    TurnStage::Drawing { player } if *player == seat => {
                        return Some(GameCommand::DrawTile { player: seat });
                    }
                    TurnStage::CallWindow { tile, discarded_by, can_act, .. } 
                        if can_act.contains(&seat) && *discarded_by != seat => 
                    {
                        // Simplified: Bot passes on calls for now to keep the loop moving
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

/// Run the bot in auto-play mode
pub async fn run_bot(client: &mut Client, difficulty: Difficulty) -> Result<()> {
    tracing::info!("Bot mode starting with difficulty: {:?}...", difficulty);

    let seed = rand::random::<u64>();
    let mut bot = Bot::new(difficulty, seed);
    let state_arc = client.state.clone();

    loop {
        // 1. Process server messages to keep state updated
        while let Ok(Ok(Some(envelope))) = tokio::time::timeout(
            Duration::from_millis(10),
            client.receive_envelope()
        ).await {
            // handle_server_envelope is private, so we need a public way or move logic
            // For now, let's just update state manually or make it public
            // (I'll make handle_server_envelope public in client.rs if needed, 
            // but let's assume we can call it if we are in the same crate)
            
            // Actually, Client::handle_server_envelope is private. 
            // I should make it public or provide a process_messages() method.
            
            // Re-implementing a simple version here or just using the client's method if I can.
            // I'll go back and make it public.
            client.handle_server_envelope(envelope).await?;
        }

        // 2. Decide and act
        let command = {
            let state = state_arc.lock().await;
            bot.decide_action(&state)
        };

        if let Some(command) = command {
            tracing::info!("Bot taking action: {:?}", command);
            client.send_envelope(Envelope::Command(
                mahjong_server::network::messages::CommandPayload { command }
            )).await?;
            
            // Small delay to prevent tight loops if command is rejected
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        // 3. Wait a bit before next check
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}