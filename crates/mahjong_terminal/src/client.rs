//! Terminal client networking, input handling, and state tracking.
//!
//! The terminal client is a thin wrapper over the server's WebSocket protocol.
//! It tracks local state for display, parses user input into commands, and
//! renders updates via the `TerminalUI`.

use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use mahjong_ai::VisibleTiles;
use mahjong_core::{event::GameEvent, flow::GamePhase, hand::Hand, player::Seat};
use mahjong_server::network::messages::{AuthMethod, AuthenticatePayload, Envelope};

use crate::input::CommandParser;
use crate::ui::TerminalUI;

/// Local game state tracked by the terminal client.
///
/// This mirrors a subset of the server state needed for rendering and basic
/// decision-making.
#[derive(Debug, Clone)]
pub struct GameState {
    /// Whether the WebSocket connection has been established.
    pub connected: bool,
    /// Whether authentication succeeded.
    pub authenticated: bool,
    /// Server-assigned player ID, if known.
    pub player_id: Option<String>,
    /// Session token used for reconnecting.
    pub session_token: Option<String>,
    /// Current room ID, if joined.
    pub game_id: Option<String>,
    /// Seat assignment for this client, if known.
    pub seat: Option<Seat>,
    /// The player's current hand.
    pub hand: Hand,
    /// Current game phase for UI rendering.
    pub phase: GamePhase,
    /// Visible tiles tracker used by the AI and UI.
    pub visible_tiles: VisibleTiles,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            connected: false,
            authenticated: false,
            player_id: None,
            session_token: None,
            game_id: None,
            seat: None,
            hand: Hand::empty(),
            phase: GamePhase::WaitingForPlayers,
            visible_tiles: VisibleTiles::new(),
        }
    }
}

/// Terminal client for connecting to the Mahjong server.
pub struct Client {
    /// WebSocket URL for the server.
    server_url: String,
    /// Optional auth token for authenticated sessions.
    auth_token: Option<String>,
    /// Live WebSocket stream once connected.
    ws_stream: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    /// Shared game state updated by server events.
    pub state: Arc<Mutex<GameState>>,
    /// Terminal renderer and input reader.
    ui: TerminalUI,
    /// Command-line input parser.
    parser: CommandParser,
}

impl Client {
    /// Create a new client targeting the given server URL.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn new(server_url: String, auth_token: Option<String>) -> Result<Self> {
        Ok(Self {
            server_url,
            auth_token,
            ws_stream: None,
            state: Arc::new(Mutex::new(GameState::default())),
            ui: TerminalUI::new()?,
            parser: CommandParser::new(),
        })
    }

    /// Connect to the WebSocket server.
    ///
    /// This updates [`GameState::connected`] on success.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect(&mut self) -> Result<()> {
        tracing::info!("Connecting to {}", self.server_url);

        let (ws_stream, _response) = connect_async(&self.server_url)
            .await
            .context("Failed to connect to WebSocket server")?;

        self.ws_stream = Some(ws_stream);

        let mut state = self.state.lock().await;
        state.connected = true;
        drop(state);

        tracing::info!("Connected successfully");
        Ok(())
    }

    /// Authenticate with the server.
    ///
    /// Updates the local [`GameState`] with session and seat information on
    /// success.
    ///
    /// # Errors
    ///
    /// Returns an error if authentication fails or the server responds with an
    /// unexpected envelope.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// client.authenticate().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn authenticate(&mut self) -> Result<()> {
        let envelope = if let Some(token) = &self.auth_token {
            Envelope::Authenticate(AuthenticatePayload {
                method: AuthMethod::Token,
                credentials: Some(mahjong_server::network::messages::Credentials {
                    token: token.clone(),
                }),
                version: "1.0".to_string(),
            })
        } else {
            Envelope::Authenticate(AuthenticatePayload {
                method: AuthMethod::Guest,
                credentials: None,
                version: "1.0".to_string(),
            })
        };

        self.send_envelope(envelope).await?;

        // Wait for auth response
        if let Some(envelope) = self.receive_envelope().await? {
            match envelope {
                Envelope::AuthSuccess(payload) => {
                    let mut state = self.state.lock().await;
                    state.authenticated = true;
                    state.player_id = Some(payload.player_id.clone());
                    state.session_token = Some(payload.session_token);
                    state.game_id = payload.room_id;
                    state.seat = payload.seat;
                    drop(state);

                    tracing::info!("Authenticated as player: {}", payload.player_id);
                    return Ok(());
                }
                Envelope::AuthFailure(payload) => {
                    anyhow::bail!("Authentication failed: {}", payload.reason);
                }
                Envelope::Error(payload) => {
                    anyhow::bail!("Server error during auth: {}", payload.message);
                }
                _ => anyhow::bail!("Unexpected message during authentication"),
            }
        }

        anyhow::bail!("No authentication response received")
    }

    /// Create a new room and wait for confirmation.
    ///
    /// Updates the local [`GameState`] with the room ID and seat on success.
    pub async fn create_room(&mut self) -> Result<()> {
        self.send_envelope(Envelope::CreateRoom(
            mahjong_server::network::messages::CreateRoomPayload {},
        ))
        .await?;

        // Wait for room creation response
        loop {
            if let Some(envelope) = self.receive_envelope().await? {
                match &envelope {
                    Envelope::RoomJoined(payload) => {
                        let mut state = self.state.lock().await;
                        state.game_id = Some(payload.room_id.clone());
                        state.seat = Some(payload.seat);
                        drop(state);
                        tracing::info!(
                            "Created and joined room {} as {:?}",
                            payload.room_id,
                            payload.seat
                        );
                        return Ok(());
                    }
                    Envelope::Error(payload) => {
                        anyhow::bail!("Failed to create room: {}", payload.message);
                    }
                    _ => {
                        // Handle other messages (like game events) but keep waiting
                        self.handle_server_envelope(envelope).await?;
                    }
                }
            }
        }
    }

    /// Join an existing room by ID.
    ///
    /// Updates the local [`GameState`] with the room ID and seat on success.
    pub async fn join_room(&mut self, room_id: &str) -> Result<()> {
        self.send_envelope(Envelope::JoinRoom(
            mahjong_server::network::messages::JoinRoomPayload {
                room_id: room_id.to_string(),
            },
        ))
        .await?;

        // Wait for join response
        loop {
            if let Some(envelope) = self.receive_envelope().await? {
                match &envelope {
                    Envelope::RoomJoined(payload) => {
                        let mut state = self.state.lock().await;
                        state.game_id = Some(payload.room_id.clone());
                        state.seat = Some(payload.seat);
                        drop(state);
                        tracing::info!("Joined room {} as {:?}", payload.room_id, payload.seat);
                        return Ok(());
                    }
                    Envelope::Error(payload) => {
                        anyhow::bail!("Failed to join room: {}", payload.message);
                    }
                    _ => {
                        // Handle other messages but keep waiting
                        self.handle_server_envelope(envelope).await?;
                    }
                }
            }
        }
    }

    /// Send a message envelope to the server.
    ///
    /// # Errors
    ///
    /// Returns an error if the client is not connected or serialization fails.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_server::network::messages::Envelope;
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// client.send_envelope(Envelope::Ping).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn send_envelope(&mut self, envelope: Envelope) -> Result<()> {
        let ws_stream = self.ws_stream.as_mut().context("Not connected to server")?;

        let json = envelope.to_json()?;
        ws_stream.send(WsMessage::Text(json)).await?;

        Ok(())
    }

    /// Receive the next envelope from the server, if any.
    ///
    /// Returns `Ok(None)` when the connection is closed or a non-text frame is
    /// received.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// let _ = client.receive_envelope().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn receive_envelope(&mut self) -> Result<Option<Envelope>> {
        let ws_stream = self.ws_stream.as_mut().context("Not connected to server")?;

        if let Some(msg) = ws_stream.next().await {
            match msg? {
                WsMessage::Text(text) => {
                    let envelope = Envelope::from_json(&text)?;
                    Ok(Some(envelope))
                }
                WsMessage::Close(_) => {
                    tracing::info!("Server closed connection");
                    Ok(None)
                }
                _ => Ok(None),
            }
        } else {
            Ok(None)
        }
    }

    /// Run the interactive UI loop.
    ///
    /// This loop processes user input and server messages in short intervals
    /// to keep the terminal responsive.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// client.authenticate().await?;
    /// client.run_interactive().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn run_interactive(&mut self) -> Result<()> {
        // Enable raw mode for interactive input
        self.ui.enter_raw_mode()?;

        // Initial render
        {
            let state = self.state.lock().await;
            self.ui.render(&state)?;
        }

        // Main event loop
        loop {
            // Check for user input (non-blocking)
            let (input, input_changed) = self.ui.read_input();
            if let Some(input) = input {
                if let Err(e) = self.handle_user_input(&input).await {
                    tracing::error!("Error handling input: {}", e);
                    let error_msg = format!("Error: {}", e);
                    self.ui.display_error(&error_msg)?;
                }
                let state = self.state.lock().await;
                self.ui.render(&state)?;
            } else if input_changed {
                // Re-render to show updated input buffer
                let state = self.state.lock().await;
                self.ui.render(&state)?;
            }

            // Check for server messages (with short timeout)
            let msg_result = tokio::time::timeout(
                tokio::time::Duration::from_millis(50),
                self.receive_envelope(),
            )
            .await;

            match msg_result {
                Ok(Ok(Some(envelope))) => {
                    if let Err(e) = self.handle_server_envelope(envelope).await {
                        tracing::error!("Error handling message: {}", e);
                    }
                    let state = self.state.lock().await;
                    self.ui.render(&state)?;
                }
                Ok(Ok(None)) => {
                    tracing::info!("Connection closed");
                    break;
                }
                Ok(Err(e)) => {
                    tracing::error!("Error receiving message: {}", e);
                    break;
                }
                Err(_) => {
                    // Timeout - no message received, continue loop
                }
            }
        }

        // Disable raw mode before exiting
        self.ui.exit_raw_mode()?;

        Ok(())
    }

    /// Handle user input from the command prompt.
    async fn handle_user_input(&mut self, input: &str) -> Result<()> {
        let trimmed = input.trim();

        // Handle special commands
        match trimmed.to_lowercase().as_str() {
            "quit" | "exit" => {
                tracing::info!("Quitting...");
                let _ = self.ui.exit_raw_mode();
                std::process::exit(0);
            }
            "help" => {
                self.ui.display_help()?;
                return Ok(());
            }
            "state" => {
                self.ui.display_full_state(&*self.state.lock().await)?;
                return Ok(());
            }
            "create" => {
                self.send_envelope(Envelope::CreateRoom(
                    mahjong_server::network::messages::CreateRoomPayload {},
                ))
                .await?;
                return Ok(());
            }
            _ => {}
        }

        if let Some(stripped) = trimmed.strip_prefix("join ") {
            let room_id = stripped.trim().to_string();
            self.send_envelope(Envelope::JoinRoom(
                mahjong_server::network::messages::JoinRoomPayload { room_id },
            ))
            .await?;
            return Ok(());
        }

        // Parse command and send to server
        // Need seat and hand for parsing
        let state = self.state.lock().await;
        let seat = state.seat;
        let hand = state.hand.clone();
        drop(state);

        let seat = match seat {
            Some(s) => s,
            None => {
                self.ui
                    .display_error("Cannot send commands without a seat assignment")?;
                return Ok(());
            }
        };

        match self.parser.parse(trimmed, seat, &hand) {
            Ok(command) => {
                self.send_envelope(Envelope::Command(
                    mahjong_server::network::messages::CommandPayload { command },
                ))
                .await?;
                tracing::debug!("Sent command: {}", trimmed);
            }
            Err(e) => {
                self.ui.display_error(&format!("Invalid command: {}", e))?;
            }
        }

        Ok(())
    }

    /// Handle envelopes from the server and update local state.
    ///
    /// This method also forwards server events to the UI for display.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_server::network::messages::Envelope;
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// if let Some(envelope) = client.receive_envelope().await? {
    ///     client.handle_server_envelope(envelope).await?;
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn handle_server_envelope(&mut self, envelope: Envelope) -> Result<()> {
        match envelope {
            Envelope::Event(payload) => {
                let event = payload.event;
                tracing::debug!("Received event: {:?}", event);

                // Display event in UI
                let event_json = serde_json::to_value(&event)?;
                self.ui.display_event(&event_json)?;

                // Update local state
                let mut state = self.state.lock().await;
                self.update_state_from_event(&mut state, &event);
            }
            Envelope::RoomJoined(payload) => {
                let mut state = self.state.lock().await;
                state.game_id = Some(payload.room_id);
                state.seat = Some(payload.seat);
            }
            Envelope::Error(payload) => {
                tracing::warn!("Server error: {}", payload.message);
                self.ui
                    .display_error(&format!("Server error: {}", payload.message))?;
            }
            Envelope::Ping(payload) => {
                // Respond to heartbeat ping with pong
                self.send_envelope(Envelope::pong(payload.timestamp))
                    .await?;
                tracing::trace!("Responded to heartbeat ping");
            }
            _ => {
                tracing::debug!("Unhandled envelope type: {:?}", envelope);
            }
        }

        Ok(())
    }

    /// Update the local [`GameState`] based on a `GameEvent`.
    ///
    /// This method processes game events from the server and updates the client's
    /// local game state accordingly. It handles:
    ///
    /// - **Hand updates**: Adding/removing tiles based on deals, draws, discards, passes
    /// - **Phase transitions**: Tracking Charleston stages and turn changes
    /// - **Visibility tracking**: Recording visible tiles for AI decision-making
    ///
    /// The client maintains a partial view of the game state - only information
    /// that would be visible to this player is tracked locally.
    fn update_state_from_event(&self, state: &mut GameState, event: &GameEvent) {
        match event {
            GameEvent::TilesDealt { your_tiles } => {
                state.hand = Hand::new(your_tiles.clone());
            }
            GameEvent::TileDrawn {
                tile: Some(tile), ..
            } => {
                state.hand.add_tile(*tile);
                state.visible_tiles.record_draw();
            }
            GameEvent::TileDrawn { tile: None, .. } => {
                state.visible_tiles.record_draw();
            }
            GameEvent::TileDiscarded { player, tile } => {
                if let Some(my_seat) = state.seat {
                    if *player == my_seat {
                        let _ = state.hand.remove_tile(*tile);
                    }
                }
                state.visible_tiles.add_discard(*tile);
            }
            GameEvent::TileCalled { player, meld, .. } => {
                if let Some(my_seat) = state.seat {
                    if *player == my_seat {
                        let _ = state.hand.expose_meld(meld.clone());
                    }
                }
                state.visible_tiles.add_meld(*player, meld.clone());
            }
            GameEvent::TurnChanged { player, stage } => {
                state.phase = GamePhase::Playing(stage.clone());
                tracing::info!("Turn changed: {:?} ({:?})", player, stage);
            }
            GameEvent::CharlestonPhaseChanged { stage } => {
                state.phase = GamePhase::Charleston(*stage);
            }
            GameEvent::TilesReceived { tiles, .. } => {
                for tile in tiles {
                    state.hand.add_tile(*tile);
                }
            }
            GameEvent::TilesPassed { player, tiles } => {
                if let Some(my_seat) = state.seat {
                    if *player == my_seat {
                        for tile in tiles {
                            let _ = state.hand.remove_tile(*tile);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    /// Run commands from a script file.
    ///
    /// Script lines are parsed as user input. Blank lines and lines starting
    /// with `#` are ignored. A line beginning with `DELAY_MS` sleeps for the
    /// provided number of milliseconds.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::client::Client;
    ///
    /// # async fn run() -> anyhow::Result<()> {
    /// let mut client = Client::new("ws://localhost:3000/ws".to_string(), None).await?;
    /// client.connect().await?;
    /// client.authenticate().await?;
    /// client.run_script("scripts/test.txt").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn run_script(&mut self, script_path: &str) -> Result<()> {
        use tokio::io::AsyncBufReadExt;
        let file = tokio::fs::File::open(script_path)
            .await
            .context(format!("Failed to open script file: {}", script_path))?;
        let mut lines = tokio::io::BufReader::new(file).lines();

        tracing::info!("Starting script playback: {}", script_path);

        while let Some(line) = lines.next_line().await? {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some(stripped) = trimmed.strip_prefix("DELAY_MS ") {
                if let Ok(ms) = stripped.parse::<u64>() {
                    tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
                    continue;
                }
            }

            tracing::info!("Script command: {}", trimmed);
            if let Err(e) = self.handle_user_input(trimmed).await {
                tracing::error!("Script error at '{}': {}", trimmed, e);
            }

            // Small default delay between commands
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // Process any pending server messages
            while let Ok(Ok(Some(envelope))) = tokio::time::timeout(
                tokio::time::Duration::from_millis(10),
                self.receive_envelope(),
            )
            .await
            {
                self.handle_server_envelope(envelope).await?;
            }
        }

        tracing::info!("Script playback complete");
        Ok(())
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        // Best-effort cleanup for terminal state.
        let _ = self.ui.cleanup();
    }
}
