//! Turn stage management for main gameplay.
//!
//! This module handles the draw-discard-call loop of the main game phase.
//! After the Charleston completes, players take turns drawing tiles, discarding,
//! and calling each other's discards to build melds.
//!
//! # Turn Flow
//!
//! ```text
//! Drawing → Discarding → CallWindow
//!   ↑                        ↓
//!   └──── (all passed) ──────┘
//!           or
//!           (someone calls) → Discarding (by caller)
//! ```
//!
//! # Examples
//!
//! ```
//! use mahjong_core::flow::playing::{TurnStage, TurnAction};
//! use mahjong_core::player::Seat;
//! use mahjong_core::tile::tiles::DOT_1;
//!
//! let stage = TurnStage::Drawing { player: Seat::East };
//! assert!(stage.can_player_act(Seat::East));
//! assert!(!stage.can_player_act(Seat::South));
//!
//! let (next, _) = stage.next(TurnAction::Draw, Seat::East).unwrap();
//! assert!(matches!(next, TurnStage::Discarding { .. }));
//! ```

use std::collections::HashSet;

use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::StateError;

/// Turn sub-phases during main gameplay.
///
/// The turn structure in American Mahjong differs from other variants:
/// - **Drawing**: Active player draws from wall (unless they just called)
/// - **Discarding**: Active player must discard or declare Mahjong
/// - **CallWindow**: Other players can call the discard for Pung/Kong/Quint/Sextet
///
/// Note: East starts with 14 tiles, so skips Drawing on the first turn.
///
/// # Call Priority
///
/// Multiple players can call the same discard. Priority is:
/// 1. Mahjong (win) beats all other calls
/// 2. Among equal calls, closest player in turn order wins
/// 3. Players cannot call their own discard
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::playing::{TurnStage, TurnAction};
/// use mahjong_core::player::Seat;
/// use mahjong_core::tile::tiles::JOKER;
///
/// // Drawing phase
/// let stage = TurnStage::Drawing { player: Seat::East };
/// let (next, _) = stage.next(TurnAction::Draw, Seat::East).unwrap();
///
/// // Now in Discarding phase
/// let (next, _) = next.next(TurnAction::Discard(JOKER), Seat::East).unwrap();
///
/// // Now in CallWindow phase
/// assert!(matches!(next, TurnStage::CallWindow { .. }));
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TurnStage {
    /// Current player needs to draw a tile from the wall
    ///
    /// Note: East starts with 14 tiles, so skips this on first turn.
    Drawing {
        /// Seat that must perform the draw.
        player: Seat,
    },

    /// Current player has drawn and must now discard or declare Mahjong
    Discarding {
        /// Seat that must discard (or declare Mahjong).
        player: Seat,
    },

    /// A tile was just discarded - other players can call it or pass
    CallWindow {
        /// The tile that was just discarded
        tile: Tile,

        /// Who discarded it (cannot call their own discard)
        discarded_by: Seat,

        /// Players who can still act (haven't passed yet)
        ///
        /// As players pass, they're removed from this set.
        /// When empty, the window closes and next player draws.
        can_act: HashSet<Seat>,

        /// Pending call intents from players
        ///
        /// Accumulated until window closes, then resolved by priority.
        pending_intents: Vec<crate::call_resolution::CallIntent>,

        /// Timer for the call window (typically 5-10 seconds)
        timer: u32,
    },

    /// Waiting for a Mahjong call to be validated after call resolution
    ///
    /// This stage is entered after `resolve_call_window` determines that someone
    /// called Mahjong. The discard tile is temporarily stored here (not consumed yet),
    /// and the server waits for `DeclareMahjong` to validate the winning hand.
    ///
    /// If `DeclareMahjong` is invalid, the game continues. If valid, the tile is
    /// consumed and the game ends in a win.
    AwaitingMahjong {
        /// The player who called Mahjong
        caller: Seat,

        /// The tile that was called
        tile: Tile,

        /// Who discarded the called tile
        discarded_by: Seat,
    },
}

impl TurnStage {
    /// Get the player whose turn it is (for Drawing/Discarding/AwaitingMahjong).
    ///
    /// Returns `None` during a call window because multiple players can act.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::playing::TurnStage;
    /// use mahjong_core::player::Seat;
    ///
    /// let stage = TurnStage::Drawing { player: Seat::East };
    /// assert_eq!(stage.active_player(), Some(Seat::East));
    ///
    /// let stage = TurnStage::Discarding { player: Seat::South };
    /// assert_eq!(stage.active_player(), Some(Seat::South));
    /// ```
    pub fn active_player(&self) -> Option<Seat> {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => Some(*player),
            Self::AwaitingMahjong { caller, .. } => Some(*caller),
            Self::CallWindow { .. } => None, // Multiple players can act
        }
    }

    /// Check if a specific player can take an action right now.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::playing::TurnStage;
    /// use mahjong_core::player::Seat;
    ///
    /// let stage = TurnStage::Drawing { player: Seat::East };
    /// assert!(stage.can_player_act(Seat::East));
    /// assert!(!stage.can_player_act(Seat::South));
    /// ```
    pub fn can_player_act(&self, seat: Seat) -> bool {
        match self {
            Self::Drawing { player } | Self::Discarding { player } => *player == seat,
            Self::AwaitingMahjong { caller, .. } => *caller == seat,
            Self::CallWindow {
                can_act,
                discarded_by,
                ..
            } => {
                // Can't call your own discard
                seat != *discarded_by && can_act.contains(&seat)
            }
        }
    }

    /// Transition to the next stage based on an action.
    ///
    /// # Parameters
    ///
    /// - `action`: The action being taken
    /// - `current_turn`: The current turn holder (for context)
    ///
    /// # Returns
    ///
    /// A tuple of `(next_stage, next_turn_holder)`.
    ///
    /// # Errors
    ///
    /// - [`StateError::InvalidActionForStage`]: Invalid transition for current stage
    /// - [`StateError::CannotCallOwnDiscard`]: Player tried to call their own discard
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::playing::{TurnAction, TurnStage};
    /// use mahjong_core::player::Seat;
    /// use mahjong_core::tile::tiles::DOT_1;
    ///
    /// let stage = TurnStage::Discarding { player: Seat::East };
    /// let (next, _) = stage.next(TurnAction::Discard(DOT_1), Seat::East).unwrap();
    /// assert!(matches!(next, TurnStage::CallWindow { .. }));
    /// ```
    pub fn next(&self, action: TurnAction, current_turn: Seat) -> Result<(Self, Seat), StateError> {
        match (self, action) {
            // Drew a tile → Now must discard
            (Self::Drawing { player }, TurnAction::Draw) => {
                Ok((Self::Discarding { player: *player }, current_turn))
            }

            // Discarded a tile → Open call window for others
            (Self::Discarding { player }, TurnAction::Discard(tile)) => {
                let mut can_act = HashSet::new();
                can_act.insert(player.right());
                can_act.insert(player.across());
                can_act.insert(player.left());

                Ok((
                    Self::CallWindow {
                        tile,
                        discarded_by: *player,
                        can_act,
                        pending_intents: Vec::new(),
                        timer: 10, // Default 10 second window
                    },
                    current_turn,
                ))
            }

            // Player called the discard → They become active player
            (Self::CallWindow { discarded_by, .. }, TurnAction::Call(caller)) => {
                if caller == *discarded_by {
                    return Err(StateError::CannotCallOwnDiscard);
                }
                // Caller gets the tile and must now discard
                Ok((Self::Discarding { player: caller }, caller))
            }

            // All players passed → Next player draws
            (Self::CallWindow { .. }, TurnAction::AllPassed) => {
                let next_player = current_turn.right();
                Ok((
                    Self::Drawing {
                        player: next_player,
                    },
                    next_player,
                ))
            }

            _ => Err(StateError::InvalidActionForStage),
        }
    }
}

/// Actions that can happen during a turn.
///
/// These are the fundamental turn actions in the main game loop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TurnAction {
    /// Draw a tile from the wall.
    Draw,

    /// Discard the provided tile.
    Discard(Tile),

    /// Call the discard as the specified seat.
    ///
    /// The seat parameter indicates who is making the call.
    Call(Seat),

    /// Signal that all eligible players passed.
    ///
    /// This closes the call window and advances to the next turn.
    AllPassed,
}
