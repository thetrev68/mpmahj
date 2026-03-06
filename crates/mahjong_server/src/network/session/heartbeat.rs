use super::state::SessionStore;

impl SessionStore {
    /// Mark a session as disconnected and move to stored sessions.
    ///
    /// The session will be stored for 5 minutes to allow reconnection.
    pub async fn disconnect_session(&self, player_id: &str) {
        if let Some((_, session_arc)) = self.active.remove(player_id) {
            let mut session = session_arc.lock().await;
            session.disconnect();

            let stored = session.to_stored();
            let token = stored.session_token.clone();

            self.stored.insert(token.clone(), stored);
            self.stored_by_player.insert(player_id.to_string(), token);
        }
    }
}
