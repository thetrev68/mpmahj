//! Setup-phase command handlers.

use crate::deck::Wall;
use crate::event::{private_events::PrivateEvent, public_events::PublicEvent, Event};
use crate::flow::charleston::{CharlestonStage, CharlestonState};
use crate::flow::outcomes::{WinContext, WinType};
use crate::flow::PhaseTrigger;
use crate::hand::Hand;
use crate::player::{PlayerStatus, Seat};
use crate::table::Table;
use rand::Rng;
use std::collections::HashMap;

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
pub fn roll_dice(table: &mut Table, _player: Seat) -> Vec<Event> {
    // Roll two dice (2-12) using proper RNG
    let mut rng = rand::thread_rng();
    let roll = rng.gen_range(2..=12);

    // Break the wall at the rolled position
    table.wall = Wall::from_deck_with_seed(table.wall.seed, roll as usize);

    let mut events = vec![
        Event::Public(PublicEvent::DiceRolled { roll }),
        Event::Public(PublicEvent::WallBroken {
            position: roll as usize,
        }),
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
                events.push(Event::Private(PrivateEvent::TilesDealt {
                    your_tiles: hands[idx].clone(),
                }));
            }
        }

        // Transition: Dealing -> OrganizingHands
        let _ = table.transition_phase(PhaseTrigger::TilesDealt);
    }

    events
}

/// Mark a player as ready and start Charleston once all players are ready.
///
/// Per NMJL rules, before the Charleston begins, East's hand is checked for a
/// "Heavenly Hand" - a winning hand immediately after the deal. If East has a
/// winning hand, the Charleston is waived and East wins with double payment.
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
pub fn ready_to_start(table: &mut Table, player: Seat) -> Vec<Event> {
    table.ready_players.insert(player);

    let mut events = vec![];

    // If all 4 players ready, check for Heavenly Hand before starting Charleston
    if table.ready_players.len() == 4 {
        // Check for Heavenly Hand (East wins immediately with 14 tiles)
        if let Some(east_player) = table.get_player(Seat::East) {
            let validator_result = table
                .validator
                .as_ref()
                .and_then(|v| v.validate_win(&east_player.hand));
            if let Some(win_result) = validator_result {
                // East has a winning hand - Heavenly Hand!
                events.push(Event::Public(PublicEvent::HeavenlyHand {
                    pattern: win_result.pattern_name.clone(),
                    base_score: win_result.score as i32,
                }));

                let winning_tile = east_player
                    .hand
                    .concealed
                    .first()
                    .copied()
                    .unwrap_or(crate::tile::tiles::BAM_1);

                let win_context = WinContext {
                    winner: Seat::East,
                    win_type: WinType::SelfDraw,
                    winning_tile,
                    hand: east_player.hand.clone(),
                };

                // Collect all final hands
                let mut final_hands = HashMap::new();
                for seat in Seat::all() {
                    if let Some(p) = table.get_player(seat) {
                        final_hands.insert(seat, p.hand.clone());
                    }
                }

                let mut result = crate::scoring::build_win_result(
                    &win_context,
                    win_result.pattern_name.clone(),
                    win_result.score,
                    &win_result.category,
                    final_hands,
                    table.dealer,
                    &table.house_rules,
                );

                // Heavenly hand = double payment from all players
                let heavenly_multiplier = 2;
                if let Some(score_breakdown) = result.score_breakdown.as_mut() {
                    for payment in score_breakdown.payments.values_mut() {
                        *payment *= heavenly_multiplier;
                    }

                    let mut final_scores = HashMap::new();
                    let mut winner_total = 0;
                    for (&loser, &payment) in &score_breakdown.payments {
                        final_scores.insert(loser, -payment);
                        winner_total += payment;
                    }
                    final_scores.insert(Seat::East, winner_total);
                    result.final_scores = final_scores;
                }

                // Emit GameOver event
                events.push(Event::Public(PublicEvent::GameOver {
                    winner: Some(Seat::East),
                    result: result.clone(),
                }));

                // Transition to GameOver phase via ValidationComplete
                let _ = table.transition_phase(PhaseTrigger::ValidationComplete(result));

                return events;
            }
        }

        // No Heavenly Hand - proceed with normal Charleston
        let _ = table.transition_phase(PhaseTrigger::HandsOrganized);

        // Initialize Charleston state
        let charleston_timer = table.house_rules.ruleset.charleston_timer_seconds;
        table.charleston_state = Some(CharlestonState::new(charleston_timer));

        events.push(Event::Public(PublicEvent::CharlestonPhaseChanged {
            stage: CharlestonStage::FirstRight,
        }));

        events.push(Event::Public(PublicEvent::CharlestonTimerStarted {
            stage: CharlestonStage::FirstRight,
            duration: charleston_timer,
            started_at_ms: 0,
            timer_mode: table.house_rules.ruleset.timer_mode.clone(),
        }));
    }

    events
}
