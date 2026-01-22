use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use mahjong_ai::context::VisibleTiles;
use mahjong_ai::evaluation::StrategicEvaluation;
use mahjong_core::hand::Hand;
use mahjong_core::rules::card::UnifiedCard;
use mahjong_core::rules::validator::HandValidator;
use mahjong_core::tile::tiles::*;
use mahjong_core::tile::Tile;
use rand::seq::SliceRandom;
use rand::SeedableRng;

fn create_random_hand(rng: &mut impl rand::Rng) -> Hand {
    let all_tiles: Vec<Tile> = (0..34)
        .flat_map(|i| std::iter::repeat(Tile(i)).take(4))
        .chain(std::iter::repeat(JOKER).take(8))
        .collect();

    let tiles: Vec<Tile> = all_tiles.choose_multiple(rng, 13).cloned().collect();

    Hand::new(tiles)
}

fn benchmark_1000_hands_analysis(c: &mut Criterion) {
    let mut rng = rand::rngs::StdRng::seed_from_u64(42);
    let card =
        UnifiedCard::from_json(include_str!("../../../data/cards/unified_card2025.json")).unwrap();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();

    // Pre-generate 1000 hands to avoid benchmarking RNG
    let hands: Vec<Hand> = (0..1000).map(|_| create_random_hand(&mut rng)).collect();

    let mut group = c.benchmark_group("1000_hands_analysis");
    group.sample_size(10);
    group.measurement_time(std::time::Duration::from_secs(30));

    group.bench_function("analyze_1000_hands", |b| {
        b.iter(|| {
            for hand in &hands {
                let analysis_results = validator.analyze(black_box(hand), 500);

                for result in analysis_results {
                    if let Some(target_histogram) =
                        validator.histogram_for_variation(&result.variation_id)
                    {
                        let _ = StrategicEvaluation::from_analysis(
                            result,
                            hand,
                            &visible,
                            target_histogram,
                        );
                    }
                }
            }
        })
    });
    group.finish();
}

fn benchmark_single_hand_scaling(c: &mut Criterion) {
    let mut rng = rand::rngs::StdRng::seed_from_u64(123);
    let card =
        UnifiedCard::from_json(include_str!("../../../data/cards/unified_card2025.json")).unwrap();
    let validator = HandValidator::new(&card);
    let visible = VisibleTiles::new();
    let hand = create_random_hand(&mut rng);

    let mut group = c.benchmark_group("single_hand_scaling");
    for max_patterns in [50, 100, 200, 500].iter() {
        group.bench_with_input(
            BenchmarkId::from_parameter(max_patterns),
            max_patterns,
            |b, &max| {
                b.iter(|| {
                    let analysis_results = validator.analyze(black_box(&hand), max);
                    for result in analysis_results {
                        if let Some(target_histogram) =
                            validator.histogram_for_variation(&result.variation_id)
                        {
                            let _ = StrategicEvaluation::from_analysis(
                                result,
                                &hand,
                                &visible,
                                target_histogram,
                            );
                        }
                    }
                });
            },
        );
    }
    group.finish();
}

criterion_group!(
    benches,
    benchmark_1000_hands_analysis,
    benchmark_single_hand_scaling
);
criterion_main!(benches);
