#![allow(dead_code)]

use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use mahjong_core::{
    command::GameCommand,
    event::{public_events::PublicEvent, Event},
    player::Seat,
    tile::Tile,
};
use mahjong_server::analysis::AnalysisMode;
use mahjong_server::network::bot_runner::spawn_bot_runner;
use mahjong_server::network::messages::{
    AuthMethod, CommandPayload, Credentials, RoomClosedPayload, RoomJoinedPayload, RoomLeftPayload,
    RoomMemberLeftPayload,
};
use mahjong_server::network::{ws_handler, Envelope, NetworkState, Room};
use std::net::SocketAddr;
/// Common test utilities shared across integration tests
use std::sync::{Arc, Once};
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration, Instant};
use tokio_tungstenite::connect_async;
use url::Url;

static INIT: Once = Once::new();

/// Initialize test environment (load .env, setup tracing, etc.)
pub fn init_test_env() {
    INIT.call_once(|| {
        let _ = dotenvy::from_filename("../../.env");
        let _ = dotenvy::dotenv();
        let _ = tracing_subscriber::fmt()
            .with_test_writer()
            .with_env_filter("debug")
            .try_init();
    });
}

pub type WsStream =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

pub struct Client {
    pub ws: WsStream,
    pub player_id: String,
    pub session_token: String,
    pub seat: Option<Seat>,
    pub pending_game_starting: bool,
}

async fn ws_route(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws_handler(ws, State(state), addr).await
}

pub async fn spawn_server() -> (SocketAddr, Arc<NetworkState>) {
    init_test_env();
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

pub async fn connect_ws(addr: SocketAddr) -> WsStream {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (ws, _) = connect_async(url).await.unwrap();
    ws
}

pub async fn send_envelope(ws: &mut WsStream, envelope: Envelope) {
    let json = envelope.to_json().unwrap();
    ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
        .await
        .unwrap();
}

pub async fn send_command(ws: &mut WsStream, cmd: GameCommand) {
    let envelope = Envelope::Command(CommandPayload { command: cmd });
    send_envelope(ws, envelope).await;
}

pub async fn recv_envelope(ws: &mut WsStream) -> Envelope {
    let msg = timeout(Duration::from_secs(45), ws.next())
        .await
        .expect("timeout waiting for message")
        .expect("stream closed")
        .expect("message error");

    let text = msg.into_text().expect("expected text message");
    Envelope::from_json(&text).expect("invalid envelope")
}

pub async fn recv_event(ws: &mut WsStream) -> Event {
    loop {
        let response = recv_envelope(ws).await;
        match response {
            Envelope::Event(payload) => return payload.event,
            Envelope::Ping(payload) => {
                let pong = Envelope::Pong(mahjong_server::network::messages::PongPayload {
                    timestamp: payload.timestamp,
                });
                send_envelope(ws, pong).await;
                continue;
            }
            other => panic!("expected Event, got {:?}", other),
        }
    }
}

pub async fn recv_event_for<F>(client: &mut Client, predicate: F) -> Event
where
    F: Fn(&Event) -> bool,
{
    loop {
        let event = recv_event(&mut client.ws).await;
        if matches!(event, Event::Public(PublicEvent::GameStarting)) {
            client.pending_game_starting = true;
        }
        if predicate(&event) {
            return event;
        }
    }
}

pub async fn read_until_event_with_timeout<F>(
    ws: &mut WsStream,
    duration: Duration,
    predicate: F,
) -> Event
where
    F: Fn(&Event) -> bool,
{
    let deadline = Instant::now() + duration;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            panic!("Timeout waiting for event");
        }

        match timeout(remaining, ws.next()).await {
            Ok(Some(Ok(msg))) => {
                let text = msg.into_text().expect("expected text message");
                let envelope = Envelope::from_json(&text).expect("invalid envelope");
                match envelope {
                    Envelope::Event(payload) => {
                        if predicate(&payload.event) {
                            return payload.event;
                        }
                    }
                    Envelope::Ping(payload) => {
                        let pong = Envelope::Pong(mahjong_server::network::messages::PongPayload {
                            timestamp: payload.timestamp,
                        });
                        send_envelope(ws, pong).await;
                    }
                    _ => {} // Ignore other messages
                }
            }
            Ok(Some(Err(e))) => panic!("stream error: {:?}", e),
            Ok(None) => panic!("stream closed"),
            Err(_) => panic!("Timeout waiting for event"),
        }
    }
}

pub async fn recv_room_joined(client: &mut Client) -> RoomJoinedPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomJoined(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, Event::Public(PublicEvent::GameStarting)) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomJoined, got {:?}", other),
        }
    }
}

pub async fn recv_room_left(client: &mut Client) -> RoomLeftPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomLeft(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, Event::Public(PublicEvent::GameStarting)) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomLeft, got {:?}", other),
        }
    }
}

pub async fn recv_room_closed(client: &mut Client) -> RoomClosedPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomClosed(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, Event::Public(PublicEvent::GameStarting)) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomClosed, got {:?}", other),
        }
    }
}

pub async fn recv_room_member_left(client: &mut Client) -> RoomMemberLeftPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomMemberLeft(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, Event::Public(PublicEvent::GameStarting)) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomMemberLeft, got {:?}", other),
        }
    }
}

pub async fn assert_no_event_for(ws: &mut WsStream, wait: Duration) {
    let deadline = Instant::now() + wait;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }

        match timeout(remaining, ws.next()).await {
            Err(_) => break,
            Ok(Some(Ok(msg))) => {
                let text = msg.into_text().expect("expected text message");
                let envelope = Envelope::from_json(&text).expect("invalid envelope");
                match envelope {
                    Envelope::Ping(payload) => {
                        let pong = Envelope::Pong(mahjong_server::network::messages::PongPayload {
                            timestamp: payload.timestamp,
                        });
                        send_envelope(ws, pong).await;
                        continue;
                    }
                    Envelope::Event(payload) => {
                        panic!("unexpected event: {:?}", payload.event)
                    }
                    other => panic!("unexpected envelope: {:?}", other),
                }
            }
            Ok(Some(Err(e))) => panic!("unexpected stream error: {:?}", e),
            Ok(None) => panic!("connection closed unexpectedly"),
        }
    }
}

pub async fn drain_messages(ws: &mut WsStream, wait: Duration) {
    let deadline = Instant::now() + wait;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }

        match timeout(remaining, ws.next()).await {
            Err(_) => break,
            Ok(Some(Ok(msg))) => {
                let text = msg.into_text().expect("expected text message");
                let envelope = Envelope::from_json(&text).expect("invalid envelope");
                if let Envelope::Ping(payload) = envelope {
                    let pong = Envelope::Pong(mahjong_server::network::messages::PongPayload {
                        timestamp: payload.timestamp,
                    });
                    send_envelope(ws, pong).await;
                    continue;
                }
            }
            Ok(Some(Err(e))) => panic!("unexpected stream error: {:?}", e),
            Ok(None) => panic!("connection closed unexpectedly"),
        }
    }
}

pub async fn connect_and_auth(addr: SocketAddr) -> Client {
    let mut ws = connect_ws(addr).await;

    let auth = Envelope::authenticate(AuthMethod::Guest, None);
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
        pending_game_starting: false,
    }
}

pub async fn create_room(client: &mut Client) -> (String, Seat) {
    send_envelope(&mut client.ws, Envelope::create_room()).await;
    let payload = recv_room_joined(client).await;
    (payload.room_id, payload.seat)
}

pub async fn join_room(client: &mut Client, room_id: &str) -> Seat {
    send_envelope(&mut client.ws, Envelope::join_room(room_id.to_string())).await;
    let payload = recv_room_joined(client).await;
    payload.seat
}

pub async fn join_room_direct(
    state: &Arc<NetworkState>,
    room_arc: &Arc<tokio::sync::Mutex<Room>>,
    client: &mut Client,
) -> Seat {
    let session = state
        .sessions
        .get_active(&client.player_id)
        .expect("session not found");

    let seat = {
        let mut room = room_arc.lock().await;
        room.join(session).await.expect("join failed")
    };

    client.seat = Some(seat);
    seat
}

pub async fn create_room_with_analysis_config(
    state: &Arc<NetworkState>,
    mode: AnalysisMode,
    timeout_ms: u64,
) -> (String, Arc<tokio::sync::Mutex<Room>>) {
    let (room_id, room_arc) = state.rooms.create_room();
    {
        let mut room = room_arc.lock().await;
        room.analysis.config_mut().mode = mode;
        room.analysis.config_mut().timeout_ms = timeout_ms;
    }
    (room_id, room_arc)
}

pub async fn add_bots_and_start(room_arc: &Arc<tokio::sync::Mutex<Room>>, _count: usize) {
    let mut room = room_arc.lock().await;
    room.fill_empty_seats_with_bots();
    if room.should_start_game() {
        room.start_game().await;
    }
    drop(room); // Drop lock before spawning runner

    // Spawn bot runner to drive bots
    spawn_bot_runner(room_arc.clone());
}

pub async fn reconnect_with_token(addr: SocketAddr, session_token: &str) -> Client {
    let mut ws = connect_ws(addr).await;
    let auth = Envelope::authenticate(
        AuthMethod::Token,
        Some(Credentials {
            token: session_token.to_string(),
        }),
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
        pending_game_starting: false,
    }
}

// Helpers for charleston flow
pub fn pick_non_jokers(tiles: &[Tile], count: usize) -> Vec<Tile> {
    tiles
        .iter()
        .copied()
        .filter(|tile| !tile.is_joker())
        .take(count)
        .collect()
}
