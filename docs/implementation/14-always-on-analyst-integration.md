# Always-On Analyst Server Integration - Implementation Plan

**Status:** APPROVED - Implementation in progress
**Created:** 2026-01-09
**Last Updated:** 2026-01-09
**Owner:** Backend team

## Overview

This document outlines the implementation plan for integrating the Always-On Analyst into the game server loop (Section 2.1-2.3 of [13-backend-gap-analysis.md](13-backend-gap-analysis.md)).

**Goal:** Move strategic analysis from on-demand utility to core game loop, automatically analyzing hands after state changes to power:

- Bot decision-making
- Player hints (future)
- Pattern viability UI (future)

## Approved Architecture Decisions

### 1. Where should StrategicEvaluation live?

**Decision: Keep in `mahjong_ai`, call from server (Option B)**

**Rationale:**

- `mahjong_core` should remain pure game logic with no AI concepts
- `StrategicEvaluation` depends on probability calculations and strategic concepts (AI domain)
- Server already depends on both `mahjong_ai` and `mahjong_core`, so no circular dependency
- Clear separation: Core = rules, AI = intelligence, Server = orchestration

**Architecture:**

```text
mahjong_core (pure logic)
    ↓ uses
mahjong_ai (strategic evaluation, probability)
    ↓ uses both
mahjong_server (orchestration, triggers analysis)
```

### 2. When should analysis trigger?

**Decision: Smart triggers with configurable granularity**

**Trigger Points:**

1. **After TilesDealt** - Initial hand analysis (Charleston start)
2. **After Charleston completion** - Re-analyze with exchanged tiles
3. **After DrawTile** - Player drew, analyze updated hand
4. **After MeldExposed** - Player exposed meld (own or opponent), recalculate viability
5. **After TurnChanged** - New player's turn started (for that player only)

**Performance Optimization:**

- **Lazy evaluation**: Only analyze the active player's hand on their turn
- **Smart caching**: Track if hand composition changed since last analysis
- **Configurable mode**:
  - `AlwaysOn` - Analyze after every state change (4 players)
  - `ActivePlayerOnly` - Analyze only on turn start (1 player) - **DEFAULT for MVP**
  - `OnDemand` - Only when client requests (no automatic)

### 3. How should analysis results be stored?

**Decision: Add to `Room` with per-player cache**

**Data Structure:**

```rust
// In Room struct (crates/mahjong_server/src/network/room.rs)
pub struct Room {
    // ... existing fields ...

    /// Per-player analysis cache (updated by always-on analyst)
    pub analysis_cache: HashMap<Seat, HandAnalysis>,

    /// Analysis configuration
    pub analysis_config: AnalysisConfig,
}

/// Analysis results for a single player
#[derive(Debug, Clone)]
pub struct HandAnalysis {
    /// When this analysis was performed
    pub timestamp: DateTime<Utc>,

    /// All pattern evaluations (sorted by expected_value desc)
    pub evaluations: Vec<StrategicEvaluation>,

    /// Top 3 most viable patterns (cached for quick access)
    pub top_patterns: Vec<StrategicEvaluation>,

    /// Tiles needed to win (across all viable patterns)
    pub critical_tiles: HashSet<Tile>,

    /// Minimum deficiency across all patterns
    pub distance_to_win: i32,
}

#[derive(Debug, Clone)]
pub struct AnalysisConfig {
    /// When to trigger analysis
    pub mode: AnalysisMode,

    /// Maximum patterns to evaluate (for performance)
    pub max_patterns: usize, // Default: 500

    /// Maximum time per analysis (ms)
    pub timeout_ms: u64, // Default: 100
}

#[derive(Debug, Clone, Copy)]
pub enum AnalysisMode {
    AlwaysOn,         // All players after every state change
    ActivePlayerOnly, // Only current player on their turn (DEFAULT)
    OnDemand,        // Only when requested
}
```

### 4. What should be included in client events?

**Decision: Privacy-aware delta updates**

**Event Types:**

1. **`HandAnalysisUpdated` (private event, only to the player):**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct HandAnalysisEvent {
    pub seat: Seat,
    pub distance_to_win: i32,
    pub top_patterns: Vec<PatternSummary>, // Top 3 only
    pub viable_count: usize,
    pub impossible_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct PatternSummary {
    pub pattern_id: String,
    pub variation_id: String,
    pub deficiency: i32,
    pub probability: f64,
    pub score: u16,
    pub viable: bool,
}
```

1. **Full analysis available via `GetAnalysis` command:**

```rust
// Client requests full analysis on-demand (e.g., when opening Card Viewer)
GameCommand::GetAnalysis
→ Response: GameEvent::FullAnalysis(Vec<StrategicEvaluation>)
```

**Bandwidth Optimization:**

- Send `HandAnalysisUpdated` automatically only when:
  - Distance to win changes by ≥2 tiles
  - Top 3 patterns change
  - Viable pattern count changes by >5
- Send full analysis only on explicit request
- Cache full analysis client-side (1-minute TTL)

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETE

**Status:** ✅ COMPLETE (2026-01-09)

**Location:** `crates/mahjong_server/src/analysis.rs` (new file)

**Tasks:**

1. ✅ Create new module `crates/mahjong_server/src/analysis.rs`
2. ✅ Add analysis types:
   - `HandAnalysis` struct
   - `AnalysisConfig` struct
   - `AnalysisMode` enum
   - `HandAnalysisSummary` struct
   - `PatternSummary` struct
   - `AnalysisCache` type alias
3. ✅ Implement `HandAnalysis::from_evaluations()` constructor
4. ✅ Implement `HandAnalysis::has_significant_change()` (delta logic)
5. ✅ Implement `HandAnalysis::to_summary()` (lightweight serialization)
6. ✅ Extend `Room` struct with:
   - `analysis_cache: HashMap<Seat, HandAnalysis>`
   - `analysis_config: AnalysisConfig`
7. ✅ Initialize empty cache in all `Room` constructors

**Files modified:**

- ✅ `crates/mahjong_server/src/analysis.rs` (NEW - 500+ lines)
- ✅ `crates/mahjong_server/src/network/room.rs` (added analysis fields)
- ✅ `crates/mahjong_server/src/lib.rs` (registered module)

**Deliverables:**

- ✅ New analysis module with all types
- ✅ Room struct extended with analysis fields
- ✅ 9 comprehensive unit tests for `HandAnalysis` (all passing)
- ✅ Delta change detection logic
- ✅ Lightweight summary generation

**Test Results:**

- 9 new tests added (analysis module)
- 217 total tests passing (39 AI + 139 core + 39 server)
- No compilation warnings (after cleanup)

**Actual time:** 1 day

---

### Phase 2: Trigger Integration ⏳ PENDING

**Tasks:**

1. Add `should_trigger_analysis()` method to `Room`
2. Add `run_analysis()` method to `Room`
3. Hook into `handle_event()` to trigger analysis after events
4. Build `VisibleTiles` from current game state
5. Call `mahjong_ai::evaluation::StrategicEvaluation::from_analysis()`
6. Store results in `analysis_cache`

**Files to modify:**

- `crates/mahjong_server/src/network/room.rs`
- `crates/mahjong_server/src/analysis.rs`

**Deliverables:**

- Analysis triggers after TurnChanged, TilesDealt events
- Cache populated with analysis results
- Logging/tracing for analysis timing

**Estimated time:** 2-3 days

---

### Phase 3: Event System ⏳ PENDING

**Tasks:**

1. Add `HandAnalysisUpdated` event to `GameEvent` enum
2. Add `FullAnalysis` event to `GameEvent` enum
3. Add `GetAnalysis` command to `GameCommand` enum
4. Implement handler for `GetAnalysis` command
5. Emit `HandAnalysisUpdated` after analysis runs (with delta logic)
6. Add TypeScript bindings export

**Files to modify:**

- `crates/mahjong_core/src/event.rs`
- `crates/mahjong_core/src/command.rs`
- `crates/mahjong_server/src/network/handlers/analysis.rs` (NEW)
- `crates/mahjong_server/src/network/handlers/mod.rs`

**Deliverables:**

- New command/event types for analysis
- Handler for `GetAnalysis` requests
- Events broadcast to clients

**Estimated time:** 2-3 days

---

### Phase 4: Performance Optimization ⏳ PENDING

**Tasks:**

1. Add `tracing::instrument` to measure analysis time
2. Implement dirty flag tracking (hand changed since last analysis)
3. Add background tokio task for analysis (don't block game loop)
4. Implement timeout handling (fallback to cached result)
5. Add configuration options to `HouseRules` (optional)
6. Performance testing and profiling

**Files to modify:**

- `crates/mahjong_server/src/analysis.rs`
- `crates/mahjong_server/src/network/room.rs`
- `crates/mahjong_core/src/table/types.rs` (if adding to HouseRules)

**Deliverables:**

- Analysis runs in <50ms avg, <100ms p90
- Background task doesn't block game loop
- Performance metrics logged

**Estimated time:** 3-4 days

---

## Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| Analysis time (avg) | <50ms | `tracing` spans |
| Analysis time (p90) | <100ms | Histogram |
| Memory per room | <500KB | Analysis cache size |
| Events per turn | <3 | Count `HandAnalysisUpdated` |
| Bandwidth per update | <5KB | Event payload size |

## Testing Strategy

### Unit Tests

- `HandAnalysis::from_evaluations()` correctly filters and sorts
- `should_trigger_analysis()` respects mode configuration
- Analysis cache updates correctly
- Delta logic only emits events when thresholds met

### Integration Tests

- Full game with `AlwaysOn` mode - verify analysis after each event
- Full game with `ActivePlayerOnly` mode - verify analysis only on turn
- `GetAnalysis` command returns cached results
- Performance test: 1000 hands × 500 patterns < 50ms avg
- Bandwidth test: Measure event payload sizes

### Manual Testing

- Practice game with analysis logging enabled
- Check server logs - verify timing metrics
- Monitor WebSocket traffic - ensure no excessive messages

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Analysis too slow | Game feels laggy | Run in background tokio task, use cached result if timeout |
| Excessive bandwidth | Poor mobile experience | Send only delta updates with thresholds |
| Stale cache | Wrong analysis shown | Invalidate cache on any hand change, add checksum |
| Memory leak | Server OOM | Limit cache size, clear on game end |

## Timeline Estimate

- **Week 1**: Phase 1 (infrastructure) + Phase 2.1 (triggers)
- **Week 2**: Phase 2.2 (execution) + Phase 3 (events)
- **Week 3**: Phase 4 (optimization) + testing

**Total: 2-3 weeks**

## Success Criteria

✅ Analysis runs automatically after configured trigger events
✅ Analysis results cached per player in `Room`
✅ `HandAnalysisUpdated` events sent to clients
✅ `GetAnalysis` command returns full analysis
✅ Performance targets met (<50ms avg)
✅ No excessive bandwidth usage (<5KB per update)
✅ All tests passing (unit + integration)

## Dependencies

- Existing `StrategicEvaluation` in `mahjong_ai` (✅ complete)
- Existing `VisibleTiles` context tracking (✅ complete)
- Existing `HandValidator` in `mahjong_core` (✅ complete)

## Future Enhancements (Post-MVP)

- Section 2.5: Hint System (use cached analysis to generate hints)
- Section 4.4: Pattern Viability UI (Card Viewer integration)
- Defensive play analysis (opponent hand inference)
- Multi-engine comparison logging (debug mode)

## References

- [13-backend-gap-analysis.md](13-backend-gap-analysis.md) - Section 2.1-2.3
- [CLAUDE.md](../../CLAUDE.md) - Architecture principles
- [crates/mahjong_ai/src/evaluation.rs](../../crates/mahjong_ai/src/evaluation.rs) - Existing evaluation logic

---

**Last Phase Completed:** None (starting implementation)
**Current Phase:** Phase 1 - Core Infrastructure
**Next Milestone:** Phase 1 completion with unit tests passing
