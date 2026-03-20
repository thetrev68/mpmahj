mod common;

use common::{
    add_bots_and_start, connect_and_auth, drain_messages, join_room_direct,
    read_until_event_with_timeout, send_command, spawn_server,
};
use mahjong_core::{
    command::GameCommand,
    event::{analysis_events::AnalysisEvent, Event},
};
use mahjong_server::analysis::AnalysisMode;
use tokio::time::Duration;

#[tokio::test]
async fn request_hint_returns_empty_update_when_hints_are_disabled() {
    let (addr, state) = spawn_server().await;
    let (_room_id, room_arc) =
        common::create_room_with_analysis_config(&state, AnalysisMode::OnDemand, 100).await;
    let mut client = connect_and_auth(addr).await;
    let seat = join_room_direct(&state, &room_arc, &mut client).await;

    add_bots_and_start(&room_arc, 3).await;
    drain_messages(&mut client.ws, Duration::from_millis(500)).await;

    send_command(
        &mut client.ws,
        GameCommand::SetHintEnabled {
            player: seat,
            enabled: false,
        },
    )
    .await;

    send_command(&mut client.ws, GameCommand::RequestHint { player: seat }).await;

    let event = read_until_event_with_timeout(&mut client.ws, Duration::from_secs(2), |event| {
        matches!(event, Event::Analysis(AnalysisEvent::HintUpdate { .. }))
    })
    .await;

    let Event::Analysis(AnalysisEvent::HintUpdate { hint }) = event else {
        panic!("expected hint update event");
    };

    assert!(hint.is_empty());
}
