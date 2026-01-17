````markdown
# Agents - AI Assistant Context

This document provides concise context for AI assistants (agents) working on the
American Mahjong (NMJL) monorepo. It complements `CLAUDE.md` with a focused
summary and quick pointers useful when making code changes or PRs.

## Quick Summary

- Cross-platform American Mahjong (NMJL rules) with a Rust backend and a
  TypeScript/React frontend (Vite + Tauri).
- Server-authoritative design: all game validation runs in Rust backend.
- Core crates: `mahjong_core`, `mahjong_server`, `mahjong_ai`, `mahjong_terminal`.
- Card data for multiple years lives in `data/cards/` (2017–2025 supported).

## Key Principles for Agents

- Server is the single source of truth; never suggest client-side authoritative
  validation. Frontend changes should be presentation-only unless explicitly
  asked to implement API clients.
- Use the Command → Validate → Event pipeline: commands submitted by clients
  are validated on the server and produce events describing the new reality.
- Prefer small, surgical patches that follow existing crate structure and tests.

## Files & Locations to Check First

- Backend API and validation: `crates/mahjong_core/src/` (`command.rs`,
  `event.rs`, `table.rs`, `flow.rs`).
- Server networking and protocol: `crates/mahjong_server/src/network/` and
  `crates/mahjong_server/src/main.rs` (WebSocket `/ws`).
- Terminal client: `crates/mahjong_terminal/src/` (small CLI helper and UI).
- Frontend template: `apps/client/` (Vite React + `src-tauri` for desktop).
- Pattern/card data: `data/cards/unified_cardYYYY.json` and
  `data/cards/README_RUNTIME.md`.

## Development & Verification

- Run Rust tests and linting locally before proposing changes:

```bash
cargo test --workspace
cargo clippy --all-targets --all-features
cargo fmt -- --check
```
````

- Monorepo checks (pre-push hooks): formatting, ESLint/Prettier, Knip, and
  workspace tests are run via `npm run check:all` (see `package.json`).

## Common Tasks for Agents (Checklist)

1. Read the relevant architecture docs under `docs/architecture/`.
2. Find the responsible crate for the change (`mahjong_core` for rules/flow,
   `mahjong_server` for networking, `mahjong_ai` for bots, `mahjong_terminal`
   for CLI behavior).
3. Make minimal code edits, update/add tests nearby, run `cargo test`.
4. Run formatting and linters, amend commits if pre-push hooks fail.

# Agents - AI Assistant Context

This document provides concise context for AI assistants (agents) working on the
American Mahjong (NMJL) monorepo. It complements `CLAUDE.md` with a focused
summary and quick pointers useful when making code changes or PRs.

## Quick Summary

- Cross-platform American Mahjong (NMJL rules) with a Rust backend and a
  TypeScript/React frontend (Vite + Tauri).
- Server-authoritative design: all game validation runs in Rust backend.
- Core crates: `mahjong_core`, `mahjong_server`, `mahjong_ai`, `mahjong_terminal`.
- Card data for multiple years lives in `data/cards/` (2017–2025 supported).

## Key Principles for Agents

- Server is the single source of truth; never suggest client-side authoritative
  validation. Frontend changes should be presentation-only unless explicitly
  asked to implement API clients.
- Use the Command → Validate → Event pipeline: commands submitted by clients
  are validated on the server and produce events describing the new reality.
- Prefer small, surgical patches that follow existing crate structure and tests.

## Files & Locations to Check First

- Backend API and validation: `crates/mahjong_core/src/` (`command.rs`,
  `event.rs`, `table.rs`, `flow.rs`).
- Server networking and protocol: `crates/mahjong_server/src/network/` and
  `crates/mahjong_server/src/main.rs` (WebSocket `/ws`).
- Terminal client: `crates/mahjong_terminal/src/` (small CLI helper and UI).
- Frontend template: `apps/client/` (Vite React + `src-tauri` for desktop).
- Pattern/card data: `data/cards/unified_cardYYYY.json` and
  `data/cards/README_RUNTIME.md`.

## Development & Verification

- Run Rust tests and linting locally before proposing changes:

```bash
cargo test --workspace
cargo clippy --all-targets --all-features
cargo fmt -- --check
```

- Monorepo checks (pre-push hooks): formatting, ESLint/Prettier, Knip, and
  workspace tests are run via `npm run check:all` (see `package.json`).

## Common Tasks for Agents (Checklist)

1. Read the relevant architecture docs under `docs/architecture/`.
2. Find the responsible crate for the change (`mahjong_core` for rules/flow,
   `mahjong_server` for networking, `mahjong_ai` for bots, `mahjong_terminal`
   for CLI behavior).
3. Make minimal code edits, update/add tests nearby, run `cargo test`.
4. Run formatting and linters, amend commits if pre-push hooks fail.

## Naming Note

This file replaces the older `Agent.md` to clarify the plural role of
assistants interacting with the repository. Keep `Agents.md` as the canonical
assistant-facing context; `CLAUDE.md` remains the more detailed assistant
reference.

---

If you want, I can also add a short pointer from the root `README.md` to this
file or create a lightweight `docs/agents.md` entry. Which would you prefer?
