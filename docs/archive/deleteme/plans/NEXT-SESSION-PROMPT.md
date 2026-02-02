# Next Session: Always-On Analyst Phase 2 - Trigger Integration

## Context

You're continuing implementation of the Always-On Analyst feature for the American Mahjong backend. **Phase 1 is complete** and committed (commit `0ecb31c`).

## What's Been Completed (Phase 1)

✅ Core infrastructure in [crates/mahjong_server/src/analysis.rs](../../crates/mahjong_server/src/analysis.rs):

- `HandAnalysis` struct with pattern caching, distance-to-win tracking
- `AnalysisConfig` with 3 modes: `AlwaysOn`, `ActivePlayerOnly` (default), `OnDemand`
- Smart delta logic (`has_significant_change()`) to minimize bandwidth
- Lightweight summary generation for client events
- 9 comprehensive unit tests (all passing)

✅ Room integration in [crates/mahjong_server/src/network/room.rs](../../crates/mahjong_server/src/network/room.rs):

- Added `analysis_cache: HashMap<Seat, HandAnalysis>` field
- Added `analysis_config: AnalysisConfig` field
- Initialized in all constructors

✅ Documentation:

- Full implementation plan: [docs/implementation/14-always-on-analyst-integration.md](14-always-on-analyst-integration.md)
- Phase 1 marked complete with detailed test results

## Your Task: Phase 2 - Trigger Integration

**Goal:** Hook analysis into the game loop so it runs automatically after state changes.

### Tasks (from implementation plan)

1. Add `should_trigger_analysis(&self, event: &GameEvent) -> bool` method to `Room`
   - Check `analysis_config.mode`
   - Return true for trigger events based on mode
   - `ActivePlayerOnly`: TurnChanged, TilesDealt
   - `AlwaysOn`: TurnChanged, TilesDealt, TileDrawn, MeldExposed

2. Add `run_analysis(&mut self)` method to `Room`
   - Get validator from `Table`
   - Build `VisibleTiles` from current game state (discards + exposed melds)
   - For each seat (or just active player based on mode):
     - Get hand from `Table`
     - Call `validator.analyze(hand, limit)` to get `Vec<AnalysisResult>`
     - For each result, call `StrategicEvaluation::from_analysis()` (from `mahjong_ai`)
     - Create `HandAnalysis::from_evaluations()`
     - Store in `analysis_cache`

3. Hook into event broadcasting
   - Find where `Room` broadcasts events (likely `handle_event()` or similar)
   - After broadcasting each event, check `should_trigger_analysis()`
   - If true, call `run_analysis()`

4. Add tracing/logging
   - Use `tracing::info!` to log when analysis runs
   - Log: seat, pattern count, distance_to_win, elapsed time

### Files to Modify

- `crates/mahjong_server/src/network/room.rs` - Add methods and hook into event loop
- `crates/mahjong_server/src/analysis.rs` - Add helper functions if needed

### Key Architecture Principles

- **Server-authoritative**: Server is single source of truth
- **Command/Event pattern**: Analysis happens AFTER events are broadcast
- **Histogram-based validation**: O(1) pattern matching (already implemented)
- **Privacy-aware**: Only send analysis to the player who owns the hand

### Important Notes

1. **VisibleTiles construction**: Need to scan:
   - `Table.discard_pile` for all discarded tiles
   - `Table.players[seat].hand.exposed` for exposed melds
   - Track which player exposed which meld

2. **Performance**:
   - Target: <50ms avg, <100ms p90
   - Start with `ActivePlayerOnly` mode (analyzes 1 player per turn)
   - Defer optimization to Phase 4

3. **Error handling**:
   - If validator is None (shouldn't happen), skip analysis
   - If table is None, skip analysis
   - Log errors but don't crash

### Testing Strategy

After implementation:

1. Run `cargo test --workspace --lib` (should still be 217 tests passing)
2. Add integration test: Create game → Deal tiles → Verify analysis cache populated
3. Manual test: Run server, join game, check logs for analysis messages

### Success Criteria

✅ Analysis runs automatically after TurnChanged and TilesDealt events
✅ `analysis_cache` populated with HandAnalysis for each player (or active player)
✅ Tracing logs show analysis timing and results
✅ All existing tests still pass
✅ No compilation warnings

## Useful Commands

```bash
# Run all tests
cargo test --workspace --lib

# Run specific test
cd crates/mahjong_server
cargo test --lib room

# Check for unused code
npm run knip

# Format code
cargo fmt
```

## Reference Files

- Implementation plan: [docs/implementation/14-always-on-analyst-integration.md](14-always-on-analyst-integration.md)
- Gap analysis: [docs/implementation/13-backend-gap-analysis.md](13-backend-gap-analysis.md)
- Architecture overview: [CLAUDE.md](../../CLAUDE.md)
- Existing evaluation code: [crates/mahjong_ai/src/evaluation.rs](../../crates/mahjong_ai/src/evaluation.rs)
- Context tracking: [crates/mahjong_ai/src/context.rs](../../crates/mahjong_ai/src/context.rs)

## Ready to Start?

Begin by reading `crates/mahjong_server/src/network/room.rs` to understand the event broadcasting flow, then implement the two methods outlined above. Stop after Phase 2 for confirmation before proceeding to Phase 3 (Event System).

Good luck! 🚀
