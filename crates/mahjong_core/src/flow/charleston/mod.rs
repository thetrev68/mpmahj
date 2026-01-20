//! Charleston subsystem - tile passing phase.
//!
//! The Charleston is a unique American Mahjong tradition where players exchange
//! tiles before the main game begins. This module handles all Charleston logic:
//!
//! - [`CharlestonStage`]: State machine for pass progression
//! - [`CharlestonState`]: Tracking player selections and votes
//! - [`PassDirection`]: Right, Across, Left
//! - [`CharlestonVote`]: Continue or Stop
//!
//! # Charleston Flow
//!
//! 1. **First Charleston** (mandatory)
//!    - Pass Right (3 tiles)
//!    - Pass Across (3 tiles)
//!    - Pass Left (3 tiles, blind pass/steal allowed)
//! 2. **Voting**: All players vote Continue or Stop
//! 3. **Second Charleston** (optional, requires unanimous Continue vote)
//!    - Pass Left (3 tiles)
//!    - Pass Across (3 tiles)
//!    - Pass Right (3 tiles, blind pass/steal allowed)
//! 4. **Courtesy Pass** (optional)
//!    - Across partners negotiate 0-3 tiles
//!    - East-West and North-South pairs are independent
//!
//! # Examples
//!
//! ```
//! use mahjong_core::flow::charleston::{CharlestonStage, CharlestonState, CharlestonVote};
//!
//! let mut state = CharlestonState::new(30);
//! assert_eq!(state.stage, CharlestonStage::FirstRight);
//!
//! // Simulate progression through First Charleston
//! state.stage = state.stage.next(None).unwrap(); // FirstAcross
//! state.stage = state.stage.next(None).unwrap(); // FirstLeft
//! state.stage = state.stage.next(None).unwrap(); // VotingToContinue
//!
//! // Vote to stop
//! state.stage = state.stage.next(Some(CharlestonVote::Stop)).unwrap();
//! assert_eq!(state.stage, CharlestonStage::CourtesyAcross);
//! ```

pub mod stage;
pub mod state;

#[cfg(test)]
mod tests;

pub use stage::{CharlestonStage, CharlestonVote, PassDirection};
pub use state::CharlestonState;
