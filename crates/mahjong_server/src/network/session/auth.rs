use crate::network::session::state::{Session, SessionStore};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use mahjong_core::player::Seat;
use std::sync::Arc;
use tokio::sync::Mutex;

impl SessionStore {
    /// Add a new guest session.
    ///
    /// Returns the session data needed for AuthSuccess response.
    pub fn add_guest_session(
        &self,
        session: Session,
    ) -> (String, String, String, Arc<Mutex<Session>>) {
        let player_id = session.player_id.clone();
        let display_name = session.display_name.clone();
        let session_token = session.session_token.clone();

        let session_arc = Arc::new(Mutex::new(session));
        self.active.insert(player_id.clone(), session_arc.clone());

        (player_id, display_name, session_token, session_arc)
    }
}

/// Internal alias retained for compatibility with existing restore flow.
pub(crate) type RestoreSessionOk = (
    String,
    String,
    String,
    Option<String>,
    Option<Seat>,
    Arc<Mutex<Session>>,
);

/// Internal alias retained for compatibility with existing restore flow.
pub(crate) type RestoreSessionErr = (String, SplitSink<WebSocket, Message>);
