use super::{parse_uuid, Database, GameListRecord, GameRecord};
use chrono::Utc;
use mahjong_core::player::Seat;
use serde_json::{json, Value as JsonValue};

impl Database {
    /// Creates a new game record.
    pub async fn create_game(&self, game_id: &str) -> Result<(), sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        sqlx::query(
            r#"
            INSERT INTO games (id, created_at)
            VALUES ($1, $2)
            "#,
        )
        .bind(uuid)
        .bind(Utc::now())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Updates a game with its final state when it ends.
    #[allow(clippy::too_many_arguments)]
    pub async fn finish_game(
        &self,
        game_id: &str,
        winner_seat: Option<Seat>,
        winning_pattern: Option<&str>,
        final_state: &JsonValue,
        analysis_log: Option<&JsonValue>,
        card_year: u16,
        timer_mode: &str,
        wall_seed: Option<i64>,
        wall_break_point: Option<i16>,
    ) -> Result<(), sqlx::Error> {
        let uuid = parse_uuid(game_id)?;
        let winner_str = winner_seat.map(|s| format!("{:?}", s));

        // Extend final state with ruleset metadata
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
            r#"
            UPDATE games
            SET finished_at = $1,
                winner_seat = $2,
                winning_pattern = $3,
                final_state = $4,
                analysis_log = $5,
                wall_seed = $6,
                wall_break_point = $7
            WHERE id = $8
            "#,
        )
        .bind(Utc::now())
        .bind(winner_str)
        .bind(winning_pattern)
        .bind(extended_state)
        .bind(analysis_log)
        .bind(wall_seed)
        .bind(wall_break_point)
        .bind(uuid)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Gets game metadata by ID.
    pub async fn get_game(&self, game_id: &str) -> Result<Option<GameRecord>, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let record = sqlx::query_as::<_, GameRecord>(
            r#"
            SELECT id, created_at, finished_at, winner_seat, winning_pattern, final_state, analysis_log, wall_seed
            FROM games
            WHERE id = $1
            "#,
        )
        .bind(uuid)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    /// List recent games for admin tooling.
    pub async fn list_recent_games(&self, limit: i64) -> Result<Vec<GameListRecord>, sqlx::Error> {
        let rows = sqlx::query_as::<_, GameListRecord>(
            r#"
            SELECT id, created_at, finished_at, winner_seat, winning_pattern
            FROM games
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}
