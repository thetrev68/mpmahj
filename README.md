# American Mahjong Game

A modern, cross-platform implementation of American Mahjong (NMJL rules) built with Rust and TypeScript.

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

**Early Development** - Core architecture and data models are being designed and implemented.

### Completed

- ✅ Project structure and monorepo setup
- ✅ NMJL card data (2017-2025) converted to structured format
- ✅ Code quality tooling (ESLint, Prettier, Markdownlint, Knip, Clippy)
- ✅ Architecture planning (state machine, data models, API contracts)

### In Progress

- 🚧 Core game logic implementation
- 🚧 Charleston system
- 🚧 Win validation engine
- 🚧 Frontend UI components

### Planned

- Command/Event system (client-server API)
- Network protocol (WebSocket)
- AI opponents (beginner/intermediate/advanced)
- Multiplayer matchmaking

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

# Run client (workspace-specific)
npm run dev:client

# Lint all code
npm run lint

# Lint Rust code
npm run lint:rust

# Format all code
npm run format

# Run tests
npm test
```

## Documentation

- **[PLANNING.md](PLANNING.md)** - User experience, game flow, and feature specifications
- **[docs/architecture/](docs/architecture/)** - Technical architecture documentation
  - [00-ARCHITECTURE.md](docs/architecture/00-ARCHITECTURE.md) - Architecture overview and index
  - [04-state-machine-design.md](docs/architecture/04-state-machine-design.md) - Game state machine
  - [05-data-models.md](docs/architecture/05-data-models.md) - Core data structures
  - [06-command-event-system-api-contract.md](docs/architecture/06-command-event-system-api-contract.md) - Client-server API
  - [07-the-card-schema.md](docs/architecture/07-the-card-schema.md) - Pattern representation

## Game Rules Reference

This implementation follows the **National Mah Jongg League (NMJL)** rules for American Mahjong:

- 152 tiles (including 8 Jokers)
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
