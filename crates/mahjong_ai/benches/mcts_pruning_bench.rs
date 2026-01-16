//! Benchmarks comparing MCTS performance with and without heuristic pruning.

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::r#trait::MahjongAI;
use mahjong_ai::strategies::mcts_ai::MCTSAI;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;

fn load_card() -> UnifiedCard {
    let json = std::fs::read_to_string("data/cards/unified_card2025.json").expect("Load card");
    UnifiedCard::from_json(&json).expect("Parse card")
}

/// Benchmark MCTS with pruning disabled (baseline).
fn bench_mcts_no_pruning(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    // Complex hand with many options (11 unique tiles)
    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
        JOKER,
    ]);

    let mut ai = MCTSAI::new(1000, 42);
    ai.engine_mut().enable_pruning = false;

    c.bench_function("mcts_no_pruning_11_tiles", |b| {
        b.iter(|| ai.select_discard(black_box(&hand), black_box(&visible), black_box(&validator)))
    });
}

/// Benchmark MCTS with pruning enabled at different max_children values.
fn bench_mcts_with_pruning(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
        JOKER,
    ]);

    let mut group = c.benchmark_group("mcts_pruning_comparison");

    for max_children in [3, 5, 8, 10].iter() {
        let mut ai = MCTSAI::new(1000, 42);
        ai.engine_mut().enable_pruning = true;
        ai.engine_mut().max_children = *max_children;

        group.bench_with_input(
            BenchmarkId::new("pruned", max_children),
            max_children,
            |b, _| {
                b.iter(|| {
                    ai.select_discard(black_box(&hand), black_box(&visible), black_box(&validator))
                })
            },
        );
    }

    group.finish();
}

/// Benchmark the overhead of the scoring function itself.
fn bench_pruning_scoring_overhead(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    let hand = Hand::new(vec![
        BAM_1, BAM_2, BAM_3, BAM_4, BAM_5, CRAK_1, CRAK_2, CRAK_3, DOT_1, DOT_2, DOT_3, JOKER,
        JOKER,
    ]);

    // Just run one iteration to see scoring overhead
    let mut ai = MCTSAI::new(50, 42);
    ai.engine_mut().enable_pruning = true;
    ai.engine_mut().max_children = 5;

    c.bench_function("pruning_scoring_overhead_50_iters", |b| {
        b.iter(|| ai.select_discard(black_box(&hand), black_box(&visible), black_box(&validator)))
    });
}

/// Benchmark on a simpler hand (fewer tiles to test scaling).
fn bench_simple_hand_comparison(c: &mut Criterion) {
    let card = load_card();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    // Simpler hand with 6 unique tiles
    let hand = Hand::new(vec![BAM_1, BAM_2, BAM_3, CRAK_1, CRAK_2, CRAK_3, JOKER]);

    let mut group = c.benchmark_group("simple_hand_6_tiles");

    // No pruning
    let mut ai_no_prune = MCTSAI::new(1000, 42);
    ai_no_prune.engine_mut().enable_pruning = false;
    group.bench_function("no_pruning", |b| {
        b.iter(|| {
            ai_no_prune.select_discard(black_box(&hand), black_box(&visible), black_box(&validator))
        })
    });

    // With pruning (max 5)
    let mut ai_pruned = MCTSAI::new(1000, 42);
    ai_pruned.engine_mut().enable_pruning = true;
    ai_pruned.engine_mut().max_children = 5;
    group.bench_function("pruned_max_5", |b| {
        b.iter(|| {
            ai_pruned.select_discard(black_box(&hand), black_box(&visible), black_box(&validator))
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_mcts_no_pruning,
    bench_mcts_with_pruning,
    bench_pruning_scoring_overhead,
    bench_simple_hand_comparison
);
criterion_main!(benches);
