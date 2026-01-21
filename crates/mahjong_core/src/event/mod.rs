//! Event enums split by audience and helper methods for routing.
//!
//! The event module is intentionally small-per-file to make it easy to find
//! public, private, and analysis-only variants at a glance. Helper utilities
//! that classify events live alongside the top-level [`Event`] wrapper.

pub mod analysis_events;
pub mod helpers;
pub mod private_events;
pub mod public_events;
pub mod types;

pub use helpers::Event;
