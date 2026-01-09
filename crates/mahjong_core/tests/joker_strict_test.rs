use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_core::tile::Tile;
use std::fs;

#[test]
fn test_strict_joker_rules_pairs() {
    // Load the real card to get actual strict definitions
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    let validator = HandValidator::new(&card);

    // Find a pattern with pairs (e.g., any 22 44 66 88 pattern)
    // Or simpler: "2025" section where "2025" are singles (Strict)

    // Let's look for "2025-2025-1-1" which has "FFFF 2025 222 222"
    // FFFF (Flowers) -> Strict (No Jokers)
    // 2025 (Singles) -> Strict (No Jokers)
    // 222 (Pungs) -> Flexible (Jokers OK)

    // Hand: FFFF 2025 222 22J
    // Naturals: 4 Flowers, 2, 0 (White), 2, 5, 3x 2Bam, 2x 2Crak
    // Joker: 1
    // Missing: 1x 2Crak (replaced by Joker) -> OK

    // Hand 2: FFFJ 2025 222 222
    // Missing: 1 Flower (replaced by Joker) -> FAIL (Flowers are strict)

    let pattern_id = "2025-2025-1-1-SEQ1";
    let _entry = validator.histogram_for_variation(pattern_id);

    // We can't easily access the entry directly via public API of validator to check ineligible,
    // but we can check the validation result.

    // Construct Hand 1: Valid Joker usage (in Pung)
    // FFFF (4x Flower)
    // 2 (2 Bam), 0 (White), 2 (2 Crak), 5 (5 Dot) - adjusting suits to match SEQ1
    // SEQ1: 2s and 5s.
    // Let's assume SEQ1 is "2 Bam, White, 2 Bam, 5 Bam" for 2025?
    // Need to check the specific tile requirements of SEQ1.
    // We can print the histogram or just use the validator to find it.

    // Instead of guessing the exact tiles of SEQ1, let's test the mechanism directly
    // by creating a synthetic test case if we can access the calculate_deficiency method.
    // But Hand::calculate_deficiency is what we want to test.

    let _hand = Hand::new(vec![]);

    // Case 1: Pair (Strict)
    // Target: 2x 1Bam. Ineligible: 2x 1Bam.
    // Hand: 1x 1Bam, 1x Joker.
    // Result: Deficiency 1.

    let mut target = vec![0u8; 37];
    target[BAM_1.0 as usize] = 2;

    let mut ineligible = vec![0u8; 37];
    ineligible[BAM_1.0 as usize] = 2; // Strict Pair

    let hand_with_joker = Hand::new(vec![BAM_1, JOKER]);

    let def = hand_with_joker.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 1, "Joker should NOT fill strict pair");

    // Case 2: Pung (Flexible)
    // Target: 3x 1Bam. Ineligible: 0.
    // Hand: 1x 1Bam, 2x Joker.
    // Result: Deficiency 0.

    let mut target_pung = vec![0u8; 37];
    target_pung[BAM_1.0 as usize] = 3;
    let ineligible_pung = vec![0u8; 37]; // All 0

    let hand_pung = Hand::new(vec![BAM_1, JOKER, JOKER]);
    let def_pung = hand_pung.calculate_deficiency(&target_pung, &ineligible_pung);
    assert_eq!(def_pung, 0, "Jokers SHOULD fill flexible pung");

    // Case 3: Mixed
    // Target: 2x 1Bam (Strict), 3x 2Bam (Flexible)
    // Hand: 1x 1Bam, 1x Joker, 3x 2Bam.
    // Joker tries to fill 1Bam. Fail.

    let mut target_mixed = vec![0u8; 37];
    target_mixed[BAM_1.0 as usize] = 2;
    target_mixed[BAM_2.0 as usize] = 3;

    let mut ineligible_mixed = vec![0u8; 37];
    ineligible_mixed[BAM_1.0 as usize] = 2; // Strict 1Bam

    let hand_mixed = Hand::new(vec![BAM_1, JOKER, BAM_2, BAM_2, BAM_2]);
    let def_mixed = hand_mixed.calculate_deficiency(&target_mixed, &ineligible_mixed);
    assert_eq!(def_mixed, 1, "Joker cannot fill strict pair in mixed hand");

    // Case 4: Mixed Success
    // Hand: 2x 1Bam, 2x 2Bam, 1x Joker.
    // Joker fills 2Bam pung. Success.
    let hand_mixed_good = Hand::new(vec![BAM_1, BAM_1, BAM_2, BAM_2, JOKER]);
    let def_mixed_good = hand_mixed_good.calculate_deficiency(&target_mixed, &ineligible_mixed);
    assert_eq!(
        def_mixed_good, 0,
        "Joker CAN fill flexible pung in mixed hand"
    );
}

#[test]
fn test_joker_not_allowed_for_flowers() {
    let mut target = vec![0u8; 37];
    target[FLOWER.0 as usize] = 1;

    let mut ineligible = vec![0u8; 37];
    ineligible[FLOWER.0 as usize] = 1;

    let hand_with_joker = Hand::new(vec![JOKER]);
    let def = hand_with_joker.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 1, "Joker should NOT fill a flower requirement");

    let hand_with_flower = Hand::new(vec![FLOWER]);
    let def_flower = hand_with_flower.calculate_deficiency(&target, &ineligible);
    assert_eq!(
        def_flower, 0,
        "Natural flower should satisfy flower requirement"
    );
}

#[test]
fn test_exposed_meld_with_jokers() {
    use mahjong_core::meld::{Meld, MeldType};

    // Pattern: 11 333 5555 (where 333 and 5555 can have jokers, but 11 cannot)
    let mut target = vec![0u8; 37];
    target[BAM_1.0 as usize] = 2; // Pair (strict)
    target[BAM_3.0 as usize] = 3; // Pung (flexible)
    target[BAM_5.0 as usize] = 4; // Kong (flexible)

    let mut ineligible = vec![0u8; 37];
    ineligible[BAM_1.0 as usize] = 2; // Pair must be natural

    // Test 1: Ensure that jokers used in exposed melds don't affect concealed validation
    // Create hand: Concealed [1B, 1B, 5B, 5B, 5B, 5B], no exposed
    let hand_all_concealed = Hand::new(vec![BAM_1, BAM_1, BAM_5, BAM_5, BAM_5, BAM_5]);
    let def = hand_all_concealed.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 3, "Missing pung of 3B");

    // Now with jokers in concealed: [1B, 1B, J, J, 5B, 5B, 5B, 5B]
    let hand_with_jokers = Hand::new(vec![BAM_1, BAM_1, JOKER, JOKER, BAM_5, BAM_5, BAM_5, BAM_5]);
    let def_jokers = hand_with_jokers.calculate_deficiency(&target, &ineligible);
    assert_eq!(
        def_jokers, 1,
        "2 jokers fill pung (3B), missing 1 natural for pair"
    );

    // Edge case: Try to use joker in the pair (should fail)
    // Hand: [1B, J, 3B, 3B, 3B, 5B, 5B, 5B, 5B]
    let hand_joker_in_pair = Hand::new(vec![
        BAM_1, JOKER, BAM_3, BAM_3, BAM_3, BAM_5, BAM_5, BAM_5, BAM_5,
    ]);
    let def_bad = hand_joker_in_pair.calculate_deficiency(&target, &ineligible);
    assert_eq!(
        def_bad, 1,
        "Joker cannot fill strict pair, deficiency remains 1"
    );

    // Valid hand: All naturals
    let hand_valid = Hand::new(vec![
        BAM_1, BAM_1, BAM_3, BAM_3, BAM_3, BAM_5, BAM_5, BAM_5, BAM_5,
    ]);
    let def_valid = hand_valid.calculate_deficiency(&target, &ineligible);
    assert_eq!(def_valid, 0, "All naturals, perfect match");

    // Test 2: Test with exposed meld properly
    // When a meld is exposed, those tiles are removed from concealed
    let mut hand_with_exposed = Hand::new(vec![BAM_1, BAM_1, BAM_5, BAM_5, BAM_5, BAM_5]);

    // Expose a pung of 3B with 2 jokers - tiles are already not in concealed
    // So hand state is: concealed [1B, 1B, 5B, 5B, 5B, 5B], exposed [3B, J, J]
    let exposed_meld =
        Meld::new(MeldType::Pung, vec![BAM_3, JOKER, JOKER], None).expect("Valid meld");
    hand_with_exposed.exposed.push(exposed_meld);

    // Target for validation: The full hand pattern (all 9 tiles)
    // But hand validation only checks concealed + exposed tile counts
    // Actually, calculate_deficiency only looks at hand.counts (concealed histogram)

    // The key insight: When melds are exposed, validation should account for them
    // But Hand::counts only includes concealed tiles
    // So we need a different target histogram that excludes the exposed meld

    // Target for concealed portion: 11 5555 (missing the 333)
    let mut target_remaining = vec![0u8; 37];
    target_remaining[BAM_1.0 as usize] = 2; // Pair (strict)
    target_remaining[BAM_5.0 as usize] = 4; // Kong (flexible)

    let mut ineligible_remaining = vec![0u8; 37];
    ineligible_remaining[BAM_1.0 as usize] = 2; // Pair must be natural

    let def_exposed =
        hand_with_exposed.calculate_deficiency(&target_remaining, &ineligible_remaining);
    assert_eq!(def_exposed, 0, "Concealed tiles match remaining pattern");
}

#[test]
fn test_edge_case_all_jokers() {
    // Edge case: Maximum jokers in hand
    // Pattern: 333 5555 (no pairs, all flexible)
    let mut target = vec![0u8; 37];
    target[BAM_3.0 as usize] = 3; // Pung (flexible)
    target[BAM_5.0 as usize] = 4; // Kong (flexible)

    let ineligible = vec![0u8; 37]; // All flexible

    // Hand with 7 jokers (maximum conceivable)
    let hand_all_jokers = Hand::new(vec![JOKER, JOKER, JOKER, JOKER, JOKER, JOKER, JOKER]);
    let def = hand_all_jokers.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 0, "7 jokers can fill 7-tile pattern (all flexible)");

    // Hand with 8 jokers but pattern only needs 7
    let hand_extra_jokers = Hand::new(vec![JOKER, JOKER, JOKER, JOKER, JOKER, JOKER, JOKER, JOKER]);
    let def_extra = hand_extra_jokers.calculate_deficiency(&target, &ineligible);
    assert_eq!(def_extra, 0, "Extra jokers don't hurt, still win");
}

#[test]
fn test_edge_case_zero_jokers() {
    // Edge case: No jokers, all naturals
    // Pattern: 11 333 5555
    let mut target = vec![0u8; 37];
    target[BAM_1.0 as usize] = 2;
    target[BAM_3.0 as usize] = 3;
    target[BAM_5.0 as usize] = 4;

    let mut ineligible = vec![0u8; 37];
    ineligible[BAM_1.0 as usize] = 2; // Pair strict

    // Perfect natural hand
    let hand_naturals = Hand::new(vec![
        BAM_1, BAM_1, BAM_3, BAM_3, BAM_3, BAM_5, BAM_5, BAM_5, BAM_5,
    ]);
    let def = hand_naturals.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 0, "All naturals form valid hand");

    // Missing one natural
    let hand_short = Hand::new(vec![BAM_1, BAM_1, BAM_3, BAM_3, BAM_3, BAM_5, BAM_5, BAM_5]);
    let def_short = hand_short.calculate_deficiency(&target, &ineligible);
    assert_eq!(def_short, 1, "Missing 1 tile, deficiency = 1");
}

#[test]
fn test_edge_case_mixed_exposed_concealed() {
    use mahjong_core::meld::{Meld, MeldType};

    // Complex scenario: Multiple exposed melds with jokers
    // Full pattern: FF 11 333 5555 (14 tiles)
    // Expose: 333 (with 2 jokers), 5555 (with 1 joker)
    // Concealed: FF 11

    // Target for concealed portion only
    let mut target = vec![0u8; 37];
    target[FLOWER.0 as usize] = 2;
    target[BAM_1.0 as usize] = 2;

    let mut ineligible = vec![0u8; 37];
    ineligible[FLOWER.0 as usize] = 2; // Flowers strict
    ineligible[BAM_1.0 as usize] = 2; // Pair strict

    let mut hand = Hand::new(vec![FLOWER, FLOWER, BAM_1, BAM_1]);

    // Expose pung with jokers
    let meld1 = Meld::new(MeldType::Pung, vec![BAM_3, JOKER, JOKER], None).expect("Valid meld");
    hand.exposed.push(meld1);

    // Expose kong with joker
    let meld2 =
        Meld::new(MeldType::Kong, vec![BAM_5, BAM_5, BAM_5, JOKER], None).expect("Valid meld");
    hand.exposed.push(meld2);

    let def = hand.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 0, "Concealed naturals satisfy strict requirements");
}

#[test]
fn test_edge_case_all_singles() {
    // Pattern with all singles (no jokers allowed anywhere)
    // Example: F 1 2 3 4 5 6 7 8 9 D D D D (13 singles + 1 for 14)
    let mut target = vec![0u8; 37];
    let mut ineligible = vec![0u8; 37];

    // 10 different singles
    for i in 0..10 {
        target[i] = 1;
        ineligible[i] = 1; // All strict
    }

    // Hand with 9 naturals + 1 joker
    let mut tiles = vec![];
    for i in 0..9 {
        tiles.push(Tile(i as u8));
    }
    tiles.push(JOKER);

    let hand = Hand::new(tiles);
    let def = hand.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 1, "Joker cannot fill singles, missing 1 natural");

    // Hand with all 10 naturals
    let mut tiles_natural = vec![];
    for i in 0..10 {
        tiles_natural.push(Tile(i as u8));
    }

    let hand_natural = Hand::new(tiles_natural);
    let def_natural = hand_natural.calculate_deficiency(&target, &ineligible);
    assert_eq!(def_natural, 0, "All naturals satisfy singles pattern");
}

#[test]
fn test_edge_case_partial_strict() {
    // Pattern: 1 22 333 (1 single, 1 pair, 1 pung)
    // Jokers can only help with the pung
    let mut target = vec![0u8; 37];
    target[BAM_1.0 as usize] = 1; // Single (strict)
    target[BAM_2.0 as usize] = 2; // Pair (strict)
    target[BAM_3.0 as usize] = 3; // Pung (flexible)

    let mut ineligible = vec![0u8; 37];
    ineligible[BAM_1.0 as usize] = 1;
    ineligible[BAM_2.0 as usize] = 2;

    // Hand: [1B, 2B, 2B, J, J, J] - 3 jokers fill pung
    let hand = Hand::new(vec![BAM_1, BAM_2, BAM_2, JOKER, JOKER, JOKER]);
    let def = hand.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 0, "Naturals fill strict, jokers fill pung");

    // Hand: [1B, 2B, J, J, J, J] - 1 joker tries pair (fails)
    let hand_bad = Hand::new(vec![BAM_1, BAM_2, JOKER, JOKER, JOKER, JOKER]);
    let def_bad = hand_bad.calculate_deficiency(&target, &ineligible);
    assert_eq!(def_bad, 1, "Joker cannot fill pair, missing 1 natural 2B");

    // Hand: [J, 2B, 2B, J, J, J] - 1 joker tries single (fails)
    let hand_bad2 = Hand::new(vec![JOKER, BAM_2, BAM_2, JOKER, JOKER, JOKER]);
    let def_bad2 = hand_bad2.calculate_deficiency(&target, &ineligible);
    assert_eq!(
        def_bad2, 1,
        "Joker cannot fill single, missing 1 natural 1B"
    );
}
