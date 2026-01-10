//! Game commands representing player actions.
//!
//! Commands are sent from clients to the server to express player intent.
//! The server validates each command against the current game state before applying it.
//!
//! See architecture doc: docs/architecture/06-command-event-system-api-contract.md

use crate::{
    flow::CharlestonVote, hand::Hand, hint::HintVerbosity, meld::Meld, player::Seat, tile::Tile,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Actions a player can take during the game.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameCommand {
    // ===== SETUP PHASE =====
    /// East rolls the dice to determine wall break point.
    /// Only valid during Setup(RollingDice) phase.
    RollDice { player: Seat },

    /// Player indicates they've finished organizing their initial hand.
    /// Only valid during Setup(OrganizingHands) phase.
    ReadyToStart { player: Seat },

    // ===== CHARLESTON PHASE =====
    /// Submit tiles to pass during Charleston.
    ///
    /// Standard pass: 3 tiles from hand
    /// Blind pass (FirstLeft/SecondRight only): Can specify tiles to pass directly from incoming tiles
    ///
    /// Validation: tiles.len() + blind_pass_count == 3
    /// Cannot pass Jokers
    PassTiles {
        player: Seat,
        tiles: Vec<Tile>,
        /// Number of incoming tiles to pass blindly (1-3, only on FirstLeft/SecondRight)
        blind_pass_count: Option<u8>,
    },

    /// Vote to continue or stop after First Charleston.
    /// Only valid during Charleston(VotingToContinue) phase.
    VoteCharleston { player: Seat, vote: CharlestonVote },

    /// Propose courtesy pass (0-3 tiles with across partner).
    /// Only valid during Charleston(CourtesyAcross) phase.
    ProposeCourtesyPass { player: Seat, tile_count: u8 },

    /// Confirm and submit tiles for courtesy pass.
    /// Only valid during Charleston(CourtesyAcross) phase after successful negotiation.
    AcceptCourtesyPass { player: Seat, tiles: Vec<Tile> },

    // ===== MAIN GAME PHASE =====
    /// Draw a tile from the wall.
    /// Only valid during Playing(Drawing { player }) when it's the player's turn.
    DrawTile { player: Seat },

    /// Discard a tile from hand.
    /// Only valid during Playing(Discarding { player }) when it's the player's turn.
    /// Tile must be in the player's concealed hand.
    DiscardTile { player: Seat, tile: Tile },

    /// Declare intent to call a discarded tile during CallWindow.
    /// Replaces direct CallTile usage during call windows.
    /// Only valid during Playing(CallWindow).
    /// Caller cannot be the player who discarded.
    /// Intent is buffered until all players pass or timer expires, then resolved by priority.
    DeclareCallIntent {
        player: Seat,
        /// Mahjong or Meld - determines priority
        intent: crate::call_resolution::CallIntentKind,
    },

    /// Call a discarded tile to complete a meld (Pung/Kong/Quint).
    /// Only valid during Playing(CallWindow).
    /// Caller cannot be the player who discarded.
    /// Meld must be valid according to American Mahjong rules.
    /// DEPRECATED: Use DeclareCallIntent instead for proper priority adjudication.
    CallTile { player: Seat, meld: Meld },

    /// Pass on calling the current discard.
    /// Only valid during Playing(CallWindow).
    /// Removes player from the set of players who can act on this discard.
    Pass { player: Seat },

    /// Declare Mahjong (winning hand).
    /// Can be called during Discarding (self-draw) or CallWindow (calling for win).
    /// Server will validate the hand matches a pattern on the current card.
    DeclareMahjong {
        player: Seat,
        hand: Hand,
        /// The tile that completed the hand (if calling from discard, None if self-draw)
        winning_tile: Option<Tile>,
    },

    /// Exchange a Joker from an exposed meld with a real tile.
    /// Player must have the replacement tile in their concealed hand.
    /// Replacement tile must match the tile the Joker represents.
    /// Player receives the Joker.
    ExchangeJoker {
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
        player: Seat,
        /// Index in the discard pile (to handle multiple identical tiles)
        discard_index: usize,
    },

    // ===== GAME MANAGEMENT =====
    /// Request current game state (for reconnection or UI refresh).
    /// Always allowed.
    RequestState { player: Seat },

    /// Request full hand analysis (all pattern evaluations).
    /// Always allowed during active game.
    /// Returns complete analysis with all viable patterns, probabilities, and scores.
    GetAnalysis { player: Seat },

    /// Request hint data for current game state.
    /// Server responds with HintUpdate event containing recommendations.
    /// Always allowed during active game (Practice Mode or Multiplayer).
    RequestHint {
        player: Seat,
        /// Desired hint verbosity level (Beginner/Intermediate/Expert/Disabled)
        verbosity: HintVerbosity,
    },

    /// Set hint verbosity preference for this game.
    /// Player can adjust hint verbosity during gameplay.
    /// Setting persists for the current game session only.
    SetHintVerbosity {
        player: Seat,
        verbosity: HintVerbosity,
    },

    /// Leave the game.
    /// Always allowed.
    /// Player's status will be set to Disconnected.
    LeaveGame { player: Seat },

    /// Abandon the game early.
    /// Requires majority agreement (3/4 players) or single player if InsufficientPlayers.
    /// Game ends immediately with no winner.
    AbandonGame {
        player: Seat,
        reason: crate::flow::AbandonReason,
    },
}

impl GameCommand {
    /// Get the seat of the player who issued this command.
    pub fn player(&self) -> Seat {
        match self {
            Self::RollDice { player } => *player,
            Self::ReadyToStart { player } => *player,
            Self::PassTiles { player, .. } => *player,
            Self::VoteCharleston { player, .. } => *player,
            Self::ProposeCourtesyPass { player, .. } => *player,
            Self::AcceptCourtesyPass { player, .. } => *player,
            Self::DrawTile { player } => *player,
            Self::DiscardTile { player, .. } => *player,
            Self::DeclareCallIntent { player, .. } => *player,
            Self::CallTile { player, .. } => *player,
            Self::Pass { player } => *player,
            Self::DeclareMahjong { player, .. } => *player,
            Self::ExchangeJoker { player, .. } => *player,
            Self::ExchangeBlank { player, .. } => *player,
            Self::RequestState { player } => *player,
            Self::GetAnalysis { player } => *player,
            Self::RequestHint { player, .. } => *player,
            Self::SetHintVerbosity { player, .. } => *player,
            Self::LeaveGame { player } => *player,
            Self::AbandonGame { player, .. } => *player,
        }
    }

    /// Validate the tile count for PassTiles command.
    /// Returns true if the total tiles being passed equals 3.
    pub fn validate_pass_tile_count(&self) -> bool {
        if let Self::PassTiles {
            tiles,
            blind_pass_count,
            ..
        } = self
        {
            let blind_count = blind_pass_count.unwrap_or(0) as usize;
            tiles.len() + blind_count == 3
        } else {
            false
        }
    }

    /// Check if this command contains any Jokers (for validation).
    /// Jokers cannot be passed in Charleston.
    pub fn contains_jokers(&self) -> bool {
        match self {
            Self::PassTiles { tiles, .. } => tiles.iter().any(|t| t.is_joker()),
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

    /// Get the meld being called (if this is a CallTile command).
    pub fn called_meld(&self) -> Option<&Meld> {
        if let Self::CallTile { meld, .. } = self {
            Some(meld)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::meld::MeldType;
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
    fn test_pass_tiles_validation_standard() {
        let tiles = vec![DOT_1, DOT_2, DOT_3];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: None,
        };

        assert!(cmd.validate_pass_tile_count());
    }

    #[test]
    fn test_pass_tiles_validation_blind_pass() {
        let tiles = vec![DOT_1];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: Some(2),
        };

        assert!(cmd.validate_pass_tile_count());
    }

    #[test]
    fn test_pass_tiles_validation_invalid_count() {
        let tiles = vec![DOT_1, DOT_2];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: None,
        };

        assert!(!cmd.validate_pass_tile_count());
    }

    #[test]
    fn test_pass_tiles_validation_all_blind() {
        let tiles = vec![];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: Some(3),
        };

        assert!(cmd.validate_pass_tile_count());
    }

    #[test]
    fn test_contains_jokers_pass_tiles() {
        let tiles = vec![DOT_1, JOKER, DOT_3];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: None,
        };

        assert!(cmd.contains_jokers());
    }

    #[test]
    fn test_contains_jokers_no_jokers() {
        let tiles = vec![DOT_1, DOT_2, DOT_3];
        let cmd = GameCommand::PassTiles {
            player: Seat::East,
            tiles,
            blind_pass_count: None,
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
    fn test_called_meld() {
        let tiles = vec![DOT_5, DOT_5, DOT_5];
        let meld = Meld::new(MeldType::Pung, tiles.clone(), Some(DOT_5)).unwrap();
        let cmd = GameCommand::CallTile {
            player: Seat::East,
            meld: meld.clone(),
        };

        assert_eq!(cmd.called_meld(), Some(&meld));

        let cmd = GameCommand::DrawTile { player: Seat::East };
        assert_eq!(cmd.called_meld(), None);
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
            GameCommand::PassTiles {
                player: Seat::East,
                tiles: vec![],
                blind_pass_count: None,
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
            GameCommand::CallTile {
                player: Seat::East,
                meld: Meld::new(MeldType::Pung, vec![DOT_1, DOT_1, DOT_1], Some(DOT_1)).unwrap(),
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
