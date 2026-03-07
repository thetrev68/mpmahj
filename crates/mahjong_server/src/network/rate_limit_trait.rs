//! Trait definitions for rate limiting abstraction.
//!
//! These traits enable pluggable rate-limit backends, supporting both in-memory
//! and distributed (Redis, Postgres) implementations for horizontally scaled deployments.
//!
//! # Motivation
//!
//! In single-instance deployments, in-memory rate limiting is sufficient.
//! In multi-instance deployments, rate limits must be coordinated across instances
//! to prevent abuse (e.g., distributed auth attacks, Charleston pass spam).
//!
//! # Implementation Guidelines
//!
//! ## In-Memory Implementation
//! - Use `DashMap` with timestamp queues (sliding window)
//! - Per-instance enforcement
//! - Suitable for single-instance or lax enforcement
//!
//! ## Distributed Implementation (Redis/Postgres)
//! - Use atomic operations on external store
//! - Global rate limit tracking
//! - Consistent enforcement across all instances
//! - Required for security-sensitive limits (auth, reconnect)
//!
//! # Migration Path
//!
//! The default implementation uses in-memory storage. To support horizontal scaling:
//!
//! 1. **Per-instance limits** (short-term): Configure instances with
//!    `RATE_LIMIT_*` env vars, accept that limits are local per instance.
//!
//! 2. **Redis** (recommended): Add Redis dependency, implement trait for Redis backend
//!    using `INCR` and `EXPIRE` for atomic, distributed counting.
//!
//! 3. **Postgres** (durability): Store rate limit buckets in database, use transactions
//!    for atomicity, implement cleanup via periodic job.

use super::rate_limit::RateLimitError;
use mahjong_core::command::GameCommand;

/// Trait for rate limiting with distributed support.
///
/// Implementations must be thread-safe and support concurrent checks
/// from multiple WebSocket handlers.
pub trait RateLimitStoreTrait: Send + Sync {
    /// Check auth rate limits for IP and connection.
    /// Returns Err if limit exceeded.
    fn check_auth(&self, ip_key: &str, connection_key: &str) -> Result<(), RateLimitError>;

    /// Check reconnect rate limits for token and IP.
    /// Returns Err if limit exceeded.
    fn check_reconnect(&self, token_key: &str, ip_key: &str) -> Result<(), RateLimitError>;

    /// Check command rate limits, with special handling for Charleston passes.
    /// Returns Err if limit exceeded.
    fn check_command(&self, key: &str, command: &GameCommand) -> Result<(), RateLimitError>;

    /// Check room action rate limits (generic command rate limit).
    /// Returns Err if limit exceeded.
    fn check_room_action(&self, key: &str) -> Result<(), RateLimitError>;
}
