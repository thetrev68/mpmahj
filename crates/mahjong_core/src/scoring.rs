//! Scoring and settlement logic for American Mahjong.
//!
//! This module implements:
//! - Base score calculation from winning patterns
//! - NMJL payment rules (called discard vs self-draw)
//! - Jokerless bonus (2x multiplier, except Singles/Pairs)
//! - Optional house-rule bonuses (concealed, dealer)
//! - Payment calculation between players
//! - Dealer rotation rules (always rotates clockwise per NMJL)
//!
//! Scoring follows NMJL standard rules:
//! - Base score determined by pattern value from The Card
//! - Self-draw: all 3 losers pay 2x base
//! - Called discard: discarder pays 2x base, others pay 1x base
//! - Jokerless: multiply all payments by 2x (except Singles/Pairs category)
//! - Dealer rotation: always rotates clockwise every game

use crate::flow::outcomes::{
    GameEndCondition, GameResult, ScoreBreakdown, ScoreModifiers, WinContext,
};
use crate::hand::Hand;
use crate::player::Seat;
use crate::table::HouseRules;
use std::collections::HashMap;

/// Bonus multiplier for concealed hands (50%) - house rule only.
const CONCEALED_BONUS_MULTIPLIER: f32 = 0.5;

/// Bonus multiplier for dealer wins (50%) - house rule only.
const DEALER_BONUS_MULTIPLIER: f32 = 0.5;

/// Calculate the score breakdown for a winning hand.
///
/// # NMJL Scoring Rules
/// - Base score comes from pattern value on The Card
/// - Self-draw: all 3 losers pay 2x base
/// - Called discard: discarder pays 2x base, others pay 1x base
/// - Jokerless: multiply all payments by 2x (4x effective for self-draw, 4x/2x for called)
/// - Exception: Singles/Pairs category does not get jokerless bonus
///
/// # Arguments
/// * `win_ctx` - The win context with winner, win type, and hand
/// * `modifiers` - Scoring modifiers (concealed, self-draw, dealer)
/// * `current_dealer` - The current dealer seat
/// * `pattern_score` - Base score from the winning pattern
/// * `pattern_category` - Pattern category name (to check for Singles/Pairs)
/// * `house_rules` - Optional house rules for non-NMJL bonuses
///
/// # Returns
/// A ScoreBreakdown with base score, bonuses, total, and per-player payments
///
/// # Examples
/// ```
/// use mahjong_core::flow::outcomes::{ScoreModifiers, WinContext, WinType};
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::calculate_score;
/// use mahjong_core::hand::Hand;
/// use mahjong_core::tile::tiles::BAM_1;
/// use mahjong_core::table::HouseRules;
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
/// let house_rules = HouseRules::default();
/// let breakdown = calculate_score(&win_ctx, &modifiers, Seat::East, 25, "Test", &house_rules);
/// assert!(breakdown.total > 0);
/// ```
pub fn calculate_score(
    win_ctx: &WinContext,
    modifiers: &ScoreModifiers,
    current_dealer: Seat,
    pattern_score: u16,
    pattern_category: &str,
    house_rules: &HouseRules,
) -> ScoreBreakdown {
    let base_score = pattern_score as i32;

    // Calculate optional house-rule bonuses
    let concealed_bonus = if house_rules.concealed_bonus_enabled && modifiers.concealed {
        (base_score as f32 * CONCEALED_BONUS_MULTIPLIER) as i32
    } else {
        0
    };

    let dealer_bonus = if house_rules.dealer_bonus_enabled && modifiers.dealer_win {
        (base_score as f32 * DEALER_BONUS_MULTIPLIER) as i32
    } else {
        0
    };

    // Self-draw bonus is applied via payment calculation, not as direct bonus
    let self_draw_bonus = 0;

    let total = base_score + concealed_bonus + self_draw_bonus + dealer_bonus;

    // Extract discarder from win context
    let discarder = match win_ctx.win_type {
        crate::flow::outcomes::WinType::CalledDiscard(seat) => Some(seat),
        crate::flow::outcomes::WinType::SelfDraw => None,
    };

    // Check if hand is jokerless (for NMJL 2x multiplier)
    let is_jokerless = !win_ctx.hand.concealed.iter().any(|t| t.is_joker())
        && !win_ctx
            .hand
            .exposed
            .iter()
            .any(|m| m.tiles.iter().any(|t| t.is_joker()));

    // NMJL Rule: Singles and Pairs category does not get jokerless bonus
    let is_singles_or_pairs = pattern_category.to_lowercase().contains("singles")
        || pattern_category.to_lowercase().contains("pairs");
    let apply_jokerless_bonus = is_jokerless && !is_singles_or_pairs;

    // Calculate payments from each losing player
    let payments = calculate_payments(
        win_ctx.winner,
        total,
        modifiers,
        current_dealer,
        discarder,
        apply_jokerless_bonus,
        house_rules,
    );

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
/// # NMJL Payment Rules
/// - Self-draw: all 3 losers pay 2x base
/// - Called discard: discarder pays 2x base, others pay 1x base
/// - Jokerless: multiply all payments by 2x (except Singles/Pairs)
///   - Self-draw jokerless: all pay 4x base (2x * 2x)
///   - Called jokerless: discarder pays 4x, others pay 2x
///
/// # Arguments
/// * `winner` - The winning player's seat
/// * `base_amount` - The base score amount (including house-rule bonuses if enabled)
/// * `modifiers` - Scoring modifiers
/// * `_current_dealer` - The current dealer seat (reserved for future rules)
/// * `discarder` - The seat of the player who discarded the winning tile (None for self-draw)
/// * `jokerless_bonus` - Whether to apply 2x jokerless multiplier
/// * `house_rules` - House rules configuration
///
/// # Returns
/// HashMap of seat -> payment amount (positive = pays to winner)
fn calculate_payments(
    winner: Seat,
    base_amount: i32,
    modifiers: &ScoreModifiers,
    _current_dealer: Seat,
    discarder: Option<Seat>,
    jokerless_bonus: bool,
    house_rules: &HouseRules,
) -> HashMap<Seat, i32> {
    let mut payments = HashMap::new();

    // For called discard wins
    if let Some(discarder_seat) = discarder {
        // NMJL: Discarder pays 2x base
        let mut discarder_payment = base_amount * 2;

        // NMJL: Jokerless multiplies by 2x (total 4x for discarder)
        if jokerless_bonus {
            discarder_payment *= 2;
        }

        // House rule: Dealer bonus (if enabled)
        if house_rules.dealer_bonus_enabled && modifiers.dealer_win {
            discarder_payment = (discarder_payment as f32 * 1.5) as i32;
        }

        payments.insert(discarder_seat, discarder_payment);

        // NMJL: Other players pay 1x base
        let all_seats = [Seat::East, Seat::South, Seat::West, Seat::North];
        for &seat in &all_seats {
            if seat == winner || seat == discarder_seat {
                continue;
            }

            let mut other_payment = base_amount;

            // NMJL: Jokerless multiplies by 2x
            if jokerless_bonus {
                other_payment *= 2;
            }

            // House rule: Dealer bonus (if enabled)
            if house_rules.dealer_bonus_enabled && modifiers.dealer_win {
                other_payment = (other_payment as f32 * 1.5) as i32;
            }

            payments.insert(seat, other_payment);
        }

        return payments;
    }

    // For self-draw, all losers pay double
    let all_seats = [Seat::East, Seat::South, Seat::West, Seat::North];

    for &seat in &all_seats {
        if seat == winner {
            continue; // Winner doesn't pay themselves
        }

        // NMJL: Self-draw means all losers pay 2x base
        let mut payment = base_amount * 2;

        // NMJL: Jokerless multiplies by 2x (total 4x for self-draw)
        if jokerless_bonus {
            payment *= 2;
        }

        // House rule: Dealer bonus (if enabled)
        if house_rules.dealer_bonus_enabled && modifiers.dealer_win {
            payment = (payment as f32 * 1.5) as i32;
        }

        payments.insert(seat, payment);
    }

    payments
}

/// Calculate the next dealer after a game ends.
///
/// # NMJL Rotation Rules
/// Per NMJL rules, dealer always rotates clockwise every game, regardless of who wins.
/// The rotation is: East → South → West → North → East
///
/// # Arguments
/// * `current_dealer` - The current dealer seat
/// * `_winner` - The winning seat (ignored per NMJL rules)
///
/// # Returns
/// The next dealer seat (always rotates clockwise)
///
/// # Examples
/// ```
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::calculate_next_dealer;
///
/// assert_eq!(calculate_next_dealer(Seat::East, None), Seat::South);
/// assert_eq!(calculate_next_dealer(Seat::East, Some(Seat::East)), Seat::South);
/// ```
pub fn calculate_next_dealer(current_dealer: Seat, _winner: Option<Seat>) -> Seat {
    // NMJL Rule: Dealer always rotates clockwise every game
    current_dealer.right()
}

/// Build a complete GameResult for a winning hand.
///
/// # Arguments
/// * `win_ctx` - The win context
/// * `pattern_name` - Name of the winning pattern from The Card
/// * `pattern_score` - Base score value from the pattern
/// * `pattern_category` - Pattern category (to check for Singles/Pairs)
/// * `all_hands` - Final hands of all players
/// * `current_dealer` - The current dealer seat
/// * `house_rules` - House rules configuration
///
/// # Returns
/// A complete GameResult with scores, payments, and dealer rotation
///
/// # Examples
/// ```
/// use mahjong_core::flow::outcomes::{WinContext, WinType};
/// use mahjong_core::hand::Hand;
/// use mahjong_core::player::Seat;
/// use mahjong_core::scoring::build_win_result;
/// use mahjong_core::tile::tiles::BAM_1;
/// use mahjong_core::table::HouseRules;
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
/// let house_rules = HouseRules::default();
/// let result = build_win_result(&win_ctx, "Test".to_string(), 25, "Test", all_hands, Seat::East, &house_rules);
/// assert_eq!(result.winner, Some(Seat::East));
/// ```
pub fn build_win_result(
    win_ctx: &WinContext,
    pattern_name: String,
    pattern_score: u16,
    pattern_category: &str,
    all_hands: HashMap<Seat, Hand>,
    current_dealer: Seat,
    house_rules: &HouseRules,
) -> GameResult {
    // Determine score modifiers
    let modifiers = ScoreModifiers {
        concealed: is_hand_concealed(&win_ctx.hand),
        self_draw: matches!(win_ctx.win_type, crate::flow::outcomes::WinType::SelfDraw),
        dealer_win: win_ctx.winner == current_dealer,
    };

    // Calculate score with NMJL rules
    let score_breakdown = calculate_score(
        win_ctx,
        &modifiers,
        current_dealer,
        pattern_score,
        pattern_category,
        house_rules,
    );

    // Calculate final scores (winner's total gain, losers' losses)
    let mut final_scores = HashMap::new();
    let mut winner_total = 0;

    for (&loser, &payment) in &score_breakdown.payments {
        final_scores.insert(loser, -payment); // Losers have negative scores
        winner_total += payment;
    }
    final_scores.insert(win_ctx.winner, winner_total); // Winner gets sum of all payments

    // NMJL Rule: Dealer always rotates clockwise every game
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
/// use mahjong_core::flow::outcomes::AbandonReason;
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
/// assert!(matches!(result.end_condition, mahjong_core::flow::outcomes::GameEndCondition::Abandoned(_)));
/// ```
pub fn build_abandon_result(
    all_hands: HashMap<Seat, Hand>,
    current_dealer: Seat,
    reason: crate::flow::outcomes::AbandonReason,
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
    use crate::flow::outcomes::{WinContext, WinType};
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

        let house_rules = HouseRules::default();
        let score = calculate_score(
            &win_ctx,
            &modifiers,
            Seat::East,
            25,
            "Test Pattern",
            &house_rules,
        );

        assert_eq!(score.base_score, 25);
        assert_eq!(score.concealed_bonus, 0); // House rule disabled
        assert_eq!(score.dealer_bonus, 0); // House rule disabled
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

        // Test with house rule enabled
        let mut house_rules = HouseRules::default();
        house_rules.concealed_bonus_enabled = true;

        let score = calculate_score(
            &win_ctx,
            &modifiers,
            Seat::East,
            25,
            "Test Pattern",
            &house_rules,
        );

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

        // Test with house rule enabled
        let mut house_rules = HouseRules::default();
        house_rules.dealer_bonus_enabled = true;

        let score = calculate_score(
            &win_ctx,
            &modifiers,
            Seat::East,
            25,
            "Test Pattern",
            &house_rules,
        );

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

        // Test with all house rules enabled
        let mut house_rules = HouseRules::default();
        house_rules.concealed_bonus_enabled = true;
        house_rules.dealer_bonus_enabled = true;

        let score = calculate_score(
            &win_ctx,
            &modifiers,
            Seat::East,
            25,
            "Test Pattern",
            &house_rules,
        );

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

        let house_rules = HouseRules::default();
        let payments = calculate_payments(
            Seat::East,
            25,
            &modifiers,
            Seat::East,
            None,
            false, // no jokerless bonus
            &house_rules,
        );

        // NMJL: Self-draw means all losers pay 2x base
        assert_eq!(payments.get(&Seat::South), Some(&50)); // 25 * 2
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

        // Test with dealer bonus house rule enabled
        let mut house_rules = HouseRules::default();
        house_rules.dealer_bonus_enabled = true;

        let payments = calculate_payments(
            Seat::East,
            25,
            &modifiers,
            Seat::East,
            None,
            false, // no jokerless bonus
            &house_rules,
        );

        // Self-draw (x2) + dealer bonus house rule (+50%) = x3
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

        let house_rules = HouseRules::default();

        // East wins on South's discard
        let payments = calculate_payments(
            Seat::East,
            25,
            &modifiers,
            Seat::East,
            Some(Seat::South),
            false, // no jokerless bonus
            &house_rules,
        );

        // NMJL: Discarder pays 2x, others pay 1x
        assert_eq!(payments.get(&Seat::South), Some(&50)); // 25 * 2
        assert_eq!(payments.get(&Seat::West), Some(&25)); // 25 * 1
        assert_eq!(payments.get(&Seat::North), Some(&25)); // 25 * 1
        assert_eq!(payments.get(&Seat::East), None); // Winner doesn't pay
        assert_eq!(payments.len(), 3); // All three losers pay
    }

    #[test]
    fn test_calculate_payments_called_discard_dealer_win() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: true, // Winner is dealer
        };

        // Test with dealer bonus house rule enabled
        let mut house_rules = HouseRules::default();
        house_rules.dealer_bonus_enabled = true;

        // East (dealer) wins on West's discard
        let payments = calculate_payments(
            Seat::East,
            25,
            &modifiers,
            Seat::East,
            Some(Seat::West),
            false, // no jokerless bonus
            &house_rules,
        );

        // NMJL: Discarder pays 2x, others pay 1x, plus dealer bonus house rule (+50%)
        assert_eq!(payments.get(&Seat::West), Some(&75)); // 25 * 2 * 1.5 = 75
        assert_eq!(payments.get(&Seat::South), Some(&37)); // 25 * 1 * 1.5 = 37.5 -> 37
        assert_eq!(payments.get(&Seat::North), Some(&37)); // 25 * 1 * 1.5 = 37.5 -> 37
        assert_eq!(payments.len(), 3);
    }

    #[test]
    fn test_calculate_payments_called_discard_non_dealer_wins() {
        let modifiers = ScoreModifiers {
            concealed: false,
            self_draw: false,
            dealer_win: false,
        };

        let house_rules = HouseRules::default();

        // South wins on North's discard (East is dealer)
        let payments = calculate_payments(
            Seat::South,
            25,
            &modifiers,
            Seat::East,
            Some(Seat::North),
            false, // no jokerless bonus
            &house_rules,
        );

        // NMJL: Discarder pays 2x, others pay 1x
        assert_eq!(payments.get(&Seat::North), Some(&50)); // 25 * 2
        assert_eq!(payments.get(&Seat::East), Some(&25)); // 25 * 1
        assert_eq!(payments.get(&Seat::West), Some(&25)); // 25 * 1
        assert_eq!(payments.get(&Seat::South), None); // Winner doesn't pay
        assert_eq!(payments.len(), 3);
    }
    #[test]
    fn test_calculate_next_dealer_winner_is_dealer() {
        let next = calculate_next_dealer(Seat::East, Some(Seat::East));
        // NMJL: Dealer always rotates, even when dealer wins
        assert_eq!(next, Seat::South);
    }

    #[test]
    fn test_calculate_next_dealer_winner_not_dealer() {
        let next = calculate_next_dealer(Seat::East, Some(Seat::South));
        // NMJL: Dealer always rotates clockwise
        assert_eq!(next, Seat::South);
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

        let house_rules = HouseRules::default();

        let result = build_win_result(
            &win_ctx,
            "2468 Consecutive Run".to_string(),
            25,
            "2468",
            all_hands,
            Seat::East,
            &house_rules,
        );

        assert_eq!(result.winner, Some(Seat::East));
        assert_eq!(
            result.winning_pattern,
            Some("2468 Consecutive Run".to_string())
        );
        // NMJL: Dealer always rotates, even when dealer wins
        assert_eq!(result.next_dealer, Seat::South);
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
