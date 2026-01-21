//! Charleston stage progression and tile-passing logic.

use crate::player::Seat;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::super::StateError;

/// Charleston sub-phases tracking the complex tile-passing sequence.
///
/// The Charleston is a unique American Mahjong tradition where players exchange
/// tiles before the main game begins. It consists of:
///
/// 1. **First Charleston** (mandatory): Right → Across → Left
/// 2. **Vote**: All players vote to continue or stop
/// 3. **Second Charleston** (optional, requires unanimous consent): Left → Across → Right
/// 4. **Courtesy Pass** (optional): Across partners negotiate 0-3 tiles
///
/// # State Flow
///
/// ```text
/// FirstRight → FirstAcross → FirstLeft → VotingToContinue
///                                              ↓         ↓
///                                         (Continue)  (Stop)
///                                              ↓         ↓
///                            SecondLeft → SecondAcross → SecondRight
///                                              ↓         ↓
///                                         CourtesyAcross ←
///                                              ↓
///                                          Complete
/// ```
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::charleston::{CharlestonStage, CharlestonVote, PassDirection};
///
/// let stage = CharlestonStage::FirstRight;
/// assert_eq!(stage.pass_direction(), Some(PassDirection::Right));
/// assert!(!stage.allows_blind_pass());
///
/// let next = stage.next(None).unwrap();
/// assert_eq!(next, CharlestonStage::FirstAcross);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub enum CharlestonStage {
    // ===== FIRST CHARLESTON (Mandatory) =====
    /// First pass: Everyone passes 3 tiles RIGHT
    FirstRight,

    /// Second pass: Everyone passes 3 tiles ACROSS
    FirstAcross,

    /// Third pass: Everyone passes 3 tiles LEFT
    ///
    /// Note: Blind pass/steal option available here
    FirstLeft,

    // ===== DECISION POINT =====
    /// All players vote: Continue to Second Charleston or stop?
    ///
    /// If ANY player votes "stop", move to CourtesyAcross.
    /// If ALL players vote "continue", move to SecondLeft.
    VotingToContinue,

    // ===== SECOND CHARLESTON (Optional - requires unanimous vote) =====
    /// Fourth pass: Everyone passes 3 tiles LEFT (reverse direction)
    SecondLeft,

    /// Fifth pass: Everyone passes 3 tiles ACROSS
    SecondAcross,

    /// Sixth pass: Everyone passes 3 tiles RIGHT
    ///
    /// Note: Blind pass/steal option available here
    SecondRight,

    // ===== COURTESY PASS (Optional) =====
    /// Across partners negotiate passing 0-3 tiles
    ///
    /// East-West negotiate independently of North-South
    CourtesyAcross,

    /// Charleston is complete, transitioning to main game
    Complete,
}

impl CharlestonStage {
    /// Get the direction tiles are being passed.
    ///
    /// Returns `None` for stages without a pass (voting, complete).
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonStage, PassDirection};
    ///
    /// assert_eq!(CharlestonStage::FirstRight.pass_direction(), Some(PassDirection::Right));
    /// assert_eq!(CharlestonStage::VotingToContinue.pass_direction(), None);
    /// ```
    pub fn pass_direction(&self) -> Option<PassDirection> {
        match self {
            Self::FirstRight | Self::SecondRight => Some(PassDirection::Right),
            Self::FirstAcross | Self::SecondAcross => Some(PassDirection::Across),
            Self::FirstLeft | Self::SecondLeft => Some(PassDirection::Left),
            Self::CourtesyAcross => Some(PassDirection::Across),
            Self::VotingToContinue | Self::Complete => None,
        }
    }

    /// Can players do a blind pass/steal on this stage?
    ///
    /// Blind pass/steal is allowed only on the last pass of each Charleston
    /// (FirstLeft and SecondRight). Players can exchange 1-2 tiles "blind"
    /// instead of the normal 3 tiles.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::CharlestonStage;
    ///
    /// assert!(!CharlestonStage::FirstRight.allows_blind_pass());
    /// assert!(CharlestonStage::FirstLeft.allows_blind_pass());
    /// assert!(CharlestonStage::SecondRight.allows_blind_pass());
    /// ```
    pub fn allows_blind_pass(&self) -> bool {
        matches!(self, Self::FirstLeft | Self::SecondRight)
    }

    /// Is this the courtesy pass (different rules)?
    ///
    /// The courtesy pass has special rules:
    /// - Only across partners (East-West, North-South)
    /// - 0-3 tiles (not mandatory 3)
    /// - Both players must agree on the count (minimum wins)
    pub fn is_courtesy_pass(&self) -> bool {
        matches!(self, Self::CourtesyAcross)
    }

    /// Get the next stage after this one completes.
    ///
    /// # Parameters
    ///
    /// - `vote_result`: Required only for [`CharlestonStage::VotingToContinue`].
    ///   - [`Some(CharlestonVote::Continue)`] → Proceed to Second Charleston
    ///   - [`Some(CharlestonVote::Stop)`] → Skip to Courtesy Pass
    ///   - [`None`] → Returns error
    ///
    /// # Errors
    ///
    /// - [`StateError::MissingVoteResult`] if vote result is required but not supplied
    /// - [`StateError::CharlestonAlreadyComplete`] if called on [`CharlestonStage::Complete`]
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonStage, CharlestonVote};
    ///
    /// let stage = CharlestonStage::VotingToContinue;
    /// let next = stage.next(Some(CharlestonVote::Stop)).unwrap();
    /// assert_eq!(next, CharlestonStage::CourtesyAcross);
    ///
    /// let next = stage.next(Some(CharlestonVote::Continue)).unwrap();
    /// assert_eq!(next, CharlestonStage::SecondLeft);
    /// ```
    pub fn next(&self, vote_result: Option<CharlestonVote>) -> Result<Self, StateError> {
        match self {
            Self::FirstRight => Ok(Self::FirstAcross),
            Self::FirstAcross => Ok(Self::FirstLeft),
            Self::FirstLeft => Ok(Self::VotingToContinue),

            Self::VotingToContinue => match vote_result {
                Some(CharlestonVote::Continue) => Ok(Self::SecondLeft),
                Some(CharlestonVote::Stop) => Ok(Self::CourtesyAcross),
                None => Err(StateError::MissingVoteResult),
            },

            Self::SecondLeft => Ok(Self::SecondAcross),
            Self::SecondAcross => Ok(Self::SecondRight),
            Self::SecondRight => Ok(Self::CourtesyAcross),

            Self::CourtesyAcross => Ok(Self::Complete),
            Self::Complete => Err(StateError::CharlestonAlreadyComplete),
        }
    }

    /// Check if this stage requires players to pass tiles.
    ///
    /// Returns `false` for voting and complete stages.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::CharlestonStage;
    ///
    /// assert!(CharlestonStage::FirstRight.requires_pass());
    /// assert!(!CharlestonStage::VotingToContinue.requires_pass());
    /// assert!(!CharlestonStage::Complete.requires_pass());
    /// ```
    pub fn requires_pass(&self) -> bool {
        matches!(
            self,
            Self::FirstRight
                | Self::FirstAcross
                | Self::FirstLeft
                | Self::SecondLeft
                | Self::SecondAcross
                | Self::SecondRight
        )
    }
}

/// Direction for Charleston tile passing.
///
/// Determines which player receives your passed tiles.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub enum PassDirection {
    Right,
    Across,
    Left,
}

impl PassDirection {
    /// Get the target seat for a pass from a given seat.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::PassDirection;
    /// use mahjong_core::player::Seat;
    ///
    /// assert_eq!(PassDirection::Right.target_from(Seat::East), Seat::South);
    /// assert_eq!(PassDirection::Across.target_from(Seat::East), Seat::West);
    /// assert_eq!(PassDirection::Left.target_from(Seat::East), Seat::North);
    /// ```
    pub fn target_from(&self, from: Seat) -> Seat {
        match self {
            PassDirection::Right => from.right(),
            PassDirection::Across => from.across(),
            PassDirection::Left => from.left(),
        }
    }
}

/// Vote for whether to continue to the Second Charleston.
///
/// After the First Charleston completes, all players vote:
/// - [`CharlestonVote::Continue`]: Do the optional Second Charleston
/// - [`CharlestonVote::Stop`]: Skip to Courtesy Pass
///
/// If **ANY** player votes "stop", the vote result is Stop (majority not required).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../apps/client/src/types/bindings/generated/")]
pub enum CharlestonVote {
    /// Do the optional Second Charleston
    Continue,
    /// Skip to Courtesy Pass
    Stop,
}
