//! Database persistence module.
//!
//! Provides PostgreSQL persistence for:
//! - Game metadata (creation, completion, winners)
//! - Event sourcing log (all game events with visibility metadata)
//! - Player stats and profiles
//! - Replay functionality (filtered event streams)
//!
//! ```no_run
//! # async fn run() -> Result<(), sqlx::Error> {
//! use mahjong_server::db::Database;
//! let db = Database::new("postgres://postgres@localhost/mahjong").await?;
//! db.run_migrations().await?;
//! # Ok(())
//! # }
//! ```

use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use uuid::Uuid;

mod events;
mod games;
mod models;
mod players;
mod replay;
mod snapshots;

pub use models::{EventRecord, GameListRecord, GameRecord, PlayerRecord, SnapshotRecord};

/// Schema version for event serialization.
///
/// Increment this when `Event` changes in a breaking way.
pub const SCHEMA_VERSION: i32 = 1;

/// Database connection pool and query interface.
#[derive(Clone, Debug)]
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
}

fn parse_uuid(input: &str) -> Result<Uuid, sqlx::Error> {
    Uuid::parse_str(input).map_err(|e| {
        sqlx::Error::Decode(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Invalid UUID: {}", e),
        )))
    })
}

#[cfg(test)]
mod tests {
    //! Integration-like smoke tests for database wiring.

    use super::*;
    use mahjong_core::player::Seat;

    /// Ensures the connection pool initializes when the env var is present.
    #[tokio::test]
    async fn test_database_connection() {
        let _ = dotenvy::dotenv(); // Load .env file
        let db_url = match std::env::var("DATABASE_URL") {
            Ok(url) => url,
            Err(_) => {
                eprintln!("Skipping test: DATABASE_URL not set");
                return;
            }
        };
        let db = Database::new(&db_url).await.unwrap();
        assert!(!db.pool().is_closed());
    }

    /// Verifies that games can be created and fetched.
    #[tokio::test]
    async fn test_create_and_get_game() {
        let _ = dotenvy::dotenv(); // Load .env file
        let db_url = match std::env::var("DATABASE_URL") {
            Ok(url) => url,
            Err(_) => {
                eprintln!("Skipping test: DATABASE_URL not set");
                return;
            }
        };
        let db = Database::new(&db_url).await.unwrap();
        db.run_migrations().await.unwrap();

        let game_id = Uuid::new_v4().to_string();
        db.create_game(&game_id).await.unwrap();

        let game = db.get_game(&game_id).await.unwrap();
        assert!(game.is_some());
        assert_eq!(game.unwrap().id.to_string(), game_id);
    }

    /// Ensures ruleset metadata is persisted inside the final state payload.
    #[tokio::test]
    async fn test_ruleset_persistence() {
        let _ = dotenvy::dotenv(); // Load .env file
        let db_url = match std::env::var("DATABASE_URL") {
            Ok(url) => url,
            Err(_) => {
                eprintln!("Skipping test: DATABASE_URL not set");
                return;
            }
        };
        let db = Database::new(&db_url).await.unwrap();
        db.run_migrations().await.unwrap();

        let game_id = Uuid::new_v4().to_string();
        db.create_game(&game_id).await.unwrap();

        let final_state = serde_json::json!({
            "game_id": game_id,
            "phase": "GameOver",
        });

        db.finish_game(
            &game_id,
            Some(Seat::East),
            Some("2025-GRP1-H1"),
            &final_state,
            None,
            2025,
            "Visible",
            None,
            None,
        )
        .await
        .unwrap();

        // Verify persistence
        let game = db.get_game(&game_id).await.unwrap().unwrap();
        assert!(game.final_state.is_some());

        let state = game.final_state.unwrap();
        let ruleset_meta = state.get("ruleset_metadata").unwrap();
        assert_eq!(ruleset_meta.get("card_year").unwrap(), 2025);
        assert_eq!(ruleset_meta.get("timer_mode").unwrap(), "Visible");
    }
}
