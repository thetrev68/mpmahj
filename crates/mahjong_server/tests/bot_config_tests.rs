//! Tests for bot configuration API (CreateRoomPayload fields).
//!
//! Tests cover:
//! - Payload deserialization with defaults
//! - Bot difficulty configuration
//! - Auto-fill bots functionality
//! - Edge cases (idempotence, full rooms, etc.)

use mahjong_ai::Difficulty;
use mahjong_core::table::HouseRules;
use mahjong_server::network::messages::CreateRoomPayload;

#[cfg(test)]
mod payload_deserialization {
    use super::*;

    #[test]
    fn test_createroompayload_defaults() {
        // Test that missing fields use defaults
        let json = r#"{}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Easy));
        assert!(!payload.fill_with_bots);
        assert_eq!(payload.card_year, 2025);
        assert_eq!(payload.room_name, "My American Mahjong Game");
    }

    #[test]
    fn test_createroompayload_with_difficulty_easy() {
        let json = r#"{"bot_difficulty": "Easy"}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Easy));
        assert!(!payload.fill_with_bots);
    }

    #[test]
    fn test_createroompayload_with_difficulty_medium() {
        let json = r#"{"bot_difficulty": "Medium"}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Medium));
    }

    #[test]
    fn test_createroompayload_with_difficulty_hard() {
        let json = r#"{"bot_difficulty": "Hard"}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Hard));
    }

    #[test]
    fn test_createroompayload_with_difficulty_expert() {
        let json = r#"{"bot_difficulty": "Expert"}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Expert));
    }

    #[test]
    fn test_createroompayload_with_fill_bots_true() {
        let json = r#"{"fill_with_bots": true}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert!(payload.fill_with_bots);
        assert_eq!(payload.bot_difficulty, Some(Difficulty::Easy));
    }

    #[test]
    fn test_createroompayload_with_fill_bots_false() {
        let json = r#"{"fill_with_bots": false}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert!(!payload.fill_with_bots);
    }

    #[test]
    fn test_createroompayload_all_fields() {
        let json = r#"{"room_name": "Friday Night Mahjong", "bot_difficulty": "Hard", "fill_with_bots": true, "card_year": 2020}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, Some(Difficulty::Hard));
        assert!(payload.fill_with_bots);
        assert_eq!(payload.card_year, 2020);
        assert_eq!(payload.room_name, "Friday Night Mahjong");
    }

    #[test]
    fn test_createroompayload_invalid_difficulty() {
        // Invalid difficulty should fail deserialization
        let json = r#"{"bot_difficulty": "SuperEasy"}"#;
        let result: Result<CreateRoomPayload, _> = serde_json::from_str(json);

        assert!(result.is_err());
    }

    #[test]
    fn test_createroompayload_null_difficulty() {
        // Null difficulty should be treated as None
        let json = r#"{"bot_difficulty": null}"#;
        let payload: CreateRoomPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.bot_difficulty, None);
    }
}

#[cfg(test)]
mod room_api_tests {
    use super::*;
    use mahjong_server::network::room::Room;
    use mahjong_server::network::room_store::RoomStore;

    #[tokio::test]
    async fn test_room_creation_with_hard_difficulty() {
        let store = RoomStore::new();
        let rules = HouseRules::default();
        let (_room_id, room_arc) = store.create_room_with_rules(rules);

        let mut room = room_arc.lock().await;
        room.configure_bot_difficulty(Difficulty::Hard);

        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Hard);
    }

    #[tokio::test]
    async fn test_room_creation_with_medium_difficulty() {
        let store = RoomStore::new();
        let rules = HouseRules::default();
        let (_room_id, room_arc) = store.create_room_with_rules(rules);

        let mut room = room_arc.lock().await;
        room.configure_bot_difficulty(Difficulty::Medium);

        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Medium);
    }

    #[tokio::test]
    async fn test_room_creation_with_defaults() {
        let store = RoomStore::new();
        let (_room_id, room_arc) = store.create_room();

        let room = room_arc.lock().await;

        // Should use default difficulty (Easy)
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Easy);
    }

    #[tokio::test]
    async fn test_fill_with_bots_empty_room() {
        let (mut room, _rx) = Room::new();

        // Room starts empty (no sessions)
        assert_eq!(room.player_count(), 0);

        // Fill with bots
        room.fill_empty_seats_with_bots();

        // Room should still show 0 human players (bots don't add sessions)
        // But internally bot_seats should be filled (private field, can't test directly)
        assert_eq!(room.player_count(), 0);
    }

    #[tokio::test]
    async fn test_fill_with_bots_idempotent() {
        let (mut room, _rx) = Room::new();

        // Fill with bots twice
        room.fill_empty_seats_with_bots();
        let first_count = room.player_count();

        room.fill_empty_seats_with_bots();
        let second_count = room.player_count();

        // Player count should remain the same (idempotent)
        assert_eq!(first_count, second_count);
    }

    #[tokio::test]
    async fn test_bot_difficulty_persists_across_operations() {
        let (mut room, _rx) = Room::new();

        // Configure bot difficulty
        room.configure_bot_difficulty(Difficulty::Expert);
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Expert);

        // Fill with bots
        room.fill_empty_seats_with_bots();

        // Difficulty should still be Expert
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Expert);
    }

    #[tokio::test]
    async fn test_create_with_fill_bots_and_hard_difficulty() {
        let store = RoomStore::new();
        let (_room_id, room_arc) = store.create_room();

        let mut room = room_arc.lock().await;
        room.configure_bot_difficulty(Difficulty::Hard);
        room.fill_empty_seats_with_bots();

        // Difficulty should be Hard
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Hard);
    }

    #[tokio::test]
    async fn test_create_without_fill_bots() {
        let store = RoomStore::new();
        let (_room_id, room_arc) = store.create_room();

        let mut room = room_arc.lock().await;
        room.configure_bot_difficulty(Difficulty::Hard);

        // Difficulty should be Hard
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Hard);

        // No bots added (didn't call fill_empty_seats_with_bots)
        assert_eq!(room.player_count(), 0);
    }

    #[tokio::test]
    async fn test_bot_difficulty_all_levels() {
        let (mut room, _rx) = Room::new();

        // Test Easy
        room.configure_bot_difficulty(Difficulty::Easy);
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Easy);

        // Test Medium
        room.configure_bot_difficulty(Difficulty::Medium);
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Medium);

        // Test Hard
        room.configure_bot_difficulty(Difficulty::Hard);
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Hard);

        // Test Expert
        room.configure_bot_difficulty(Difficulty::Expert);
        assert_eq!(room.sessions.bot_difficulty(), Difficulty::Expert);
    }

    #[tokio::test]
    async fn test_room_store_creates_unique_rooms() {
        let store = RoomStore::new();

        let (room_id1, _) = store.create_room();
        let (room_id2, _) = store.create_room();

        // Each room should have a unique ID
        assert_ne!(room_id1, room_id2);
    }

    #[tokio::test]
    async fn test_room_store_list_rooms() {
        let store = RoomStore::new();

        // Initially no rooms
        let rooms_before = store.list_rooms();
        let initial_count = rooms_before.len();

        // Create two rooms
        let (room_id1, _) = store.create_room();
        let (room_id2, _) = store.create_room();

        // Should show 2 more rooms
        let rooms_after = store.list_rooms();
        assert_eq!(rooms_after.len(), initial_count + 2);

        // Both room IDs should be in the list
        assert!(rooms_after.contains(&room_id1));
        assert!(rooms_after.contains(&room_id2));
    }

    #[tokio::test]
    async fn test_game_start_populates_bots() {
        let store = RoomStore::new();
        let (_room_id, room_arc) = store.create_room();

        {
            let mut room = room_arc.lock().await;
            room.fill_empty_seats_with_bots(); // 4 bots

            // Start game manually (bypassing normal join flow which requires a session)
            room.start_game().await;

            // Verify table has players
            assert!(room.table.is_some());
            let table = room.table.as_ref().unwrap();
            assert_eq!(table.players.len(), 4, "Table should have 4 players (bots)");

            // Verify they are bots
            for player in table.players.values() {
                assert!(player.is_bot, "Player should be a bot");
            }
        }
    }
}
