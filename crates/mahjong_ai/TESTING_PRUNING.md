# Testing MCTS Pruning Impact

This document explains how to test the performance and quality impact of MCTS heuristic pruning without a frontend.

## Quick Start

### 1. Visual Comparison (Fastest)

Compare decisions and timing on the same hand:

```bash
cargo run --example compare_pruning --release
```

**Output**: Shows decisions and timing for no pruning vs pruning with different settings.

### 2. Detailed Benchmarks (Most Accurate)

Run Criterion benchmarks for statistical performance analysis:

```bash
cargo bench --bench mcts_pruning_bench
```

**Output**: Statistical analysis with mean, median, deviation. Results in `target/criterion/`.

### 3. Bot Tournament (Win Rate)

Test if pruning affects decision quality over many games:

```bash
cargo run --example bot_tournament --release
```

**Output**: Win rates and timing for different pruning configurations.

## What Each Test Measures

### `compare_pruning` - Quick Visual Check

- **Measures**: Decision consistency, raw timing
- **Duration**: ~5 seconds
- **Best for**: Quick verification that pruning works

**Example output**:

```text
Test 1: WITHOUT PRUNING
Time: 145ms
Branching factor: 11

Test 2: WITH PRUNING (max=5)
Time: 98ms (1.48x speedup)
Branching factor: 5
```

### `mcts_pruning_bench` - Statistical Performance

- **Measures**: Mean time, standard deviation, outliers
- **Duration**: 2-5 minutes
- **Best for**: Accurate performance measurements

**What to look for**:

- "time: [X.XX ms Y.YY ms Z.ZZ ms]" - lower is better
- Compare "mcts_no_pruning" vs "pruned/5", "pruned/8", etc.
- 20-40% speedup expected with pruning

### `bot_tournament` - Quality Assessment

- **Measures**: Win rates across configurations
- **Duration**: 5-10 minutes
- **Best for**: Checking if pruning hurts decision quality

**What to look for**:

- Win rates should be similar (±5%) if pruning is good
- Large differences suggest pruning is too aggressive
- Check if faster bots can run more iterations with same time budget

## Configuration Tuning

Edit the source to test different settings:

### Max Children (Branching Factor)

```rust
ai.engine.enable_pruning = true;
ai.engine.max_children = 5;  // Try 3, 5, 8, 10
```

**Recommendations**:

- **max_children = 3**: Very aggressive, fast but risky
- **max_children = 5**: Balanced, good starting point
- **max_children = 8**: Conservative, safer but slower
- **max_children = 10**: Minimal pruning

### Iterations Budget

```rust
let mut ai = MCTSAi::new(1000, seed, &card);  // iterations
```

**Test hypothesis**: With pruning speedup, can we run more iterations?

- No pruning: 1000 iterations
- With pruning: Try 1400-1500 iterations (same wall-clock time)

## Interpreting Results

### Good Results (Pruning Worth It)

- ✓ 20-40% speedup in benchmarks
- ✓ Win rates within ±5% of baseline
- ✓ Consistent decisions on same hands
- ✓ Can run more iterations in same time

### Bad Results (Pruning Too Aggressive)

- ✗ Win rate drops >10%
- ✗ Different moves selected frequently
- ✗ Speedup <10% (overhead too high)

## Advanced Testing

### Test with Real Terminal Client

```bash
# Run 4 bots with different configs against each other
cargo run --bin mahjong_terminal -- --bot --config bot_pruned.json
```

### Profile Performance

```bash
# See where time is spent
cargo flamegraph --example compare_pruning -- --release
```

### Test Different Hand Complexities

Edit example files to test:

- Simple hands (6-7 unique tiles) - pruning less beneficial
- Complex hands (10-12 unique tiles) - pruning most beneficial
- Late game (3-4 tiles) - pruning unnecessary

## Recommended Testing Workflow

1. **Quick sanity check**: `cargo run --example compare_pruning --release`
2. **Verify speedup**: `cargo bench --bench mcts_pruning_bench`
3. **Check quality**: `cargo run --example bot_tournament --release`
4. **Tune max_children** based on results
5. **Re-run benchmarks** with tuned settings

## Questions to Answer

- [ ] What speedup do we get? (Target: 20-40%)
- [ ] Does decision quality drop? (Target: <5% win rate change)
- [ ] What's the optimal max_children? (Test: 3, 5, 8, 10)
- [ ] Can we run more iterations with pruning? (Target: 1.5x iterations)
- [ ] Does it help more on complex vs simple hands?

## Next Steps After Testing

Once you have results:

1. **If pruning is beneficial**: Enable by default with tuned settings
2. **If results are mixed**: Make it player-configurable (Easy/Medium/Hard)
3. **If it's harmful**: Keep disabled, document findings
4. **If it's marginal**: Consider adaptive pruning based on hand complexity
