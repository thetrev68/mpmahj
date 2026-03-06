//! Game commands representing player actions.
//!
//! Commands are sent from clients to the server to express player intent.
//! The server validates each command against the current game state before applying it.
//!
//! See architecture doc: docs/architecture/06-command-event-system-api-contract.md

use crate::{
    flow::charleston::CharlestonVote, hand::Hand, hint::HintVerbosity, player::Seat, tile::Tile,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Actions a player can take during the game.
///
/// # Examples
/// ```
/// use mahjong_core::command::GameCommand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::tile::tiles::DOT_5;
///
/// let cmd = GameCommand::DiscardTile {
///     player: Seat::East,
///     tile: DOT_5,
/// };
/// assert_eq!(cmd.player(), Seat::East);
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameCommand {
    // ===== SETUP PHASE =====
    /// East rolls the dice to determine wall break point.
    /// Only valid during Setup(RollingDice) phase.
    RollDice {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Player indicates they've finished organizing their initial hand.
    /// Only valid during Setup(OrganizingHands) phase.
    ReadyToStart {
        /// Seat issuing the command.
        player: Seat,
    },

    // ===== CHARLESTON PHASE =====
    /// Commit a Charleston pass from the player's staging area.
    ///
    /// Replaces the legacy `PassTiles` command.  The player specifies which
    /// tiles they are passing from their hand (`from_hand`) and how many of
    /// their staged incoming tiles they want to forward blindly without
    /// absorbing (`forward_incoming_count`).
    ///
    /// Validation invariants:
    /// - `from_hand.len() + forward_incoming_count == 3`
    /// - `forward_incoming_count <= incoming_tiles[player].len()`
    /// - No Jokers in `from_hand`
    /// - Player must not have already submitted for this stage
    CommitCharlestonPass {
        /// Seat issuing the command.
        player: Seat,
        /// Tiles being passed from the player's concealed hand.
        from_hand: Vec<Tile>,
        /// Number of staged incoming tiles to forward without absorbing (0-3).
        /// Only meaningful when incoming tiles are present; must be 0 otherwise.
        forward_incoming_count: u8,
    },

    /// Vote to continue or stop after First Charleston.
    /// Only valid during Charleston(VotingToContinue) phase.
    VoteCharleston {
        /// Seat issuing the command.
        player: Seat,
        /// Continue/stop vote value.
        vote: CharlestonVote,
    },

    /// Propose courtesy pass (0-3 tiles with across partner).
    /// Only valid during Charleston(CourtesyAcross) phase.
    ProposeCourtesyPass {
        /// Seat issuing the command.
        player: Seat,
        /// Proposed courtesy pass tile count (0-3).
        tile_count: u8,
    },

    /// Confirm and submit tiles for courtesy pass.
    /// Only valid during Charleston(CourtesyAcross) phase after successful negotiation.
    AcceptCourtesyPass {
        /// Seat issuing the command.
        player: Seat,
        /// Tiles selected for the courtesy pass.
        tiles: Vec<Tile>,
    },

    // ===== MAIN GAME PHASE =====
    /// Draw a tile from the wall.
    /// Only valid during Playing(Drawing { player }) when it's the player's turn.
    DrawTile {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Discard a tile from hand.
    /// Only valid during Playing(Discarding { player }) when it's the player's turn.
    /// Tile must be in the player's concealed hand.
    DiscardTile {
        /// Seat issuing the command.
        player: Seat,
        /// Tile being discarded.
        tile: Tile,
    },

    /// Declare intent to call a discarded tile during CallWindow.
    /// Replaces direct CallTile usage during call windows.
    /// Only valid during Playing(CallWindow).
    /// Caller cannot be the player who discarded.
    /// Intent is buffered until all players pass or timer expires, then resolved by priority.
    DeclareCallIntent {
        /// Seat issuing the command.
        player: Seat,
        /// Mahjong or Meld - determines priority
        intent: crate::call_resolution::CallIntentKind,
    },

    /// Pass on calling the current discard.
    /// Only valid during Playing(CallWindow).
    /// Removes player from the set of players who can act on this discard.
    Pass {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Declare Mahjong (winning hand).
    /// Can be called during Discarding (self-draw) or CallWindow (calling for win).
    /// Server will validate the hand matches a pattern on the current card.
    DeclareMahjong {
        /// Seat issuing the command.
        player: Seat,
        /// Full hand snapshot at declaration time.
        hand: Hand,
        /// The tile that completed the hand (if calling from discard, None if self-draw)
        winning_tile: Option<Tile>,
    },

    /// Exchange a Joker from an exposed meld with a real tile.
    /// Player must have the replacement tile in their concealed hand.
    /// Replacement tile must match the tile the Joker represents.
    /// Player receives the Joker.
    ExchangeJoker {
        /// Seat issuing the command.
        player: Seat,
        /// The player whose exposed meld contains the Joker
        target_seat: Seat,
        /// Index of the meld in target player's exposed melds
        meld_index: usize,
        /// The real tile being traded for the Joker
        replacement: Tile,
    },

    /// Exchange a blank tile with any tile from the discard pile.
    /// Only valid if house rule is enabled.
    /// Player must have a Blank in their hand.
    /// This is done secretly - other players don't know which tile was taken.
    ExchangeBlank {
        /// Seat issuing the command.
        player: Seat,
        /// Index in the discard pile (to handle multiple identical tiles)
        discard_index: usize,
    },

    /// Upgrade an exposed meld by adding a tile during the player's turn.
    /// Allows transforming Pung → Kong, Kong → Quint, Quint → Sextet, etc.
    /// Only valid during Playing(Discarding) phase on the player's turn.
    /// Player must own the tile being added to the meld.
    /// Player may add-to-exposure before discarding on their turn.
    AddToExposure {
        /// Seat issuing the command.
        player: Seat,
        /// Index of the meld in the player's exposed melds list
        meld_index: usize,
        /// The tile being added to upgrade the meld
        tile: Tile,
    },

    // ===== GAME MANAGEMENT =====
    /// Request current game state (for reconnection or UI refresh).
    /// Always allowed.
    RequestState {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Request full hand analysis (all pattern evaluations).
    /// Always allowed during active game.
    /// Returns complete analysis with all viable patterns, probabilities, and scores.
    GetAnalysis {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Request hint data for current game state.
    /// Server responds with HintUpdate event containing recommendations.
    /// Always allowed during active game (Practice Mode or Multiplayer).
    RequestHint {
        /// Seat issuing the command.
        player: Seat,
        /// Desired hint verbosity level (Beginner/Intermediate/Expert/Disabled)
        verbosity: HintVerbosity,
    },

    /// Set hint verbosity preference for this game.
    /// Player can adjust hint verbosity during gameplay.
    /// Setting persists for the current game session only.
    SetHintVerbosity {
        /// Seat issuing the command.
        player: Seat,
        /// New in-session hint verbosity.
        verbosity: HintVerbosity,
    },

    /// Leave the game.
    /// Always allowed.
    /// Player's status will be set to Disconnected.
    LeaveGame {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Abandon the game early.
    /// Requires majority agreement (3/4 players) or single player if InsufficientPlayers.
    /// Game ends immediately with no winner.
    AbandonGame {
        /// Seat issuing the command.
        player: Seat,
        /// Reason recorded in game outcome.
        reason: crate::flow::outcomes::AbandonReason,
    },

    /// Request full history list (all moves)
    RequestHistory {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Jump to a specific move in history (view mode)
    JumpToMove {
        /// Seat issuing the command.
        player: Seat,
        /// Target move index to view.
        move_number: u32,
    },

    /// Resume playing from current history point (discard future)
    ResumeFromHistory {
        /// Seat issuing the command.
        player: Seat,
        /// Move index to resume from.
        move_number: u32,
    },

    /// Return to present (exit history view mode)
    ReturnToPresent {
        /// Seat issuing the command.
        player: Seat,
    },

    // ===== SMART UNDO SYSTEM =====
    /// Smart Undo: Undo the last significant action (decision point).
    /// Practice Mode: Instant execution.
    /// Multiplayer: Requires unanimous consensus via voting.
    SmartUndo {
        /// Seat issuing the command.
        player: Seat,
    },

    /// Vote on a pending Undo request.
    /// Only valid when an undo request is active.
    VoteUndo {
        /// Seat issuing the command.
        player: Seat,
        /// `true` to approve the undo request.
        approve: bool,
    },

    // ===== MULTIPLAYER STALLING CONTROLS =====
    /// Pause the game.
    /// Only the host (room creator) can pause.
    /// Can be used at any time during the game.
    /// Server responds with GamePaused event.
    PauseGame {
        /// The seat requesting the pause (must be host)
        by: Seat,
    },

    /// Resume a paused game.
    /// Only the host (room creator) can resume.
    /// Only valid when game is paused.
    /// Server responds with GameResumed event.
    ResumeGame {
        /// The seat requesting the resume (must be host)
        by: Seat,
    },

    /// Forfeit the game early.
    /// Any player can forfeit their position.
    /// The game ends immediately with the forfeiting player marked as a loss.
    /// Server responds with PlayerForfeited event followed by GameOver.
    ForfeitGame {
        /// The seat forfeiting the game
        player: Seat,
        /// Optional reason for forfeiting
        reason: Option<String>,
    },
}

impl GameCommand {
    /// Get the seat of the player who issued this command.
    pub fn player(&self) -> Seat {
        match self {
            Self::RollDice { player } => *player,
            Self::ReadyToStart { player } => *player,
            Self::CommitCharlestonPass { player, .. } => *player,
            Self::VoteCharleston { player, .. } => *player,
            Self::ProposeCourtesyPass { player, .. } => *player,
            Self::AcceptCourtesyPass { player, .. } => *player,
            Self::DrawTile { player } => *player,
            Self::DiscardTile { player, .. } => *player,
            Self::DeclareCallIntent { player, .. } => *player,
            Self::Pass { player } => *player,
            Self::DeclareMahjong { player, .. } => *player,
            Self::ExchangeJoker { player, .. } => *player,
            Self::ExchangeBlank { player, .. } => *player,
            Self::AddToExposure { player, .. } => *player,
            Self::RequestState { player } => *player,
            Self::GetAnalysis { player } => *player,
            Self::RequestHint { player, .. } => *player,
            Self::SetHintVerbosity { player, .. } => *player,
            Self::LeaveGame { player } => *player,
            Self::AbandonGame { player, .. } => *player,
            Self::RequestHistory { player } => *player,
            Self::JumpToMove { player, .. } => *player,
            Self::ResumeFromHistory { player, .. } => *player,
            Self::ReturnToPresent { player } => *player,
            Self::SmartUndo { player } => *player,
            Self::VoteUndo { player, .. } => *player,
            Self::PauseGame { by } => *by,
            Self::ResumeGame { by } => *by,
            Self::ForfeitGame { player, .. } => *player,
        }
    }

    /// Validate the total outgoing tile count for `CommitCharlestonPass`.
    ///
    /// Returns `true` when `from_hand.len() + forward_incoming_count == 3`.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::command::GameCommand;
    /// use mahjong_core::player::Seat;
    /// use mahjong_core::tile::tiles::DOT_1;
    ///
    /// let cmd = GameCommand::CommitCharlestonPass {
    ///     player: Seat::East,
    ///     from_hand: vec![DOT_1],
    ///     forward_incoming_count: 2,
    /// };
    /// assert!(cmd.validate_commit_pass_count());
    /// ```
    pub fn validate_commit_pass_count(&self) -> bool {
        if let Self::CommitCharlestonPass {
            from_hand,
            forward_incoming_count,
            ..
        } = self
        {
            from_hand.len() + *forward_incoming_count as usize == 3
        } else {
            false
        }
    }

    /// Check if this command contains any Jokers (for validation).
    /// Jokers cannot be passed in Charleston.
    pub fn contains_jokers(&self) -> bool {
        match self {
            Self::CommitCharlestonPass { from_hand, .. } => from_hand.iter().any(|t| t.is_joker()),
            Self::AcceptCourtesyPass { tiles, .. } => tiles.iter().any(|t| t.is_joker()),
            _ => false,
        }
    }

    /// Get the tile being discarded (if this is a DiscardTile command).
    pub fn discarded_tile(&self) -> Option<Tile> {
        if let Self::DiscardTile { tile, .. } = self {
            Some(*tile)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tile::tiles::{DOT_1, DOT_2, DOT_3, DOT_4, DOT_5, DOT_6, DOT_7, JOKER};

    #[test]
    fn test_player_extraction() {
        let cmd = GameCommand::RollDice { player: Seat::East };
        assert_eq!(cmd.player(), Seat::East);

        let cmd = GameCommand::DrawTile {
            player: Seat::South,
        };
        assert_eq!(cmd.player(), Seat::South);

        let cmd = GameCommand::DiscardTile {
            player: Seat::West,
            tile: DOT_5,
        };
        assert_eq!(cmd.player(), Seat::West);
    }

    #[test]
    fn test_commit_charleston_pass_validation_standard() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![DOT_1, DOT_2, DOT_3],
            forward_incoming_count: 0,
        };

        assert!(cmd.validate_commit_pass_count());
    }

    #[test]
    fn test_commit_charleston_pass_validation_partial_forward() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![DOT_1],
            forward_incoming_count: 2,
        };

        assert!(cmd.validate_commit_pass_count());
    }

    #[test]
    fn test_commit_charleston_pass_validation_invalid_count() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![DOT_1, DOT_2],
            forward_incoming_count: 0,
        };

        assert!(!cmd.validate_commit_pass_count());
    }

    #[test]
    fn test_commit_charleston_pass_validation_all_forward() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![],
            forward_incoming_count: 3,
        };

        assert!(cmd.validate_commit_pass_count());
    }

    #[test]
    fn test_contains_jokers_commit_charleston_pass() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![DOT_1, JOKER, DOT_3],
            forward_incoming_count: 0,
        };

        assert!(cmd.contains_jokers());
    }

    #[test]
    fn test_contains_jokers_no_jokers() {
        let cmd = GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: vec![DOT_1, DOT_2, DOT_3],
            forward_incoming_count: 0,
        };

        assert!(!cmd.contains_jokers());
    }

    #[test]
    fn test_contains_jokers_courtesy_pass() {
        let tiles = vec![JOKER];
        let cmd = GameCommand::AcceptCourtesyPass {
            player: Seat::East,
            tiles,
        };

        assert!(cmd.contains_jokers());
    }

    #[test]
    fn test_discarded_tile() {
        let tile = DOT_5;
        let cmd = GameCommand::DiscardTile {
            player: Seat::East,
            tile,
        };

        assert_eq!(cmd.discarded_tile(), Some(tile));

        let cmd = GameCommand::DrawTile { player: Seat::East };
        assert_eq!(cmd.discarded_tile(), None);
    }

    #[test]
    fn test_command_serialization_round_trip() {
        let cmd = GameCommand::DiscardTile {
            player: Seat::East,
            tile: DOT_5,
        };

        let serialized = serde_json::to_string(&cmd).unwrap();
        let deserialized: GameCommand = serde_json::from_str(&serialized).unwrap();

        assert_eq!(cmd, deserialized);
    }

    #[test]
    fn test_declare_mahjong_with_winning_tile() {
        let hand = Hand::new(vec![
            DOT_1, DOT_1, DOT_2, DOT_2, DOT_3, DOT_3, DOT_4, DOT_4, DOT_5, DOT_5, DOT_6, DOT_6,
            DOT_7,
        ]);

        let cmd = GameCommand::DeclareMahjong {
            player: Seat::East,
            hand: hand.clone(),
            winning_tile: Some(DOT_7),
        };

        assert_eq!(cmd.player(), Seat::East);
        if let GameCommand::DeclareMahjong { winning_tile, .. } = cmd {
            assert_eq!(winning_tile, Some(DOT_7));
        }
    }

    #[test]
    fn test_exchange_joker_command() {
        let cmd = GameCommand::ExchangeJoker {
            player: Seat::East,
            target_seat: Seat::South,
            meld_index: 0,
            replacement: DOT_5,
        };

        assert_eq!(cmd.player(), Seat::East);
    }

    #[test]
    fn test_vote_charleston() {
        let cmd = GameCommand::VoteCharleston {
            player: Seat::East,
            vote: CharlestonVote::Continue,
        };

        assert_eq!(cmd.player(), Seat::East);
    }

    #[test]
    fn test_propose_courtesy_pass() {
        let cmd = GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 2,
        };

        assert_eq!(cmd.player(), Seat::East);
    }

    #[test]
    fn test_all_commands_have_player() {
        // Verify every command variant correctly returns a player
        let commands = vec![
            GameCommand::RollDice { player: Seat::East },
            GameCommand::ReadyToStart { player: Seat::East },
            GameCommand::CommitCharlestonPass {
                player: Seat::East,
                from_hand: vec![],
                forward_incoming_count: 0,
            },
            GameCommand::VoteCharleston {
                player: Seat::East,
                vote: CharlestonVote::Stop,
            },
            GameCommand::ProposeCourtesyPass {
                player: Seat::East,
                tile_count: 0,
            },
            GameCommand::AcceptCourtesyPass {
                player: Seat::East,
                tiles: vec![],
            },
            GameCommand::DrawTile { player: Seat::East },
            GameCommand::DiscardTile {
                player: Seat::East,
                tile: DOT_1,
            },
            GameCommand::Pass { player: Seat::East },
            GameCommand::DeclareMahjong {
                player: Seat::East,
                hand: Hand::empty(),
                winning_tile: None,
            },
            GameCommand::ExchangeJoker {
                player: Seat::East,
                target_seat: Seat::South,
                meld_index: 0,
                replacement: DOT_1,
            },
            GameCommand::ExchangeBlank {
                player: Seat::East,
                discard_index: 0,
            },
            GameCommand::RequestState { player: Seat::East },
            GameCommand::LeaveGame { player: Seat::East },
        ];

        for cmd in commands {
            assert_eq!(cmd.player(), Seat::East);
        }
    }
}
