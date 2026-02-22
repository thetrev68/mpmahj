# American Mahjong (NMJL)

Modern, cross-platform American Mahjong under NMJL rules, with a Rust backend and a TypeScript/React frontend (Vite + optional Tauri desktop).

## Quick Links

- Assistant execution policy: [Agents.md](Agents.md)
- Product requirements and UX scope: [PLANNING.md](PLANNING.md)
- Architecture docs: [docs/architecture/](docs/architecture/)
- ADRs: [docs/adr/](docs/adr/)
- QA readiness: [docs/implementation/qa/QA-READINESS-CHECKLIST.md](docs/implementation/qa/QA-READINESS-CHECKLIST.md)

## Documentation Ownership & Freshness

Use this ownership model to avoid duplicated or stale guidance.

| Document | Canonical For | Notes | Last Reviewed |
| --- | --- | --- | --- |
| `README.md` | Technical source of truth (setup, architecture, workflows, commands) | Primary entrypoint for humans and assistants | 2026-02-22 |
| `Agents.md` | AI execution policy only | Intentionally short and procedural | 2026-02-22 |
| `PLANNING.md` | Product intent (UX flow, roadmap, user-facing behavior) | Requirement-level planning, not runtime truth | 2026-02-22 |
| `CLAUDE.md` | Compatibility pointer | Redirects older links to canonical docs | 2026-02-22 |

If information conflicts:

1. Runtime behavior and code paths in Rust/TS are authoritative.
2. `README.md` wins for setup/architecture workflow.
3. `PLANNING.md` wins for product intent and user stories.
4. `Agents.md` wins for assistant process rules.

## Project Overview

This is a server-authoritative American Mahjong implementation with:

- Rust core for rules, validation, and state transitions
- Axum/WebSocket server for multiplayer sync
- React/TypeScript frontend (web first, optional Tauri desktop)
- Data-driven NMJL card support (2017, 2018, 2019, 2020, 2025)
- Generated TypeScript bindings from Rust (`ts-rs`)

## Architecture Highlights

- **Server-authoritative model**: backend is source of truth; client is UI.
- **Command/Event pattern**: client sends intent; server validates and emits events.
- **Type-driven state machine**: Rust enums prevent invalid phase/action combinations.
- **Data-oriented validation**:
  - Histogram-first tile representation for fast hand evaluation.
  - Unified card files (`unified_cardYYYY.json`) combine metadata + engine-ready data.

## Repository Structure

```text
mpmahj/
├── apps/
│   └── client/          # React + TypeScript + Vite frontend (web + optional Tauri)
├── crates/
│   ├── mahjong_core/    # Pure game logic (rules, phases, validation)
│   ├── mahjong_server/  # Axum server + WebSocket transport
│   └── mahjong_ai/      # Bot strategies and analysis
├── data/                # NMJL card data (2017–2025)
├── docs/                # Architecture, ADRs, implementation docs
├── PLANNING.md          # Product requirements and UX planning
├── Agents.md            # AI execution policy
└── README.md            # Technical source of truth
```

## Current Status

- Backend core and server are mature and heavily tested.
- Frontend is in active integration and feature expansion.
- Full monorepo quality gate exists via `npm run check:all`.

## Tech Stack

### Backend

- Rust workspace: `mahjong_core`, `mahjong_server`, `mahjong_ai`
- Server: Axum + WebSocket
- Persistence: optional PostgreSQL

### Frontend

- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- Vitest + React Testing Library
- Optional Tauri desktop wrapper

### Tooling

- ESLint, Prettier, markdownlint
- Rustfmt, Clippy
- Knip for unused code detection

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Rust (latest stable)

### Install

```bash
git clone <repository-url>
cd mpmahj
npm install
cargo build
```

## Run the Project

### Recommended (one command)

```bash
npm run dev:all
```

Starts server + client and prints endpoints.

### Manual (two terminals)

```bash
# Terminal 1: backend server
ALLOWED_ORIGINS="http://localhost:5173" cargo run -p mahjong_server

# Terminal 2: frontend
npm run dev --workspace=client
```

Client default URL: `http://localhost:5173`  
WebSocket endpoint: `ws://localhost:3000/ws`

## Environment Variables

### Core

- `PORT` (default `3000`)
- `DATABASE_URL` (optional, enables persistence)
- `SUPABASE_URL` (optional, enables JWT auth integration)

### CORS Security

- `ALLOWED_ORIGINS`: comma-separated allowlist.

Examples:

```bash
# Development
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:1420" PORT=3000 cargo run -p mahjong_server

# Production
ALLOWED_ORIGINS="https://yourdomain.com" DATABASE_URL="postgresql://user:pass@localhost/mahjong" PORT=8080 cargo run -p mahjong_server --release
```

## Common Commands

```bash
# Full monorepo gate (recommended before commit)
npm run check:all

# Frontend tests
npm run test:run --workspace=client

# Rust tests
cargo test --workspace

# Rust docs
cargo doc --open --no-deps

# API docs (Rustdoc + TypeDoc) output to docs/
npm run docs:api
```

### Encoding Guard (Mojibake)

To catch UTF-8 corruption patterns:

```bash
npm run check:mojibake
```

Also included in `npm run check:all` and pre-commit hooks.

## TypeScript Bindings (Rust -> TS)

Generate bindings from Rust types:

```bash
cd crates/mahjong_core
cargo test export_bindings
# Output: apps/client/src/types/bindings/generated/
```

## Card Year Support

Supported NMJL card years: **2017, 2018, 2019, 2020, 2025**.

- Frontend/runtime: include `card_year` in room creation when needed.
- Rust tests: change `TEST_CARD_YEAR` in `crates/mahjong_core/src/test_utils.rs`.

## WebSocket Protocol (Minimal)

- Authenticate first (`Authenticate` envelope).
- Create/join room (`CreateRoom` / `JoinRoom`).
- Send game commands through `Command` envelopes.
- Consume server `Event` envelopes and apply to UI state.

See these canonical implementation files:

- `crates/mahjong_core/src/command.rs`
- `crates/mahjong_core/src/event.rs`
- `crates/mahjong_core/src/flow.rs`
- `apps/client/src/types/bindings/generated/`

## Additional Documentation

- `docs/README.md` for docs navigation
- `docs/implementation/` for component and implementation specs
- `apps/client/TESTING.md` for frontend testing strategy

## Contributing

Keep changes small, validated, and aligned with canonical docs.

- Follow `Agents.md` for assistant/process policy.
- Run `npm run check:all` before staging.
- Prefer updating canonical docs over adding parallel docs.

## License

TBD
