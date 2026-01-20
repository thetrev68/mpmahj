# Event Refactor Plan — `crates/mahjong_core/src/event.rs` 🔧

**Status:** This plan will break the existing public API (no backwards compatibility). All changes must follow Rustdoc conventions and include full documentation on new types and helper functions. The goal is a small-file layout so an LLM (or a dev) can open a single small file and find all relevant event variants or helpers with minimal tokens.

---

## Summary (one-line)

Replace the single, bloated `GameEvent` file with a clear module split and explicit types:

- `public_events.rs` — broadcast events
- `private_events.rs` — player/pair-scoped events
- `analysis_events.rs` - pattern/analysis/hint events (private by design)
- `types.rs` — small shared enums/structs
- `helpers.rs` — classification helpers implemented for the new top-level `Event` enum
- `mod.rs` — wire-up & docs (thin)

No backward-compatible aliases, `pub use` re-exports of old names, or preserved `GameEvent` names are allowed.

> Rationale: breaking the API forces explicit migration, simplifies types for LLMs, and removes complex mixed-variant utilities hidden inside a single file.

---

## Required new files (exact paths)

- `crates/mahjong_core/src/event/mod.rs` — thin module file and `pub mod` declarations; *small documentation only*.
- `crates/mahjong_core/src/event/public_events.rs` — `pub enum PublicEvent { ... }` and docs.
- `crates/mahjong_core/src/event/private_events.rs` — `pub enum PrivateEvent { ... }` and docs.
- `crates/mahjong_core/src/event/analysis_events.rs` — `pub enum AnalysisEvent { ... }` and docs.
- `crates/mahjong_core/src/event/types.rs` — shared small enums and structs: `PatternDifficulty`, `ReplacementReason`, `PatternAnalysis`.
- `crates/mahjong_core/src/event/helpers.rs` — new top-level `pub enum Event { Public(PublicEvent), Private(PrivateEvent), Analysis(AnalysisEvent) }` and all classification helpers (method signatures below) implemented here.
- `crates/mahjong_core/src/event/tests.rs` — unit tests ported & tightened (no legacy alias tests).
- `docs/implementation/backend/events_index.json` — programmatic index mapping event variant names to the new file path and a one-line description (for LLM quick lookup).

All files must have idiomatic rustdoc for the module and public items (/// on enums, variants, and helper methods). Keep files < ~300 lines.

---

## Exact type & variant mapping (unambiguous)

Below are *exact* variant mappings taken from the current `GameEvent` (as of this plan). For each variant, the new owning enum and the exact fields are prescribed.

### `public_events.rs` — `pub enum PublicEvent` (variants & fields)

- HistoryList { entries: Vec<crate::history::MoveHistorySummary> }
- StateRestored { move_number: u32, description: String, mode: crate::history::HistoryMode }
- HistoryTruncated { from_move: u32 }
- HistoryError { message: String }
- GameCreated { game_id: String }
- PlayerJoined { player: crate::player::Seat, player_id: String, is_bot: bool }
- GameStarting
- DiceRolled { roll: u8 }
- WallBroken { position: usize }
- CharlestonPhaseChanged { stage: crate::flow::charleston::CharlestonStage }
- PlayerReadyForPass { player: crate::player::Seat }
- TilesPassing { direction: crate::flow::charleston::PassDirection }
- PlayerVoted { player: crate::player::Seat }
- VoteResult { result: crate::flow::charleston::CharlestonVote }
- CharlestonComplete
- CharlestonTimerStarted { stage: crate::flow::charleston::CharlestonStage, duration: u32, started_at_ms: u64, timer_mode: crate::table::TimerMode }
- CourtesyPassComplete
- PhaseChanged { phase: crate::flow::GamePhase }
- TurnChanged { player: crate::player::Seat, stage: crate::flow::playing::TurnStage }
- TileDrawnPublic { remaining_tiles: usize }  // NEW: public-only tile draw
- TileDiscarded { player: crate::player::Seat, tile: crate::tile::Tile }
- CallWindowOpened { tile: crate::tile::Tile, discarded_by: crate::player::Seat, can_call: Vec<crate::player::Seat>, timer: u32, started_at_ms: u64, timer_mode: crate::table::TimerMode }
- CallWindowClosed
- CallResolved { resolution: crate::call_resolution::CallResolution }
- TileCalled { player: crate::player::Seat, meld: crate::meld::Meld, called_tile: crate::tile::Tile }
- JokerExchanged { player: crate::player::Seat, target_seat: crate::player::Seat, joker: crate::tile::Tile, replacement: crate::tile::Tile }
- BlankExchanged { player: crate::player::Seat }
- MahjongDeclared { player: crate::player::Seat }
- HandValidated { player: crate::player::Seat, valid: bool, pattern: Option<String> }
- WallExhausted { remaining_tiles: usize }
- GameAbandoned { reason: crate::flow::outcomes::AbandonReason, initiator: Option<crate::player::Seat> }
- GameOver { winner: Option<crate::player::Seat>, result: crate::flow::outcomes::GameResult }
- GamePaused { by: crate::player::Seat, reason: Option<String> }
- GameResumed { by: crate::player::Seat }
- PlayerForfeited { player: crate::player::Seat, reason: Option<String> }
- AdminForfeitOverride { admin_id: String, admin_display_name: String, forfeited_player: crate::player::Seat, reason: String }
- AdminPauseOverride { admin_id: String, admin_display_name: String, reason: String }
- AdminResumeOverride { admin_id: String, admin_display_name: String }
- CommandRejected { player: crate::player::Seat, reason: String }

> Note: `TileDrawn` is split into `TileDrawnPublic` (no tile shown) and a private counterpart (below).

### `private_events.rs` — `pub enum PrivateEvent` (variants & fields)

- TilesDealt { your_tiles: Vec<crate::tile::Tile> }
- TilesPassed { player: crate::player::Seat, tiles: Vec<crate::tile::Tile> }
- TilesReceived { player: crate::player::Seat, tiles: Vec<crate::tile::Tile>, from: Option<crate::player::Seat> }
- TileDrawnPrivate { tile: crate::tile::Tile, remaining_tiles: usize } // NEW: private-only tile draw (tile present)
- ReplacementDrawn { player: crate::player::Seat, tile: crate::tile::Tile, reason: types::ReplacementReason }
- CourtesyPassProposed { player: crate::player::Seat, tile_count: u8 } // pair-private
- CourtesyPassMismatch { pair: (crate::player::Seat, crate::player::Seat), proposed: (u8, u8), agreed_count: u8 }
- CourtesyPairReady { pair: (crate::player::Seat, crate::player::Seat), tile_count: u8 }

> Pair-private semantics: `is_for_seat()` should return true only for the two seats listed in the `pair` field.

### `analysis_events.rs` - `pub enum AnalysisEvent` (private by design)

- AnalysisUpdate { patterns: Vec<types::PatternAnalysis> }
- HandAnalysisUpdated { distance_to_win: i32, viable_count: usize, impossible_count: usize }
- HintUpdate { hint: crate::hint::HintData }

(We separate analysis-specific enums/types so clients that only care about analysis can open `analysis_events.rs`.)

### `types.rs` (shared types used by event enums)

- pub enum PatternDifficulty { Impossible, Hard, Medium, Easy }
- pub enum ReplacementReason { Kong, Quint, BlankExchange }
- pub struct PatternAnalysis { pub pattern_name: String, pub distance: u8, pub viable: bool, pub difficulty: PatternDifficulty, pub probability: f64, pub score: u32 }

(Keep `#[derive(Serialize, Deserialize, Debug, Clone, TS)]` and `#[ts(export_to = "../../../apps/client/.../")]` attributes as before.)

---

## Helper functions & exact signatures (all go into `helpers.rs`)

Create a single authoritative `Event` enum and attach the following methods (exact signatures) implemented in `helpers.rs`.

- pub enum Event {
    Public(PublicEvent),
    Private(PrivateEvent),
    Analysis(AnalysisEvent),
}

Exact helper method signatures (attached to `impl Event`):

- /// True if this event should only be sent to specific client(s).
  pub fn is_private(&self) -> bool;

- /// Returns the target player for private events, if the event explicitly names a seat.
  /// Returns `None` when server routing determines the recipient.
  pub fn target_player(&self) -> Option<crate::player::Seat>;

- /// Returns `true` if this is an error/rejection event.
  pub fn is_error(&self) -> bool;

- /// Returns true if this event is scoped to a particular seat (used for pair-private events).
  pub fn is_for_seat(&self, seat: crate::player::Seat) -> bool;

- /// Returns the associated player (actor) for the event when available.
  pub fn associated_player(&self) -> Option<crate::player::Seat>;

Implementation notes:

- `is_private()` must return `true` for `Event::Private(_)` and `Event::Analysis(_)`. Analysis events are always private by definition.
- `is_error()` must return `true` for `Event::Public(PublicEvent::CommandRejected { .. })` and other error-like future variants.
- `target_player()` must return `None` when the original `GameEvent` relied on server routing (e.g., `TilesDealt`, `TileDrawn` private variant if it lacks a player field); return `Some(seat)` when event contains a seat.

All helper methods must have rustdoc examples mirroring the tests currently in `event.rs`, updated to use the new `Event` wrapper and split enums (e.g., `Event::Public(PublicEvent::TileDrawnPublic { .. })` and `Event::Private(PrivateEvent::TileDrawnPrivate { .. })`).

---

## Tests (exact names & locations)

Add/replace tests in `crates/mahjong_core/src/event/tests.rs` (expand coverage vs current `event.rs`):

- `fn test_private_event_detection()` verify `Event::Private(PrivateEvent::TilesDealt{..}).is_private()` etc. Keep assertions but adapt to the new `Event` wrapper.
- `fn test_error_detection()` confirm `CommandRejected` yields `is_error()` true.
- `fn test_associated_player_extraction()` ensure `associated_player()` matches for `PublicEvent` and `PrivateEvent` where relevant.
- `fn test_serialization_round_trip()` pick representative `PublicEvent::TileCalled`, serialize to JSON and deserialize into `Event::Public(PublicEvent::TileCalled{..})` (assert it round-trips the inner enum or the top-level `Event` enum as your serde choice requires).
- `fn test_charleston_event_visibility()` confirm `TilesPassing` is public; courtesy pair events are `Event::Private` and `is_for_seat()` restricts to the pair.
- `fn test_analysis_event_privacy()` ensure all `AnalysisEvent` variants return `is_private()` true and `target_player()` is `None` unless a seat is explicitly present.
- `fn test_tile_draw_split()` verify `TileDrawnPublic` is public and `TileDrawnPrivate` is private; ensure `associated_player()` behavior matches spec.
- `fn test_lifecycle_event_associated_player()` cover `GamePaused`, `GameResumed`, `PlayerForfeited`, `Admin*` events.

All tests must be updated to import the new types explicitly `use crate::event::{Event, public_events::PublicEvent, private_events::PrivateEvent, analysis_events::AnalysisEvent, types};`.

---

## Events index (programmatic) — `docs/implementation/backend/events_index.json`

Create a small JSON file keyed by simple variant names for quick LLM lookup. Example schema (exact):

{
  "TileCalled": { "file": "crates/mahjong_core/src/event/public_events.rs", "enum": "PublicEvent", "summary": "A player called a discard and exposed a meld" },
  "TilesDealt": { "file": "crates/mahjong_core/src/event/private_events.rs", "enum": "PrivateEvent", "summary": "Initial tiles dealt to a player (private)" }
}

Populate entries for all variants in the refactor. This file should be kept < ~1000 lines.

---

## Migration guidance (unambiguous, exact replacements)

Because this refactor is intentionally breaking, provide the following grep/sed-style replacements in the PR description for consumers to apply:

- Replace all uses of `GameEvent::X { .. }` with the appropriate `Event::Public(PublicEvent::X { .. })` or `Event::Private(PrivateEvent::X { .. })` or `Event::Analysis(AnalysisEvent::X { .. })`.

Examples (exact):

- `GameEvent::TileCalled { player, meld, called_tile }` → `Event::Public(PublicEvent::TileCalled { player, meld, called_tile })`
- `GameEvent::TilesDealt { your_tiles }` → `Event::Private(PrivateEvent::TilesDealt { your_tiles })`
- `GameEvent::AnalysisUpdate { patterns }` → `Event::Analysis(AnalysisEvent::AnalysisUpdate { patterns })`

Also add codemod hints for IDEs: replace `use mahjong_core::event::GameEvent` with `use mahjong_core::event::{Event, public_events::PublicEvent, private_events::PrivateEvent, analysis_events::AnalysisEvent};`.

---

## Rustdoc & TS bindings rules (non-negotiable)

- Every public type and function must have a one-sentence rustdoc summary; complex behavior gets a second paragraph with a small example.
- Keep or re-add `#[ts(export)]` and `#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]` where they exist today (e.g., `PatternAnalysis`, `PatternDifficulty`, `ReplacementReason`).
- Prefer a clean, explicit wire format even if it is a breaking change. Document the new shape and add round-trip tests (no compatibility layer).

---

## Tests & CI (exact acceptance criteria)

- `cargo test` must pass in the crate after the refactor.
- The new tests described above must exist and validate helper behavior and serialization roundtrips for representative events in each new enum.
- `cargo clippy` and `cargo fmt` must pass.

---

## Step-by-step incremental PR plan (small commits)

1. Add new empty module files + `events_index.json` (small PR). Doc-only, no behavior changes.
2. Move shared types (`PatternDifficulty`, `PatternAnalysis`, `ReplacementReason`) into `types.rs` and adjust `#[ts]` exports (small PR). Update imports in `event.rs` only; ensure compile.
3. Add `public_events.rs` and `private_events.rs` with the exact variants (copy/paste), *do not delete old `event.rs` yet*. Add `use` path refactors in tests to reference new modules; run `cargo test` and fix compilation errors until everything compiles.
4. Add `analysis_events.rs` and `helpers.rs` (implement `Event` enum and helper methods). Port tests to use `Event` and helper methods. (This is the main behavioral PR.)
5. Remove the old `event.rs` file and replace with `mod.rs` that documents the new module layout and re-exports nothing from the old `GameEvent`. Update crate docs and the README where needed. Add `CHANGELOG` entry.
6. Final PR: update TypeScript bindings (run generator), update `events_index.json` with final set, run full test suite and CI.

Each PR must be small and include the corresponding tests.

---

## Risks & mitigations

- Risk: downstream breakage in many crates and clients. Mitigate: provide clear sed/codemod replacements in PR description and update `apps/client` code in a follow-up (or include it in the same PR if small).
- Risk: accidental change to serialization. Mitigate: keep `Serialize`/`Deserialize` derivations and add explicit round-trip tests for representative variants.
- Risk: missing rustdoc. Mitigate: require rustdoc for each public item before merging via PR checklist.

---

## PR checklist (must be satisfied before merge)

- [ ] New files created at exact paths listed above
- [ ] All public types & functions have rustdoc comments
- [ ] Tests added/ported for helpers, privacy classification, and serialization
- [ ] `events_index.json` updated and corresponds to final layout
- [ ] `cargo test`, `cargo clippy`, `cargo fmt` pass
- [ ] PR description includes exact migration replacements

---

## If you want, I can implement PR #1 (create empty modules + `events_index.json`) and PR #2 (move shared types) to get momentum. ✅

---

Document author: GitHub Copilot — plan prepared for a breaking rework of `event.rs`. Keep the implementation incremental and well-tested.


