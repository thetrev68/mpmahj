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

```
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

- [PLANNING.md](PLANNING.md) - User stories, game flow, feature requirements
- [docs/architecture/00-ARCHITECTURE.md](docs/architecture/00-ARCHITECTURE.md) - Architecture index
- [docs/architecture/04-state-machine-design.md](docs/architecture/04-state-machine-design.md) - Game phases, Charleston, turn flow
- [docs/architecture/05-data-models.md](docs/architecture/05-data-models.md) - Core data structures
- [docs/architecture/06-command-event-system-api-contract.md](docs/architecture/06-command-event-system-api-contract.md) - API design
- [docs/architecture/07-the-card-schema.md](docs/architecture/07-the-card-schema.md) - Pattern format explained

### Configuration

- [package.json](package.json) - Monorepo scripts, workspaces
- [Cargo.toml](Cargo.toml) - Rust workspace definition
- [knip.json](knip.json) - Unused code detection config
- [.prettierrc](.prettierrc) - Code formatting rules
- [.markdownlint.json](.markdownlint.json) - Markdown linting rules

### Data

- `data/nmjl_cards/` - NMJL card JSONs (2017-2025)
- Pattern format uses:
  - Tile codes: `1B`, `2C`, `3D`, `W`, `R`, `G`, `F`, `N`, `E`, `S`, `Jkr`
  - Variable suits: `VSUIT1`, `VSUIT2`, `VSUIT3`
  - Flexibility indicators for joker eligibility

## American Mahjong Rules (Quick Reference)

### Tiles

- **152 total**: 3 suits (Bam, Crak, Dot) × 4 of each (1-9), 4 Winds, 3 Dragons, 8 Jokers
- **Jokers are wild**: Can substitute for any tile in sets (not pairs, with exceptions)

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

- Players must match their 14 tiles to one of ~40-50 patterns on the annual card
- Jokers complicate this (can represent any tile)
- Validation engine must try all Joker combinations
- Patterns use variable suits for flexibility

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

### Code Quality Standards

- **TypeScript**: ESLint + Prettier
- **Rust**: Clippy + rustfmt
- **Markdown**: markdownlint
- **Unused code**: Knip detects unused exports/dependencies

All code must pass linting before commit.

## Current Implementation Status

### ✅ Completed

- Monorepo structure
- NMJL card data (2017-2025) in structured format
- Code quality tooling
- Architecture documentation (state machine, data models, API contract)

### 🚧 In Progress

- Core game logic (mahjong_core crate)
- Charleston implementation
- Win validation engine
- Frontend UI components

### 📋 Planned

- Command/Event system
- WebSocket networking
- AI opponents
- Multiplayer matchmaking

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

### Why Variable Suits (VSUIT)?

- NMJL patterns often say "any suit" or "same suit"
- Storing all permutations would be massive
- VSUIT1/2/3 are placeholders resolved at validation time
- Proven approach (5 years of card data uses this format)

## Common Tasks for AI Assistants

### When Adding a Feature

1. Check [PLANNING.md](PLANNING.md) for user requirements
2. Review relevant architecture docs
3. Update tests alongside code
4. Follow existing patterns (don't introduce new paradigms without discussion)

### When Writing Rust Code

- Use enums for state machines
- Prefer `Result<T, E>` over panics
- Document public APIs
- Keep `mahjong_core` pure (no I/O, no dependencies)

### When Writing TypeScript

- Use strict mode
- Prefer functional components + hooks
- Type everything (no `any` without justification)
- Follow component structure in `apps/client/src/`

### When Editing Documentation

- Keep [docs/architecture/00-ARCHITECTURE.md](docs/architecture/00-ARCHITECTURE.md) index up-to-date
- Use markdownlint rules (see [.markdownlint.json](.markdownlint.json))
- Link between docs for discoverability

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
