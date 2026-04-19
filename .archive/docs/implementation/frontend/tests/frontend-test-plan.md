# Plan: Comprehensive Frontend Testing Strategy

Testing the frontend UX to ensure proper synchronization with the backend, covering command validation, event processing, state management, and all critical game flows.

## Steps

1. **Unit test Zustand stores** (`apps/client/src/stores/gameStore.ts`, `apps/client/src/stores/uiStore.ts`) — Test event application (`applyEvent`), state mutations, and snapshot reconciliation logic with mock events for all Public/Private/Analysis event types

2. **Unit test custom hooks** (`apps/client/src/hooks/useGameSocket.ts`, `apps/client/src/hooks/useActionQueue.ts`, `apps/client/src/hooks/useHistory.ts`) — Test WebSocket lifecycle (connect, authenticate, reconnect with backoff), event queue processing with animations, and history navigation with mock WebSocket

3. **Unit test command validation** (`apps/client/src/utils/commands.ts`) — Test all command builders (`DiscardTile`, `PassTiles`, `DeclareCallIntent`, etc.) validate phase, turn, tile ownership, and selection counts correctly before sending

4. **Component test critical UI flows** (`apps/client/src/components/game/CourtesyPassDialog.tsx`, `apps/client/src/components/game/TurnActions.tsx`, `apps/client/src/components/game/HandDisplay.tsx`, `apps/client/src/components/game/UndoButton.tsx`) — Test user interactions (tile selection, button clicks) trigger correct commands and respond to events properly using React Testing Library

5. **Integration test command-event flows** (new test suite with mock WebSocket server) — Test full synchronization: send command → receive events → state updates for Charleston passes (blind/standard), call window (intent buffering/priority), joker exchange, and undo flows (solo/voting)

6. **E2E test complete game scenarios** (Playwright setup) — Test multi-player Charleston (blind pass, IOU, courtesy negotiation, voting), turn progression with calling, history mode (jump/resume/truncate), and reconnection during active game phases with real backend or comprehensive mock

## Implementation Decisions

1. **Test infrastructure setup** — Vitest + React Testing Library for unit/component tests, Playwright for E2E tests. Playwright has excellent TypeScript support and WebSocket testing capabilities.

2. **Backend strategy** — E2E tests run against real Rust backend (spin up `mahjong_server` in test mode). Catches protocol and serialization issues that mocks would miss.

3. **Test data strategy** — Hand-craft minimal fixture states for common scenarios (mid-Charleston, call window open, history mode active). Store as JSON snapshots in `apps/client/tests/fixtures/`.

4. **CI integration** — Unit tests gate PR merges (fast feedback loop). E2E tests run post-merge on main branch (slower, acceptable to have bugs in main during pre-deployment phase).

## Next Steps

1. Set up Playwright configuration and test backend launcher
2. Create fixture library with common game states
3. Implement unit tests for stores (highest priority - core state logic)
4. Implement hook tests with mock WebSocket
5. Implement component tests for critical UI flows
6. Build E2E test suite for Charleston and gameplay flows
