//! Criterion benchmarks for hint advisor scoring and defense logic.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::hint::{HintAdvisor, HintVerbosity};
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

/// Benchmarks discard recommendation scoring for a fixed hand state.
fn bench_hint_advisor(c: &mut Criterion) {
    let card_json = mahjong_ai::test_utils::load_test_card_json();
    let card = UnifiedCard::from_json(card_json).unwrap();
    let validator = HandValidator::new(&card);
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_1, DOT_2, DOT_4, DOT_6, EAST, EAST, JOKER, JOKER, JOKER,
    ]);
    let visible = VisibleTiles::new();

    c.bench_function("hint_advisor_discard", |b| {
        b.iter(|| {
            HintAdvisor::recommend_discard(
                black_box(&hand),
                black_box(&visible),
                black_box(&validator),
                black_box(HintVerbosity::Intermediate),
            )
        })
    });
}

/// Benchmarks defensive tile evaluation with a visible discard history.
fn bench_hint_advisor_defense(c: &mut Criterion) {
    let mut visible = VisibleTiles::new();
    visible.add_discard(BAM_1);
    visible.add_discard(BAM_1);
    visible.add_discard(BAM_1);

    c.bench_function("hint_advisor_defense", |b| {
        b.iter(|| HintAdvisor::evaluate_defense(black_box(BAM_7), black_box(&visible)))
    });
}

criterion_group!(benches, bench_hint_advisor, bench_hint_advisor_defense);
criterion_main!(benches);
