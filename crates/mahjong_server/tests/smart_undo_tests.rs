#[cfg(test)]
mod tests {
    use mahjong_core::{
        history::MoveAction,
        player::Seat,
        table::Table,
        tile::tiles,
    };
    use mahjong_server::network::history::RoomHistory;
    use mahjong_server::network::room::Room;

    #[test]
    fn test_find_last_decision_point_logic() {
        let (mut room, _) = Room::new();
        
        // Mock a table so record_history_entry works
        room.table = Some(Table::new("test".to_string(), 1));

        // 0: DrawTile (Decision)
        // Simulate: Player draws a tile. They must now discard.
        room.record_history_entry(
            Seat::East, 
            MoveAction::DrawTile { tile: tiles::DOT_1, visible: true }, 
            "Draw".into()
        );
        
        // Verify decision point flag
        assert!(room.history[0].is_decision_point);
        
        // If we are at move 1 (after Draw), undoing should do nothing/return 0?
        // find_last_decision_point skips current tip if it is a decision point.
        // So it looks for one BEFORE index 0. Returns None?
        // My logic: "If history_len > 0 && self.history[0].is_decision_point { return Some(0); }"
        // So if only 1 entry and it is a decision point, return 0 (stay there).
        assert_eq!(room.find_last_decision_point(), Some(0));

        // 1: DiscardTile (Not Decision)
        // Simulate: Player discards. Turn ends.
        room.record_history_entry(
            Seat::East, 
            MoveAction::DiscardTile { tile: tiles::DOT_1 }, 
            "Discard".into()
        );
        assert!(!room.history[1].is_decision_point);

        // Current state: After Discard.
        // Undo should return to DrawTile (Move 0).
        assert_eq!(room.find_last_decision_point(), Some(0));

        // 2: CallWindowOpened (Decision)
        // Simulate: Call window opens for others.
        room.record_history_entry(
            Seat::East, 
            MoveAction::CallWindowOpened { tile: tiles::DOT_1 }, 
            "Call Window".into()
        );
        assert!(room.history[2].is_decision_point);

        // Current state: Call Window Open.
        // Undo should return to the *previous* decision point (DrawTile / Move 0).
        // Why? Because we want to undo the action that led to this state (the Discard).
        // If we revert to CallWindowOpened (Move 2), we are just refreshing the current state.
        assert_eq!(room.find_last_decision_point(), Some(0));

        // 3: CallWindowClosed (Not Decision)
        // Simulate: Everyone passed.
        room.record_history_entry(
            Seat::East, 
            MoveAction::CallWindowClosed, 
            "Call Window Closed".into()
        );
        assert!(!room.history[3].is_decision_point);

        // Current state: Call Window Closed.
        // Undo should return to CallWindowOpened (Move 2)?
        // Or should it skip CallWindowOpened if that was "transient"?
        // CallWindowOpened requires input. If I undo "Closed", I go back to "Opened" so I can Call.
        // So yes, return 2.
        assert_eq!(room.find_last_decision_point(), Some(2));
    }
}
