# Claude Context - American Mahjong Project

This document provides context for AI assistants (Claude, etc.) working on this codebase.

## Project Summary

**What**: A cross-platform American Mahjong game (NMJL rules)
**Stack**: Rust backend (game logic + server) + TypeScript React frontend (Vite + Tauri)
**Stage**: Early development - architecture and core systems in design/implementation phase

## Key Architecture Principles

### 1. Server-Authoritative Design

- **Rust backend holds the single source of truth**
- Frontend is presentation-only, never trusted for game state
- All game actions are commands sent to server, server responds with events
- This prevents cheating and ensures multiplayer consistency

### 2. Command/Event Pattern

- **Commands**: Client intent (e.g., "I want to discard this tile")
- **Events**: Server reality (e.g., "Tile was discarded, next player's turn")
- Clean separation enables:
  - Validation on server
  - Optimistic UI on client
  - Event sourcing (replay capability)
  - Easy testing

### 3. Type-Driven State Machine

- Use Rust enums to make impossible states impossible
- Example: Can't discard during Charleston phase (different enum variant)
- Compile-time guarantees prevent entire classes of bugs

### 4. Data-Driven Patterns

- NMJL card patterns stored as data, not code
- Currently have 2017-2025 card data in structured JSON format
- Variable suits (VSUIT1/2/3) for flexible pattern matching
- Pattern format is proven (5 years of data)

## Project Structure

```text
mpmahj/
├── apps/client/              # React frontend
│   ├── src/                  # TS/React source
│   └── src-tauri/            # Tauri desktop wrapper
├── crates/
│   ├── mahjong_core/         # Pure game logic (no I/O)
│   └── mahjong_server/       # Axum server + WebSocket
├── data/                     # NMJL cards 2017-2025 (JSON)
├── docs/architecture/        # Technical design docs
├── PLANNING.md               # User experience spec
└── README-ARCH.md            # Architecture overview
```

## Key Files to Know

### Documentation (Read First)

**Backend Implementation (Source of Truth)**:

- **Rustdoc** - Run `cargo doc --open --no-deps` for full API documentation
  - [command.rs](crates/mahjong_core/src/command.rs) - Player action validation with examples
  - [event.rs](crates/mahjong_core/src/event.rs) - Server response types and visibility rules
  - [table.rs](crates/mahjong_core/src/table.rs) - Core game state machine
  - [flow.rs](crates/mahjong_core/src/flow.rs) - Phase and turn management
  - Look for `FRONTEND_INTEGRATION_POINT` markers for client-server boundaries

**Architecture & Planning**:

- [PLANNING.md](PLANNING.md) - User stories, game flow, feature requirements
- [docs/README.md](docs/README.md) - Documentation guide and navigation
- [docs/adr/](docs/adr/) - Architecture Decision Records (ADRs) documenting key design decisions
  - ADR-0001: Histogram-first core models
  - ADR-0002: Precomputed pattern histograms
  - ADR-0006: Server-authoritative client state
  - See full list in [docs/adr/](docs/adr/)
- [docs/implementation/](docs/implementation/) - Current implementation specifications
  - [frontend-integration.md](docs/implementation/frontend/frontend-integration.md) - Frontend integration guide
  - [remaining-work.md](docs/implementation/backend/remaining-work.md) - Backend TODO tracker

### Configuration

- [package.json](package.json) - Monorepo scripts, workspaces
- [Cargo.toml](Cargo.toml) - Rust workspace definition
- [knip.json](knip.json) - Unused code detection config
- [.prettierrc](.prettierrc) - Code formatting rules
- [.markdownlint.json](.markdownlint.json) - Markdown linting rules

### Data

- `data/cards/` - NMJL card data (2017-2025)
- **Unified Card Format** (`unified_card2025.json`):
  - Human-readable pattern metadata (names, scores, sections)
  - Engine-ready histograms for O(1) validation
  - Consolidated format eliminates translation overhead
- **Histogram Representation**:
  - Tiles represented as u8 indices (0-41)
  - Hands stored as frequency arrays `[u8; 42]`
  - Win validation via vector subtraction: `deficiency = max(0, target[i] - hand[i])`
  - Enables thousands of pattern checks per millisecond
- **Tile Index Map** (see [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md)):
  - Indices 0-8: Bams (1B-9B)
  - Indices 9-17: Craks (1C-9C)
  - Indices 18-26: Dots (1D-9D)
  - Indices 27-30: Winds (E, S, W, N)
  - Indices 31-33: Dragons (Green, Red, White/Soap)
  - Index 34: Flowers
  - Indices 35-41: Padding (reserved)

## American Mahjong Rules (Quick Reference)

### Tiles

- **152 total**: 3 suits (Bam, Crak, Dot) × 4 of each (1-9), 4 Winds, 3 Dragons, 8 Jokers, 8 Flowers
- **Jokers are wild**: Can substitute for any tile in sets (not pairs, with exceptions)
- **Internal Representation**: Each tile maps to an index 0-41 for histogram-based validation

### Game Flow

1. **Setup**: Deal 13 tiles per player (14 to East/dealer)
2. **Charleston**: Mandatory tile exchange phase (pass Right, Across, Left)
   - Optional second Charleston
   - Optional courtesy pass
   - Jokers cannot be passed
3. **Main Game**: Draw, discard, call loop
   - Players try to form a winning hand matching a pattern on "The Card"
4. **Calling**: Can call discards for Pungs/Kongs/Quints (NOT sequences)
5. **Mahjong**: First player to complete a pattern wins

### Charleston Details (Complex!)

- **First Charleston**: Mandatory (Right → Across → Left)
- **Blind pass/steal**: On last pass, can exchange 1-2 tiles instead of 3
- **Stop vote**: Any player can stop after first Charleston
- **Second Charleston**: Optional (Left → Across → Right), requires unanimous consent
- **Courtesy pass**: Optional across-only negotiation (0-3 tiles)

This is a unique American rule and a key implementation challenge.

### Validation Challenge

- Players must match their 14 tiles to one of ~500+ pattern variations on the annual card
- **Performance-Critical**: Validation must be real-time for AI decision-making
- **Histogram-Based Solution**:
  - Pre-compile all pattern variations into histograms at load time
  - Hand validation: O(1) vector subtraction across 42 indices
  - "Distance to win" calculation: `sum(max(0, target[i] - hand[i]))`
  - Enables MCTS simulations (1000+ hands/second)
- Jokers handled via histogram adjustments during analysis
- Unified card format (`unified_card2025.json`) combines human-readable metadata with engine-ready data

## Development Workflow

### Running the Project

```bash
npm install              # Install all dependencies
npm run dev             # Run client in dev mode
npm run lint            # Lint TypeScript + Markdown
npm run lint:rust       # Lint Rust code
npm run format          # Format all code
npm test                # Run all tests
```

### Generating TypeScript Bindings

TypeScript type definitions are auto-generated from Rust types using `ts-rs`:

```bash
# Generate bindings by running the export tests
cd crates/mahjong_core
cargo test export_bindings

# Bindings are written to:
# apps/client/src/types/bindings/generated/*.ts
```

**Note:** The bindings are generated via test cases (not a build feature). Each type annotated with `#[derive(TS)]` has a corresponding `export_bindings_*` test that generates its `.ts` file.

### Running the Server

```bash
# Development mode (with hot reload)
cd crates/mahjong_server
cargo run

# Release mode (optimized)
cargo run --release

# WebSocket endpoint available at:
# ws://localhost:3000/ws
```

**Optional Database Support:**

```bash
# Set DATABASE_URL for PostgreSQL persistence
export DATABASE_URL="postgresql://user:pass@localhost/mahjong"
cargo run

# Without DATABASE_URL, server runs in memory-only mode
```

### Code Quality Standards

- **TypeScript**: ESLint + Prettier
- **Rust**: Clippy + rustfmt
- **Markdown**: markdownlint
- **Unused code**: Knip detects unused exports/dependencies

All code must pass linting before commit.

### Multi-Year Card Support

The game supports NMJL card years: **2017, 2018, 2019, 2020, and 2025**.

**Card Year Selection in Code:**

1. **Test Year Configuration** - All tests use a single configurable year:
   - Edit [crates/mahjong_core/src/test_utils.rs](crates/mahjong_core/src/test_utils.rs):

     ```rust
     pub const TEST_CARD_YEAR: u16 = 2025;  // Change to: 2017, 2018, 2019, 2020, or 2025
     ```

   - All test files automatically use this year via `load_test_card_json()`
   - No need to update individual test files - change once, affects all tests

2. **Runtime Year Selection**:
   - **Server API**: `CreateRoomPayload` now includes `card_year: u16` field (defaults to 2025)
   - **Terminal Client**:
     - CLI flag: `--card-year 2020`
     - Interactive: `create 2019`
   - **Frontend**: Use `getAvailableYears()` from cardLoader.ts to populate UI dropdown

3. **Card Loading**:
   - Runtime: [crates/mahjong_server/src/resources.rs](crates/mahjong_server/src/resources.rs) `load_card_resources(year)` function
   - Tests: Use `mahjong_core::test_utils::load_test_card_json()` - automatically uses `TEST_CARD_YEAR`

**Adding a New Card Year:**

1. Add `data/cards/unified_cardYYYY.json` following the schema
2. Update `load_card_resources()` in [resources.rs](crates/mahjong_server/src/resources.rs)
3. Update `load_test_card_json()` in [test_utils.rs](crates/mahjong_core/src/test_utils.rs)
4. Update `getAvailableYears()` in [cardLoader.ts](apps/client/src/utils/cardLoader.ts)
5. Run tests: `cargo test --workspace`

## Current Implementation Status

### ✅ Backend Complete (Ready for Frontend!)

**Core Game Logic (mahjong_core):**

- ✅ Full state machine (WaitingForPlayers → Setup → Charleston → Playing → Scoring → GameOver)
- ✅ Command/Event pattern with validation
- ✅ Charleston (all 6 stages: FirstRight/Across/Left → Voting → SecondLeft/Across/Right → Courtesy)
- ✅ Turn flow (Drawing → Discarding → CallWindow)
- ✅ Win validation against NMJL patterns (2017-2025 cards)
- ✅ Joker handling and substitution
- ✅ Meld validation (Pung, Kong, Quint)
- ✅ BasicBot integrated

**AI System (mahjong_ai):**

- ✅ 4 difficulty levels (Basic, Easy, Medium, Hard)
- ✅ Monte Carlo Tree Search (MCTS) engine
- ✅ Strategic evaluation and probability calculations
- ✅ Greedy AI with expected value maximization

**Server & Networking (mahjong_server):**

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

**Test Coverage:**

- ✅ 211 tests passing (39 AI + 131 core + 37 server + 6 terminal)
- ✅ Integration tests for Charleston, turn flow, calling, winning
- ✅ Network integration tests (auth, rooms, events)
- ✅ Full game lifecycle test (setup → charleston → playing → win)

### 🚧 In Progress

- Frontend UI components
- Client state management
- WebSocket integration in React

### 📋 Planned

- Multiplayer matchmaking UI
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

**Problem**: American Mahjong requires checking a 14-tile hand against 500+ pattern variations in real-time.

**Traditional Approach Issues**:

- String parsing: `"1B 2B 3B"` → expensive per check
- Variable suits (`VSUIT1`, `VSUIT2`): exponential permutations
- Joker substitution: combinatorial explosion

**Histogram Solution**:

1. **Pre-Compilation**: At server startup, expand all patterns into concrete histograms
   - "Any Bam suit 1-2-3-4" → 1 histogram `[1,1,1,1,0,0,0,0,0, ...]`
   - Store ~500 histograms (~21KB total)
2. **O(1) Validation**: Convert hand to histogram, subtract from target
   - No string parsing, no branching
   - Pure arithmetic: `deficiency = sum(max(0, target - hand))`
3. **Performance**: 10,000+ hands validated per second
   - Critical for MCTS AI (needs to evaluate thousands of game states)
   - Enables real-time "distance to win" analysis

**Trade-off**: Increased storage (500 histograms vs 50 patterns) for massive speed gain.

## Data Pipeline: NMJL Cards to Engine

Understanding how pattern data flows from human-readable formats to the engine:

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

**Key Files**:

- [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md) - Histogram format specification
- [crates/mahjong_core/src/rules/card.rs](crates/mahjong_core/src/rules/card.rs) - UnifiedCard parser
- [crates/mahjong_core/src/rules/validator.rs](crates/mahjong_core/src/rules/validator.rs) - HandValidator engine
- [crates/mahjong_core/src/hand.rs](crates/mahjong_core/src/hand.rs) - Hand histogram calculation

**Adding a New Card Year**:

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
- **Document public APIs with rustdoc (`///` and `//!`)**:
  - Module docs (`//!`) explain purpose and high-level concepts
  - Item docs (`///`) include examples, validation rules, and constraints
  - Cross-reference architecture docs with relative paths
  - Add `FRONTEND_INTEGRATION_POINT` markers for client-facing types
- Keep `mahjong_core` pure (no I/O, no dependencies)
- Verify docs render correctly: `cargo doc --open --no-deps`

### When Writing TypeScript

- Use strict mode
- Prefer functional components + hooks
- Type everything (no `any` without justification)
- Follow component structure in `apps/client/src/`

### When Editing Documentation

**For Backend (Rust)**:

- Prefer rustdoc (`///` and `//!`) for implementation details
- Include code examples in rustdoc blocks: ` ```rust` or ` ```ignore`
- Regenerate docs after changes: `cargo doc --open --no-deps`
- Add `FRONTEND_INTEGRATION_POINT` comments before client-facing types

**For Markdown Docs**:

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

- **v0.1.0**: Initial setup, architecture planning, data import
- Future versions will follow semver

## License

TBD (not yet determined)

---

**Last Updated**: 2026-01-02
**Maintainer**: Project owner (see git history)
