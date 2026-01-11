use crate::{player::Seat, tile::Tile};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

// Re-exports needed for other modules
pub use crate::flow::{GamePhase, PhaseTrigger};

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
    /// Create with a specific card year (uses defaults for other settings).
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
    pub tile: Tile,
    pub discarded_by: Seat,
}

/// Errors that occur during command validation/processing.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CommandError {
    #[error("Command not valid for current phase")]
    WrongPhase,

    #[error("Not your turn")]
    NotYourTurn,

    #[error("Tile not in hand")]
    TileNotInHand,

    #[error("Invalid meld")]
    InvalidMeld,

    #[error("Wall exhausted")]
    WallExhausted,

    #[error("Invalid tile count for pass (expected 3 total)")]
    InvalidPassCount,

    #[error("Cannot pass Jokers during Charleston")]
    ContainsJokers,

    #[error("Blank exchange is not enabled")]
    BlankExchangeNotEnabled,

    #[error("Player not found")]
    PlayerNotFound,

    #[error("Cannot call your own discard")]
    CannotCallOwnDiscard,

    #[error("No discard to call")]
    NoDiscardToCall,

    #[error("Player already voted")]
    AlreadyVoted,

    #[error("Invalid discard index")]
    InvalidDiscardIndex,

    #[error("Meld does not contain a Joker")]
    MeldHasNoJoker,

    #[error("Replacement tile does not match Joker assignment")]
    InvalidReplacement,

    #[error("Target player not found")]
    TargetNotFound,

    #[error("Meld index out of bounds")]
    MeldIndexOutOfBounds,

    #[error("Player has no Blank tile")]
    NoBlankInHand,

    #[error("Call window has no active tile")]
    NoActiveCallWindow,

    #[error("Player cannot act in this call window")]
    CannotActInCallWindow,

    #[error("Blind pass not allowed in this stage")]
    BlindPassNotAllowed,

    #[error("Only East can roll dice")]
    OnlyEastCanRoll,

    #[error("All players have already marked ready")]
    AllPlayersReady,

    #[error("Player has already marked ready")]
    AlreadyReady,

    #[error("Courtesy pass requires 0-3 tiles")]
    InvalidCourtesyPassCount,

    #[error("Not in courtesy pass stage")]
    NotInCourtesyPass,

    #[error("Courtesy pass only allowed between across partners")]
    CourtesyPassOnlyAcross,

    #[error("Invalid command: {0}")]
    InvalidCommand(String),
}
