use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use mahjong_core::{event::GameEvent, player::Seat, tile::tiles::BAM_1};
use mahjong_server::network::{ws_handler, Envelope, NetworkState, Room};
use mahjong_server::network::messages::{
    AuthMethod,
    AuthSuccessPayload,
    Credentials,
    RoomClosedPayload,
    RoomJoinedPayload,
    RoomLeftPayload,
    RoomMemberLeftPayload,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration, Instant};
use tokio_tungstenite::connect_async;
use url::Url;

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

struct Client {
    ws: WsStream,
    player_id: String,
    session_token: String,
    seat: Option<Seat>,
    pending_game_starting: bool,
}

async fn ws_route(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws_handler(ws, State(state), addr).await
}

async fn spawn_server() -> (SocketAddr, Arc<NetworkState>) {
    let state = Arc::new(NetworkState::new());
    let app = Router::new()
        .route("/ws", get(ws_route))
        .with_state(state.clone());

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
            .await
            .unwrap();
    });

    (addr, state)
}

async fn connect_ws(addr: SocketAddr) -> WsStream {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (ws, _) = connect_async(url).await.unwrap();
    ws
}

async fn send_envelope(ws: &mut WsStream, envelope: Envelope) {
    let json = envelope.to_json().unwrap();
    ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
        .await
        .unwrap();
}

async fn recv_envelope(ws: &mut WsStream) -> Envelope {
    let msg = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("timeout waiting for message")
        .expect("stream closed")
        .expect("message error");

    let text = msg.into_text().expect("expected text message");
    Envelope::from_json(&text).expect("invalid envelope")
}

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

async fn recv_event_for<F>(client: &mut Client, predicate: F) -> GameEvent
where
    F: Fn(&GameEvent) -> bool,
{
    loop {
        let event = recv_event(&mut client.ws).await;
        if matches!(event, GameEvent::GameStarting) {
            client.pending_game_starting = true;
        }
        if predicate(&event) {
            return event;
        }
    }
}

async fn recv_room_joined(client: &mut Client) -> RoomJoinedPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomJoined(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, GameEvent::GameStarting) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomJoined, got {:?}", other),
        }
    }
}

async fn recv_room_left(client: &mut Client) -> RoomLeftPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomLeft(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, GameEvent::GameStarting) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomLeft, got {:?}", other),
        }
    }
}

async fn recv_room_closed(client: &mut Client) -> RoomClosedPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomClosed(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, GameEvent::GameStarting) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomClosed, got {:?}", other),
        }
    }
}

async fn recv_room_member_left(client: &mut Client) -> RoomMemberLeftPayload {
    loop {
        let response = recv_envelope(&mut client.ws).await;
        match response {
            Envelope::RoomMemberLeft(payload) => return payload,
            Envelope::Event(payload) => {
                if matches!(payload.event, GameEvent::GameStarting) {
                    client.pending_game_starting = true;
                }
            }
            Envelope::Ping(_) => continue,
            other => panic!("expected RoomMemberLeft, got {:?}", other),
        }
    }
}

async fn assert_no_event_for(ws: &mut WsStream, wait: Duration) {
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
                    Envelope::Ping(_) => continue,
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

async fn drain_messages(ws: &mut WsStream, wait: Duration) {
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
                if let Envelope::Ping(_) = envelope {
                    continue;
                }
            }
            Ok(Some(Err(e))) => panic!("unexpected stream error: {:?}", e),
            Ok(None) => panic!("connection closed unexpectedly"),
        }
    }
}

async fn connect_and_auth(addr: SocketAddr) -> Client {
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

async fn create_room(client: &mut Client) -> (String, Seat) {
    send_envelope(&mut client.ws, Envelope::create_room()).await;
    let payload = recv_room_joined(client).await;
    (payload.room_id, payload.seat)
}

async fn join_room(client: &mut Client, room_id: &str) -> Seat {
    send_envelope(&mut client.ws, Envelope::join_room(room_id.to_string())).await;
    let payload = recv_room_joined(client).await;
    payload.seat
}

async fn join_room_direct(
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

#[tokio::test]
async fn authenticate_guest_success() {
    let (addr, _state) = spawn_server().await;
    let client = connect_and_auth(addr).await;
    assert!(!client.player_id.is_empty());
    assert!(!client.session_token.is_empty());
}

#[tokio::test]
async fn authenticate_token_invalid() {
    let (addr, _state) = spawn_server().await;
    let mut ws = connect_ws(addr).await;

    let auth = Envelope::authenticate(
        AuthMethod::Token,
        Some(Credentials {
            token: "invalid-token".to_string(),
        }),
    );
    send_envelope(&mut ws, auth).await;

    let response = recv_envelope(&mut ws).await;
    match response {
        Envelope::AuthFailure(payload) => {
            assert!(payload.reason.contains("Invalid session token"));
        }
        other => panic!("expected AuthFailure, got {:?}", other),
    }
}

#[tokio::test]
async fn room_join_allocates_seats() {
    let (addr, state) = spawn_server().await;
    let mut clients = Vec::new();

    for _ in 0..4 {
        clients.push(connect_and_auth(addr).await);
    }

    let (room_id, seat) = create_room(&mut clients[0]).await;
    clients[0].seat = Some(seat);

    let mut assigned = vec![seat];

    for client in clients.iter_mut().skip(1) {
        let seat = join_room(client, &room_id).await;
        client.seat = Some(seat);
        assigned.push(seat);
    }

    assigned.sort_by_key(|seat| seat.index());
    assert_eq!(assigned, vec![Seat::East, Seat::South, Seat::West, Seat::North]);

    for client in clients.iter() {
        let session = state
            .sessions
            .get_active(&client.player_id)
            .expect("session not found");
        let session = session.lock().await;
        assert_eq!(session.room_id.as_deref(), Some(room_id.as_str()));
        assert_eq!(session.seat, client.seat);
    }
}

#[tokio::test]
async fn event_routing_public_and_private() {
    let (addr, state) = spawn_server().await;
    let mut clients = Vec::new();

    for _ in 0..4 {
        clients.push(connect_and_auth(addr).await);
    }

    let (room_id, seat) = create_room(&mut clients[0]).await;
    clients[0].seat = Some(seat);

    for client in clients.iter_mut().skip(1) {
        let seat = join_room(client, &room_id).await;
        client.seat = Some(seat);
    }

    for client in clients.iter_mut() {
        if client.pending_game_starting {
            continue;
        }

        let event = recv_event_for(client, |event| {
            matches!(event, GameEvent::GameStarting)
        })
        .await;
        assert!(matches!(event, GameEvent::GameStarting));
    }

    for client in clients.iter_mut() {
        drain_messages(&mut client.ws, Duration::from_millis(100)).await;
    }

    let room_arc = state.rooms.get_room(&room_id).expect("room missing");
    let target_seat = {
        let room = room_arc.lock().await;
        room.table.as_ref().expect("table missing").current_turn
    };

    {
        let room = room_arc.lock().await;
        room.broadcast_event(GameEvent::TileDrawn {
            tile: Some(BAM_1),
            remaining_tiles: 100,
        })
        .await;
    }

    for client in clients.iter_mut() {
        if client.seat == Some(target_seat) {
            let event = recv_event_for(client, |event| {
                matches!(event, GameEvent::TileDrawn { .. })
            })
            .await;
            assert!(matches!(event, GameEvent::TileDrawn { .. }));
        } else {
            assert_no_event_for(&mut client.ws, Duration::from_millis(200)).await;
        }
    }
}

#[tokio::test]
async fn leave_room_notifies_members() {
    let (addr, state) = spawn_server().await;
    let mut host = connect_and_auth(addr).await;
    let mut guest = connect_and_auth(addr).await;

    let (room_id, seat) = create_room(&mut host).await;
    host.seat = Some(seat);

    let guest_seat = join_room(&mut guest, &room_id).await;
    guest.seat = Some(guest_seat);

    send_envelope(&mut guest.ws, Envelope::leave_room()).await;

    let payload = recv_room_left(&mut guest).await;
    assert_eq!(payload.room_id, room_id);

    let payload = recv_room_member_left(&mut host).await;
    assert_eq!(payload.room_id, room_id);
    assert_eq!(payload.player_id, guest.player_id);
    assert_eq!(payload.seat, guest_seat);

    let session = state
        .sessions
        .get_active(&guest.player_id)
        .expect("session not found");
    let session = session.lock().await;
    assert!(session.room_id.is_none());
    assert!(session.seat.is_none());
}

#[tokio::test]
async fn close_room_notifies_all() {
    let (addr, state) = spawn_server().await;
    let mut host = connect_and_auth(addr).await;
    let mut guest = connect_and_auth(addr).await;

    let (room_id, seat) = create_room(&mut host).await;
    host.seat = Some(seat);

    let guest_seat = join_room(&mut guest, &room_id).await;
    guest.seat = Some(guest_seat);

    send_envelope(&mut host.ws, Envelope::close_room()).await;

    let payload = recv_room_closed(&mut host).await;
    assert_eq!(payload.room_id, room_id);

    let payload = recv_room_closed(&mut guest).await;
    assert_eq!(payload.room_id, room_id);

    assert!(state.rooms.get_room(&room_id).is_none());

    for player_id in [&host.player_id, &guest.player_id] {
        let session = state
            .sessions
            .get_active(player_id)
            .expect("session not found");
        let session = session.lock().await;
        assert!(session.room_id.is_none());
        assert!(session.seat.is_none());
    }
}

#[tokio::test]
async fn reconnect_restores_room_and_seat() {
    let (addr, state) = spawn_server().await;
    let mut client = connect_and_auth(addr).await;

    let (room_id, room_arc) = state.rooms.create_room();
    let seat = join_room_direct(&state, &room_arc, &mut client).await;

    client
        .ws
        .close(None)
        .await
        .expect("close failed");

    tokio::time::sleep(Duration::from_millis(100)).await;

    let mut ws = connect_ws(addr).await;
    let auth = Envelope::authenticate(
        AuthMethod::Token,
        Some(Credentials {
            token: client.session_token.clone(),
        }),
    );
    send_envelope(&mut ws, auth).await;

    let response = recv_envelope(&mut ws).await;
    match response {
        Envelope::AuthSuccess(AuthSuccessPayload { player_id, .. }) => {
            assert_eq!(player_id, client.player_id);
        }
        other => panic!("expected AuthSuccess, got {:?}", other),
    }

    let session = state
        .sessions
        .get_active(&client.player_id)
        .expect("session not restored");
    let session = session.lock().await;
    assert_eq!(session.room_id.as_deref(), Some(room_id.as_str()));
    assert_eq!(session.seat, Some(seat));
}

#[tokio::test(start_paused = true)]
async fn ping_pong_timeout_disconnects() {
    let (addr, state) = spawn_server().await;
    let mut client = connect_and_auth(addr).await;

    {
        let session = state
            .sessions
            .get_active(&client.player_id)
            .expect("session not found");
        let mut session = session.lock().await;
        session.last_pong = chrono::Utc::now() - chrono::Duration::seconds(61);
    }

    tokio::time::advance(Duration::from_secs(31)).await;
    tokio::task::yield_now().await;

    assert!(state.sessions.get_active(&client.player_id).is_none());
    assert_eq!(state.sessions.stored_count(), 1);

    let _ = client.ws.next().await;
}
