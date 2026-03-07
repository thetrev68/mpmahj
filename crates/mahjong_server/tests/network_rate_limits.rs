use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use mahjong_core::command::GameCommand;
use mahjong_core::player::Seat;
use mahjong_server::network::messages::ErrorCode;
use mahjong_server::network::{ws_handler, Envelope, NetworkState};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};
use tokio_tungstenite::connect_async;
use url::Url;

async fn ws_route(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws_handler(ws, State(state), addr).await
}

async fn spawn_server() -> SocketAddr {
    let state = Arc::new(NetworkState::new());
    let app = Router::new().route("/ws", get(ws_route)).with_state(state);

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

    addr
}

async fn recv_envelope(
    ws: &mut tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
) -> Envelope {
    let msg = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("timeout waiting for message")
        .expect("stream closed")
        .expect("message error");

    let text = msg.into_text().expect("expected text message");
    Envelope::from_json(&text).expect("invalid envelope")
}

async fn connect_and_auth(
    addr: SocketAddr,
) -> tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>> {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (mut ws, _) = connect_async(url).await.unwrap();

    let auth = Envelope::authenticate(mahjong_server::network::messages::AuthMethod::Guest, None);
    let json = auth.to_json().unwrap();
    ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
        .await
        .unwrap();

    let response = recv_envelope(&mut ws).await;
    match response {
        Envelope::AuthSuccess(_) => {}
        other => panic!("expected AuthSuccess, got {:?}", other),
    }

    ws
}

#[tokio::test]
async fn auth_rate_limit_is_per_ip() {
    let addr = spawn_server().await;
    let mut successes = 0;
    let mut rate_limited = 0;

    for _ in 0..6 {
        let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
        let (mut ws, _) = connect_async(url).await.unwrap();

        let auth =
            Envelope::authenticate(mahjong_server::network::messages::AuthMethod::Guest, None);
        let json = auth.to_json().unwrap();
        ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await
            .unwrap();

        let response = recv_envelope(&mut ws).await;
        match response {
            Envelope::AuthSuccess(_) => {
                successes += 1;
            }
            Envelope::Error(payload) => {
                if payload.code == ErrorCode::RateLimitExceeded {
                    rate_limited += 1;
                }
            }
            other => panic!("unexpected response: {:?}", other),
        }
    }

    assert_eq!(successes, 5);
    assert_eq!(rate_limited, 1);
}

#[tokio::test]
async fn command_without_room_returns_invalid_command() {
    let addr = spawn_server().await;
    let mut ws = connect_and_auth(addr).await;

    for _ in 0..15 {
        let command = Envelope::command(GameCommand::RequestState { player: Seat::East });
        let json = command.to_json().unwrap();
        ws.send(tokio_tungstenite::tungstenite::Message::Text(json))
            .await
            .unwrap();
    }

    let mut error_codes = Vec::new();
    for _ in 0..15 {
        if let Envelope::Error(payload) = recv_envelope(&mut ws).await {
            error_codes.push(payload.code);
        }
    }

    assert!(!error_codes.is_empty());
    assert!(error_codes
        .iter()
        .all(|code| *code == ErrorCode::InvalidCommand));
}
