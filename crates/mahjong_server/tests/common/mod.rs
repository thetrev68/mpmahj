/// Common test utilities shared across integration tests
use std::sync::Once;

static INIT: Once = Once::new();

/// Initialize test environment (load .env, setup tracing, etc.)
/// This is safe to call multiple times - it only runs once.
pub fn init_test_env() {
    INIT.call_once(|| {
        // Load .env file from workspace root
        let _ = dotenvy::from_filename("../../.env");

        // Alternatively, try from current directory
        let _ = dotenvy::dotenv();

        // Initialize tracing for test debugging (optional)
        let _ = tracing_subscriber::fmt()
            .with_test_writer()
            .with_env_filter("debug")
            .try_init();
    });
}
