//! Rate limiting utilities for WebSocket clients.
//!
//! This module implements per-client rate limits for auth, commands,
//! and reconnection attempts using a fixed-window counter.
//!
//! ```no_run
//! use mahjong_server::network::rate_limit::RateLimitStore;
//! let limits = RateLimitStore::new();
//! let _ = limits.check_room_action("player-1");
//! ```

use dashmap::DashMap;
use mahjong_core::command::GameCommand;
use std::collections::VecDeque;
use std::env;
use std::time::{Duration, Instant};

/// Error returned when a rate limit is exceeded.
#[derive(Debug, Clone)]
pub struct RateLimitError {
    /// Suggested delay before retrying, in milliseconds.
    pub retry_after_ms: u64,
}

/// Fixed-window rate limiter keyed by string identifiers.
struct RateLimiter {
    /// Sliding window length.
    window: Duration,
    /// Maximum requests allowed in the window.
    max_requests: usize,
    /// Timestamp queue per key.
    hits: DashMap<String, VecDeque<Instant>>,
}

impl RateLimiter {
    /// Constructs a limiter with a window length and request cap.
    fn new(window: Duration, max_requests: usize) -> Self {
        Self {
            window,
            max_requests,
            hits: DashMap::new(),
        }
    }

    /// Records a hit and returns an error if the limit is exceeded.
    fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let mut entry = self.hits.entry(key.to_string()).or_default();

        while let Some(front) = entry.front() {
            if now.duration_since(*front) >= self.window {
                entry.pop_front();
            } else {
                break;
            }
        }

        if entry.len() >= self.max_requests {
            let retry_after = entry
                .front()
                .map(|oldest| {
                    let elapsed = now.duration_since(*oldest);
                    self.window
                        .checked_sub(elapsed)
                        .unwrap_or_else(|| Duration::from_millis(0))
                        .as_millis() as u64
                })
                .unwrap_or(0);

            return Err(RateLimitError {
                retry_after_ms: retry_after,
            });
        }

        entry.push_back(now);
        Ok(())
    }
}

/// Rate limiters for different request categories.
pub struct RateLimitStore {
    /// Rate limit for auth attempts by IP.
    auth: RateLimiter,
    /// Rate limit for auth attempts per connection.
    auth_connection: RateLimiter,
    /// General command rate limit.
    commands: RateLimiter,
    /// Reconnect rate limit per token.
    reconnect: RateLimiter,
    /// Reconnect rate limit per IP.
    reconnect_ip: RateLimiter,
    /// Charleston pass rate limit to avoid spam.
    charleston_pass: RateLimiter,
}

impl RateLimitStore {
    fn env_u64(key: &str, default: u64) -> u64 {
        env::var(key)
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(default)
    }

    fn env_usize(key: &str, default: usize) -> usize {
        env::var(key)
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(default)
    }

    /// Builds the default rate limit configuration.
    pub fn new() -> Self {
        let auth_window_secs = Self::env_u64("RATE_LIMIT_AUTH_WINDOW_SECS", 60);
        let auth_max = Self::env_usize("RATE_LIMIT_AUTH_MAX", 5);
        let auth_connection_window_secs =
            Self::env_u64("RATE_LIMIT_AUTH_CONNECTION_WINDOW_SECS", auth_window_secs);
        let auth_connection_max = Self::env_usize("RATE_LIMIT_AUTH_CONNECTION_MAX", 5);

        let command_window_secs = Self::env_u64("RATE_LIMIT_COMMAND_WINDOW_SECS", 2);
        let command_max = Self::env_usize("RATE_LIMIT_COMMAND_MAX", 10);

        let reconnect_window_secs = Self::env_u64("RATE_LIMIT_RECONNECT_WINDOW_SECS", 60);
        let reconnect_max = Self::env_usize("RATE_LIMIT_RECONNECT_MAX", 5);
        let reconnect_ip_window_secs =
            Self::env_u64("RATE_LIMIT_RECONNECT_IP_WINDOW_SECS", reconnect_window_secs);
        let reconnect_ip_max = Self::env_usize("RATE_LIMIT_RECONNECT_IP_MAX", 5);

        let charleston_window_secs = Self::env_u64("RATE_LIMIT_CHARLESTON_WINDOW_SECS", 1);
        let charleston_max = Self::env_usize("RATE_LIMIT_CHARLESTON_MAX", 1);

        Self {
            auth: RateLimiter::new(Duration::from_secs(auth_window_secs), auth_max),
            auth_connection: RateLimiter::new(
                Duration::from_secs(auth_connection_window_secs),
                auth_connection_max,
            ),
            commands: RateLimiter::new(Duration::from_secs(command_window_secs), command_max),
            reconnect: RateLimiter::new(Duration::from_secs(reconnect_window_secs), reconnect_max),
            reconnect_ip: RateLimiter::new(
                Duration::from_secs(reconnect_ip_window_secs),
                reconnect_ip_max,
            ),
            charleston_pass: RateLimiter::new(
                Duration::from_secs(charleston_window_secs),
                charleston_max,
            ),
        }
    }

    /// Applies auth rate limits for the given IP and connection.
    pub fn check_auth(&self, ip_key: &str, connection_key: &str) -> Result<(), RateLimitError> {
        self.auth.check(ip_key)?;
        self.auth_connection.check(connection_key)
    }

    /// Applies reconnect rate limits for the given token and IP.
    pub fn check_reconnect(&self, token_key: &str, ip_key: &str) -> Result<(), RateLimitError> {
        self.reconnect.check(token_key)?;
        self.reconnect_ip.check(ip_key)
    }

    /// Applies command rate limits, with a tighter window for Charleston passes.
    pub fn check_command(&self, key: &str, command: &GameCommand) -> Result<(), RateLimitError> {
        match command {
            GameCommand::CommitCharlestonPass { .. } | GameCommand::AcceptCourtesyPass { .. } => {
                self.charleston_pass.check(key)
            }
            _ => self.commands.check(key),
        }
    }

    /// Applies a general room action rate limit.
    pub fn check_room_action(&self, key: &str) -> Result<(), RateLimitError> {
        self.commands.check(key)
    }
}

impl Default for RateLimitStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    //! Unit tests for rate limiting behavior.

    use super::*;

    /// Ensures the limiter blocks once the cap is reached.
    #[test]
    fn test_rate_limiter_blocks_after_limit() {
        let limiter = RateLimiter::new(Duration::from_secs(60), 2);
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_ok());
        assert!(limiter.check("player-1").is_err());
    }

    /// Ensures Charleston passes use the stricter limit.
    #[test]
    fn test_rate_limit_store_charleston_override() {
        let store = RateLimitStore::new();
        let cmd = GameCommand::CommitCharlestonPass {
            player: mahjong_core::player::Seat::East,
            from_hand: vec![],
            forward_incoming_count: 0,
        };

        assert!(store.check_command("player-1", &cmd).is_ok());
        assert!(store.check_command("player-1", &cmd).is_err());
    }
}
