use super::{parse_uuid, Database, EventRecord};
use mahjong_core::player::Seat;

impl Database {
    /// Gets a filtered event stream for a specific player (respects privacy).
    ///
    /// Returns:
    /// - All public events
    /// - Private events targeted at the viewer
    /// - Events are ordered by sequence number
    pub async fn get_player_replay(
        &self,
        game_id: &str,
        viewer_seat: Seat,
    ) -> Result<Vec<EventRecord>, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;
        let viewer_str = format!("{:?}", viewer_seat);

        let records = sqlx::query_as::<_, EventRecord>(
            r#"
            SELECT id, seq, event, visibility, target_player, created_at
            FROM get_player_replay_events($1, $2)
            "#,
        )
        .bind(uuid)
        .bind(viewer_str)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    /// Gets the complete event stream (admin access, no privacy filtering).
    pub async fn get_admin_replay(&self, game_id: &str) -> Result<Vec<EventRecord>, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let records = sqlx::query_as::<_, EventRecord>(
            r#"
            SELECT id, seq, event, visibility, target_player, created_at
            FROM get_admin_replay_events($1)
            "#,
        )
        .bind(uuid)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    /// Gets events in a sequence range (inclusive).
    pub async fn get_events_range(
        &self,
        game_id: &str,
        from_seq: i32,
        to_seq: i32,
    ) -> Result<Vec<EventRecord>, sqlx::Error> {
        let uuid = parse_uuid(game_id)?;

        let records = sqlx::query_as::<_, EventRecord>(
            r#"
            SELECT id, seq, event, visibility, target_player, created_at
            FROM game_events
            WHERE game_id = $1 AND seq >= $2 AND seq <= $3
            ORDER BY seq ASC
            "#,
        )
        .bind(uuid)
        .bind(from_seq)
        .bind(to_seq)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }
}
