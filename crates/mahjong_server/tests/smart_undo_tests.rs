#[cfg(test)]
mod tests {
    use mahjong_core::{
        command::GameCommand,
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

    #[test]
    fn test_empty_history_no_decision_point() {
        let (room, _) = Room::new();
        // Empty history should return None
        assert_eq!(room.find_last_decision_point(), None);
    }

    #[test]
    fn test_multiple_non_decision_points_then_decision() {
        let (mut room, _) = Room::new();
        room.table = Some(Table::new("test".to_string(), 1));

        // 0: DrawTile (Decision)
        room.record_history_entry(
            Seat::East,
            MoveAction::DrawTile { tile: tiles::DOT_1, visible: true },
            "Draw".into()
        );

        // 1-3: Multiple non-decision actions
        room.record_history_entry(
            Seat::South,
            MoveAction::CallWindowClosed,
            "Pass".into()
        );
        room.record_history_entry(
            Seat::West,
            MoveAction::CallWindowClosed,
            "Pass".into()
        );
        room.record_history_entry(
            Seat::North,
            MoveAction::CallWindowClosed,
            "Pass".into()
        );

        // All non-decision actions should lead back to DrawTile (move 0)
        assert_eq!(room.find_last_decision_point(), Some(0));
    }

    #[test]
    fn test_smart_undo_command_validation() {
        let (mut room, _) = Room::new();
        
        // Mock a table for history
        room.table = Some(Table::new("test".to_string(), 1));
        
        // Add some history
        room.record_history_entry(
            Seat::East,
            MoveAction::DrawTile { tile: tiles::DOT_1, visible: true },
            "Draw".into()
        );
        room.record_history_entry(
            Seat::East,
            MoveAction::DiscardTile { tile: tiles::DOT_1 },
            "Discard".into()
        );

        // SmartUndo command should be creatable and have correct player
        let cmd = GameCommand::SmartUndo { player: Seat::East };
        assert_eq!(cmd.player(), Seat::East);
    }

    #[test]
    fn test_vote_undo_command_validation() {
        // VoteUndo commands with different approval values
        let approve_cmd = GameCommand::VoteUndo {
            player: Seat::West,
            approve: true,
        };
        assert_eq!(approve_cmd.player(), Seat::West);

        let reject_cmd = GameCommand::VoteUndo {
            player: Seat::North,
            approve: false,
        };
        assert_eq!(reject_cmd.player(), Seat::North);
    }

    #[test]
    fn test_decision_point_tagging_for_various_actions() {
        let (mut room, _) = Room::new();
        room.table = Some(Table::new("test".to_string(), 1));

        // Test that decision points are tagged correctly
        // Decision points: DrawTile, MeldCalled, CallWindowOpened, PassTiles, CharlestonCompleted, ResumeGame
        let decision_actions = vec![
            MoveAction::DrawTile { tile: tiles::DOT_1, visible: true },
            MoveAction::MeldCalled {
                tile: tiles::DOT_1,
                meld_type: mahjong_core::meld::MeldType::Pung,
                contested: false,
            },
            MoveAction::CallWindowOpened { tile: tiles::DOT_1 },
            MoveAction::PassTiles {
                direction: mahjong_core::flow::charleston::PassDirection::Right,
                count: 3,
            },
            MoveAction::CharlestonCompleted,
            MoveAction::ResumeGame,
        ];

        let num_decision_actions = decision_actions.len();
        for (i, action) in decision_actions.into_iter().enumerate() {
            room.record_history_entry(Seat::East, action, format!("Action {}", i));
            assert!(
                room.history[i].is_decision_point,
                "Action at index {} should be marked as decision point",
                i
            );
        }

        // Test that non-decision points are not tagged
        // Non-decision points: DiscardTile, CallWindowClosed, and meta-actions like PauseGame/Forfeit
        let non_decision_actions = vec![
            MoveAction::DiscardTile { tile: tiles::DOT_1 },
            MoveAction::CallWindowClosed,
            MoveAction::PauseGame,
            MoveAction::Forfeit,
        ];

        let offset = num_decision_actions;
        for (i, action) in non_decision_actions.into_iter().enumerate() {
            room.record_history_entry(Seat::East, action, format!("Action {}", i + offset));
            assert!(
                !room.history[i + offset].is_decision_point,
                "Action at index {} should NOT be marked as decision point",
                i + offset
            );
        }
    }
}
