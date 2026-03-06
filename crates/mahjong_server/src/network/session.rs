//! Session module compatibility shim.
//!
//! This module delegates session concerns to submodules under
//! `crates/mahjong_server/src/network/session/*` while preserving public API
//! behavior and compatibility for Milestone 1 call sites.

mod auth;
mod events;
mod heartbeat;
mod reconnect;
mod state;

pub use state::{Session, SessionStore, StoredSession};
