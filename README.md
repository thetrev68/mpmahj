# American Mahjong Game

A modern, cross-platform implementation of American Mahjong (NMJL rules) Built with Rust and TypeScript.

NOTE: For a concise developer snapshot of what's done/remaining/approved and next tasks, see README-STEROIDS.md at the repo root.

## Performance & Architecture

This project utilizes a **Data-Oriented Design** for its core engine to support high-speed Monte Carlo simulations and real-time analysis:

- **Histogram-First Representation**: Tiles are represented as u8 indices (0-41). Hands maintain an internal frequency histogram for O(1) lookups.
- **O(1) Win Validation**: Win validation and "Distance to Win" are calculated via vector subtraction of histograms, enabling thousands of evaluations per millisecond.
- **Unified Card System**: Human-readable pattern metadata and engine-ready histograms are consolidated into a single unified_card.json for zero-mapping overhead.
- **Command/Event Pattern**: State transitions are driven by strictly validated commands and broadcast via deterministic events.

## Project Overview

This is a full-stack American Mahjong game featuring:

- **Server-authoritative architecture** - Rust backend ensures game integrity
- **Cross-platform client** - React + Tauri for desktop, web support planned
- **Type-safe design** - Leveraging Rust's type system for impossible states
- **Annual card support** - Data-driven pattern system supporting NMJL cards from 2017-2025
- **Complete rule implementation** - Full Charleston, calling system, and win validation

## Project Structure

```text
mpmahj/
├── apps/
│   └── client/          # React + TypeScript + Vite frontend
├── crates/
│   ├── mahjong_core/    # Core game logic (tiles, patterns, validation)
│   └── mahjong_server/  # Axum server + WebSocket handling
├── data/                # NMJL card data (2017-2025)
├── docs/
│   └── architecture/    # Technical design documentation
├── PLANNING.md          # User experience and feature planning
└── README-ARCH.md       # Architecture overview (see docs/architecture/)
```

## Current Status

**Backend (mostly) Complete! Ready for Frontend Development** 🎉

### ✅ Backend Completed (v0.1.0)

- **Core Game Logic**: Full state machine, Charleston (all 6 stages), turn flow, win validation
- **AI System**: 4 difficulty levels (Basic → Hard) with MCTS engine
- **Networking**: WebSocket server, session management, room system, authentication
- **Persistence**: PostgreSQL support (optional), event sourcing, replay system
- **Testing**: 211 passing tests with comprehensive coverage
- **Type Safety**: TypeScript bindings auto-generated from Rust types

### 🚧 In Progress

- Frontend UI components (React + TypeScript)
- Client WebSocket integration
- State management setup
- Backend retrofits of missing game features

### 📋 Planned

- Multiplayer matchmaking UI
- Replay viewer interface
- Player statistics dashboard
- Mobile-responsive design

## Tech Stack

### Backend (Rust)

- **Core Logic**: Pure Rust for game rules and validation
- **Server**: Axum web framework
- **Real-time**: WebSocket for multiplayer sync

### Frontend (TypeScript)

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Desktop**: Tauri (native app wrapper)
- **State Management**: TBD (likely Zustand or Jotai)

### Development Tools

- **Linting**: ESLint (TS), Clippy (Rust), Markdownlint
- **Formatting**: Prettier
- **Unused Code**: Knip
- **Version Control**: Git

## Getting Started

### Prerequisites

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **Rust**: Latest stable (for server/core development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd mpmahj

# Install dependencies
npm install

# Build Rust workspace
cargo build
```

### Development

```bash
# Run client in development mode
npm run dev

# Run server (from project root)
cd crates/mahjong_server
cargo run
# Server starts at http://localhost:3000
# WebSocket available at ws://localhost:3000/ws

# Lint all code
npm run lint

# Lint Rust code
npm run lint:rust

# Format all code
npm run format

# Run all tests (TypeScript + Rust)
npm test

# Run only Rust tests
cd crates
cargo test
```

### Card Year Selection

The game supports multiple NMJL card years: **2017, 2018, 2019, 2020, and 2025**.

**For Users (Terminal Client)**:

```bash
# Create a room with 2025 card (default)
cargo run --bin mahjong_terminal -- --bot

# Create a room with 2020 card
cargo run --bin mahjong_terminal -- --bot --card-year 2020

# Interactive mode - use "create <year>" to specify year
cargo run --bin mahjong_terminal
> create 2019
```

**For Developers (Testing)**:

To test with a different card year, edit the constant in [crates/mahjong_core/src/test_utils.rs](crates/mahjong_core/src/test_utils.rs):

```rust
pub const TEST_CARD_YEAR: u16 = 2020;  // Change to 2017, 2018, 2019, 2020, or 2025
```

Then run tests normally - all tests will use the specified year:

```bash
cargo test --workspace
```

**For Frontend Developers**:

Use `getAvailableYears()` from the card loader to populate a year selector:

```typescript
import { getAvailableYears } from '@/utils/cardLoader';

const years = await getAvailableYears(); // [2017, 2018, 2019, 2020, 2025]
// Include card_year in CreateRoom payload
const payload = { card_year: selectedYear };
```

### TypeScript Type Generation

The backend auto-generates TypeScript type definitions from Rust code:

```bash
# Generate TypeScript bindings
cd crates/mahjong_core
cargo test export_bindings

# Generated types appear in:
# apps/client/src/types/bindings/generated/
```

Import them in your frontend:

```typescript
import { GameCommand, GameEvent, Tile, Seat } from '@/types/bindings/generated';
```

## Documentation

### Backend Documentation (Rust)

- **Rustdoc** - Canonical implementation reference for backend code
  - Generate: `cargo doc --open --no-deps` from project root
  - Module docs (`//!`) explain high-level concepts
  - Item docs (`///`) provide examples and validation rules
  - See [crates/mahjong_core/src/](crates/mahjong_core/src/) for core game logic

### Project Documentation (Markdown)

- **[CLAUDE.md](CLAUDE.md)** - AI assistant context and development guide
- **[PLANNING.md](PLANNING.md)** - User experience, game flow, and feature specifications
- **[docs/README.md](docs/README.md)** - Documentation guide and navigation
- **[docs/adr/](docs/adr/)** - Architecture Decision Records (ADRs) documenting key design choices
- **[docs/implementation/](docs/implementation/)** - Current implementation specifications
  - [frontend-integration.md](docs/implementation/frontend/frontend-integration.md) - Frontend WebSocket integration guide
  - [remaining-work.md](docs/implementation/backend/remaining-work.md) - Backend remaining features

## Frontend Quick Start

The backend is complete and ready for integration. Here's what you need to know:

### WebSocket Protocol

Connect to `ws://localhost:3000/ws` and exchange JSON messages:

```typescript
// 1. Authenticate (first message required)
ws.send(
  JSON.stringify({
    kind: 'Authenticate',
    payload: {
      method: 'guest',
      version: '0.1.0',
    },
  })
);

// 2. Create or join a room (with optional card year)
ws.send(
  JSON.stringify({
    kind: 'CreateRoom',
    payload: {
      card_year: 2025, // Optional: 2017, 2018, 2019, 2020, or 2025 (default: 2025)
    },
  })
);

// 3. Send game commands
ws.send(
  JSON.stringify({
    kind: 'Command',
    payload: {
      command: {
        DiscardTile: {
          player: 'East',
          tile: { suit: 'Bams', rank: { Number: 5 } },
        },
      },
    },
  })
);

// 4. Receive events
ws.onmessage = (msg) => {
  const envelope = JSON.parse(msg.data);
  if (envelope.kind === 'Event') {
    handleGameEvent(envelope.payload.event);
  }
};
```

### Suggested Architecture

1. **State Management**: Use Zustand or Jotai (lightweight, server-driven model)
2. **WebSocket Hook**: Create `useGameWebSocket()` for connection lifecycle
3. **Event Reducer**: All `GameEvent` messages update local state
4. **Optimistic UI**: Show actions immediately, rollback on `CommandRejected`
5. **Reconnection**: Use `StateSnapshot` envelope to restore after disconnect

### Key Integration Points

- **Commands**: See [GameCommand.ts](apps/client/src/types/bindings/generated/GameCommand.ts) or `cargo doc` for [command.rs](crates/mahjong_core/src/command.rs)
- **Events**: See [GameEvent.ts](apps/client/src/types/bindings/generated/GameEvent.ts) or `cargo doc` for [event.rs](crates/mahjong_core/src/event.rs)
- **State**: See [GamePhase.ts](apps/client/src/types/bindings/generated/GamePhase.ts) or `cargo doc` for [flow.rs](crates/mahjong_core/src/flow.rs)
- **Network**: See [networking_integration.rs](crates/mahjong_server/tests/networking_integration.rs) for full flow examples
- **Implementation details**: Run `cargo doc --open --no-deps` to browse full rustdoc with examples and validation rules

## Game Rules Reference

This implementation follows the **National Mah Jongg League (NMJL)** rules for American Mahjong:

- 152 tiles (including 8 Jokers) + optional 8 blanks
- Mandatory Charleston (tile exchange phase)
- Annual card with standardized winning patterns
- No sequences for calling (only Pungs, Kongs, Quints)
- Jokers are wild (with restrictions)

See [PLANNING.md](PLANNING.md) for detailed game flow and user experience design.

## Contributing

This is an early-stage project. Contribution guidelines will be established as the codebase matures.

### Code Quality

All code must pass:

```bash
npm run lint        # TypeScript/Markdown linting
npm run lint:rust   # Rust Clippy
npm run format      # Prettier formatting
```

## License

TBD

## Acknowledgments

- National Mah Jongg League (NMJL) for standardized American Mahjong rules
- NMJL card data (2017-2025) for pattern validation

## Open Questions

### House Rules for Scoring?

1. Doubling score for winning on the last tile in the deck?
2. Extra points for self-drawn wins?
3. Penalties if you throw the winning tile?
