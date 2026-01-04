use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use mahjong_ai::VisibleTiles;
use mahjong_core::{
    event::GameEvent,
    flow::GamePhase,
    hand::Hand,
    player::Seat,
};
use mahjong_server::network::messages::{AuthMethod, AuthenticatePayload, Envelope};

use crate::input::CommandParser;
use crate::ui::TerminalUI;

/// Game state for the terminal client
#[derive(Debug, Clone)]
pub struct GameState {
    pub connected: bool,
    pub authenticated: bool,
    pub player_id: Option<String>,
    pub session_token: Option<String>,
    pub game_id: Option<String>,
    pub seat: Option<Seat>,
    pub hand: Hand,
    pub phase: GamePhase,
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

/// Terminal client for connecting to the mahjong server
pub struct Client {
    server_url: String,
    auth_token: Option<String>,
    ws_stream: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    pub state: Arc<Mutex<GameState>>,
    ui: TerminalUI,
    parser: CommandParser,
}

impl Client {
    /// Create a new client
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

    /// Connect to the WebSocket server
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

    /// Authenticate with the server
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

    /// Send an envelope to the server
    pub async fn send_envelope(&mut self, envelope: Envelope) -> Result<()> {
        let ws_stream = self.ws_stream.as_mut().context("Not connected to server")?;

        let json = envelope.to_json()?;
        ws_stream.send(WsMessage::Text(json)).await?;

        Ok(())
    }

    /// Receive an envelope from the server
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

    /// Run in interactive mode
    pub async fn run_interactive(&mut self) -> Result<()> {
        // Initial render
        {
            let state = self.state.lock().await;
            self.ui.render(&state)?;
        }

        // Main event loop
        loop {
            // Check for user input (non-blocking)
            if let Some(input) = self.ui.read_input() {
                if let Err(e) = self.handle_user_input(&input).await {
                    tracing::error!("Error handling input: {}", e);
                    let error_msg = format!("Error: {}", e);
                    self.ui.display_error(&error_msg)?;
                }
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

        Ok(())
    }

    /// Handle user input from the command prompt
    async fn handle_user_input(&mut self, input: &str) -> Result<()> {
        let trimmed = input.trim();

        // Handle special commands
        match trimmed.to_lowercase().as_str() {
            "quit" | "exit" => {
                tracing::info!("Quitting...");
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
        match self.parser.parse(trimmed) {
            Ok(command_json) => {
                // Command parsing in input.rs currently returns serde_json::Value
                // We need to map this to mahjong_core::command::GameCommand
                // For now, let's wrap it in a raw Command envelope if possible, 
                // or fix parser to return GameCommand.
                
                // Let's assume the parser returns a valid JSON for GameCommand
                let command: mahjong_core::command::GameCommand = serde_json::from_value(command_json)?;
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

    /// Handle envelopes from the server
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
                self.ui.display_error(&format!("Server error: {}", payload.message))?;
            }
            _ => {
                tracing::debug!("Unhandled envelope type: {:?}", envelope);
            }
        }

        Ok(())
    }

    /// Update GameState based on a GameEvent
    fn update_state_from_event(&self, state: &mut GameState, event: &GameEvent) {
        match event {
            GameEvent::TilesDealt { your_tiles } => {
                state.hand = Hand::new(your_tiles.clone());
            }
            GameEvent::TileDrawn { tile: Some(tile), .. } => {
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
            _ => {}
        }
    }

    /// Run commands from a script file
    pub async fn run_script(&mut self, script_path: &str) -> Result<()> {
        use tokio::io::AsyncBufReadExt;
        let file = tokio::fs::File::open(script_path).await
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
                self.receive_envelope()
            ).await {
                self.handle_server_envelope(envelope).await?;
            }
        }

        tracing::info!("Script playback complete");
        Ok(())
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        // Clean up terminal state
        let _ = self.ui.cleanup();
    }
}