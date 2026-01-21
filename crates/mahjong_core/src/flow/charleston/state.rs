//! Charleston state tracking for all players.

use std::collections::HashMap;

use crate::player::Seat;
use crate::tile::Tile;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::stage::{CharlestonStage, CharlestonVote};

/// Tracks Charleston state for all players.
///
/// This struct manages the complex state during the Charleston phase:
/// - Current stage (FirstRight, FirstAcross, etc.)
/// - Pending tile selections from each player
/// - Vote tallies for continuing to Second Charleston
/// - Courtesy pass proposals between across partners
/// - Timer for current pass
///
/// # Examples
///
/// ```
/// use mahjong_core::flow::charleston::{CharlestonState, CharlestonStage};
///
/// let state = CharlestonState::new(30);
/// assert_eq!(state.stage, CharlestonStage::FirstRight);
/// assert!(!state.all_players_ready());
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct CharlestonState {
    /// Current stage of the Charleston
    pub stage: CharlestonStage,

    /// Tiles selected by each player for the current pass
    ///
    /// `None` means they haven't selected yet.
    /// During normal passes, each player selects 3 tiles.
    /// During blind pass (FirstLeft/SecondRight), players can select 1-3 tiles.
    /// During courtesy pass, players can select 0-3 tiles.
    pub pending_passes: HashMap<Seat, Option<Vec<Tile>>>,

    /// Votes for continuing to Second Charleston
    ///
    /// Only populated during [`CharlestonStage::VotingToContinue`].
    pub votes: HashMap<Seat, CharlestonVote>,

    /// Timer for the current pass (seconds remaining)
    ///
    /// When the timer reaches zero, players who haven't acted yet
    /// will have tiles auto-selected for them.
    pub timer: Option<u32>,

    /// Courtesy pass proposals by seat (tile count 0-3).
    ///
    /// Only populated during [`CharlestonStage::CourtesyAcross`].
    /// Each across pair (East-West, North-South) negotiates independently.
    /// The final count is the minimum of the two proposals.
    pub courtesy_proposals: HashMap<Seat, Option<u8>>,
}

impl CharlestonState {
    /// Create a new Charleston state starting at FirstRight.
    ///
    /// # Parameters
    ///
    /// - `timer_seconds`: Duration for each pass (typically 30-60 seconds)
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonStage, CharlestonState};
    ///
    /// let state = CharlestonState::new(30);
    /// assert_eq!(state.stage, CharlestonStage::FirstRight);
    /// assert_eq!(state.timer, Some(30));
    /// ```
    pub fn new(timer_seconds: u32) -> Self {
        CharlestonState {
            stage: CharlestonStage::FirstRight,
            pending_passes: HashMap::from([
                (Seat::East, None),
                (Seat::South, None),
                (Seat::West, None),
                (Seat::North, None),
            ]),
            votes: HashMap::new(),
            timer: Some(timer_seconds),
            courtesy_proposals: HashMap::new(),
        }
    }

    /// Check if all players have submitted their tiles for this pass.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::CharlestonState;
    /// use mahjong_core::player::Seat;
    /// use mahjong_core::tile::tiles::JOKER;
    ///
    /// let mut state = CharlestonState::new(60);
    /// assert!(!state.all_players_ready());
    ///
    /// // Simulate all players selecting tiles
    /// for seat in [Seat::East, Seat::South, Seat::West, Seat::North] {
    ///     state.pending_passes.insert(seat, Some(vec![JOKER, JOKER, JOKER]));
    /// }
    /// assert!(state.all_players_ready());
    /// ```
    pub fn all_players_ready(&self) -> bool {
        self.pending_passes.values().all(|tiles| tiles.is_some())
    }

    /// Check if voting is complete.
    ///
    /// Voting is complete when all 4 players have submitted their votes.
    pub fn voting_complete(&self) -> bool {
        self.stage == CharlestonStage::VotingToContinue && self.votes.len() == 4
    }

    /// Get the vote result (Continue only if unanimous).
    ///
    /// Returns `None` if voting is not complete.
    ///
    /// # Vote Resolution Rules
    ///
    /// - If **ANY** player votes Stop, the result is Stop
    /// - Only if **ALL** players vote Continue does the result become Continue
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonState, CharlestonStage, CharlestonVote};
    /// use mahjong_core::player::Seat;
    ///
    /// let mut state = CharlestonState::new(60);
    /// state.stage = CharlestonStage::VotingToContinue;
    ///
    /// state.votes.insert(Seat::East, CharlestonVote::Continue);
    /// state.votes.insert(Seat::South, CharlestonVote::Stop);
    /// state.votes.insert(Seat::West, CharlestonVote::Continue);
    /// state.votes.insert(Seat::North, CharlestonVote::Continue);
    ///
    /// assert_eq!(state.vote_result(), Some(CharlestonVote::Stop));
    /// ```
    pub fn vote_result(&self) -> Option<CharlestonVote> {
        if !self.voting_complete() {
            return None;
        }

        // If ANY player votes Stop, the result is Stop
        if self.votes.values().any(|v| *v == CharlestonVote::Stop) {
            Some(CharlestonVote::Stop)
        } else {
            Some(CharlestonVote::Continue)
        }
    }

    /// Clear pending passes in preparation for the next stage.
    ///
    /// Sets all `pending_passes` entries to `None`.
    pub fn clear_pending_passes(&mut self) {
        for value in self.pending_passes.values_mut() {
            *value = None;
        }
    }

    /// Check if a courtesy pass pair has both proposed.
    ///
    /// # Parameters
    ///
    /// - `pair`: Across partners (e.g., `(Seat::East, Seat::West)`)
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonState, CharlestonStage};
    /// use mahjong_core::player::Seat;
    ///
    /// let mut state = CharlestonState::new(60);
    /// state.stage = CharlestonStage::CourtesyAcross;
    ///
    /// state.courtesy_proposals.insert(Seat::East, Some(3));
    /// state.courtesy_proposals.insert(Seat::West, Some(2));
    ///
    /// assert!(state.courtesy_pair_ready((Seat::East, Seat::West)));
    /// assert!(!state.courtesy_pair_ready((Seat::North, Seat::South)));
    /// ```
    pub fn courtesy_pair_ready(&self, pair: (Seat, Seat)) -> bool {
        self.courtesy_proposals
            .get(&pair.0)
            .and_then(|&p| p)
            .is_some()
            && self
                .courtesy_proposals
                .get(&pair.1)
                .and_then(|&p| p)
                .is_some()
    }

    /// Get the agreed tile count for a courtesy pair (smallest proposal wins).
    ///
    /// Returns `None` if either player hasn't proposed yet.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_core::flow::charleston::{CharlestonState, CharlestonStage};
    /// use mahjong_core::player::Seat;
    ///
    /// let mut state = CharlestonState::new(60);
    /// state.stage = CharlestonStage::CourtesyAcross;
    ///
    /// state.courtesy_proposals.insert(Seat::East, Some(3));
    /// state.courtesy_proposals.insert(Seat::West, Some(2));
    ///
    /// assert_eq!(state.courtesy_agreed_count((Seat::East, Seat::West)), Some(2));
    /// ```
    pub fn courtesy_agreed_count(&self, pair: (Seat, Seat)) -> Option<u8> {
        match (
            self.courtesy_proposals.get(&pair.0).and_then(|&p| p),
            self.courtesy_proposals.get(&pair.1).and_then(|&p| p),
        ) {
            (Some(a), Some(b)) => Some(a.min(b)),
            _ => None,
        }
    }

    /// Check if all courtesy pairs are ready (both pairs proposed).
    ///
    /// Returns `true` only if both East-West and North-South pairs have both proposed.
    pub fn courtesy_all_pairs_ready(&self) -> bool {
        self.courtesy_pair_ready((Seat::East, Seat::West))
            && self.courtesy_pair_ready((Seat::North, Seat::South))
    }

    /// Reset for next stage.
    ///
    /// Clears pending passes and courtesy proposals.
    pub fn reset_for_next_pass(&mut self) {
        self.pending_passes = HashMap::from([
            (Seat::East, None),
            (Seat::South, None),
            (Seat::West, None),
            (Seat::North, None),
        ]);
        self.courtesy_proposals.clear();
    }
}

impl Default for CharlestonState {
    fn default() -> Self {
        Self::new(60)
    }
}
