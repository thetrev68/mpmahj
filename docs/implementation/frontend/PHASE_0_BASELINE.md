# Phase 0 Baseline — Frontend Refactor

**Date**: 2026-03-01
**Author**: Claude Sonnet 4.6
**Scope**: `apps/client/src`
**Purpose**: Exit criteria for Phase 0 of the frontend refactor plan. Records the pre-edit baseline, confirms the local `GameState` question, and provides the file ownership inventory and migration map.

---

## 1. Baseline Validation Results

### Vitest

```
Test Files  122 passed (122)
Tests       1374 passed | 11 todo (1385)
Duration    ~62s
```

**Pre-existing failures**: none.
**Pre-existing todos**: 11 (expected, tracked via `it.todo`).
All suites pass clean.

### TypeScript

```
npx tsc --noEmit → exit 0, no output
```

No pre-existing type errors.

---

## 2. GameBoard.tsx `GameState` Confirmation

**Question from Phase 0 task 5 of the plan**: Does `GameBoard.tsx` contain a local `GameState` type that extends the server snapshot with client-only fields?

**Answer**: Yes, partially. The situation is more nuanced than a simple extension.

### What exists

`GameBoard.tsx` declares two local types:

```ts
// GameBoard.tsx:65-70
export interface LocalDiscardInfo extends DiscardInfo {
  player: Seat;   // legacy alias for discarded_by
  turn: number;
  safe: boolean;
  called: boolean;
}

// GameBoard.tsx:111-148
export interface GameState {
  ...  // mostly mirrors GameStateSnapshot fields
  discard_pile: Array<LocalDiscardInfo>;   // client-extended shape
  exposed_melds?: Record<Seat, Array<Meld & { called_from?: Seat }>>;  // phantom optional field
}
```

### What actually flows through the app

`useGameBoardBridge.ts` returns `gameState: GameStateSnapshot | null`, not `GameState`. All downstream consumers — `CharlestonPhase`, `PlayingPhase`, `SetupPhase` — receive `GameStateSnapshot`.

### Conclusion for Phase 1

The `GameState` local type is **partially defunct** as a runtime carrier but still exported and referenced in some fixtures/tests. The phantom `exposed_melds` field and the `LocalDiscardInfo` extension pattern still exist and must be resolved as described in the plan.

Phase 1 Task 2 applies exactly as written: move the type out, rename it, build a derivation boundary.

---

## 3. File Ownership Inventory

### 3.1 Socket Transport / Protocol

| File | Role |
|---|---|
| `hooks/gameSocketTypes.ts` | WS envelope types (`Envelope = { kind: string; payload?: unknown }`), `ConnectionState`, `RecoveryAction`, `UseGameSocketReturn`. Generic — the root of problem 3.2. |
| `hooks/gameSocketTransport.ts` | Raw WebSocket lifecycle: `connect`, `disconnect`, `retryNow`, `send`, `sendRaw`, `flushPendingQueue`, heartbeat, backoff reconnect timer. |
| `hooks/gameSocketProtocol.ts` | Auth/resync protocol: parses raw JSON via `JSON.parse(...) as Envelope`, handles `AuthSuccess`, `RoomJoined`, `StateSnapshot`, `Error`. Owns `expectsResyncRef` and sends `RequestState` after reconnect auth. |
| `hooks/gameSocketEnvelopes.ts` | Builder helpers: `buildAuthenticateEnvelope`, `buildRequestStateEnvelope`. |
| `hooks/gameSocketRecovery.ts` | Payload classifiers: `isAuthErrorPayload`, `isResyncNotFoundPayload`. |
| `hooks/gameSocketSession.ts` | localStorage session persistence (`persistSessionToken`, `persistSeat`, `clearStoredSession`), `isSeat` guard, WS URL + reconnect constants. |
| `hooks/useGameSocket.ts` | Public hook: composes transport + protocol, exposes `send`, `subscribe`, `connect`, `disconnect`, `retryNow`, and all connection state fields. |

**Confirmed protocol-boundary problems (plan §3.2)**:

- `gameSocketTypes.ts:7-10`: `Envelope.payload` is `unknown`.
- `gameSocketProtocol.ts:123,135,143,158,180,188`: multiple `as` casts against raw `unknown` payload.
- `useGameBoardBridge.ts:47-49`: independent ad hoc `JSON.parse(...) as Envelope` in ws-test mode.

### 3.2 Event Interpretation

| File | Role |
|---|---|
| `hooks/useGameEvents.ts` | Event coordinator: subscribes to `Event`, `StateSnapshot`, `Error` envelopes; routes to public/private handlers; executes `UIStateAction` (dispatches to `dispatchUIAction` **and** re-emits via `eventBus.emit('ui-action', ...)`); executes `SideEffect`s. Owns `gameState`, `eventBus`, and local mirrors `callIntentsRef`, `discardedByRef`, `hasSubmittedPassRef`. |
| `lib/game-events/publicEventHandlers.ts` | Router: delegates to playing/charleston/setup/endgame sub-modules. |
| `lib/game-events/publicEventHandlers.playing.ts` | Playing-phase public event handlers (`TurnChanged`, `TileDrawn`, `TileDiscarded`, `CallWindowOpened`, etc.). |
| `lib/game-events/publicEventHandlers.charleston.ts` | Charleston-phase public event handlers. |
| `lib/game-events/publicEventHandlers.setup.ts` | Setup-phase public event handlers. |
| `lib/game-events/publicEventHandlers.endgame.ts` | End-game public event handlers (`MahjongDeclared`, `GameOver`, `WallExhausted`, etc.). |
| `lib/game-events/privateEventHandlers.ts` | Private (seat-specific) event handlers (`TileDrawnPrivate`, `CourtesyPassProposed`, etc.). |
| `lib/game-events/types.ts` | `EventHandlerResult`, `UIStateAction` (large union ~50 variants), `SideEffect`, `EventContext`, `CharlestonTimer`, `OpenCallWindowParams`, `ResolutionOverlayData`. |
| `lib/game-events/sideEffectManager.ts` | Manages `TIMEOUT`/`CLEAR_TIMEOUT` side effects with ID-keyed cleanup. |

**Confirmed event-bus problems (plan §3.4)**:

- `useGameEvents.ts:229`: `eventBus.emit('ui-action', action)` — every UI action is re-broadcast.
- `usePlayingPhaseEventHandlers.ts:57`: `eventBus.on('ui-action', (data) => ...)` — subscribes and casts `data as UIStateAction` then switches on `action.type`.
- `CharlestonPhase.tsx` also subscribes to `ui-action` bus (confirmed in file comments and source).

### 3.3 UI Transient State

| File | Role |
|---|---|
| `components/game/useGameBoardOverlays.ts` | Game-level overlays: dice, winner celebration, scoring screens, draw overlay, leave-game state. Owns `dispatchUIAction` function passed down to `useGameBoardBridge`. |
| `hooks/useCallWindowState.ts` | Call window state + timer. Has its own `callIntentsRef: MutableRefObject<CallIntentsRef>` with `{ intents, discardedBy }`. Delayed clear via `CALL_WINDOW_INTENTS_CLEAR_DELAY_MS` constant. |
| `hooks/usePlayingPhaseState.ts` | Playing-phase UI state: current turn, turn stage, resolution overlay. |
| `hooks/useCharlestonState.ts` | Charleston-phase UI state: staged tiles, pass direction, ready players, vote state, courtesy pass state. |
| `hooks/useAutoDraw.ts` | Auto-draw retry state for playing phase. |
| `hooks/useMahjongDeclaration.ts` | Mahjong declaration dialog state and dead-hand tracking. |
| `hooks/useMeldActions.ts` | Meld action dispatch state. |
| `hooks/useGameAnimations.ts` | Animation settings and animation state. |
| `hooks/useHintSystem.ts` | Hint system UI state. |
| `hooks/useHistoryPlayback.ts` | History playback/timeline state. |

**Confirmed ref-mirroring problems (plan §3.5)**:

- `useGameEvents.ts:133`: `callIntentsRef = useRef<CallIntentSummary[]>([])` — mirrors call intents locally.
- `useGameEvents.ts:134`: `discardedByRef = useRef<Seat | null>(null)` — mirrors `callWindow.callIntentsRef.discardedBy`.
- `useCallWindowState.ts:50`: `callIntentsRef: MutableRefObject<CallIntentsRef>` with `{ intents, discardedBy }` — a second copy of the same data.

### 3.4 Phase Control

| File | Role |
|---|---|
| `components/game/GameBoard.tsx` | Top-level orchestrator. Composes `useGameSocket`, `useGameBoardBridge`, `useGameBoardOverlays`, `useGamePhase`. Exports defunct `GameState` and `LocalDiscardInfo` types. |
| `components/game/useGameBoardBridge.ts` | Bridge: creates socket adapter (ws-mode or socketClient-mode), calls `useGameEvents`, exposes `gameState` + `sendCommand`. Also issues repeated `RequestState` polling (every 1 s, up to 8 attempts) independent of the socket protocol layer's own resync. |
| `components/game/useGamePhase.ts` | Derives current phase enum from `gameState`. |
| `components/game/phases/SetupPhase.tsx` | Setup phase component. Receives `GameStateSnapshot` + `sendCommand` + `eventBus`. |
| `components/game/phases/CharlestonPhase.tsx` | Charleston phase component. Receives `GameStateSnapshot` + `sendCommand` + `eventBus`. Subscribes to `ui-action` bus. |
| `components/game/phases/PlayingPhase.tsx` | Playing phase component. Composes all playing-phase sub-hooks and passes to `PlayingPhasePresentation` + `usePlayingPhaseEventHandlers`. |
| `components/game/phases/playing-phase/PlayingPhasePresentation.tsx` | Playing phase presentation layer. Props use `ReturnType<typeof useX>` for `animations`, `autoDraw`, `callWindow`, `historyPlayback`, `hintSystem`, `meldActions`, `playing`. |
| `components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` | Playing phase overlays. Also uses `ReturnType<typeof useX>` props. |
| `components/game/phases/playing-phase/usePlayingPhaseEventHandlers.ts` | Subscribes to `eventBus.on('ui-action', ...)`. Options interface uses `ReturnType<typeof useX>` for all hook dependencies. |
| `components/game/phases/playing-phase/usePlayingPhaseActions.ts` | Dispatches playing-phase action commands. |

**Confirmed over-coupling problems (plan §3.6)**:
`PlayingPhasePresentation.tsx` prop list (lines 28-40):

```ts
animations: ReturnType<typeof useGameAnimations>;
autoDraw:   ReturnType<typeof useAutoDraw>;
callWindow: ReturnType<typeof useCallWindowState>;
historyPlayback: ReturnType<typeof useHistoryPlayback>;
hintSystem: ReturnType<typeof useHintSystem>;
```

Same pattern in `PlayingPhaseOverlays.tsx` and `usePlayingPhaseEventHandlers.ts` options.

---

## 4. Migration Map (Phase 0 Scratch)

| Subsystem / Old Owner | New Owner (target) | Compat Layer |
|---|---|---|
| `GameState` local type in `GameBoard.tsx` | `GameStateSnapshot` (generated) + new `ClientGameView` type | No |
| `LocalDiscardInfo` (extends `DiscardInfo`) | Server `DiscardInfo` used directly; enriched fields moved into `ClientGameView` | No |
| `exposed_melds` phantom optional field on `GameState` | Client-only derived field inside `ClientGameView` | No |
| `Envelope = { kind: string; payload?: unknown }` | Discriminated union of named inbound envelope types | No |
| Raw `JSON.parse(...) as Envelope` in `gameSocketProtocol.ts` | Validated runtime decoder module | No |
| Ad hoc parse in `useGameBoardBridge.ts` ws-mode | Route through same decoder as protocol | No |
| `RequestState` polling in `useGameBoardBridge.ts` | Resync owned exclusively by socket protocol layer | No |
| `eventBus.emit('ui-action', ...)` in `useGameEvents.ts` | Delete; `dispatchUIAction` writes directly to UI state owner | No |
| `eventBus.on('ui-action', ...)` in `usePlayingPhaseEventHandlers.ts` | Direct Zustand store selectors | No |
| `eventBus.on('ui-action', ...)` in `CharlestonPhase.tsx` | Direct Zustand store selectors | No |
| `callIntentsRef` in `useGameEvents.ts` (duplicate) | Delete; single copy in UI state authority | No |
| `discardedByRef` in `useGameEvents.ts` (duplicate) | Delete; use `callWindow.callIntentsRef.discardedBy` or UI state authority | No |
| `ReturnType<typeof useX>` prop types in `PlayingPhasePresentation.tsx` / `PlayingPhaseOverlays.tsx` / `usePlayingPhaseEventHandlers.ts` | Explicit named interfaces per Phase 7 | No |
| `eventBus` `'ui-action'` channel | Delete entirely (Phase 4) | No |
| `eventBus` `'server-event'` channel | Narrow to typed `ServerEventNotification` union or delete if no consumers remain | No |

---

## 5. Phase 0 Exit Criteria — Checklist

- [x] Baseline test/type-check status is known (122 test files pass, tsc clean).
- [x] Pre-existing failures documented (none).
- [x] `GameBoard.tsx` `GameState` question answered: local type exists, is partially defunct as runtime carrier, phantom fields confirmed.
- [x] Ownership map for socket transport, event interpretation, UI transient state, and phase control is explicit.

**Phase 0 complete. Safe to proceed to Phase 1.**
