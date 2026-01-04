//! Performance benchmarks for AI decision-making.

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use mahjong_ai::{create_ai, Difficulty, VisibleTiles};
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

fn load_card() -> UnifiedCard {
    let json =
        std::fs::read_to_string("../../data/cards/unified_card2025.json").expect("Load card");
    UnifiedCard::from_json(&json).expect("Parse card")
}

fn benchmark_discard_greedy(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let mut ai = create_ai(Difficulty::Medium, 42);
    let visible = VisibleTiles::new();

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
        DOT_9,
    ]);

    c.bench_function("discard_greedy_medium", |b| {
        b.iter(|| ai.select_discard(black_box(&hand), black_box(&visible), black_box(&validator)))
    });
}

fn benchmark_discard_mcts_hard(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let mut ai = create_ai(Difficulty::Hard, 42);
    let visible = VisibleTiles::new();

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, CRAK_2, CRAK_2, CRAK_2, JOKER, EAST, BAM_5, BAM_5, GREEN, WEST, NORTH,
        DOT_9,
    ]);

    c.bench_function("discard_mcts_hard_1k", |b| {
        b.iter(|| ai.select_discard(black_box(&hand), black_box(&visible), black_box(&validator)))
    });
}

criterion_group!(
    benches,
    benchmark_discard_greedy,
    benchmark_discard_mcts_hard
);
criterion_main!(benches);
