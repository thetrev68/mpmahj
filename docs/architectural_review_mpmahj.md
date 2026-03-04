# Architectural Review: mpmahj Frontend (TypeScript/React)

## 1. Executive Summary

- **Best Practice:** The `EventHandlerResult` pure handler pattern (returning declarative `stateUpdates`/`uiActions`/`sideEffects`) is the single best architectural decision. **Keep as-is.**
- **Redux-lite Issue:** `UIStateAction` has become a manual reducer outside React. With 50+ variants dispatched via `eventBus`, it replicates Redux without the devtools or formal guarantees.
- **Socket Over-engineering:** The 6-file `gameSocket` split (~878 lines) is excessive. A single `useGameSocket.ts` of ~350 lines would suffice; extracted pieces lack independent tests.
- **Dispatch Chain:** The `eventBus` is a symptom of incomplete `UIStateAction` handling, causing a two-hop dispatch: `publicEventHandlers.ts` → `useGameEvents` → `eventBus.emit` → `usePlayingPhaseEventHandlers`.
- **Prop Typing:** `ReturnType<typeof useXxx>` as prop types couples presentation components directly to hook implementations, making refactoring brittle.
- **Stale Closures:** The ref-mirroring pattern (e.g., `deadHandPlayersRef.current = next`) is a necessary workaround for the current event-bus architecture but indicates a systemic smell.
- **Type Safety:** Three significant escape hatches exist: `unknown` payloads requiring `as` casts, phantom field augmentations, and `as unknown as GameState` in test fixtures.

---

## 2. Google TypeScript Style Guide Violations

### Unsafe `as` casts

- **`publicEventHandlers.charleston.ts`:** `votes as unknown as Record<Seat, CharlestonVote>` hides potential shape mismatches.
- **`publicEventHandlers.playing.ts`:** `prev as GameStateSnapshot & { exposed_melds?: ... }` augments a snapshot with a non-existent field.
- **`gameSocketProtocol.ts`:** 6 `as` casts on `envelope.payload` due to `unknown` typing.

### `any` in Test Infrastructure

- **`websocket.ts` (mock):** `Record<string, Set<(event: any) => void>>` — change to `(event: Event) => void`.
- **`zustand.ts` (mock):** Multiple `as any` casts with `eslint-disable`.

### Missing `readonly` / Explicit Returns

- **`gameSocketTypes.ts`:** `UseGameSocketReturn` needs `readonly` modifiers.
- **`types.ts`:** `EventHandlerResult` arrays should be `readonly`.
- **`utils.ts`:** `export function cn` missing explicit return type.

---

## 3. Over-Engineering Analysis

### a) `gameSocket` 6-file split

| File                     | Lines | Independently Tested? |
| :----------------------- | :---- | :-------------------- |
| `gameSocketSession.ts`   | 33    | No                    |
| `gameSocketEnvelopes.ts` | 26    | No                    |
| `gameSocketRecovery.ts`  | 29    | No                    |

**Recommendation:** Collapse the 3 micro-files into `gameSocketTypes.ts`. Merge transport and protocol into `createGameSocketCore()`.

### b) `publicEventHandlers` 5-file split

**Status: Justified.**
The cut by game phase (Setup: 71, Charleston: 253, Playing: 433, Endgame: 136, Dispatcher: 151) maps cleanly to domain boundaries.

### c) `UIStateAction` and `eventBus`

The `eventBus` currently handles two things:

1. **`ui-action`:** Re-broadcasting to phase components (**Broken/Two-hop**).
2. **`server-event`:** Broadcasting to `hintSystem` (**Legitimate**).

**Fix:** Move UI actions into a **Zustand store** to eliminate stale closures and the two-hop dispatch.

---

## 4. State Management Critique

| State Location                | Appropriate?                   |
| :---------------------------- | :----------------------------- |
| `roomStore` (Zustand)         | ✅ Shared cross-component      |
| `useGameSocket` local         | ⚠️ `playerId` should be global |
| `useGameEvents` (local + ref) | ✅ Server-owned single source  |
| `useGameBoardOverlays`        | ✅ GameBoard-scoped            |
| `useCallWindowState`          | ✅ PlayingPhase-scoped         |

### Duplication Issues

- `callIntentsRef`: Duplicated in `useGameEvents.ts` and `useCallWindowState.ts`.
- `discardedByRef`: Duplicated in `useGameEvents` and `useCallWindowState`.

---

## 5. Code Duplication Inventory

- **Confirmation Dialogs:** `Forfeit`, `Leave`, and `Resume` dialogs share 60 lines of boilerplate. Replace with a `ConfirmationDialog` primitive.
- **`handleUiAction` Chain:** `useMahjongDeclaration` and `useMeldActions` use a manual boolean chain. Replace with a registration array.
- **Empty Callbacks:** `TIMEOUT` side effects often have empty callback bodies.
- **Hand Sorting:** `sortHand([...hand, tile])` is repeated across 5 handlers. Use an `addToHand` helper.

---

## 6. Type Safety Issues

| Issue                        | Location                            | Severity |
| :--------------------------- | :---------------------------------- | :------- |
| `exposed_melds` phantom cast | `publicEventHandlers.playing.ts`    | High     |
| `votes` double cast          | `publicEventHandlers.charleston.ts` | High     |
| `Envelope.payload: unknown`  | `gameSocketProtocol.ts`             | Medium   |
| `as unknown as GameState`    | `test/fixtures/index.ts`            | Medium   |

---

## 7. First-Principles Minimum Viable Architecture

### Keep

- `EventHandlerResult` pure handler pattern.
- `SideEffectManager` and `useTileSelection`.
- Phase component boundaries and the 5-file handler split.

### Collapse / Remove

- **Collapse:** `gameSocket` micro-files into `useGameSocket.ts`.
- **Remove:** `immer` dependency (unused).
- **Consolidate:** Dual `callIntentsRef` and `discardedByRef` into `useCallWindowState`.

### Replace

- **Zustand:** Replace `eventBus` (use-1) with `useGameUIStore` for 50+ UI actions.
- **Interfaces:** Replace `ReturnType<typeof useXxx>` with explicit named interfaces.
- **Discriminated Union:** Replace `unknown` payload with a typed `IncomingEnvelope`.

---

## 8. Recommended Refactoring Priority List

| Priority | Change                                              | Effort   | Impact      |
| :------- | :-------------------------------------------------- | :------- | :---------- |
| 1        | Fix `handleTileCalled` phantom `exposed_melds` cast | Low      | High        |
| 2        | Fix `VoteResult.votes` double cast                  | Low      | High        |
| 3        | Consolidate `callIntentsRef` + `discardedByRef`     | Low-Med  | Medium      |
| 4        | Extract `ConfirmationDialog` primitive              | Low      | Medium      |
| 5        | Collapse `gameSocket` micro-files                   | Med      | Medium      |
| 6        | Clean up `TIMEOUT` side effects                     | Med      | Medium      |
| 7        | Replace `ReturnType` props with explicit interfaces | Med-High | High        |
| 8        | Remove `immer` if unused                            | Trivial  | Low         |
| 9        | Type `IncomingEnvelope` as discriminated union      | High     | High        |
| 10       | **Migrate UI actions to Zustand (Remove eventBus)** | High     | **Highest** |
