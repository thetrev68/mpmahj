# Agents - AI Assistant Context

This document provides concise context for AI assistants (agents) working on the
American Mahjong (NMJL) monorepo. It complements [Claude.md](Claude.md) with a
focused summary and quick pointers useful when making code changes or PRs.

## Quick Summary

- Cross-platform American Mahjong (NMJL rules): Rust backend + TypeScript/React frontend (Vite, optional Tauri).
- Server-authoritative design: all validation runs in Rust backend.
- Core crates: `mahjong_core`, `mahjong_server`, `mahjong_ai`.
- Card data for multiple years under `data/cards/` (2017–2025).
- WebSocket protocol uses `{ kind, payload }` envelopes with auth-first handshake.

## Key Principles for Agents

- Server is the single source of truth; avoid client-side authoritative validation.
- Use the Command → Validate → Event pipeline for all game actions.
- Prefer small, surgical patches that follow existing crate structure and tests.
- Frontend should not re-implement game logic; integrate via WebSocket envelopes and generated types.
- Apply events FIFO; do not reorder or mutate authoritative state locally.

## Tile Indexing (Quick Note)

- `Tile` binding is a numeric index `0–36` (includes Joker and Blank).
- Histogram/card data uses `0–41` with padding; see [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md).

## Files & Locations to Check First

- Backend API and validation: [crates/mahjong_core/src/](crates/mahjong_core/src/) (`command.rs`, `event.rs`, `table.rs`, `flow.rs`).
- Server networking and protocol: [crates/mahjong_server/src/](crates/mahjong_server/src/) and WebSocket endpoint `/ws` in `main.rs`.
- Frontend: [apps/client/](apps/client/) (Vite React + `src-tauri` for desktop).
- Pattern/card data: [data/cards/](data/cards/) `unified_cardYYYY.json` and [data/cards/README_RUNTIME.md](data/cards/README_RUNTIME.md).
- ADRs: [docs/adr/](docs/adr/) (auth handshake, visibility, timers, history, undo).

## Development & Verification

- Run Rust tests and linting locally before proposing changes:

```bash
cargo test --workspace
cargo clippy --all-targets --all-features
cargo fmt -- --check
```

- Monorepo checks (pre-push hooks): formatting, ESLint/Prettier, Knip, and workspace tests via `npm run check:all`.

## Common Tasks for Agents (Checklist)

1. Read relevant architecture docs under [docs/adr/](docs/adr/).
2. Identify the responsible crate: core (rules/flow), server (networking), AI (bots).
3. Make minimal code edits; update/add tests nearby; run `cargo test`.
4. Regenerate TS bindings when Rust types with `#[derive(TS)]` change:

```bash
cd crates/mahjong_core
cargo test export_bindings
# Output: apps/client/src/types/bindings/generated/
```

1. Run monorepo checks and formatting; fix any failures:

```bash
npm run check:all
```

## Naming Note

This file replaces the older `Agent.md` to clarify the plural role of
assistants. Keep `Agents.md` as the canonical assistant-facing context; [Claude.md](Claude.md)
remains the more detailed assistant reference.

---

See the pointer to this file in [README.md](README.md) under Quick links.
