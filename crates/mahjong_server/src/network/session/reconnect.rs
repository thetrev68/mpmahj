use super::auth::RestoreSessionErr;
use super::auth::RestoreSessionOk;
use super::state::{Session, SessionStore, StoredSession};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use std::sync::Arc;
use tokio::sync::Mutex;

impl SessionStore {
    /// Restore a session from a token.
    ///
    /// Returns Ok with session data if token is valid and not expired.
    /// Returns Err if token is invalid or session has expired.
    pub fn restore_session(
        &self,
        token: &str,
        ws_sender: SplitSink<WebSocket, Message>,
    ) -> Result<RestoreSessionOk, RestoreSessionErr> {
        // Look up stored session by token
        let stored = match self.stored.get(token) {
            Some(entry) => entry.clone(),
            None => {
                return Err(("Invalid session token".to_string(), ws_sender));
            }
        };

        // Check if expired
        if stored.is_expired() {
            self.stored.remove(token);
            self.stored_by_player.remove(&stored.player_id);
            return Err(("Session expired".to_string(), ws_sender));
        }

        // Restore session
        let player_id = stored.player_id.clone();
        let display_name = stored.display_name.clone();
        let session_token = stored.session_token.clone();
        let room_id = stored.room_id.clone();
        let seat = stored.seat;

        let session = Session::restore_from_token(&stored, ws_sender);
        let session_arc = Arc::new(Mutex::new(session));

        // Move from stored to active
        self.stored.remove(token);
        self.stored_by_player.remove(&player_id);
        self.active.insert(player_id.clone(), session_arc.clone());

        Ok((
            player_id,
            display_name,
            session_token,
            room_id,
            seat,
            session_arc,
        ))
    }

    /// Restore a session using player_id (JWT reconnect path).
    pub fn take_stored_by_player_id(&self, player_id: &str) -> Option<StoredSession> {
        let token = self.stored_by_player.get(player_id)?.value().clone();
        self.stored_by_player.remove(player_id);
        let stored = self.stored.remove(&token).map(|(_, session)| session)?;
        if stored.is_expired() {
            return None;
        }
        Some(stored)
    }
}
