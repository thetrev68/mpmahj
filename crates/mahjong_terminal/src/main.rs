//! Terminal client entrypoint and CLI configuration.

use anyhow::Result;
use clap::Parser;

mod bot;
mod client;
mod input;
mod ui;

/// American Mahjong terminal client.
///
/// A text-based client for testing `mahjong_server` without building the full UI.
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// WebSocket server URL.
    #[arg(short, long, default_value = "ws://localhost:8080")]
    server: String,

    /// Enable bot mode (auto-play, no user input).
    #[arg(short, long, default_value_t = false)]
    bot: bool,

    /// Spectate mode (read-only, no commands sent).
    #[arg(long, default_value_t = false)]
    spectate: bool,

    /// Join a specific game ID.
    #[arg(short, long)]
    game_id: Option<String>,

    /// Request a specific seat (East, South, West, North).
    #[arg(long)]
    seat: Option<String>,

    /// Authenticate with a session token.
    #[arg(short, long)]
    auth_token: Option<String>,

    /// Bot difficulty (Easy, Medium, Hard, Expert).
    #[arg(long, default_value = "Easy")]
    difficulty: String,

    /// Load commands from a script file.
    #[arg(long)]
    script: Option<String>,

    /// Record game session to file.
    #[arg(short, long)]
    record: Option<String>,
}

/// Run the terminal client.
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing/logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let args = Args::parse();

    tracing::info!("American Mahjong Terminal Client");
    tracing::info!("Connecting to: {}", args.server);

    // Create the terminal client
    let mut client = client::Client::new(args.server.clone(), args.auth_token.clone()).await?;

    // Connect to the server
    client.connect().await?;

    // Authenticate
    client.authenticate().await?;

    // Create or join a room if specified
    if let Some(game_id) = &args.game_id {
        tracing::info!("Joining room: {}", game_id);
        client.join_room(game_id).await?;
    } else if args.bot {
        // Bots without a game_id will create a new room
        tracing::info!("Bot creating new room...");
        client.create_room().await?;
    }

    // If bot mode, run the bot
    if args.bot {
        let difficulty = match args.difficulty.to_lowercase().as_str() {
            "easy" => mahjong_ai::Difficulty::Easy,
            "medium" => mahjong_ai::Difficulty::Medium,
            "hard" => mahjong_ai::Difficulty::Hard,
            "expert" => mahjong_ai::Difficulty::Expert,
            _ => {
                tracing::warn!(
                    "Invalid difficulty '{}', defaulting to Easy",
                    args.difficulty
                );
                mahjong_ai::Difficulty::Easy
            }
        };
        tracing::info!("Bot mode enabled with difficulty: {:?}", difficulty);
        bot::run_bot(&mut client, difficulty).await?;
    } else if let Some(script_path) = &args.script {
        // Run from script
        tracing::info!("Running script: {}", script_path);
        client.run_script(script_path).await?;
    } else {
        // Interactive mode
        tracing::info!("Interactive mode - type 'help' for commands");
        client.run_interactive().await?;
    }

    Ok(())
}
