use mahjong_core::{player::Seat, tile::tiles::*};
use mahjong_server::network::room_store::RoomStore;
use tokio::time::Duration;

#[tokio::test]
#[ignore]
async fn test_memory_100_concurrent_rooms() {
    // This test is designed to be run manually to check memory usage.
    // cargo test --test memory_stress_test -- --ignored --nocapture

    let store = RoomStore::new();
    let mut rooms = Vec::new();

    println!("Creating 100 rooms...");
    for _ in 0..100 {
        let (_id, room_arc) = store.create_room();

        // Setup room with bots
        {
            let mut room = room_arc.lock().await;
            room.fill_empty_seats_with_bots();
            room.start_game().await; // Initializes table
        }

        rooms.push(room_arc);
    }

    println!("Simulating 200 moves per room...");
    // Simulate game history
    for room_arc in &rooms {
        let mut room = room_arc.lock().await;

        // Add fake history entries
        for i in 0..200 {
            use chrono::Utc;
            use mahjong_core::history::{MoveAction, MoveHistoryEntry};

            // Create a realistic snapshot (deep clone of table)
            let snapshot = if let Some(table) = &room.table {
                // Table doesn't implement Clone directly for snapshot logic usually,
                // but we can use the snapshot method if available or just clone if derived.
                // Assuming Table derives Clone (checked in previous steps: yes).
                table.clone()
            } else {
                continue;
            };

            let entry = MoveHistoryEntry {
                move_number: i,
                timestamp: Utc::now(),
                seat: Seat::East,
                action: MoveAction::DiscardTile { tile: BAM_1 },
                description: format!("Move {}", i),
                is_decision_point: false,
                snapshot,
            };

            room.history.add_entry(entry);
        }
    }

    println!("Rooms populated. Sleeping for 60s for manual memory inspection...");
    println!("Run: pmap -x $(pgrep -f 'memory_stress_test') | tail -1");

    tokio::time::sleep(Duration::from_secs(60)).await;
}
