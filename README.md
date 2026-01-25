# American Mahjong (NMJL)

Modern, cross-platform American Mahjong under NMJL rules, with a Rust backend and a TypeScript/React frontend (Vite + optional Tauri desktop).

Quick links:

- Project overview: [README-ARCH.md](README-ARCH.md)
- Assistant context: [Agents.md](Agents.md), [Claude.md](Claude.md)
- Architecture docs: [docs/architecture/](docs/architecture/)

## Performance & Architecture

This project utilizes a **data-oriented core** to support high-speed Monte Carlo simulations and real-time analysis:

- **Histogram-first representation**: Tiles are u8 indices (0-41). Hands maintain a frequency histogram for O(1) lookups.
- **O(1) validation**: Win validation and distance-to-win use vector subtraction of histograms, enabling thousands of evaluations per second.
- **Unified card format**: Human-readable pattern metadata + engine-ready histograms consolidated into `unified_cardYYYY.json` for minimal mapping overhead.
- **Command/Event Pattern**: State transitions are driven by strictly validated commands and broadcast via deterministic events.

## Project Overview

This is a full-stack American Mahjong game featuring:

- **Server-authoritative architecture**: Rust backend ensures game integrity
- **Cross-platform client**: React + TypeScript via Vite; optional Tauri desktop wrapper
- **Type-driven state machine**: Rust enums make impossible states impossible
- **Multi-year card support**: Data-driven pattern system (2017–2025)
- **Complete rules**: Full Charleston, calling system, win validation

## Project Structure

```text
mpmahj/
├── apps/
│   └── client/          # React + TypeScript + Vite frontend (web + Tauri)
├── crates/
│   ├── mahjong_core/    # Pure core game logic (tiles, patterns, validation)
│   ├── mahjong_server/  # Axum server + WebSocket handling
│   └── mahjong_terminal/# CLI client for backend testing
├── data/                # NMJL card data (2017–2025)
├── docs/
│   └── architecture/    # System and state machine design
├── PLANNING.md          # UX and feature planning
└── README-ARCH.md       # Architecture overview
```

## Current Status

**Backend complete; frontend now actively integrating** 🎉

### ✅ Backend (v0.1.0)

- Core game logic: Full state machine, Charleston stages, turn flow, win validation
- AI system: 4 difficulty levels (Basic → Hard) with MCTS engine
- Networking: WebSocket server, sessions/rooms, authentication
- Persistence: Optional PostgreSQL, event sourcing, replay system
- Testing: Comprehensive Rust + server integration tests
- Type bindings: TypeScript types auto-generated from Rust via `ts-rs`

### 🚧 In Progress

- Frontend UI: Board, rack, melds, Charleston UI
- Client WebSocket integration and reconnection
- State management (Zustand/Jotai style, server-driven)
- Terminal UX polish and server feature parity

### 📋 Planned

- Matchmaking UI
- Replay viewer
- Player stats dashboard
- Mobile-responsive design

## Tech Stack

### Backend (Rust)

- Core logic: Pure Rust for rules/validation
- Server: Axum
- Real-time: WebSocket for multiplayer sync

### Frontend (TypeScript)

- Framework: React + TypeScript
- Build tool: Vite
- Desktop: Tauri (optional)
- State management: Lightweight (server-authoritative)

### Development Tools

- Linting: ESLint (TS), Clippy (Rust), Markdownlint
- Formatting: Prettier
- Unused code: Knip
- CI checks: `npm run check:all`

## Getting Started

### Prerequisites

- **Node.js**: >=18.0.0
- **npm**: >=9.0.0
- **Rust**: Latest stable (for server/core development)

### Installation

```bash
git clone <repository-url>
cd mpmahj
npm install
cargo build
```

### Environment Variables

The server supports the following environment variables:

#### CORS Configuration (Security)

**`ALLOWED_ORIGINS`** - Comma-separated list of allowed origins for CORS requests.

- **Development**: `ALLOWED_ORIGINS="http://localhost:5173,http://localhost:1420"`
- **Production**: `ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"`
- **Default**: `http://localhost:5173` (add `http://localhost:1420` only if running Tauri dev)

This mitigates CSRF by restricting cross-origin requests to trusted domains.

#### Other Variables

- **`PORT`** - Server port (default: `3000`)
- **`DATABASE_URL`** - PostgreSQL connection string (optional, enables persistence)
- **`SUPABASE_URL`** - Supabase project URL (optional, enables JWT authentication)

Example:

```bash
# Development with CORS protection
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:1420" \
PORT=3000 \
cargo run -p mahjong_server

# Production with database
ALLOWED_ORIGINS="https://yourdomain.com" \
DATABASE_URL="postgresql://user:pass@localhost/mahjong" \
PORT=8080 \
cargo run -p mahjong_server --release
```

### Development

```bash
# Client (web)
npm run dev

# Server (WebSocket at ws://localhost:3000/ws)
cd crates/mahjong_server
cargo run

# Lints & formatting (monorepo)
npm run check:all
```

#### Dev Servers (User Testing)

- One command (starts server + client):

  ```bash
  npm run dev:all
  ```

  - Prints: `ws://localhost:3000/ws` and `http://localhost:5173`
  - Optional: customize CORS

    ```bash
    # Include 1420 only if running Tauri dev
    ALLOWED_ORIGINS="http://localhost:5173" npm run dev:all
    ```

- Manual steps:

  ```bash
  # Terminal 1 – server
  ALLOWED_ORIGINS="http://localhost:5173" cargo run -p mahjong_server

  # Terminal 2 – client
  npm run dev --workspace=client
  ```

---

### Card Year Selection

The game supports multiple NMJL card years: **2017, 2018, 2019, 2020, 2025**.

**Terminal Client**:

```bash
# Create a room with 2025 card (default)
cargo run --bin mahjong_terminal -- --bot

# Create a room with 2020 card
cargo run --bin mahjong_terminal -- --bot --card-year 2020

# Interactive mode - use "create <year>" to specify year
cargo run --bin mahjong_terminal
> create 2019
```

**Rust Tests**:

To test with a different card year, edit the constant in [crates/mahjong_core/src/test_utils.rs](crates/mahjong_core/src/test_utils.rs):

```rust
pub const TEST_CARD_YEAR: u16 = 2020;  // Change to 2017, 2018, 2019, 2020, or 2025
```

Then run tests normally — all tests will use the specified year:

```bash
cargo test --workspace
```

**Frontend**:

Include `card_year` when creating rooms. Use a simple UI year selector sourced from `data/cards/`.

### TypeScript Type Generation

The backend auto-generates TypeScript type definitions from Rust using `ts-rs`:

```bash
cd crates/mahjong_core
cargo test export_bindings

# Output: apps/client/src/types/bindings/generated/
```

Import them in the frontend:

```typescript
import { Event, GameCommand, Tile, Seat } from '@/types/bindings/generated';
```

## Documentation

### Backend Documentation (Rust)

- **Rustdoc** - Canonical implementation reference for backend code
  - Generate: `cargo doc --open --no-deps` from project root
  - Module docs (`//!`) explain high-level concepts
  - Item docs (`///`) provide examples and validation rules
  - See [crates/mahjong_core/src/](crates/mahjong_core/src/) for core game logic

### Project Documentation (Markdown)

- [Agents.md](Agents.md) - Assistant context and coding guidelines
- [Claude.md](Claude.md) - Assistant context and architecture guide
- [PLANNING.md](PLANNING.md) - UX, game flow, features
- [docs/README.md](docs/README.md) - Documentation navigation
- [docs/adr/](docs/adr/) - Architecture Decision Records
- [docs/implementation/](docs/implementation/) - Implementation specs

## Frontend Quick Start

The backend is complete and the frontend is integrating. Here's the protocol:

### WebSocket Protocol

Connect to `ws://localhost:3000/ws` and exchange JSON envelopes:

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

1. State management: Lightweight (Zustand/Jotai), server-driven
2. WebSocket hook: `useGameWebSocket()` for lifecycle
3. Event reducer: Apply `Event` envelopes to local state
4. Optimistic UI: Roll back on `CommandRejected`
5. Reconnection: Handle `StateSnapshot` to restore state

### Key Integration Points

- Commands: See [crates/mahjong_core/src/command.rs](crates/mahjong_core/src/command.rs) and generated TS bindings under `apps/client/src/types/bindings/generated/`
- Events: See [crates/mahjong_core/src/event.rs](crates/mahjong_core/src/event.rs) and TS bindings
- State phases: See [crates/mahjong_core/src/flow.rs](crates/mahjong_core/src/flow.rs)
- Network tests: See [crates/mahjong_server/tests/](crates/mahjong_server/tests/)
- Full API docs: `cargo doc --open --no-deps`

## Game Rules Reference

This implementation follows National Mah Jongg League (NMJL) rules:

- 152 tiles (including 8 Jokers) + Flowers
- Mandatory Charleston (tile exchange phase)
- Annual card with standardized winning patterns
- No sequences for calling (only Pungs, Kongs, Quints)
- Jokers are wild (with restrictions)

See [PLANNING.md](PLANNING.md) for detailed game flow and user experience design.

## Contributing

Early-stage project; contribution guidelines will be established as the codebase matures.

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
- NMJL card data (2017–2025) for pattern validation

## Open Questions

### House Rules for Scoring?

1. Doubling score for winning on the last tile in the deck?
2. Extra points for self-drawn wins?
3. Penalties if you throw the winning tile?
