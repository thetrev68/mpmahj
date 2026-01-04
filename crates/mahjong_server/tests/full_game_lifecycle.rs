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
    flow::{CharlestonStage, CharlestonVote, TurnStage},
    player::Seat,
    tile::Tile,
};
use mahjong_server::network::{ws_handler, Envelope, NetworkState};
use mahjong_server::network::messages::{
    AuthMethod,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};
use tokio_tungstenite::connect_async;
use url::Url;

type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

fn pick_non_jokers(tiles: &[Tile], count: usize) -> Vec<Tile> {
    tiles
        .iter()
        .copied()
        .filter(|tile| !tile.is_joker())
        .take(count)
        .collect()
}

fn remaining_tiles(base: &[Tile], removed: &[Tile]) -> Vec<Tile> {
    let mut remaining = base.to_vec();
    for tile in removed {
        if let Some(pos) = remaining.iter().position(|t| t == tile) {
            remaining.remove(pos);
        }
    }
    remaining
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

async fn connect_and_auth(addr: SocketAddr) -> WsStream {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (mut ws, _) = connect_async(url).await.unwrap();

    let auth = Envelope::authenticate(AuthMethod::Guest, None);
    ws.send(tokio_tungstenite::tungstenite::Message::Text(auth.to_json().unwrap()))
        .await
        .unwrap();

    // Read until AuthSuccess
    loop {
        let msg = timeout(Duration::from_secs(2), ws.next()).await.unwrap().unwrap().unwrap();
        let text = msg.into_text().unwrap();
        if let Envelope::AuthSuccess(_) = Envelope::from_json(&text).unwrap() {
            break;
        }
    }
    ws
}

async fn send_cmd(ws: &mut WsStream, cmd: GameCommand) {
    let envelope = Envelope::Command(mahjong_server::network::messages::CommandPayload {
        command: cmd,
    });
    ws.send(tokio_tungstenite::tungstenite::Message::Text(envelope.to_json().unwrap()))
        .await
        .unwrap();
}

async fn read_until_event<F>(ws: &mut WsStream, predicate: F) -> GameEvent 
where F: Fn(&GameEvent) -> bool {
    loop {
        let msg = timeout(Duration::from_secs(5), ws.next()).await.expect("Timeout").expect("Closed").expect("Error");
        let text = msg.into_text().unwrap();
        let envelope = Envelope::from_json(&text).unwrap();
        
        match envelope {
            Envelope::Event(payload) => {
                if predicate(&payload.event) {
                    return payload.event;
                }
            }
            Envelope::Ping(_) => {}
            Envelope::Error(e) => panic!("Server error: {:?}", e),
            other => println!("Ignored envelope: {:?}", other),
        }
    }
}

#[tokio::test]
async fn test_full_game_lifecycle() {
    let (addr, _state) = spawn_server().await;
    println!("Server spawned");

    // 1. Connect
    let mut east = connect_and_auth(addr).await;
    let mut south = connect_and_auth(addr).await;
    let mut west = connect_and_auth(addr).await;
    let mut north = connect_and_auth(addr).await;
    println!("Clients connected");

    // 2. Create Room
    let create = Envelope::create_room();
    east.send(tokio_tungstenite::tungstenite::Message::Text(create.to_json().unwrap())).await.unwrap();

    // Get Room ID
    let room_id = loop {
        let msg = east.next().await.unwrap().unwrap();
        let text = msg.into_text().unwrap();
        if let Envelope::RoomJoined(payload) = Envelope::from_json(&text).unwrap() {
            break payload.room_id;
        }
    };
    println!("Room created: {}", room_id);

    // 3. Join Room
    for client in [&mut south, &mut west, &mut north] {
        let join = Envelope::join_room(room_id.clone());
        client.send(tokio_tungstenite::tungstenite::Message::Text(join.to_json().unwrap())).await.unwrap();
        // Consume RoomJoined
        loop {
            let msg = client.next().await.unwrap().unwrap();
            if let Envelope::RoomJoined(_) = Envelope::from_json(&msg.into_text().unwrap()).unwrap() {
                break;
            }
        }
    }
    println!("Everyone joined");

    // 4. Roll Dice
    send_cmd(&mut east, GameCommand::RollDice { player: Seat::East }).await;
    read_until_event(&mut east, |e| matches!(e, GameEvent::WallBroken { .. })).await;
    println!("Dice rolled");

    // 5. Ready
    send_cmd(&mut east, GameCommand::ReadyToStart { player: Seat::East }).await;
    send_cmd(&mut south, GameCommand::ReadyToStart { player: Seat::South }).await;
    send_cmd(&mut west, GameCommand::ReadyToStart { player: Seat::West }).await;
    send_cmd(&mut north, GameCommand::ReadyToStart { player: Seat::North }).await;
    println!("Everyone ready");

    // 6. Capture Hands
    let mut hands = [vec![], vec![], vec![], vec![]];
    
    // Read East hand
    if let GameEvent::TilesDealt { your_tiles } = read_until_event(&mut east, |e| matches!(e, GameEvent::TilesDealt { .. })).await {
        hands[0] = your_tiles;
    }
    // Read South hand
    if let GameEvent::TilesDealt { your_tiles } = read_until_event(&mut south, |e| matches!(e, GameEvent::TilesDealt { .. })).await {
        hands[1] = your_tiles;
    }
    // Read West hand
    if let GameEvent::TilesDealt { your_tiles } = read_until_event(&mut west, |e| matches!(e, GameEvent::TilesDealt { .. })).await {
        hands[2] = your_tiles;
    }
    // Read North hand
    if let GameEvent::TilesDealt { your_tiles } = read_until_event(&mut north, |e| matches!(e, GameEvent::TilesDealt { .. })).await {
        hands[3] = your_tiles;
    }
    println!("Hands captured");

    let pass_tiles: Vec<Vec<Tile>> = hands
        .iter()
        .map(|hand| {
            let tiles = pick_non_jokers(hand, 9);
            assert_eq!(tiles.len(), 9, "Not enough non-joker tiles to pass");
            tiles
        })
        .collect();

    // Wait for Charleston Start
    read_until_event(&mut east, |e| matches!(e, GameEvent::CharlestonPhaseChanged { stage: CharlestonStage::FirstRight })).await;
    println!("Charleston Started");

    // 7. Pass Tiles (First Right)
    // East Pass
    let pass_east = pass_tiles[0][0..3].to_vec();
    send_cmd(&mut east, GameCommand::PassTiles { player: Seat::East, tiles: pass_east.clone(), blind_pass_count: None }).await;
    
    // South Pass
    let pass_south = pass_tiles[1][0..3].to_vec();
    send_cmd(&mut south, GameCommand::PassTiles { player: Seat::South, tiles: pass_south.clone(), blind_pass_count: None }).await;
    
    // West Pass
    let pass_west = pass_tiles[2][0..3].to_vec();
    send_cmd(&mut west, GameCommand::PassTiles { player: Seat::West, tiles: pass_west.clone(), blind_pass_count: None }).await;
    
    // North Pass
    let pass_north = pass_tiles[3][0..3].to_vec();
    send_cmd(&mut north, GameCommand::PassTiles { player: Seat::North, tiles: pass_north.clone(), blind_pass_count: None }).await;
    println!("First Pass Sent");

    read_until_event(&mut east, |e| matches!(e, GameEvent::CharlestonPhaseChanged { stage: CharlestonStage::FirstAcross })).await;
    println!("Moved to FirstAcross");
    tokio::time::sleep(Duration::from_millis(1100)).await;

    // 8. Pass Tiles (First Across) - Use indices 3,4,5
    let pass_east_2 = pass_tiles[0][3..6].to_vec();
    send_cmd(&mut east, GameCommand::PassTiles { player: Seat::East, tiles: pass_east_2, blind_pass_count: None }).await;
    
    let pass_south_2 = pass_tiles[1][3..6].to_vec();
    send_cmd(&mut south, GameCommand::PassTiles { player: Seat::South, tiles: pass_south_2, blind_pass_count: None }).await;
    
    let pass_west_2 = pass_tiles[2][3..6].to_vec();
    send_cmd(&mut west, GameCommand::PassTiles { player: Seat::West, tiles: pass_west_2, blind_pass_count: None }).await;
    
    let pass_north_2 = pass_tiles[3][3..6].to_vec();
    send_cmd(&mut north, GameCommand::PassTiles { player: Seat::North, tiles: pass_north_2, blind_pass_count: None }).await;
    
    read_until_event(&mut east, |e| matches!(e, GameEvent::CharlestonPhaseChanged { stage: CharlestonStage::FirstLeft })).await;
    println!("Moved to FirstLeft");
    tokio::time::sleep(Duration::from_millis(1100)).await;

    // 9. Pass Tiles (First Left) - Use indices 6,7,8
    let pass_east_3 = pass_tiles[0][6..9].to_vec();
    send_cmd(&mut east, GameCommand::PassTiles { player: Seat::East, tiles: pass_east_3, blind_pass_count: None }).await;
    
    let pass_south_3 = pass_tiles[1][6..9].to_vec();
    send_cmd(&mut south, GameCommand::PassTiles { player: Seat::South, tiles: pass_south_3, blind_pass_count: None }).await;
    
    let pass_west_3 = pass_tiles[2][6..9].to_vec();
    send_cmd(&mut west, GameCommand::PassTiles { player: Seat::West, tiles: pass_west_3, blind_pass_count: None }).await;
    
    let pass_north_3 = pass_tiles[3][6..9].to_vec();
    send_cmd(&mut north, GameCommand::PassTiles { player: Seat::North, tiles: pass_north_3, blind_pass_count: None }).await;

    read_until_event(&mut east, |e| matches!(e, GameEvent::CharlestonPhaseChanged { stage: CharlestonStage::VotingToContinue })).await;

    // 10. Voting
    println!("Voting");
    send_cmd(&mut east, GameCommand::VoteCharleston { player: Seat::East, vote: CharlestonVote::Stop }).await;
    send_cmd(&mut south, GameCommand::VoteCharleston { player: Seat::South, vote: CharlestonVote::Stop }).await;
    send_cmd(&mut west, GameCommand::VoteCharleston { player: Seat::West, vote: CharlestonVote::Stop }).await;
    send_cmd(&mut north, GameCommand::VoteCharleston { player: Seat::North, vote: CharlestonVote::Stop }).await;

    read_until_event(&mut east, |e| matches!(e, GameEvent::CharlestonPhaseChanged { stage: CharlestonStage::CourtesyAcross })).await;
    println!("Moved to CourtesyAcross");
    tokio::time::sleep(Duration::from_millis(1100)).await;

    // 11. Courtesy Pass
    send_cmd(&mut east, GameCommand::AcceptCourtesyPass { player: Seat::East, tiles: vec![] }).await;
    send_cmd(&mut south, GameCommand::AcceptCourtesyPass { player: Seat::South, tiles: vec![] }).await;
    send_cmd(&mut west, GameCommand::AcceptCourtesyPass { player: Seat::West, tiles: vec![] }).await;
    send_cmd(&mut north, GameCommand::AcceptCourtesyPass { player: Seat::North, tiles: vec![] }).await;

    // 12. Playing Phase
    let _event = read_until_event(&mut east, |e| matches!(e, GameEvent::TurnChanged { .. }) || matches!(e, GameEvent::CharlestonComplete)).await;
    println!("Moved to Playing");
    // Actually CharlestonComplete comes first, then TurnChanged?
    // Logic in table.rs: emits CharlestonComplete, then transition_phase(CharlestonComplete) which sets phase to Playing.
    // Then East needs to discard. Wait, East STARTS with 14 tiles (dealt extra). So East starts in Discarding phase.
    // The event emitted is... actually, table.rs doesn't emit TurnChanged when entering Playing from Charleston.
    // It emits GameEvent::CharlestonComplete.
    // Clients are expected to know that after CharlestonComplete, it is East's turn to discard.
    // Let's check `table.rs` apply_accept_courtesy_pass:
    // It emits CharlestonComplete.
    // It does NOT explicitly emit TurnChanged.
    // The phase transition happens silently?
    // transition_phase -> GamePhase::Playing(TurnStage::Discarding { player: Seat::East })
    // The clients should treat CharlestonComplete as "Game Start / East Turn".
    
    // East Discards a tile from the original hand that was not passed.
    let east_remaining = remaining_tiles(&hands[0], &pass_tiles[0]);
    let discard_tile = *east_remaining.first().expect("East has no tiles left");
    send_cmd(&mut east, GameCommand::DiscardTile { player: Seat::East, tile: discard_tile }).await;
    
    // Should see TileDiscarded and CallWindowOpened
    read_until_event(&mut east, |e| matches!(e, GameEvent::CallWindowOpened { .. })).await;
    
    // 13. Everyone Passes
    send_cmd(&mut south, GameCommand::Pass { player: Seat::South }).await;
    send_cmd(&mut west, GameCommand::Pass { player: Seat::West }).await;
    send_cmd(&mut north, GameCommand::Pass { player: Seat::North }).await;
    
    // 14. Turn Changes to South
    let turn_event = read_until_event(&mut east, |e| matches!(e, GameEvent::TurnChanged { .. })).await;
    if let GameEvent::TurnChanged { player, stage } = turn_event {
        assert_eq!(player, Seat::South);
        assert!(matches!(stage, TurnStage::Drawing { .. }));
    } else {
        panic!("Expected TurnChanged");
    }

    // Success!
}
