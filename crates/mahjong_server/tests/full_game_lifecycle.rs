use axum::{
    extract::{ConnectInfo, State, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use mahjong_core::{
    command::GameCommand,
    event::{private_events::PrivateEvent, public_events::PublicEvent, Event},
    flow::charleston::{CharlestonStage, CharlestonVote},
    flow::playing::TurnStage,
    player::Seat,
    tile::Tile,
};
use mahjong_server::network::messages::AuthMethod;
use mahjong_server::network::{ws_handler, Envelope, NetworkState};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::time::{timeout, Duration};
use tokio_tungstenite::connect_async;
use url::Url;

type WsStream =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

fn pick_non_jokers(tiles: &[Tile], count: usize) -> Vec<Tile> {
    tiles
        .iter()
        .copied()
        .filter(|tile| !tile.is_joker())
        .take(count)
        .collect()
}

fn remove_tiles(hand: &mut Vec<Tile>, removed: &[Tile]) {
    for tile in removed {
        if let Some(pos) = hand.iter().position(|t| t == tile) {
            hand.remove(pos);
        } else {
            panic!("Attempted to remove tile not present in tracked hand: {tile:?}");
        }
    }
}

fn pick_pass_tiles_from_hand(
    hand: &[Tile],
    count: usize,
    seat: Seat,
    stage: CharlestonStage,
) -> Vec<Tile> {
    let picked = pick_non_jokers(hand, count);
    assert_eq!(
        picked.len(),
        count,
        "Not enough non-joker tiles in {:?} hand for {:?}",
        seat,
        stage
    );
    picked
}

async fn read_incoming_tiles_staged(ws: &mut WsStream) -> Vec<Tile> {
    if let Event::Private(PrivateEvent::IncomingTilesStaged { tiles, .. }) =
        read_until_event(ws, |e| {
            matches!(e, Event::Private(PrivateEvent::IncomingTilesStaged { .. }))
        })
        .await
    {
        tiles
    } else {
        unreachable!("read_until_event returned a non-IncomingTilesStaged event");
    }
}

async fn ws_route(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<NetworkState>>,
) -> Response {
    ws_handler(ws, State(state), addr).await
}

async fn spawn_server() -> std::io::Result<(SocketAddr, Arc<NetworkState>)> {
    let state = Arc::new(NetworkState::new());
    let app = Router::new()
        .route("/ws", get(ws_route))
        .with_state(state.clone());

    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;

    tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });

    Ok((addr, state))
}

async fn connect_and_auth(addr: SocketAddr) -> WsStream {
    let url = Url::parse(&format!("ws://{}/ws", addr)).unwrap();
    let (mut ws, _) = connect_async(url).await.unwrap();

    let auth = Envelope::authenticate(AuthMethod::Guest, None);
    ws.send(tokio_tungstenite::tungstenite::Message::Text(
        auth.to_json().unwrap(),
    ))
    .await
    .unwrap();

    // Read until AuthSuccess
    loop {
        let msg = timeout(Duration::from_secs(2), ws.next())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        let text = msg.into_text().unwrap();
        if let Envelope::AuthSuccess(_) = Envelope::from_json(&text).unwrap() {
            break;
        }
    }
    ws
}

async fn send_cmd(ws: &mut WsStream, cmd: GameCommand) {
    let envelope =
        Envelope::Command(mahjong_server::network::messages::CommandPayload { command: cmd });
    ws.send(tokio_tungstenite::tungstenite::Message::Text(
        envelope.to_json().unwrap(),
    ))
    .await
    .unwrap();
}

async fn read_until_event<F>(ws: &mut WsStream, predicate: F) -> Event
where
    F: Fn(&Event) -> bool,
{
    loop {
        let msg = timeout(Duration::from_secs(5), ws.next())
            .await
            .expect("Timeout")
            .expect("Closed")
            .expect("Error");
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
    let (addr, _state) = match spawn_server().await {
        Ok(result) => result,
        Err(err) if err.kind() == std::io::ErrorKind::PermissionDenied => {
            eprintln!("Skipping test: cannot bind TCP listener ({})", err);
            return;
        }
        Err(err) => panic!("Failed to spawn server: {}", err),
    };
    println!("Server spawned");

    // 1. Connect
    let mut east = connect_and_auth(addr).await;
    let mut south = connect_and_auth(addr).await;
    let mut west = connect_and_auth(addr).await;
    let mut north = connect_and_auth(addr).await;
    println!("Clients connected");

    // 2. Create Room
    let create = Envelope::create_room();
    east.send(tokio_tungstenite::tungstenite::Message::Text(
        create.to_json().unwrap(),
    ))
    .await
    .unwrap();

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
        client
            .send(tokio_tungstenite::tungstenite::Message::Text(
                join.to_json().unwrap(),
            ))
            .await
            .unwrap();
        // Consume RoomJoined
        loop {
            let msg = client.next().await.unwrap().unwrap();
            if let Envelope::RoomJoined(_) = Envelope::from_json(&msg.into_text().unwrap()).unwrap()
            {
                break;
            }
        }
    }
    println!("Everyone joined");

    // Server auto-rolls dice and auto-readies all players when all 4 join (as of b88caf6).
    // Wait for GameStarting event to confirm game has started.
    read_until_event(&mut east, |e| {
        matches!(e, Event::Public(PublicEvent::GameStarting))
    })
    .await;
    println!("Game started (auto-setup complete)");

    // Capture Hands
    let mut hands = [vec![], vec![], vec![], vec![]];

    // Read East hand
    if let Event::Private(PrivateEvent::TilesDealt { your_tiles }) =
        read_until_event(&mut east, |e| {
            matches!(e, Event::Private(PrivateEvent::TilesDealt { .. }))
        })
        .await
    {
        hands[0] = your_tiles;
    }
    // Read South hand
    if let Event::Private(PrivateEvent::TilesDealt { your_tiles }) =
        read_until_event(&mut south, |e| {
            matches!(e, Event::Private(PrivateEvent::TilesDealt { .. }))
        })
        .await
    {
        hands[1] = your_tiles;
    }
    // Read West hand
    if let Event::Private(PrivateEvent::TilesDealt { your_tiles }) =
        read_until_event(&mut west, |e| {
            matches!(e, Event::Private(PrivateEvent::TilesDealt { .. }))
        })
        .await
    {
        hands[2] = your_tiles;
    }
    // Read North hand
    if let Event::Private(PrivateEvent::TilesDealt { your_tiles }) =
        read_until_event(&mut north, |e| {
            matches!(e, Event::Private(PrivateEvent::TilesDealt { .. }))
        })
        .await
    {
        hands[3] = your_tiles;
    }
    println!("Hands captured");

    let mut tracked_hands = hands.clone();

    // Wait for Charleston Start
    read_until_event(&mut east, |e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::FirstRight
            })
        )
    })
    .await;
    println!("Charleston Started");

    // 7. Pass Tiles (First Right)
    let pass_east = pick_pass_tiles_from_hand(
        &tracked_hands[0],
        3,
        Seat::East,
        CharlestonStage::FirstRight,
    );
    send_cmd(
        &mut east,
        GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: pass_east.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[0], &pass_east);

    let pass_south = pick_pass_tiles_from_hand(
        &tracked_hands[1],
        3,
        Seat::South,
        CharlestonStage::FirstRight,
    );
    send_cmd(
        &mut south,
        GameCommand::CommitCharlestonPass {
            player: Seat::South,
            from_hand: pass_south.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[1], &pass_south);

    let pass_west = pick_pass_tiles_from_hand(
        &tracked_hands[2],
        3,
        Seat::West,
        CharlestonStage::FirstRight,
    );
    send_cmd(
        &mut west,
        GameCommand::CommitCharlestonPass {
            player: Seat::West,
            from_hand: pass_west.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[2], &pass_west);

    let pass_north = pick_pass_tiles_from_hand(
        &tracked_hands[3],
        3,
        Seat::North,
        CharlestonStage::FirstRight,
    );
    send_cmd(
        &mut north,
        GameCommand::CommitCharlestonPass {
            player: Seat::North,
            from_hand: pass_north.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[3], &pass_north);
    println!("First Pass Sent");

    let first_across_incoming_east = read_incoming_tiles_staged(&mut east).await;
    assert_eq!(first_across_incoming_east.len(), 3);
    let first_across_incoming_south = read_incoming_tiles_staged(&mut south).await;
    assert_eq!(first_across_incoming_south.len(), 3);
    let first_across_incoming_west = read_incoming_tiles_staged(&mut west).await;
    assert_eq!(first_across_incoming_west.len(), 3);
    let first_across_incoming_north = read_incoming_tiles_staged(&mut north).await;
    assert_eq!(first_across_incoming_north.len(), 3);

    read_until_event(&mut east, |e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::FirstAcross
            })
        )
    })
    .await;
    println!("Moved to FirstAcross");
    tokio::time::sleep(Duration::from_millis(1100)).await;

    // 8. Pass Tiles (First Across)
    let pass_east_2 = pick_pass_tiles_from_hand(
        &tracked_hands[0],
        3,
        Seat::East,
        CharlestonStage::FirstAcross,
    );
    send_cmd(
        &mut east,
        GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: pass_east_2.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[0], &pass_east_2);
    tracked_hands[0].extend(first_across_incoming_east.iter().copied());

    let pass_south_2 = pick_pass_tiles_from_hand(
        &tracked_hands[1],
        3,
        Seat::South,
        CharlestonStage::FirstAcross,
    );
    send_cmd(
        &mut south,
        GameCommand::CommitCharlestonPass {
            player: Seat::South,
            from_hand: pass_south_2.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[1], &pass_south_2);
    tracked_hands[1].extend(first_across_incoming_south.iter().copied());

    let pass_west_2 = pick_pass_tiles_from_hand(
        &tracked_hands[2],
        3,
        Seat::West,
        CharlestonStage::FirstAcross,
    );
    send_cmd(
        &mut west,
        GameCommand::CommitCharlestonPass {
            player: Seat::West,
            from_hand: pass_west_2.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[2], &pass_west_2);
    tracked_hands[2].extend(first_across_incoming_west.iter().copied());

    let pass_north_2 = pick_pass_tiles_from_hand(
        &tracked_hands[3],
        3,
        Seat::North,
        CharlestonStage::FirstAcross,
    );
    send_cmd(
        &mut north,
        GameCommand::CommitCharlestonPass {
            player: Seat::North,
            from_hand: pass_north_2.clone(),
            forward_incoming_count: 0,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[3], &pass_north_2);
    tracked_hands[3].extend(first_across_incoming_north.iter().copied());

    let first_left_incoming_east = read_incoming_tiles_staged(&mut east).await;
    assert_eq!(
        first_left_incoming_east.len(),
        3,
        "East should receive 3 staged incoming tiles before FirstLeft"
    );

    read_until_event(&mut east, |e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::FirstLeft
            })
        )
    })
    .await;
    println!("Moved to FirstLeft");
    tokio::time::sleep(Duration::from_millis(1100)).await;

    let first_left_incoming_south = read_incoming_tiles_staged(&mut south).await;
    assert_eq!(
        first_left_incoming_south.len(),
        3,
        "South should receive 3 staged incoming tiles before FirstLeft"
    );

    let first_left_incoming_west = read_incoming_tiles_staged(&mut west).await;
    assert_eq!(
        first_left_incoming_west.len(),
        3,
        "West should receive 3 staged incoming tiles before FirstLeft"
    );

    let first_left_incoming_north = read_incoming_tiles_staged(&mut north).await;
    assert_eq!(
        first_left_incoming_north.len(),
        3,
        "North should receive 3 staged incoming tiles before FirstLeft"
    );

    // 9. Pass Tiles (First Left)
    // Use mixed passes (1 from hand + 2 forwarded incoming) so we avoid IOU early-stop
    // and continue into VotingToContinue/CourtesyAcross.
    let pass_east_3 =
        pick_pass_tiles_from_hand(&tracked_hands[0], 1, Seat::East, CharlestonStage::FirstLeft);
    send_cmd(
        &mut east,
        GameCommand::CommitCharlestonPass {
            player: Seat::East,
            from_hand: pass_east_3.clone(),
            forward_incoming_count: 2,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[0], &pass_east_3);
    tracked_hands[0].extend(first_left_incoming_east.iter().skip(2).copied());

    let pass_south_3 = pick_pass_tiles_from_hand(
        &tracked_hands[1],
        1,
        Seat::South,
        CharlestonStage::FirstLeft,
    );
    send_cmd(
        &mut south,
        GameCommand::CommitCharlestonPass {
            player: Seat::South,
            from_hand: pass_south_3.clone(),
            forward_incoming_count: 2,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[1], &pass_south_3);
    tracked_hands[1].extend(first_left_incoming_south.iter().skip(2).copied());

    let pass_west_3 =
        pick_pass_tiles_from_hand(&tracked_hands[2], 1, Seat::West, CharlestonStage::FirstLeft);
    send_cmd(
        &mut west,
        GameCommand::CommitCharlestonPass {
            player: Seat::West,
            from_hand: pass_west_3.clone(),
            forward_incoming_count: 2,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[2], &pass_west_3);
    tracked_hands[2].extend(first_left_incoming_west.iter().skip(2).copied());

    let pass_north_3 = pick_pass_tiles_from_hand(
        &tracked_hands[3],
        1,
        Seat::North,
        CharlestonStage::FirstLeft,
    );
    send_cmd(
        &mut north,
        GameCommand::CommitCharlestonPass {
            player: Seat::North,
            from_hand: pass_north_3.clone(),
            forward_incoming_count: 2,
        },
    )
    .await;
    remove_tiles(&mut tracked_hands[3], &pass_north_3);
    tracked_hands[3].extend(first_left_incoming_north.iter().skip(2).copied());

    read_until_event(&mut east, |e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::VotingToContinue
            })
        )
    })
    .await;

    // 10. Voting
    println!("Voting");
    send_cmd(
        &mut east,
        GameCommand::VoteCharleston {
            player: Seat::East,
            vote: CharlestonVote::Stop,
        },
    )
    .await;
    send_cmd(
        &mut south,
        GameCommand::VoteCharleston {
            player: Seat::South,
            vote: CharlestonVote::Stop,
        },
    )
    .await;
    send_cmd(
        &mut west,
        GameCommand::VoteCharleston {
            player: Seat::West,
            vote: CharlestonVote::Stop,
        },
    )
    .await;
    send_cmd(
        &mut north,
        GameCommand::VoteCharleston {
            player: Seat::North,
            vote: CharlestonVote::Stop,
        },
    )
    .await;

    read_until_event(&mut east, |e| {
        matches!(
            e,
            Event::Public(PublicEvent::CharlestonPhaseChanged {
                stage: CharlestonStage::CourtesyAcross
            })
        )
    })
    .await;
    println!("Moved to CourtesyAcross");
    tokio::time::sleep(Duration::from_millis(1100)).await;
    // 11. Courtesy Pass - Step 1: Propose
    send_cmd(
        &mut east,
        GameCommand::ProposeCourtesyPass {
            player: Seat::East,
            tile_count: 0,
        },
    )
    .await;
    send_cmd(
        &mut south,
        GameCommand::ProposeCourtesyPass {
            player: Seat::South,
            tile_count: 0,
        },
    )
    .await;
    send_cmd(
        &mut west,
        GameCommand::ProposeCourtesyPass {
            player: Seat::West,
            tile_count: 0,
        },
    )
    .await;
    send_cmd(
        &mut north,
        GameCommand::ProposeCourtesyPass {
            player: Seat::North,
            tile_count: 0,
        },
    )
    .await;

    // Wait for both pairs to be ready (2 CourtesyPairReady events expected)
    tokio::time::sleep(Duration::from_millis(1500)).await;

    // 11. Courtesy Pass - Step 2: Accept
    send_cmd(
        &mut east,
        GameCommand::AcceptCourtesyPass {
            player: Seat::East,
            tiles: vec![],
        },
    )
    .await;
    send_cmd(
        &mut south,
        GameCommand::AcceptCourtesyPass {
            player: Seat::South,
            tiles: vec![],
        },
    )
    .await;
    send_cmd(
        &mut west,
        GameCommand::AcceptCourtesyPass {
            player: Seat::West,
            tiles: vec![],
        },
    )
    .await;
    send_cmd(
        &mut north,
        GameCommand::AcceptCourtesyPass {
            player: Seat::North,
            tiles: vec![],
        },
    )
    .await;

    // 12. Playing Phase
    let _event = read_until_event(&mut east, |e| {
        matches!(e, Event::Public(PublicEvent::TurnChanged { .. }))
            || matches!(e, Event::Public(PublicEvent::CharlestonComplete))
    })
    .await;
    println!("Moved to Playing");
    // Actually CharlestonComplete comes first, then TurnChanged?
    // Logic in table.rs: emits CharlestonComplete, then transition_phase(CharlestonComplete) which sets phase to Playing.
    // Then East needs to discard. Wait, East STARTS with 14 tiles (dealt extra). So East starts in Discarding phase.
    // The event emitted is... actually, table.rs doesn't emit TurnChanged when entering Playing from Charleston.
    // It emits Event::Public(PublicEvent::CharlestonComplete).
    // Clients are expected to know that after CharlestonComplete, it is East's turn to discard.
    // Let's check `table.rs` apply_accept_courtesy_pass:
    // It emits CharlestonComplete.
    // It does NOT explicitly emit TurnChanged.
    // The phase transition happens silently?
    // transition_phase -> GamePhase::Playing(TurnStage::Discarding { player: Seat::East })
    // The clients should treat CharlestonComplete as "Game Start / East Turn".

    // East discards from tracked current hand to avoid stale pre-Charleston assumptions.
    let discard_tile = match tracked_hands[0].iter().copied().find(|t| !t.is_joker()) {
        Some(tile) => tile,
        None => {
            eprintln!("Skipping test: no non-joker tile available to discard");
            return;
        }
    };
    send_cmd(
        &mut east,
        GameCommand::DiscardTile {
            player: Seat::East,
            tile: discard_tile,
        },
    )
    .await;

    // Should see TileDiscarded and CallWindowOpened
    read_until_event(&mut east, |e| {
        matches!(e, Event::Public(PublicEvent::CallWindowOpened { .. }))
    })
    .await;

    // 13. Everyone Passes
    send_cmd(
        &mut south,
        GameCommand::Pass {
            player: Seat::South,
        },
    )
    .await;
    send_cmd(&mut west, GameCommand::Pass { player: Seat::West }).await;
    send_cmd(
        &mut north,
        GameCommand::Pass {
            player: Seat::North,
        },
    )
    .await;

    // 14. Turn Changes to South
    let turn_event = read_until_event(&mut east, |e| {
        matches!(e, Event::Public(PublicEvent::TurnChanged { .. }))
    })
    .await;
    if let Event::Public(PublicEvent::TurnChanged { player, stage }) = turn_event {
        assert_eq!(player, Seat::South);
        assert!(matches!(stage, TurnStage::Drawing { .. }));
    } else {
        panic!("Expected TurnChanged");
    }

    // Success!
}
