# 04. Client State + UI Contracts - Implementation Plan

This plan translates `docs/implementation/04-client-state.md` into concrete steps and file-level guidance.

## Sources

- `docs/implementation/04-client-state.md`
- `docs/implementation/03-networking.md`
- `docs/architecture/06-command-event-system-api-contract.md`
- `docs/architecture/09-network-protocol.md`
- `docs/architecture/10-frontend-architecture.md`
- `docs/architecture/03-module-architecture.md`

## Scope

Implement client-side state management, event application ordering, animation queue, command gating, seat rotation, card viewer wiring, and reconnect behavior for the React client in `apps/client`.

## Plan

### 1) Scaffold client directories and bindings

- Ensure the client folder structure exists per `docs/architecture/10-frontend-architecture.md`:
  - `apps/client/src/store/`
  - `apps/client/src/hooks/`
  - `apps/client/src/components/`
  - `apps/client/src/animations/`
  - `apps/client/src/utils/`
  - `apps/client/src/types/`
- Ensure generated TypeScript bindings are available.
  - The docs refer to `apps/client/src/types/bindings`.
  - If missing, regenerate using `cargo test` (ts-rs) and wire an alias in Vite for `@/types/bindings`.
- Confirm the bindings include:
  - `GameEvent`, `Command`, `GamePhase`, `TurnStage`
  - `Seat`, `Tile`, `Meld`, `PlayerPublic` (or equivalent public player type)
  - Any snapshot or state payload used in reconnect flows

### 2) Implement the authoritative Game Store

Create `apps/client/src/store/gameStore.ts` with Zustand. This store mirrors server truth and is updated only via events.

State (from spec):

- `phase: GamePhase`
- `players: Record<Seat, PlayerPublic>`
- `mySeat: Seat | null`
- `turn: Seat`
- `wallRemaining: number`
- `discardPile: Tile[]`
- `hand: { concealed: Tile[]; exposed: Meld[] }` (local player only)

Actions:

- `applyEvent(event: GameEvent): void` (single entry point for all mutations)
- `replaceFromSnapshot(snapshot: GameStateSnapshot): void` (hard replace on reconnect)
- `reset(): void`
- Derived selectors: `isMyTurn`, `canCall`, `canDiscard` (computed from phase/turn)

Event reducer guidance (non-exhaustive):

- `TilesDealt`: set `hand.concealed` to `your_tiles`
- `TileDrawn`: update `wallRemaining`; if `tile` is present for local player, push to `hand.concealed`
- `TileDiscarded`: push to `discardPile`; if local player, remove one matching tile from `hand.concealed`
- `TileCalled`: update caller melds; if local player, remove `tiles_from_hand` and add `meld` to `hand.exposed`
- `JokerExchanged`: if local player, remove replacement tile from hand and add joker; update meld view
- `BlankExchanged`: if local player, remove blank from hand and add taken tile
- `TurnChanged`: update `turn`
- `PhaseChanged` / `CharlestonPhaseChanged`: update `phase`
- `TilesReceived`: append to `hand.concealed`
- `PlayerJoined` / `PlayerDisconnected` / `PlayerReconnected`: update `players`
- `GameStarting` / `GameOver` / `WallExhausted`: update phase or end-state fields

Keep all mutation inside `applyEvent`. Never do optimistic updates for core state.

### 3) Implement the UI Store (volatile local state)

Create `apps/client/src/store/uiStore.ts`.

State (from spec + frontend doc):

- `selectedTiles: Set<string>`
- `draggedTile: Tile | null`
- `showCardViewer: boolean`
- `hoveredTile: string | null`
- `isDragging: boolean`
- `sortingMode: 'suit' | 'rank'`

Utilities:

- `apps/client/src/utils/tileKey.ts` should generate stable keys for duplicates (use tile + index).

### 4) Implement the animation/action queue

Create `apps/client/src/hooks/useActionQueue.ts` and `apps/client/src/animations/orchestrator.ts`.

Rules (from spec):

- FIFO event processing; no reordering
- While animating, do not mutate gameStore
- Animation completion or timeout gates the event application
- User setting can disable animations (apply instantly)
- On reconnect, clear queue and apply pending events immediately

Queue API:

- `enqueueEvent(event: GameEvent)`
- `clearQueue()`
- `isAnimating`

Timeouts:

- Discard: ~2s
- Draw: ~1s
- Hard max to force completion

### 5) Implement WebSocket hook and routing

Create `apps/client/src/hooks/useGameSocket.ts`.

Responsibilities:

- Connect, authenticate, handle Ping/Pong
- Parse `Message` envelope
- Route `Event` to action queue
- Surface `Error` to UI
- Reconnect with exponential backoff and `RequestState`

Flow:

- On `Event`: `enqueueEvent(event)`
- On reconnect + `RequestState` response: `replaceFromSnapshot(...)` and `clearQueue()`

### 6) Command dispatch gating

Create `apps/client/src/utils/commands.ts`.

Rules:

- Send commands only from user intent: Discard, Call/Pass, Charleston pass, Declare Mahjong
- Validate phase/turn before sending
- Validate tile exists in local hand (no optimistic updates)
- Charleston pass must check count and no Jokers

### 7) Seat rotation mapping

Create `apps/client/src/utils/seat.ts` and use in table layout.

Formula:

- `visualIndex = (serverSeatIndex - mySeatIndex + 4) % 4`

Mapping:

- `0 = bottom`, `1 = left`, `2 = top`, `3 = right`

Use this mapping for rendering hands, discard piles, and player labels.

### 8) Card viewer wiring

Create `apps/client/src/components/ui/CardViewer.tsx` and `apps/client/src/utils/cardLoader.ts`.

Data source:

- Load `data/cards/cardYYYY.json` via either:
  - Copy to `apps/client/public/cards/` and fetch `/cards/card2025.json`, or
  - Configure Vite to allow JSON import from `../../data/cards`

Behavior:

- Filter by section
- Highlight potential matches based on current hand

### 9) Reconnect handling

- Store session token in `localStorage`
- On reconnect success, request state snapshot
- Replace `gameStore` entirely with snapshot
- Clear animation queue and apply pending events immediately

### 10) Tests

Add tests per `docs/implementation/06-testing.md`:

- Event ordering and `applyEvent` correctness
- Animation queue defers state changes until completion
- Seat rotation mapping

## Open questions / decisions

- Confirm snapshot event type and payload (spec mentions full state on reconnect but the event type in bindings must exist).
- Confirm the public player shape for `players` in the store.
- Decide the card JSON access strategy (public folder vs Vite import).

## Suggested file list

- `apps/client/src/store/gameStore.ts`
- `apps/client/src/store/uiStore.ts`
- `apps/client/src/hooks/useActionQueue.ts`
- `apps/client/src/hooks/useGameSocket.ts`
- `apps/client/src/animations/orchestrator.ts`
- `apps/client/src/utils/commands.ts`
- `apps/client/src/utils/seat.ts`
- `apps/client/src/utils/tileKey.ts`
- `apps/client/src/components/ui/CardViewer.tsx`
