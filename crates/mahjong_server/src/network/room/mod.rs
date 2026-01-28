//! Room module with composition-based architecture.
//!
//! This module organizes room functionality into separate manager types:
//! - `SessionManager`: Player sessions, bots, and host assignment
//! - `AnalysisManager`: AI analysis, caching, and hints
//! - `HistoryManager`: Move history, undo/redo, and pause state

pub mod analysis_manager;
pub mod history_manager;
pub mod session_manager;

pub use analysis_manager::AnalysisManager;
pub use history_manager::{HistoryManager, UndoRequest};
pub use session_manager::SessionManager;
