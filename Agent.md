# Agent Notes

## Summary

- American Mahjong (NMJL) monorepo with Rust backend and React/Tauri frontend.
- Backend is server authoritative; frontend is currently a Vite template with no game UI.
- **Backend documentation**: Rustdoc is the canonical implementation reference (run `cargo doc --open --no-deps`)
- **Architecture documentation**: Markdown docs under `docs/architecture/` cover high-level design
- **Implementation specs**: See `docs/implementation/` for feature specifications

## Structure

- crates/mahjong_core: core game logic (commands, events, table, tiles, flow, rules).
- crates/mahjong_server: Axum server with WebSocket networking, session/room management, rate limiting, heartbeat.
- crates/mahjong_terminal: terminal client scaffold.
- crates/mahjong_ai: AI scaffolding and strategies.
- apps/client: React + Vite + Tauri workspace (template state).
- data: NMJL card data (2017-2025).
- docs: architecture and implementation plans.

## Key Domain Rules (American Mahjong)

- 152 tiles, NMJL rules, mandatory Charleston.
- Jokers are wild for sets but not for pairs (unless literal Joker pair).
- Winning hands must be data-driven from the yearly NMJL card.

## Commands

- Backend build/test: `cargo build`, `cargo test`, `cargo clippy`.
- Backend docs: `cargo doc --open --no-deps` (rustdoc is the canonical API reference)
- Frontend dev: `npm run dev:client`.
- Linting: `npm run lint`, `npm run lint:rust`, `npm run lint:md`.

## Backend Notes

- **Documentation**: Run `cargo doc --open --no-deps` for complete API docs with examples
- **Integration markers**: Look for `FRONTEND_INTEGRATION_POINT` comments in rustdoc
- WebSocket endpoint: `/ws` in `crates/mahjong_server/src/main.rs`.
- Message envelopes: `crates/mahjong_server/src/network/messages.rs`.
- Sessions support reconnect with grace period; rate limiting is in `network/rate_limit.rs`.
- Server auth uses Supabase; requires `SUPABASE_URL`.

## Frontend Status

- `apps/client` is the default Vite React template; no gameplay UI yet.
- `src-tauri` exists for desktop packaging.

## Open TODOs Seen in Code

- Pattern validation and joker replacement checks in `mahjong_core::table`.
- Terminal client event handling and bot logic.
- Type sharing between Rust and TS not yet wired (typeshare/ts-rs mentioned in docs).
