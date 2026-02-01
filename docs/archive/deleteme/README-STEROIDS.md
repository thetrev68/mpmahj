# mpmahj — README (On Steroids)

Purpose: a single-file, developer-focused snapshot that answers: "What is done? What remains? What needs approval? What should I work on next?"

## Executive Summary

- **Backend (server + core)**: Substantially complete — core game engine, state machine, Charleston, turn flow, win validation, WebSocket server, and many integration tests exist.
- **Frontend**: Template + tooling in place. No production gameplay UI; WebSocket client integration and state management remain.
- **Docs**: Extensive archival design docs exist under `docs/` (many are drafts). Some are outdated or duplicated.

## How I established status (evidence)

- Tests: See `crates/mahjong_core/tests/` and `crates/mahjong_server/tests/` for unit + integration coverage (turn_flow, charleston_flow, networking_integration, etc.).
- Crates: `crates/mahjong_core` exports modules for game flow, rules, table, events, and tests (Cargo.toml shows version 0.1.0).
- Server: `crates/mahjong_server` contains an Axum server and WebSocket handler with integration tests (`networking_integration.rs`).
- README claims: Project README states "Backend (mostly) Complete" and lists many completed subsystems.

Completed Work (Concrete)

- Core engine: implemented — modules: `table`, `flow`, `tile`, `hand`, `meld`, `rules`, `scoring`, `history`.
  - Evidence: `crates/mahjong_core/src/lib.rs` and many tests under `crates/mahjong_core/tests`.
- Charleston & turn flow: implemented and covered by tests (`charleston_flow.rs`, `turn_flow.rs`).
- Win validation: implemented via histogram approach (data files under `data/cards/*`), tests in `unified_card_integration.rs`.
- Networking: WebSocket server, session handling, room/seat allocation, event routing (see `crates/mahjong_server/tests/networking_integration.rs`).
- AI: `crates/mahjong_ai` with multiple difficulty levels and benchmarks present (bench folder).

In Progress / Partial

- Frontend gameplay UI: `apps/client` is a Vite React + Tauri template; UI components and integration remain unfinished.
  - Evidence: TODOs in `apps/client/src/components/*` and `apps/client/src/utils/cardLoader.ts`.
- Type bindings: `ts-rs` usage is present; generation step exists but frontend wiring may be intermittent. README documents `cargo test export_bindings` procedure.
- Some docs and architecture sections are drafts (see `docs/architecture/00-ARCHITECTURE.md` lines noting Draft sections like Network Protocol, Frontend Architecture).

Needs Approval / Decision Items (owner + options)

- Frontend State Management choice — currently `TBD` (owner: frontend lead). Options: `Zustand` (small, simple), `Jotai` (atomic), `Redux Toolkit` (if more structure needed).
- House rules / scoring adjustments — README lists open questions (doubling, self-draw bonuses). Options: adopt NMJL defaults or define house rules (owner: product/maintainer).
- Which annual cards to support by default (data conversion note in server resources indicates 2021-2024 missing). Options: ship 2017–2020 + 2025, convert the rest, or mark as opt-in (owner: data maintainer).

-- Decisions made (approved):

- Frontend state management: `Zustand` chosen as the project standard.
- Scoring: adopt NMJL scoring defaults (no house-rule overrides by default).
- MVP card support: ship with `2025` only for MVP; other years are "quick follow-ups" and will be prioritized afterward.

Actionable Next Tasks (prioritized, with short effort estimates)

1. Frontend: small playable demo (difficulty: Medium, est: 3–5 days)
   - Implement `useGameWebSocket()` hook and minimal HUD showing hand, current turn, and discard action.
   - Files to edit: `apps/client/src/App.tsx`, `apps/client/src/hooks/useGameWebSocket.ts` (new), `apps/client/src/components/Playground/*`.
2. Bindings: Run and validate `ts-rs` generation (difficulty: Low, est: 1 day)
   - Command: `cd crates/mahjong_core && cargo test export_bindings` (generates `apps/client/src/types/bindings/generated/`).
3. Convert remaining card data (difficulty: Medium, est: 2–3 days)
   - Files: `data/cards/*` and `crates/mahjong_server/src/resources.rs` notes.
4. Trim and consolidate docs (difficulty: Low→Medium, est: 1–2 days)
   - Remove large deprecated archives into `docs/archive/` (already partly present) and keep a single authoritative `docs/architecture/00-ARCHITECTURE.md`.
5. Quick wins / triage items (difficulty: Very Low, est: <1 day each)
   - Replace `TODO` items in `apps/client/src/utils/cardLoader.ts` and small TODOs in UI components so devs can run a demo.
   - Add `README-STEROIDS.md` (this file) and link to it from project root README.

How to use this doc to pick work

- If you want high-impact visible work: implement the frontend playable demo (task 1). It unlocks user testing and reveals integration gaps.
- If you want low-risk maintenance: run type generation (task 2) and convert small TODOs in client loader.
- If you want product-level decisions: resolve the Needs Approval items (state mgmt, cards, house rules).

Commands & reproduction

- Run Rust tests (core + server):

```bash
cd crates
cargo test
```text

- Run client dev server:

```bash
cd apps/client
npm install
npm run dev
```text

- Generate TypeScript bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```text

- Find remaining TODOs/TBD quickly:

```pwsh
rg "TODO|FIXME|TBD|🚧|In Progress" -n || findstr /S /I "TODO FIXME TBD \uD83D\uDE97 In Progress" *
```text

References (quick links)

- Core lib: [crates/mahjong_core/src/lib.rs](crates/mahjong_core/src/lib.rs#L1-L20)
- Core tests: [crates/mahjong_core/tests](crates/mahjong_core/tests)
- Server networking tests: [crates/mahjong_server/tests/networking_integration.rs](crates/mahjong_server/tests/networking_integration.rs#L1-L120)
- Project README: [README.md](README.md#L1)

Notes & Caveats

- This file is a working snapshot — it isn't a replacement for the deep design docs but should be the single place to check status and pick the next task.
- I intentionally avoided making decisions for you; the "Needs Approval" section lists the choices and owners.

If you want, next I can:

- create a small `useGameWebSocket()` hook + minimal UI playground scaffold in `apps/client` (start Task 1), or
- open a PR that replaces the project README's long docs links with this `README-STEROIDS.md` and archives outdated docs.
