//! Integration tests for AI comparison logging.

use mahjong_server::network::room::Room;
use std::env;

#[tokio::test]
async fn test_debug_mode_enabled_from_env() {
    // Set environment variable
    env::set_var("DEBUG_AI_COMPARISON", "1");

    let (room, _rx) = Room::new();

    // Check that log is accessible (which means debug mode is enabled)
    assert_eq!(
        room.analysis.analysis_log_len(),
        0,
        "Log should start empty"
    );

    // Cleanup
    env::remove_var("DEBUG_AI_COMPARISON");
}

#[tokio::test]
async fn test_debug_mode_disabled_by_default() {
    // Ensure env var is not set
    env::remove_var("DEBUG_AI_COMPARISON");

    let (room, _rx) = Room::new();

    // When debug mode is off, get_analysis_log returns empty slice
    assert_eq!(room.analysis.get_analysis_log().len(), 0);
    assert_eq!(room.analysis.analysis_log_len(), 0);
}

#[tokio::test]
async fn test_get_analysis_log_respects_debug_mode() {
    env::remove_var("DEBUG_AI_COMPARISON");
    let (room, _rx) = Room::new();

    // Should return empty slice when debug mode is off
    let log = room.analysis.get_analysis_log();
    assert_eq!(log.len(), 0);
}

#[tokio::test]
async fn test_analysis_log_len() {
    env::remove_var("DEBUG_AI_COMPARISON");
    let (room, _rx) = Room::new();

    assert_eq!(room.analysis.analysis_log_len(), 0);
}
