//! Shared table types for rules, timing, and command validation.

use crate::{player::Seat, tile::Tile};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

// Re-exports needed for other modules
pub use crate::flow::{GamePhase, PhaseTrigger};

/// Game mode presets that configure timer durations and behavior.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum GameMode {
    /// Practice mode: Relaxed timers for learning and experimentation.
    /// - Charleston: 120 seconds per pass
    /// - Call window: 15 seconds
    /// - Timer mode: Hidden (no time pressure)
    Practice,

    /// Casual mode: Moderate timers for friendly games.
    /// - Charleston: 60 seconds per pass
    /// - Call window: 10 seconds
    /// - Timer mode: Visible
    Casual,

    /// Competitive mode: Fast-paced timers for serious play.
    /// - Charleston: 30 seconds per pass
    /// - Call window: 5 seconds
    /// - Timer mode: Visible
    Competitive,
}

impl GameMode {
    /// Get Charleston timer duration in seconds for this game mode.
    pub fn charleston_timer_seconds(self) -> u32 {
        match self {
            GameMode::Practice => 120,
            GameMode::Casual => 60,
            GameMode::Competitive => 30,
        }
    }

    /// Get call window duration in seconds for this game mode.
    pub fn call_window_seconds(self) -> u32 {
        match self {
            GameMode::Practice => 15,
            GameMode::Casual => 10,
            GameMode::Competitive => 5,
        }
    }

    /// Get timer mode for this game mode.
    pub fn timer_mode(self) -> TimerMode {
        match self {
            GameMode::Practice => TimerMode::Hidden,
            GameMode::Casual | GameMode::Competitive => TimerMode::Visible,
        }
    }
}

/// Timer behavior mode for call windows and Charleston.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum TimerMode {
    /// Timer is visible to players but does not enforce actions (visual indicator only).
    Visible,
    /// Timer is not shown to players (no time pressure).
    Hidden,
}

/// Complete ruleset configuration for a game.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct Ruleset {
    /// NMJL card year (e.g., 2025).
    pub card_year: u16,

    /// Timer behavior configuration.
    pub timer_mode: TimerMode,

    /// Allow blank tile exchange from discard pile.
    pub blank_exchange_enabled: bool,

    /// Call window duration in seconds.
    pub call_window_seconds: u32,

    /// Charleston pass timer in seconds.
    pub charleston_timer_seconds: u32,
}

impl Default for Ruleset {
    fn default() -> Self {
        Self {
            card_year: 2025,
            timer_mode: TimerMode::Visible,
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 60,
        }
    }
}

impl Ruleset {
    /// Create a ruleset with timer presets for a specific game mode.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{Ruleset, GameMode};
    ///
    /// let ruleset = Ruleset::for_game_mode(GameMode::Practice);
    /// assert_eq!(ruleset.charleston_timer_seconds, 120);
    /// assert_eq!(ruleset.call_window_seconds, 15);
    /// ```
    pub fn for_game_mode(mode: GameMode) -> Self {
        Self {
            card_year: 2025,
            timer_mode: mode.timer_mode(),
            blank_exchange_enabled: false,
            call_window_seconds: mode.call_window_seconds(),
            charleston_timer_seconds: mode.charleston_timer_seconds(),
        }
    }

    /// Create a ruleset for a game mode with a specific card year.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{Ruleset, GameMode};
    ///
    /// let ruleset = Ruleset::for_game_mode_with_year(GameMode::Competitive, 2024);
    /// assert_eq!(ruleset.card_year, 2024);
    /// assert_eq!(ruleset.call_window_seconds, 5);
    /// ```
    pub fn for_game_mode_with_year(mode: GameMode, card_year: u16) -> Self {
        Self {
            card_year,
            timer_mode: mode.timer_mode(),
            blank_exchange_enabled: false,
            call_window_seconds: mode.call_window_seconds(),
            charleston_timer_seconds: mode.charleston_timer_seconds(),
        }
    }
}

/// House rules that modify game behavior. Contains the complete ruleset configuration.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct HouseRules {
    /// The ruleset configuration.
    pub ruleset: Ruleset,

    /// Whether the Always-On Analyst is enabled for this room.
    /// If false, automatic analysis triggers are disabled.
    #[serde(default = "default_analysis_enabled")]
    pub analysis_enabled: bool,
}

fn default_analysis_enabled() -> bool {
    true
}

impl Default for HouseRules {
    fn default() -> Self {
        Self {
            ruleset: Ruleset::default(),
            analysis_enabled: true,
        }
    }
}

impl HouseRules {
    /// Create with timer presets for a specific game mode.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{HouseRules, GameMode};
    ///
    /// let rules = HouseRules::for_game_mode(GameMode::Practice);
    /// assert_eq!(rules.ruleset.charleston_timer_seconds, 120);
    /// ```
    pub fn for_game_mode(mode: GameMode) -> Self {
        Self {
            ruleset: Ruleset::for_game_mode(mode),
            analysis_enabled: true,
        }
    }

    /// Create with a specific card year (uses defaults for other settings).
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::HouseRules;
    ///
    /// let rules = HouseRules::with_card_year(2025);
    /// assert_eq!(rules.ruleset.card_year, 2025);
    /// ```
    pub fn with_card_year(card_year: u16) -> Self {
        Self {
            ruleset: Ruleset {
                card_year,
                ..Ruleset::default()
            },
            analysis_enabled: true,
        }
    }

    /// Create with custom ruleset.
    ///
    /// # Examples
    /// ```
    /// use mahjong_core::table::{HouseRules, Ruleset, TimerMode};
    ///
    /// let ruleset = Ruleset {
    ///     card_year: 2025,
    ///     timer_mode: TimerMode::Hidden,
    ///     blank_exchange_enabled: true,
    ///     call_window_seconds: 5,
    ///     charleston_timer_seconds: 30,
    /// };
    /// let rules = HouseRules::with_ruleset(ruleset);
    /// assert!(rules.ruleset.blank_exchange_enabled);
    /// ```
    pub fn with_ruleset(ruleset: Ruleset) -> Self {
        Self {
            ruleset,
            analysis_enabled: true,
        }
    }
}

/// A discarded tile with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub struct DiscardedTile {
    /// The tile that was discarded.
    pub tile: Tile,
    /// Seat that discarded the tile.
    pub discarded_by: Seat,
}

/// Errors that occur during command validation/processing.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CommandError {
    /// Command not valid for current phase.
    #[error("Command not valid for current phase")]
    WrongPhase,

    /// Returned when a player attempts to act out of turn.
    #[error("Not your turn")]
    NotYourTurn,

    /// Returned when the specified tile is missing from the hand.
    #[error("Tile not in hand")]
    TileNotInHand,

    /// Meld did not pass validation.
    #[error("Invalid meld")]
    InvalidMeld,

    /// Wall has no drawable tiles remaining.
    #[error("Wall exhausted")]
    WallExhausted,

    /// Pass tiles count does not total three.
    #[error("Invalid tile count for pass (expected 3 total)")]
    InvalidPassCount,

    /// Jokers may not be passed during Charleston.
    #[error("Cannot pass Jokers during Charleston")]
    ContainsJokers,

    /// Blank exchange is disabled by ruleset.
    #[error("Blank exchange is not enabled")]
    BlankExchangeNotEnabled,

    /// Seat does not map to a player.
    #[error("Player not found")]
    PlayerNotFound,

    /// A player attempted to call their own discard.
    #[error("Cannot call your own discard")]
    CannotCallOwnDiscard,

    /// No discard was available to call.
    #[error("No discard to call")]
    NoDiscardToCall,

    /// Player already submitted a vote.
    #[error("Player already voted")]
    AlreadyVoted,

    /// Discard index was out of bounds.
    #[error("Invalid discard index")]
    InvalidDiscardIndex,

    /// Meld does not contain a Joker to exchange.
    #[error("Meld does not contain a Joker")]
    MeldHasNoJoker,

    /// Replacement tile does not match the Joker assignment.
    #[error("Replacement tile does not match Joker assignment")]
    InvalidReplacement,

    /// Target seat not found.
    #[error("Target player not found")]
    TargetNotFound,

    /// Meld index was out of bounds.
    #[error("Meld index out of bounds")]
    MeldIndexOutOfBounds,

    /// Player has no Blank tile for exchange.
    #[error("Player has no Blank tile")]
    NoBlankInHand,

    /// Call window had no active tile.
    #[error("Call window has no active tile")]
    NoActiveCallWindow,

    /// Player cannot act in the current call window.
    #[error("Player cannot act in this call window")]
    CannotActInCallWindow,

    /// Blind pass not permitted in this Charleston stage.
    #[error("Blind pass not allowed in this stage")]
    BlindPassNotAllowed,

    /// Only East can roll dice during setup.
    #[error("Only East can roll dice")]
    OnlyEastCanRoll,

    /// All players have already marked ready.
    #[error("All players have already marked ready")]
    AllPlayersReady,

    /// Player has already marked ready.
    #[error("Player has already marked ready")]
    AlreadyReady,

    /// Courtesy pass requires a tile count from 0 to 3.
    #[error("Courtesy pass requires 0-3 tiles")]
    InvalidCourtesyPassCount,

    /// Command issued outside courtesy pass stage.
    #[error("Not in courtesy pass stage")]
    NotInCourtesyPass,

    /// Courtesy pass only allowed between across partners.
    #[error("Courtesy pass only allowed between across partners")]
    CourtesyPassOnlyAcross,

    /// Both players in the courtesy pass pair have not yet proposed.
    #[error("Waiting for both players in pair to propose courtesy pass")]
    IncompleteCourtesyProposal,

    /// Player has a dead hand and cannot act.
    #[error("Player has a dead hand and cannot act")]
    DeadHand,

    /// Player has already submitted tiles for this Charleston pass.
    #[error("Already submitted tiles for this pass")]
    AlreadySubmitted,

    /// Catch-all validation failure for commands.
    #[error("Invalid command: {0}")]
    InvalidCommand(String),
}
