//! Setup-phase command handlers.

use crate::deck::Wall;
use crate::event::GameEvent;
use crate::flow::{CharlestonStage, CharlestonState, PhaseTrigger};
use crate::hand::Hand;
use crate::player::{PlayerStatus, Seat};
use crate::table::Table;
use rand::Rng;

/// Roll dice, break the wall, deal initial hands, and advance setup phases.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::setup::roll_dice;
///
/// let mut table = Table::new("setup".to_string(), 1);
/// let events = roll_dice(&mut table, Seat::East);
/// let _ = events;
/// ```
pub fn roll_dice(table: &mut Table, _player: Seat) -> Vec<GameEvent> {
    // Roll two dice (2-12) using proper RNG
    let mut rng = rand::thread_rng();
    let roll = rng.gen_range(2..=12);

    // Break the wall at the rolled position
    table.wall = Wall::from_deck_with_seed(table.wall.seed, roll as usize);

    let mut events = vec![
        GameEvent::DiceRolled { roll },
        GameEvent::WallBroken {
            position: roll as usize,
        },
    ];

    // Transition: RollingDice -> BreakingWall -> Dealing
    let _ = table.transition_phase(PhaseTrigger::DiceRolled);
    let _ = table.transition_phase(PhaseTrigger::WallBroken);

    // Deal tiles
    if let Ok(hands) = table.wall.deal_initial() {
        // Assign hands to players
        for (idx, seat) in Seat::all().iter().enumerate() {
            if let Some(player) = table.get_player_mut(*seat) {
                player.hand = Hand::new(hands[idx].clone());
                player.status = PlayerStatus::Active;

                // Emit private event for each player
                events.push(GameEvent::TilesDealt {
                    your_tiles: hands[idx].clone(),
                });
            }
        }

        // Transition: Dealing -> OrganizingHands
        let _ = table.transition_phase(PhaseTrigger::TilesDealt);
    }

    events
}

/// Mark a player as ready and start Charleston once all players are ready.
///
/// # Examples
/// ```no_run
/// use mahjong_core::player::Seat;
/// use mahjong_core::table::Table;
/// use mahjong_core::table::handlers::setup::ready_to_start;
///
/// let mut table = Table::new("ready".to_string(), 1);
/// let _events = ready_to_start(&mut table, Seat::East);
/// ```
pub fn ready_to_start(table: &mut Table, player: Seat) -> Vec<GameEvent> {
    table.ready_players.insert(player);

    let mut events = vec![];

    // If all 4 players ready, start Charleston
    if table.ready_players.len() == 4 {
        // Transition to Charleston
        let _ = table.transition_phase(PhaseTrigger::HandsOrganized);

        // Initialize Charleston state
        let charleston_timer = table.house_rules.ruleset.charleston_timer_seconds;
        table.charleston_state = Some(CharlestonState::new(charleston_timer));

        events.push(GameEvent::CharlestonPhaseChanged {
            stage: CharlestonStage::FirstRight,
        });

        events.push(GameEvent::CharlestonTimerStarted {
            stage: CharlestonStage::FirstRight,
            duration: charleston_timer,
            started_at_ms: 0,
            timer_mode: table.house_rules.ruleset.timer_mode.clone(),
        });
    }

    events
}
