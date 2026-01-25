use mahjong_ai::context::VisibleTiles;
use mahjong_core::hand::Hand;
use mahjong_core::hint::HintVerbosity;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_server::analysis::HandAnalysis;
use mahjong_server::hint::HintComposer;

#[test]
fn test_hint_composer_builds_hint_data() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);

    let visible = VisibleTiles::new();
    let analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r, &hand, &visible, target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Beginner,
        None,
    );

    assert!(hint.recommended_discard.is_some());
    assert!(hint.discard_reason.is_some());
}

#[test]
fn test_hint_composer_intermediate_verbosity() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);

    let visible = VisibleTiles::new();
    let analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r, &hand, &visible, target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Intermediate,
        None,
    );

    assert!(hint.recommended_discard.is_some());
    assert!(hint.discard_reason.is_some());
    assert!(
        !hint.best_patterns.is_empty(),
        "Intermediate should include pattern details for AI comparison"
    );
}

#[test]
fn test_hint_composer_expert_verbosity() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);

    let visible = VisibleTiles::new();
    let analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r, &hand, &visible, target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Expert,
        None,
    );

    assert!(hint.recommended_discard.is_some());
    assert!(
        hint.discard_reason.is_none(),
        "Expert should not include text reasoning"
    );
    assert!(
        !hint.best_patterns.is_empty(),
        "Expert should include pattern details for AI comparison"
    );
}

#[test]
fn test_hint_composer_disabled() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);

    let visible = VisibleTiles::new();
    let analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r, &hand, &visible, target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Disabled,
        None,
    );

    assert!(
        hint.is_empty(),
        "Disabled verbosity should return empty hint"
    );
}

#[test]
fn test_hint_composer_empty_when_no_viable_patterns() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);
    let visible = VisibleTiles::new();
    let analysis = HandAnalysis::from_evaluations(Vec::new());

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Beginner,
        None,
    );

    assert!(
        hint.is_empty(),
        "No viable patterns should return empty hint"
    );
    assert!(hint.recommended_discard.is_none());
}

#[test]
fn test_hint_composer_tiles_needed_only_when_close() {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);
    let visible = VisibleTiles::new();
    let mut analysis = {
        let results = validator.analyze(&hand, 5);
        let evaluations = results
            .into_iter()
            .filter_map(|r| {
                let target = validator.histogram_for_variation(&r.variation_id)?;
                Some(mahjong_ai::evaluation::StrategicEvaluation::from_analysis(
                    r, &hand, &visible, target,
                ))
            })
            .collect();
        HandAnalysis::from_evaluations(evaluations)
    };

    analysis.distance_to_win = 3;

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        HintVerbosity::Beginner,
        None,
    );

    assert!(
        hint.tiles_needed_for_win.is_empty(),
        "Tiles needed should be empty when distance_to_win > 2"
    );
}
