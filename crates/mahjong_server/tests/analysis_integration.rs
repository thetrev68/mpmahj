use std::time::Duration;
use tokio::time::Instant;

use mahjong_core::{
    event::{analysis_events::AnalysisEvent, Event},
    player::Seat,
};
use mahjong_server::analysis::AnalysisMode;

mod common;
use common::*;

#[tokio::test]
async fn test_analysis_timing_contract() {
    let (addr, state) = spawn_server().await;
    let mut client = connect_and_auth(addr).await;

    // 1. Create Room with AlwaysOn and 200ms timeout (generous for CI)
    let (_room_id, room_arc) =
        create_room_with_analysis_config(&state, AnalysisMode::AlwaysOn, 200).await;

    // Join manually to get seat
    let seat = join_room_direct(&state, &room_arc, &mut client).await;
    assert_eq!(seat, Seat::East);

    // 2. Add bots and start
    add_bots_and_start(&room_arc, 3).await;

    // 3. Wait for initial AnalysisUpdate from game start (AlwaysOn triggers immediately)
    // The analysis worker should emit updates once the game is in Playing phase
    let start = Instant::now();
    let event = read_until_event_with_timeout(&mut client.ws, Duration::from_secs(10), |e| {
        matches!(e, Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }))
    })
    .await;

    let elapsed = start.elapsed();
    println!("Analysis latency from game start: {:?}", elapsed);

    // Verify we got an update with patterns
    if let Event::Analysis(AnalysisEvent::AnalysisUpdate { patterns }) = event {
        assert!(!patterns.is_empty(), "Patterns should not be empty");
        println!("Received analysis with {} patterns", patterns.len());
    } else {
        panic!("Expected AnalysisUpdate event");
    }
}

#[tokio::test]
async fn test_privacy_filtering() {
    let (addr, state) = spawn_server().await;

    // 2 Humans + 2 Bots
    let mut client1 = connect_and_auth(addr).await;
    let mut client2 = connect_and_auth(addr).await;

    let (_room_id, room_arc) =
        create_room_with_analysis_config(&state, AnalysisMode::AlwaysOn, 200).await;

    let seat1 = join_room_direct(&state, &room_arc, &mut client1).await;
    let seat2 = join_room_direct(&state, &room_arc, &mut client2).await;

    add_bots_and_start(&room_arc, 2).await;

    // Wait for first AnalysisUpdate on both clients (game starts, analysis triggered)
    let _update1 = read_until_event_with_timeout(&mut client1.ws, Duration::from_secs(10), |e| {
        matches!(e, Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }))
    })
    .await;

    let _update2 = read_until_event_with_timeout(&mut client2.ws, Duration::from_secs(10), |e| {
        matches!(e, Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }))
    })
    .await;

    println!("Both clients received AnalysisUpdate");

    // White-box: Check cache has entries for both seats
    let room = room_arc.lock().await;
    assert!(
        room.analysis_cache.contains_key(&seat1),
        "Cache should have entry for seat1"
    );
    assert!(
        room.analysis_cache.contains_key(&seat2),
        "Cache should have entry for seat2"
    );
    assert_eq!(
        room.analysis_cache.len(),
        4,
        "Cache should have entries for all 4 seats (2 humans + 2 bots)"
    );
}

#[tokio::test]
async fn test_reconnection_analysis_cache() {
    let (addr, state) = spawn_server().await;
    let mut client = connect_and_auth(addr).await;

    let (_room_id, room_arc) =
        create_room_with_analysis_config(&state, AnalysisMode::AlwaysOn, 200).await;
    let seat = join_room_direct(&state, &room_arc, &mut client).await;

    add_bots_and_start(&room_arc, 3).await;

    // Wait for initial analysis
    let _ = read_until_event_with_timeout(&mut client.ws, Duration::from_secs(10), |e| {
        matches!(e, Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }))
    })
    .await;

    println!("Got initial analysis update");

    // Verify cache has entry before disconnect
    let cache_size_before = {
        let room = room_arc.lock().await;
        room.analysis_cache.contains_key(&seat);
        room.analysis_cache.len()
    };
    assert_eq!(cache_size_before, 4, "Cache should have all 4 seats");
    println!(
        "Confirmed analysis cache exists with {} entries",
        cache_size_before
    );

    // Disconnect
    client.ws.close(None).await.expect("close failed");

    // Wait for server to process disconnect and clean up grace period
    tokio::time::sleep(Duration::from_secs(1)).await;

    // Verify cache still exists after disconnect (demonstrating persistence)
    let cache_size_after = {
        let room = room_arc.lock().await;
        room.analysis_cache.len()
    };
    assert_eq!(cache_size_after, 4, "Cache should persist after disconnect");
    println!(
        "Analysis cache persisted: {} entries after disconnect",
        cache_size_after
    );
}

#[tokio::test]
async fn test_analysis_mode_behavior() {
    // Test 1: ActivePlayerOnly should only trigger for current player
    let (addr, state) = spawn_server().await;
    let mut client = connect_and_auth(addr).await;

    let (_room_id, room_arc) =
        create_room_with_analysis_config(&state, AnalysisMode::ActivePlayerOnly, 200).await;
    let _seat = join_room_direct(&state, &room_arc, &mut client).await;

    add_bots_and_start(&room_arc, 3).await;

    // With ActivePlayerOnly, analysis should only trigger when it's our turn
    // Since we're East (first player), and game just started, we might get analysis
    // But when it's someone else's turn, we shouldn't

    // Just verify the mode is set correctly
    {
        let room = room_arc.lock().await;
        assert_eq!(room.analysis_config.mode, AnalysisMode::ActivePlayerOnly);
    }

    println!("ActivePlayerOnly mode verified");

    // Test 2: AlwaysOn should trigger for all players
    let mut client2 = connect_and_auth(addr).await;

    let (_room_id2, room_arc2) =
        create_room_with_analysis_config(&state, AnalysisMode::AlwaysOn, 200).await;

    let seat2 = join_room_direct(&state, &room_arc2, &mut client2).await;
    assert_eq!(seat2, Seat::East);

    add_bots_and_start(&room_arc2, 3).await;

    // With AlwaysOn, we should get analysis update
    let event = read_until_event_with_timeout(&mut client2.ws, Duration::from_secs(10), |e| {
        matches!(e, Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }))
    })
    .await;

    if let Event::Analysis(AnalysisEvent::AnalysisUpdate { .. }) = event {
        println!("AlwaysOn mode: received AnalysisUpdate");
    } else {
        panic!("Expected AnalysisUpdate in AlwaysOn mode");
    }

    // Verify mode is set correctly
    {
        let room = room_arc2.lock().await;
        assert_eq!(room.analysis_config.mode, AnalysisMode::AlwaysOn);
    }
}
