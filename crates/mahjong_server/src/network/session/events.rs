use super::state::SessionStore;

impl SessionStore {
    /// Clean up expired stored sessions.
    ///
    /// Should be called periodically (e.g., every minute) by a background task.
    pub fn cleanup_expired(&self) -> usize {
        let expired_tokens: Vec<String> = self
            .stored
            .iter()
            .filter_map(|entry| {
                if entry.value().is_expired() {
                    Some(entry.key().clone())
                } else {
                    None
                }
            })
            .collect();

        let cleaned = expired_tokens.len();

        for token in expired_tokens {
            if let Some((_, session)) = self.stored.remove(&token) {
                self.stored_by_player.remove(&session.player_id);
            }
        }

        cleaned
    }
}
