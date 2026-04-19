# American Mahjong Frontend

This is the React + TypeScript client app for the repo. It is a server-authoritative UI that talks
to the Rust backend over WebSocket and consumes generated TypeScript bindings from
`mahjong_core`.

## Quick Start

Prerequisites:

- Node.js >= 18
- npm >= 9

Install from the repo root:

```bash
npm install
```

Run just the client:

```bash
npm run dev --workspace=client
```

Most local work is easier from the repo root with the monorepo scripts in [README.md](../../README.md).

## Useful Commands

```bash
# From repo root
npm run dev --workspace=client
npm run type-check --workspace=client
npm run test:run --workspace=client
npm run test:e2e:recovery --workspace=client
npm run build --workspace=client
```

## App Structure

```text
apps/client/src/
├── components/
│   ├── game/         # Game board, phase UI, overlays, rail, tiles
│   └── ui/           # Shared UI primitives
├── features/         # Integration-style feature tests and feature modules
├── hooks/            # State and protocol hooks
├── lib/              # Protocol helpers, event handling, shared logic
├── pages/            # Top-level screens
├── stores/           # Zustand stores
├── test/             # Shared test helpers, mocks, fixtures
└── types/bindings/   # Generated Rust -> TypeScript bindings
```

## Current Architecture Notes

- React 19 + Vite
- Tailwind CSS + shadcn/ui primitives
- Zustand for UI/client-side state
- WebSocket transport via the `useGameSocket` stack
- Generated protocol types under `src/types/bindings/generated/`
- Frontend docs live in `docs/implementation/frontend/`

## Testing

- Unit/component/integration tests: Vitest + React Testing Library
- Browser/e2e coverage: Playwright
- Shared test docs: [src/test/README.md](./src/test/README.md)

The repo-level `npm run check:all` command is the main validation gate.

## Documentation

- Repo source of truth: [README.md](../../README.md)
- Current frontend doc map: [docs/implementation/frontend/README.md](../../docs/implementation/frontend/README.md)
- Current copy contract: [docs/implementation/frontend/messaging-reference.md](../../docs/implementation/frontend/messaging-reference.md)
- Historical frontend stories/audits: `.archive/docs/implementation/frontend/`
