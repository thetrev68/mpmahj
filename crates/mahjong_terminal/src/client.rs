use anyhow::{Result, Context};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};
use tokio_tungstenite::tungstenite::Message as WsMessage;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::ui::TerminalUI;
use crate::input::CommandParser;

/// WebSocket message envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Message {
    kind: String,
    payload: serde_json::Value,
}

/// Authentication request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum AuthRequest {
    Guest,
    Token { token: String },
}

/// Authentication response
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuthSuccess {
    session_token: String,
    player_id: String,
}

/// Game state (simplified for now - will expand as we implement)
#[derive(Debug, Clone, Default)]
pub struct GameState {
    pub connected: bool,
    pub authenticated: bool,
    pub player_id: Option<String>,
    pub session_token: Option<String>,
    pub game_id: Option<String>,
    // Will add: hand, game_phase, turn, etc. as we implement
}

/// Terminal client for connecting to the mahjong server
pub struct Client {
    server_url: String,
    auth_token: Option<String>,
    ws_stream: Option<WebSocketStream<MaybeTlsStream<TcpStream>>>,
    state: Arc<Mutex<GameState>>,
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
        let auth_request = if let Some(token) = &self.auth_token {
            AuthRequest::Token { token: token.clone() }
        } else {
            AuthRequest::Guest
        };

        let message = Message {
            kind: "Authenticate".to_string(),
            payload: serde_json::to_value(&auth_request)?,
        };

        self.send_message(message).await?;

        // Wait for auth response
        if let Some(response) = self.receive_message().await? {
            if response.kind == "AuthSuccess" {
                let auth_success: AuthSuccess = serde_json::from_value(response.payload)?;

                let mut state = self.state.lock().await;
                state.authenticated = true;
                state.player_id = Some(auth_success.player_id.clone());
                state.session_token = Some(auth_success.session_token);
                drop(state);

                tracing::info!("Authenticated as player: {}", auth_success.player_id);
                return Ok(());
            } else if response.kind == "Error" {
                anyhow::bail!("Authentication failed: {:?}", response.payload);
            }
        }

        anyhow::bail!("No authentication response received")
    }

    /// Send a message to the server
    async fn send_message(&mut self, message: Message) -> Result<()> {
        let ws_stream = self.ws_stream.as_mut()
            .context("Not connected to server")?;

        let json = serde_json::to_string(&message)?;
        ws_stream.send(WsMessage::Text(json)).await?;

        Ok(())
    }

    /// Receive a message from the server
    async fn receive_message(&mut self) -> Result<Option<Message>> {
        let ws_stream = self.ws_stream.as_mut()
            .context("Not connected to server")?;

        if let Some(msg) = ws_stream.next().await {
            match msg? {
                WsMessage::Text(text) => {
                    let message: Message = serde_json::from_str(&text)?;
                    Ok(Some(message))
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
            let input_opt = self.ui.read_input();
            if let Some(input) = input_opt {
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
                self.receive_message()
            ).await;

            match msg_result {
                Ok(Ok(Some(message))) => {
                    if let Err(e) = self.handle_server_message(message).await {
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
            _ => {}
        }

        // Parse command and send to server
        match self.parser.parse(trimmed) {
            Ok(command) => {
                let message = Message {
                    kind: "Command".to_string(),
                    payload: command,
                };
                self.send_message(message).await?;
                tracing::debug!("Sent command: {}", trimmed);
            }
            Err(e) => {
                self.ui.display_error(&format!("Invalid command: {}", e))?;
            }
        }

        Ok(())
    }

    /// Handle messages from the server
    async fn handle_server_message(&mut self, message: Message) -> Result<()> {
        match message.kind.as_str() {
            "Event" => {
                // Handle game event
                tracing::debug!("Received event: {:?}", message.payload);
                self.ui.display_event(&message.payload)?;
                // TODO: Update game state based on event
            }
            "Error" => {
                tracing::warn!("Server error: {:?}", message.payload);
                self.ui.display_error(&format!("Server error: {:?}", message.payload))?;
            }
            _ => {
                tracing::debug!("Unknown message type: {}", message.kind);
            }
        }

        Ok(())
    }

    /// Run commands from a script file
    pub async fn run_script(&mut self, _script_path: &str) -> Result<()> {
        // TODO: Implement script playback
        tracing::warn!("Script playback not yet implemented");
        Ok(())
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        // Clean up terminal state
        let _ = self.ui.cleanup();
    }
}
