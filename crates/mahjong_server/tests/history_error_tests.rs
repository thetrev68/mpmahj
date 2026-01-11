use mahjong_core::history::{HistoryMode, MoveAction};
use mahjong_core::player::Seat;
use mahjong_core::table::Table;
use mahjong_server::network::history::RoomHistory;
use mahjong_server::network::room::Room;

#[tokio::test]
async fn test_history_in_multiplayer_error() {
    let (room, _rx) = Room::new();
    // Default room has 0 bots, so it's not practice mode.

    // Attempt request history
    let result = room.handle_request_history().await;
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), "History is only available in Practice Mode");
}

#[tokio::test]
async fn test_invalid_move_number_error() {
    let (mut room, _rx) = Room::new();
    // Set practice mode by adding 3 bots
    room.enable_bot(Seat::East, "bot1".to_string());
    room.enable_bot(Seat::South, "bot2".to_string());
    room.enable_bot(Seat::West, "bot3".to_string());

    // Attempt jump to invalid move
    let result = room.handle_jump_to_move(10).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("Move 10 does not exist"), "Error was: {}", err);
}

#[tokio::test]
async fn test_resume_without_viewing_error() {
    let (mut room, _rx) = Room::new();
    room.enable_bot(Seat::East, "bot1".to_string());
    room.enable_bot(Seat::South, "bot2".to_string());
    room.enable_bot(Seat::West, "bot3".to_string());

    // Initialize table so we can record history
    room.table = Some(Table::new("test_game".to_string(), 12345));

    // Mock a history entry
    // We can use record_history_entry directly
    room.record_history_entry(Seat::East, MoveAction::CallWindowClosed, "Test".to_string());

    // Ensure we have 1 move
    assert_eq!(room.history.len(), 1);

    // We are currently in HistoryMode::None

    // Attempt resume from move 0
    let result = room.handle_resume_from_history(0).await;
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), "Not viewing history");
}
