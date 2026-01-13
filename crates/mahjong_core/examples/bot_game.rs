//! Example: run a four-bot American Mahjong game simulation.

use mahjong_core::{
    bot::BasicBot,
    player::{Player, Seat},
    rules::card::UnifiedCard,
    table::Table,
};

fn main() {
    println!("🀄 Starting 4-bot American Mahjong game...\n");

    // Load the 2025 NMJL card
    let json = std::fs::read_to_string("data/cards/unified_card2025.json")
        .expect("Failed to load card - make sure to run from repository root");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse card JSON");

    println!(
        "✓ Loaded 2025 NMJL card with {} pattern variations\n",
        card.patterns.len()
    );

    // Create 4 bots
    let bots = [
        BasicBot::new(&card),
        BasicBot::new(&card),
        BasicBot::new(&card),
        BasicBot::new(&card),
    ];

    // Create table
    let mut table = Table::new("bot_game".to_string(), 42);

    // Add 4 bot players
    for seat in Seat::all() {
        let player = Player::new(format!("Bot_{}", seat.index()), seat, true);
        table.players.insert(seat, player);
    }

    println!("✓ Created 4 bot players:");
    for seat in Seat::all() {
        println!("  - {} at {:?}", table.get_player(seat).unwrap().id, seat);
    }
    println!();

    // Transition from WaitingForPlayers to Setup
    let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::AllPlayersJoined);
    println!("✓ All players joined, starting setup...\n");

    // Simulate game
    println!("Starting game simulation...\n");

    let mut turn_count = 0;
    let max_turns = 1000; // Safety limit

    loop {
        turn_count += 1;

        if turn_count > max_turns {
            println!("⚠ Reached maximum turn limit ({}). Ending game.", max_turns);
            break;
        }

        // Check if game is over
        if matches!(table.phase, mahjong_core::flow::GamePhase::GameOver(_)) {
            println!("🎉 Game Over!");
            if let mahjong_core::flow::GamePhase::GameOver(result) = &table.phase {
                println!("   Winner: {:?}", result.winner);
                println!(
                    "   Pattern: {}",
                    result.winning_pattern.as_deref().unwrap_or("None")
                );
            }
            break;
        }

        // Try to get bot commands for each seat
        let mut any_action = false;

        for seat in Seat::all() {
            let bot = &bots[seat.index()];

            if let Some(command) = table.get_bot_command(seat, bot) {
                // Execute the command
                match table.process_command(command.clone()) {
                    Ok(events) => {
                        // Print summary of what happened
                        if !events.is_empty() {
                            println!("[Turn {}] {:?} executed {:?}", turn_count, seat, command);
                            for event in &events {
                                print_event(event);
                            }
                            println!();
                        }
                        any_action = true;
                    }
                    Err(e) => {
                        println!("❌ Error processing command {:?}: {:?}", command, e);
                    }
                }
            }
        }

        // If no bot could act, check if it's an automatic phase transition
        if !any_action {
        // Some phases are automatic and don't require player input
            use mahjong_core::flow::{GamePhase, SetupStage};

            match &table.phase {
                GamePhase::Setup(SetupStage::BreakingWall) => {
                    // Auto-transition to Dealing
                    let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::WallBroken);
                }
                GamePhase::Setup(SetupStage::Dealing) => {
                    // Auto-transition to OrganizingHands
                    let _ = table.transition_phase(mahjong_core::flow::PhaseTrigger::TilesDealt);
                }
                _ => {
                    println!(
                        "⚠ No bot could act in phase {:?}. Ending game.",
                        table.phase
                    );
                    break;
                }
            }
        }
    }

    println!("\n✓ Game simulation complete after {} turns", turn_count);
}

/// Print a short summary for key events during the simulation.
fn print_event(event: &mahjong_core::event::GameEvent) {
    use mahjong_core::event::GameEvent;

    match event {
        GameEvent::TileDrawn {
            tile: None,
            remaining_tiles,
        } => {
            println!(
                "   → Tile drawn (concealed), {} tiles remaining",
                remaining_tiles
            );
        }
        GameEvent::TileDiscarded { player, tile } => {
            println!("   → {:?} discarded {}", player, tile);
        }
        GameEvent::TileCalled { player, meld, .. } => {
            println!("   → {:?} called for {:?}", player, meld.meld_type);
        }
        GameEvent::MahjongDeclared { player } => {
            println!("   🎉 {:?} declared Mahjong!", player);
        }
        GameEvent::CharlestonPhaseChanged { stage } => {
            println!("   → Charleston phase: {:?}", stage);
        }
        GameEvent::TurnChanged { player, .. } => {
            println!("   → Turn changed to {:?}", player);
        }
        GameEvent::PlayerReadyForPass { player } => {
            println!("   → {:?} ready for Charleston pass", player);
        }
        GameEvent::TilesPassing { direction } => {
            println!("   → Passing tiles {:?}", direction);
        }
        GameEvent::CharlestonComplete => {
            println!("   ✓ Charleston complete, starting main game");
        }
        _ => {
            // Other events - don't print to reduce noise
        }
    }
}
