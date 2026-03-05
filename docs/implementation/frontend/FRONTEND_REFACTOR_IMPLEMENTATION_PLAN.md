# Frontend Refactor Implementation Plan

Under direction from Trevor:

- Initial analysis by Claude Sonnet 4.6 (March 1, 2026)
- Analysis review and document draft by GPT-5.3-Codex (March 1, 2026)
- Document review and final edit by Claude Sonnet 4.6 (March 1, 2026)

**Status**: In progress
**Audience**: Primary implementer (Codex) and repo maintainers
**Scope**: `apps/client`
**Intent**: Execute a full-architecture frontend refactor with minimal ambiguity, accepting temporary breakage during implementation while minimizing structural risk across the entire effort.

---

## 1. Purpose

This plan defines the execution order, architecture targets, file-level tasks, and validation gates for the frontend refactor of `mpmahj`.

The goal is not to preserve the current implementation incrementally. The goal is to replace unstable boundaries and remove architectural drift in a sequence that prevents downstream changes from being built on invalid assumptions.

This plan is written as an implementation document, not a brainstorm. Unless a phase explicitly calls out an open design decision, the listed tasks should be treated as concrete work items.

---

## 2. Working Assumptions

- The frontend is still in greenfield development.
- Temporary breakage is acceptable during the refactor.
- We still want to avoid unnecessary rewrite churn and hidden regressions.
- The generated TypeScript bindings remain the source of truth for server-owned data shapes.
- The current pure handler pattern (`EventHandlerResult`) is retained initially, then re-evaluated only after state and protocol boundaries are rebuilt.

---

## 3. Current Architectural Problems To Resolve

### 3.1 Mixed State Ownership

The current code mixes generated server state (`GameStateSnapshot`) with client-only fields and derived UI concerns. This creates repeated casting and makes it unclear which fields are authoritative.

Primary hotspots:

- `apps/client/src/lib/game-events/publicEventHandlers.playing.ts`
- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/hooks/useGameEvents.ts`

### 3.2 Weak Protocol Boundary

Inbound WebSocket JSON is parsed and cast into broad envelope types with `unknown` payloads. This means invalid payloads can cross the network boundary and fail deep in the app.

Primary hotspots:

- `apps/client/src/hooks/gameSocketTypes.ts`
- `apps/client/src/hooks/gameSocketProtocol.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`

### 3.3 Split Recovery Ownership

Reconnect and resync behavior is currently owned by more than one layer. The socket protocol requests state after auth/reconnect, and `useGameBoardBridge` also issues repeated `RequestState` polling.

Primary hotspots:

- `apps/client/src/hooks/gameSocketProtocol.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`

### 3.4 Custom UI Action Bus

`useGameEvents` dispatches UI actions and then re-broadcasts them over `eventBus`, while phase components subscribe and translate those actions into local hook state. This is effectively a custom reducer/event architecture without a clean owner.

Primary hotspots:

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseEventHandlers.ts`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`

### 3.5 Ref-Mirroring And Race-Prone Transient State

Several refs exist only to work around subscription timing or stale closures. Some transient state is also cleared by delayed timers, which can race with new state initialization.

Primary hotspots:

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/hooks/useCallWindowState.ts`

### 3.6 Over-Coupled Internal Contracts

`ReturnType<typeof useX>` is used as a component prop contract across several phase modules. This couples presentational code to hook implementation details and makes refactoring signatures noisy.

Primary hotspots:

- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseEventHandlers.ts`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseActions.ts`

---

## 4. Target Architecture

The target shape of the frontend is:

```text
WebSocket transport
  -> validated protocol decoder
  -> typed envelope stream
  -> event interpreter / coordinator
  -> client state model (server state + client UI state kept distinct)
  -> phase controllers
  -> presentation components
```

### 4.1 Required Rules In The Target State

- No client-only fields are attached directly to generated server snapshot types.
- All inbound WebSocket payloads are validated before they enter app logic.
- Reconnect and resync are owned by one layer only.
- UI actions are not re-broadcast through a generic event bus.
- Phase-local UI behavior is driven by an explicit controller/store API, not a generic `unknown` event channel.
- Delayed ref-clearing hacks are removed from transient interaction flows.
- Internal component contracts use explicit named interfaces, not inferred hook `ReturnType`.

---

## 5. Explicit Non-Goals

- Do not redesign the visual UI.
- Do not change backend message contracts unless the generated bindings themselves require it.
- Do not replace the game-phase component boundaries unless a phase becomes structurally unnecessary.
- Do not collapse files purely for cosmetic reasons before the new architecture is stable.

---

## 6. Execution Strategy

This refactor will be executed in dependency order. Each phase is structured to remove one category of ambiguity before the next phase depends on it.

The phases are intentionally front-loaded toward architecture, not toward “easy wins.” Low-cost cleanup items such as shared dialog extraction happen late because they are cheaper after state and ownership boundaries stop moving.

### 6.1 Current Phase Status

- Phase 0: Complete (implemented by Claude Sonnet 4.6)
- Phase 1: Complete (implemented by Claude Sonnet 4.6)
- Phase 2: Complete (implemented by Claude Sonnet 4.6)
- Phase 3: Complete (implemented by Claude Sonnet 4.6)
  <<Codex reviewed and revised some files from above.>>
- Phase 4: In progress (slices 4.1–4.2 complete - Claude Sonnet 4.6, slice 4.3 complete - Copilot, slice 4.4 complete - Claude Sonnet 4.6)
- Phase 5: Complete (tasks 1–5 complete - Claude Sonnet 4.6)
- Phase 6: Complete (tasks 1–5 complete - Claude Sonnet 4.6, regression coverage refined - Codex)
- Phase 7: Complete (tasks 1–4 complete - Claude Sonnet 4.6)
- Phase 8: Complete (slice 8.1 complete - Claude Sonnet 4.6)
- Phase 9: Complete (tasks 1–4 complete - Claude Sonnet 4.6)
- Phase 10: Not started

---

## 7. Phase Plan

### Phase 0: Baseline And Refactor Guardrails (Complete - Claude Sonnet 4.6)

Objective:

Create a clean working baseline and establish explicit rules for the refactor so the codebase does not sit in an ambiguous halfway state for long.

Why This Phase Exists:

The current frontend has enough moving parts that a direct rewrite can accidentally preserve the existing architecture through compatibility shims. This phase prevents that.

Tasks:

1. Record the current baseline before architectural edits.
2. Confirm the current frontend tests and type-check state from the local machine.
3. Document any pre-existing failures separately so they are not mistaken for refactor regressions.
4. Identify all files in `apps/client/src` that participate in:
   - socket transport/protocol
   - event interpretation
   - UI transient state
   - phase control
5. Read `apps/client/src/components/game/GameBoard.tsx` and confirm whether it contains a local `GameState` type that extends the server snapshot with client-only fields. Phase 1 Task 2 assumes it does. If no such local type exists, revise Phase 1 Task 2 before proceeding — the phantom field issue may be entirely inside `publicEventHandlers.playing.ts` rather than in `GameBoard.tsx`.
6. Create a short scratch migration map in the working notes while implementing:
   - old owner
   - new owner
   - compatibility layer required (`yes`/`no`)

Required Validation:

Run at the start of the refactor:

```bash
npx vitest run
npx tsc --noEmit
```

Do not proceed into later phases without knowing whether failures are newly introduced or pre-existing.

Exit Criteria:

- Baseline test/type-check status is known.
- The ownership map for major subsystems is explicit.

---

### Phase 1: Separate Server Snapshot From Client View Model (Complete - Claude Sonnet 4.6)

Objective:

Stop treating generated server state as the same thing as the UI’s working state.

Why This Phase Comes First:

Every later change depends on knowing which fields are authoritative and where client-only state belongs. Until that is true, type cleanup and event refactors will keep reintroducing casts and phantom fields.

Primary Files:

- `apps/client/src/components/game/GameBoard.tsx`
- `apps/client/src/lib/game-events/publicEventHandlers.playing.ts`
- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/types/bindings/generated/GameStateSnapshot.ts`
- Any file currently depending on local `GameState` semantics from `GameBoard.tsx`

Implementation Tasks:

1. Introduce a dedicated client state type layer.
   - Create a new module for client-facing state types.
   - This module must distinguish:
     - server-owned snapshot data
     - client-derived view data
     - client-only transient or display metadata

2. Replace the local `GameState` type in `GameBoard.tsx`.
   - The current `GameBoard.tsx` local interface extends server semantics with client-only fields such as alternate `exposed_melds`.
   - Move that definition out of `GameBoard.tsx`.
   - Rename it to something explicit such as `ClientGameState` or `GameViewState`.

3. Introduce a derivation boundary.
   - Create one explicit function or module that derives client state from:
     - `GameStateSnapshot`
     - client-side view metadata
   - This derivation layer becomes the only place where server data is transformed into client-facing shape.
   - Structural decision: the derivation boundary is a plain TypeScript type (`ClientGameView`) and a pure function (`deriveClientGameView(snapshot, uiState): ClientGameView`). It is not a hook or a Zustand selector. The derivation function is called inside `useGameEvents` whenever a new snapshot arrives. Do not introduce a more complex abstraction unless this proves insufficient during implementation.

4. Remove phantom augmentation from `publicEventHandlers.playing.ts`.
   - Eliminate the cast that adds `exposed_melds` onto `GameStateSnapshot`.
   - Replace it with one of:
     - updates against the new client state model
     - an explicit view-model derivation that stores call metadata outside the server snapshot

5. Audit all consumers of `gameState`.
   - Update consumers so they either:
     - read server snapshot fields only, or
     - read client-derived view model fields only
   - Avoid mixed reads from both unless the owning module intentionally combines them.

Design Constraints:

- Do not mutate or extend generated types directly.
- Do not create a second ad hoc “temporary” hybrid type.
- If a field exists only for UI convenience, it must live in client state, not in the server snapshot shape.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/lib/game-events/publicEventHandlers.playing.test.ts
npx vitest run apps/client/src/components/game/GameBoard.test.tsx
npx tsc --noEmit
```

Exit Criteria:

- No client-only fields are attached to `GameStateSnapshot`.
- The `exposed_melds` phantom pattern is removed.
- State ownership is explicit at the type level.

---

### Phase 2: Rebuild The WebSocket Boundary As A Typed Runtime Decoder

Objective:

Make network input trustworthy by validating inbound WebSocket messages at the protocol edge.

Why This Phase Comes Before Event Refactoring:

The event system should not be rebuilt on top of unchecked `unknown` payloads. The protocol boundary must become explicit before internal event orchestration is simplified.

Primary Files:

- `apps/client/src/hooks/gameSocketTypes.ts`
- `apps/client/src/hooks/gameSocketProtocol.ts`
- `apps/client/src/hooks/gameSocketEnvelopes.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`
- `apps/client/src/hooks/useGameSocket.ts`

Implementation Tasks:

1. Replace the generic envelope contract.
   - `Envelope` must become a discriminated union of known inbound and outbound envelope shapes.
   - Distinguish at minimum:
     - outbound command envelopes
     - auth / room / recovery protocol envelopes
     - inbound event envelopes
     - snapshot envelopes
     - error envelopes
     - ping / pong envelopes

2. Create a runtime decode layer.
   - Add a parser/decoder module responsible for:
     - parsing raw JSON
     - validating `kind`
     - validating payload shape per envelope kind
     - returning a typed result or failure
   - This may be implemented with manual type guards. A schema library is optional, not required.

3. Update `gameSocketProtocol.ts` to consume only decoded envelopes.
   - Parsing must no longer cast raw JSON directly to `Envelope`.
   - `handleMessage` must operate on validated protocol values.
   - Invalid messages must:
     - log a structured warning or error
     - stop at the protocol boundary

4. Remove duplicate ad hoc parsing in `useGameBoardBridge.ts`.
   - If `ws` testing mode still needs direct parsing, route it through the same decoder path.
   - Do not maintain a second independent parser for the fallback bridge.

5. Reduce or eliminate `unknown` payload handling in downstream code.
   - Any `as` casts that exist only because the protocol layer is broad should be removed here.
   - If a value remains `unknown`, it must be justified by a deliberate extension point rather than a missing decoder.

Design Constraints:

- Keep the generated binding types as the source of truth for event payload contents.
- Do not overfit to current tests by validating only the happy path.
- Avoid creating a “typed” envelope union that is still fed by unchecked casts.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/hooks/useGameSocket.test.ts
npx vitest run apps/client/src/hooks/useGameEvents.test.ts
npx tsc --noEmit
```

Exit Criteria:

- All inbound JSON is validated before reaching app logic.
- `gameSocketProtocol.ts` no longer parses and casts raw payloads directly.
- `useGameBoardBridge.ts` no longer maintains a separate ad hoc parse path.

---

### Phase 3: Consolidate Reconnect And Resync Ownership

Objective:

Make one layer responsible for reconnect lifecycle and state resync.

Why This Phase Must Happen Before UI Action Refactoring:

The UI layer should react to connection state, not coordinate state restoration itself. If reconnect/resync remains split, later UI changes will keep accreting fallback logic and duplicate state requests.

Primary Files:

- `apps/client/src/hooks/gameSocketProtocol.ts`
- `apps/client/src/hooks/gameSocketTransport.ts`
- `apps/client/src/hooks/useGameSocket.ts`
- `apps/client/src/components/game/useGameBoardBridge.ts`
- `apps/client/src/components/game/GameBoard.tsx`

Implementation Tasks:

1. Define the reconnect lifecycle explicitly.
   - Document the states in code comments and types:
     - disconnected
     - connecting
     - authenticated
     - reconnecting
     - resync pending
     - ready
     - terminal recovery action

2. Choose the owner.
   - The socket layer should own:
     - connection retries
     - session re-authentication
     - state resync requests after auth/reconnect
   - The board layer should not perform resync polling.

3. Remove `RequestState` retry ownership from `useGameBoardBridge.ts`.
   - Delete the repeated timer-based `RequestState` polling once the socket layer’s behavior is authoritative.
   - If retry logic is still required, move it into the socket/protocol layer with clear state ownership.

4. Make snapshot arrival the state-ready signal.
   - The coordinator above the socket should treat a validated `StateSnapshot` as the transition from “resync pending” to “ready.”

5. Audit the recovery API exposed to `GameBoard.tsx`.
   - Ensure `GameBoard` consumes stable connection/recovery state without needing to infer internal socket behavior.

Design Constraints:

- Do not leave duplicated `RequestState` logic in both layers.
- Do not make reconnect behavior implicit through timers without an owning state field.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/hooks/useGameSocket.test.ts
npx vitest run apps/client/src/components/game/useGameBoardBridge.test.ts
npx tsc --noEmit
```

Exit Criteria:

- Exactly one layer owns reconnect/resync behavior.
- `useGameBoardBridge.ts` no longer issues parallel resync requests.
- Connection lifecycle is explicit in state and code comments.

---

### Phase 4: Replace The `ui-action` Event Bus With A Single UI State Authority

Objective:

Remove the custom rebroadcast architecture and establish one explicit owner for transient UI state.

Why This Is The Core Refactor:

This is the largest architecture correction. It removes most stale-closure workarounds, reduces indirection, and replaces the current “dispatch then emit” loop with a real authority.

Primary Files:

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseEventHandlers.ts`
- `apps/client/src/components/game/phases/CharlestonPhase.tsx`
- `apps/client/src/components/game/useGameBoardOverlays.ts`
- `apps/client/src/lib/game-events/types.ts`
- Any component consuming `eventBus.on('ui-action', ...)`

Implementation Tasks:

1. Define the new owner for UI transient state.
   - Use a dedicated UI state container.
   - A small Zustand store is acceptable and is the most natural fit given the existing repo usage.
   - If Zustand is used, scope it to game UI concerns only. Do not merge it into unrelated room state.

2. Move `UIStateAction` application into that owner.
   - `UIStateAction` should be consumed by a real reducer/store API instead of being emitted as a generic event.
   - `dispatchUIAction` becomes a direct write into the UI authority.

3. Remove `eventBus.emit('ui-action', action)` from `useGameEvents.ts`.
   - This is a mandatory deletion, not an optional cleanup.

4. Replace phase-level `ui-action` subscriptions.
   - `usePlayingPhaseEventHandlers.ts` must stop subscribing to `ui-action`.
   - `CharlestonPhase.tsx` must stop subscribing to `ui-action`.
   - Replace those subscriptions with:
     - direct store selectors and actions, or
     - explicit phase controller callbacks

5. Reclassify `eventBus`.
   - The `'ui-action'` channel is removed entirely in this phase. This is a mandatory deletion, not a cleanup item.
   - The `'server-event'` channel is retained but must be narrowed. It currently broadcasts raw server events to `hintSystem` and `historyPlayback` inside `PlayingPhase`. Replace the current generic payload with a typed `ServerEventNotification` union covering only the event variants those two consumers actually handle. If no consumers remain after this phase, delete the bus entirely.
   - Do not replace the bus with another generic emitter under a new name. If an event channel survives, its payload type must be a named, exhaustive union — not `unknown` or `any`.

6. Move duplicated transient refs into the new authority.
   - Consolidate:
     - `callIntentsRef`
     - `discardedByRef`
     - pass submission flags
     - vote submission flags if duplicated elsewhere

Design Constraints:

- Do not replace the current event bus with another custom emitter abstraction under a new name.
- Do not leave one phase using the new UI owner while another still relies on `ui-action` rebroadcast unless the transition is temporary and immediately completed in the same phase of work.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/hooks/useGameEvents.test.ts
npx vitest run apps/client/src/components/game/phases/PlayingPhase.test.tsx
npx vitest run apps/client/src/components/game/phases/CharlestonPhase.test.tsx
npx tsc --noEmit
```

Exit Criteria:

- No `ui-action` rebroadcast remains.
- Phase UI behavior is driven by a single explicit UI state owner.
- Generic `unknown` UI action subscription patterns are removed.

---

### Phase 5: Re-scope `useGameEvents` Into A Coordinator Instead Of A Mixed Ownership Hook

Objective:

Simplify `useGameEvents` so it becomes an event coordinator rather than a catch-all hook with local mirrors, UI rebroadcasting, and protocol-adjacent behavior.

Why This Phase Follows The UI State Rewrite:

`useGameEvents` cannot be simplified cleanly while it still owns compatibility logic for the event bus. The architecture has to be corrected first.

Primary Files:

- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/lib/game-events/publicEventHandlers.ts`
- `apps/client/src/lib/game-events/privateEventHandlers.ts`
- `apps/client/src/lib/game-events/types.ts`
- `apps/client/src/lib/game-events/sideEffectManager.ts`

Implementation Tasks:

1. Redefine `useGameEvents` responsibilities.
   - It should:
     - subscribe to validated envelope streams
     - route public/private events
     - apply state updates
     - forward UI actions to the UI authority
     - execute side effects
   - It should not:
     - act as a generic cross-component event bus
     - hold duplicate UI state refs that the UI authority now owns

2. Remove local mirrors that only existed for the old architecture.
   - Audit and delete refs whose sole purpose was stale-closure avoidance for event bus subscriptions.

3. Reassess `EventHandlerResult`.
   - Keep the current pattern unless it is clearly obstructing the new design.
   - If kept:
     - narrow the types
     - ensure state updates are clearly server-state or client-state updates
   - If changed:
     - replace it in one pass, not piecemeal

4. Reclassify side effects.
   - Keep `TIMEOUT`, `CLEAR_TIMEOUT`, and sound handling only if they still fit the coordinator model.
   - Remove no-op or placeholder side-effect paths where possible.

5. Clean the public/private handler contexts.
   - Handler context should contain only the minimum explicit inputs.
   - It must no longer receive hidden mirrored state that is now stored elsewhere.

Design Constraints:

- Do not rewrite both the handler pattern and the phase UI architecture in the same partial step unless the replacement is complete in one phase.
- Avoid adding another intermediate abstraction layer between handlers and state unless it removes concrete complexity.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/lib/game-events/publicEventHandlers.test.ts
npx vitest run apps/client/src/lib/game-events/privateEventHandlers.test.ts
npx vitest run apps/client/src/hooks/useGameEvents.test.ts
npx tsc --noEmit
```

Exit Criteria:

- `useGameEvents` owns a narrow, coherent responsibility set.
- Duplicate local state mirrors are removed or clearly justified.
- Handler inputs are explicit and minimal.

---

### Phase 6: Remove Race-Prone Transient State And Timer-Based Ref Hacks

Objective:

Fix transient interaction flows that are currently correct only because of timing assumptions.

Why This Phase Waits Until Now:

These race conditions are easier to fix after ownership is clear. Earlier changes remove the architecture that created most of the stale-closure pressure.

Primary Files:

- `apps/client/src/hooks/useCallWindowState.ts`
- `apps/client/src/hooks/useGameEvents.ts`
- `apps/client/src/hooks/usePlayingPhaseState.ts`
- Any remaining transient-state hooks depending on delayed ref clearing

Implementation Tasks:

1. Remove delayed clearing from `useCallWindowState.ts`.
   - The current delayed `setTimeout` clear for `callIntentsRef` must be removed.
   - Replace it with explicit lifecycle transitions tied to call-window events.

2. Rework call-window state ownership.
   - Decide whether the call-window data belongs in:
     - the centralized UI state authority, or
     - a clearly phase-scoped hook with explicit inputs
   - Whichever owner is chosen, there must be exactly one authoritative source.

3. Consolidate duplicated `callIntentsRef` and `discardedByRef`.
   - `callIntentsRef` currently exists independently in both `useGameEvents.ts` and `useCallWindowState.ts`, tracking the same call intent data across two layers.
   - `discardedByRef` in `useGameEvents.ts` duplicates the `discardedBy` field already tracked inside `callWindow` state in `useCallWindowState`.
   - Move both to a single authoritative location — either the call-window hook (if it becomes the owner per task 2) or the UI state authority from Phase 4 — and delete the duplicates. There must be exactly one read site and one write site for each piece of data after this task.

4. Eliminate stale-closure ref mirroring.
   - Audit refs in game flow hooks.
   - If a ref exists only because event callbacks were long-lived, replace it with:
     - a stable store selector, or
     - a reducer/state machine transition

5. Add regression tests for rapid event sequencing.
   - Specifically test:
     - close call window followed immediately by open new call window
     - call resolution arriving during transition
     - repeated progress updates around window close/open

Design Constraints:

- Do not preserve timing-based cleanup as a “temporary” mechanism unless a clearly bounded replacement follow-up is already in the same phase.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/hooks/useCallWindowState.test.ts
npx vitest run apps/client/src/features/game/CallWindow.integration.test.tsx
npx tsc --noEmit
```

Exit Criteria:

- Timer-based ref invalidation is removed from call-window flow.
- Rapid event sequencing is covered by tests.
- Transient UI state is event-driven rather than timeout-driven where practical.

---

### Phase 7: Normalize Hook And Component Contracts

Objective:

Replace implementation-coupled hook return contracts with explicit named interfaces.

Why This Phase Is Deliberately Late:

If this happens earlier, the interfaces will churn during every architectural change. The right time to harden contracts is after ownership and data flow settle.

Primary Files:

- `apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.tsx`
- `apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.tsx`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseEventHandlers.ts`
- `apps/client/src/components/game/phases/playing-phase/usePlayingPhaseActions.ts`
- Any component prop types using `ReturnType<typeof use...>`

Implementation Tasks:

1. Replace `ReturnType<typeof useX>` in prop types.
   - Create explicit named interfaces for the narrow slice actually consumed by each component.

2. Split hook outputs into stable sub-interfaces.
   - Prefer separate contracts for:
     - read state
     - commands/actions
     - derived booleans/selectors

3. Narrow presentation props.
   - Presentation components should receive only what they render or invoke.
   - Do not pass entire hook objects if only a subset is needed.

4. Update tests to reflect the narrowed APIs.
   - Replace brittle mock hook-object shapes with explicit prop objects or controller mocks.

Design Constraints:

- Do not widen interfaces to replicate the full hook return if the component uses only part of it.
- Avoid creating “PropsFromHook” wrapper types that merely rename the old coupling.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/components/game/phases/playing-phase/PlayingPhasePresentation.test.tsx
npx vitest run apps/client/src/components/game/phases/playing-phase/PlayingPhaseOverlays.test.tsx
npx vitest run apps/client/src/components/game/phases/playing-phase/usePlayingPhaseEventHandlers.test.ts
npx tsc --noEmit
```

Exit Criteria:

- `ReturnType<typeof useX>` prop contracts are removed from targeted phase modules.
- Presentation components depend on explicit, narrow interfaces.

---

### Phase 8: Simplify File Topology After Responsibilities Stabilize

Objective:

Reduce navigation overhead only after the architecture is settled.

Why This Phase Is Not Earlier:

Moving files while responsibilities are still changing creates pure churn. Consolidation should happen after the code’s conceptual boundaries are stable.

Primary Files:

- `apps/client/src/hooks/gameSocketSession.ts`
- `apps/client/src/hooks/gameSocketEnvelopes.ts`
- `apps/client/src/hooks/gameSocketRecovery.ts`
- `apps/client/src/hooks/gameSocketTransport.ts`
- `apps/client/src/hooks/gameSocketProtocol.ts`
- `apps/client/src/hooks/useGameSocket.ts`

Implementation Tasks:

1. Reassess the socket file split after Phases 2 and 3.
   - Merge only micro-files that no longer represent meaningful seams.
   - Likely merge candidates:
     - `gameSocketSession.ts`
     - `gameSocketEnvelopes.ts`
     - possibly `gameSocketRecovery.ts`

2. Preserve real boundaries.
   - Keep `transport` and `protocol` separate if they still represent distinct responsibilities after the refactor.

3. Apply the same rule elsewhere.
   - Collapse files only where the result reduces conceptual overhead.
   - Do not collapse phase-domain modules that still map cleanly to game concepts.

Design Constraints:

- No file moves for aesthetic reasons alone.
- A smaller file count is not automatically better than clear subsystem boundaries.

Validation:

Run after completing the phase:

```bash
npx vitest run apps/client/src/hooks/useGameSocket.test.ts
npx tsc --noEmit
```

Exit Criteria:

- File topology reflects actual responsibilities.
- No meaningful subsystem boundary was flattened unnecessarily.

---

### Phase 9: Remove Type Escape Hatches And Rebuild Test Fixtures

Objective:

Eliminate the remaining unsound casts and make tests structurally match the production types.

Why This Phase Happens After The Architecture Rewrite:

If this happens earlier, the test fixtures will be rewritten multiple times while state ownership and event shapes are still changing.

Primary Files:

- `apps/client/src/lib/game-events/publicEventHandlers.charleston.ts`
- `apps/client/src/lib/game-events/publicEventHandlers.playing.ts`
- `apps/client/src/test/fixtures/index.ts`
- `apps/client/src/test/mocks/websocket.ts`
- `apps/client/src/test/mocks/zustand.ts`
- Any test helper currently relying on `as unknown as`

Implementation Tasks:

1. Remove production type escape hatches.
   - Replace the `VoteResult.votes` double cast with a typed conversion or validated shape.
   - Remove any remaining phantom field casts.
   - Remove weak payload casts made unnecessary by the new protocol boundary.

2. Rebuild fixture creation.
   - Replace `as unknown as GameState` fixture exports with typed fixture builders.
   - Builders should produce objects that satisfy the intended type at construction time.

3. Tighten test mock types.
   - Replace `any` where the mock can be expressed with concrete DOM or protocol event types.
   - Keep unavoidable test-only escape hatches isolated and clearly commented.

4. Tighten shared utility types.
   - Add `readonly` and explicit return types where they improve structural clarity after the main refactor.
   - Do this only after major type churn is over.

Design Constraints:

- Do not preserve `as unknown as` in production paths once the underlying ownership issues have been resolved.
- Avoid “fixing” tests by broadening production types again.

Validation:

Run after completing the phase:

```bash
npx vitest run
npx tsc --noEmit
```

Exit Criteria:

- High-risk production casts are removed.
- Test fixtures are typed at construction time.
- Remaining casts, if any, are narrow and justified.

---

### Phase 10: De-duplicate UI Primitives And Low-Risk Cleanup

Objective:

Finish the refactor by consolidating repeated patterns and removing residual cleanup items after the architecture is stable.

Why This Phase Is Last:

These are real improvements, but they are low-leverage compared with state ownership and protocol correctness. Doing them earlier wastes time on code that may be rewritten anyway.

Primary Files:

- `apps/client/src/components/game/ForfeitConfirmationDialog.tsx`
- `apps/client/src/components/game/LeaveConfirmationDialog.tsx`
- `apps/client/src/components/game/ResumeConfirmationDialog.tsx`
- `apps/client/src/hooks/useMahjongDeclaration.ts`
- `apps/client/src/hooks/useMeldActions.ts`
- Repeated hand-sorting helper call sites in event handlers
- `apps/client/package.json`

Implementation Tasks:

1. Extract a shared confirmation dialog primitive.
   - Identify shared structure and create a reusable component for common confirmation-dialog composition.
   - Keep specialized copy and field requirements in the caller-specific wrappers if needed.

2. Consolidate repeated helper logic.
   - Replace repeated `sortHand([...hand, tile])` style code with a named helper where it improves clarity.

3. Replace manual handler chains where beneficial.
   - In action-dispatch hooks, replace long boolean “try this, then this” chains with a clearer dispatch map or explicit registration model if it materially simplifies control flow.

4. Remove ambiguity from `TIMEOUT` side effects.
   - Several handlers in `publicEventHandlers.charleston.ts` and `publicEventHandlers.playing.ts` emit `TIMEOUT` side effects with empty `callback` bodies. Actual cleanup is done via ID-keyed lookup in `useGameEvents.ts`, making the `callback` field unused for most effects.
   - Decide: either use the `callback` for cleanup everywhere, or remove the `callback` field from the `TIMEOUT` type and rely exclusively on ID-keyed cleanup in `useGameEvents`.
   - Whichever approach is chosen, apply it consistently to all `TIMEOUT` emitters. The current hybrid — where some effects use the callback and others rely on the ID lookup — must not survive this phase.

5. Remove dead or unused dependencies only after usage is confirmed.
   - Check whether `immer` is genuinely removable, including test helpers and examples.
   - Remove only when no remaining code path depends on it.

Design Constraints:

- Do not let this phase introduce broad architecture changes.
- Keep it focused on simplification and de-duplication.

Validation:

Run after completing the phase:

```bash
npx vitest run
npx tsc --noEmit
npx prettier --write apps/client/src
```

Exit Criteria:

- Repeated UI boilerplate is reduced.
- Utility duplication is reduced where it improves readability.
- Unused dependencies are removed only if truly unused.

---

## 8. Cross-Phase Implementation Rules

### 8.1 Delete Compatibility Code Quickly

If a temporary compatibility adapter is introduced during a phase, it must be removed before the phase ends unless the phase explicitly states otherwise.

The frontend should not remain in a mixed old/new state across multiple phases unless there is a hard technical blocker.

### 8.2 Prefer Replacing Owners Over Bridging Owners

When moving responsibility:

- choose the new owner,
- migrate reads,
- migrate writes,
- delete the old owner.

Avoid prolonged dual-write or dual-read arrangements.

### 8.3 Keep Protocol And State Refactors Distinct

Do not combine “typed protocol boundary” work with “new UI state model” work in the same partial edit unless the change is complete end-to-end. These are both large refactors and should remain logically separate to keep debugging tractable.

### 8.4 Avoid Cosmetic Churn During Structural Phases

Do not reformat unrelated files, rename symbols for style only, or move files during Phases 1 through 7 unless the move directly supports the new architecture.

---

## 9. Verification Strategy

### 9.1 Minimum Validation Per Phase

Each phase must run:

```bash
npx tsc --noEmit
```

And the most relevant targeted Vitest suites listed in that phase.

### 9.2 Full Frontend Validation At Major Milestones

Run at the end of Phases 4, 7, and 10:

```bash
npx vitest run
npx tsc --noEmit
npx prettier --write .
```

### 9.3 Full Repo Validation Before Staging

Before any `git add`, run the repo validation pipeline from `AGENTS.md`:

```bash
cargo fmt --all
cargo check --workspace
cargo test --workspace
cargo clippy --all-targets --all-features
npx prettier --write .
npx tsc --noEmit
npm run check:all
```

If the refactor changes Rust bindings, also run:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

---

## 10. Risk Register

### Risk 1: Hidden Server Contract Drift

If the new protocol decoder is implemented against assumptions instead of generated bindings, it will introduce silent runtime incompatibilities.

**Mitigation**:

- Read the generated binding files first.
- Use typed guards that align with actual envelope and event shapes.

### Risk 2: Incomplete UI Ownership Migration

If `ui-action` rebroadcast is only partially removed, the codebase will end up with two UI state mechanisms and even more complexity than before.

**Mitigation**:

- Complete the migration within Phase 4.
- Remove all `ui-action` subscriptions in the same phase.

### Risk 3: Premature Prop Interface Cleanup

If explicit interfaces are introduced before architecture stabilizes, the interface layer will churn and create avoidable busywork.

**Mitigation**:

- Defer component contract normalization until Phase 7.

### Risk 4: Test Fixture Rewrite Masking Production Regressions

If fixtures are rewritten too early, tests may be “fixed” to match temporary transitional code instead of the intended final design.

**Mitigation**:

- Delay broad fixture cleanup until Phase 9.
- Use focused regression tests during structural phases.

---

## 11. Definition Of Done

The refactor is complete only when all of the following are true:

1. Generated server snapshot types are no longer extended with client-only fields.
2. All inbound WebSocket messages are validated at the protocol boundary.
3. Reconnect and state resync are owned by one layer only.
4. No `ui-action` rebroadcast remains.
5. Phase-local UI behavior no longer depends on generic event-bus subscriptions.
6. Race-prone timer-based ref clearing has been removed from call-window flow.
7. `ReturnType<typeof useX>` prop contracts have been replaced in the targeted phase modules.
8. High-risk `as unknown as` production casts have been removed.
9. Full frontend validation passes.
10. Full repo validation passes before staging.

---

## 12. Recommended First Execution Slice

The recommended first active implementation slice is:

1. Complete Phase 0.
2. Complete Phase 1 fully.
3. Complete Phase 2 fully.
4. Stop and re-evaluate the code shape before starting Phase 3.

Reason: after Phases 1 and 2, the biggest structural ambiguities (state shape and protocol trust boundary) are resolved. That is the earliest meaningful checkpoint where the downstream refactor surface becomes significantly clearer.

---

## 13. Notes For The Implementer

- Do not optimize for preserving exact internal APIs during this refactor.
- Do not carry temporary shims longer than needed.
- Prefer clear ownership changes over gradual indirection layers.
- If a phase reveals that `EventHandlerResult` is no longer worth keeping, stop and write a short delta note before replacing it. Do not silently switch architectural direction mid-phase.
- If the protocol refactor exposes backend/documentation mismatch, trust generated bindings first and update documentation after the code path is correct.

---

**Last Updated**: 2026-03-01
