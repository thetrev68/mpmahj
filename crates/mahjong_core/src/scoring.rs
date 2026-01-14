//! Scoring and settlement logic for American Mahjong.
//!
//! This module implements:
//! - Base score calculation from winning patterns
//! - Modifiers for concealed hands, self-draw, and dealer bonus
//! - Payment calculation between players
//! - Dealer rotation rules (win/draw scenarios)
//!
//! Scoring follows NMJL standard rules:
//! - Base score determined by pattern value (typically 25 points)
//! - Concealed hand: +50% bonus
//! - Self-draw: all losers pay double
//! - Dealer win: receives +50% from all players
//! - Wall exhausted: dealer rotates (East passes to South)

use crate::flow::{GameEndCondition, GameResult, ScoreBreakdown, ScoreModifiers, WinContext};
use crate::hand::Hand;
use crate::player::Seat;
use std::collections::HashMap;

/// Standard base score for winning hands (NMJL typical).
const BASE_SCORE: i32 = 25;

/// Bonus multiplier for concealed hands (50%).
const CONCEALED_BONUS_MULTIPLIER: f32 = 0.5;

/// Bonus multiplier for dealer wins (50%).
const DEALER_BONUS_MULTIPLIER: f32 = 0.5;

/// Calculate the score breakdown for a winning hand.
///
/// # Arguments
/// * `win_ctx` - The win context with winner, win type, and hand
/// * `modifiers` - Scoring modifiers (concealed, self-draw, dealer)
/// * `current_dealer` - The current dealer seat
///
/// # Returns
/// A ScoreBreakdown with base score, bonuses, total, and per-player payments
///
/// # Examples
/// ```
/// use mahjong_core::flow::{ScoreModifiers, WinContext, WinType};
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::calculate_score;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::BAM_1;
///
/// let win_ctx = WinContext {
///     winner: Seat::East,
///     win_type: WinType::SelfDraw,
///     winning_tile: BAM_1,
///     hand: Hand::empty(),
/// };
/// let modifiers = ScoreModifiers {
///     concealed: false,
///     self_draw: true,
///     dealer_win: true,
/// };
/// let breakdown = calculate_score(&win_ctx, &modifiers, Seat::East);
/// assert!(breakdown.total > 0);
/// ```
pub fn calculate_score(
    win_ctx: &WinContext,
    modifiers: &ScoreModifiers,
    current_dealer: Seat,
) -> ScoreBreakdown {
    let base_score = BASE_SCORE;

    // Calculate bonuses
    let concealed_bonus = if modifiers.concealed {
        (base_score as f32 * CONCEALED_BONUS_MULTIPLIER) as i32
    } else {
        0
    };

    let dealer_bonus = if modifiers.dealer_win {
        (base_score as f32 * DEALER_BONUS_MULTIPLIER) as i32
    } else {
        0
    };

    // Self-draw bonus is applied via payment calculation, not as direct bonus
    let self_draw_bonus = 0;

    let total = base_score + concealed_bonus + self_draw_bonus + dealer_bonus;

    // Extract discarder from win context
    let discarder = match win_ctx.win_type {
        crate::flow::WinType::CalledDiscard(seat) => Some(seat),
        crate::flow::WinType::SelfDraw => None,
    };

    // Calculate payments from each losing player
    let payments = calculate_payments(win_ctx.winner, total, modifiers, current_dealer, discarder);

    ScoreBreakdown {
        base_score,
        concealed_bonus,
        self_draw_bonus,
        dealer_bonus,
        total,
        payments,
    }
}

/// Calculate how much each losing player pays the winner.
///
/// # Payment Rules
/// - Called discard: Only the discarder pays (full amount)
/// - Self-draw: All losers pay double
/// - Dealer win: All losers pay +50%
///
/// # Arguments
/// * `winner` - The winning player's seat
/// * `base_amount` - The base score amount
/// * `modifiers` - Scoring modifiers
/// * `_current_dealer` - The current dealer seat (reserved for future rules)
/// * `discarder` - The seat of the player who discarded the winning tile (None for self-draw)
///
/// # Returns
/// HashMap of seat -> payment amount (positive = pays to winner)
fn calculate_payments(
    winner: Seat,
    base_amount: i32,
    modifiers: &ScoreModifiers,
    _current_dealer: Seat,
    discarder: Option<Seat>,
) -> HashMap<Seat, i32> {
    let mut payments = HashMap::new();

    // For called discard wins, only the discarder pays
    if let Some(discarder_seat) = discarder {
        let mut payment = base_amount;

        // Dealer bonus: if winner is dealer, losers pay +50%
        if modifiers.dealer_win {
            payment = (payment as f32 * 1.5) as i32;
        }

        payments.insert(discarder_seat, payment);
        return payments;
    }

    // For self-draw, all losers pay double
    let all_seats = [Seat::East, Seat::South, Seat::West, Seat::North];

    for &seat in &all_seats {
        if seat == winner {
            continue; // Winner doesn't pay themselves
        }

        let mut payment = base_amount;

        // Self-draw: all losers pay double
        if modifiers.self_draw {
            payment *= 2;
        }

        // Dealer bonus: if winner is dealer, losers pay +50%
        if modifiers.dealer_win {
            payment = (payment as f32 * 1.5) as i32;
        }

        payments.insert(seat, payment);
    }

    payments
}

/// Calculate the next dealer after a game ends.
///
/// # Rotation Rules
/// - Winner is dealer: Dealer retains seat (East stays East)
/// - Winner is not dealer: Dealer rotates clockwise (East → South → West → North → East)
/// - Wall exhausted (no winner): Dealer rotates clockwise
///
/// # Arguments
/// * `current_dealer` - The current dealer seat
/// * `winner` - The winning seat (None if wall exhausted)
///
/// # Returns
/// The next dealer seat
///
/// # Examples
/// ```
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::calculate_next_dealer;
///
/// assert_eq!(calculate_next_dealer(Seat::East, None), Seat::South);
/// ```
pub fn calculate_next_dealer(current_dealer: Seat, winner: Option<Seat>) -> Seat {
    match winner {
        Some(winner_seat) if winner_seat == current_dealer => {
            // Winner is dealer: dealer retains seat
            current_dealer
        }
        Some(_) | None => {
            // Winner is not dealer, or wall exhausted: rotate clockwise
            current_dealer.right()
        }
    }
}

/// Build a complete GameResult for a winning hand.
///
/// # Arguments
/// * `win_ctx` - The win context
/// * `pattern_name` - Name of the winning pattern from The Card
/// * `all_hands` - Final hands of all players
/// * `current_dealer` - The current dealer seat
///
/// # Returns
/// A complete GameResult with scores, payments, and dealer rotation
///
/// # Examples
/// ```
/// use mahjong_core::flow::{WinContext, WinType};
/// use mahjong_core::hand::Hand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::build_win_result;
/// use mahjong_core::tile::tiles::BAM_1;
/// use std::collections::HashMap;
///
/// let win_ctx = WinContext {
///     winner: Seat::East,
///     win_type: WinType::SelfDraw,
///     winning_tile: BAM_1,
///     hand: Hand::empty(),
/// };
/// let mut all_hands = HashMap::new();
/// all_hands.insert(Seat::East, Hand::empty());
/// all_hands.insert(Seat::South, Hand::empty());
/// all_hands.insert(Seat::West, Hand::empty());
/// all_hands.insert(Seat::North, Hand::empty());
/// let result = build_win_result(&win_ctx, "Test".to_string(), all_hands, Seat::East);
/// assert_eq!(result.winner, Some(Seat::East));
/// ```
pub fn build_win_result(
    win_ctx: &WinContext,
    pattern_name: String,
    all_hands: HashMap<Seat, Hand>,
    current_dealer: Seat,
) -> GameResult {
    // Determine score modifiers
    let modifiers = ScoreModifiers {
        concealed: is_hand_concealed(&win_ctx.hand),
        self_draw: matches!(win_ctx.win_type, crate::flow::WinType::SelfDraw),
        dealer_win: win_ctx.winner == current_dealer,
    };

    // Calculate score
    let score_breakdown = calculate_score(win_ctx, &modifiers, current_dealer);

    // Calculate final scores (winner's total gain, losers' losses)
    let mut final_scores = HashMap::new();
    let mut winner_total = 0;

    for (&loser, &payment) in &score_breakdown.payments {
        final_scores.insert(loser, -payment); // Losers have negative scores
        winner_total += payment;
    }
    final_scores.insert(win_ctx.winner, winner_total); // Winner gets sum of all payments

    // Determine next dealer
    let next_dealer = calculate_next_dealer(current_dealer, Some(win_ctx.winner));

    GameResult {
        winner: Some(win_ctx.winner),
        winning_pattern: Some(pattern_name),
        score_breakdown: Some(score_breakdown),
        final_scores,
        final_hands: all_hands,
        next_dealer,
        end_condition: GameEndCondition::Win,
    }
}

/// Build a GameResult for a wall exhausted scenario (no winner).
///
/// # Arguments
/// * `all_hands` - Final hands of all players
/// * `current_dealer` - The current dealer seat
///
/// # Returns
/// A GameResult with no winner, zero scores, and rotated dealer
///
/// # Examples
/// ```
/// use mahjong_core::hand::Hand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::build_draw_result;
/// use std::collections::HashMap;
///
/// let mut hands = HashMap::new();
/// hands.insert(Seat::East, Hand::empty());
/// hands.insert(Seat::South, Hand::empty());
/// hands.insert(Seat::West, Hand::empty());
/// hands.insert(Seat::North, Hand::empty());
/// let result = build_draw_result(hands, Seat::East);
/// assert!(result.winner.is_none());
/// ```
pub fn build_draw_result(all_hands: HashMap<Seat, Hand>, current_dealer: Seat) -> GameResult {
    let next_dealer = calculate_next_dealer(current_dealer, None);

    let final_scores = [Seat::East, Seat::South, Seat::West, Seat::North]
        .iter()
        .map(|&seat| (seat, 0))
        .collect();

    GameResult {
        winner: None,
        winning_pattern: None,
        score_breakdown: None,
        final_scores,
        final_hands: all_hands,
        next_dealer,
        end_condition: GameEndCondition::WallExhausted,
    }
}

/// Build a GameResult for an abandoned game.
///
/// # Arguments
/// * `all_hands` - Final hands of all players
/// * `current_dealer` - The current dealer seat
/// * `reason` - Why the game was abandoned
///
/// # Returns
/// A GameResult with no winner, zero scores, and abandoned status
///
/// # Examples
/// ```
/// use mahjong_core::flow::AbandonReason;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::build_abandon_result;
/// use std::collections::HashMap;
///
/// let mut hands = HashMap::new();
/// hands.insert(Seat::East, Hand::empty());
/// hands.insert(Seat::South, Hand::empty());
/// hands.insert(Seat::West, Hand::empty());
/// hands.insert(Seat::North, Hand::empty());
/// let result = build_abandon_result(hands, Seat::East, AbandonReason::Timeout);
/// assert!(matches!(result.end_condition, mahjong_core::flow::GameEndCondition::Abandoned(_)));
/// ```
pub fn build_abandon_result(
    all_hands: HashMap<Seat, Hand>,
    current_dealer: Seat,
    reason: crate::flow::AbandonReason,
) -> GameResult {
    // On abandonment, dealer typically doesn't rotate (game didn't complete)
    let next_dealer = current_dealer;

    let final_scores = [Seat::East, Seat::South, Seat::West, Seat::North]
        .iter()
        .map(|&seat| (seat, 0))
        .collect();

    GameResult {
        winner: None,
        winning_pattern: None,
        score_breakdown: None,
        final_scores,
        final_hands: all_hands,
        next_dealer,
        end_condition: GameEndCondition::Abandoned(reason),
    }
}

/// Check if a hand is completely concealed (no exposed melds).
///
/// # Arguments
/// * `hand` - The hand to check
///
/// # Returns
/// true if the hand has no exposed melds, false otherwise
fn is_hand_concealed(hand: &Hand) -> bool {
    hand.exposed.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow::{WinContext, WinType};
    use crate::tile::tiles;

    #[test]
    fn test_calculate_score_basic_win() {
        let win_ctx = WinContext {
            winner: Seat::East,
            win_type: WinType::CalledDiscard(Seat::South),
            winning_tile: tiles::BAM_1,
            hand: Hand::empty(),
        };

        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: false,
        };

        let score = calculate_score(&win_ctx, &modifiers, Seat::East);

        assert_eq!(score.base_score, 25);
        assert_eq!(score.concealed_bonus, 0);
        assert_eq!(score.dealer_bonus, 0);
        assert_eq!(score.total, 25);
    }

    #[test]
    fn test_calculate_score_concealed_bonus() {
        let win_ctx = WinContext {
            winner: Seat::East,
            win_type: WinType::SelfDraw,
            winning_tile: tiles::BAM_1,
            hand: Hand::empty(),
        };

        let modifiers = ScoreModifiers {
            concealed: true,
            self_draw: true,
            dealer_win: false,
        };

        let score = calculate_score(&win_ctx, &modifiers, Seat::East);

        assert_eq!(score.base_score, 25);
        assert_eq!(score.concealed_bonus, 12); // 50% of 25 = 12.5 -> 12
        assert_eq!(score.total, 37);
    }

    #[test]
    fn test_calculate_score_dealer_bonus() {
        let win_ctx = WinContext {
            winner: Seat::East,
            win_type: WinType::SelfDraw,
            winning_tile: tiles::BAM_1,
            hand: Hand::empty(),
        };

        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: true,
            dealer_win: true, // East is dealer
        };

        let score = calculate_score(&win_ctx, &modifiers, Seat::East);

        assert_eq!(score.base_score, 25);
        assert_eq!(score.dealer_bonus, 12); // 50% of 25
        assert_eq!(score.total, 37);
    }

    #[test]
    fn test_calculate_score_all_bonuses() {
        let win_ctx = WinContext {
            winner: Seat::East,
            win_type: WinType::SelfDraw,
            winning_tile: tiles::BAM_1,
            hand: Hand::empty(),
        };

        let modifiers = ScoreModifiers {
            concealed: true,
            self_draw: true,
            dealer_win: true,
        };

        let score = calculate_score(&win_ctx, &modifiers, Seat::East);

        assert_eq!(score.base_score, 25);
        assert_eq!(score.concealed_bonus, 12);
        assert_eq!(score.dealer_bonus, 12);
        assert_eq!(score.total, 49); // 25 + 12 + 12
    }

    #[test]
    fn test_calculate_payments_self_draw() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: true,
            dealer_win: false,
        };

        let payments = calculate_payments(Seat::East, 25, &modifiers, Seat::East, None);

        // Self-draw: all losers pay double
        assert_eq!(payments.get(&Seat::South), Some(&50));
        assert_eq!(payments.get(&Seat::West), Some(&50));
        assert_eq!(payments.get(&Seat::North), Some(&50));
        assert_eq!(payments.get(&Seat::East), None); // Winner doesn't pay
    }

    #[test]
    fn test_calculate_payments_dealer_win_self_draw() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: true,
            dealer_win: true,
        };

        let payments = calculate_payments(Seat::East, 25, &modifiers, Seat::East, None);

        // Self-draw (x2) + dealer bonus (+50%) = x3
        assert_eq!(payments.get(&Seat::South), Some(&75)); // 25 * 2 * 1.5 = 75
        assert_eq!(payments.get(&Seat::West), Some(&75));
        assert_eq!(payments.get(&Seat::North), Some(&75));
    }
    #[test]
    fn test_calculate_payments_called_discard_basic() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: false,
        };

        // East wins on South's discard
        let payments =
            calculate_payments(Seat::East, 25, &modifiers, Seat::East, Some(Seat::South));

        // Only the discarder (South) pays
        assert_eq!(payments.get(&Seat::South), Some(&25));
        assert_eq!(payments.get(&Seat::West), None); // Others don't pay
        assert_eq!(payments.get(&Seat::North), None);
        assert_eq!(payments.get(&Seat::East), None); // Winner doesn't pay
        assert_eq!(payments.len(), 1); // Only one payer
    }

    #[test]
    fn test_calculate_payments_called_discard_dealer_win() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: true, // Winner is dealer
        };

        // East (dealer) wins on West's discard
        let payments = calculate_payments(Seat::East, 25, &modifiers, Seat::East, Some(Seat::West));

        // Only discarder pays, with +50% dealer bonus
        assert_eq!(payments.get(&Seat::West), Some(&37)); // 25 * 1.5 = 37.5 -> 37
        assert_eq!(payments.get(&Seat::South), None);
        assert_eq!(payments.get(&Seat::North), None);
        assert_eq!(payments.len(), 1);
    }

    #[test]
    fn test_calculate_payments_called_discard_non_dealer_wins() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: false,
        };

        // South wins on North's discard (East is dealer)
        let payments =
            calculate_payments(Seat::South, 25, &modifiers, Seat::East, Some(Seat::North));

        // Only discarder pays base amount
        assert_eq!(payments.get(&Seat::North), Some(&25));
        assert_eq!(payments.get(&Seat::East), None);
        assert_eq!(payments.get(&Seat::West), None);
        assert_eq!(payments.get(&Seat::South), None);
        assert_eq!(payments.len(), 1);
    }
    #[test]
    fn test_calculate_next_dealer_winner_is_dealer() {
        let next = calculate_next_dealer(Seat::East, Some(Seat::East));
        assert_eq!(next, Seat::East); // Dealer retains
    }

    #[test]
    fn test_calculate_next_dealer_winner_not_dealer() {
        let next = calculate_next_dealer(Seat::East, Some(Seat::South));
        assert_eq!(next, Seat::South); // Rotates clockwise
    }

    #[test]
    fn test_calculate_next_dealer_wall_exhausted() {
        let next = calculate_next_dealer(Seat::East, None);
        assert_eq!(next, Seat::South); // Rotates clockwise

        let next = calculate_next_dealer(Seat::West, None);
        assert_eq!(next, Seat::North);
    }

    #[test]
    fn test_is_hand_concealed() {
        let hand = Hand::empty();
        assert!(is_hand_concealed(&hand)); // Empty hand is concealed

        let mut hand_with_exposed = Hand::empty();
        hand_with_exposed.exposed.push(
            crate::meld::Meld::new(
                crate::meld::MeldType::Pung,
                vec![tiles::BAM_1, tiles::BAM_1, tiles::BAM_1],
                Some(tiles::BAM_1),
            )
            .unwrap(),
        );
        assert!(!is_hand_concealed(&hand_with_exposed));
    }

    #[test]
    fn test_build_win_result() {
        let win_ctx = WinContext {
            winner: Seat::East,
            win_type: WinType::SelfDraw,
            winning_tile: tiles::BAM_1,
            hand: Hand::empty(),
        };

        let mut all_hands = HashMap::new();
        all_hands.insert(Seat::East, Hand::empty());
        all_hands.insert(Seat::South, Hand::empty());
        all_hands.insert(Seat::West, Hand::empty());
        all_hands.insert(Seat::North, Hand::empty());

        let result = build_win_result(
            &win_ctx,
            "2468 Consecutive Run".to_string(),
            all_hands,
            Seat::East,
        );

        assert_eq!(result.winner, Some(Seat::East));
        assert_eq!(
            result.winning_pattern,
            Some("2468 Consecutive Run".to_string())
        );
        assert_eq!(result.next_dealer, Seat::East); // Dealer won, retains
        assert_eq!(result.end_condition, GameEndCondition::Win);
        assert!(result.score_breakdown.is_some());
    }

    #[test]
    fn test_build_draw_result() {
        let mut all_hands = HashMap::new();
        all_hands.insert(Seat::East, Hand::empty());
        all_hands.insert(Seat::South, Hand::empty());
        all_hands.insert(Seat::West, Hand::empty());
        all_hands.insert(Seat::North, Hand::empty());

        let result = build_draw_result(all_hands, Seat::East);

        assert_eq!(result.winner, None);
        assert_eq!(result.winning_pattern, None);
        assert_eq!(result.next_dealer, Seat::South); // Rotates on draw
        assert_eq!(result.end_condition, GameEndCondition::WallExhausted);
        assert!(result.score_breakdown.is_none());

        // All scores should be zero
        assert_eq!(result.final_scores.get(&Seat::East), Some(&0));
        assert_eq!(result.final_scores.get(&Seat::South), Some(&0));
    }
}
