use mahjong_core::hint::HintVerbosity;
use mahjong_core::player::Seat;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_default_hint_verbosity() {
    let (room, _rx) = Room::new();
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::East),
        HintVerbosity::Intermediate
    );
}

#[tokio::test]
async fn test_set_hint_verbosity_per_player() {
    let (mut room, _rx) = Room::new();
    room.analysis
        .set_hint_verbosity(Seat::East, HintVerbosity::Beginner);
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::East),
        HintVerbosity::Beginner
    );
}

#[tokio::test]
async fn test_different_hint_verbosity_per_seat() {
    let (mut room, _rx) = Room::new();

    room.analysis
        .set_hint_verbosity(Seat::East, HintVerbosity::Beginner);
    room.analysis
        .set_hint_verbosity(Seat::South, HintVerbosity::Expert);
    room.analysis
        .set_hint_verbosity(Seat::West, HintVerbosity::Disabled);

    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::East),
        HintVerbosity::Beginner
    );
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::South),
        HintVerbosity::Expert
    );
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::West),
        HintVerbosity::Disabled
    );
    // North should still be default
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::North),
        HintVerbosity::Intermediate
    );
}

#[tokio::test]
async fn test_update_hint_verbosity() {
    let (mut room, _rx) = Room::new();

    room.analysis
        .set_hint_verbosity(Seat::East, HintVerbosity::Beginner);
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::East),
        HintVerbosity::Beginner
    );

    room.analysis
        .set_hint_verbosity(Seat::East, HintVerbosity::Expert);
    assert_eq!(
        room.analysis.get_hint_verbosity(Seat::East),
        HintVerbosity::Expert
    );
}
