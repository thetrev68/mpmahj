//! Game events representing server responses.
//!
//! Events are the authoritative responses from the server that describe what actually
//! happened in the game. They represent the "source of truth" broadcast to clients.
//!
//! Some events are private (sent only to specific players), while others are public
//! (broadcast to all players). The `is_private()` and `target_player()` helper methods
//! distinguish between these cases.

use crate::{
    flow::{CharlestonStage, CharlestonVote, GamePhase, GameResult, PassDirection, TurnStage},
    meld::Meld,
    player::Seat,
    table::TimerMode,
    tile::Tile,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Reason for a replacement draw.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum ReplacementReason {
    /// Drew replacement after declaring Kong.
    Kong,
    /// Drew replacement after declaring Quint.
    Quint,
    /// Drew replacement after exchanging blank tile.
    BlankExchange,
}

/// Events that occur during the game.
/// These represent what actually happened, not what should happen.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameEvent {
    // ===== GAME LIFECYCLE =====
    /// Game was created and is waiting for players
    GameCreated { game_id: String },

    /// A player joined the game
    PlayerJoined {
        player: Seat,
        player_id: String,
        is_bot: bool,
    },

    /// All players joined, game is starting
    GameStarting,

    // ===== SETUP PHASE =====
    /// East rolled the dice
    DiceRolled {
        roll: u8, // 2-12
    },

    /// Wall was broken at the dice position
    WallBroken { position: usize },

    /// Initial tiles dealt to all players (private event)
    /// Server sends different versions to each client
    TilesDealt { your_tiles: Vec<Tile> },

    // ===== CHARLESTON PHASE =====
    /// Charleston phase changed
    CharlestonPhaseChanged { stage: CharlestonStage },

    /// A player submitted their tiles for the current pass
    PlayerReadyForPass { player: Seat },

    /// All players ready, tiles are being passed now
    TilesPassing { direction: PassDirection },

    /// You passed tiles (private).
    TilesPassed { player: Seat, tiles: Vec<Tile> },

    /// You received tiles from a Charleston pass (private)
    TilesReceived {
        player: Seat,
        tiles: Vec<Tile>,
        from: Option<Seat>,
    },

    /// A player voted during the continue/stop decision
    /// (Vote is hidden until all votes are in)
    PlayerVoted { player: Seat },

    /// Voting complete, result announced
    VoteResult { result: CharlestonVote },

    /// Charleston is complete, main game starting
    CharlestonComplete,

    /// Charleston timer started for current pass stage
    CharlestonTimerStarted {
        stage: CharlestonStage,
        duration: u32,      // seconds
        started_at_ms: u64, // Use 0 as placeholder in core crate
        timer_mode: TimerMode,
    },

    /// Player proposed a courtesy pass tile count (pair-private).
    CourtesyPassProposed { player: Seat, tile_count: u8 },

    /// Both players in a pair have proposed, but counts don't match (pair-private).
    CourtesyPassMismatch {
        pair: (Seat, Seat),
        proposed: (u8, u8),
        agreed_count: u8, // smallest wins
    },

    /// A courtesy pair has agreed and is ready to exchange (pair-private).
    CourtesyPairReady { pair: (Seat, Seat), tile_count: u8 },

    /// Courtesy pass complete for the entire table.
    CourtesyPassComplete,

    // ===== MAIN GAME PHASE =====
    /// Game phase changed
    PhaseChanged { phase: GamePhase },

    /// Turn changed to a new player
    TurnChanged { player: Seat, stage: TurnStage },

    /// A tile was drawn from the wall
    /// - Private version (tile: Some) sent to the player who drew
    /// - Public version (tile: None) sent to others
    TileDrawn {
        tile: Option<Tile>,
        remaining_tiles: usize,
    },

    /// Player drew a replacement tile (Kong, Quint, or blank exchange).
    /// This is distinct from normal TileDrawn to track replacement draws explicitly.
    ReplacementDrawn {
        player: Seat,
        tile: Tile,
        reason: ReplacementReason,
    },

    /// A tile was discarded
    TileDiscarded { player: Seat, tile: Tile },

    /// Call window opened (other players can call or pass)
    CallWindowOpened {
        tile: Tile,
        discarded_by: Seat,
        /// Players who can call (excludes discarder)
        can_call: Vec<Seat>,
        /// Timer duration in seconds (from ruleset)
        timer: u32,
        /// Server start timestamp (epoch ms) - use 0 as placeholder in core crate
        started_at_ms: u64,
        /// Whether timer should be shown
        timer_mode: TimerMode,
    },

    /// Call window closed, no one called
    CallWindowClosed,

    /// Call window resolved after buffering intents
    /// Emitted when all players pass or timer expires
    CallResolved {
        resolution: crate::call_resolution::CallResolution,
    },

    /// A player called the discard and exposed a meld
    TileCalled {
        player: Seat,
        meld: Meld,
        called_tile: Tile,
    },

    // ===== SPECIAL ACTIONS =====
    /// A Joker was exchanged from an exposed meld
    JokerExchanged {
        player: Seat,
        target_seat: Seat,
        joker: Tile,
        replacement: Tile,
    },

    /// A blank tile was exchanged (secret, no tile revealed)
    BlankExchanged { player: Seat },

    // ===== WIN/SCORING =====
    /// A player declared Mahjong
    MahjongDeclared { player: Seat },

    /// Hand validation result
    HandValidated {
        player: Seat,
        valid: bool,
        pattern: Option<String>,
    },

    /// Wall exhausted with no winner (draw)
    WallExhausted { remaining_tiles: usize },

    /// Game was abandoned before completion
    GameAbandoned {
        reason: crate::flow::AbandonReason,
        /// Seat that initiated the abandonment (if applicable)
        initiator: Option<Seat>,
    },

    // ===== GAME END =====
    /// Game over
    GameOver {
        winner: Option<Seat>,
        result: GameResult,
    },

    // ===== ERRORS =====
    /// A command was rejected
    CommandRejected { player: Seat, reason: String },
}

impl GameEvent {
    /// Returns true if this event should only be sent to a specific player (private).
    pub fn is_private(&self) -> bool {
        matches!(
            self,
            Self::TilesDealt { .. }
                | Self::TilesReceived { .. }
                | Self::TilesPassed { .. }
                | Self::TileDrawn { tile: Some(_), .. }
                | Self::ReplacementDrawn { .. }
        )
    }

    /// Returns the target player for private events, if applicable.
    /// Returns None for public events.
    pub fn target_player(&self) -> Option<Seat> {
        match self {
            // TilesDealt and TilesReceived don't include the seat in the event
            // because the server needs to send different versions to each player.
            // The target seat is determined by the server routing logic.
            Self::TilesDealt { .. } => {
                // These events are contextual - the server knows who to send them to
                None
            }
            Self::TilesReceived { player, .. } => Some(*player),
            Self::TilesPassed { player, .. } => Some(*player),
            Self::ReplacementDrawn { player, .. } => Some(*player),
            Self::TileDrawn { tile: Some(_), .. } => {
                // The player who drew the tile - determined by server context
                None
            }
            _ => None,
        }
    }

    /// Returns true if this event represents an error or rejection.
    pub fn is_error(&self) -> bool {
        matches!(self, Self::CommandRejected { .. })
    }

    /// Returns true if this event should only be visible to specific seat(s).
    /// Used for pair-scoped courtesy pass events.
    pub fn is_for_seat(&self, seat: Seat) -> bool {
        match self {
            Self::CourtesyPassProposed { player, .. } => *player == seat || player.across() == seat,
            Self::CourtesyPassMismatch { pair, .. } | Self::CourtesyPairReady { pair, .. } => {
                pair.0 == seat || pair.1 == seat
            }
            Self::TileDrawn { tile: Some(_), .. } => {
                // This is contextual - server determines visibility
                false
            }
            Self::ReplacementDrawn { player, .. } => *player == seat,
            Self::TilesDealt { .. } => {
                // This is contextual - server determines visibility
                false
            }
            Self::TilesReceived { player, .. } => *player == seat,
            Self::TilesPassed { player, .. } => *player == seat,
            _ => false,
        }
    }

    /// Returns the player associated with this event, if applicable.
    /// This is different from target_player - it returns the player who performed
    /// the action, not necessarily who should receive the event.
    pub fn associated_player(&self) -> Option<Seat> {
        match self {
            Self::PlayerJoined { player, .. }
            | Self::PlayerReadyForPass { player }
            | Self::PlayerVoted { player }
            | Self::TurnChanged { player, .. }
            | Self::TileDiscarded { player, .. }
            | Self::TileCalled { player, .. }
            | Self::JokerExchanged { player, .. }
            | Self::BlankExchanged { player }
            | Self::MahjongDeclared { player }
            | Self::HandValidated { player, .. }
            | Self::TilesReceived { player, .. }
            | Self::TilesPassed { player, .. }
            | Self::ReplacementDrawn { player, .. }
            | Self::CommandRejected { player, .. }
            | Self::CourtesyPassProposed { player, .. } => Some(*player),
            Self::GameOver { winner, .. } => *winner,
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::meld::MeldType;
    use crate::tile::tiles::{BAM_1, BAM_3, BAM_5, CRAK_7, DOT_5, JOKER};

    #[test]
    fn test_private_event_detection() {
        // Private events
        let tiles_dealt = GameEvent::TilesDealt { your_tiles: vec![] };
        assert!(tiles_dealt.is_private());

        let tiles_received = GameEvent::TilesReceived {
            player: Seat::South,
            tiles: vec![],
            from: None,
        };
        assert!(tiles_received.is_private());

        let tile_drawn_private = GameEvent::TileDrawn {
            tile: Some(BAM_1),
            remaining_tiles: 50,
        };
        assert!(tile_drawn_private.is_private());

        // Public version of TileDrawn
        let tile_drawn_public = GameEvent::TileDrawn {
            tile: None,
            remaining_tiles: 50,
        };
        assert!(!tile_drawn_public.is_private());

        // Public events
        let game_created = GameEvent::GameCreated {
            game_id: "test".to_string(),
        };
        assert!(!game_created.is_private());

        let player_joined = GameEvent::PlayerJoined {
            player: Seat::East,
            player_id: "player1".to_string(),
            is_bot: false,
        };
        assert!(!player_joined.is_private());
    }

    #[test]
    fn test_error_detection() {
        let error_event = GameEvent::CommandRejected {
            player: Seat::East,
            reason: "Invalid move".to_string(),
        };
        assert!(error_event.is_error());

        let normal_event = GameEvent::GameStarting;
        assert!(!normal_event.is_error());
    }

    #[test]
    fn test_associated_player_extraction() {
        let player_joined = GameEvent::PlayerJoined {
            player: Seat::South,
            player_id: "player2".to_string(),
            is_bot: false,
        };
        assert_eq!(player_joined.associated_player(), Some(Seat::South));

        let tile_discarded = GameEvent::TileDiscarded {
            player: Seat::West,
            tile: DOT_5,
        };
        assert_eq!(tile_discarded.associated_player(), Some(Seat::West));

        let game_starting = GameEvent::GameStarting;
        assert_eq!(game_starting.associated_player(), None);

        let game_over = GameEvent::GameOver {
            winner: Some(Seat::North),
            result: GameResult {
                winner: Some(Seat::North),
                winning_pattern: Some("Test Pattern".to_string()),
                score_breakdown: None,
                final_scores: std::collections::HashMap::new(),
                final_hands: std::collections::HashMap::new(),
                next_dealer: Seat::East,
                end_condition: crate::flow::GameEndCondition::Win,
            },
        };
        assert_eq!(game_over.associated_player(), Some(Seat::North));
    }

    #[test]
    fn test_serialization_round_trip() {
        // Test that events can be serialized and deserialized
        let bam3 = BAM_3;
        let event = GameEvent::TileCalled {
            player: Seat::East,
            meld: Meld {
                meld_type: MeldType::Pung,
                tiles: vec![bam3; 3],
                called_tile: Some(bam3),
                joker_assignments: std::collections::HashMap::new(),
            },
            called_tile: bam3,
        };

        let json = serde_json::to_string(&event).unwrap();
        let deserialized: GameEvent = serde_json::from_str(&json).unwrap();

        match deserialized {
            GameEvent::TileCalled { player, .. } => {
                assert_eq!(player, Seat::East);
            }
            _ => panic!("Wrong event type after deserialization"),
        }
    }

    #[test]
    fn test_game_lifecycle_events() {
        let game_created = GameEvent::GameCreated {
            game_id: "game123".to_string(),
        };
        assert!(!game_created.is_private());
        assert!(!game_created.is_error());

        let player_joined = GameEvent::PlayerJoined {
            player: Seat::East,
            player_id: "player1".to_string(),
            is_bot: false,
        };
        assert_eq!(player_joined.associated_player(), Some(Seat::East));

        let game_starting = GameEvent::GameStarting;
        assert!(!game_starting.is_private());
    }

    #[test]
    fn test_setup_phase_events() {
        let dice_rolled = GameEvent::DiceRolled { roll: 7 };
        assert!(!dice_rolled.is_private());

        let wall_broken = GameEvent::WallBroken { position: 42 };
        assert!(!wall_broken.is_private());

        let tiles_dealt = GameEvent::TilesDealt {
            your_tiles: vec![BAM_1],
        };
        assert!(tiles_dealt.is_private());
    }

    #[test]
    fn test_charleston_events() {
        let phase_changed = GameEvent::CharlestonPhaseChanged {
            stage: CharlestonStage::FirstRight,
        };
        assert!(!phase_changed.is_private());

        let player_ready = GameEvent::PlayerReadyForPass {
            player: Seat::South,
        };
        assert_eq!(player_ready.associated_player(), Some(Seat::South));

        let tiles_passing = GameEvent::TilesPassing {
            direction: PassDirection::Right,
        };
        assert!(!tiles_passing.is_private());

        let tiles_received = GameEvent::TilesReceived {
            player: Seat::South,
            tiles: vec![DOT_5; 3],
            from: None,
        };
        assert!(tiles_received.is_private());

        let player_voted = GameEvent::PlayerVoted { player: Seat::West };
        assert_eq!(player_voted.associated_player(), Some(Seat::West));

        let vote_result = GameEvent::VoteResult {
            result: CharlestonVote::Continue,
        };
        assert!(!vote_result.is_private());

        let charleston_complete = GameEvent::CharlestonComplete;
        assert!(!charleston_complete.is_private());
    }

    #[test]
    fn test_main_game_events() {
        let phase_changed = GameEvent::PhaseChanged {
            phase: GamePhase::Playing(TurnStage::Discarding { player: Seat::East }),
        };
        assert!(!phase_changed.is_private());

        let turn_changed = GameEvent::TurnChanged {
            player: Seat::South,
            stage: TurnStage::Drawing {
                player: Seat::South,
            },
        };
        assert_eq!(turn_changed.associated_player(), Some(Seat::South));

        let call_window_opened = GameEvent::CallWindowOpened {
            tile: CRAK_7,
            discarded_by: Seat::North,
            can_call: vec![Seat::East, Seat::South, Seat::West],
            timer: 10,
            started_at_ms: 0,
            timer_mode: TimerMode::Visible,
        };
        assert!(!call_window_opened.is_private());

        let call_window_closed = GameEvent::CallWindowClosed;
        assert!(!call_window_closed.is_private());
    }

    #[test]
    fn test_special_action_events() {
        let joker_exchanged = GameEvent::JokerExchanged {
            player: Seat::North,
            target_seat: Seat::East,
            joker: JOKER,
            replacement: BAM_5,
        };
        assert_eq!(joker_exchanged.associated_player(), Some(Seat::North));
        assert!(!joker_exchanged.is_private());

        let blank_exchanged = GameEvent::BlankExchanged { player: Seat::West };
        assert_eq!(blank_exchanged.associated_player(), Some(Seat::West));
    }

    #[test]
    fn test_win_scoring_events() {
        let mahjong_declared = GameEvent::MahjongDeclared { player: Seat::East };
        assert_eq!(mahjong_declared.associated_player(), Some(Seat::East));
        assert!(!mahjong_declared.is_private());

        let hand_validated = GameEvent::HandValidated {
            player: Seat::East,
            valid: true,
            pattern: Some("2468 Consecutive Run".to_string()),
        };
        assert_eq!(hand_validated.associated_player(), Some(Seat::East));
        assert!(!hand_validated.is_private());

        let game_over = GameEvent::GameOver {
            winner: Some(Seat::East),
            result: GameResult {
                winner: Some(Seat::East),
                winning_pattern: Some("2468 Consecutive Run".to_string()),
                score_breakdown: None,
                final_scores: std::collections::HashMap::new(),
                final_hands: std::collections::HashMap::new(),
                next_dealer: Seat::East,
                end_condition: crate::flow::GameEndCondition::Win,
            },
        };
        assert_eq!(game_over.associated_player(), Some(Seat::East));
    }

    #[test]
    fn test_command_rejected_event() {
        let rejected = GameEvent::CommandRejected {
            player: Seat::South,
            reason: "Not your turn".to_string(),
        };
        assert!(rejected.is_error());
        assert_eq!(rejected.associated_player(), Some(Seat::South));
        assert!(!rejected.is_private());
    }
}
