use super::{parse_uuid, Database, SnapshotRecord};
use serde_json::Value as JsonValue;

impl Database {
    /// Stores a game state snapshot at a specific sequence number.
    pub async fn save_snapshot(
        &self,
        game_id: &str,
        seq: i32,
        state: &JsonValue,
    ) -> Result<(), sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        sqlx::query(
            r#"
            INSERT INTO game_snapshots (game_id, seq, state)
            VALUES ($1, $2, $3)
            ON CONFLICT (game_id, seq) DO UPDATE
            SET state = EXCLUDED.state
            "#,
        )
        .bind(uuid)
        .bind(seq)
        .bind(state)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Gets the latest snapshot before or at a given sequence number.
    pub async fn get_latest_snapshot(
        &self,
        game_id: &str,
        before_seq: i32,
    ) -> Result<Option<SnapshotRecord>, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let record = sqlx::query_as::<_, SnapshotRecord>(
            r#"
            SELECT id, game_id, seq, state, created_at
            FROM game_snapshots
            WHERE game_id = $1 AND seq <= $2
            ORDER BY seq DESC
            LIMIT 1
            "#,
        )
        .bind(uuid)
        .bind(before_seq)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }
}
