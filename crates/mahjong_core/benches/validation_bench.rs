//! Performance benchmarks for the histogram-based validation system.
//!
//! These benchmarks verify the claim from the refactor plan:
//! "Benchmark 1,000 hand evaluations to ensure sub-millisecond latency."

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use mahjong_core::{
    hand::Hand,
    rules::{card::UnifiedCard, validator::HandValidator},
    tile::Tile,
};
use std::fs;

/// Load the card data and build a validator for benchmarks.
fn load_validator() -> HandValidator {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");
    HandValidator::new(&card)
}

/// Construct a known-winning hand for validation benchmarks.
fn create_winning_hand() -> Hand {
    // Pattern: 11 333 5555 777 99 (Bams) - from unified card
    Hand::new(vec![
        Tile(0),
        Tile(0), // 1 Bam x2
        Tile(2),
        Tile(2),
        Tile(2), // 3 Bam x3
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4), // 5 Bam x4
        Tile(6),
        Tile(6),
        Tile(6), // 7 Bam x3
        Tile(8),
        Tile(8), // 9 Bam x2
    ])
}

/// Construct a hand that is one tile away from a known win.
fn create_near_win_hand() -> Hand {
    // One tile away from winning
    Hand::new(vec![
        Tile(0),
        Tile(0),
        Tile(2),
        Tile(2),
        Tile(2),
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(4),
        Tile(6),
        Tile(6),
        Tile(6),
        Tile(8), // Missing one 9 Bam
    ])
}

/// Construct a mixed-suit hand for general benchmark coverage.
fn create_random_hand() -> Hand {
    Hand::new(vec![
        Tile(0),
        Tile(1),
        Tile(2),
        Tile(9),
        Tile(10),
        Tile(11),
        Tile(18),
        Tile(19),
        Tile(20),
        Tile(27),
        Tile(28),
        Tile(31),
        Tile(35),
    ])
}

/// Benchmark a single win validation.
fn bench_single_validation(c: &mut Criterion) {
    let validator = load_validator();
    let hand = create_winning_hand();

    c.bench_function("validate_win_single", |b| {
        b.iter(|| validator.validate_win(black_box(&hand)));
    });
}

/// Benchmark analyze() for multiple N values.
fn bench_analyze_top_n(c: &mut Criterion) {
    let validator = load_validator();
    let hand = create_near_win_hand();

    let mut group = c.benchmark_group("analyze_top_n");

    for n in [1, 5, 10, 20].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(n), n, |b, &n| {
            b.iter(|| validator.analyze(black_box(&hand), n));
        });
    }
    group.finish();
}

/// Benchmark a batch of validations to simulate throughput.
fn bench_thousand_evaluations(c: &mut Criterion) {
    let validator = load_validator();
    let hands = vec![
        create_winning_hand(),
        create_near_win_hand(),
        create_random_hand(),
    ];

    c.bench_function("1000_hand_evaluations", |b| {
        b.iter(|| {
            for _ in 0..333 {
                for hand in &hands {
                    validator.validate_win(black_box(hand));
                }
            }
        });
    });
}

/// Benchmark raw deficiency computation on a fixed histogram.
fn bench_deficiency_calculation(c: &mut Criterion) {
    let json = fs::read_to_string("../../data/cards/unified_card2025.json")
        .expect("Failed to read unified_card2025.json");
    let card = UnifiedCard::from_json(&json).expect("Failed to parse unified card");

    let hand = create_near_win_hand();
    let target_histogram = &card.patterns[0].variations[0].histogram;
    let ineligible_histogram = &card.patterns[0].variations[0].ineligible_histogram;

    c.bench_function("calculate_deficiency", |b| {
        b.iter(|| {
            hand.calculate_deficiency(black_box(target_histogram), black_box(ineligible_histogram))
        });
    });
}

/// Benchmark O(1) tile presence checks via histogram lookup.
fn bench_histogram_lookup(c: &mut Criterion) {
    let hand = create_winning_hand();

    c.bench_function("histogram_has_tile", |b| {
        b.iter(|| {
            // Benchmark the O(1) histogram lookup
            for i in 0..37 {
                let tile = Tile(i as u8);
                black_box(hand.has_tile(tile));
            }
        });
    });
}

/// Benchmark the full analysis pipeline on a random hand.
fn bench_full_analysis_pipeline(c: &mut Criterion) {
    let validator = load_validator();

    c.bench_function("full_pipeline_random_hand", |b| {
        b.iter(|| {
            let hand = create_random_hand();
            let results = validator.analyze(&hand, 10);
            black_box(results);
        });
    });
}

criterion_group!(
    benches,
    bench_single_validation,
    bench_analyze_top_n,
    bench_thousand_evaluations,
    bench_deficiency_calculation,
    bench_histogram_lookup,
    bench_full_analysis_pipeline,
);

criterion_main!(benches);
