# Claude Context - American Mahjong Project

This document provides context for AI assistants (Claude, etc.) working on this codebase.

## Project Summary

**What**: Cross-platform American Mahjong (NMJL rules)
**Stack**: Rust backend (game logic + Axum WebSocket server) + TypeScript/React frontend (Vite; optional Tauri)
**Stage**: Backend complete (v0.1.0); frontend actively integrating and expanding

## Key Architecture Principles

### 1. Server-Authoritative Design

- Rust backend holds the single source of truth.
- Frontend is presentation-only; never trusted for authoritative game state.
- All game actions are commands sent to server; server responds with events.
- Prevents cheating and ensures multiplayer consistency.

### 2. Command/Event Pattern

- Commands: client intent (e.g., discard a tile)
- Events: server reality (e.g., tile discarded, next player's turn)
- Enables validation on server, optimistic UI, event sourcing, and easy testing.

### 3. Type-Driven State Machine

- Rust enums make impossible states impossible.
- Example: cannot discard during Charleston phase.
- Compile-time guarantees prevent entire classes of bugs.

### 4. Data-Driven Patterns

- NMJL card patterns stored as structured data, not code.
- 2017–2025 card data available.
- Variable suits (VSUIT1/2/3) support flexible matching.
- Proven format across multiple years.

## Project Structure

```text
mpmahj/
├── apps/client/              # React + TypeScript frontend (Vite; optional Tauri)
│   ├── src/                  # TS/React source
│   └── src-tauri/            # Tauri desktop wrapper
├── crates/
│   ├── mahjong_core/         # Pure game logic (no I/O)
│   ├── mahjong_server/       # Axum WebSocket server
│   └── mahjong_ai/           # Bot strategies + MCTS engine
├── data/                     # NMJL cards 2017-2025 (JSON)
├── docs/architecture/        # Technical design docs
├── PLANNING.md               # User experience spec
└── README-ARCH.md            # Architecture overview
```

## Key Files to Know

### Documentation (Read First)

**Backend Implementation (Source of Truth)**:

- Rustdoc — run `cargo doc --open --no-deps` for full API documentation:
  - [crates/mahjong_core/src/command.rs](crates/mahjong_core/src/command.rs)
  - [crates/mahjong_core/src/event.rs](crates/mahjong_core/src/event.rs)
  - [crates/mahjong_core/src/table.rs](crates/mahjong_core/src/table.rs)
  - [crates/mahjong_core/src/flow.rs](crates/mahjong_core/src/flow.rs)

**Architecture & Planning**:

- [PLANNING.md](PLANNING.md) — User stories, game flow, requirements
- [docs/README.md](docs/README.md) — Documentation navigation
- [docs/adr/](docs/adr/) — Architecture Decision Records (ADRs)
- [docs/implementation/](docs/implementation/) — Implementation specs

### Configuration

- [package.json](package.json) — Monorepo scripts, checks
- [Cargo.toml](Cargo.toml) — Rust workspace definition
- [knip.json](knip.json) — Unused code detection config

### Data

- [data/cards/](data/cards/) — NMJL card data (2017–2025)
- Unified card format (`unified_cardYYYY.json`): metadata + histograms for validation
- Histogram representation:
  - Tiles → `u8` indices (0–41)
  - Hands → `[u8; 42]` frequency arrays
  - Validation via vector subtraction: `deficiency = max(0, target[i] - hand[i])`
- Tile index map: see [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md)

## American Mahjong Rules (Quick Reference)

### Tiles

- 152 total: 3 suits × 4 of each (1–9), 4 Winds, 3 Dragons, 8 Jokers, Flowers
- Jokers are wild: can substitute in sets (not pairs, with limited exceptions)
- Internal representation: indices 0–41 for histogram validation

### Game Flow

1. Setup: deal 13 tiles per player (14 to East/dealer)
2. Charleston: mandatory exchange (Right → Across → Left), with second/courtesy options
3. Main game: draw, discard, call loop
4. Calling: discards for Pungs/Kongs/Quints (not sequences)
5. Mahjong: first to complete a pattern wins

### Charleston Details (Complex!)

- First Charleston: mandatory (Right → Across → Left)
- Blind pass/steal: on last pass, exchange 1–2 tiles instead of 3
- Stop vote: any player can stop after first Charleston
- Second Charleston: optional (Left → Across → Right), unanimous consent
- Courtesy pass: optional across-only (0–3 tiles)

This is a unique American rule and a key implementation challenge.

### Validation Challenge

- Players must match 14 tiles to one of ~6000 concrete target-hands (expanded variations).
- Performance-critical: real-time validation for AI decision-making.
- Histogram-based solution:
  - Pre-compile variations into histograms at load time
  - Hand validation: O(1) vector subtraction
  - Distance-to-win: `sum(max(0, target - hand))`
  - Enables MCTS simulations (1000+ evaluations/second)
- Joker handling via histogram adjustments.
- Unified card format combines metadata + engine data.

## Development Workflow

### Running the Project

```bash
npm install
npm run dev            # Client (web)
cd crates/mahjong_server && cargo run   # Server (ws://localhost:3000/ws)
npm run check:all     # Lints, formatting, tests
```

### Generating TypeScript Bindings

TypeScript type definitions are auto-generated from Rust using `ts-rs`:

```bash
cd crates/mahjong_core
cargo test export_bindings

# Output: apps/client/src/types/bindings/generated/*.ts
```

Note: Bindings are generated via test cases (not a build feature). Any type with `#[derive(TS)]` has an `export_bindings_*` test.

### Running the Server

```bash
cd crates/mahjong_server
cargo run            # ws://localhost:3000/ws
cargo run --release
```

Optional database support:

```bash
export DATABASE_URL="postgresql://user:pass@localhost/mahjong"
cargo run
# Without DATABASE_URL, the server runs in memory-only mode
```

### Code Quality Standards

- TypeScript: ESLint + Prettier
- Rust: Clippy + rustfmt
- Markdown: markdownlint
- Unused code: Knip detects unused exports/dependencies

All code must pass linting before commit.

### Multi-Year Card Support

Supports NMJL card years: **2017, 2018, 2019, 2020, 2025**.

Card year selection:

1. Tests use a single configurable year — edit [crates/mahjong_core/src/test_utils.rs](crates/mahjong_core/src/test_utils.rs):

```rust
pub const TEST_CARD_YEAR: u16 = 2025;  // 2017, 2018, 2019, 2020, or 2025
```

1. Runtime: include `card_year` in room creation payloads (defaults to 2025).
2. Terminal client: CLI `--card-year 2020` or interactive `create 2019`.
3. Frontend: provide a simple year selector sourced from [data/cards/](data/cards/).

Adding a new card year:

1. Add `data/cards/unified_cardYYYY.json` (schema-compatible)
2. Update server card loader accordingly
3. Update test utilities if needed
4. Run `cargo test --workspace`

## Current Implementation Status

### ✅ Backend Complete

Core Game Logic (mahjong_core):

- ✅ Full state machine (WaitingForPlayers → Setup → Charleston → Playing → Scoring → GameOver)
- ✅ Command/Event pattern with validation
- ✅ Charleston (all 6 stages: FirstRight/Across/Left → Voting → SecondLeft/Across/Right → Courtesy)
- ✅ Turn flow (Drawing → Discarding → CallWindow)
- ✅ Win validation against NMJL patterns (2017-2025 cards)
- ✅ Joker handling and substitution
- ✅ Meld validation (Pung, Kong, Quint)
- ✅ BasicBot integrated

AI System (mahjong_ai):

- ✅ 4 difficulty levels (Basic, Easy, Medium, Hard)
- ✅ Monte Carlo Tree Search (MCTS) engine
- ✅ Strategic evaluation and probability calculations
- ✅ Greedy AI with expected value maximization

Server & Networking (mahjong_server):

- ✅ WebSocket with Axum
- ✅ Session management (timeout, heartbeat, reconnection)
- ✅ Room management (create, join, leave, close)
- ✅ Authentication (guest + token-based)
- ✅ Rate limiting (IP-based, configurable)
- ✅ Bot takeover for disconnected players
- ✅ Event visibility filtering (public vs private)
- ✅ PostgreSQL persistence (optional)
- ✅ Replay system (player-filtered and admin views)
- ✅ TypeScript bindings auto-generated

Test Coverage:

- ✅ 211 tests passing (39 AI + 131 core + 37 server + 6 terminal)
- ✅ Integration tests for Charleston, turn flow, calling, winning
- ✅ Network integration tests (auth, rooms, events)
- ✅ Full game lifecycle test (setup → charleston → playing → win)

### 🚧 In Progress

- Frontend UI components
- Client state management
- WebSocket integration in React

### 📋 Planned

- Matchmaking UI
- Replay viewer UI
- Player statistics dashboard
- Mobile-responsive design

## Design Decisions & Rationale

### Why Rust for Backend?

- Type safety prevents invalid game states
- Performance for complex validation (Joker permutations)
- Memory safety for server (no crashes from bad input)
- Zero-cost abstractions for clean architecture

### Why React + Tauri?

- React for rich, interactive UI
- Tauri for native desktop performance (smaller than Electron)
- Web deployment possible with same codebase
- TypeScript for type safety on frontend

### Why Command/Event Pattern?

- Server authority prevents cheating
- Event sourcing enables replay/debugging
- Clean separation of concerns
- Easy to test (mock events)

### Why Histogram-Based Validation?

Problem: American Mahjong requires checking a 14-tile hand against thousands of variations in real-time.

Traditional approach issues:

- String parsing: `"1B 2B 3B"` → expensive per check
- Variable suits (`VSUIT1`, `VSUIT2`): exponential permutations
- Joker substitution: combinatorial explosion

Histogram solution:

1. **Pre-Compilation**: At server startup, expand all patterns into concrete histograms
   - "Any Bam suit 1-2-3-4" → 1 histogram `[1,1,1,1,0,0,0,0,0, ...]`
   - Store ~500 histograms (~21KB total)
2. **O(1) Validation**: Convert hand to histogram, subtract from target
   - No string parsing, no branching
   - Pure arithmetic: `deficiency = sum(max(0, target - hand))`
3. **Performance**: 10,000+ hands validated per second
   - Critical for MCTS AI (needs to evaluate thousands of game states)
   - Enables real-time "distance to win" analysis

Trade-off: slightly increased storage for massive speed gains.

## Data Pipeline: NMJL Cards to Engine

Pattern data flow from human-readable formats to engine-ready histograms:

```text
NMJL Card (physical)
  → data/cards/nmjl_card_YYYY.json (legacy format with tile codes)
  → data/cards/unified_cardYYYY.json (current format)
     ├─ Pattern metadata (name, score, section, concealed flag)
     └─ Pre-compiled histograms [u8; 42] for each variation
  → mahjong_core::rules::card::UnifiedCard::from_json()
  → mahjong_core::rules::validator::HandValidator
     └─ In-memory lookup table of ~500 AnalysisEntry structs
  → Hand::calculate_deficiency() - O(1) validation
```

Key files:

- [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md) - Histogram format specification
- [crates/mahjong_core/src/rules/card.rs](crates/mahjong_core/src/rules/card.rs) - UnifiedCard parser
- [crates/mahjong_core/src/rules/validator.rs](crates/mahjong_core/src/rules/validator.rs) - HandValidator engine
- [crates/mahjong_core/src/hand.rs](crates/mahjong_core/src/hand.rs) - Hand histogram calculation

Adding a new card year:

1. Create `data/cards/unified_cardYYYY.json` following the schema
2. Update `mahjong_server/src/network/room.rs` to use new card (change `include_str!()`)
3. Run tests to verify all patterns parse correctly: `cargo test --package mahjong_core unified_card`

## Common Tasks for AI Assistants

### When Adding a Feature

1. Check [PLANNING.md](PLANNING.md) for user requirements
2. Review relevant architecture docs
3. Update tests alongside code
4. Follow existing patterns (don't introduce new paradigms without discussion)

### When Writing Rust Code

- Use enums for state machines
- Prefer `Result<T, E>` over panics
- Document public APIs with rustdoc (`///` and `//!`):
  - Module docs (`//!`) explain purpose and high-level concepts
  - Item docs (`///`) include examples, validation rules, constraints
  - Cross-reference architecture docs with relative paths
- Keep `mahjong_core` pure (no I/O, no dependencies)
- Verify docs render correctly: `cargo doc --open --no-deps`

### When Writing TypeScript

- Use strict mode
- Prefer functional components + hooks
- Type everything (no `any` without justification)
- Follow component structure in `apps/client/src/`

### When Editing Documentation

For Backend (Rust):

- Prefer rustdoc (`///` and `//!`) for implementation details
- Include code examples in rustdoc blocks: ` ```rust` or ` ```ignore`
- Regenerate docs after changes: `cargo doc --open --no-deps`
- Add `FRONTEND_INTEGRATION_POINT` comments before client-facing types

For Markdown docs:

- Use markdown only for architecture, planning, and workflows
- Keep [docs/architecture/00-ARCHITECTURE.md](docs/architecture/00-ARCHITECTURE.md) index up-to-date
- Use markdownlint rules (see [.markdownlint.json](.markdownlint.json))
- Link between docs for discoverability
- Reference rustdoc for implementation details rather than duplicating

### When Debugging

- Check state machine: "Is this state transition valid?"
- Check command/event flow: "Did server emit the right event?"
- Check pattern matching: "Are variable suits resolved correctly?"

## Gotchas & Edge Cases

### Charleston Synchronization

- All 4 players are selecting tiles simultaneously
- Need timeout handling (auto-select random tiles)
- Blind pass/steal complicates the "3 tiles" rule
- Stop vote requires all players to respond

### Joker Validation

- Jokers can represent multiple tiles
- Must try all combinations to validate a hand
- Jokers can't be passed in Charleston
- Some patterns allow Joker pairs, most don't

### Call Priority

- Multiple players can call the same discard
- Mahjong (win) > Pung/Kong
- If tied, closest player (turn order) wins
- Server must resolve conflicts atomically

### Pattern Matching

- Some patterns have joker restrictions
- Some tiles in patterns are "flexible" (can be jokers)
- Variable suits must be consistent within a pattern
- Dragons/Winds/Flowers don't participate in suits

## Testing Strategy

### Unit Tests

- Pure logic in `mahjong_core` (tile matching, hand validation)
- Stateless functions are easy to test

### Integration Tests

- Command → Event flow
- State machine transitions
- Charleston orchestration

### End-to-End Tests

- Full game simulation (4 players, Charleston, win)
- Network protocol (WebSocket messages)

### Property-Based Tests (Future)

- Generate random hands, verify validation is correct
- Fuzz testing for robustness

## Resources

### External Documentation

- [NMJL Official Rules](https://www.nationalmahjonggleague.org/) (reference, not copied)
- NMJL cards are copyrighted; our data is structured representation for validation

### Internal Documentation

- [PLANNING.md](PLANNING.md) - Complete user experience spec
- [docs/architecture/](docs/architecture/) - Technical architecture
- [README-ARCH.md](README-ARCH.md) - Architecture quick reference

## Communication Guidelines

When working on this project:

- **Prefer explicit over clever**: Code will be maintained by others
- **Document why, not what**: Code shows what; comments explain why
- **Test edge cases**: American Mahjong has many special rules
- **Ask before major changes**: Architecture is intentional, discuss before diverging

## Version History

- v0.1.0: Initial backend complete, architecture planning, data import
- Future versions will follow semver

## License

TBD (not yet determined)

---

**Last Updated**: 2026-01-24
**Maintainer**: Project owner (see git history)
