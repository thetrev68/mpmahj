//! WebSocket end-to-end tests for history viewer functionality.
//!
//! # Overview
//!
//! Tests the complete flow of history commands through WebSocket layer,
//! validating that clients can view, navigate, and resume from history.
//! These tests address TODOs in `history_integration_tests.rs` (lines 6, 8)
//! by providing WebSocket-driven integration tests.
//!
//! # Test Coverage
//!
//! ## Core Commands Tested
//! - `RequestHistory`: Retrieve complete move history
//! - `JumpToMove`: Enter viewing mode at specific move
//! - `ResumeFromHistory`: Resume gameplay from history point (truncates future)
//! - `ReturnToPresent`: Exit viewing mode without truncation
//!
//! ## Edge Cases
//! - Invalid move numbers (non-existent moves)
//! - Invalid operations (return when not viewing, etc.)
//! - Multi-client consistency and broadcast behavior
//!
//! # Architecture Notes
//!
//! ## Error Handling
//! The server may return errors via two mechanisms:
//! - `Envelope::Error` for command validation failures
//! - `GameEvent::HistoryError` for runtime errors
//!
//! Tests handle both patterns robustly.
//!
//! ## Event Broadcasting
//! History operations broadcast events to all clients in a room:
//! - `StateRestored`: Unicast for view operations, broadcast for resume
//! - `HistoryTruncated`: Always broadcast (affects all clients)
//!
//! Tests use timeout-based event collection to handle async broadcasts.
//!
//! ## Practice Mode Requirement
//! History is only available in practice mode (4 bots). Tests use
//! `setup_practice_game_with_history()` to create appropriate environments.
//!
//! # Related Files
//! - `history_integration_tests.rs`: Unit tests for Room history methods
//! - `networking_integration.rs`: WebSocket infrastructure patterns
//! - `src/network/history.rs`: Backend RoomHistory trait implementation

use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use mahjong_core::{
    command::GameCommand,
    event::GameEvent,
    history::MoveHistorySummary,
    player::Seat,
};
use mahjong_server::network::{ws_handler, Envelope, NetworkState};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};
use tokio_tungstenite::connect_async;
use url::Url;

type WsStream =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// Test client wrapper for WebSocket connection and session tracking.
///
/// Maintains connection state, authentication info, and seat assignment
/// for simulating real client behavior in tests.
#[allow(dead_code)]
struct Client {
    /// Active WebSocket connection to server
    ws: WsStream,
    /// Unique player identifier from authentication
    player_id: String,
    /// Session token for reconnection
    session_token: String,
    /// Assigned seat in room (None if not in room)
    seat: Option<Seat>,
}

// ===== WEBSOCKET INFRASTRUCTURE =====

async fn ws_route(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws_handler(ws, State(state), addr).await
}

/// Spawn a test server on a random port and return its address and state.
///
/// Creates an Axum server with WebSocket endpoint at `/ws`.
/// Spawns server in background task to allow concurrent test execution.
///
/// # Returns
/// - `SocketAddr`: Server's bound address (e.g., `127.0.0.1:12345`)
/// - `Arc<NetworkState>`: Shared server state for inspecting rooms/sessions
async fn spawn_server() -> (SocketAddr, Arc<NetworkState>) {
    let state = Arc::new(NetworkState::new());
    let app = Router::new()
        .route("/ws", get(ws_route))
        .with_state(state.clone());

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });

    (addr, state)
}

/// Connect to WebSocket server.
async fn connect_ws(addr: SocketAddr) -> WsStream {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (ws, _) = connect_async(url).await.unwrap();
    ws
}

/// Send an envelope to the WebSocket.
async fn send_envelope(ws: &mut WsStream, envelope: Envelope) {
    let json = envelope.to_json().unwrap();
    ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
        .await
        .unwrap();
}

/// Receive an envelope from the WebSocket.
async fn recv_envelope(ws: &mut WsStream) -> Envelope {
    let msg = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("timeout waiting for message")
        .expect("stream closed")
        .expect("message error");

    let text = msg.into_text().expect("expected text message");
    Envelope::from_json(&text).expect("invalid envelope")
}

/// Receive a game event, filtering out Ping messages.
async fn recv_event(ws: &mut WsStream) -> GameEvent {
    loop {
        let response = recv_envelope(ws).await;
        match response {
            Envelope::Event(payload) => return payload.event,
            Envelope::Ping(_) => continue,
            other => panic!("expected Event, got {:?}", other),
        }
    }
}

/// Connect to server and authenticate as guest.
async fn connect_and_auth(addr: SocketAddr) -> Client {
    let mut ws = connect_ws(addr).await;

    let auth = Envelope::authenticate(
        mahjong_server::network::messages::AuthMethod::Guest,
        None,
    );
    send_envelope(&mut ws, auth).await;

    let response = recv_envelope(&mut ws).await;
    let payload = match response {
        Envelope::AuthSuccess(payload) => payload,
        other => panic!("expected AuthSuccess, got {:?}", other),
    };

    Client {
        ws,
        player_id: payload.player_id,
        session_token: payload.session_token,
        seat: payload.seat,
    }
}

/// Send a game command through WebSocket.
async fn send_command(client: &mut Client, command: GameCommand) {
    let envelope = Envelope::command(command);
    send_envelope(&mut client.ws, envelope).await;
}

/// Receive a HistoryList event and extract the entries.
async fn recv_history_list(client: &mut Client) -> Vec<MoveHistorySummary> {
    let event = recv_event(&mut client.ws).await;
    match event {
        GameEvent::HistoryList { entries } => entries,
        other => panic!("expected HistoryList, got {:?}", other),
    }
}

/// Create a room and return the room_id and seat.
async fn create_room(client: &mut Client) -> (String, Seat) {
    send_envelope(&mut client.ws, Envelope::create_room()).await;

    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomJoined(payload) => {
                client.seat = Some(payload.seat);
                return (payload.room_id, payload.seat);
            }
            Envelope::Event(payload) => {
                // Skip game events while waiting for RoomJoined
                if matches!(payload.event, GameEvent::GameStarting) {
                    continue;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomJoined, got {:?}", other),
        }
    }
}

/// Enable a bot at the specified seat.
async fn enable_bot(
    state: &Arc<NetworkState>,
    room_id: &str,
    seat: Seat,
    bot_name: &str,
) -> Result<(), String> {
    let room_arc = state
        .rooms
        .get_room(room_id)
        .ok_or_else(|| "room not found".to_string())?;

    let mut room = room_arc.lock().await;
    room.enable_bot(seat, bot_name.to_string());
    Ok(())
}

/// Drain all pending messages from WebSocket (useful to clear buffers).
async fn drain_messages(ws: &mut WsStream, wait: Duration) {
    let deadline = tokio::time::Instant::now() + wait;
    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        match timeout(remaining, ws.next()).await {
            Err(_) => break, // Timeout reached
            Ok(Some(Ok(_))) => continue, // Got message, drain it
            Ok(Some(Err(e))) => panic!("stream error: {:?}", e),
            Ok(None) => panic!("connection closed"),
        }
    }
}

// ===== HISTORY-SPECIFIC HELPERS =====

/// Setup a practice game with mock history entries.
///
/// Creates a practice mode room (4 bots), authenticates a client,
/// and populates the room's history with mock move entries.
///
/// # Arguments
/// - `addr`: Server address to connect to
/// - `state`: Server state for room manipulation
/// - `move_count`: Number of mock history entries to create
///
/// # Returns
/// - Authenticated client connected to the room
/// - Room identifier string
async fn setup_practice_game_with_history(
    addr: SocketAddr,
    state: &Arc<NetworkState>,
    move_count: usize,
) -> (Client, String) {
    let mut client = connect_and_auth(addr).await;
    let (room_id, _seat) = create_room(&mut client).await;

    // Enable 4 bots to create practice mode
    enable_bot(state, &room_id, Seat::East, "bot-east")
        .await
        .unwrap();
    enable_bot(state, &room_id, Seat::South, "bot-south")
        .await
        .unwrap();
    enable_bot(state, &room_id, Seat::West, "bot-west")
        .await
        .unwrap();
    enable_bot(state, &room_id, Seat::North, "bot-north")
        .await
        .unwrap();

    // Drain startup events (GameStarting, etc.)
    drain_messages(&mut client.ws, Duration::from_millis(500)).await;

    // Add mock history entries directly to room
    let room_arc = state.rooms.get_room(&room_id).expect("room not found");
    add_mock_history_entries(&room_arc, move_count).await;

    (client, room_id)
}

/// Add mock history entries to a room for testing.
async fn add_mock_history_entries(
    room_arc: &Arc<tokio::sync::Mutex<mahjong_server::network::room::Room>>,
    count: usize,
) {
    use chrono::Utc;
    use mahjong_core::{history::MoveAction, history::MoveHistoryEntry, table::Table, tile::Tile};

    let mut room = room_arc.lock().await;

    // Create a mock table if needed
    if room.table.is_none() {
        let table = Table::new("test-game".to_string(), 12345);
        room.table = Some(table);
    }

    let table = room.table.as_ref().unwrap().clone();

    // Add history entries
    for i in 0..count {
        let entry = MoveHistoryEntry {
            move_number: i as u32,
            timestamp: Utc::now(),
            seat: Seat::East,
            action: MoveAction::DrawTile {
                tile: Tile::new((i % 9) as u8),
                visible: true,
            },
            description: format!("Move {} - East drew tile", i),
            snapshot: table.clone(),
        };
        room.history.push(entry);
    }
    room.current_move_number = count as u32;
}

// ===== TESTS =====

/// Test 1: Verify RequestHistory command over WebSocket returns HistoryList event.
///
/// # Setup
/// - Practice room with 10 mock history entries
///
/// # Validation
/// - HistoryList contains exactly 10 entries
/// - Entries are in correct order (move_number 0-9)
/// - Each entry has correct seat (East) and description
#[tokio::test]
async fn test_websocket_request_history() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with 10 moves
    let (mut client, _room_id) = setup_practice_game_with_history(addr, &state, 10).await;

    // Send RequestHistory command
    let seat = client.seat.expect("client should have seat");
    send_command(
        &mut client,
        GameCommand::RequestHistory { player: seat },
    )
    .await;

    // Receive HistoryList event
    let entries = recv_history_list(&mut client).await;

    // Assert: List contains 10 entries in order
    assert_eq!(entries.len(), 10, "Expected 10 history entries");

    // Assert: Each entry has correct move_number, seat, description
    for (i, entry) in entries.iter().enumerate() {
        assert_eq!(
            entry.move_number, i as u32,
            "Entry {} has wrong move_number",
            i
        );
        assert_eq!(entry.seat, Seat::East, "Entry {} has wrong seat", i);
        assert!(
            entry.description.contains(&format!("Move {}", i)),
            "Entry {} has wrong description: {}",
            i,
            entry.description
        );
    }
}

/// Test 2: Verify JumpToMove command restores state at specific move.
///
/// # Setup
/// - Practice room with 20 mock history entries
///
/// # Actions
/// - Jump to move 10 (middle of history)
///
/// # Validation
/// - Receives StateRestored event with move_number=10
/// - Mode is `HistoryMode::Viewing { at_move: 10 }`
/// - Description references move 10
#[tokio::test]
async fn test_websocket_jump_to_move() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with 20 moves
    let (mut client, _room_id) = setup_practice_game_with_history(addr, &state, 20).await;

    // Send JumpToMove command
    let seat = client.seat.expect("client should have seat");
    send_command(
        &mut client,
        GameCommand::JumpToMove {
            player: seat,
            move_number: 10,
        },
    )
    .await;

    // Receive StateRestored event
    let event = recv_event(&mut client.ws).await;
    match event {
        GameEvent::StateRestored {
            move_number,
            description,
            mode,
        } => {
            assert_eq!(move_number, 10, "Should restore to move 10");
            assert!(
                description.contains("Move 10"),
                "Description should reference move 10: {}",
                description
            );
            assert_eq!(
                mode,
                mahjong_core::history::HistoryMode::Viewing { at_move: 10 },
                "Should be in viewing mode at move 10"
            );
        }
        other => panic!("Expected StateRestored, got {:?}", other),
    }
}

/// Test 3: Verify ResumeFromHistory truncates future moves and exits viewing mode.
///
/// # Setup
/// - Practice room with 30 mock history entries
///
/// # Actions
/// 1. Jump to move 15 (enter viewing mode)
/// 2. Resume from move 15 (truncate future, exit viewing)
///
/// # Validation
/// - First StateRestored exits viewing mode (mode=None)
/// - HistoryTruncated event shows from_move=16
/// - RequestHistory confirms only 16 entries remain (0-15)
/// - Moves 16-29 are permanently deleted
#[tokio::test]
async fn test_websocket_resume_from_history() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with 30 moves
    let (mut client, _room_id) = setup_practice_game_with_history(addr, &state, 30).await;

    let seat = client.seat.expect("client should have seat");

    // Jump to move 15 (enter viewing mode)
    send_command(
        &mut client,
        GameCommand::JumpToMove {
            player: seat,
            move_number: 15,
        },
    )
    .await;

    // Consume StateRestored event from jump
    let _ = recv_event(&mut client.ws).await;

    // Send ResumeFromHistory command
    send_command(
        &mut client,
        GameCommand::ResumeFromHistory {
            player: seat,
            move_number: 15,
        },
    )
    .await;

    // Receive StateRestored event (exiting viewing mode)
    let event1 = recv_event(&mut client.ws).await;
    match event1 {
        GameEvent::StateRestored { mode, .. } => {
            assert_eq!(mode, mahjong_core::history::HistoryMode::None, "Should exit viewing mode");
        }
        other => panic!("Expected StateRestored, got {:?}", other),
    }

    // Receive HistoryTruncated event
    let event2 = recv_event(&mut client.ws).await;
    match event2 {
        GameEvent::HistoryTruncated { from_move } => {
            assert_eq!(from_move, 16, "Should truncate from move 16");
        }
        other => panic!("Expected HistoryTruncated, got {:?}", other),
    }

    // Request history list to verify truncation
    send_command(&mut client, GameCommand::RequestHistory { player: seat }).await;
    let entries = recv_history_list(&mut client).await;

    assert_eq!(
        entries.len(),
        16,
        "History should have 16 entries (0-15) after truncation"
    );
    assert_eq!(entries.last().unwrap().move_number, 15);
}

/// Test 4: Verify ReturnToPresent exits viewing mode without truncation.
///
/// # Setup
/// - Practice room with 25 mock history entries
///
/// # Actions
/// 1. Jump to move 12
/// 2. Return to present (exit viewing without truncating)
///
/// # Validation
/// - StateRestored event exits viewing mode (mode=None)
/// - Description mentions "present"
/// - All 25 history entries still exist (no truncation)
#[tokio::test]
async fn test_websocket_return_to_present() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with 25 moves
    let (mut client, _room_id) = setup_practice_game_with_history(addr, &state, 25).await;

    let seat = client.seat.expect("client should have seat");

    // Jump to move 12
    send_command(
        &mut client,
        GameCommand::JumpToMove {
            player: seat,
            move_number: 12,
        },
    )
    .await;

    // Consume StateRestored event from jump
    let _ = recv_event(&mut client.ws).await;

    // Send ReturnToPresent command
    send_command(&mut client, GameCommand::ReturnToPresent { player: seat }).await;

    // Receive StateRestored event
    let event = recv_event(&mut client.ws).await;
    match event {
        GameEvent::StateRestored {
            mode, description, ..
        } => {
            assert_eq!(mode, mahjong_core::history::HistoryMode::None, "Should exit viewing mode");
            assert!(
                description.contains("present") || description.contains("Present"),
                "Description should mention returning to present: {}",
                description
            );
        }
        other => panic!("Expected StateRestored, got {:?}", other),
    }

    // Request history list to verify no truncation
    send_command(&mut client, GameCommand::RequestHistory { player: seat }).await;
    let entries = recv_history_list(&mut client).await;

    assert_eq!(
        entries.len(),
        25,
        "All 25 moves should still exist (no truncation)"
    );
}

/// Test 5: Verify error handling for invalid history commands.
///
/// # Test Cases
/// 1. Jump to non-existent move (9999)
/// 2. Return to present when not viewing
/// 3. Resume from invalid move number (9999)
///
/// # Validation
/// Server returns errors via one of two mechanisms:
/// - `Envelope::Error` for command validation failures
/// - `GameEvent::HistoryError` for runtime errors
///
/// Tests handle both patterns robustly.
#[tokio::test]
async fn test_websocket_history_errors() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with 10 moves
    let (mut client, _room_id) = setup_practice_game_with_history(addr, &state, 10).await;

    let seat = client.seat.expect("client should have seat");

    // Test 1: Jump to non-existent move (move 9999)
    send_command(
        &mut client,
        GameCommand::JumpToMove {
            player: seat,
            move_number: 9999,
        },
    )
    .await;

    // Server may return Error envelope or HistoryError event
    let response = recv_envelope(&mut client.ws).await;
    match response {
        Envelope::Error(payload) => {
            assert!(
                payload.message.contains("9999") || payload.message.contains("does not exist"),
                "Error should mention non-existent move: {}",
                payload.message
            );
        }
        Envelope::Event(payload) => match payload.event {
            GameEvent::HistoryError { message } => {
                assert!(
                    message.contains("9999") || message.contains("does not exist"),
                    "Error should mention non-existent move: {}",
                    message
                );
            }
            other => panic!("Expected HistoryError for invalid jump, got {:?}", other),
        },
        other => panic!("Expected Error or HistoryError for invalid jump, got {:?}", other),
    }

    // Test 2: Return to present when not viewing
    send_command(&mut client, GameCommand::ReturnToPresent { player: seat }).await;

    let response = recv_envelope(&mut client.ws).await;
    match response {
        Envelope::Error(payload) => {
            assert!(
                payload.message.contains("not") || payload.message.contains("viewing"),
                "Error should mention not in viewing mode: {}",
                payload.message
            );
        }
        Envelope::Event(payload) => match payload.event {
            GameEvent::HistoryError { message } => {
                assert!(
                    message.contains("not") || message.contains("viewing"),
                    "Error should mention not in viewing mode: {}",
                    message
                );
            }
            other => panic!(
                "Expected HistoryError for return when not viewing, got {:?}",
                other
            ),
        },
        other => panic!(
            "Expected Error or HistoryError for return when not viewing, got {:?}",
            other
        ),
    }

    // Test 3: Resume from invalid move number
    // First jump to a valid move to enter viewing mode
    send_command(
        &mut client,
        GameCommand::JumpToMove {
            player: seat,
            move_number: 5,
        },
    )
    .await;
    let _ = recv_event(&mut client.ws).await; // Consume StateRestored

    // Try to resume from invalid move
    send_command(
        &mut client,
        GameCommand::ResumeFromHistory {
            player: seat,
            move_number: 9999,
        },
    )
    .await;

    let response = recv_envelope(&mut client.ws).await;
    match response {
        Envelope::Error(payload) => {
            assert!(
                payload.message.contains("9999") || payload.message.contains("does not exist"),
                "Error should mention invalid move: {}",
                payload.message
            );
        }
        Envelope::Event(payload) => match payload.event {
            GameEvent::HistoryError { message } => {
                assert!(
                    message.contains("9999") || message.contains("does not exist"),
                    "Error should mention invalid move: {}",
                    message
                );
            }
            other => panic!("Expected HistoryError for invalid resume, got {:?}", other),
        },
        other => panic!("Expected Error or HistoryError for invalid resume, got {:?}", other),
    }
}

/// Test 6: Verify multiple clients see consistent history state.
///
/// # Setup
/// - Practice room with 20 mock history entries
/// - Two clients connected to same room
///
/// # Actions & Validation
/// 1. Client 1 jumps to move 10
///    - Client 2 sees full history (viewing mode is per-client)
/// 2. Client 1 resumes from move 10 (truncates history)
///    - Both clients receive HistoryTruncated event (broadcast)
///    - Client 2 now sees truncated history (11 entries: 0-10)
///
/// # Architecture Note
/// Uses timeout-based event collection to handle async broadcast timing.
/// Events may arrive in different order, so tests collect multiple events
/// and search for expected types.
#[tokio::test]
async fn test_websocket_multi_client_history_sync() {
    let (addr, state) = spawn_server().await;

    // Setup practice game with history
    let (mut client1, room_id) = setup_practice_game_with_history(addr, &state, 20).await;

    // Connect second client to same room
    let mut client2 = connect_and_auth(addr).await;
    send_envelope(&mut client2.ws, Envelope::join_room(room_id.clone())).await;

    // Wait for RoomJoined
    loop {
        let response = recv_envelope(&mut client2.ws).await;
        match response {
            Envelope::RoomJoined(payload) => {
                client2.seat = Some(payload.seat);
                break;
            }
            Envelope::Event(_) | Envelope::Ping(_) => continue,
            other => panic!("Expected RoomJoined, got {:?}", other),
        }
    }

    // Drain any startup messages
    drain_messages(&mut client2.ws, Duration::from_millis(100)).await;

    let seat1 = client1.seat.expect("client1 should have seat");
    let seat2 = client2.seat.expect("client2 should have seat");

    // Client 1 jumps to move 10
    send_command(
        &mut client1,
        GameCommand::JumpToMove {
            player: seat1,
            move_number: 10,
        },
    )
    .await;
    let _ = recv_event(&mut client1.ws).await; // Consume StateRestored

    // Client 2 may receive StateRestored broadcast - drain it
    drain_messages(&mut client2.ws, Duration::from_millis(100)).await;

    // Client 2 requests history - should see full history (viewing mode is per-client)
    send_command(&mut client2, GameCommand::RequestHistory { player: seat2 }).await;
    let entries = recv_history_list(&mut client2).await;
    assert_eq!(
        entries.len(),
        20,
        "Client 2 should see full history (20 moves)"
    );

    // Client 1 resumes from move 10 (this truncates history)
    send_command(
        &mut client1,
        GameCommand::ResumeFromHistory {
            player: seat1,
            move_number: 10,
        },
    )
    .await;

    // Client 1 should receive StateRestored (exiting viewing) and HistoryTruncated
    // Collect all events with timeout
    let mut events_client1 = Vec::new();
    for _ in 0..3 {
        // Allow up to 3 events (might get old StateRestored from broadcast)
        match timeout(Duration::from_millis(500), async {
            loop {
                let response = recv_envelope(&mut client1.ws).await;
                match response {
                    Envelope::Event(payload) => return payload.event,
                    Envelope::Ping(_) => continue,
                    other => panic!("expected Event, got {:?}", other),
                }
            }
        })
        .await
        {
            Ok(event) => events_client1.push(event),
            Err(_) => break, // Timeout - no more events
        }
    }

    // Find the HistoryTruncated event
    let truncated_event = events_client1
        .iter()
        .find(|e| matches!(e, GameEvent::HistoryTruncated { .. }));
    assert!(
        truncated_event.is_some(),
        "Client 1 should receive HistoryTruncated, got: {:?}",
        events_client1
    );

    if let Some(GameEvent::HistoryTruncated { from_move }) = truncated_event {
        assert_eq!(*from_move, 11, "Should truncate from move 11");
    }

    // Client 2 should also receive HistoryTruncated (broadcast)
    // Collect events with timeout
    let mut events_client2 = Vec::new();
    for _ in 0..3 {
        match timeout(Duration::from_millis(500), async {
            loop {
                let response = recv_envelope(&mut client2.ws).await;
                match response {
                    Envelope::Event(payload) => return payload.event,
                    Envelope::Ping(_) => continue,
                    other => panic!("expected Event, got {:?}", other),
                }
            }
        })
        .await
        {
            Ok(event) => events_client2.push(event),
            Err(_) => break,
        }
    }

    // Find HistoryTruncated event
    let truncated_event = events_client2
        .iter()
        .find(|e| matches!(e, GameEvent::HistoryTruncated { .. }));
    assert!(
        truncated_event.is_some(),
        "Client 2 should receive HistoryTruncated, got: {:?}",
        events_client2
    );

    if let Some(GameEvent::HistoryTruncated { from_move }) = truncated_event {
        assert_eq!(*from_move, 11, "Client 2 should see truncation from move 11");
    }

    // Client 2 requests history again - should see truncated history
    send_command(&mut client2, GameCommand::RequestHistory { player: seat2 }).await;
    let entries = recv_history_list(&mut client2).await;
    assert_eq!(
        entries.len(),
        11,
        "Client 2 should now see truncated history (11 entries: 0-10)"
    );
}
