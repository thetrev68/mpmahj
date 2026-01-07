use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::{tiles::*, Tile};
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
    let entry = validator.histogram_for_variation(pattern_id);

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

    let hand = Hand::new(vec![]);

    // Case 1: Pair (Strict)
    // Target: 2x 1Bam. Ineligible: 2x 1Bam.
    // Hand: 1x 1Bam, 1x Joker.
    // Result: Deficiency 1.

    let mut target = vec![0u8; 37];
    target[BAM_1.0 as usize] = 2;

    let mut ineligible = vec![0u8; 37];
    ineligible[BAM_1.0 as usize] = 2; // Strict Pair

    let mut hand_with_joker = Hand::new(vec![BAM_1, JOKER]);

    let def = hand_with_joker.calculate_deficiency(&target, &ineligible);
    assert_eq!(def, 1, "Joker should NOT fill strict pair");

    // Case 2: Pung (Flexible)
    // Target: 3x 1Bam. Ineligible: 0.
    // Hand: 1x 1Bam, 2x Joker.
    // Result: Deficiency 0.

    let mut target_pung = vec![0u8; 37];
    target_pung[BAM_1.0 as usize] = 3;
    let ineligible_pung = vec![0u8; 37]; // All 0

    let mut hand_pung = Hand::new(vec![BAM_1, JOKER, JOKER]);
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

    let mut hand_mixed = Hand::new(vec![BAM_1, JOKER, BAM_2, BAM_2, BAM_2]);
    let def_mixed = hand_mixed.calculate_deficiency(&target_mixed, &ineligible_mixed);
    assert_eq!(def_mixed, 1, "Joker cannot fill strict pair in mixed hand");

    // Case 4: Mixed Success
    // Hand: 2x 1Bam, 2x 2Bam, 1x Joker.
    // Joker fills 2Bam pung. Success.
    let mut hand_mixed_good = Hand::new(vec![BAM_1, BAM_1, BAM_2, BAM_2, JOKER]);
    let def_mixed_good = hand_mixed_good.calculate_deficiency(&target_mixed, &ineligible_mixed);
    assert_eq!(
        def_mixed_good, 0,
        "Joker CAN fill flexible pung in mixed hand"
    );
}
