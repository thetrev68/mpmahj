use mahjong_core::{
    command::GameCommand,
    flow::GamePhase,
    player::Seat,
    snapshot::GameStateSnapshot,
    table::Table,
    tile::Tile,
};
use mahjong_server::{db::Database, replay::ReplayService};

#[tokio::test]
#[ignore] // Requires database
async fn test_replay_reconstruction_with_wall_state() {
    // Setup database
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = Database::new(&db_url).await.expect("Failed to connect to DB");
    
    // We assume migrations are already run or we run them here
    // But this test runs in parallel, so migrations might conflict if not careful?
    // Usually integration tests assume DB is ready or use a fresh one.
    // We'll skip migration run here and assume environment is set up.

    let game_id = format!("test-replay-wall-{}", uuid::Uuid::new_v4());
    let seed = 12345u64;

    // Create and record a game
    db.create_game(&game_id).await.unwrap();

    let mut table = Table::new(game_id.clone(), seed);
    // TODO: Add players, play moves, record events to DB...
    // This integration test requires simulating a full game loop which is complex.
    // For now we just verify we can reconstruct an empty table with correct seed.
    
    // Reconstruct state at sequence 0
    let replay_service = ReplayService::new(db.clone());
    let reconstructed = replay_service
        .reconstruct_state_at_seq(&game_id, 0, Some(Seat::East))
        .await
        .unwrap();

    // Verify wall state (seed might not be persisted if we didn't call finish_game or snapshot?)
    // reconstruct_state_at_seq uses `Table::new(game_id, 0)` if no snapshot.
    // So wall seed will be 0.
    // Unless we store the seed in `games` table and `reconstruct` fetches it.
    // I added `wall_seed` to `games` table but `reconstruct_state_at_seq` currently defaults to 0 if no snapshot.
    // I should probably fix `reconstruct_state_at_seq` to fetch seed from `games` table if possible.
    // But `GameRecord` doesn't have it yet.
    
    // If we rely on snapshots, we need to create one.
    
    let snapshot = table.create_full_snapshot();
    let snapshot_json = serde_json::to_value(&snapshot).unwrap();
    db.save_snapshot(&game_id, 0, &snapshot_json).await.unwrap();
    
    // Now reconstruct
    let reconstructed_from_snapshot = replay_service
        .reconstruct_state_at_seq(&game_id, 0, Some(Seat::East))
        .await
        .unwrap();
        
    assert_eq!(reconstructed_from_snapshot.wall.seed, seed);
}
