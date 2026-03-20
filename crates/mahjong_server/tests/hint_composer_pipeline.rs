use mahjong_ai::context::VisibleTiles;
use mahjong_core::flow::charleston::CharlestonStage;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_server::analysis::HandAnalysis;
use mahjong_server::hint::HintComposer;

fn build_analysis_fixture() -> (HandValidator, Hand, VisibleTiles, HandAnalysis) {
    let card_json = mahjong_server::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).expect("Failed to parse card");
    let validator = HandValidator::new(&card);

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_1, DOT_2, DOT_3, EAST, JOKER,
    ]);
    let visible = VisibleTiles::new();
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

    (
        validator,
        hand,
        visible,
        HandAnalysis::from_evaluations(evaluations),
    )
}

#[test]
fn test_hint_composer_returns_combined_payload_when_enabled() {
    let (validator, hand, visible, analysis) = build_analysis_fixture();

    let hint = HintComposer::compose(&analysis, &hand, &visible, &validator, None, None);

    assert!(hint.recommended_discard.is_some());
    assert!(hint.discard_reason.is_some());
    assert!(
        !hint.best_patterns.is_empty(),
        "enabled hints should include pattern guidance"
    );
    assert!(
        !hint.tile_scores.is_empty(),
        "enabled hints should include tile scores"
    );
    assert!(
        !hint.utility_scores.is_empty(),
        "enabled hints should include utility scores"
    );
}

#[test]
fn test_hint_composer_returns_empty_when_no_viable_patterns() {
    let (validator, hand, visible, _) = build_analysis_fixture();
    let analysis = HandAnalysis::from_evaluations(Vec::new());

    let hint = HintComposer::compose(&analysis, &hand, &visible, &validator, None, None);

    assert!(
        hint.is_empty(),
        "no viable patterns should return an empty hint"
    );
    assert!(hint.recommended_discard.is_none());
}

#[test]
fn test_hint_composer_tiles_needed_only_when_close() {
    let (validator, hand, visible, mut analysis) = build_analysis_fixture();
    analysis.distance_to_win = 3;

    let hint = HintComposer::compose(&analysis, &hand, &visible, &validator, None, None);

    assert!(
        hint.tiles_needed_for_win.is_empty(),
        "tiles needed should be empty when distance_to_win > 2"
    );
}

#[test]
fn test_hint_composer_includes_charleston_recommendations_and_scores() {
    let (validator, hand, visible, analysis) = build_analysis_fixture();

    let hint = HintComposer::compose(
        &analysis,
        &hand,
        &visible,
        &validator,
        None,
        Some(CharlestonStage::FirstRight),
    );

    assert_eq!(hint.charleston_pass_recommendations.len(), 3);
    assert!(
        !hint.best_patterns.is_empty(),
        "charleston hints should still include pattern guidance"
    );
    assert!(
        !hint.tile_scores.is_empty(),
        "charleston hints should still include tile scores"
    );
}
