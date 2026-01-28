# Copilot Instructions - American Mahjong Project

## Project Context

Cross-platform American Mahjong game (NMJL rules) with Rust backend + TypeScript/React frontend. Backend complete (v0.1.0); frontend is Vite template. **Server-authoritative**: Rust holds truth, frontend presents state.

## Architecture Principles

### Command/Event Pattern

All game actions flow through strict command → validation → event pipeline:

- **Commands** (`crates/mahjong_core/src/command.rs`): Client intent requiring validation
- **Events** (`crates/mahjong_core/src/event.rs`): Server reality after validation
- **Table** (`crates/mahjong_core/src/table.rs`): Central coordinator with `process_command()` entry point

Never mutate game state directly. Always emit events for state changes.

### Type-Driven State Machine

Use Rust enums to make impossible states impossible. See `flow.rs`:

```rust
pub enum GamePhase {
    Charleston(CharlestonStage),  // Can't discard during Charleston
    Playing(TurnStage),            // Can't pass tiles during playing
    // ...
}
```

Each phase has typed substates. Invalid commands for current phase return `CommandError::InvalidForPhase`.

### Data-Oriented Performance

- **Histogram-first representation**: Tiles are u8 indices (0-41). Hands maintain `[u8; 42]` frequency arrays.
- **O(1) win validation**: Pattern matching via vector subtraction: `deficiency = max(0, target[i] - hand[i])`
- **Unified card format**: `data/cards/unified_card2025.json` combines human-readable metadata + engine histograms
- See `data/cards/README_RUNTIME.md` for tile index mapping (0-8: Bams, 9-17: Craks, etc.)

This design enables 1000+ hand evaluations/second for Monte Carlo AI.

## Crate Structure

```
mahjong_core/     Pure game logic (commands, events, validation)
mahjong_server/   Axum + WebSocket server (session, rooms, auth)
mahjong_ai/       Bot strategies (Basic → Hard, MCTS engine)
```

**Dependency rule**: Core never imports server/ai. Server and AI import core.

## TypeScript Type Generation

Types are auto-generated from Rust using `ts-rs`. Any type with `#[derive(TS)]` gets exported:

```bash
# Generate .ts bindings (runs via tests, not build)
cd crates/mahjong_core
cargo test export_bindings
# Output: apps/client/src/types/bindings/generated/*.ts
```

When changing Rust types exported to frontend, always regenerate bindings.

## Development Workflows

### Running Tests

```bash
cargo test              # All Rust tests
cargo test --release    # With optimizations (for benchmarks)
npm test               # Frontend tests (if present)
```

### Quality Checks

```bash
npm run check:all       # Runs all lints + tests (mirrors CI)
cargo clippy           # Rust linting
npm run lint           # ESLint + markdownlint
npm run lint:knip      # Detect unused exports/dependencies
cargo fmt              # Format Rust code
npm run format         # Format TS/JS/JSON/MD
```

### Running Server

```bash
cd crates/mahjong_server
cargo run              # WebSocket at ws://localhost:3000/ws
# Optional: export DATABASE_URL="postgresql://..." for persistence
# Without DB, runs memory-only mode
```

## Charleston Implementation (Tricky!)

The Charleston (mandatory pre-game tile passing) has 10+ sub-phases with complex vote/stop logic. See `docs/architecture/04-state-machine-design.md` for state flow.

Key states: `FirstRight`, `FirstAcross`, `FirstLeft`, `FirstBlindPassCollect`, `StopVote`, `SecondRight`, etc.

**Blind pass/steal**: Players can exchange 1-2 tiles instead of full 3 on final pass of each Charleston.

Never implement Charleston shortcuts unless specified in design docs.

## Pattern Validation

American Mahjong requires matching 14 tiles to one of ~60 patterns (each with 10-100+ variations). Engine uses pre-compiled histograms:

- **Runtime card**: `data/cards/runtime_card2025.json` contains ~6000 concrete target hands
- **Validation**: Vector subtraction finds distance-to-win in O(1)
- **Joker handling**: See `crates/mahjong_core/src/rules/` for permutation logic

Variable suits (`VSUIT1`, `VSUIT2`, `VSUIT3`) allow "same suit" constraints without hardcoding suits.

## Common Pitfalls

1. **Don't bypass command validation**: Always call `Table::process_command()`, never mutate `Table` fields directly.
2. **Don't confuse tile notation**: `1B` = 1 Bam (index 0), `1C` = 1 Crak (index 9), `1D` = 1 Dot (index 18).
3. **Don't assume sequences work like Riichi Mahjong**: American Mahjong uses sets (Pungs/Kongs), NOT sequences (except specific patterns like "Consecutive Run").
4. **Jokers ≠ universal wildcards**: Can't be used in pairs (except literal Joker pairs in special patterns).
5. **Frontend should never validate game logic**: All validation happens server-side. Frontend only validates input format.

## Documentation Structure

- `docs/architecture/`: System design (read first for big-picture understanding)
- `docs/implementation/`: Implementation specs with code examples
- `docs/plans/`: Refactoring plans and performance notes
- `PLANNING.md`: User experience and feature requirements
- `Agent.md`, `CLAUDE.md`: AI assistant context (legacy, may be outdated)

Start with `docs/architecture/00-ARCHITECTURE.md` when exploring new areas.

## Testing Patterns

- **Property tests**: See `crates/mahjong_core/tests/` for QuickCheck-style tests
- **Integration tests**: `crates/mahjong_server/tests/` cover WebSocket flows
- **Benchmarks**: `crates/mahjong_core/benches/` for performance validation (run with `cargo bench`)

Test coverage goal: 80%+ for core logic. All commands must have validation tests.
