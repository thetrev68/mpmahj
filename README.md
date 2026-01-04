# American Mahjong Game

A modern, cross-platform implementation of American Mahjong (NMJL rules) Built with Rust and TypeScript.

## Performance & Architecture

This project utilizes a **Data-Oriented Design** for its core engine to support high-speed Monte Carlo simulations and real-time analysis:

- **Histogram-First Representation**: Tiles are represented as u8 indices (0-36). Hands maintain an internal frequency histogram for O(1) lookups.
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

**Backend Complete! Ready for Frontend Development** 🎉

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

- **Framework**: React 18 with TypeScript
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

- **[CLAUDE.md](CLAUDE.md)** - AI assistant context and development guide
- **[PLANNING.md](PLANNING.md)** - User experience, game flow, and feature specifications
- **[docs/architecture/](docs/architecture/)** - Technical architecture documentation
  - [00-ARCHITECTURE.md](docs/architecture/00-ARCHITECTURE.md) - Architecture overview and index
  - [04-state-machine-design.md](docs/architecture/04-state-machine-design.md) - Game state machine
  - [05-data-models.md](docs/architecture/05-data-models.md) - Core data structures
  - [06-command-event-system-api-contract.md](docs/architecture/06-command-event-system-api-contract.md) - Client-server API
  - [07-the-card-schema.md](docs/architecture/07-the-card-schema.md) - Pattern representation

## Frontend Quick Start

The backend is complete and ready for integration. Here's what you need to know:

### WebSocket Protocol

Connect to `ws://localhost:3000/ws` and exchange JSON messages:

```typescript
// 1. Authenticate (first message required)
ws.send(
  JSON.stringify({
    type: 'Authenticate',
    credentials: { Guest: { username: 'Player1' } },
  })
);

// 2. Create or join a room
ws.send(
  JSON.stringify({
    type: 'CreateRoom',
    config: { bot_difficulty: 'Easy' },
  })
);

// 3. Send game commands
ws.send(
  JSON.stringify({
    type: 'Command',
    command: {
      DiscardTile: {
        player: 'East',
        tile: { suit: 'Bams', rank: { Number: 5 } },
      },
    },
  })
);

// 4. Receive events
ws.onmessage = (msg) => {
  const envelope = JSON.parse(msg.data);
  if (envelope.type === 'Event') {
    handleGameEvent(envelope.event);
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

- **Commands**: See [GameCommand.ts](apps/client/src/types/bindings/generated/GameCommand.ts)
- **Events**: See [GameEvent.ts](apps/client/src/types/bindings/generated/GameEvent.ts)
- **State**: See [GamePhase.ts](apps/client/src/types/bindings/generated/GamePhase.ts)
- **Network**: See [networking_integration.rs](crates/mahjong_server/tests/networking_integration.rs) for full flow examples

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
