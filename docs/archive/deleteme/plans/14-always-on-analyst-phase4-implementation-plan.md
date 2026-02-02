# Always-On Analyst Phase 4 - Implementation Plan (for Gemini 3.0 Pro)

Audience: Gemini 3.0 Pro (LLM implementing the work)

Goal: Add Phase 4 performance optimizations to the Always-On Analyst without
regressing existing behavior or over-engineering.

Source context:

- `docs/implementation/14-always-on-analyst-integration.md` (Phase 4 section)
- Current implementation in `crates/mahjong_server/src/analysis.rs`
  and `crates/mahjong_server/src/network/room.rs`

## Guardrails (do not over-engineer)

- Keep existing API shapes stable unless explicitly required.
- Do not add new event types unless essential.
- Do not refactor unrelated code; minimal, localized edits only.
- Use `tracing` for perf stats; add metrics later only if needed.
- Prefer deterministic, simple hashing; no new dependencies unless necessary.

## High-Level Changes

1. Add per-seat skip logic using hand + visible-context hashes.
2. Move analysis into a single per-room worker/queue.
3. Enforce analysis timeout with stale-cache fallback.
4. Add dev warnings behind `ANALYSIS_WARN_TIMEOUT=1`.
5. HouseRules: add on/off switch only.
6. Update triggers to include each Charleston exchange (not just completion).

## Data Structures

Add to `crates/mahjong_server/src/analysis.rs`:

```rust
/// Tracks hashes used to skip re-analysis when no changes occurred.
#[derive(Debug, Clone, Default)]
pub struct AnalysisHashState {
    pub visible_hash: u64,
    pub hand_hashes: HashMap<Seat, u64>,
}
```

Add to `Room` in `crates/mahjong_server/src/network/room.rs`:

```rust
pub analysis_hashes: AnalysisHashState,
pub analysis_tx: Option<mpsc::Sender<AnalysisRequest>>,
pub analysis_handle: Option<tokio::task::JoinHandle<()>>,
```

Add an analysis request type (keep minimal):

```rust
#[derive(Debug, Clone)]
pub struct AnalysisRequest {
    pub reason: AnalysisTrigger,
}

#[derive(Debug, Clone, Copy)]
pub enum AnalysisTrigger {
    Event(GameEvent),
}
```

## Hashing Strategy

Goal: skip work for seats whose hand or visible context has not changed.

Visible context hash (room-wide):

- Discard pile tiles (order matters if discard order is meaningful).
- All exposed melds for all seats.

Hand hash (per seat):

- Concealed tiles and exposed melds for that seat.

Implementation options (use simplest available):

- If `Tile`/`Meld` implement `Hash`, use `DefaultHasher`.
- Otherwise, derive a stable vector of tile identifiers and hash the bytes.

Important: Hashes are in-memory only, no need for cross-run stability.

## Worker / Queue Model

Create a single per-room worker task:

- `analysis_tx` is created when the room is created or when the game starts.
- `broadcast_event` enqueues a request if analysis is enabled and
  `should_trigger_analysis()` is true.
- The worker drains the queue and runs a single analysis pass that:
  - Builds `VisibleTiles`
  - For each seat in scope (AlwaysOn or ActivePlayerOnly):
    - Computes hashes
    - Skips analysis if both hashes match
    - Otherwise runs analysis and updates cache + hashes
  - Emits `HandAnalysisUpdated` only if delta logic says so

Coalescing:

- If multiple requests arrive before the worker runs, discard all but the latest.
- Do not enqueue if a request is already pending (simple "in-flight" flag).

Keep it simple: no complex priority handling.

## Trigger Rules (Charleston update)

AlwaysOn mode:

- TurnChanged
- TilesDealt
- TileDrawn
- TileCalled
- TilesPassed (Charleston pass, private)
- TilesReceived (Charleston pass, private)

ActivePlayerOnly mode:

- TurnChanged
- TilesDealt
- TilesPassed / TilesReceived (only the relevant seat will be analyzed)

Note: Charleston should trigger after each pass/exchange, not only
`CharlestonComplete`.

## Timeout Handling

Wrap analysis execution:

```rust
let result = tokio::time::timeout(
    Duration::from_millis(self.analysis_config.timeout_ms),
    run_analysis_impl(),
).await;
```

On timeout:

- Keep stale cache, emit no update.
- If `ANALYSIS_WARN_TIMEOUT=1` is set, `tracing::warn!` with seat/mode/elapsed.

## HouseRules

Add a single switch:

```rust
pub analysis_enabled: bool
```

Behavior:

- If `false`, skip enqueue in `broadcast_event`.
- `GetAnalysis` may still run on-demand if desired (decide and document).

## Implementation Steps (Concrete)

1. Add `AnalysisHashState` and helper hashing functions in `analysis.rs`.
2. Extend `Room` with hash state + worker fields.
3. Initialize worker in room creation or game start.
4. Add `enqueue_analysis()` method to `Room`:
   - check `analysis_enabled`
   - check `should_trigger_analysis()`
   - send to worker channel
5. Update `broadcast_event()` to call `enqueue_analysis()` instead of
   `run_analysis()` directly.
6. Implement `run_analysis_impl()`:
   - build `VisibleTiles`
   - decide seats based on mode
   - compute hashes per seat
   - skip if hashes unchanged
   - run validator + StrategicEvaluation + HandAnalysis
   - delta emission logic unchanged
7. Add timeout wrapper in the worker.
8. Add dev warning toggle using `ANALYSIS_WARN_TIMEOUT=1`.
9. Update `should_trigger_analysis()` for Charleston pass events.

## Minimal Tests / Validation

Unit-ish checks (add small tests if easy; otherwise rely on manual):

- Hash skip: same hand/visible => analysis not invoked for that seat.
- Charleston pass triggers analysis after each pass event.
- Timeout warning fires only when env var is set.

Manual:

- Start a game, observe analysis logs.
- During Charleston, confirm analysis runs after each pass exchange.
- Toggle `analysis_enabled` and verify no auto-analysis runs.

## Non-Goals (avoid scope creep)

- No new metrics system beyond `tracing`.
- No new event types unless absolutely required.
- No concurrency changes outside analysis worker.
- No changes to AI evaluation logic.

## Files Expected to Change

- `crates/mahjong_server/src/analysis.rs`
- `crates/mahjong_server/src/network/room.rs`
- `crates/mahjong_core/src/table/types.rs` (HouseRules toggle)

Optional:

- `docs/implementation/14-always-on-analyst-integration.md` (Phase 4 status update)
