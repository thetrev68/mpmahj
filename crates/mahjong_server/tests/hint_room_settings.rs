use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_hints_are_enabled_by_default() {
    let (room, _rx) = Room::new();
    assert!(room.analysis.is_hint_enabled(Seat::East));
}

#[tokio::test]
async fn test_can_disable_hints_per_player() {
    let (mut room, _rx) = Room::new();
    room.analysis.set_hint_enabled(Seat::East, false);
    assert!(!room.analysis.is_hint_enabled(Seat::East));
}

#[tokio::test]
async fn test_hint_enabled_state_is_tracked_per_seat() {
    let (mut room, _rx) = Room::new();

    room.analysis.set_hint_enabled(Seat::East, false);
    room.analysis.set_hint_enabled(Seat::South, true);
    room.analysis.set_hint_enabled(Seat::West, false);

    assert!(!room.analysis.is_hint_enabled(Seat::East));
    assert!(room.analysis.is_hint_enabled(Seat::South));
    assert!(!room.analysis.is_hint_enabled(Seat::West));
    assert!(room.analysis.is_hint_enabled(Seat::North));
}

#[tokio::test]
async fn test_hint_enabled_state_can_be_re_enabled() {
    let (mut room, _rx) = Room::new();

    room.analysis.set_hint_enabled(Seat::East, false);
    assert!(!room.analysis.is_hint_enabled(Seat::East));

    room.analysis.set_hint_enabled(Seat::East, true);
    assert!(room.analysis.is_hint_enabled(Seat::East));
}
