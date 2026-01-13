//! Simplified database persistence module using runtime queries.
//!
//! This version uses runtime query building instead of compile-time checked macros
//! to avoid needing the database schema during compilation.
//!
//! ```no_run
//! # async fn run() -> Result<(), sqlx::Error> {
//! use mahjong_server::db_simple::Database;
//! let db = Database::new("postgres://postgres@localhost/mahjong").await?;
//! db.run_migrations().await?;
//! # Ok(())
//! # }
//! ```

use chrono::{DateTime, Utc};
use mahjong_core::{event::GameEvent, seat::Seat};
use serde_json::{json, Value as JsonValue};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use uuid::Uuid;

/// Schema version for event serialization.
pub const SCHEMA_VERSION: i32 = 1;

/// Database connection pool and query interface.
#[derive(Clone)]
pub struct Database {
    /// Shared Postgres connection pool.
    pool: PgPool,
}

impl Database {
    /// Initializes a database connection pool from `DATABASE_URL`.
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(3))
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    /// Runs migrations (call this on startup).
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        Ok(())
    }

    /// Returns a reference to the connection pool.
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// Creates a new game record.
    pub async fn create_game(&self, game_id: &str) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        sqlx::query(
            "INSERT INTO games (id, created_at) VALUES ($1, $2)"
        )
        .bind(uuid)
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Updates a game with its final state when it ends.
    pub async fn finish_game(
        &self,
        game_id: &str,
        winner_seat: Option<Seat>,
        winning_pattern: Option<&str>,
        final_state: &JsonValue,
        analysis_log: Option<&JsonValue>,
        card_year: u16,
        timer_mode: &str,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let winner_str = winner_seat.map(|s| s.to_string());

        let mut extended_state = final_state.clone();
        if let Some(obj) = extended_state.as_object_mut() {
            obj.insert(
                "ruleset_metadata".to_string(),
                json!({
                    "card_year": card_year,
                    "timer_mode": timer_mode,
                }),
            );
        }

        sqlx::query(
            "UPDATE games SET finished_at = $1, winner_seat = $2, winning_pattern = $3, final_state = $4, analysis_log = $5 WHERE id = $6"
        )
        .bind(Utc::now())
        .bind(winner_str)
        .bind(winning_pattern)
        .bind(extended_state)
        .bind(analysis_log)
        .bind(uuid)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Appends a game event to the log.
    pub async fn append_event(
        &self,
        game_id: &str,
        seq: i32,
        event: &GameEvent,
        _tx: Option<&mut sqlx::Transaction<'_, sqlx::Postgres>>,
    ) -> Result<(), sqlx::Error> {
        let uuid = Uuid::parse_str(game_id).map_err(|e| {
            sqlx::Error::Decode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Invalid UUID: {}", e),
            )))
        })?;

        let event_json = serde_json::to_value(event).map_err(|e| {
            sqlx::Error::Encode(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Failed to serialize event: {}", e),
            )))
        })?;

        let (visibility, target_player) = if event.is_private() {
            (
                "private",
                event.target_player().map(|s| s.to_string()),
            )
        } else {
            ("public", None)
        };

        sqlx::query(
            "INSERT INTO game_events (game_id, seq, event, visibility, target_player, schema_version) VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(uuid)
        .bind(seq)
        .bind(event_json)
        .bind(visibility)
        .bind(target_player)
        .bind(SCHEMA_VERSION)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

/// Serializes a table to JSON for storage.
pub fn serialize_table(table: &mahjong_core::table::Table) -> Result<JsonValue, serde_json::Error> {
    serde_json::to_value(table)
}
