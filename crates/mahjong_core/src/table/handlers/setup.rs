use crate::deck::Wall;
use crate::event::GameEvent;
use crate::flow::{CharlestonStage, CharlestonState, PhaseTrigger};
use crate::hand::Hand;
use crate::player::{PlayerStatus, Seat};
use crate::table::Table;

pub fn roll_dice(table: &mut Table, _player: Seat) -> Vec<GameEvent> {
    // Roll two dice (2-12)
    #[allow(clippy::cast_possible_truncation)]
    let roll = (table.wall.total_tiles() % 11 + 2) as u8; // Simple deterministic roll, always in range 2-12

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
