//! Room storage and lifecycle helpers.
//!
//! ```no_run
//! use mahjong_server::network::room_store::RoomStore;
//! let store = RoomStore::new();
//! let (_room_id, _room) = store.create_room();
//! ```
use crate::analysis::worker::analysis_worker;
use crate::db::Database;
use crate::network::room::Room;
use dashmap::DashMap;
use mahjong_core::table::HouseRules;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Thread-safe room storage.
///
/// Manages all active rooms with concurrent access.
pub struct RoomStore {
    /// Map of room IDs to room state.
    rooms: DashMap<String, Arc<Mutex<Room>>>,
}

impl RoomStore {
    /// Create a new empty room store.
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    /// Create a new room with default rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room(&self) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new();
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());

        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Create a new room with database persistence and default rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db(&self, db: Database) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_db(db);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());

        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Create a new room with custom house rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_rules(&self, house_rules: HouseRules) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_rules(house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());

        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Create a room with database and custom rules.
    ///
    /// Returns the room_id and room reference.
    pub fn create_room_with_db_and_rules(
        &self,
        db: Database,
        house_rules: HouseRules,
    ) -> (String, Arc<Mutex<Room>>) {
        let (room, rx) = Room::new_with_db_and_rules(db, house_rules);
        let room_id = room.room_id.clone();
        let room_arc = Arc::new(Mutex::new(room));
        self.rooms.insert(room_id.clone(), room_arc.clone());

        let weak_room = Arc::downgrade(&room_arc);
        tokio::spawn(analysis_worker(weak_room, rx));

        (room_id, room_arc)
    }

    /// Get a room by ID.
    pub fn get_room(&self, room_id: &str) -> Option<Arc<Mutex<Room>>> {
        self.rooms.get(room_id).map(|entry| entry.clone())
    }

    /// Remove a room (e.g., when game ends or all players leave).
    pub fn remove_room(&self, room_id: &str) -> bool {
        self.rooms.remove(room_id).is_some()
    }

    /// Get the number of active rooms.
    pub fn room_count(&self) -> usize {
        self.rooms.len()
    }

    /// Get all room IDs (for debugging/admin).
    pub fn list_rooms(&self) -> Vec<String> {
        self.rooms.iter().map(|entry| entry.key().clone()).collect()
    }
}

impl Default for RoomStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    //! Tests for room store operations.

    use super::*;

    /// Ensures rooms can be created and removed.
    #[tokio::test]
    async fn test_room_store() {
        let store = RoomStore::new();
        assert_eq!(store.room_count(), 0);

        let (room_id, _room) = store.create_room();
        assert_eq!(store.room_count(), 1);

        let retrieved = store.get_room(&room_id);
        assert!(retrieved.is_some());

        let removed = store.remove_room(&room_id);
        assert!(removed);
        assert_eq!(store.room_count(), 0);
    }

    /// Ensures room IDs can be listed.
    #[tokio::test]
    async fn test_list_rooms() {
        let store = RoomStore::new();
        let (room_id1, _) = store.create_room();
        let (room_id2, _) = store.create_room();

        let rooms = store.list_rooms();
        assert_eq!(rooms.len(), 2);
        assert!(rooms.contains(&room_id1));
        assert!(rooms.contains(&room_id2));
    }

    /// Ensures rooms can be created with custom rules.
    #[tokio::test]
    async fn test_room_store_create_with_rules() {
        let store = RoomStore::new();
        let house_rules = HouseRules::with_card_year(2024);
        let (room_id, room_arc) = store.create_room_with_rules(house_rules);

        let room = room_arc.lock().await;
        assert_eq!(room.house_rules.as_ref().unwrap().ruleset.card_year, 2024);
        drop(room);

        // Verify we can retrieve it
        let retrieved = store.get_room(&room_id);
        assert!(retrieved.is_some());
    }
}
